// Résultats possibles de la Table des Épaves (D6 + poids du véhicule).
// Le résultat est figé dans WreckResolvedEvent au moment du lancer (write-time).
export enum WreckResult {
  CHOCS_GAGNE = 'CHOCS_GAGNE',               // véhicule endommagé mais toujours en piste
  ARME_PERDUE = 'ARME_PERDUE',               // chocs + une arme détruite
  EPAVE = 'EPAVE',                           // véhicule définitivement perdu
}
