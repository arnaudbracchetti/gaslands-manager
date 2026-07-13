import type { Orientation } from '../domain/team';

export class AddImprovementDto {
  nomInterne: string;
  orientation?: Orientation;
}
