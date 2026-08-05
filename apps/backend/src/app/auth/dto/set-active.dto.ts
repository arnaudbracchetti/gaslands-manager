import { IsBoolean } from 'class-validator';

/**
 * DTO pour PATCH /api/users/:id/active — active ou désactive un compte.
 */
export class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
