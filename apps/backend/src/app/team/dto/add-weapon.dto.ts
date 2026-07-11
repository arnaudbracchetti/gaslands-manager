import type { WeaponOrientation } from '../domain/team';

export class AddWeaponDto {
  nomInterne: string;
  /** 5 valeurs possibles, dont `'tourelle'` (montage sur Tourelle — arc à 360°, coût ×3). */
  orientation?: WeaponOrientation;
}
