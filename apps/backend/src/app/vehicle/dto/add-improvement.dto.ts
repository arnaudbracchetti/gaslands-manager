/**
 * DTO pour `POST /api/vehicles/:id/improvements` — ajout d'une amélioration.
 *
 * `nomInterne` identifie l'amélioration du CATALOGUE — jamais son `nom` affiché
 * (cf. la convention documentée dans `vehicle.entity.ts` : `nom_interne` est la
 * clé STABLE, seule capable de distinguer "Bélier" de "Bélier (Slime)").
 *
 * `orientation` est optionnelle dans le DTO — elle n'a de sens (et n'est exigée
 * par la règle métier) que pour certaines améliorations (Bélier, Bélier Explosif…) ;
 * le service délègue cette exigence à `validateSelf`, pas au DTO : ce n'est pas une
 * contrainte de FORME (toujours présente ou absente), mais une règle de FOND, propre
 * à chaque comportement — exactement ce que le Pattern Decorator est censé porter.
 */
import type { Orientation } from '../vehicle-build';

export class AddImprovementDto {
  nomInterne: string;
  orientation?: Orientation;
}
