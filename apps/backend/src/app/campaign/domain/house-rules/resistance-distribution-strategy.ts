/**
 * Une ligne d'entrée pour le calcul d'éligibilité aux Points de Résistance — un
 * participant classé dans cette partie. Construite par `Game.distributeResistance`
 * en lisant son propre journal (§`Game.distributeResistance`) — jamais fournie
 * telle quelle par un appelant.
 */
export interface ResistanceEntry {
  participantId: number;
  rank: number;
  /**
   * Total des Points de Championnat gagnés par ce participant sur CETTE partie
   * (classement + exploits + bonus Favori du Public), sommé depuis l'accesseur
   * polymorphe `GameEvent.championshipPointsAwarded`.
   */
  championshipPointsThisGame: number;
}

/**
 * Stratégie de distribution automatique des Points de Résistance (US-F1) — un
 * calcul unitaire par participant, jamais un filtrage en bloc de toute la liste :
 * `Game` calcule `classified` (la moitié classée) lui-même depuis son propre
 * journal, cf. `Game.distributeResistance`.
 */
export interface ResistanceDistributionStrategy {
  /**
   * Clé stampée sur l'événement créé (`ResistanceContactedEvent.strategyKey`) —
   * `"defaut"` pour la règle par défaut, `nom_interne` du catalogue de règles
   * maison pour une règle maison.
   */
  readonly key: string;
  /** Ce participant reçoit-il les PR automatiques pour cette partie ? */
  isEligible(entry: ResistanceEntry, context: { classified: number }): boolean;
}

/**
 * Règle par défaut (US-F1, comportement historique) : tout participant classé
 * hors du top `classified` reçoit les PR — extraite telle quelle de l'ancien
 * `Game.recordResult` (RM-4, déplacement du calcul vers l'entrée en Atelier, sans
 * changement de critère).
 */
export class DefaultResistanceStrategy implements ResistanceDistributionStrategy {
  readonly key: string = 'defaut';

  isEligible(entry: ResistanceEntry, context: { classified: number }): boolean {
    return entry.rank > context.classified;
  }
}
