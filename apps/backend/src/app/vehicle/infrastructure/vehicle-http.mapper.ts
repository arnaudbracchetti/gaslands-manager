import type { Vehicle } from '../domain/vehicle';
import type { Weapon } from '../domain/weapon';
import type { Improvement } from '../domain/improvement';
import type { VehicleDto } from '../dto/vehicle.dto';
import type { VehicleImprovementDto } from '../dto/vehicle-improvement.dto';
import type { WeaponDto } from '../../weapon/dto/weapon.dto';

/**
 * Traduit un agrégat Vehicle (domaine) en VehicleDto (HTTP).
 *
 * Remplace VehicleService.toVehicleDto(). L'agrégat expose déjà les prix
 * via ses getters domaine (weapon.price, improvement.price) — ce mapper
 * n'a plus qu'à les lire et produire l'objet plain sérialisable.
 *
 * createdAt n'existe pas sur les objets domaine (pas une règle métier) ;
 * on retourne `new Date(0)` comme sentinelle — les contrôleurs qui ont
 * vraiment besoin de la date doivent la lire depuis l'ORM directement.
 * Dans la pratique, le frontend n'affiche pas createdAt sur les véhicules.
 */
export function vehicleToDto(vehicle: Vehicle): VehicleDto {
  const improvements: VehicleImprovementDto[] = vehicle.improvements.map(
    (imp: Improvement): VehicleImprovementDto => ({
      id: imp.id,
      nomInterne: imp.type.nomInterne,
      orientation: imp.orientation,
      vehicleId: vehicle.id,
      createdAt: new Date(0),
      estDefaut: imp.estDefaut,
      prix: imp.price,
      emplacement: imp.slots,
      weaponNomInterne: imp.weaponAssignee?.nomInterne ?? null,
    }),
  );

  const weapons: WeaponDto[] = vehicle.weapons.map(
    (w: Weapon): WeaponDto => ({
      id: w.id,
      nomInterne: w.type.nomInterne,
      orientation: w.orientation,
      vehicleId: vehicle.id,
      createdAt: new Date(0),
      prix: w.price,
    }),
  );

  return {
    id: vehicle.id,
    nomInterne: vehicle.type.nomInterne,
    teamId: vehicle.teamId,
    createdAt: new Date(0),
    improvements,
    weapons,
  };
}
