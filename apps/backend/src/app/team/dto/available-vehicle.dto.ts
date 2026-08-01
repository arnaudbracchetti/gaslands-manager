/**
 * Ligne de `GET /api/teams/:teamId/vehicles/available` (construction d'équipe) et
 * `GET /api/campaigns/:id/workshop/available-vehicles` (atelier) — verdict de
 * disponibilité budgétaire pour l'achat d'un véhicule.
 *
 * Volontairement léger (pas de nom/prix/stats dupliqués comme `AvailableWeaponDto`) :
 * le frontend a déjà le catalogue véhicule complet du sponsor via
 * `GET /api/catalog/sponsors/:nom` — ce DTO n'ajoute qu'un verdict à croiser par
 * `nomInterne`, pas une seconde source de vérité.
 */
export interface AvailableVehicleDto {
  nomInterne: string;
  disponible: boolean;
  raison?: string;
}
