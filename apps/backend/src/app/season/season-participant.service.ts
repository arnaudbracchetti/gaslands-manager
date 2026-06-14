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
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeasonParticipant } from './season-participant.entity';
import { ParticipantStatus } from './season.enums';
import { SeasonParticipantResponseDto } from './dto/season-participant-response.dto';

@Injectable()
export class SeasonParticipantService {
  constructor(
    @InjectRepository(SeasonParticipant)
    private participantRepo: Repository<SeasonParticipant>,
  ) {}

  /** Mappe une entité SeasonParticipant (avec relations user/team chargées) vers son DTO de réponse. */
  private toDto(participant: SeasonParticipant): SeasonParticipantResponseDto {
    return {
      id: participant.id,
      userId: participant.userId,
      teamId: participant.teamId,
      status: participant.status,
      isOrganizer: participant.isOrganizer,
      userName: `${participant.user.firstName} ${participant.user.lastName}`,
      teamName: participant.team.name,
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
   * Valide ou refuse une demande d'inscription PENDING.
   *
   * - `organizerUserId` doit correspondre à un SeasonParticipant VALIDATED
   *   avec isOrganizer=true pour cette saison, sinon NotFoundException (CA7).
   * - `pid` doit désigner un SeasonParticipant de cette saison, sinon
   *   NotFoundException.
   * - `accept` true → status passe à VALIDATED, false → REJECTED.
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
      relations: { user: true, team: true },
    });
    if (!participant) {
      throw new NotFoundException('Demande d\'inscription introuvable.');
    }

    participant.status = accept ? ParticipantStatus.VALIDATED : ParticipantStatus.REJECTED;
    await this.participantRepo.save(participant);

    return this.toDto(participant);
  }
}
