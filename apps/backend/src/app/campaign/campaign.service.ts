/**
 * CampaignService — logique métier pour la gestion des saisons.
 *
 * Suit le même principe que TeamService : toute méthode qui accède aux
 * données d'un utilisateur prend un `userId` et filtre dessus, pour
 * empêcher un utilisateur de voir les saisons d'un autre.
 *
 * Pour l'US1 (création + liste), une saison n'est visible que via la table
 * CampaignParticipant : `findAll` retourne les saisons où l'utilisateur a une
 * ligne CampaignParticipant (peu importe le statut pour l'instant — affinage
 * prévu dans une US ultérieure, cf. doc de conception §3 "findAll").
 */
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Campaign } from './campaign.entity';
import { CampaignParticipant } from './campaign-participant.entity';
import { CampaignState, ParticipantStatus } from './campaign.enums';
import { TeamService } from '../team/team.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignResponseDto } from './dto/campaign-response.dto';
import { CampaignSummaryDto } from './dto/campaign-summary.dto';
import { JoinCampaignDto } from './dto/join-campaign.dto';

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignParticipant)
    private participantRepo: Repository<CampaignParticipant>,
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

  private async assertTeamNotAlreadyEngaged(teamId: number, excludeCampaignId?: number): Promise<void> {
    const where = excludeCampaignId
      ? { teamId, campaignId: Not(excludeCampaignId) }
      : { teamId };
    const existing = await this.participantRepo.findOne({ where });
    if (existing) {
      throw new ConflictException('Cette équipe est déjà engagée dans une autre saison.');
    }
  }

  /**
   * Retourne toutes les saisons où l'utilisateur a un CampaignParticipant
   * (tous statuts confondus pour l'instant), enrichies avec participantCount
   * et myRole.
   */
  async findAll(userId: number): Promise<CampaignResponseDto[]> {
    const participations = await this.participantRepo.find({
      where: { userId },
      relations: { campaign: true, team: true },
    });

    return Promise.all(
      participations.map(async (participation): Promise<CampaignResponseDto> => {
        const participantCount = await this.participantRepo.count({
          where: { campaignId: participation.campaignId },
        });
        return {
          ...participation.campaign,
          participantCount,
          myRole: participation.isOrganizer ? 'organizer' : 'participant',
          myTeamName: participation.team?.name,
        };
      }),
    );
  }

  /**
   * Retourne les saisons où l'utilisateur a une demande d'inscription
   * (CampaignParticipant.status: PENDING) encore non traitée.
   *
   * Un participant PENDING n'est jamais organisateur — myRole vaut donc
   * toujours 'participant' (US4, CA1).
   */
  async findPendingForUser(userId: number): Promise<CampaignResponseDto[]> {
    const participations = await this.participantRepo.find({
      where: { userId, status: ParticipantStatus.PENDING },
      relations: { campaign: true },
    });

    return Promise.all(
      participations.map(async (participation): Promise<CampaignResponseDto> => {
        const participantCount = await this.participantRepo.count({
          where: { campaignId: participation.campaignId },
        });
        return {
          ...participation.campaign,
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
  async findOrganizedWithPendingRequests(userId: number): Promise<CampaignResponseDto[]> {
    const organizedCampaigns = await this.participantRepo.find({
      where: { userId, isOrganizer: true, status: ParticipantStatus.VALIDATED },
      relations: { campaign: true },
    });

    const enriched = await Promise.all(
      organizedCampaigns.map(async (participation) => {
        const [participantCount, pendingRequestsCount] = await Promise.all([
          this.participantRepo.count({ where: { campaignId: participation.campaignId } }),
          this.participantRepo.count({
            where: { campaignId: participation.campaignId, status: ParticipantStatus.PENDING },
          }),
        ]);
        return {
          ...participation.campaign,
          participantCount,
          myRole: 'organizer' as const,
          pendingRequestsCount,
        };
      }),
    );

    return enriched.filter((campaign) => (campaign.pendingRequestsCount ?? 0) > 0);
  }

  /**
   * Crée une nouvelle saison et inscrit son créateur comme organisateur.
   *
   * 1. Vérifie que `dto.teamId` appartient à l'utilisateur (NotFoundException
   *    sinon, via TeamService.findOneForUser).
   * 2. Crée la Season (state: EN_CONSTRUCTION, inviteCode généré).
   * 3. Crée le CampaignParticipant du créateur (isOrganizer: true, status: VALIDATED).
   */
  async create(userId: number, dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    if (dto.teamId) {
      await this.teamService.findOneForUser(dto.teamId, userId);
      await this.assertTeamNotAlreadyEngaged(dto.teamId);
    }

    const campaign = this.campaignRepo.create({
      name: dto.name,
      state: CampaignState.EN_CONSTRUCTION,
      inviteCode: this.generateInviteCode(),
    });
    const savedCampaign = await this.campaignRepo.save(season);

    const participant = this.participantRepo.create({
      campaignId: savedCampaign.id,
      userId,
      teamId: dto.teamId ?? null,
      status: ParticipantStatus.VALIDATED,
      isOrganizer: true,
    });
    await this.participantRepo.save(participant);

    return { ...savedCampaign, participantCount: 1, myRole: 'organizer' };
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
  async findByInviteCode(code: string): Promise<CampaignSummaryDto> {
    const campaign = await this.campaignRepo.findOne({ where: { inviteCode: code } });
    if (!season) {
      throw new NotFoundException('Code d\'invitation invalide.');
    }

    const [organizer, participantCount] = await Promise.all([
      this.participantRepo.findOne({
        where: { campaignId: campaign.id, isOrganizer: true },
        relations: { user: true },
      }),
      this.participantRepo.count({
        where: { campaignId: campaign.id, status: ParticipantStatus.VALIDATED },
      }),
    ]);

    return {
      id: campaign.id,
      name: campaign.name,
      state: campaign.state,
      organizerName: organizer ? `${organizer.user.firstName} ${organizer.user.lastName}` : '',
      participantCount,
    };
  }

  /**
   * Retourne le détail d'une saison — accessible uniquement aux utilisateurs
   * ayant un CampaignParticipant VALIDATED pour cette saison.
   *
   * Lève NotFoundException (message générique) sinon — pas de fuite
   * d'information sur l'existence de la saison (CA3).
   */
  async findOne(id: number, userId: number): Promise<CampaignResponseDto> {
    const participation = await this.participantRepo.findOne({
      where: { campaignId: id, userId, status: ParticipantStatus.VALIDATED },
      relations: { campaign: true },
    });
    if (!participation) {
      throw new NotFoundException('Saison introuvable.');
    }

    const participantCount = await this.participantRepo.count({
      where: { campaignId: id },
    });

    return {
      ...participation.campaign,
      participantCount,
      myRole: participation.isOrganizer ? 'organizer' : 'participant',
    };
  }

  /**
   * Crée une demande d'inscription (CampaignParticipant, status: PENDING) pour
   * l'utilisateur, avec l'équipe choisie.
   *
   * 1. Vérifie que `dto.teamId` appartient à l'utilisateur (NotFoundException
   *    sinon, via TeamService.findOneForUser).
   * 2. Vérifie que la saison existe et est encore EN_CONSTRUCTION (CA4).
   * 3. Vérifie qu'aucun CampaignParticipant n'existe déjà pour
   *    (campaignId, userId) (CA5) — contrôle explicite pour renvoyer un message
   *    clair plutôt que laisser la contrainte unique remonter une erreur SQL.
   */
  /**
   * Supprime définitivement une saison — organisateur uniquement.
   *
   * - `userId` doit correspondre à un CampaignParticipant VALIDATED avec
   *   isOrganizer=true pour cette saison, sinon NotFoundException (même
   *   principe que validate(), pas de fuite d'information).
   * - La suppression de la Season cascade sur tous ses CampaignParticipant
   *   (onDelete: 'CASCADE', cf. season-participant.entity.ts) — les équipes
   *   des participants ne sont pas affectées (aucune référence Team → Season).
   */
  /**
   * Change l'état d'une saison — organisateur uniquement.
   *
   * Les transitions sont bidirectionnelles (décision de design, cf. README.md §divergences).
   * Aucune garde de séquence n'est appliquée — seul le rôle organisateur est vérifié.
   */
  async changeState(campaignId: number, userId: number, newState: CampaignState): Promise<CampaignResponseDto> {
    const organizer = await this.participantRepo.findOne({
      where: { campaignId, userId, status: ParticipantStatus.VALIDATED, isOrganizer: true },
    });
    if (!organizer) {
      throw new NotFoundException('Saison introuvable.');
    }

    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!season) {
      throw new NotFoundException('Saison introuvable.');
    }

    campaign.state = newState;
    const saved = await this.campaignRepo.save(season);

    const participantCount = await this.participantRepo.count({ where: { campaignId } });
    return { ...saved, participantCount, myRole: 'organizer' };
  }

  async remove(campaignId: number, userId: number): Promise<void> {
    const organizer = await this.participantRepo.findOne({
      where: { campaignId, userId, status: ParticipantStatus.VALIDATED, isOrganizer: true },
    });
    if (!organizer) {
      throw new NotFoundException('Saison introuvable.');
    }

    await this.campaignRepo.delete(campaignId);
  }

  // ── Helpers d'autorisation réutilisables par les modules satellites ──────────
  //
  // Exposés publiquement (et CampaignService exporté par CampaignModule) pour que le
  // module Game réutilise la même logique d'accès saison sans dupliquer les
  // requêtes participant. Tous lèvent NotFoundException (404, jamais 403) pour
  // ne pas révéler l'existence d'une saison à un non-membre.

  /**
   * Vérifie que `userId` est organisateur VALIDATED de la saison et retourne
   * la Season. Lève NotFoundException sinon.
   */
  async assertOrganizer(campaignId: number, userId: number): Promise<Campaign> {
    const organizer = await this.participantRepo.findOne({
      where: { campaignId, userId, status: ParticipantStatus.VALIDATED, isOrganizer: true },
    });
    if (!organizer) {
      throw new NotFoundException('Saison introuvable.');
    }
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!season) {
      throw new NotFoundException('Saison introuvable.');
    }
    return season;
  }

  /**
   * Vérifie que `userId` est un participant VALIDATED de la saison (accès en
   * lecture, organisateur ou non) et retourne la Season. Lève NotFoundException
   * sinon.
   */
  async assertVisibleParticipant(campaignId: number, userId: number): Promise<Campaign> {
    const participation = await this.participantRepo.findOne({
      where: { campaignId, userId, status: ParticipantStatus.VALIDATED },
      relations: { campaign: true },
    });
    if (!participation) {
      throw new NotFoundException('Saison introuvable.');
    }
    return participation.campaign;
  }

  async requestJoin(campaignId: number, userId: number, dto: JoinCampaignDto): Promise<CampaignParticipant> {
    await this.teamService.findOneForUser(dto.teamId, userId);

    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!season) {
      throw new NotFoundException('Saison introuvable.');
    }

    if (campaign.state !== CampaignState.EN_CONSTRUCTION) {
      throw new BadRequestException('Cette saison n\'accepte plus de nouvelles inscriptions.');
    }

    const existing = await this.participantRepo.findOne({ where: { campaignId, userId } });
    if (existing) {
      throw new ConflictException('Vous avez déjà une demande d\'inscription pour cette saison.');
    }

    await this.assertTeamNotAlreadyEngaged(dto.teamId);

    const participant = this.participantRepo.create({
      campaignId,
      userId,
      teamId: dto.teamId,
      status: ParticipantStatus.PENDING,
      isOrganizer: false,
    });
    return this.participantRepo.save(participant);
  }
}
