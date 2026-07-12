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
}
