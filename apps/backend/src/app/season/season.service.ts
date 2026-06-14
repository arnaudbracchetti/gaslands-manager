/**
 * SeasonService — logique métier pour la gestion des saisons.
 *
 * Suit le même principe que TeamService : toute méthode qui accède aux
 * données d'un utilisateur prend un `userId` et filtre dessus, pour
 * empêcher un utilisateur de voir les saisons d'un autre.
 *
 * Pour l'US1 (création + liste), une saison n'est visible que via la table
 * SeasonParticipant : `findAll` retourne les saisons où l'utilisateur a une
 * ligne SeasonParticipant (peu importe le statut pour l'instant — affinage
 * prévu dans une US ultérieure, cf. doc de conception §3 "findAll").
 */
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Season } from './season.entity';
import { SeasonParticipant } from './season-participant.entity';
import { SeasonState, ParticipantStatus } from './season.enums';
import { TeamService } from '../team/team.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { SeasonResponseDto } from './dto/season-response.dto';
import { SeasonSummaryDto } from './dto/season-summary.dto';
import { JoinSeasonDto } from './dto/join-season.dto';

@Injectable()
export class SeasonService {
  constructor(
    @InjectRepository(Season)
    private seasonRepo: Repository<Season>,
    @InjectRepository(SeasonParticipant)
    private participantRepo: Repository<SeasonParticipant>,
    // Réutilisé pour vérifier que `dto.teamId` appartient bien à l'utilisateur
    // avant de créer la saison — TeamModule exporte déjà TeamService.
    private teamService: TeamService,
  ) {}

  /**
   * Génère un code d'invitation partageable hors-app.
   *
   * `randomBytes(6).toString('hex')` produit 12 caractères hexadécimaux —
   * l'espace de valeurs (16^12) rend une collision avec un code existant
   * extrêmement improbable. La contrainte `unique: true` sur la colonne
   * ferait échouer l'INSERT dans ce cas (non géré explicitement ici).
   */
  private generateInviteCode(): string {
    return randomBytes(6).toString('hex');
  }

  /**
   * Retourne toutes les saisons où l'utilisateur a un SeasonParticipant
   * (tous statuts confondus pour l'instant), enrichies avec participantCount
   * et myRole.
   */
  async findAll(userId: number): Promise<SeasonResponseDto[]> {
    const participations = await this.participantRepo.find({
      where: { userId },
      relations: { season: true },
    });

    return Promise.all(
      participations.map(async (participation): Promise<SeasonResponseDto> => {
        const participantCount = await this.participantRepo.count({
          where: { seasonId: participation.seasonId },
        });
        return {
          ...participation.season,
          participantCount,
          myRole: participation.isOrganizer ? 'organizer' : 'participant',
        };
      }),
    );
  }

  /**
   * Retourne les saisons où l'utilisateur a une demande d'inscription
   * (SeasonParticipant.status: PENDING) encore non traitée.
   *
   * Un participant PENDING n'est jamais organisateur — myRole vaut donc
   * toujours 'participant' (US4, CA1).
   */
  async findPendingForUser(userId: number): Promise<SeasonResponseDto[]> {
    const participations = await this.participantRepo.find({
      where: { userId, status: ParticipantStatus.PENDING },
      relations: { season: true },
    });

    return Promise.all(
      participations.map(async (participation): Promise<SeasonResponseDto> => {
        const participantCount = await this.participantRepo.count({
          where: { seasonId: participation.seasonId },
        });
        return {
          ...participation.season,
          participantCount,
          myRole: 'participant',
        };
      }),
    );
  }

  /**
   * Retourne les saisons organisées par l'utilisateur (participation
   * VALIDATED, isOrganizer: true) qui ont au moins une demande d'inscription
   * PENDING à traiter, avec le nombre de ces demandes (US4, CA2/CA3).
   */
  async findOrganizedWithPendingRequests(userId: number): Promise<SeasonResponseDto[]> {
    const organizedSeasons = await this.participantRepo.find({
      where: { userId, isOrganizer: true, status: ParticipantStatus.VALIDATED },
      relations: { season: true },
    });

    const enriched = await Promise.all(
      organizedSeasons.map(async (participation) => {
        const [participantCount, pendingRequestsCount] = await Promise.all([
          this.participantRepo.count({ where: { seasonId: participation.seasonId } }),
          this.participantRepo.count({
            where: { seasonId: participation.seasonId, status: ParticipantStatus.PENDING },
          }),
        ]);
        return {
          ...participation.season,
          participantCount,
          myRole: 'organizer' as const,
          pendingRequestsCount,
        };
      }),
    );

    return enriched.filter((season) => (season.pendingRequestsCount ?? 0) > 0);
  }

  /**
   * Crée une nouvelle saison et inscrit son créateur comme organisateur.
   *
   * 1. Vérifie que `dto.teamId` appartient à l'utilisateur (NotFoundException
   *    sinon, via TeamService.findOneForUser).
   * 2. Crée la Season (state: EN_CONSTRUCTION, inviteCode généré).
   * 3. Crée le SeasonParticipant du créateur (isOrganizer: true, status: VALIDATED).
   */
  async create(userId: number, dto: CreateSeasonDto): Promise<SeasonResponseDto> {
    await this.teamService.findOneForUser(dto.teamId, userId);

    const season = this.seasonRepo.create({
      name: dto.name,
      state: SeasonState.EN_CONSTRUCTION,
      inviteCode: this.generateInviteCode(),
    });
    const savedSeason = await this.seasonRepo.save(season);

    const participant = this.participantRepo.create({
      seasonId: savedSeason.id,
      userId,
      teamId: dto.teamId,
      status: ParticipantStatus.VALIDATED,
      isOrganizer: true,
    });
    await this.participantRepo.save(participant);

    return { ...savedSeason, participantCount: 1, myRole: 'organizer' };
  }

  /**
   * Retourne les informations minimales d'une saison à partir de son code
   * d'invitation — accessible à tout utilisateur connecté, sans vérification
   * d'appartenance (CA1).
   *
   * Lève NotFoundException (message générique) si le code ne correspond à
   * aucune saison — pas de fuite d'information sur l'existence d'autres
   * saisons (CA2).
   */
  async findByInviteCode(code: string): Promise<SeasonSummaryDto> {
    const season = await this.seasonRepo.findOne({ where: { inviteCode: code } });
    if (!season) {
      throw new NotFoundException('Code d\'invitation invalide.');
    }

    const organizer = await this.participantRepo.findOne({
      where: { seasonId: season.id, isOrganizer: true },
      relations: { user: true },
    });

    return {
      id: season.id,
      name: season.name,
      state: season.state,
      organizerName: organizer ? `${organizer.user.firstName} ${organizer.user.lastName}` : '',
    };
  }

  /**
   * Retourne le détail d'une saison — accessible uniquement aux utilisateurs
   * ayant un SeasonParticipant VALIDATED pour cette saison.
   *
   * Lève NotFoundException (message générique) sinon — pas de fuite
   * d'information sur l'existence de la saison (CA3).
   */
  async findOne(id: number, userId: number): Promise<SeasonResponseDto> {
    const participation = await this.participantRepo.findOne({
      where: { seasonId: id, userId, status: ParticipantStatus.VALIDATED },
      relations: { season: true },
    });
    if (!participation) {
      throw new NotFoundException('Saison introuvable.');
    }

    const participantCount = await this.participantRepo.count({
      where: { seasonId: id },
    });

    return {
      ...participation.season,
      participantCount,
      myRole: participation.isOrganizer ? 'organizer' : 'participant',
    };
  }

  /**
   * Crée une demande d'inscription (SeasonParticipant, status: PENDING) pour
   * l'utilisateur, avec l'équipe choisie.
   *
   * 1. Vérifie que `dto.teamId` appartient à l'utilisateur (NotFoundException
   *    sinon, via TeamService.findOneForUser).
   * 2. Vérifie que la saison existe et est encore EN_CONSTRUCTION (CA4).
   * 3. Vérifie qu'aucun SeasonParticipant n'existe déjà pour
   *    (seasonId, userId) (CA5) — contrôle explicite pour renvoyer un message
   *    clair plutôt que laisser la contrainte unique remonter une erreur SQL.
   */
  /**
   * Supprime définitivement une saison — organisateur uniquement.
   *
   * - `userId` doit correspondre à un SeasonParticipant VALIDATED avec
   *   isOrganizer=true pour cette saison, sinon NotFoundException (même
   *   principe que validate(), pas de fuite d'information).
   * - La suppression de la Season cascade sur tous ses SeasonParticipant
   *   (onDelete: 'CASCADE', cf. season-participant.entity.ts) — les équipes
   *   des participants ne sont pas affectées (aucune référence Team → Season).
   */
  async remove(seasonId: number, userId: number): Promise<void> {
    const organizer = await this.participantRepo.findOne({
      where: { seasonId, userId, status: ParticipantStatus.VALIDATED, isOrganizer: true },
    });
    if (!organizer) {
      throw new NotFoundException('Saison introuvable.');
    }

    await this.seasonRepo.delete(seasonId);
  }

  async requestJoin(seasonId: number, userId: number, dto: JoinSeasonDto): Promise<SeasonParticipant> {
    await this.teamService.findOneForUser(dto.teamId, userId);

    const season = await this.seasonRepo.findOne({ where: { id: seasonId } });
    if (!season) {
      throw new NotFoundException('Saison introuvable.');
    }

    if (season.state !== SeasonState.EN_CONSTRUCTION) {
      throw new BadRequestException('Cette saison n\'accepte plus de nouvelles inscriptions.');
    }

    const existing = await this.participantRepo.findOne({ where: { seasonId, userId } });
    if (existing) {
      throw new ConflictException('Vous avez déjà une demande d\'inscription pour cette saison.');
    }

    const participant = this.participantRepo.create({
      seasonId,
      userId,
      teamId: dto.teamId,
      status: ParticipantStatus.PENDING,
      isOrganizer: false,
    });
    return this.participantRepo.save(participant);
  }
}
