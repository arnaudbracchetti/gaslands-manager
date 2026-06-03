/**
 * Tests unitaires pour CatalogService.
 *
 * Objectif : tester le chargement du catalogue et la résolution des relations
 * sponsor → véhicules/armes/améliorations, en isolation totale du système de fichiers.
 *
 * Stratégie de mock (Pattern Template Method) :
 * - On étend CatalogService dans une sous-classe TestCatalogService.
 * - TestCatalogService surcharge la méthode protégée readFileContent() pour
 *   retourner des données YAML fictives au lieu de lire les vrais fichiers.
 * - Cette approche évite de mocker le module Node `fs` (mocking de built-ins
 *   problématique avec SWC + vitest) et respecte les principes OOP.
 * - Le module `yaml` n'est PAS mocké : le vrai parser est utilisé pour s'assurer
 *   que le YAML fictif est correctement interprété.
 *
 * Cas testés :
 * - Chargement correct du nombre d'items depuis le YAML
 * - Relations pré-résolues : Rutherford a l'Hélicoptère, Mishkin ne l'a pas
 * - Armes exclusives Mishkin (Canon à Arc Électrique)
 * - Cas particulier : prix "x3" (string) préservé pour la Tourelle
 * - Sponsor inexistant retourne undefined
 * - Tous les sponsors ont leurs relations (véhicules, armes, améliorations) résolues
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CatalogService } from './catalog.service';

// ── Données YAML fictives pour les tests ─────────────────────────────────────
// Minimalistes mais représentatives des cas réels :
// - Rutherford : véhicule exclusif (Hélicoptère), armes standards
// - Mishkin : arme exclusive (Canon à Arc), pas d'Hélicoptère
// - Tourelle : prix "x3" (string, pas un nombre)

const MOCK_YAML: Record<string, string> = {
  'sponsors.yml': `
sponsors:
  - nom: "Rutherford"
    description: "Sponsor militaire de référence"
    classes_avantage:
      - "Militaire"
      - "Dur à Cuire"
    avantages_sponsorises: |
      - Accès aux véhicules militaires exclusifs
  - nom: "Mishkin"
    description: "Sponsor technologique et électronique"
    classes_avantage:
      - "Technologie"
      - "Précision"
    avantages_sponsorises: |
      - Armes et améliorations électriques exclusives
`,
  'vehicules.yml': `
vehicules:
  - nom: "Voiture"
    poids: "Moyen"
    carrosserie: 10
    manoeuvrabilite: 3
    vitesse_max: 5
    equipage: 2
    emplacements: 2
    prix: 12
    description: "Véhicule standard polyvalent"
    regles: ""
    sponsors_autorises:
      - "Rutherford"
      - "Mishkin"
  - nom: "Hélicoptère"
    poids: "Lourd"
    carrosserie: 8
    manoeuvrabilite: 3
    vitesse_max: 4
    equipage: 3
    emplacements: 4
    prix: 30
    description: "Aéronef militaire exclusif"
    regles: |
      - Ignore les obstacles terrestres
    sponsors_autorises:
      - "Rutherford"
`,
  'armes.yml': `
armes:
  - nom: "Mitrailleuse"
    type: "base"
    prix: 2
    emplacement: 1
    description: "Arme automatique standard"
    regles: ""
    sponsors_autorises:
      - "Rutherford"
      - "Mishkin"
  - nom: "Canon à Arc Électrique"
    type: "avancée"
    prix: 6
    emplacement: 2
    description: "Arme électronique exclusive Mishkin"
    regles: |
      - Peut toucher plusieurs cibles en chaîne
    sponsors_autorises:
      - "Mishkin"
`,
  'amelioration.yml': `
ameliorations_vehicules:
  - nom: "Blindage"
    prix: 4
    emplacement: 1
    description: "Renforce la carrosserie de 2 points"
    regles: ""
    sponsors_autorises:
      - "Rutherford"
      - "Mishkin"
  - nom: "Tourelle"
    prix: "x3"
    emplacement: 0
    description: "Permet de tirer dans un arc de 360°"
    regles: |
      - Le coût est de 3× le prix de l'arme concernée
    sponsors_autorises:
      - "Rutherford"
      - "Mishkin"
`,
};

// ── Sous-classe de test (Pattern Template Method) ─────────────────────────────
//
// Au lieu de mocker le module Node `fs`, on étend CatalogService et on surcharge
// la méthode protégée readFileContent() pour retourner nos données de test.
// Cette technique est plus robuste et ne dépend pas du système de fichiers.
class TestCatalogService extends CatalogService {
  /**
   * Retourne le contenu YAML fictif correspondant au nom de fichier.
   * Remplace la lecture depuis le disque par des données en mémoire.
   */
  protected override readFileContent(filename: string): string {
    const content = MOCK_YAML[filename];
    if (!content) {
      throw new Error(`Fichier non défini dans les données de test : ${filename}`);
    }
    return content;
  }
}

// ── Suite de tests ────────────────────────────────────────────────────────────

describe('CatalogService', () => {
  let service: TestCatalogService;

  beforeEach(() => {
    // CatalogService n'a aucune dépendance NestJS injectée dans son constructeur
    // (pas de @InjectRepository, pas de ConfigService, etc.).
    // On peut donc l'instancier directement sans passer par Test.createTestingModule.
    // On instancie TestCatalogService qui surcharge readFileContent() pour
    // retourner nos données de test au lieu de lire les vrais fichiers.
    service = new TestCatalogService();
    // Appel explicite de onModuleInit() : c'est normalement fait par NestJS
    // au démarrage, ici on le fait manuellement pour initialiser les données.
    service.onModuleInit();
  });

  // ── Chargement des données ──────────────────────────────────────────────────

  describe('onModuleInit() — chargement des données', () => {
    it('charge le bon nombre de sponsors', () => {
      expect(service.getAllSponsors()).toHaveLength(2);
    });

    it('charge le bon nombre de véhicules', () => {
      expect(service.getAllVehicules()).toHaveLength(2);
    });

    it('charge le bon nombre d\'armes', () => {
      expect(service.getAllArmes()).toHaveLength(2);
    });

    it('charge le bon nombre d\'améliorations', () => {
      expect(service.getAllAmeliorations()).toHaveLength(2);
    });

    it('charge les noms des sponsors correctement', () => {
      const noms = service.getAllSponsors().map((s) => s.nom);
      expect(noms).toContain('Rutherford');
      expect(noms).toContain('Mishkin');
    });
  });

  // ── Relations pré-résolues : Rutherford ────────────────────────────────────

  describe('getSponsor("Rutherford") — relations pré-résolues', () => {
    it('retourne le sponsor Rutherford', () => {
      const rutherford = service.getSponsor('Rutherford');
      expect(rutherford).toBeDefined();
      expect(rutherford!.nom).toBe('Rutherford');
    });

    it('a accès à la Voiture (disponible pour tous)', () => {
      const rutherford = service.getSponsor('Rutherford');
      const noms = rutherford!.vehicules.map((v) => v.nom);
      expect(noms).toContain('Voiture');
    });

    it('a accès à l\'Hélicoptère (exclusif Rutherford)', () => {
      const rutherford = service.getSponsor('Rutherford');
      const noms = rutherford!.vehicules.map((v) => v.nom);
      expect(noms).toContain('Hélicoptère');
    });

    it('a exactement 2 véhicules (Voiture + Hélicoptère)', () => {
      const rutherford = service.getSponsor('Rutherford');
      expect(rutherford!.vehicules).toHaveLength(2);
    });

    it('a accès à la Mitrailleuse', () => {
      const rutherford = service.getSponsor('Rutherford');
      const noms = rutherford!.armes.map((a) => a.nom);
      expect(noms).toContain('Mitrailleuse');
    });

    it('n\'a PAS accès au Canon à Arc Électrique (exclusif Mishkin)', () => {
      const rutherford = service.getSponsor('Rutherford');
      const noms = rutherford!.armes.map((a) => a.nom);
      expect(noms).not.toContain('Canon à Arc Électrique');
    });

    it('a exactement 1 arme (Mitrailleuse)', () => {
      const rutherford = service.getSponsor('Rutherford');
      expect(rutherford!.armes).toHaveLength(1);
    });

    it('a accès aux 2 améliorations (Blindage + Tourelle)', () => {
      const rutherford = service.getSponsor('Rutherford');
      expect(rutherford!.ameliorations).toHaveLength(2);
    });
  });

  // ── Relations pré-résolues : Mishkin ───────────────────────────────────────

  describe('getSponsor("Mishkin") — relations pré-résolues', () => {
    it('retourne le sponsor Mishkin', () => {
      const mishkin = service.getSponsor('Mishkin');
      expect(mishkin).toBeDefined();
      expect(mishkin!.nom).toBe('Mishkin');
    });

    it('a accès à la Voiture (disponible pour tous)', () => {
      const mishkin = service.getSponsor('Mishkin');
      const noms = mishkin!.vehicules.map((v) => v.nom);
      expect(noms).toContain('Voiture');
    });

    it('n\'a PAS accès à l\'Hélicoptère (exclusif Rutherford)', () => {
      const mishkin = service.getSponsor('Mishkin');
      const noms = mishkin!.vehicules.map((v) => v.nom);
      expect(noms).not.toContain('Hélicoptère');
    });

    it('a exactement 1 véhicule (Voiture uniquement)', () => {
      const mishkin = service.getSponsor('Mishkin');
      expect(mishkin!.vehicules).toHaveLength(1);
    });

    it('a accès au Canon à Arc Électrique (exclusif Mishkin)', () => {
      const mishkin = service.getSponsor('Mishkin');
      const noms = mishkin!.armes.map((a) => a.nom);
      expect(noms).toContain('Canon à Arc Électrique');
    });

    it('a exactement 2 armes (Mitrailleuse + Canon Arc)', () => {
      const mishkin = service.getSponsor('Mishkin');
      expect(mishkin!.armes).toHaveLength(2);
    });
  });

  // ── Cas particuliers ────────────────────────────────────────────────────────

  describe('Cas particuliers', () => {
    it('retourne undefined pour un sponsor inexistant', () => {
      expect(service.getSponsor('SponsorFantome')).toBeUndefined();
    });

    it('préserve le prix "x3" (string) pour la Tourelle', () => {
      const rutherford = service.getSponsor('Rutherford');
      const tourelle = rutherford!.ameliorations.find(
        (a) => a.nom === 'Tourelle',
      );
      expect(tourelle).toBeDefined();
      // Le prix doit être la chaîne "x3", pas un nombre
      expect(tourelle!.prix).toBe('x3');
      expect(typeof tourelle!.prix).toBe('string');
    });

    it('le Blindage a un prix numérique (4 Jerricans)', () => {
      const rutherford = service.getSponsor('Rutherford');
      const blindage = rutherford!.ameliorations.find(
        (a) => a.nom === 'Blindage',
      );
      expect(blindage).toBeDefined();
      expect(blindage!.prix).toBe(4);
      expect(typeof blindage!.prix).toBe('number');
    });

    it('getAllSponsors() retourne les sponsors avec les relations résolues', () => {
      const sponsors = service.getAllSponsors();
      // Chaque sponsor dans la liste doit avoir ses relations pré-résolues
      for (const sponsor of sponsors) {
        expect(Array.isArray(sponsor.vehicules)).toBe(true);
        expect(Array.isArray(sponsor.armes)).toBe(true);
        expect(Array.isArray(sponsor.ameliorations)).toBe(true);
      }
    });
  });
});
