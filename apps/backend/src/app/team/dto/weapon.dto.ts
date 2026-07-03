import type { Orientation } from '../domain/vehicle-build';

export interface WeaponDto {
  id: number;
  nomInterne: string;
  orientation: Orientation | null;
  vehicleId: number;
  createdAt: Date;
  prix: number;
}
