import type { Scenario } from '../scenario.interfaces';
import { GameType } from '../game.enums';
import { ScenarioCatalogService } from '../scenario-catalog.service';
import { ScenarioDrawTable } from '../domain/scenario-draw-table';

/**
 * Tirage aléatoire d'un scénario - GET /api/catalog/scenarios/random.
 *
 * Pure lecture (pas d'agrégat, pas de persistance, pas d'événement journalisé) :
 * sélectionne dans le catalogue en mémoire les scénarios du type demandé, puis délègue
 * le tirage pondéré (`poids_tirage`) à `ScenarioDrawTable` (domaine) - même route
 * publique (pas de JWT) que `getScenarios()`.
 */
export class DrawRandomScenarioUseCase {
  constructor(
    private readonly scenarioCatalog: ScenarioCatalogService,
    private readonly drawTable: ScenarioDrawTable,
  ) {}

  execute(type: GameType): Scenario {
    const candidats = this.scenarioCatalog
      .getAll()
      .filter((s) => s.type === type);
    return this.drawTable.draw(candidats);
  }
}
