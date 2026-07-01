/**
 * Tests unitaires pour ScenarioCatalogService.
 *
 * Même stratégie que CatalogService (Pattern Template Method) : on étend le
 * service dans une sous-classe de test qui surcharge readFileContent() pour
 * fournir un YAML fictif, sans mocker `fs`. Le vrai parser `yaml` et `marked`
 * sont utilisés.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ScenarioCatalogService } from './scenario-catalog.service';
import { GameType } from './game.enums';

const MOCK_YAML = `
scenarios:
  - nom: "La Course de la Mort"
    nom_interne: "course_de_la_mort"
    type: "EVENEMENT_TELE"
    description: "Une **course** classique."
  - nom: "Embuscade"
    nom_interne: "embuscade"
    type: "ESCARMOUCHE"
    description: "Un piège tendu."
`;

class TestScenarioCatalogService extends ScenarioCatalogService {
  protected override readFileContent(): string {
    return MOCK_YAML;
  }
}

describe('ScenarioCatalogService', () => {
  let service: TestScenarioCatalogService;

  beforeEach(() => {
    service = new TestScenarioCatalogService();
    service.onModuleInit();
  });

  it('charge tous les scénarios du YAML', () => {
    expect(service.getAll()).toHaveLength(2);
  });

  it('indexe les scénarios par nom_interne', () => {
    const scenario = service.getByNomInterne('course_de_la_mort');
    expect(scenario?.nom).toBe('La Course de la Mort');
    expect(scenario?.type).toBe(GameType.EVENEMENT_TELE);
  });

  it('convertit la description Markdown en HTML', () => {
    const scenario = service.getByNomInterne('course_de_la_mort');
    expect(scenario?.description).toContain('<strong>course</strong>');
  });

  it('retourne undefined pour un nom_interne inconnu', () => {
    expect(service.getByNomInterne('inexistant')).toBeUndefined();
  });

  it('conserve le type Escarmouche', () => {
    expect(service.getByNomInterne('embuscade')?.type).toBe(GameType.ESCARMOUCHE);
  });
});
