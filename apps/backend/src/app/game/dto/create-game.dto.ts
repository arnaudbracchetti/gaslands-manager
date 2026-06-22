import type { GameType } from '../game.enums';

/**
 * DTO pour l'ajout d'une partie au Programme Télé.
 *
 * - `scenarioId` : nom_interne d'un scénario du catalogue (ScenarioCatalogService).
 *   Validé côté service (BadRequestException si inconnu).
 * - `type` : optionnel — par défaut, le service reprend le type du scénario.
 *   Permet de forcer Escarmouche/Événement Télévisé si le MJ le souhaite.
 *
 * Pas de class-validator : ce projet valide dans le service (cf. RegisterDto).
 */
export class CreateGameDto {
  scenarioId: string;
  type?: GameType;
}
