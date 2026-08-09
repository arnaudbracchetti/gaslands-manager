import type { Scenario } from '../scenario.interfaces';
import { GameType } from '../game.enums';
import { ScenarioCatalogService } from '../scenario-catalog.service';
import { ScenarioDrawTable } from '../domain/scenario-draw-table';

/**
 * Tirage aléatoire d'un scénario (Gaslands, p.128-129) — GET /api/catalog/scenarios/random.
 *
 * Pure lecture (pas d'agrégat, pas de persistance, pas d'événement journalisé) :
 * délègue le jet de dé à `ScenarioDrawTable` (domaine) puis résout le résultat via le
 * catalogue déjà en mémoire — même route publique (pas de JWT) que `getScenarios()`.
 */
export class DrawRandomScenarioUseCase {
  constructor(
    private readonly scenarioCatalog: ScenarioCatalogService,
    private readonly drawTable: ScenarioDrawTable,
  ) {}

  execute(type: GameType): Scenario {
    const nomInterne = this.drawTable.draw(type);
    const scenario = this.scenarioCatalog.getByNomInterne(nomInterne);
    if (!scenario) {
      throw new Error(`Scénario tiré introuvable au catalogue : "${nomInterne}".`);
    }
    return scenario;
  }
}
