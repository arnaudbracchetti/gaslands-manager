import { describe, it, expect, vi } from 'vitest';
import { DrawRandomScenarioUseCase } from './draw-random-scenario.usecase';
import { GameType } from '../game.enums';
import type { Scenario } from '../scenario.interfaces';
import type { ScenarioCatalogService } from '../scenario-catalog.service';
import type { ScenarioDrawTable } from '../domain/scenario-draw-table';

function makeScenario(nomInterne: string, type: GameType): Scenario {
  return {
    nom: nomInterne,
    nom_interne: nomInterne,
    type,
    description: '',
    franchissement_portes: false,
    gain_jerricans: false,
    poids_tirage: 1,
  };
}

describe('DrawRandomScenarioUseCase', () => {
  const arene = makeScenario('arene_de_la_mort', GameType.EVENEMENT_TELE);
  const course = makeScenario('course_a_la_mort', GameType.EVENEMENT_TELE);
  const livraison = makeScenario('livraison_express', GameType.ESCARMOUCHE);
  const scenarioCatalog = {
    getAll: vi.fn().mockReturnValue([arene, livraison, course]),
  } as unknown as ScenarioCatalogService;

  it.each([
    [GameType.EVENEMENT_TELE, [arene, course]],
    [GameType.ESCARMOUCHE, [livraison]],
  ])('ne soumet au tirage que les scénarios de type %s et renvoie le tiré', (type, attendus) => {
    const drawTable = {
      draw: vi.fn().mockReturnValue(attendus[0]),
    } as unknown as ScenarioDrawTable;

    const result = new DrawRandomScenarioUseCase(scenarioCatalog, drawTable).execute(type);

    expect(drawTable.draw).toHaveBeenCalledWith(attendus);
    expect(result).toBe(attendus[0]);
  });
});
