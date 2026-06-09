/**
 * DTO pour `POST /api/vehicles/:id/improvements` — ajout d'une amélioration.
 *
 * `nomInterne` identifie l'amélioration du catalogue par sa clé stable
 * (cf. `vehicle.entity.ts` pour la convention `nom_interne`).
 *
 * `orientation` est optionnelle dans le DTO — elle n'a de sens que pour certaines
 * améliorations (Bélier, Bélier Explosif…). L'exigence est validée par `validateSelf`
 * du décorateur concerné, pas ici : c'est une règle de fond, propre à chaque comportement.
 */
import type { Orientation } from '../vehicle-build';

export class AddImprovementDto {
  nomInterne: string;
  orientation?: Orientation;
}
