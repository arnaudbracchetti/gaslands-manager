import type { VehicleStats, VehicleStatsSummary } from '../domain/behaviors/equipment-behavior';

export interface VehicleDetailDto {
  id: number;
  nomInterne: string;
  nom: string;
  customName: string | null;
  stats: VehicleStats;
  baseStats: VehicleStats;
  recapitulatif: VehicleStatsSummary[];
}
