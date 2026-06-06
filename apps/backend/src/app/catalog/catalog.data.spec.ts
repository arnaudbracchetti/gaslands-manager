/**
 * Tests d'intégrité des données du catalogue YAML.
 *
 * ⚠️  Ce fichier est différent des autres specs : il utilise le VRAI CatalogService,
 * qui lit les vrais fichiers database_init/data/*.yml sur le disque.
 * Il n'y a PAS de mock ici — c'est intentionnel.
 *
 * Objectif : détecter les problèmes dans les fichiers de données AVANT que le
 * serveur ne tente de démarrer. Ces tests auraient attrapé l'erreur YAML
 * "A block sequence may not be used as an implicit map key" causée par un
 * commentaire mal indenté à l'intérieur d'un bloc scalaire `|`.
 *
 * Règle importante sur les blocs scalaires YAML (`|`) :
 *   Dans un bloc `|`, TOUT est contenu littéral — il n'y a pas de commentaires.
 *   Un `#` à l'intérieur d'un `|` est du texte, pas un commentaire YAML.
 *   Les commentaires `#` ne sont valides QUE sur la même ligne que la clé,
 *   ou en dehors du bloc scalaire (avant la clé, au niveau de l'indentation YAML).
 *
 * Cas testés :
 * - Les 4 fichiers YAML sont parseable sans erreur
 * - Tous les véhicules, armes et améliorations ont le champ `nom_interne`
 * - Aucun doublon de `nom_interne` au sein d'une même catégorie
 * - Tous les `sponsors_autorises` référencent des noms de sponsors existants
 * - Chaque sponsor du catalogue a au moins un véhicule et une amélioration
 * - Comptes d'items cohérents avec les spécifications du jeu
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CatalogService } from './catalog.service';
import type { Sponsor, Vehicule, Arme, Amelioration } from './catalog.interfaces';

// ── Sous-classe avec chemin absolu vers les vrais fichiers ─────────────────────
//
// Problème : quand `nx test` s'exécute, process.cwd() retourne le répertoire
// du projet (apps/backend/) et non la racine du workspace. Or CatalogService
// utilise process.cwd() dans readFileContent(), ce qui fonctionne en production
// (où cwd = racine du workspace) mais pas en test.
//
// Solution : Pattern Template Method — on surcharge readFileContent() pour
// construire le chemin depuis __dirname (emplacement de ce fichier .ts),
// qui est stable quel que soit le répertoire de travail courant.
//
// __dirname = apps/backend/src/app/catalog/
// → 5 niveaux up → racine du workspace
class RealCatalogService extends CatalogService {
  protected override readFileContent(filename: string): string {
    const filePath = path.resolve(
      __dirname,            // apps/backend/src/app/catalog/
      '../../../../../',    // → racine du workspace (gaslands/)
      'database_init',
      'data',
      filename,
    );
    return fs.readFileSync(filePath, 'utf-8');
  }
}

// ── Chargement unique des données réelles ─────────────────────────────────────
//
// On instancie RealCatalogService, qui lit les vrais fichiers database_init/data/*.yml.
// Si les YAML sont invalides, onModuleInit() lancera une exception et
// beforeAll échouera — ce qui est le comportement souhaité.

let service: RealCatalogService;
let sponsors: Sponsor[];
let vehicules: Vehicule[];
let armes: Arme[];
let ameliorations: Amelioration[];
let sponsorNoms: Set<string>;

beforeAll(() => {
  // Si un fichier YAML est invalide (syntaxe incorrecte, champ manquant, etc.),
  // cette ligne lève une exception et TOUS les tests de ce fichier échouent
  // avec un message d'erreur clair pointant vers le problème.
  service = new RealCatalogService();
  service.onModuleInit();

  sponsors = service.getAllSponsors();
  vehicules = service.getAllVehicules();
  armes = service.getAllArmes();
  ameliorations = service.getAllAmeliorations();

  // Ensemble des noms de sponsors pour vérifier les références croisées
  sponsorNoms = new Set(sponsors.map((s) => s.nom));
});

// ── 1. Validité YAML et chargement ────────────────────────────────────────────

describe('Validité YAML — chargement sans erreur', () => {
  it('charge les 13 sponsors (le parse de sponsors.yml a réussi)', () => {
    // Si sponsors.yml est invalide, onModuleInit() aurait lancé une exception
    // et ce test n'aurait jamais été atteint. Le compte de 13 est vérifié ici
    // pour détecter les ajouts/suppressions accidentels.
    expect(sponsors).toHaveLength(13);
  });

  it('charge les 22 véhicules (16 de base + 6 variantes Prison)', () => {
    expect(vehicules).toHaveLength(22);
  });

  it('charge au moins 38 armes (le parse de armes.yml a réussi)', () => {
    // Le catalogue contient 41 armes selon les spécifications. On vérifie ici
    // un minimum pour détecter toute suppression accidentelle.
    expect(armes.length).toBeGreaterThanOrEqual(38);
  });

  it('charge les améliorations (le parse de amelioration.yml a réussi)', () => {
    // 11 de base + 3 variantes sponsor (Idris/Slime/Scarlett) + 6 exclusives
    // (Mégaphone, Micro-Blindage, 4 Remorques) = 20 améliorations
    expect(ameliorations).toHaveLength(20);
  });

  it('tous les sponsors ont un nom non vide', () => {
    for (const sponsor of sponsors) {
      expect(sponsor.nom, `Un sponsor a un nom vide`).toBeTruthy();
    }
  });
});

// ── 2. Champ nom_interne — présence sur tous les items ────────────────────────

describe('nom_interne — présence et format', () => {
  it('tous les véhicules ont un nom_interne non vide', () => {
    for (const v of vehicules) {
      expect(
        v.nom_interne,
        `Le véhicule "${v.nom}" n'a pas de nom_interne`,
      ).toBeTruthy();
    }
  });

  it('toutes les armes ont un nom_interne non vide', () => {
    for (const a of armes) {
      expect(
        a.nom_interne,
        `L'arme "${a.nom}" n'a pas de nom_interne`,
      ).toBeTruthy();
    }
  });

  it('toutes les améliorations ont un nom_interne non vide', () => {
    for (const a of ameliorations) {
      expect(
        a.nom_interne,
        `L'amélioration "${a.nom}" n'a pas de nom_interne`,
      ).toBeTruthy();
    }
  });

  it('les nom_interne ne contiennent pas d\'espaces (snake_case)', () => {
    const tous = [
      ...vehicules.map((v) => ({ nom: v.nom, nom_interne: v.nom_interne })),
      ...armes.map((a) => ({ nom: a.nom, nom_interne: a.nom_interne })),
      ...ameliorations.map((a) => ({ nom: a.nom, nom_interne: a.nom_interne })),
    ];
    for (const item of tous) {
      expect(
        item.nom_interne,
        `"${item.nom}" : le nom_interne "${item.nom_interne}" contient des espaces`,
      ).not.toMatch(/\s/);
    }
  });
});

// ── 3. Unicité des nom_interne ────────────────────────────────────────────────

describe('nom_interne — unicité dans chaque catégorie', () => {
  it('aucun doublon de nom_interne parmi les véhicules', () => {
    const noms = vehicules.map((v) => v.nom_interne);
    const doublons = noms.filter((n, i) => noms.indexOf(n) !== i);
    expect(doublons, `Doublons détectés : ${doublons.join(', ')}`).toHaveLength(0);
  });

  it('aucun doublon de nom_interne parmi les armes', () => {
    const noms = armes.map((a) => a.nom_interne);
    const doublons = noms.filter((n, i) => noms.indexOf(n) !== i);
    expect(doublons, `Doublons détectés : ${doublons.join(', ')}`).toHaveLength(0);
  });

  it('aucun doublon de nom_interne parmi les améliorations', () => {
    const noms = ameliorations.map((a) => a.nom_interne);
    const doublons = noms.filter((n, i) => noms.indexOf(n) !== i);
    expect(doublons, `Doublons détectés : ${doublons.join(', ')}`).toHaveLength(0);
  });
});

// ── 4. Cohérence des références croisées ─────────────────────────────────────

describe('sponsors_autorises — références vers des sponsors existants', () => {
  it('tous les sponsors_autorises des véhicules référencent des sponsors existants', () => {
    for (const v of vehicules) {
      for (const sponsorNom of v.sponsors_autorises) {
        expect(
          sponsorNoms.has(sponsorNom),
          `Véhicule "${v.nom}" : sponsors_autorises contient "${sponsorNom}" qui n'existe pas`,
        ).toBe(true);
      }
    }
  });

  it('tous les sponsors_autorises des armes référencent des sponsors existants', () => {
    for (const a of armes) {
      for (const sponsorNom of a.sponsors_autorises) {
        expect(
          sponsorNoms.has(sponsorNom),
          `Arme "${a.nom}" : sponsors_autorises contient "${sponsorNom}" qui n'existe pas`,
        ).toBe(true);
      }
    }
  });

  it('tous les sponsors_autorises des améliorations référencent des sponsors existants', () => {
    for (const a of ameliorations) {
      for (const sponsorNom of a.sponsors_autorises) {
        expect(
          sponsorNoms.has(sponsorNom),
          `Amélioration "${a.nom}" : sponsors_autorises contient "${sponsorNom}" qui n'existe pas`,
        ).toBe(true);
      }
    }
  });

  it('chaque item a au moins un sponsor autorisé', () => {
    for (const v of vehicules) {
      expect(
        v.sponsors_autorises.length,
        `Véhicule "${v.nom}" n'a aucun sponsor autorisé`,
      ).toBeGreaterThan(0);
    }
    for (const a of armes) {
      expect(
        a.sponsors_autorises.length,
        `Arme "${a.nom}" n'a aucun sponsor autorisé`,
      ).toBeGreaterThan(0);
    }
    for (const a of ameliorations) {
      expect(
        a.sponsors_autorises.length,
        `Amélioration "${a.nom}" n'a aucun sponsor autorisé`,
      ).toBeGreaterThan(0);
    }
  });
});

// ── 5. Cohérence des relations sponsor ────────────────────────────────────────

describe('Relations sponsor — cohérence des données résolues', () => {
  it('chaque sponsor a au moins un véhicule', () => {
    for (const sponsor of sponsors) {
      expect(
        sponsor.vehicules.length,
        `Le sponsor "${sponsor.nom}" n'a aucun véhicule`,
      ).toBeGreaterThan(0);
    }
  });

  it('chaque sponsor a au moins une arme', () => {
    for (const sponsor of sponsors) {
      expect(
        sponsor.armes.length,
        `Le sponsor "${sponsor.nom}" n'a aucune arme`,
      ).toBeGreaterThan(0);
    }
  });

  it('chaque sponsor a au moins une amélioration', () => {
    for (const sponsor of sponsors) {
      expect(
        sponsor.ameliorations.length,
        `Le sponsor "${sponsor.nom}" n'a aucune amélioration`,
      ).toBeGreaterThan(0);
    }
  });

  it('Rutherford n\'a pas accès aux véhicules Léger (contrainte métier)', () => {
    const rutherford = service.getSponsor('Rutherford');
    const vehiculesLegers = rutherford!.vehicules.filter(
      (v) => v.poids === 'Léger',
    );
    expect(
      vehiculesLegers,
      `Rutherford ne devrait pas avoir de véhicule Léger`,
    ).toHaveLength(0);
  });

  it('Miyazaki n\'a pas accès aux véhicules avec manoeuvrabilite < 3', () => {
    const miyazaki = service.getSponsor('Miyazaki');
    const vehiculesTropLents = miyazaki!.vehicules.filter(
      (v) => v.manoeuvrabilite < 3,
    );
    expect(
      vehiculesTropLents,
      `Miyazaki ne devrait pas avoir de véhicule avec manoeuvrabilite < 3`,
    ).toHaveLength(0);
  });

  it('Idris n\'a pas accès au Gyrocoptère (contrainte métier)', () => {
    const idris = service.getSponsor('Idris');
    const gyrocoptere = idris!.vehicules.find((v) => v.nom === 'Gyrocoptère');
    expect(gyrocoptere).toBeUndefined();
  });

  it('Rutherford a accès à l\'Hélicoptère (exclusif Rutherford)', () => {
    const rutherford = service.getSponsor('Rutherford');
    const helicoptere = rutherford!.vehicules.find(
      (v) => v.nom === 'Hélicoptère',
    );
    expect(helicoptere).toBeDefined();
  });

  it('La Geôlière a accès aux variantes Prison (au moins 6)', () => {
    const geoliere = service.getSponsor('La Geôlière');
    const variablesPrison = geoliere!.vehicules.filter((v) =>
      v.nom_interne.endsWith('_prison'),
    );
    expect(variablesPrison.length).toBeGreaterThanOrEqual(6);
  });

  it('Idris voit "Nitro (Idris)" et PAS "Nitro" (isolation des variantes)', () => {
    const idris = service.getSponsor('Idris');
    const amelNoms = idris!.ameliorations.map((a) => a.nom);
    expect(amelNoms).toContain('Nitro (Idris)');
    expect(amelNoms).not.toContain('Nitro');
  });

  it('Rutherford voit "Nitro" et PAS "Nitro (Idris)"', () => {
    const rutherford = service.getSponsor('Rutherford');
    const amelNoms = rutherford!.ameliorations.map((a) => a.nom);
    expect(amelNoms).toContain('Nitro');
    expect(amelNoms).not.toContain('Nitro (Idris)');
  });
});
