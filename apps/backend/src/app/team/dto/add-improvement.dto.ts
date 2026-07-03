import type { Orientation } from '../domain/vehicle-build';

export class AddImprovementDto {
  nomInterne: string;
  orientation?: Orientation;
}
