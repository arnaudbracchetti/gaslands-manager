import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Un participant a dépensé des points de sabotage pendant la partie — déclaration
 * rétroactive de l'organisateur (le solde de points de sabotage, dérivé des Points de
 * Résistance secrets, n'est jamais affiché à l'écran : rien à valider côté client).
 *
 * `pointsSpent` est déjà la valeur RÉELLEMENT appliquée — clampée au solde disponible par
 * `Game.recordSabotageSpent` AVANT de construire cet événement, jamais la valeur brute
 * tapée par l'organisateur. Ce choix garantit que `resistancePoints` ne descend jamais
 * sous 0 (3 × sabotagePoints ≤ resistancePoints, par construction du `floor()` de
 * `CampaignParticipant.sabotagePoints`) SANS lever de `DomainException` pour une
 * sur-déclaration — silencieusement réduite, jamais rejetée.
 *
 * Le clamp doit se faire AVANT la construction, et nulle part ailleurs : `execute()`/
 * `describe()` ne relisent jamais l'état courant du participant — `Game.journal()`
 * (lecture) est appelé sur une campagne chargée SANS rejouer (`CampaignReplayService.load`,
 * pas `loadAndReplay`), où `sabotagePoints` vaudrait toujours 0 (aucun `attachTeam()`/
 * replay). Un recalcul tardif dans `describe()` afficherait donc systématiquement
 * "0 dépensé(s)", quelle que soit la réalité.
 */
export class SabotagePointsSpentEvent extends GameEvent {
  private static readonly RESISTANCE_PER_SABOTAGE_POINT = 3;

  readonly eventType = GameEventType.SABOTAGE_POINTS_SPENT;

  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly pointsSpent: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    this.findParticipant(participants).addResistance(
      -this.pointsSpent * SabotagePointsSpentEvent.RESISTANCE_PER_SABOTAGE_POINT,
    );
  }

  undo(participants: CampaignParticipant[]): void {
    this.findParticipant(participants).addResistance(
      this.pointsSpent * SabotagePointsSpentEvent.RESISTANCE_PER_SABOTAGE_POINT,
    );
  }

  describe(): string {
    return `Sabotage : ${this.pointsSpent} point(s) de sabotage dépensé(s)`;
  }
}
