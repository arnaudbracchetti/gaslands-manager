import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Une arme est détruite pendant la campagne.
 * Pose un flag transient sur l'arme — emplacement libéré (weapon.slots → 0).
 * Le coût de l'arme n'est pas remboursé (price inchangé).
 */
export class WeaponLostEvent extends GameEvent {
  readonly eventType = GameEventType.WEAPON_LOST;

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

  describe(participants: readonly CampaignParticipant[]): string {
    try {
      const p = this.findParticipant(participants);
      const nom = p.team.findWeapon(this.weaponId).type.nom;
      const vehicle = p.team.vehicles.find((v) => v.weapons.some((w) => w.id === this.weaponId));
      const vehicleLabel = vehicle ? ` sur le véhicule ${vehicle.type.nom}` : '';
      return `Arme perdue : ${nom}${vehicleLabel}`;
    } catch {
      return `Arme perdue : #${this.weaponId}`;
    }
  }
}
