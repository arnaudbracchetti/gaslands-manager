import { Vehicle as VehicleOrm, VehicleImprovement as VehicleImprovementOrm } from '../vehicle.entity';
import { Weapon as WeaponOrm } from '../../weapon/weapon.entity';
import { Vehicle } from '../domain/vehicle';
import { Weapon } from '../domain/weapon';
import { Improvement } from '../domain/improvement';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';

/**
 * Traduit les entités ORM TypeORM en objets du domaine, et inversement.
 *
 * C'est le seul endroit qui connaît à la fois la structure ORM et la structure
 * domaine. Il remplace hydrateVehicle() et la partie "lecture" de toVehicleDto()
 * du VehicleService actuel.
 *
 * Le catalog repository est nécessaire pour résoudre les Value Objects
 * (WeaponType, ImprovementType, VehicleType) depuis les nom_interne persistés.
 */
export class VehicleMapper {
  constructor(private readonly catalogRepo: ICatalogRepository) {}

  /**
   * ORM → Domaine.
   * Reconstitue un agrégat Vehicle complet depuis les entités TypeORM chargées.
   * Remplace hydrateVehicle() + la construction manuelle dans VehicleService.
   */
  toDomain(orm: VehicleOrm & { team: { sponsor: string; cans: number } }): Vehicle {
    const vehicleType = this.catalogRepo.getVehicleType(orm.nomInterne);
    if (!vehicleType) {
      throw new Error(`Véhicule catalogue inconnu : "${orm.nomInterne}" (véhicule #${orm.id})`);
    }

    const weapons = (orm.weapons ?? []).map((w: WeaponOrm) => this.weaponToDomain(w));
    const improvements = (orm.improvements ?? []).map((i: VehicleImprovementOrm) =>
      this.improvementToDomain(i),
    );

    return new Vehicle(orm.id, orm.teamId, orm.team.sponsor, vehicleType, weapons, improvements);
  }

  private weaponToDomain(orm: WeaponOrm): Weapon {
    const weaponType = this.catalogRepo.getWeaponType(orm.nomInterne);
    if (!weaponType) {
      throw new Error(`Arme catalogue inconnue : "${orm.nomInterne}" (weapon #${orm.id})`);
    }
    return new Weapon(orm.id, weaponType, orm.orientation);
  }

  private improvementToDomain(orm: VehicleImprovementOrm): Improvement {
    const improvementType = this.catalogRepo.getImprovementType(orm.nomInterne);
    if (!improvementType) {
      throw new Error(
        `Amélioration catalogue inconnue : "${orm.nomInterne}" (improvement #${orm.id})`,
      );
    }
    const imp = new Improvement(orm.id, improvementType, orm.orientation, orm.estDefaut);

    // Résolution de l'arme assignée à une Tourelle
    if (improvementType.isTourelle && orm.weaponNomInterne) {
      const weaponType = this.catalogRepo.getWeaponType(orm.weaponNomInterne);
      if (weaponType) imp.assignWeapon(weaponType);
    }

    return imp;
  }

  /**
   * Domaine → ORM (pour la persistance).
   * Produit les entités ORM à sauvegarder depuis l'état courant de l'agrégat.
   */
  toOrm(domain: Vehicle): Omit<Partial<VehicleOrm>, 'weapons' | 'improvements'> & {
  weapons: Partial<WeaponOrm>[];
  improvements: Partial<VehicleImprovementOrm>[];}
  {
    return {
      id: domain.id || undefined,
      nomInterne: domain.type.nomInterne,
      teamId: domain.teamId,
      weapons: domain.weapons.map((w) => this.weaponToOrm(w, domain.id)),
      improvements: domain.improvements.map((i) => this.improvementToOrm(i, domain.id)),
    };
  }

  private weaponToOrm(domain: Weapon, vehicleId: number): Partial<WeaponOrm> {
    return {
      id: domain.id || undefined,
      nomInterne: domain.type.nomInterne,
      orientation: domain.orientation,
      vehicleId,
    };
  }

  private improvementToOrm(domain: Improvement, vehicleId: number): Partial<VehicleImprovementOrm> {
    return {
      id: domain.id || undefined,
      nomInterne: domain.type.nomInterne,
      orientation: domain.orientation,
      estDefaut: domain.estDefaut,
      weaponNomInterne: domain.weaponAssignee?.nomInterne ?? null,
      vehicleId,
    };
  }
}
