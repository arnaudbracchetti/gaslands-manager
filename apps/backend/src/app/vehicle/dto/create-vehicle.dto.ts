/**
 * DTO pour `POST /api/teams/:teamId/vehicles` — ajout d'un véhicule à une équipe.
 *
 * `nomInterne` identifie le véhicule du CATALOGUE — jamais son `nom` affiché
 * (même convention que `AddImprovementDto.nomInterne`, cf. `vehicle.entity.ts`
 * pour le raisonnement complet sur `nom_interne`).
 *
 * Volontairement minimal : à la création, un véhicule n'a encore ni armes ni
 * améliorations — ces ajouts se font ensuite, un par un, via les routes dédiées
 * (`POST /api/vehicles/:id/weapons`, `POST /api/vehicles/:id/improvements`),
 * chacune validée puis persistée individuellement.
 */
export class CreateVehicleDto {
  nomInterne: string;
}
