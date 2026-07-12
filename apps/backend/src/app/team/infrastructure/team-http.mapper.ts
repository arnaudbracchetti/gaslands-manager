import type { Team } from '../domain/team';
import type { Vehicle } from '../domain/vehicle';
import type { Weapon } from '../domain/weapon';
import type { Improvement } from '../domain/improvement';
import type { Advantage } from '../domain/advantage';
import type { VehicleDto } from '../dto/vehicle.dto';
import type { VehicleImprovementDto } from '../dto/vehicle-improvement.dto';
import type { WeaponDto } from '../dto/weapon.dto';
import type { VehicleAdvantageDto } from '../dto/vehicle-advantage.dto';

/**
 * Traduit un agrégat Team (ou un Vehicle extrait de l'agrégat) en DTOs HTTP sérialisables.
 *
 * Les agrégats domaine exposent leurs prix via des getters TypeScript — ceux-ci ne sont
 * pas sérialisés par JSON.stringify. Ce mapper lit les valeurs et produit des objets
 * plain compatibles avec la réponse HTTP.
 *
 * createdAt n'existe pas sur les objets domaine (pas une règle métier) : on retourne
 * new Date(0) comme sentinelle. Le frontend n'affiche pas createdAt pour les véhicules.
 */
export function vehicleToDto(team: Team, vehicleId: number): VehicleDto {
  const vehicle = team.findVehicle(vehicleId);
  return vehicleDomainToDto(vehicle);
}

export function vehicleDomainToDto(vehicle: Vehicle): VehicleDto {
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
      estDefaut: w.estDefaut,
    }),
  );

  const advantages: VehicleAdvantageDto[] = vehicle.advantages.map(
    (a: Advantage): VehicleAdvantageDto => ({
      id: a.id,
      nomInterne: a.type.nomInterne,
      vehicleId: vehicle.id,
      createdAt: new Date(0),
      prix: a.price,
    }),
  );

  return {
    id: vehicle.id,
    nomInterne: vehicle.type.nomInterne,
    teamId: vehicle.teamId,
    createdAt: new Date(0),
    improvements,
    weapons,
    advantages,
  };
}
