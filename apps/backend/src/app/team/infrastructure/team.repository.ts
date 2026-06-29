import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Team as TeamOrm } from './entities/team.entity';
import { Vehicle as VehicleOrm } from './entities/vehicle.entity';
import { SeasonParticipant } from '../../season/season-participant.entity';
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
    @InjectRepository(SeasonParticipant)
    private readonly participantRepo: Repository<SeasonParticipant>,
    private readonly mapper: TeamMapper,
  ) {}

  // ── Requêtes légères ──────────────────────────────────────────────────────────

  async findSummariesForUser(userId: number): Promise<TeamSummaryDto[]> {
    const teams = await this.teamOrmRepo.find({ where: { userId } });
    return Promise.all(teams.map((t) => this.toSummaryDto(t)));
  }

  async findSummaryById(teamId: number): Promise<TeamSummaryDto> {
    const team = await this.teamOrmRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException(`Équipe #${teamId} introuvable`);
    return this.toSummaryDto(team);
  }

  private async toSummaryDto(team: TeamOrm): Promise<TeamSummaryDto> {
    const vehicleCount = await this.vehicleOrmRepo.count({ where: { teamId: team.id } });
    const isEngaged = (await this.participantRepo.count({ where: { teamId: team.id } })) > 0;
    return {
      id: team.id,
      name: team.name,
      sponsor: team.sponsor,
      cans: team.cans,
      description: team.description ?? null,
      vehicleCount,
      isEngaged,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  // ── Chargement complet de l'agrégat ──────────────────────────────────────────

  async findByIdForUser(teamId: number, userId: number): Promise<Team> {
    const orm = await this.teamOrmRepo.findOne({
      where: { id: teamId, userId },
      relations: { vehicles: { weapons: true, improvements: true } },
    });
    if (!orm) throw new NotFoundException(`Équipe #${teamId} introuvable`);
    return this.mapper.toDomain(orm);
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
      relations: { vehicles: { weapons: true, improvements: true } },
    });
    return orms.map((orm) => this.mapper.toDomain(orm));
  }

  private async reloadById(id: number, userId: number): Promise<Team> {
    return this.findByIdForUser(id, userId);
  }
}
