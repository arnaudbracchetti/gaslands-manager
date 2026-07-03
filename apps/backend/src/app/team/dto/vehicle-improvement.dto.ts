import type { Orientation } from '../domain/vehicle-build';

export interface VehicleImprovementDto {
  id: number;
  nomInterne: string;
  orientation: Orientation | null;
  vehicleId: number;
  createdAt: Date;
  estDefaut: boolean;
  prix: number;
  emplacement: number;
  weaponNomInterne: string | null;
}
