import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { TeamOrm } from './entities/team.entity';
import { VehicleOrm } from './entities/vehicle.entity';
import { CampaignParticipantOrm } from '../../campaign/infrastructure/entities/campaign-participant.entity';
import { CampaignState, ParticipantStatus } from '../../campaign/domain/enums/campaign.enums';
import type { ITeamRepository, TeamSummaryDto } from '../domain/team.repository.interface';
import type { Team } from '../domain/team';
import { TeamMapper } from './team.mapper';

/**
 * Implémentation TypeORM de ITeamRepository.
 *
 * Deux responsabilités :
 * 1. Requêtes légères (findSummariesForUser, findSummaryById) — SQL avec COUNT,
 *    pas de chargement d'agrégat domaine.
 * 2. Chargement complet de l'agrégat (findByIdForUser, findByVehicleId, findByWeaponId)
 *    pour toutes les mutations — Team + tous ses Vehicle + Weapon + VehicleImprovement.
 */
@Injectable()
export class TeamRepository implements ITeamRepository {
  constructor(
    @InjectRepository(TeamOrm)
    private readonly teamOrmRepo: Repository<TeamOrm>,
    @InjectRepository(VehicleOrm)
    private readonly vehicleOrmRepo: Repository<VehicleOrm>,
    @InjectRepository(CampaignParticipantOrm)
    private readonly participantRepo: Repository<CampaignParticipantOrm>,
    private readonly mapper: TeamMapper,
  ) {}

  // ── Requêtes légères ──────────────────────────────────────────────────────────

  async findSummariesForUser(userId: number): Promise<TeamSummaryDto[]> {
    const orms = await this.teamOrmRepo.find({
      where: { userId },
      relations: { vehicles: { weapons: true, improvements: true, advantages: true } },
    });
    if (orms.length === 0) return [];
    const budgets = await this.resolveCampaignBudgets(orms.map((t) => t.id));
    return Promise.all(orms.map((t) => this.toSummaryDto(t, budgets.get(t.id) ?? null)));
  }

  async findSummaryById(teamId: number): Promise<TeamSummaryDto> {
    const orm = await this.teamOrmRepo.findOne({
      where: { id: teamId },
      relations: { vehicles: { weapons: true, improvements: true, advantages: true } },
    });
    if (!orm) throw new NotFoundException(`Équipe #${teamId} introuvable`);
    const budgets = await this.resolveCampaignBudgets([teamId]);
    return this.toSummaryDto(orm, budgets.get(teamId) ?? null);
  }

  private async toSummaryDto(orm: TeamOrm, campaignBudget: number | null): Promise<TeamSummaryDto> {
    const isEngaged = (await this.participantRepo.count({ where: { teamId: orm.id } })) > 0;
    const isLockedByCampaign = await this.isLockedByCampaign(orm.id);
    const team = this.mapper.toDomain(orm, isLockedByCampaign, campaignBudget);
    return {
      id: team.id,
      name: team.name,
      sponsor: team.sponsor,
      cans: team.cans,
      description: team.description,
      vehicleCount: team.vehicles.length,
      vehiclesCost: team.vehiclesCost,
      budget: team.budget,
      campaignBudget: team.campaignBudget,
      isEngaged,
      isLockedByCampaign,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }

  // ── Chargement complet de l'agrégat ──────────────────────────────────────────

  async findByIdForUser(teamId: number, userId: number): Promise<Team> {
    const orm = await this.teamOrmRepo.findOne({
      where: { id: teamId, userId },
      relations: { vehicles: { weapons: true, improvements: true, advantages: true } },
    });
    if (!orm) throw new NotFoundException(`Équipe #${teamId} introuvable`);
    const isLocked = await this.isLockedByCampaign(teamId);
    const budgets = await this.resolveCampaignBudgets([teamId]);
    return this.mapper.toDomain(orm, isLocked, budgets.get(teamId) ?? null);
  }

  async findByVehicleId(vehicleId: number, userId: number): Promise<Team> {
    // ⚠️ Même piège TypeORM que dans l'ancienne VehicleRepository.findByWeaponId :
    // un `where` sur une relation de collection ne filtre pas seulement la ligne
    // retournée, il altère aussi l'hydratation de cette collection. On résout donc
    // d'abord le teamId (sans hydrater), puis on recharge le Team complet.
    const found = await this.vehicleOrmRepo.findOne({
      where: { id: vehicleId, team: { userId } },
      select: { id: true, teamId: true },
    });
    if (!found) throw new NotFoundException(`Véhicule #${vehicleId} introuvable`);
    return this.findByIdForUser(found.teamId, userId);
  }

  async findByWeaponId(weaponId: number, userId: number): Promise<Team> {
    // Double-find : résoudre l'id du véhicule parent sans hydrater ses collections.
    const found = await this.vehicleOrmRepo.findOne({
      where: { weapons: { id: weaponId }, team: { userId } },
      select: { id: true, teamId: true },
    });
    if (!found) throw new NotFoundException(`Arme #${weaponId} introuvable`);
    return this.findByIdForUser(found.teamId, userId);
  }

  /**
   * Une équipe est verrouillée dès qu'un participant VALIDATED l'engage dans une
   * campagne qui n'est plus EN_CONSTRUCTION — cf. docs/spec/TEAMS.md.
   */
  private async isLockedByCampaign(teamId: number): Promise<boolean> {
    const lockedParticipant = await this.participantRepo.findOne({
      where: {
        teamId,
        status: ParticipantStatus.VALIDATED,
        campaign: { state: Not(CampaignState.EN_CONSTRUCTION) },
      },
      relations: { campaign: true },
    });
    return lockedParticipant !== null;
  }

  // ── Persistance ───────────────────────────────────────────────────────────────

  async save(team: Team): Promise<Team> {
    const ormData = this.mapper.toOrm(team);
    const saved = await this.teamOrmRepo.save(ormData as TeamOrm);
    return this.reloadById(saved.id, team.userId);
  }

  async remove(teamId: number, userId: number): Promise<void> {
    const orm = await this.teamOrmRepo.findOne({ where: { id: teamId, userId } });
    if (!orm) throw new NotFoundException(`Équipe #${teamId} introuvable`);
    await this.teamOrmRepo.remove(orm);
  }

  async findManyByIds(ids: number[]): Promise<Team[]> {
    if (ids.length === 0) return [];
    const orms = await this.teamOrmRepo.find({
      where: { id: In(ids) },
      relations: { vehicles: { weapons: true, improvements: true, advantages: true } },
    });
    const budgets = await this.resolveCampaignBudgets(orms.map((t) => t.id));
    return orms.map((orm) => this.mapper.toDomain(orm, false, budgets.get(orm.id) ?? null));
  }

  /**
   * teamId → budget de la campagne qui l'engage (participant VALIDATED), ou absent
   * si l'équipe n'est engagée dans aucune campagne. Miroir batché d'`isLockedByCampaign`,
   * mais sans filtre sur `Campaign.state` : le budget de campagne s'applique dès
   * EN_CONSTRUCTION, contrairement au verrouillage de l'équipe.
   */
  private async resolveCampaignBudgets(teamIds: number[]): Promise<Map<number, number>> {
    if (teamIds.length === 0) return new Map();
    const engagedParticipants = await this.participantRepo.find({
      where: { teamId: In(teamIds), status: ParticipantStatus.VALIDATED },
      relations: { campaign: true },
    });
    const budgets = new Map<number, number>();
    for (const participant of engagedParticipants) {
      if (participant.teamId !== null) budgets.set(participant.teamId, participant.campaign.budget);
    }
    return budgets;
  }

  private async reloadById(id: number, userId: number): Promise<Team> {
    return this.findByIdForUser(id, userId);
  }
}
