/**
 * DTO de réponse pour les endpoints du Programme Télé.
 *
 * Étend l'entité GameOrm avec un champ calculé non stocké en base :
 * - scenarioName : libellé du scénario résolu depuis ScenarioCatalogService à
 *   partir de scenarioId (FK logique). Même principe que les champs dérivés
 *   ailleurs dans le projet (participantCount, prix...) — jamais persisté.
 */
import { GameOrm } from '../infrastructure/entities/game.entity';

export type GameResponseDto = GameOrm & {
  scenarioName: string;
};
