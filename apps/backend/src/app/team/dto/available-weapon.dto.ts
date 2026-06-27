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
}
