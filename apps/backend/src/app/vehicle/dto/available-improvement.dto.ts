/**
 * DTO de réponse pour `GET /api/vehicles/:id/available-improvements`.
 *
 * Une ligne par amélioration du catalogue accessible au SPONSOR de l'équipe — pas
 * seulement celles qu'on PEUT acheter maintenant : `disponible`/`raison` permettent
 * au frontend d'afficher aussi les options actuellement bloquées, accompagnées d'une
 * explication. C'est très exactement le rôle pour lequel `RuleResult.reason` a été
 * conçu (cf. `vehicle-build.ts`) : informer une `BadRequestException` ET une UI, sans
 * dupliquer le texte ni la logique entre les deux.
 */
export interface AvailableImprovementDto {
  nom: string;
  /** Référence catalogue stable (cf. `Vehicle.nomInterne` pour la convention `nomInterne`). */
  nomInterne: string;
  /** Coût en Jerricans — `string` ("x3") pour la Tourelle, dont le calcul de coût
   *  est un sujet à part (cf. `catalog.interfaces.ts`, doc de `Amelioration.prix`,
   *  et plan d'architecture §4 : reporté à la gestion du budget). */
  prix: number | string;
  emplacement: number;
  /** Description de l'amélioration, reprise telle quelle du catalogue (`Amelioration.description`). */
  description: string;
  /** `true` si cette amélioration peut être ajoutée au véhicule TEL QU'IL EST actuellement. */
  disponible: boolean;
  /** Présente uniquement si `disponible` est `false` — la raison du refus, lisible par un humain. */
  raison?: string;
}
