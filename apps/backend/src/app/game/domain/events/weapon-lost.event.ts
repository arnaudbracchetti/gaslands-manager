import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';

/**
 * Une arme est détruite pendant la campagne.
 * Pose un flag transient sur l'arme — emplacement libéré (weapon.slots → 0).
 * Le coût de l'arme n'est pas remboursé (price inchangé).
 */
export class WeaponLostEvent extends GameEvent {
  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly weaponId: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findWeapon(this.weaponId).markLost();
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findWeapon(this.weaponId).clearLost();
  }
}
