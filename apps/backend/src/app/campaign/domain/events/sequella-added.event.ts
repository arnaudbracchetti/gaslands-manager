import { GameEvent } from './game-event';
import type { CampaignParticipant } from '../campaign-participant';
import { SEQUELLA_REGISTRY } from '../../../team/domain/sequella-decorators';
import { DomainException } from '../../../shared/domain/domain-exception';

/**
 * Échange de Chocs contre une séquelle permanente (atelier ou post-épave).
 *
 * `execute()` : dépense les Chocs + ajoute le SequellaType au véhicule.
 * `undo()` : retire la dernière séquelle ajoutée + restitue les Chocs.
 *
 * L'ordre LIFO (removeLastSequella) est garanti par le fait que le replay applique
 * les événements dans l'ordre croissant d'eventOrder — le dernier push est toujours
 * la séquelle de cet événement.
 */
export class SequellaAddedEvent extends GameEvent {
  constructor(
    id: number,
    gameId: number,
    participantId: number,
    eventOrder: number,
    readonly vehicleId: number,
    /** `nom_interne` de la séquelle — clé dans `SEQUELLA_REGISTRY`. */
    readonly sequellaTypeNom: string,
    readonly chocsCost: number,
  ) {
    super(id, gameId, participantId, eventOrder);
  }

  execute(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    const vehicle = p.team.findVehicle(this.vehicleId);
    const entry = SEQUELLA_REGISTRY.get(this.sequellaTypeNom);
    if (!entry) throw new DomainException(`Séquelle inconnue : "${this.sequellaTypeNom}"`);
    vehicle.addChocs(-this.chocsCost);
    vehicle.addSequella(entry.type);
  }

  undo(participants: CampaignParticipant[]): void {
    const p = this.findParticipant(participants);
    const vehicle = p.team.findVehicle(this.vehicleId);
    vehicle.removeLastSequella();
    vehicle.addChocs(this.chocsCost);
  }
}
