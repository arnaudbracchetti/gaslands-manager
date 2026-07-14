import type { WeaponOrientation } from '../domain/team';

export interface WeaponDto {
  id: number;
  nomInterne: string;
  /** 5 valeurs possibles, dont `'tourelle'` (montage sur Tourelle — arc à 360°, coût
   *  ×3, immuable après achat). */
  orientation: WeaponOrientation | null;
  vehicleId: number;
  createdAt: Date;
  prix: number;
  /**
   * Emplacements consommés (résiduel) — `0` pour une arme intégrée (`estDefaut`),
   * perdue (`isLost`) ou vendue (`isSold`), valeur catalogue sinon. Résolu côté
   * backend (`Weapon.slots`), mirroir de `VehicleImprovementDto.emplacement` :
   * l'IHM le lit tel quel sans reconsulter le catalogue.
   */
  emplacement: number;
  /** Intégrée au profil de base du véhicule (ex. Canon de 125mm du Char d'assaut). */
  estDefaut: boolean;
}
