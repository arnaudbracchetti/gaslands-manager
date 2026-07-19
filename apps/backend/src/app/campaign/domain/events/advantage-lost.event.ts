import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Un avantage est détruit pendant la campagne (Table des Épaves, ligne PIGNON_ENDOMMAGE).
 * Pose un flag transient sur l'avantage — aucun emplacement (advantages.slots → 0 toujours),
 * mais la contrainte d'unicité est libérée (peut être racheté en atelier).
 * Le coût de l'avantage n'est pas remboursé (price inchangé, perte totale).
 * Mirroir exact de `WeaponLostEvent` et `ImprovementLostEvent`.
 */
export class AdvantageLostEvent extends GameEvent {
  readonly eventType = GameEventType.ADVANTAGE_LOST;

  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly advantageId: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findAdvantage(this.advantageId).markLost();
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findAdvantage(this.advantageId).clearLost();
  }

  describe(participants: readonly CampaignParticipant[]): string {
    try {
      const p = this.findParticipant(participants);
      const nom = p.team.findAdvantage(this.advantageId).type.nom;
      const vehicle = p.team.vehicles.find((v) => v.advantages.some((a) => a.id === this.advantageId));
      const vehicleLabel = vehicle ? ` sur le véhicule ${vehicle.type.nom}` : '';
      return `Avantage perdu${vehicleLabel} : ${nom}`;
    } catch {
      return `Avantage perdu : #${this.advantageId}`;
    }
  }
}
