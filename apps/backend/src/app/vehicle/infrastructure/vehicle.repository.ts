import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Vehicle as VehicleOrm, VehicleImprovement as VehicleImprovementOrm } from '../vehicle.entity';
import { Weapon as WeaponOrm } from '../../weapon/weapon.entity';
import { TeamService } from '../../team/team.service';
import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { Vehicle } from '../domain/vehicle';
import { VehicleMapper } from './vehicle.mapper';

/**
 * Implémentation TypeORM de IVehicleRepository.
 *
 * Responsabilités :
 *  - Charger les entités ORM avec leurs relations
 *  - Déléguer la traduction ORM ↔ domaine au VehicleMapper
 *  - Calculer le budget restant (nécessite tous les véhicules de l'équipe)
 *  - Vérifier l'appartenance via TeamService (Vehicle → Team → User)
 */
@Injectable()
export class VehicleRepository implements IVehicleRepository {
  constructor(
    @InjectRepository(VehicleOrm)
    private readonly vehicleRepo: Repository<VehicleOrm>,
    @InjectRepository(VehicleImprovementOrm)
    private readonly improvementRepo: Repository<VehicleImprovementOrm>,
    @InjectRepository(WeaponOrm)
    private readonly weaponRepo: Repository<WeaponOrm>,
    private readonly teamService: TeamService,
    private readonly mapper: VehicleMapper,
  ) {}

  async findByIdForUser(id: number, userId: number): Promise<Vehicle> {
    const orm = await this.vehicleRepo.findOne({
      where: { id, team: { userId } },
      relations: { team: true, improvements: true, weapons: true },
    });
    if (!orm) throw new NotFoundException(`Véhicule #${id} introuvable`);
    return this.mapper.toDomain(orm as VehicleOrm & { team: { sponsor: string; cans: number } });
  }

  async findByWeaponId(weaponId: number, userId: number): Promise<Vehicle> {
    // ⚠️ Un `where` sur une relation de collection (`weapons`) ne sert pas qu'à
    // filtrer le véhicule : TypeORM réutilise la même jointure pour hydrater la
    // relation, si bien que `orm.weapons` ne contiendrait QUE l'arme recherchée,
    // pas toutes les armes du véhicule. On résout donc d'abord l'id du véhicule,
    // puis on recharge l'agrégat complet via findByIdForUser (filtre par `id`,
    // qui n'altère pas l'hydratation des collections).
    const found = await this.vehicleRepo.findOne({
      where: { weapons: { id: weaponId }, team: { userId } },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`Arme #${weaponId} introuvable`);
    return this.findByIdForUser(found.id, userId);
  }

  async findAllForTeam(teamId: number, userId: number): Promise<Vehicle[]> {
    await this.teamService.findOneForUser(teamId, userId);
    const orms = await this.vehicleRepo.find({
      where: { teamId },
      relations: { team: true, improvements: true, weapons: true },
    });
    return orms.map((orm) =>
      this.mapper.toDomain(orm as VehicleOrm & { team: { sponsor: string; cans: number } }),
    );
  }

  async getRemainingBudget(vehicleId: number, userId: number): Promise<number> {
    const vehicle = await this.findByIdForUser(vehicleId, userId);
    const allVehicles = await this.findAllForTeam(vehicle.teamId, userId);

    const teamBudget = await this.getTeamBudget(vehicle.teamId, userId);
    const totalCost = allVehicles.reduce((sum, v) => sum + v.cost, 0);
    return teamBudget - totalCost;
  }

  async save(vehicle: Vehicle): Promise<Vehicle> {
    if (vehicle.id) {
      const keepWeaponIds = vehicle.weapons.filter((w) => w.id).map((w) => w.id);
      const keepImprovementIds = vehicle.improvements.filter((i) => i.id).map((i) => i.id);

      await this.weaponRepo.delete({ vehicleId: vehicle.id, ...(keepWeaponIds.length ? { id: Not(In(keepWeaponIds)) } : {}) });
      await this.improvementRepo.delete({ vehicleId: vehicle.id, ...(keepImprovementIds.length ? { id: Not(In(keepImprovementIds)) } : {}) });
    }

    const ormData = this.mapper.toOrm(vehicle);
    const saved = await this.vehicleRepo.save(ormData as VehicleOrm);
    return this.reloadById(saved.id);
  }

  private async reloadById(id: number): Promise<Vehicle> {
    const orm = await this.vehicleRepo.findOne({
      where: { id },
      relations: { team: true, improvements: true, weapons: true },
    });
    if (!orm) throw new NotFoundException(`Véhicule #${id} introuvable après sauvegarde`);
    return this.mapper.toDomain(orm as VehicleOrm & { team: { sponsor: string; cans: number } });
  }

  async remove(id: number, userId: number): Promise<void> {
    const orm = await this.vehicleRepo.findOne({
      where: { id, team: { userId } },
    });
    if (!orm) throw new NotFoundException(`Véhicule #${id} introuvable`);
    await this.vehicleRepo.remove(orm);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────────

  private async getTeamBudget(teamId: number, userId: number): Promise<number> {
    const team = await this.teamService.findOneForUser(teamId, userId);
    return team.cans;
  }
}
