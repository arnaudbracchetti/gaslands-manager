import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { GameEventType } from '../enums/game-event-type.enum';

/**
 * Bonus différé "Favori du public" (Table des Épaves, ligne 9) : un véhicule ayant
 * déjà obtenu ce résultat lors d'une partie précédente (`Vehicle.hasFavoriDuPublic`,
 * octroyé par `WreckResolvedEvent`) crédite +5 PC à son propriétaire la fois où il
 * devient enfin `VEHICULE_DETRUIT` — à condition que le joueur choisisse de dépenser
 * 3 votes du public pour le déclencher (déclaration sur l'honneur, non trackée par
 * l'application).
 *
 * Le statut est un état réel du véhicule (pas une simple attestation manuelle) :
 * `Game.creditFavoriDuPublicBonus` revérifie `Vehicle.hasFavoriDuPublic` avant de
 * construire cet événement, qui CONSOMME le statut en le retirant du véhicule à son
 * exécution — un même octroi ne peut être dépensé qu'une fois. `vehicleId` est par
 * ailleurs purement informatif, comme pour `VehicleDestroyedEvent`. `championshipPoints`
 * est figé au moment de l'enregistrement (même raisonnement D-S8 que
 * `RankingAssignedEvent`).
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
    const p = this.findParticipant(participants);
    p.team.findVehicle(this.vehicleId).clearFavoriDuPublic();
    p.addPoints(this.championshipPoints);
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findVehicle(this.vehicleId).markFavoriDuPublic();
    p.addPoints(-this.championshipPoints);
  }

  describe(participants: readonly CampaignParticipant[]): string {
    const found = this.findVehicleWithTeam(participants, this.vehicleId);
    const label = found ? ` : ${found.vehicle.type.nom}` : '';
    return `Bonus Favori du public${label} (+${this.championshipPoints} PC)`;
  }
}
