import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { WreckResult } from '../enums/wreck-result.enum';
import { GameEventType } from '../enums/game-event-type.enum';
import { wreckWeightModifier } from '../wreck/wreck-weight-modifier';


/**
 * Résultat du lancer de la Table des Épaves
 *
 * Stocke le résultat brut du D6 + la ligne de table appliquée. Les effets concrets
 * (VehicleLostEvent, WeaponLostEvent, ImprovementLostEvent) sont créés séparément par
 * `WreckTable` (domain service) et persistés comme événements distincts. Celui-ci
 * applique les Chocs et, pour la ligne FAVORI_DU_PUBLIC, octroie le statut Favori du
 * Public au véhicule (`Vehicle.hasFavoriDuPublic`) — consommé plus tard par
 * `FavoriDuPublicBonusEvent` si le joueur choisit de le déclencher à une destruction
 * ultérieure de ce même véhicule.
 */
export class WreckResolvedEvent extends GameEvent {
  readonly eventType = GameEventType.WRECK_RESOLVED;

  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly vehicleId: number,
    readonly diceRoll: number,
    readonly chocsBefore: number,
    readonly wreckResult: WreckResult,
    readonly chocsGained: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    const vehicle = p.team.findVehicle(this.vehicleId);
    vehicle.addChocs(this.chocsGained);
    if (this.wreckResult === WreckResult.FAVORI_DU_PUBLIC) vehicle.markFavoriDuPublic();
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    const vehicle = p.team.findVehicle(this.vehicleId);
    vehicle.addChocs(-this.chocsGained);
    if (this.wreckResult === WreckResult.FAVORI_DU_PUBLIC) vehicle.clearFavoriDuPublic();
  }

  describe(participants: readonly CampaignParticipant[]): string {
    const chocs = this.chocsGained !== 0
      ? `, ${this.chocsGained > 0 ? '+' : ''}${this.chocsGained} choc(s)`
      : '';
    const found = this.findVehicleWithTeam(participants, this.vehicleId);
    const vehicleName = found?.vehicle.nom ?? '';
    // Le modificateur de poids (Léger +1 / Lourd −1) entre dans le calcul du tirage
    // (cf. WreckTable.rollOnce) mais n'est stocké nulle part sur l'événement — comme
    // `vehicleName` ci-dessus, il est recalculé ici depuis le véhicule (type immutable).
    // Sans lui, un total affiché "D6+chocs" pouvait ne pas correspondre à la ligne
    // obtenue pour un véhicule Léger/Lourd (omis, pas 0, l'affichage restait silencieux).
    const weightMod = found ? wreckWeightModifier(found.vehicle.type.poids) : 0;
    const weightPart = weightMod !== 0
      ? `, ${weightMod > 0 ? '+' : ''}${weightMod} (${found?.vehicle.type.poids}) = ${this.diceRoll + this.chocsBefore + weightMod}`
      : '';
    return `Tirage sur la table des Épaves${vehicleName ? ` pour (${vehicleName})` : ''} : ${WRECK_RESULT_LABELS[this.wreckResult]} `
      + `(D6=${this.diceRoll}+${this.chocsBefore} chocs${weightPart}${chocs})`;
  }
}

const WRECK_RESULT_LABELS: Record<WreckResult, string> = {
  [WreckResult.DEBOSSELE]: 'Débosselé !',
  [WreckResult.INDEMNE]: 'S\'en sort indemne',
  [WreckResult.ROUE_CABOSSEE]: 'Passage de roue cabossé',
  [WreckResult.ARRACHEE]: 'Arrachée',
  [WreckResult.PIGNON_ENDOMMAGE]: 'Pignon endommagé',
  [WreckResult.SIEGE_IRRECUPERABLE]: 'Siège irrécupérable',
  [WreckResult.CHASSIS_FRAGILISE]: 'Châssis fragilisé',
  [WreckResult.FAVORI_DU_PUBLIC]: 'Favori du public',
  [WreckResult.VEHICULE_DETRUIT]: 'Véhicule détruit, pilote mort',
};
