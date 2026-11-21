/**
 * Stratégie de plafonnement des gains de jerricans (type "récompense") sur une
 * Escarmouche — contrairement à `BaseIncomeStrategy` (une décision isolée par
 * tirage), cette Strategy a besoin de connaître le cumul DÉJÀ crédité au
 * participant sur CETTE partie pour décider du montant à réellement accorder.
 * `Game.recordJerricanGains`/`rollBaseIncome` calculent ce cumul depuis leur
 * propre journal (`this.events`, filtré par participant et
 * `recompenseJerricansAwarded`) et le passent en `alreadyEarned` — même
 * principe que `ResistanceDistributionStrategy.isEligible(entry, context)`.
 */
export interface JerricanGainsCapStrategy {
  /**
   * Clé de la règle (nom_interne du catalogue de règles maison, ou `"defaut"` pour
   * l'absence de règle active) — cohérent avec les autres Strategy de règles maison.
   */
  readonly key: string;
  /**
   * Réduit, si nécessaire, le montant à créditer pour respecter un plafond de gains
   * sur la partie — `alreadyEarned` est la somme des `WalletReason.RECOMPENSE` déjà
   * journalisés pour ce participant sur CETTE Escarmouche (butin de scénario + revenu
   * de base confondus). Ne lève jamais d'exception : un dépassement réduit
   * silencieusement le montant, jusqu'à 0 si le plafond est déjà atteint — même style
   * que le clamp de `Game.recordSabotageSpent`.
   */
  clamp(requestedAmount: number, alreadyEarned: number): number;
}

/** Montant maximal de jerricans "récompense" qu'un participant peut gagner sur une
 *  même Escarmouche, quand la règle maison `plafond_jerricans_escarmouche` est active. */
export const JERRICAN_GAINS_CAP_AMOUNT = 15;

/**
 * Comportement par défaut (règle maison désactivée) : aucun plafond, le montant
 * demandé est toujours crédité intégralement — implémentation explicite de la
 * Strategy, pas un cas spécial hors du pattern (même principe que
 * `DefaultResistanceStrategy`/`NoTvBonusStrategy`/`DefaultBaseIncomeStrategy`).
 */
export class UnlimitedJerricanGainsStrategy implements JerricanGainsCapStrategy {
  readonly key: string = 'defaut';

  clamp(requestedAmount: number, _alreadyEarned: number): number {
    return requestedAmount;
  }
}

/**
 * « Plafond de jerricans par Escarmouche » (règle maison, nom_interne
 * `plafond_jerricans_escarmouche` au catalogue, cf.
 * `database_init/data/regles-maison.yml`) : un participant ne peut jamais dépasser
 * `JERRICAN_GAINS_CAP_AMOUNT` jerricans de type récompense sur une même Escarmouche,
 * butin manuel de scénario et revenu de base D6 confondus.
 */
export class CappedJerricanGainsStrategy implements JerricanGainsCapStrategy {
  readonly key: string = 'plafond_jerricans_escarmouche';

  clamp(requestedAmount: number, alreadyEarned: number): number {
    const remaining = Math.max(0, JERRICAN_GAINS_CAP_AMOUNT - alreadyEarned);
    return Math.min(requestedAmount, remaining);
  }
}
