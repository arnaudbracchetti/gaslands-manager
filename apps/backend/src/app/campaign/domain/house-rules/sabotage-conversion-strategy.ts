/**
 * Stratégie de conversion des jetons de sabotage en jerricans (Atelier).
 *
 * Une Strategy ne répond qu'à UNE question métier : « la conversion est-elle ouverte dans
 * cette campagne, et à quel taux ? ». Elle ne connaît ni le participant, ni la partie :
 * les contrôles d'état (statut ATELIER, solde de jetons) restent dans
 * `Game.convertSabotage`.
 */
export interface SabotageConversionStrategy {
  /** `"defaut"` pour la règle par défaut, `nom_interne` du catalogue pour la règle maison. */
  readonly key: string;
  /** Taux de change : jerricans reçus pour 1 jeton converti (porté par la règle, pas par `Game`). */
  readonly jerricansPerToken: number;
  /** La conversion est-elle ouverte dans cette campagne ? */
  isAllowed(): boolean;
}

/** Défaut (règle décochée) : aucune conversion possible — implémentation explicite de la Strategy. */
export class NoSabotageConversionStrategy implements SabotageConversionStrategy {
  readonly key: string = 'defaut';
  readonly jerricansPerToken: number = 0;

  isAllowed(): boolean {
    return false;
  }
}

/**
 * « Conversion des jetons de sabotage en jerricans » (règle maison, `nom_interne`
 * `conversion_sabotage_jerricans`) : 1 jeton de sabotage = 3 jerricans pendant l'Atelier.
 */
export class SabotageToJerricansStrategy implements SabotageConversionStrategy {
  readonly key: string = 'conversion_sabotage_jerricans';
  readonly jerricansPerToken: number = 3;

  isAllowed(): boolean {
    return true;
  }
}
