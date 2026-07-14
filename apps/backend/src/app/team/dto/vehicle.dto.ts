import type { VehicleImprovementDto } from './vehicle-improvement.dto';
import type { WeaponDto } from './weapon.dto';
import type { VehicleAdvantageDto } from './vehicle-advantage.dto';

export interface VehicleDto {
  id: number;
  nomInterne: string;
  teamId: number;
  createdAt: Date;
  improvements: VehicleImprovementDto[];
  weapons: WeaponDto[];
  advantages: VehicleAdvantageDto[];
  /**
   * Capacité totale EFFECTIVE en emplacements — base catalogue + bonus des améliorations
   * montées qui l'augmentent (Remorque Moyenne +1, Remorque Lourde +3, cf.
   * `Vehicle.effectiveStats`). Jamais égale à la seule fiche catalogue statique dès
   * qu'une telle amélioration est montée.
   */
  emplacementsTotal: number;
}
