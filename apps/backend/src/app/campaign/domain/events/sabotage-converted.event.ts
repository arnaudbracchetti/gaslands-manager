import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Règle maison « conversion de sabotage » : un participant échange `tokensConverted`
 * jetons de sabotage contre `jerricansGained` jerricans, pendant l'Atelier.
 *
 * `jerricansGained` est FIGÉ à l'écriture (taux de la Strategy × jetons) et jamais
 * recalculé : si le taux change un jour dans le code, le replay des conversions déjà
 * journalisées reste exact (même principe que `championshipPoints` des événements de PC).
 *
 * Le solde de jetons est vérifié AVANT la construction (`Game.convertSabotage`), jamais
 * ici : `execute()` ne relit pas l'état courant du participant.
 */
export class SabotageConvertedEvent extends GameEvent {
  /** 1 jeton de sabotage = 3 Points de Résistance (cf. `CampaignParticipant.sabotagePoints`). */
  private static readonly RESISTANCE_PER_SABOTAGE_POINT = 3;

  readonly eventType = GameEventType.SABOTAGE_CONVERTED;

  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly tokensConverted: number,
    readonly jerricansGained: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    const participant = this.findParticipant(participants);
    participant.addResistance(-this.tokensConverted * SabotageConvertedEvent.RESISTANCE_PER_SABOTAGE_POINT);
    participant.creditWallet(this.jerricansGained);
  }

  undo(participants: CampaignParticipant[]): void {
    const participant = this.findParticipant(participants);
    participant.addResistance(this.tokensConverted * SabotageConvertedEvent.RESISTANCE_PER_SABOTAGE_POINT);
    participant.creditWallet(-this.jerricansGained);
  }

  describe(): string {
    return `Sabotage : ${this.tokensConverted} jeton(s) converti(s) en ${this.jerricansGained} jerricans`;
  }
}
