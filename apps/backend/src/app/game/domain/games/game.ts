import { DomainException } from '../../../shared/domain/domain-exception';
import type { GameEvent } from '../events/game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameStatus } from '../enums/game-status.enum';

/**
 * Partie de campagne — GoF Invoker.
 *
 * Classe abstraite commune à EvenementTeleGame, EscarmoucheGame et AtelierGame.
 * Maintient son propre journal d'événements et délègue l'exécution à chaque commande.
 *
 * `canAccept(event)` est la règle métier du type de partie : seuls certains types
 * d'événements peuvent être ajoutés à chaque sous-type (ex. EquipmentChangedEvent
 * uniquement dans un AtelierGame).
 */
export abstract class Game {
  protected readonly _events: GameEvent[];

  constructor(
    readonly id: number,
    readonly campaignId: number,
    readonly status: GameStatus,
    readonly order: number,         // decimal — atelier intercalé à n + 0.5
    readonly playedAt: Date | null,
    events: GameEvent[],
  ) {
    this._events = [...events].sort((a, b) => a.eventOrder - b.eventOrder);
  }

  get events(): readonly GameEvent[] { return this._events; }

  /** Sous-type de partie. Utilisé par le mapper ORM pour l'hydratation STI. */
  abstract get type(): string;

  /**
   * Peut-on ajouter cet événement à cette partie ?
   * Implémenté par chaque sous-type. `addEvent` appelle cette méthode avant d'ajouter.
   */
  abstract canAccept(event: GameEvent): boolean;

  /**
   * Valide et ajoute un événement au journal.
   * Le use case doit ensuite appeler `event.execute(participants)` lui-même.
   */
  addEvent(event: GameEvent): void {
    if (!this.canAccept(event)) {
      throw new DomainException(
        `Cet événement n'est pas autorisé pour une partie de type ${this.type}`,
      );
    }
    this._events.push(event);
  }

  /**
   * Rejoue tous les événements dans l'ordre (ordre croissant d'eventOrder).
   */
  apply(participants: CampaignParticipant[]): void {
    for (const event of this._events) {
      event.execute(participants);
    }
  }

  /**
   * Annule tous les événements dans l'ordre inverse.
   * Utilisé par Campaign.replayUpTo pour reconstruire un état partiel.
   */
  revert(participants: CampaignParticipant[]): void {
    for (const event of [...this._events].reverse()) {
      event.undo(participants);
    }
  }
}
