/**
 * DTO de réponse pour les endpoints du Programme Télé.
 *
 * Étend l'entité GameOrm avec des champs calculés non stockés en base :
 * - scenarioName : libellé du scénario résolu depuis ScenarioCatalogService à
 *   partir de scenarioId (FK logique). Même principe que les champs dérivés
 *   ailleurs dans le projet (participantCount, prix...) — jamais persisté.
 * - franchissementPortes/gainJerricans : flags du scénario résolu, mirroir
 *   exact de scenarioName — le wizard de fin de partie (frontend) les lit
 *   sans requête catalogue supplémentaire.
 */
import { GameOrm } from '../infrastructure/entities/game.entity';

export type GameResponseDto = GameOrm & {
  scenarioName: string;
  franchissementPortes: boolean;
  gainJerricans: boolean;
};
