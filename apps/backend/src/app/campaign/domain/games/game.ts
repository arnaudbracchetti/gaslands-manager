import { DomainException } from '../../../shared/domain/domain-exception';
import type { GameEvent } from '../events/game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameStatus } from '../enums/game-status.enum';

/**
 * Partie de campagne — GoF Invoker.
 *
 * Classe abstraite commune à EvenementTeleGame et EscarmoucheGame. Maintient son
 * propre journal d'événements et délègue l'exécution à chaque commande.
 *
 * `canAccept(event)` est la règle métier du statut courant : les événements de
 * classement/exploits/épaves ne sont acceptés qu'en PLANIFIE, les événements
 * d'atelier (achat/revente/séquelle) uniquement en ATELIER — la phase garage
 * post-partie appartient à la partie elle-même, pas à une entité séparée.
 */
export abstract class Game {
  protected readonly _events: GameEvent[];
  // status / playedAt sont mutés par les transitions enterAtelier()/closeAtelier() —
  // privés pour que ces changements passent par des méthodes de domaine (plus de cast readonly).
  private _status: GameStatus;
  private _playedAt: Date | null;

  constructor(
    readonly id: number,
    readonly campaignId: number,
    status: GameStatus,
    readonly order: number,
    playedAt: Date | null,
    events: GameEvent[],
  ) {
    this._status = status;
    this._playedAt = playedAt;
    this._events = [...events].sort((a, b) => a.eventOrder - b.eventOrder);
  }

  get events(): readonly GameEvent[] { return this._events; }
  get status(): GameStatus { return this._status; }
  get playedAt(): Date | null { return this._playedAt; }

  /** Sous-type de partie. Utilisé par le mapper ORM pour l'hydratation STI. */
  abstract get type(): string;

  /**
   * Peut-on ajouter cet événement à cette partie, compte tenu de son statut
   * courant ? Implémenté par chaque sous-type. `addEvent` appelle cette
   * méthode avant d'ajouter.
   */
  abstract canAccept(event: GameEvent): boolean;

  /**
   * Valide et ajoute un événement au journal.
   * Le use case doit ensuite appeler `event.execute(participants)` lui-même.
   */
  addEvent(event: GameEvent): void {
    if (this._status === GameStatus.JOUE) {
      throw new DomainException(
        `Cette partie (${this.type}) est figée et n'accepte plus d'événements.`,
      );
    }
    if (!this.canAccept(event)) {
      throw new DomainException(
        `Cet événement n'est pas autorisé pour une partie de type ${this.type} en statut ${this._status}.`,
      );
    }
    this._events.push(event);
  }

  /** Transition PLANIFIE → ATELIER : résultat enregistré, phase garage ouverte. */
  enterAtelier(): void {
    if (this._status !== GameStatus.PLANIFIE) {
      throw new DomainException('Seule une partie PLANIFIE peut entrer en atelier.');
    }
    this._status = GameStatus.ATELIER;
    this._playedAt = new Date();
  }

  /** Transition ATELIER → JOUE : phase garage clôturée, la partie est figée. */
  closeAtelier(): void {
    if (this._status !== GameStatus.ATELIER) {
      throw new DomainException("Cette partie n'est pas en atelier.");
    }
    this._status = GameStatus.JOUE;
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
