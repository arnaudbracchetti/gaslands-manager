import type { Arme } from '../../catalog/catalog.interfaces';

export interface AvailableWeaponDto {
  nom: string;
  nomInterne: string;
  prix: number;
  emplacement: number;
  type: Arme['type'];
  description: string;
  regles: string;
  disponible: boolean;
  raison?: string;
  /** Cette arme peut-elle être montée sur Tourelle (arc à 360°, coût ×3) ? */
  montableSurTourelle: boolean;
}
