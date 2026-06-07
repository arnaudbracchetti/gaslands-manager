/**
 * DTO pour `POST /api/vehicles/:id/weapons` — ajout d'une arme à un véhicule.
 *
 * Mirroir de `AddImprovementDto` (cf. `vehicle/dto/add-improvement.dto.ts`,
 * dont la note d'en-tête détaille le raisonnement `nomInterne`/`orientation` —
 * on ne le répète pas ici, seule la nuance propre aux armes mérite un mot).
 *
 * `orientation` reste optionnelle dans le DTO pour la MÊME raison que pour les
 * améliorations : ce n'est pas une contrainte de FORME mais une règle de FOND,
 * et elle se lit dans des sens OPPOSÉS selon le type d'arme — `WeaponService.
 * canAddWeapon` la tranche au vu du `type` catalogue (cf. `weapon.entity.ts`,
 * note d'en-tête : obligatoire hors `équipage`, interdite pour `équipage`).
 * Le DTO se contente de transporter l'information ; il ne préjuge de rien.
 */
import type { Orientation } from '../vehicle/vehicle-build';

export class AddWeaponDto {
  nomInterne: string;
  orientation?: Orientation;
}
