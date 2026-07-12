import { DomainException } from '../../../shared/domain/domain-exception';
import type { CampaignParticipant } from '../campaign-participant';
import type { Team } from '../../../team/domain/team';
import type { Vehicle } from '../../../team/domain/vehicle';

/**
 * Commande de campagne — GoF Command.
 *
 * Chaque événement est un **fait persisté** dans `game_events`. Son `execute()` applique
 * un effet purement transient en mémoire (modifie Team, Vehicle, Weapon ou les compteurs
 * du participant). Aucune persistance dans `execute()` — seul le use case écrit en base.
 *
 * Propriété fondamentale (event sourcing) :
 *   `execute(p)` puis `undo(p)` → état identique à l'état initial.
 */
export abstract class GameEvent {
  constructor(
    readonly id: number,
    readonly gameId: number,
    readonly participantId: number,
    readonly eventOrder: number,
  ) {}

  abstract execute(participants: CampaignParticipant[]): void;
  abstract undo(participants: CampaignParticipant[]): void;

  /**
   * Ligne de texte (français) décrivant cet événement — utilisée par la synthèse de fin
   * de partie et le journal complet d'une partie. `participants` (état rejoué, équipes
   * attachées) permet de résoudre les noms lisibles de véhicules/équipes à partir des
   * seuls identifiants stockés sur l'événement.
   */
  abstract describe(participants: readonly CampaignParticipant[]): string;

  /**
   * Cet événement référence-t-il ce véhicule (comme cible d'un achat/vente d'équipement,
   * ou d'une séquelle) ? `false` par défaut ; seuls les événements portant un
   * `vehicleId`/`targetVehicleId` le surchargent. Utilisé par
   * `Game.collectSessionEventsForVehicle` pour retrouver, sans connaître chaque type
   * d'événement, tout ce qui doit être supprimé en cascade quand un véhicule acheté
   * pendant la session d'atelier en cours est annulé.
   */
  targetsVehicle(_vehicleId: number): boolean {
    return false;
  }

  protected findParticipant(participants: readonly CampaignParticipant[]): CampaignParticipant {
    const p = participants.find((x) => x.id === this.participantId);
    if (!p) throw new DomainException(`Participant #${this.participantId} introuvable dans la saison`);
    return p;
  }

  /**
   * Recherche un véhicule par id à travers toutes les équipes des participants fournis —
   * la victime d'un exploit (véhicule détruit) n'est pas forcément dans l'équipe du
   * participant de l'événement. Retourne `null` plutôt que de lever : `describe()` est un
   * chemin de lecture, il ne doit jamais faire planter l'affichage du journal.
   */
  protected findVehicleWithTeam(
    participants: readonly CampaignParticipant[],
    vehicleId: number,
  ): { team: Team; vehicle: Vehicle } | null {
    for (const p of participants) {
      if (!p.hasTeam) continue;
      try {
        return { team: p.team, vehicle: p.team.findVehicle(vehicleId) };
      } catch {
        // Absent de cette équipe — on continue la recherche dans les autres.
      }
    }
    return null;
  }
}
