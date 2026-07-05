// Résultats possibles de la Table des Épaves (D6 + Chocs + modificateur de poids, p.168).
// Le résultat est figé dans WreckResolvedEvent au moment du lancer (write-time).
export enum WreckResult {
  DEBOSSELE = 'DEBOSSELE',                     // -1 Choc (minimum 0)
  INDEMNE = 'INDEMNE',                         // aucun effet
  ROUE_CABOSSEE = 'ROUE_CABOSSEE',             // +1 Choc
  ARRACHEE = 'ARRACHEE',                       // +1 Choc, perte aléatoire arme ou amélioration
  PIGNON_ENDOMMAGE = 'PIGNON_ENDOMMAGE',       // +1 Choc (perte d'amélioration non implémentée)
  SIEGE_IRRECUPERABLE = 'SIEGE_IRRECUPERABLE', // +2 Chocs, Équipage -1 permanent (min 1)
  CHASSIS_FRAGILISE = 'CHASSIS_FRAGILISE',     // +2 Chocs, rappel "Jeton Danger" (pas d'état)
  FAVORI_DU_PUBLIC = 'FAVORI_DU_PUBLIC',       // +3 Chocs, +5 PC différé si Épave plus tard
  VEHICULE_DETRUIT = 'VEHICULE_DETRUIT',       // véhicule définitivement perdu, pilote mort
}
