import { TeamOrm } from './entities/team.entity';
import { VehicleOrm, VehicleImprovementOrm, VehicleAdvantageOrm } from './entities/vehicle.entity';
import { WeaponOrm } from './entities/weapon.entity';
import { Team } from '../domain/team';
import { Vehicle } from '../domain/vehicle';
import { Weapon } from '../domain/weapon';
import { Improvement } from '../domain/improvement';
import { Advantage } from '../domain/advantage';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';

/**
 * Traduit les entités ORM TypeORM en agrégat Team (et inversement).
 *
 * C'est le seul endroit qui connaît à la fois la structure ORM et la structure domaine.
 * Le catalog repository est nécessaire pour résoudre les Value Objects (VehicleType,
 * WeaponType, ImprovementType) depuis les nom_interne persistés.
 */
export class TeamMapper {
  constructor(private readonly catalogRepo: ICatalogRepository) {}

  // ── ORM → Domaine ──────────────────────────────────────────────────────────────

  toDomain(orm: TeamOrm, isLocked = false, campaignBudget: number | null = null): Team {
    const vehicles = (orm.vehicles ?? []).map((v) => this.vehicleToDomain(v));
    return new Team(
      orm.id,
      orm.userId,
      orm.name,
      orm.sponsor,
      orm.cans,
      orm.description ?? null,
      vehicles,
      isLocked,
      campaignBudget,
    );
  }

  private vehicleToDomain(orm: VehicleOrm): Vehicle {
    const vehicleType = this.catalogRepo.getVehicleType(orm.nomInterne);
    if (!vehicleType) {
      throw new Error(`Véhicule catalogue inconnu : "${orm.nomInterne}" (véhicule #${orm.id})`);
    }

    const weapons = (orm.weapons ?? []).map((w) => this.weaponToDomain(w));
    const improvements = (orm.improvements ?? []).map((i) => this.improvementToDomain(i));
    const advantages = (orm.advantages ?? []).map((a) => this.advantageToDomain(a));

    return new Vehicle(orm.id, orm.teamId, vehicleType, weapons, improvements, advantages, orm.nom ?? null);
  }

  private weaponToDomain(orm: WeaponOrm): Weapon {
    const weaponType = this.catalogRepo.getWeaponType(orm.nomInterne);
    if (!weaponType) {
      throw new Error(`Arme catalogue inconnue : "${orm.nomInterne}" (weapon #${orm.id})`);
    }
    return new Weapon(orm.id, weaponType, orm.orientation, orm.estDefaut);
  }

  private improvementToDomain(orm: VehicleImprovementOrm): Improvement {
    const improvementType = this.catalogRepo.getImprovementType(orm.nomInterne);
    if (!improvementType) {
      throw new Error(`Amélioration catalogue inconnue : "${orm.nomInterne}" (improvement #${orm.id})`);
    }
    return new Improvement(orm.id, improvementType, orm.orientation, orm.estDefaut);
  }

  private advantageToDomain(orm: VehicleAdvantageOrm): Advantage {
    const advantageType = this.catalogRepo.getAdvantageType(orm.nomInterne);
    if (!advantageType) {
      throw new Error(`Avantage catalogue inconnu : "${orm.nomInterne}" (advantage #${orm.id})`);
    }
    return new Advantage(orm.id, advantageType);
  }

  // ── Domaine → ORM (pour la persistance) ──────────────────────────────────────

  toOrm(domain: Team): Partial<TeamOrm> & { vehicles: Partial<VehicleOrm>[] } {
    return {
      id: domain.id || undefined,
      name: domain.name,
      sponsor: domain.sponsor,
      cans: domain.cans,
      description: domain.description ?? undefined,
      userId: domain.userId,
      vehicles: domain.vehicles.map((v) => this.vehicleToOrm(v)),
    };
  }

  private vehicleToOrm(domain: Vehicle): Partial<VehicleOrm> & {
    weapons: Partial<WeaponOrm>[];
    improvements: Partial<VehicleImprovementOrm>[];
    advantages: Partial<VehicleAdvantageOrm>[];
  } {
    return {
      id: domain.id || undefined,
      nomInterne: domain.type.nomInterne,
      // Valeur BRUTE (`customName`), jamais le getter `nom` résolu/formaté — sinon perte
      // de la distinction "jamais renommé" (null) vs "renommé vers le nom du type".
      nom: domain.customName,
      teamId: domain.teamId || undefined,
      weapons: domain.weapons.map((w) => this.weaponToOrm(w, domain.id)),
      improvements: domain.improvements.map((i) => this.improvementToOrm(i, domain.id)),
      advantages: domain.advantages.map((a) => this.advantageToOrm(a, domain.id)),
    };
  }

  private weaponToOrm(domain: Weapon, vehicleId: number): Partial<WeaponOrm> {
    return {
      id: domain.id || undefined,
      nomInterne: domain.type.nomInterne,
      orientation: domain.orientation,
      estDefaut: domain.estDefaut,
      vehicleId: vehicleId || undefined,
    };
  }

  private improvementToOrm(domain: Improvement, vehicleId: number): Partial<VehicleImprovementOrm> {
    return {
      id: domain.id || undefined,
      nomInterne: domain.type.nomInterne,
      orientation: domain.orientation,
      estDefaut: domain.estDefaut,
      vehicleId: vehicleId || undefined,
    };
  }

  private advantageToOrm(domain: Advantage, vehicleId: number): Partial<VehicleAdvantageOrm> {
    return {
      id: domain.id || undefined,
      nomInterne: domain.type.nomInterne,
      vehicleId: vehicleId || undefined,
    };
  }
}
