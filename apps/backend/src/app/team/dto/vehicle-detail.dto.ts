import type { VehicleStats, VehicleStatsSummary } from '../domain/behaviors/equipment-behavior';

export interface VehicleDetailDto {
  id: number;
  nomInterne: string;
  stats: VehicleStats;
  baseStats: VehicleStats;
  recapitulatif: VehicleStatsSummary[];
}
