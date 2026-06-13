/**
 * DTO pour PATCH /api/users/:id/active — active ou désactive un compte.
 */
export class SetActiveDto {
  isActive: boolean;
}
