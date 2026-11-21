/**
 * Une ligne d'entrée pour le calcul d'éligibilité à la cagnotte télé — un
 * participant `VALIDATED` de la campagne, construit par `Game.recordResult` depuis
 * la liste complète des participants qu'il reçoit déjà en paramètre (pas seulement
 * ceux classés dans cette partie) — jamais fournie telle quelle par un appelant.
 */
export interface TvBonusEntry {
  participantId: number;
}

/**
 * Stratégie de distribution de la cagnotte collective de fin d'Événement Télévisé —
 * un calcul unitaire par participant, comme `ResistanceDistributionStrategy`. Aucun
 * contexte partagé n'est nécessaire ici (contrairement à la Résistance, dont le
 * critère dépend du rang/des PC de la partie) : l'éligibilité ne dépend d'aucune
 * autre donnée que l'appartenance à la campagne, déjà garantie par la construction
 * de `TvBonusEntry`.
 */
export interface TvBonusDistributionStrategy {
  /**
   * Clé de la règle (nom_interne du catalogue de règles maison, ou `"defaut"` pour
   * l'absence de règle active) — cohérent avec `ResistanceDistributionStrategy.key`,
   * même si rien ne la stampe aujourd'hui sur l'événement créé (pas d'ambiguïté à
   * lever : `WalletReason.CAGNOTTE_TELE` n'est utilisée par aucun autre mécanisme).
   */
  readonly key: string;
  /** Ce participant reçoit-il la prime collective pour cet Événement Télévisé ? */
  isEligible(entry: TvBonusEntry): boolean;
}

/** Montant de la prime collective (règle maison), en jerricans. */
export const TV_BONUS_AMOUNT_JERRICANS = 5;

/**
 * Comportement par défaut (règle maison désactivée) : personne ne reçoit la prime —
 * implémentation explicite de la Strategy, pas un cas spécial hors du pattern (même
 * principe que `DefaultResistanceStrategy`).
 */
export class NoTvBonusStrategy implements TvBonusDistributionStrategy {
  readonly key: string = 'defaut';

  isEligible(_entry: TvBonusEntry): boolean {
    return false;
  }
}

/**
 * « Cagnotte collective de fin d'Événement Télévisé » (règle maison, nom_interne
 * `cagnotte_collective_evenement_tele` au catalogue, cf.
 * `database_init/data/regles-maison.yml`) : tout participant `VALIDATED` de la
 * campagne est éligible, y compris ceux absents de cette partie précise.
 */
export class CollectiveTvBonusStrategy implements TvBonusDistributionStrategy {
  readonly key: string = 'cagnotte_collective_evenement_tele';

  isEligible(_entry: TvBonusEntry): boolean {
    return true;
  }
}
