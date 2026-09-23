import type { HouseRuleStrategyFactory } from '../house-rules/house-rule-strategy.factory';

/**
 * Interface étroite exposée par `Campaign` à chacune de ses parties — jamais
 * l'agrégat `Campaign` complet. Permet à `Game` (et ses sous-types) de résoudre sa
 * propre politique de jeu (ex. quelle Strategy de distribution des Points de
 * Résistance appliquer, cf. `Game.distributeResistance`) sans jamais recevoir cette
 * décision en paramètre depuis un appelant extérieur au domaine (use case).
 *
 * Attachée par `Campaign` à chaque `Game` qu'elle détient (constructeur +
 * `createGame`, même idiome que `CampaignParticipant.attachTeam(team)`) — jamais
 * détenue comme référence permanente typée `Campaign` : c'est la distinction
 * "configuration stable" plutôt que "donnée par appel", cf. skill `ddd`,
 * theory/aggregate-design.md, « Ce dont un enfant a besoin : donnée, configuration,
 * ou port » et « Qui sélectionne une Strategy ? ».
 */
export interface GameRulesContext {
  readonly strategyFactory: HouseRuleStrategyFactory;
}
