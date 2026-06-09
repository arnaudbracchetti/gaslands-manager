/**
 * DTO de requête pour l'assignation d'une arme à une Tourelle.
 *
 * L'arme sur Tourelle est stockée comme une référence catalogue (`nom_interne` string)
 * sur `VehicleImprovement`, pas comme une entité `Weapon` séparée — cf. l'entité et
 * la note architecturale dans `vehicle.entity.ts` (VehicleImprovement.weaponNomInterne).
 *
 * Utilisé par `PATCH /api/vehicles/:vehicleId/improvements/:improvId/weapon`.
 *
 * Note : ce projet n'utilise pas class-validator (cf. `register.dto.ts`) — la validation
 * de `weaponNomInterne` (existence dans le catalogue, autorisation sponsor, type non-équipage)
 * est entièrement gérée par `VehicleService.assignWeaponToTourelle()`.
 */
export class AssignWeaponToTourelleDto {
  /** Nom interne de l'arme à monter sur la Tourelle (référence catalogue stable). */
  weaponNomInterne: string;
}
