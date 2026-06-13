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
 * - Présence du champ nom_interne sur tous les items
 * - Variantes sponsor : Idris (Nitro demi-prix), Slime (Bélier sans slot),
 *   Scarlett (Membre d'Équipage demi-prix)
 * - Variantes Prison : La Geôlière a accès à "Voiture (Prison)" en plus de "Voiture"
 * - Items exclusifs : Mégaphone (La Patrouille), Micro-Blindage (Verney),
 *   Remorques (Rusty)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CatalogService } from './catalog.service';

// ── Données YAML fictives pour les tests ─────────────────────────────────────
//
// 9 sponsors sont représentés pour couvrir tous les comportements à tester :
//   - Rutherford : véhicule exclusif (Hélicoptère), armes standards
//   - Mishkin : arme exclusive (Canon à Arc Électrique), pas d'Hélicoptère
//   - Idris : variante Nitro à prix réduit (3 au lieu de 6)
//   - Slime : variante Bélier sans emplacement (0 au lieu de 1)
//   - Scarlett : variante Membre d'Équipage demi-prix (2 au lieu de 4)
//   - La Geôlière : accès à "Voiture" ET à "Voiture (Prison)"
//   - La Patrouille de l'Autoroute : amélioration exclusive "Mégaphone"
//   - Verney : amélioration exclusive "Micro-Blindage"
//   - Rusty et ses Trafiquants d'Alcool : 4 améliorations Remorque exclusives
//
// Règle de l'isolation : chaque item "variante" est exclusif à son sponsor
// (sponsors_autorises ne contient que le sponsor concerné), tandis que
// l'item "original" exclut ce même sponsor de sa liste.

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
  - nom: "Idris"
    description: "Culte de la vitesse et de la Nitro"
    classes_avantage:
      - "Rapidité"
      - "Précision"
    avantages_sponsorises: |
      - Nitro à moitié prix
  - nom: "Slime"
    description: "Éperonnage et collisions latérales"
    classes_avantage:
      - "Optimisation"
      - "Trompe-la-Mort"
    avantages_sponsorises: |
      - Bélier sans emplacement
  - nom: "Scarlett"
    description: "Pirate — équipage consommable"
    classes_avantage:
      - "Agression"
      - "Optimisation"
    avantages_sponsorises: |
      - Membre d'Équipage Supplémentaire à moitié prix
  - nom: "La Geôlière"
    description: "Voitures-Prison pour véhicules Moyen"
    classes_avantage:
      - "Agression"
      - "Dur à Cuire"
    avantages_sponsorises: |
      - Véhicules Prison disponibles
  - nom: "La Patrouille de l'Autoroute"
    description: "Traque d'un Bandit désigné"
    classes_avantage:
      - "Rapidité"
      - "Poursuite"
    avantages_sponsorises: |
      - Mégaphone exclusif
  - nom: "Verney"
    description: "Véhicules blindés et armes largables"
    classes_avantage:
      - "Technologie"
      - "Mécanique"
    avantages_sponsorises: |
      - Micro-Blindage exclusif
  - nom: "Rusty et ses Trafiquants d'Alcool"
    description: "Remorques et danger"
    classes_avantage:
      - "Trompe-la-Mort"
      - "Mécanique"
    avantages_sponsorises: |
      - Remorques exclusives
`,

  'vehicules.yml': `
vehicules:
  # Véhicule standard — accessible à tous les sponsors sauf La Geôlière
  # (La Geôlière a "Voiture" ET "Voiture (Prison)", on ne la liste pas ici
  # pour simplifier le test — dans les vraies données elle a bien les deux)
  - nom: "Voiture"
    nom_interne: "voiture"
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
      - "Idris"
      - "Slime"
      - "Scarlett"
      - "La Geôlière"
      - "La Patrouille de l'Autoroute"
      - "Verney"
      - "Rusty et ses Trafiquants d'Alcool"
  # Hélicoptère — exclusif Rutherford
  - nom: "Hélicoptère"
    nom_interne: "helicoptere"
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
  # Voiture (Prison) — exclusif La Geôlière : -2 carrosserie, -4 prix (min 5)
  - nom: "Voiture (Prison)"
    nom_interne: "voiture_prison"
    poids: "Moyen"
    carrosserie: 8
    manoeuvrabilite: 3
    vitesse_max: 5
    equipage: 2
    emplacements: 2
    prix: 8
    description: "Voiture modifiée pour le programme Prison"
    regles: |
      - **Option Prison** : maximum 1 véhicule Prison par équipe.
    sponsors_autorises:
      - "La Geôlière"
`,

  'armes.yml': `
armes:
  - nom: "Mitrailleuse"
    nom_interne: "mitrailleuse"
    type: "base"
    prix: 2
    emplacement: 1
    description: "Arme automatique standard"
    regles: ""
    sponsors_autorises:
      - "Rutherford"
      - "Mishkin"
      - "Idris"
      - "Slime"
      - "Scarlett"
      - "La Geôlière"
      - "La Patrouille de l'Autoroute"
      - "Verney"
      - "Rusty et ses Trafiquants d'Alcool"
  # Canon à Arc Électrique — exclusif Mishkin
  - nom: "Canon à Arc Électrique"
    nom_interne: "canon_arc_electrique"
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
  # Blindage — accessible à tous
  - nom: "Blindage"
    nom_interne: "blindage"
    prix: 4
    emplacement: 1
    description: "Renforce la carrosserie de 2 points"
    regles: ""
    sponsors_autorises:
      - "Rutherford"
      - "Mishkin"
      - "Idris"
      - "Slime"
      - "Scarlett"
      - "La Geôlière"
      - "La Patrouille de l'Autoroute"
      - "Verney"
      - "Rusty et ses Trafiquants d'Alcool"
  # Tourelle — prix "x3" (string), jamais un nombre
  - nom: "Tourelle"
    nom_interne: "tourelle"
    prix: "x3"
    emplacement: 0
    description: "Permet de tirer dans un arc de 360°"
    regles: |
      - Coût = 3× le prix de l'arme concernée. La Tourelle ne s'applique qu'aux armes.
    sponsors_autorises:
      - "Rutherford"
      - "Mishkin"
      - "Idris"
      - "Slime"
      - "Scarlett"
      - "La Geôlière"
      - "La Patrouille de l'Autoroute"
      - "Verney"
      - "Rusty et ses Trafiquants d'Alcool"
  # Nitro original — tous SAUF Idris (Idris a la variante Nitro (Idris))
  - nom: "Nitro"
    nom_interne: "nitro"
    prix: 6
    emplacement: 0
    description: "Accélération forcée"
    regles: ""
    sponsors_autorises:
      - "Rutherford"
      - "Mishkin"
      - "Slime"
      - "Scarlett"
      - "La Geôlière"
      - "La Patrouille de l'Autoroute"
      - "Verney"
      - "Rusty et ses Trafiquants d'Alcool"
  # Nitro (Idris) — variante Idris à moitié prix (3 au lieu de 6)
  - nom: "Nitro (Idris)"
    nom_interne: "nitro_idris"
    prix: 3
    emplacement: 0
    description: "Accélération forcée — tarif Idris"
    regles: ""
    sponsors_autorises:
      - "Idris"
  # Bélier original — tous SAUF Slime (Slime a la variante Bélier (Slime))
  - nom: "Bélier"
    nom_interne: "belier"
    prix: 4
    emplacement: 1
    description: "+2 dés en éperonnage"
    regles: ""
    sponsors_autorises:
      - "Rutherford"
      - "Mishkin"
      - "Idris"
      - "Scarlett"
      - "La Geôlière"
      - "La Patrouille de l'Autoroute"
      - "Verney"
      - "Rusty et ses Trafiquants d'Alcool"
  # Bélier (Slime) — variante Slime sans emplacement (0 au lieu de 1)
  - nom: "Bélier (Slime)"
    nom_interne: "belier_slime"
    prix: 4
    emplacement: 0
    description: "+2 dés en éperonnage — sans emplacement pour Slime"
    regles: ""
    sponsors_autorises:
      - "Slime"
  # Membre d'Équipage Supplémentaire original — tous SAUF Scarlett
  - nom: "Membre d'Équipage Supplémentaire"
    nom_interne: "membre_equipage_sup"
    prix: 4
    emplacement: 0
    description: "+1 équipier"
    regles: ""
    sponsors_autorises:
      - "Rutherford"
      - "Mishkin"
      - "Idris"
      - "Slime"
      - "La Geôlière"
      - "La Patrouille de l'Autoroute"
      - "Verney"
      - "Rusty et ses Trafiquants d'Alcool"
  # Membre d'Équipage Supplémentaire (Scarlett) — variante demi-prix
  - nom: "Membre d'Équipage Supplémentaire (Scarlett)"
    nom_interne: "membre_equipage_sup_scarlett"
    prix: 2
    emplacement: 0
    description: "+1 équipier — tarif Scarlett"
    regles: ""
    sponsors_autorises:
      - "Scarlett"
  # Mégaphone — exclusif La Patrouille de l'Autoroute
  - nom: "Mégaphone"
    nom_interne: "megaphone"
    prix: 2
    emplacement: 0
    description: "Applique Sirène à tout véhicule adverse"
    regles: ""
    sponsors_autorises:
      - "La Patrouille de l'Autoroute"
  # Micro-Blindage — exclusif Verney
  - nom: "Micro-Blindage"
    nom_interne: "micro_blindage"
    prix: 6
    emplacement: 0
    description: "+2 Carrosserie, aucun emplacement"
    regles: ""
    sponsors_autorises:
      - "Verney"
  # Remorque de Transport — exclusif Rusty (gratuite)
  - nom: "Remorque de Transport"
    nom_interne: "remorque_transport"
    prix: 0
    emplacement: 0
    description: "Remorque de base (gratuite)"
    regles: ""
    sponsors_autorises:
      - "Rusty et ses Trafiquants d'Alcool"
  # Remorque Légère — exclusif Rusty
  - nom: "Remorque Légère"
    nom_interne: "remorque_legere"
    prix: 4
    emplacement: 0
    description: "Remorque légère"
    regles: ""
    sponsors_autorises:
      - "Rusty et ses Trafiquants d'Alcool"
  # Remorque Moyenne — exclusif Rusty
  - nom: "Remorque Moyenne"
    nom_interne: "remorque_moyenne"
    prix: 8
    emplacement: 0
    description: "Remorque moyenne"
    regles: ""
    sponsors_autorises:
      - "Rusty et ses Trafiquants d'Alcool"
  # Remorque Lourde — exclusif Rusty
  - nom: "Remorque Lourde"
    nom_interne: "remorque_lourde"
    prix: 12
    emplacement: 0
    description: "Remorque lourde"
    regles: ""
    sponsors_autorises:
      - "Rusty et ses Trafiquants d'Alcool"
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
    it('charge le bon nombre de sponsors (9)', () => {
      expect(service.getAllSponsors()).toHaveLength(9);
    });

    it('charge le bon nombre de véhicules (3 : Voiture, Hélicoptère, Voiture Prison)', () => {
      // 2 véhicules de base + 1 variante Prison
      expect(service.getAllVehicules()).toHaveLength(3);
    });

    it('charge le bon nombre d\'armes (2)', () => {
      expect(service.getAllArmes()).toHaveLength(2);
    });

    it('charge le bon nombre d\'améliorations (14)', () => {
      // Blindage + Tourelle + Nitro + Nitro(Idris) + Bélier + Bélier(Slime) +
      // MembreEquipage + MembreEquipage(Scarlett) + Mégaphone + Micro-Blindage +
      // Remorque de Transport + Remorque Légère + Remorque Moyenne + Remorque Lourde
      // = 14 améliorations
      expect(service.getAllAmeliorations()).toHaveLength(14);
    });

    it('charge les noms des 9 sponsors correctement', () => {
      const noms = service.getAllSponsors().map((s) => s.nom);
      expect(noms).toContain('Rutherford');
      expect(noms).toContain('Mishkin');
      expect(noms).toContain('Idris');
      expect(noms).toContain('Slime');
      expect(noms).toContain('Scarlett');
      expect(noms).toContain('La Geôlière');
      expect(noms).toContain('La Patrouille de l\'Autoroute');
      expect(noms).toContain('Verney');
      expect(noms).toContain('Rusty et ses Trafiquants d\'Alcool');
    });
  });

  // ── nom_interne — présence du champ ────────────────────────────────────────

  describe('nom_interne — présence sur tous les items', () => {
    it('chaque véhicule a un champ nom_interne non vide', () => {
      for (const vehicule of service.getAllVehicules()) {
        expect(vehicule.nom_interne).toBeDefined();
        expect(vehicule.nom_interne.length).toBeGreaterThan(0);
      }
    });

    it('chaque arme a un champ nom_interne non vide', () => {
      for (const arme of service.getAllArmes()) {
        expect(arme.nom_interne).toBeDefined();
        expect(arme.nom_interne.length).toBeGreaterThan(0);
      }
    });

    it('chaque amélioration a un champ nom_interne non vide', () => {
      for (const amelioration of service.getAllAmeliorations()) {
        expect(amelioration.nom_interne).toBeDefined();
        expect(amelioration.nom_interne.length).toBeGreaterThan(0);
      }
    });

    it('les items de base ont un nom_interne en snake_case sans suffixe sponsor', () => {
      const voiture = service.getAllVehicules().find((v) => v.nom === 'Voiture');
      expect(voiture?.nom_interne).toBe('voiture');

      const nitro = service.getAllAmeliorations().find((a) => a.nom === 'Nitro');
      expect(nitro?.nom_interne).toBe('nitro');

      const belier = service.getAllAmeliorations().find((a) => a.nom === 'Bélier');
      expect(belier?.nom_interne).toBe('belier');
    });

    it('les variantes sponsor ont un nom_interne avec suffixe', () => {
      const nitroIdris = service.getAllAmeliorations().find(
        (a) => a.nom === 'Nitro (Idris)',
      );
      expect(nitroIdris?.nom_interne).toBe('nitro_idris');

      const belierSlime = service.getAllAmeliorations().find(
        (a) => a.nom === 'Bélier (Slime)',
      );
      expect(belierSlime?.nom_interne).toBe('belier_slime');

      const membreEquipageScarlett = service.getAllAmeliorations().find(
        (a) => a.nom === 'Membre d\'Équipage Supplémentaire (Scarlett)',
      );
      expect(membreEquipageScarlett?.nom_interne).toBe('membre_equipage_sup_scarlett');
    });

    it('la variante Prison a un nom_interne avec suffixe "_prison"', () => {
      const voiturePrison = service.getAllVehicules().find(
        (v) => v.nom === 'Voiture (Prison)',
      );
      expect(voiturePrison?.nom_interne).toBe('voiture_prison');
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

    it('a exactement 2 véhicules (Voiture + Hélicoptère, pas de Prison)', () => {
      const rutherford = service.getSponsor('Rutherford');
      expect(rutherford!.vehicules).toHaveLength(2);
    });

    it('n\'a PAS accès à "Voiture (Prison)" (La Geôlière uniquement)', () => {
      const rutherford = service.getSponsor('Rutherford');
      const noms = rutherford!.vehicules.map((v) => v.nom);
      expect(noms).not.toContain('Voiture (Prison)');
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

    it('a accès à "Nitro" (version standard, prix 6)', () => {
      const rutherford = service.getSponsor('Rutherford');
      const nitro = rutherford!.ameliorations.find((a) => a.nom === 'Nitro');
      expect(nitro).toBeDefined();
      expect(nitro!.prix).toBe(6);
    });

    it('n\'a PAS accès à "Nitro (Idris)" (variante Idris uniquement)', () => {
      const rutherford = service.getSponsor('Rutherford');
      const noms = rutherford!.ameliorations.map((a) => a.nom);
      expect(noms).not.toContain('Nitro (Idris)');
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

    it('n\'a PAS accès à "Nitro (Idris)" (variante Idris uniquement)', () => {
      const mishkin = service.getSponsor('Mishkin');
      const noms = mishkin!.ameliorations.map((a) => a.nom);
      expect(noms).not.toContain('Nitro (Idris)');
    });

    it('n\'a PAS accès à "Bélier (Slime)" (variante Slime uniquement)', () => {
      const mishkin = service.getSponsor('Mishkin');
      const noms = mishkin!.ameliorations.map((a) => a.nom);
      expect(noms).not.toContain('Bélier (Slime)');
    });
  });

  // ── Idris — variante Nitro demi-prix ───────────────────────────────────────

  describe('getSponsor("Idris") — variante Nitro demi-prix', () => {
    it('a accès à "Nitro (Idris)" avec prix 3', () => {
      const idris = service.getSponsor('Idris');
      const nitroIdris = idris!.ameliorations.find(
        (a) => a.nom === 'Nitro (Idris)',
      );
      expect(nitroIdris).toBeDefined();
      expect(nitroIdris!.prix).toBe(3);
    });

    it('n\'a PAS accès à "Nitro" à prix 6 (version sans remise)', () => {
      const idris = service.getSponsor('Idris');
      const nitroBase = idris!.ameliorations.find((a) => a.nom === 'Nitro');
      // L'item "Nitro" (prix 6) est hors liste pour Idris
      expect(nitroBase).toBeUndefined();
    });

    it('nom_interne de la variante Nitro Idris est "nitro_idris"', () => {
      const idris = service.getSponsor('Idris');
      const nitroIdris = idris!.ameliorations.find(
        (a) => a.nom === 'Nitro (Idris)',
      );
      expect(nitroIdris!.nom_interne).toBe('nitro_idris');
    });
  });

  // ── Slime — variante Bélier sans slot ──────────────────────────────────────

  describe('getSponsor("Slime") — variante Bélier sans emplacement', () => {
    it('a accès à "Bélier (Slime)" avec emplacement 0', () => {
      const slime = service.getSponsor('Slime');
      const belierSlime = slime!.ameliorations.find(
        (a) => a.nom === 'Bélier (Slime)',
      );
      expect(belierSlime).toBeDefined();
      expect(belierSlime!.emplacement).toBe(0);
    });

    it('n\'a PAS accès à "Bélier" avec emplacement 1 (version standard)', () => {
      const slime = service.getSponsor('Slime');
      const belierBase = slime!.ameliorations.find((a) => a.nom === 'Bélier');
      expect(belierBase).toBeUndefined();
    });

    it('nom_interne de la variante Bélier Slime est "belier_slime"', () => {
      const slime = service.getSponsor('Slime');
      const belierSlime = slime!.ameliorations.find(
        (a) => a.nom === 'Bélier (Slime)',
      );
      expect(belierSlime!.nom_interne).toBe('belier_slime');
    });
  });

  // ── Scarlett — variante Membre d'Équipage demi-prix ───────────────────────

  describe('getSponsor("Scarlett") — variante Membre d\'Équipage demi-prix', () => {
    it('a accès à "Membre d\'Équipage Supplémentaire (Scarlett)" avec prix 2', () => {
      const scarlett = service.getSponsor('Scarlett');
      const membreScarlett = scarlett!.ameliorations.find(
        (a) => a.nom === 'Membre d\'Équipage Supplémentaire (Scarlett)',
      );
      expect(membreScarlett).toBeDefined();
      expect(membreScarlett!.prix).toBe(2);
    });

    it('n\'a PAS accès au "Membre d\'Équipage Supplémentaire" à prix 4', () => {
      const scarlett = service.getSponsor('Scarlett');
      const membreBase = scarlett!.ameliorations.find(
        (a) => a.nom === 'Membre d\'Équipage Supplémentaire',
      );
      expect(membreBase).toBeUndefined();
    });

    it('nom_interne de la variante Scarlett est "membre_equipage_sup_scarlett"', () => {
      const scarlett = service.getSponsor('Scarlett');
      const membreScarlett = scarlett!.ameliorations.find(
        (a) => a.nom === 'Membre d\'Équipage Supplémentaire (Scarlett)',
      );
      expect(membreScarlett!.nom_interne).toBe('membre_equipage_sup_scarlett');
    });
  });

  // ── La Geôlière — variantes Voiture-Prison ─────────────────────────────────

  describe('getSponsor("La Geôlière") — variantes Voiture-Prison', () => {
    it('a accès à la "Voiture" standard', () => {
      const geoliere = service.getSponsor('La Geôlière');
      const noms = geoliere!.vehicules.map((v) => v.nom);
      expect(noms).toContain('Voiture');
    });

    it('a accès à "Voiture (Prison)" en plus de la Voiture standard (deux choix)', () => {
      const geoliere = service.getSponsor('La Geôlière');
      const noms = geoliere!.vehicules.map((v) => v.nom);
      expect(noms).toContain('Voiture (Prison)');
    });

    it('a exactement 2 véhicules (Voiture + Voiture Prison)', () => {
      const geoliere = service.getSponsor('La Geôlière');
      expect(geoliere!.vehicules).toHaveLength(2);
    });

    it('"Voiture (Prison)" a une carrosserie de 8 (soit -2 par rapport à Voiture)', () => {
      const geoliere = service.getSponsor('La Geôlière');
      const voiturePrison = geoliere!.vehicules.find(
        (v) => v.nom === 'Voiture (Prison)',
      );
      expect(voiturePrison!.carrosserie).toBe(8);
    });

    it('"Voiture (Prison)" a un prix de 8 (soit -4 par rapport à Voiture)', () => {
      const geoliere = service.getSponsor('La Geôlière');
      const voiturePrison = geoliere!.vehicules.find(
        (v) => v.nom === 'Voiture (Prison)',
      );
      expect(voiturePrison!.prix).toBe(8);
    });

    it('"Voiture (Prison)" a le nom_interne "voiture_prison"', () => {
      const geoliere = service.getSponsor('La Geôlière');
      const voiturePrison = geoliere!.vehicules.find(
        (v) => v.nom === 'Voiture (Prison)',
      );
      expect(voiturePrison!.nom_interne).toBe('voiture_prison');
    });

    it('Rutherford n\'a PAS accès à "Voiture (Prison)"', () => {
      const rutherford = service.getSponsor('Rutherford');
      const noms = rutherford!.vehicules.map((v) => v.nom);
      expect(noms).not.toContain('Voiture (Prison)');
    });

    it('Mishkin n\'a PAS accès à "Voiture (Prison)"', () => {
      const mishkin = service.getSponsor('Mishkin');
      const noms = mishkin!.vehicules.map((v) => v.nom);
      expect(noms).not.toContain('Voiture (Prison)');
    });
  });

  // ── La Patrouille de l'Autoroute — Mégaphone exclusif ─────────────────────

  describe('getSponsor("La Patrouille de l\'Autoroute") — Mégaphone exclusif', () => {
    it('a accès à "Mégaphone" (prix 2, emplacement 0)', () => {
      const patrouille = service.getSponsor('La Patrouille de l\'Autoroute');
      const megaphone = patrouille!.ameliorations.find(
        (a) => a.nom === 'Mégaphone',
      );
      expect(megaphone).toBeDefined();
      expect(megaphone!.prix).toBe(2);
      expect(megaphone!.emplacement).toBe(0);
    });

    it('"Mégaphone" a le nom_interne "megaphone"', () => {
      const patrouille = service.getSponsor('La Patrouille de l\'Autoroute');
      const megaphone = patrouille!.ameliorations.find(
        (a) => a.nom === 'Mégaphone',
      );
      expect(megaphone!.nom_interne).toBe('megaphone');
    });

    it('Rutherford n\'a PAS accès à "Mégaphone"', () => {
      const rutherford = service.getSponsor('Rutherford');
      const noms = rutherford!.ameliorations.map((a) => a.nom);
      expect(noms).not.toContain('Mégaphone');
    });

    it('Mishkin n\'a PAS accès à "Mégaphone"', () => {
      const mishkin = service.getSponsor('Mishkin');
      const noms = mishkin!.ameliorations.map((a) => a.nom);
      expect(noms).not.toContain('Mégaphone');
    });
  });

  // ── Verney — Micro-Blindage exclusif ───────────────────────────────────────

  describe('getSponsor("Verney") — Micro-Blindage exclusif', () => {
    it('a accès à "Micro-Blindage" (prix 6, emplacement 0)', () => {
      const verney = service.getSponsor('Verney');
      const microBlindage = verney!.ameliorations.find(
        (a) => a.nom === 'Micro-Blindage',
      );
      expect(microBlindage).toBeDefined();
      expect(microBlindage!.prix).toBe(6);
      expect(microBlindage!.emplacement).toBe(0);
    });

    it('"Micro-Blindage" a le nom_interne "micro_blindage"', () => {
      const verney = service.getSponsor('Verney');
      const microBlindage = verney!.ameliorations.find(
        (a) => a.nom === 'Micro-Blindage',
      );
      expect(microBlindage!.nom_interne).toBe('micro_blindage');
    });

    it('Rutherford n\'a PAS accès à "Micro-Blindage"', () => {
      const rutherford = service.getSponsor('Rutherford');
      const noms = rutherford!.ameliorations.map((a) => a.nom);
      expect(noms).not.toContain('Micro-Blindage');
    });

    it('Idris n\'a PAS accès à "Micro-Blindage"', () => {
      const idris = service.getSponsor('Idris');
      const noms = idris!.ameliorations.map((a) => a.nom);
      expect(noms).not.toContain('Micro-Blindage');
    });
  });

  // ── Rusty — Remorques exclusives ───────────────────────────────────────────

  describe('getSponsor("Rusty et ses Trafiquants d\'Alcool") — Remorques exclusives', () => {
    it('a accès à "Remorque de Transport" (prix 0)', () => {
      const rusty = service.getSponsor('Rusty et ses Trafiquants d\'Alcool');
      const remorque = rusty!.ameliorations.find(
        (a) => a.nom === 'Remorque de Transport',
      );
      expect(remorque).toBeDefined();
      expect(remorque!.prix).toBe(0);
    });

    it('a accès à "Remorque Légère" (prix 4)', () => {
      const rusty = service.getSponsor('Rusty et ses Trafiquants d\'Alcool');
      const remorque = rusty!.ameliorations.find(
        (a) => a.nom === 'Remorque Légère',
      );
      expect(remorque).toBeDefined();
      expect(remorque!.prix).toBe(4);
    });

    it('a accès à "Remorque Moyenne" (prix 8)', () => {
      const rusty = service.getSponsor('Rusty et ses Trafiquants d\'Alcool');
      const remorque = rusty!.ameliorations.find(
        (a) => a.nom === 'Remorque Moyenne',
      );
      expect(remorque).toBeDefined();
      expect(remorque!.prix).toBe(8);
    });

    it('a accès à "Remorque Lourde" (prix 12)', () => {
      const rusty = service.getSponsor('Rusty et ses Trafiquants d\'Alcool');
      const remorque = rusty!.ameliorations.find(
        (a) => a.nom === 'Remorque Lourde',
      );
      expect(remorque).toBeDefined();
      expect(remorque!.prix).toBe(12);
    });

    it('les 4 Remorques ont des nom_interne corrects', () => {
      const rusty = service.getSponsor('Rusty et ses Trafiquants d\'Alcool');
      const amelNoms = rusty!.ameliorations.reduce<Record<string, string>>(
        (acc, a) => ({ ...acc, [a.nom]: a.nom_interne }),
        {},
      );
      expect(amelNoms['Remorque de Transport']).toBe('remorque_transport');
      expect(amelNoms['Remorque Légère']).toBe('remorque_legere');
      expect(amelNoms['Remorque Moyenne']).toBe('remorque_moyenne');
      expect(amelNoms['Remorque Lourde']).toBe('remorque_lourde');
    });

    it('Rutherford n\'a PAS accès aux Remorques', () => {
      const rutherford = service.getSponsor('Rutherford');
      const noms = rutherford!.ameliorations.map((a) => a.nom);
      expect(noms).not.toContain('Remorque de Transport');
      expect(noms).not.toContain('Remorque Légère');
      expect(noms).not.toContain('Remorque Moyenne');
      expect(noms).not.toContain('Remorque Lourde');
    });

    it('Mishkin n\'a PAS accès aux Remorques', () => {
      const mishkin = service.getSponsor('Mishkin');
      const noms = mishkin!.ameliorations.map((a) => a.nom);
      expect(noms).not.toContain('Remorque de Transport');
      expect(noms).not.toContain('Remorque Lourde');
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

  // ── Conversion Markdown → HTML (description/regles) ────────────────────────

  describe('description/regles — conversion Markdown → HTML au chargement', () => {
    it('convertit la description d\'un sponsor en HTML (<p>...)', () => {
      const rutherford = service.getSponsor('Rutherford');
      expect(rutherford!.description).toContain('<p>Sponsor militaire de référence</p>');
    });

    it('convertit la description d\'un véhicule en HTML (<p>...)', () => {
      const voiture = service.getAllVehicules().find((v) => v.nom === 'Voiture');
      expect(voiture!.description).toContain('<p>Véhicule standard polyvalent</p>');
    });

    it('convertit des règles multi-lignes (liste Markdown) en <ul><li>', () => {
      const helicoptere = service.getAllVehicules().find((v) => v.nom === 'Hélicoptère');
      expect(helicoptere!.regles).toContain('<ul>');
      expect(helicoptere!.regles).toContain('<li>Ignore les obstacles terrestres</li>');
    });

    it('convertit la description/regles d\'une arme en HTML', () => {
      const mitrailleuse = service.getAllArmes().find((a) => a.nom === 'Mitrailleuse');
      expect(mitrailleuse!.description).toContain('<p>Arme automatique standard</p>');
    });

    it('convertit la description/regles d\'une amélioration en HTML', () => {
      const blindage = service.getAllAmeliorations().find((a) => a.nom === 'Blindage');
      expect(blindage!.description).toContain('<p>Renforce la carrosserie de 2 points</p>');
    });

    it('un champ `regles` vide ("") reste une chaîne vide après conversion', () => {
      const mitrailleuse = service.getAllArmes().find((a) => a.nom === 'Mitrailleuse');
      expect(mitrailleuse!.regles).toBe('');
    });
  });
});
