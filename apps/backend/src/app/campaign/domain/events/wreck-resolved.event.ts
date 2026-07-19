import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { WreckResult } from '../enums/wreck-result.enum';
import { GameEventType } from '../enums/game-event-type.enum';


/**
 * Résultat du lancer de la Table des Épaves
 *
 * Stocke le résultat brut du D6 + la ligne de table appliquée. Les effets concrets
 * (VehicleLostEvent, WeaponLostEvent, ImprovementLostEvent) sont créés séparément par
 * `WreckTable` (domain service) et persistés comme événements distincts. Celui-ci
 * n'applique que les Chocs.
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
    p.team.findVehicle(this.vehicleId).addChocs(this.chocsGained);
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    p.team.findVehicle(this.vehicleId).addChocs(-this.chocsGained);
  }

  describe(participants: readonly CampaignParticipant[]): string {
    const chocs = this.chocsGained !== 0
      ? `, ${this.chocsGained > 0 ? '+' : ''}${this.chocsGained} choc(s)`
      : '';
    const found = this.findVehicleWithTeam(participants, this.vehicleId);
    const vehicleName = found?.vehicle.nom ?? '';
    return `Table des Épaves${vehicleName ? ` (${vehicleName})` : ''} : ${WRECK_RESULT_LABELS[this.wreckResult]} `
      + `(D6=${this.diceRoll}+${this.chocsBefore} chocs${chocs})`;
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
