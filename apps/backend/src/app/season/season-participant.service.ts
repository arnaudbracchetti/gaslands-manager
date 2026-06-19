/**
 * SeasonParticipantService — gestion des participants d'une saison
 * (consultation, validation/refus des demandes d'inscription).
 *
 * Suit le même principe que SeasonService : tout accès est filtré par
 * `userId` et lève NotFoundException (jamais 403) en cas d'accès refusé —
 * pas de fuite d'information sur l'existence d'une saison ou d'un participant.
 *
 * Les contrôles d'accès "participant validé" / "organisateur validé" sont de
 * simples requêtes sur SeasonParticipant — dupliquées ici plutôt que
 * factorisées dans SeasonService pour éviter toute dépendance croisée entre
 * les deux services (cf. season.service.ts pour le contrôle équivalent dans
 * findOne()).
 */
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { SeasonParticipant } from './season-participant.entity';
import { ParticipantStatus, SeasonState } from './season.enums';
import { SeasonParticipantResponseDto } from './dto/season-participant-response.dto';
import { TeamService } from '../team/team.service';

@Injectable()
export class SeasonParticipantService {
  constructor(
    @InjectRepository(SeasonParticipant)
    private participantRepo: Repository<SeasonParticipant>,
    // Réutilisé pour vérifier que `teamId` appartient bien à l'utilisateur
    // dans updateMyTeam() — même principe que SeasonService.requestJoin.
    private teamService: TeamService,
  ) {}

  /**
   * Lève ConflictException si l'équipe est déjà engagée dans une autre saison
   * (toutes saisons et tous statuts confondus).
   * Si `excludeSeasonId` est fourni, la saison courante est exclue de la
   * recherche — utile pour le changement d'équipe au sein d'une même saison.
   */
  private async assertTeamNotAlreadyEngaged(teamId: number, excludeSeasonId?: number): Promise<void> {
    const where = excludeSeasonId
      ? { teamId, seasonId: Not(excludeSeasonId) }
      : { teamId };
    const existing = await this.participantRepo.findOne({ where });
    if (existing) {
      throw new ConflictException('Cette équipe est déjà engagée dans une autre saison.');
    }
  }

  /** Mappe une entité SeasonParticipant (avec relations user/team chargées) vers son DTO de réponse. */
  private toDto(participant: SeasonParticipant): SeasonParticipantResponseDto {
    return {
      id: participant.id,
      userId: participant.userId,
      teamId: participant.teamId,
      status: participant.status,
      isOrganizer: participant.isOrganizer,
      userName: `${participant.user.firstName} ${participant.user.lastName}`,
      teamName: participant.team?.name ?? '',
    };
  }

  /**
   * Retourne tous les SeasonParticipant d'une saison (tous statuts), avec
   * noms d'utilisateur et d'équipe résolus.
   *
   * Accessible uniquement à un utilisateur ayant un SeasonParticipant
   * VALIDATED pour cette saison — NotFoundException sinon (CA3).
   */
  async findParticipants(seasonId: number, userId: number): Promise<SeasonParticipantResponseDto[]> {
    const requester = await this.participantRepo.findOne({
      where: { seasonId, userId, status: ParticipantStatus.VALIDATED },
    });
    if (!requester) {
      throw new NotFoundException('Saison introuvable.');
    }

    const participants = await this.participantRepo.find({
      where: { seasonId },
      relations: { user: true, team: true },
    });

    return participants.map((p) => this.toDto(p));
  }

  /**
   * Valide ou refuse une demande d'inscription PENDING, repasse un
   * participant REJECTED en VALIDATED, ou refuse un participant déjà
   * VALIDATED (l'exclut de la saison sans le supprimer — il apparaît alors
   * dans la section "Refusé" et peut être revalidé).
   *
   * - `organizerUserId` doit correspondre à un SeasonParticipant VALIDATED
   *   avec isOrganizer=true pour cette saison, sinon NotFoundException (CA7).
   * - `pid` doit désigner un SeasonParticipant de cette saison, sinon
   *   NotFoundException.
   * - `accept` true → status passe à VALIDATED, false → REJECTED.
   * - Refuser un participant VALIDATED (transition VALIDATED → REJECTED)
   *   n'est possible que si la saison est EN_CONSTRUCTION, et ne doit pas
   *   retirer le dernier organisateur validé (mêmes garde-fous que remove()).
   */
  async validate(
    seasonId: number,
    pid: number,
    organizerUserId: number,
    accept: boolean,
  ): Promise<SeasonParticipantResponseDto> {
    const organizer = await this.participantRepo.findOne({
      where: { seasonId, userId: organizerUserId, status: ParticipantStatus.VALIDATED, isOrganizer: true },
    });
    if (!organizer) {
      throw new NotFoundException('Saison introuvable.');
    }

    const participant = await this.participantRepo.findOne({
      where: { id: pid, seasonId },
      relations: { user: true, team: true, season: true },
    });
    if (!participant) {
      throw new NotFoundException('Demande d\'inscription introuvable.');
    }

    if (participant.status === ParticipantStatus.VALIDATED && !accept) {
      if (participant.season.state !== SeasonState.EN_CONSTRUCTION) {
        throw new BadRequestException('Cette saison n\'accepte plus de modifications de participants.');
      }
      if (participant.isOrganizer) {
        const organizerCount = await this.participantRepo.count({
          where: { seasonId, status: ParticipantStatus.VALIDATED, isOrganizer: true },
        });
        if (organizerCount <= 1) {
          throw new BadRequestException('Impossible de refuser le dernier organisateur de la saison.');
        }
      }
    }

    participant.status = accept ? ParticipantStatus.VALIDATED : ParticipantStatus.REJECTED;
    await this.participantRepo.save(participant);

    return this.toDto(participant);
  }

  /**
   * Retire un participant (validé ou en attente) d'une saison.
   *
   * - `organizerUserId` doit correspondre à un SeasonParticipant VALIDATED
   *   avec isOrganizer=true pour cette saison, sinon NotFoundException.
   * - `pid` doit désigner un SeasonParticipant de cette saison, sinon
   *   NotFoundException.
   * - La saison doit être EN_CONSTRUCTION, sinon BadRequestException.
   * - Si la cible est organisatrice, il doit rester au moins un autre
   *   organisateur validé après le retrait — sinon BadRequestException
   *   (évite une saison orpheline, cf. doc de conception §4).
   */
  async remove(seasonId: number, pid: number, organizerUserId: number): Promise<void> {
    const organizer = await this.participantRepo.findOne({
      where: { seasonId, userId: organizerUserId, status: ParticipantStatus.VALIDATED, isOrganizer: true },
    });
    if (!organizer) {
      throw new NotFoundException('Saison introuvable.');
    }

    const participant = await this.participantRepo.findOne({
      where: { id: pid, seasonId },
      relations: { season: true },
    });
    if (!participant) {
      throw new NotFoundException('Participant introuvable.');
    }

    if (participant.season.state !== SeasonState.EN_CONSTRUCTION) {
      throw new BadRequestException('Cette saison n\'accepte plus de modifications de participants.');
    }

    if (participant.isOrganizer) {
      const organizerCount = await this.participantRepo.count({
        where: { seasonId, status: ParticipantStatus.VALIDATED, isOrganizer: true },
      });
      if (organizerCount <= 1) {
        throw new BadRequestException('Impossible de retirer le dernier organisateur de la saison.');
      }
    }

    await this.participantRepo.delete(pid);
  }

  /**
   * Change l'équipe que l'utilisateur connecté engage dans la saison.
   *
   * - L'utilisateur doit avoir un SeasonParticipant VALIDATED pour cette
   *   saison, sinon NotFoundException (CA3, même principe que findOne).
   * - La saison doit être EN_CONSTRUCTION, sinon BadRequestException.
   * - `teamId` doit appartenir à l'utilisateur (TeamService.findOneForUser),
   *   sinon NotFoundException.
   */
  /**
   * Promeut un participant validé au rang de co-organisateur — organisateur uniquement.
   *
   * - La cible doit avoir status VALIDATED (pas PENDING ni REJECTED).
   * - La cible ne doit pas être déjà organisateur.
   */
  async promote(seasonId: number, pid: number, organizerUserId: number): Promise<SeasonParticipantResponseDto> {
    const organizer = await this.participantRepo.findOne({
      where: { seasonId, userId: organizerUserId, status: ParticipantStatus.VALIDATED, isOrganizer: true },
    });
    if (!organizer) {
      throw new NotFoundException('Saison introuvable.');
    }

    const participant = await this.participantRepo.findOne({
      where: { id: pid, seasonId },
      relations: { user: true, team: true },
    });
    if (!participant) {
      throw new NotFoundException('Participant introuvable.');
    }
    if (participant.status !== ParticipantStatus.VALIDATED) {
      throw new BadRequestException('Seul un participant validé peut être promu.');
    }
    if (participant.isOrganizer) {
      throw new BadRequestException('Ce participant est déjà organisateur.');
    }

    participant.isOrganizer = true;
    await this.participantRepo.save(participant);
    return this.toDto(participant);
  }

  async updateMyTeam(seasonId: number, userId: number, teamId: number | null): Promise<SeasonParticipantResponseDto> {
    const participant = await this.participantRepo.findOne({
      where: { seasonId, userId, status: ParticipantStatus.VALIDATED },
      relations: { season: true },
    });
    if (!participant) {
      throw new NotFoundException('Saison introuvable.');
    }

    if (participant.season.state !== SeasonState.EN_CONSTRUCTION) {
      throw new BadRequestException('Cette saison n\'accepte plus de changement d\'équipe.');
    }

    if (teamId === null) {
      // Seul l'organisateur peut se désengager sans choisir une nouvelle équipe
      if (!participant.isOrganizer) {
        throw new BadRequestException('Seul un organisateur peut retirer son équipe sans en choisir une autre.');
      }
      participant.teamId = null;
    } else {
      await this.teamService.findOneForUser(teamId, userId);
      await this.assertTeamNotAlreadyEngaged(teamId, seasonId);
      participant.teamId = teamId;
    }

    await this.participantRepo.save(participant);

    const updated = await this.participantRepo.findOne({
      where: { id: participant.id },
      relations: { user: true, team: true },
    });
    return this.toDto(updated as SeasonParticipant);
  }
}
