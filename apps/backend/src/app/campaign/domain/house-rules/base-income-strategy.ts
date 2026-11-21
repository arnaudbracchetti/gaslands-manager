import type { IRandomizer } from '../randomizer.interface';

/**
 * Stratégie de résolution du revenu de base d'une Escarmouche — contrairement à
 * `ResistanceDistributionStrategy`/`TvBonusDistributionStrategy` (un `isEligible`
 * par participant), il n'y a ici aucune liste à filtrer : une seule décision par
 * tirage, "tire-t-on, et pour quel montant ?". `Game.rollBaseIncome` délègue
 * entièrement le tirage à la Strategy résolue, plutôt que de tirer lui-même puis
 * consulter la règle après coup.
 */
export interface BaseIncomeStrategy {
  /**
   * Clé de la règle (nom_interne du catalogue de règles maison, ou `"defaut"` pour
   * l'absence de règle active) — cohérent avec `ResistanceDistributionStrategy.key`/
   * `TvBonusDistributionStrategy.key`, même si rien ne la stampe aujourd'hui sur
   * l'événement créé (`WalletMovementEvent` ne porte pas de `strategyKey`,
   * contrairement à `ResistanceContactedEvent`).
   */
  readonly key: string;
  /** Montant à créditer pour ce tirage, en jerricans — `null` si aucun revenu de
   *  base ne doit être journalisé (règle maison active). */
  roll(randomizer: IRandomizer): number | null;
}

/**
 * Comportement par défaut (règle maison désactivée) : revenu de base classique,
 * 1D6 jerricans — implémentation explicite de la Strategy, pas un cas spécial hors
 * du pattern (même principe que `DefaultResistanceStrategy`/`NoTvBonusStrategy`).
 */
export class DefaultBaseIncomeStrategy implements BaseIncomeStrategy {
  readonly key: string = 'defaut';

  roll(randomizer: IRandomizer): number {
    return randomizer.roll(6);
  }
}

/**
 * « Bonus de jerricans pour la participation à une escarmouche » (règle
 * maison, nom_interne `escarmouche_bonus_jerricans` au catalogue, cf.
 * `database_init/data/regles-maison.yml`) : aucun revenu de base n'est
 * distribué — seules les récompenses manuelles du scénario
 * (`Game.recordJerricanGains`, non concerné par cette règle) comptent encore.
 */
export class NoBaseIncomeStrategy implements BaseIncomeStrategy {
  readonly key: string = 'escarmouche_bonus_jerricans';

  roll(_randomizer: IRandomizer): null {
    return null;
  }
}
