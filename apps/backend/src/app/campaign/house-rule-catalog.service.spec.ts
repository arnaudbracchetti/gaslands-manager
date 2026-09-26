/**
 * Tests unitaires pour HouseRuleCatalogService.
 *
 * Même stratégie que ScenarioCatalogService (Pattern Template Method) : on étend
 * le service dans une sous-classe de test qui surcharge readFileContent() pour
 * fournir un YAML fictif, sans mocker `fs`. Le vrai parser `yaml` et `marked`
 * sont utilisés.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HouseRuleCatalogService } from './house-rule-catalog.service';

const MOCK_YAML = `
regles_maison:
  - nom: "Points de Résistance aux équipes sans point de championnat"
    nom_interne: "distribution_points_resistance"
    description_decochee: "Comportement **par défaut** décoché."
    description_cochee: "Comportement alternatif coché."
  - nom: "Autre règle"
    nom_interne: "autre_regle"
    description_decochee: "Texte décoché."
    description_cochee: "Texte coché."
`;

class TestHouseRuleCatalogService extends HouseRuleCatalogService {
  protected override readFileContent(): string {
    return MOCK_YAML;
  }
}

describe('HouseRuleCatalogService', () => {
  let service: TestHouseRuleCatalogService;

  beforeEach(() => {
    service = new TestHouseRuleCatalogService();
    service.onModuleInit();
  });

  it('charge toutes les règles maison du YAML', () => {
    expect(service.getAll()).toHaveLength(2);
  });

  it('indexe les règles maison par nom_interne', () => {
    const rule = service.getByNomInterne('distribution_points_resistance');
    expect(rule?.nom).toBe('Points de Résistance aux équipes sans point de championnat');
  });

  it('convertit la description décochée Markdown en HTML', () => {
    const rule = service.getByNomInterne('distribution_points_resistance');
    expect(rule?.description_decochee).toContain('<strong>par défaut</strong>');
  });

  it('convertit la description cochée Markdown en HTML', () => {
    const rule = service.getByNomInterne('distribution_points_resistance');
    expect(rule?.description_cochee).toContain('Comportement alternatif coché.');
  });

  it('retourne undefined pour un nom_interne inconnu', () => {
    expect(service.getByNomInterne('inexistant')).toBeUndefined();
  });

  it('validKeys() retourne les nom_interne de toutes les règles du catalogue', () => {
    expect(service.validKeys()).toEqual(['distribution_points_resistance', 'autre_regle']);
  });
});
