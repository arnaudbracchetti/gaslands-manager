import type { VehicleStats, VehicleStatsSummary } from '../vehicle-build';

export interface VehicleDetailDto {
  id: number;
  nomInterne: string;
  stats: VehicleStats;
  baseStats: VehicleStats;
  recapitulatif: VehicleStatsSummary[];
}
