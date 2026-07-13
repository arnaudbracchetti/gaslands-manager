import type { Orientation } from '../domain/team';

export interface VehicleImprovementDto {
  id: number;
  nomInterne: string;
  orientation: Orientation | null;
  vehicleId: number;
  createdAt: Date;
  estDefaut: boolean;
  prix: number;
  emplacement: number;
}
