/**
 * DTO du corps de PUT /api/seasons/:id/participants/:pid/validate.
 *
 * `accept: true` → status passe à VALIDATED, `accept: false` → REJECTED
 * (cf. SeasonParticipantService.validate). Pas de class-validator dans ce
 * projet (cf. register.dto.ts) — validation manuelle si nécessaire.
 */
export class ValidateParticipantDto {
  accept: boolean;
}
