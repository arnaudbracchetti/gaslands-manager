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
import * as fs from 'fs';
import * as path from 'path';
import { GameType } from './game.enums';

const MOCK_YAML = `
scenarios:
  - nom: "La Course de la Mort"
    nom_interne: "course_de_la_mort"
    type: "EVENEMENT_TELE"
    description: "Une **course** classique."
    franchissement_portes: true
    gain_jerricans: false
    poids_tirage: 2
  - nom: "Embuscade"
    nom_interne: "embuscade"
    type: "ESCARMOUCHE"
    description: "Un piège tendu."
    franchissement_portes: false
    gain_jerricans: true
    poids_tirage: 1
`;

class TestScenarioCatalogService extends ScenarioCatalogService {
  constructor(private readonly yaml: string = MOCK_YAML) {
    super();
  }
  protected override readFileContent(): string {
    return this.yaml;
  }
}

/** YAML minimal : un scénario de chaque type, poids de l'Escarmouche paramétrable. */
function yamlAvecPoidsEscarmouche(poidsLigne: string): string {
  return `
scenarios:
  - nom: "Course"
    nom_interne: "course"
    type: "EVENEMENT_TELE"
    description: "x"
    franchissement_portes: true
    gain_jerricans: false
    poids_tirage: 1
  - nom: "Embuscade"
    nom_interne: "embuscade"
    type: "ESCARMOUCHE"
    description: "x"
    franchissement_portes: false
    gain_jerricans: true
${poidsLigne}
`;
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
    expect(service.getByNomInterne('embuscade')?.type).toBe(
      GameType.ESCARMOUCHE,
    );
  });

  it('charge le flag franchissement_portes', () => {
    expect(
      service.getByNomInterne('course_de_la_mort')?.franchissement_portes,
    ).toBe(true);
    expect(service.getByNomInterne('embuscade')?.franchissement_portes).toBe(
      false,
    );
  });

  it('charge le flag gain_jerricans', () => {
    expect(service.getByNomInterne('course_de_la_mort')?.gain_jerricans).toBe(
      false,
    );
    expect(service.getByNomInterne('embuscade')?.gain_jerricans).toBe(true);
  });

  it('charge poids_tirage', () => {
    expect(service.getByNomInterne('course_de_la_mort')?.poids_tirage).toBe(2);
  });

  describe('validation de poids_tirage (fail-fast au démarrage)', () => {
    it.each([
      ['absent', ''],
      ['négatif', '    poids_tirage: -1'],
      ['non entier', '    poids_tirage: 1.5'],
      ['texte', '    poids_tirage: "beaucoup"'],
    ])('rejette un poids %s en nommant le scénario', (_cas, ligne) => {
      const s = new TestScenarioCatalogService(yamlAvecPoidsEscarmouche(ligne));
      expect(() => s.onModuleInit()).toThrow(
        /poids_tirage invalide pour "embuscade"/,
      );
    });

    it('rejette un type dont tous les poids valent 0', () => {
      const s = new TestScenarioCatalogService(
        yamlAvecPoidsEscarmouche('    poids_tirage: 0'),
      );
      expect(() => s.onModuleInit()).toThrow(/aucun scénario ESCARMOUCHE/);
    });
  });

  it('le vrai scenarios.yml est valide (Événements Télévisés : D6 officiel + scénarios ajoutés)', () => {
    // Vrai fichier, lu depuis __dirname (sous `nx test`, process.cwd() vaut apps/backend/,
    // cf. RealCatalogService dans catalog.data.spec.ts). __dirname = apps/backend/src/app/campaign/
    const realYaml = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../../database_init/data/scenarios.yml',
      ),
      'utf-8',
    );
    const reel = new TestScenarioCatalogService(realYaml);
    reel.onModuleInit();
    const poidsEvenement = Object.fromEntries(
      reel
        .getAll()
        .filter((sc) => sc.type === GameType.EVENEMENT_TELE)
        .map((sc) => [sc.nom_interne, sc.poids_tirage]),
    );
    expect(poidsEvenement).toEqual({
      course_a_la_mort: 2,
      arene_de_la_mort: 1,
      capture_du_drapeau: 1,
      destruction_de_drapeaux: 1,
      samedi_soir_en_direct: 1,
      salaire_de_la_peur: 1,
    });
  });
});
