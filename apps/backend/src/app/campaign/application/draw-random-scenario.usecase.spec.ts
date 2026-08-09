import { describe, it, expect, vi } from 'vitest';
import { DrawRandomScenarioUseCase } from './draw-random-scenario.usecase';
import { GameType } from '../game.enums';
import type { Scenario } from '../scenario.interfaces';
import type { ScenarioCatalogService } from '../scenario-catalog.service';
import type { ScenarioDrawTable } from '../domain/scenario-draw-table';

function makeScenario(nomInterne: string): Scenario {
  return {
    nom: nomInterne,
    nom_interne: nomInterne,
    type: GameType.EVENEMENT_TELE,
    description: '',
    franchissement_portes: false,
    gain_jerricans: false,
  };
}

describe('DrawRandomScenarioUseCase', () => {
  it('tire un nom_interne via ScenarioDrawTable puis le résout via le catalogue', () => {
    const scenario = makeScenario('arene_de_la_mort');
    const scenarioCatalog = {
      getByNomInterne: vi.fn().mockReturnValue(scenario),
    } as unknown as ScenarioCatalogService;
    const drawTable = {
      draw: vi.fn().mockReturnValue('arene_de_la_mort'),
    } as unknown as ScenarioDrawTable;

    const useCase = new DrawRandomScenarioUseCase(scenarioCatalog, drawTable);
    const result = useCase.execute(GameType.EVENEMENT_TELE);

    expect(drawTable.draw).toHaveBeenCalledWith(GameType.EVENEMENT_TELE);
    expect(scenarioCatalog.getByNomInterne).toHaveBeenCalledWith('arene_de_la_mort');
    expect(result).toBe(scenario);
  });

  it('lève une erreur si le nom_interne tiré est absent du catalogue', () => {
    const scenarioCatalog = {
      getByNomInterne: vi.fn().mockReturnValue(undefined),
    } as unknown as ScenarioCatalogService;
    const drawTable = {
      draw: vi.fn().mockReturnValue('scenario_inconnu'),
    } as unknown as ScenarioDrawTable;

    const useCase = new DrawRandomScenarioUseCase(scenarioCatalog, drawTable);
    expect(() => useCase.execute(GameType.ESCARMOUCHE)).toThrow(
      'Scénario tiré introuvable au catalogue : "scenario_inconnu".',
    );
  });
});
