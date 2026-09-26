import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Un participant a contacté la Résistance — +3 Points de Résistance (secret).
 * Les PR ne sont jamais exposés au classement public (cf. standings()).
 */
export class ResistanceContactedEvent extends GameEvent {
  private static readonly PR_BONUS = 3;

  readonly eventType = GameEventType.RESISTANCE_CONTACTED;

  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    /**
     * Clé de la stratégie de distribution automatique qui a créé cet événement
     * (ex. `"defaut"`, cf. `DefaultResistanceStrategy`) — `null` pour un contact
     * manuel (route dédiée organisateur, jamais touchée par les règles maison).
     * Distingue automatique/manuel au journal et sert de marqueur d'idempotence à
     * `Game.distributeResistance`.
     */
    readonly strategyKey: string | null = null,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    this.findParticipant(participants).addResistance(ResistanceContactedEvent.PR_BONUS);
  }

  undo(participants: CampaignParticipant[]): void {
    this.findParticipant(participants).addResistance(-ResistanceContactedEvent.PR_BONUS);
  }

  describe(): string {
    const base = `Contact avec la Résistance (+${ResistanceContactedEvent.PR_BONUS} PR)`;
    if (this.strategyKey === null) return base;
    return `${base} — ${STRATEGY_KEY_LABELS[this.strategyKey] ?? this.strategyKey}`;
  }
}

/**
 * Libellé affiché au journal pour chaque clé de stratégie de distribution
 * automatique (`ResistanceDistributionStrategy.key`) — permet à un joueur qui
 * compare deux parties de voir quelle règle s'est appliquée à chacune, la
 * règle étant modifiable en cours de campagne (cf. RM-5). Même idiome que
 * `WALLET_REASON_LABELS` (`wallet-movement.event.ts`) : mapping local clé →
 * texte français, plutôt qu'une dépendance au catalogue de règles maison
 * (le domaine ne le connaît jamais, cf. RM-1). Une clé absente de cette map
 * (nouvelle règle maison pas encore reflétée ici) retombe sur la clé brute.
 */
const STRATEGY_KEY_LABELS: Record<string, string> = {
  defaut: 'règle par défaut',
  distribution_points_resistance: 'règle maison : aucun point de championnat',
};
