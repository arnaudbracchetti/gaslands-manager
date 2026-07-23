import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Une amélioration est détruite pendant la campagne (Table des Épaves, ligne ARRACHEE).
 * Pose un flag transient sur l'amélioration — emplacement libéré (improvement.slots → 0).
 * Le coût de l'amélioration n'est pas remboursé (price inchangé). Mirroir exact de
 * `WeaponLostEvent`.
 */
export class ImprovementLostEvent extends GameEvent {
  readonly eventType = GameEventType.IMPROVEMENT_LOST;

  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly improvementId: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findImprovement(this.improvementId).markLost();
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findImprovement(this.improvementId).clearLost();
  }

  describe(participants: readonly CampaignParticipant[]): string {
    try {
      const p = this.findParticipant(participants);
      const nom = p.team.findImprovement(this.improvementId).type.nom;
      const vehicle = p.team.vehicles.find((v) => v.improvements.some((i) => i.id === this.improvementId));
      const vehicleLabel = vehicle ? ` sur le véhicule ${vehicle.type.nom}` : '';
      return `Amélioration perdue : ${nom}${vehicleLabel}`;
    } catch {
      return `Amélioration perdue : #${this.improvementId}`;
    }
  }
}
