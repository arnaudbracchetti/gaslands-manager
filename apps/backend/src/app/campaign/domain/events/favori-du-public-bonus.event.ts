import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Bonus différé "Favori du public" (Table des Épaves, ligne 9) : un véhicule ayant
 * déjà obtenu ce résultat lors d'une partie précédente crédite +5 PC à son propriétaire
 * la fois où il devient enfin `VEHICULE_DETRUIT`.
 *
 * L'attestation ("ce véhicule porte déjà ce bonus en attente") est manuelle — saisie par
 * l'organisateur à l'écran de désignation des épaves — l'app ne mémorise aucun état entre
 * deux parties (cf. design du wizard de fin de partie). `vehicleId` est purement
 * informatif, comme pour `VehicleDestroyedEvent`. `championshipPoints` est figé au moment
 * de l'enregistrement (même raisonnement D-S8 que `RankingAssignedEvent`).
 */
export class FavoriDuPublicBonusEvent extends GameEvent {
  readonly eventType = GameEventType.FAVORI_DU_PUBLIC_BONUS;

  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly vehicleId: number,
    readonly championshipPoints: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    this.findParticipant(participants).addPoints(this.championshipPoints);
  }

  undo(participants: CampaignParticipant[]): void {
    this.findParticipant(participants).addPoints(-this.championshipPoints);
  }

  describe(participants: readonly CampaignParticipant[]): string {
    const found = this.findVehicleWithTeam(participants, this.vehicleId);
    const label = found ? ` : ${found.vehicle.type.nom}` : '';
    return `Bonus Favori du public${label} (+${this.championshipPoints} PC)`;
  }
}
