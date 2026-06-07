/**
 * Tests unitaires pour les décorateurs SPÉCIFIQUES (`improvement-decorators.ts`) —
 * un bloc `describe` par règle métier, chacune testée scénario par scénario.
 *
 * Couverture volontairement explicite des cas "première pose" pour les décorateurs
 * à restriction (Chenilles, Bélier Explosif...) : ce sont précisément les cas que le
 * bug structurel corrigé (cf. plan d'architecture) aurait laissés passer — aucune
 * instance préalable du décorateur n'existait dans la chaîne pour intercepter le
 * contrôle. Ici, le candidat fait partie intégrante de la chaîne validée : son
 * `validateSelf` s'exécute systématiquement, dès le tout premier exemplaire.
 *
 * Et, scénario contre-intuitif délibérément couvert : la compatibilité confirmée
 * entre Bélier et Bélier Explosif sur la MÊME orientation (cf. Ajustement n°2 du
 * plan — correction d'une fausse hypothèse de conception initiale, à la lecture
 * attentive du texte des règles dans `amelioration.yml`).
 */

import { describe, it, expect } from 'vitest';
import type { Amelioration, Vehicule } from '../catalog/catalog.interfaces';
import {
  CatalogVehicleBuild,
  ok,
  fail,
  type DecoratorCtor,
  type InstalledImprovement,
  type Orientation,
  type VehicleBuild,
} from './vehicle-build';
import {
  BelierDecorator,
  BelierExplosifDecorator,
  BlindageDecorator,
  ChenillesDecorator,
  EquipementMishkinDecorator,
  MembreEquipageDecorator,
} from './improvement-decorators';

// ── Fixtures véhicules ────────────────────────────────────────────────────────

const monsterTruck: Vehicule = {
  nom: 'Monster Truck',
  nom_interne: 'monster_truck',
  poids: 'Lourd',
  carrosserie: 14,
  manoeuvrabilite: 1,
  vitesse_max: 6,
  equipage: 2,
  emplacements: 6,
  prix: 28,
  description: 'Un poids lourd écrasant',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

/** nom_interne EXACT requis par `ChenillesDecorator.VEHICULES_INCOMPATIBLES`. */
const charAssaut: Vehicule = {
  ...monsterTruck,
  nom: "Char d'Assaut",
  nom_interne: 'char_assaut',
};

/** Poids Léger — sert à tester l'interdiction du Bélier Explosif. */
const buggy: Vehicule = {
  ...monsterTruck,
  nom: 'Buggy',
  nom_interne: 'buggy',
  poids: 'Léger',
};

// ── Fixtures améliorations — une par `comportement` testé ────────────────────

const chenilles: Amelioration = {
  nom: 'Chenilles',
  nom_interne: 'chenilles',
  comportement: 'chenilles',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const membreEquipage: Amelioration = {
  nom: "Membre d'Équipage Supplémentaire",
  nom_interne: 'membre_equipage_sup',
  comportement: 'membre_equipage',
  prix: 4,
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const belier: Amelioration = {
  nom: 'Bélier',
  nom_interne: 'belier',
  comportement: 'belier',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

/** Variante sponsor : `nom_interne` distinct, mais MÊME `comportement` que `belier`. */
const belierSlime: Amelioration = {
  nom: 'Bélier (Slime)',
  nom_interne: 'belier_slime',
  comportement: 'belier',
  prix: 4,
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Slime'],
};

const belierExplosif: Amelioration = {
  nom: 'Bélier Explosif',
  nom_interne: 'belier_explosif',
  comportement: 'belier_explosif',
  prix: 3,
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const blindage: Amelioration = {
  nom: 'Blindage',
  nom_interne: 'blindage',
  comportement: 'blindage',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const reacteurNucleaire: Amelioration = {
  nom: 'Réacteur Nucléaire Expérimental',
  nom_interne: 'reacteur_nucleaire',
  comportement: 'mishkin_exclusif',
  prix: 5,
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Mishkin'],
};

/** Partage `comportement: "mishkin_exclusif"` avec `reacteurNucleaire` — même classe attendue. */
const teleporteur: Amelioration = {
  nom: 'Téléporteur Expérimental',
  nom_interne: 'teleporteur',
  comportement: 'mishkin_exclusif',
  prix: 7,
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Mishkin'],
};

// ── Aides de construction ─────────────────────────────────────────────────────

/** Construit l'`InstalledImprovement` correspondant à une amélioration (orientation optionnelle). */
function installee(amelioration: Amelioration, orientation?: Orientation): InstalledImprovement {
  return { nom_interne: amelioration.nom_interne, orientation };
}

/**
 * Empile une suite de couches déjà POSÉES (légitimes) sur un véhicule de base, et
 * renvoie le sommet — sert à préparer le contexte "chaîne actuelle" avant d'y
 * enrouler le CANDIDAT qu'on souhaite tester (toujours construit séparément, juste
 * avant l'appel à `validate()`, pour rester fidèle au flux réel "envelopper PUIS valider").
 */
function empiler(
  vehicule: Vehicule,
  couches: ReadonlyArray<{ Decorateur: DecoratorCtor; amelioration: Amelioration; orientation?: Orientation }>,
): VehicleBuild {
  let build: VehicleBuild = new CatalogVehicleBuild(vehicule);
  for (const { Decorateur, amelioration, orientation } of couches) {
    build = new Decorateur(build, amelioration, installee(amelioration, orientation));
  }
  return build;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Décorateurs spécifiques — une règle métier par classe', () => {
  describe('ChenillesDecorator — -1 vitesse_max / +1 manœuvrabilité, unique, incompatibilités', () => {
    it('modifie le profil : -1 vitesse_max, +1 manœuvrabilité', () => {
      const base = new CatalogVehicleBuild(monsterTruck);
      const build = new ChenillesDecorator(base, chenilles, installee(chenilles));

      expect(build.stats.vitesse_max).toBe(monsterTruck.vitesse_max - 1);
      expect(build.stats.manoeuvrabilite).toBe(monsterTruck.manoeuvrabilite + 1);
    });

    it('refuse la TOUTE PREMIÈRE pose sur un véhicule incompatible — exactement le cas que le bug aurait laissé passer', () => {
      const base = new CatalogVehicleBuild(charAssaut);
      const candidat = new ChenillesDecorator(base, chenilles, installee(chenilles));

      // Aucune Chenille n'existait avant cet appel : avec l'ancienne mécanique
      // ("interroger la chaîne actuelle"), rien n'aurait porté ce contrôle. Ici, le
      // candidat fait partie de la chaîne EXAMINÉE — son `validateSelf` s'exécute
      // donc inconditionnellement, dès le premier exemplaire.
      expect(candidat.validate()).toEqual(fail('Chenilles incompatibles avec ce véhicule'));
    });

    it('accepte la première pose sur un véhicule compatible', () => {
      const base = new CatalogVehicleBuild(monsterTruck);
      const candidat = new ChenillesDecorator(base, chenilles, installee(chenilles));

      expect(candidat.validate()).toEqual(ok());
    });

    it('refuse une 2ᵉ paire de Chenilles sur le même véhicule', () => {
      const avecUnePaire = empiler(monsterTruck, [{ Decorateur: ChenillesDecorator, amelioration: chenilles }]);
      const candidat = new ChenillesDecorator(avecUnePaire, chenilles, installee(chenilles));

      expect(candidat.validate()).toEqual(fail('Une seule paire de Chenilles par véhicule'));
    });
  });

  describe("MembreEquipageDecorator — +1 équipage, plafonné à 2× l'équipage de départ", () => {
    it('modifie le profil : +1 équipage', () => {
      const base = new CatalogVehicleBuild(monsterTruck); // équipage de départ : 2
      const build = new MembreEquipageDecorator(base, membreEquipage, installee(membreEquipage));

      expect(build.stats.equipage).toBe(monsterTruck.equipage + 1);
    });

    it("accepte tant que l'équipage cumulé reste sous le seuil (2× équipage de départ)", () => {
      // monsterTruck : équipage de départ 2 → seuil 4. Un premier exemplaire est déjà posé
      // (équipage courant = 3) ; le candidat porterait le total à 4 — encore acceptable.
      const avecUn = empiler(monsterTruck, [{ Decorateur: MembreEquipageDecorator, amelioration: membreEquipage }]);
      const candidat = new MembreEquipageDecorator(avecUn, membreEquipage, installee(membreEquipage));

      expect(candidat.stats.equipage).toBe(4);
      expect(candidat.validate()).toEqual(ok());
    });

    it("refuse dès que l'équipage cumulé dépasserait le seuil", () => {
      // Deux exemplaires déjà posés (équipage courant = 4 = seuil) ; un 3ᵉ porterait à 5.
      const avecDeux = empiler(monsterTruck, [
        { Decorateur: MembreEquipageDecorator, amelioration: membreEquipage },
        { Decorateur: MembreEquipageDecorator, amelioration: membreEquipage },
      ]);
      const candidat = new MembreEquipageDecorator(avecDeux, membreEquipage, installee(membreEquipage));

      expect(candidat.stats.equipage).toBe(5);
      expect(candidat.validate()).toEqual(fail("Maximum d'équipage atteint (4)"));
    });
  });

  describe('BelierDecorator — orientation requise, unique PAR POSITION (regroupe les variantes par classe)', () => {
    it("refuse si aucune orientation n'est fournie", () => {
      const base = new CatalogVehicleBuild(monsterTruck);
      const candidat = new BelierDecorator(base, belier, installee(belier));

      expect(candidat.validate()).toEqual(fail('Une orientation est requise pour le Bélier'));
    });

    it('accepte la première pose, à une orientation donnée', () => {
      const base = new CatalogVehicleBuild(monsterTruck);
      const candidat = new BelierDecorator(base, belier, installee(belier, 'avant'));

      expect(candidat.validate()).toEqual(ok());
    });

    it('accepte un second Bélier sur une orientation DIFFÉRENTE', () => {
      const avecAvant = empiler(monsterTruck, [{ Decorateur: BelierDecorator, amelioration: belier, orientation: 'avant' }]);
      const candidat = new BelierDecorator(avecAvant, belier, installee(belier, 'arrière'));

      expect(candidat.validate()).toEqual(ok());
    });

    it('refuse un second Bélier sur la MÊME orientation', () => {
      const avecAvant = empiler(monsterTruck, [{ Decorateur: BelierDecorator, amelioration: belier, orientation: 'avant' }]);
      const candidat = new BelierDecorator(avecAvant, belier, installee(belier, 'avant'));

      expect(candidat.validate()).toEqual(fail('Un Bélier occupe déjà la position "avant"'));
    });

    it('regroupe la variante Slime avec l\'original : la même CLASSE de décorateur protège la position, malgré des nom_interne distincts', () => {
      const avecSlimeAvant = empiler(monsterTruck, [
        { Decorateur: BelierDecorator, amelioration: belierSlime, orientation: 'avant' },
      ]);
      const candidatOriginal = new BelierDecorator(avecSlimeAvant, belier, installee(belier, 'avant'));

      // `hasOrientationFor` compare sur `this.constructor`, pas sur `nom_interne` :
      // "Bélier (Slime)" et "Bélier" sont vus comme UN SEUL ET MÊME type — exactement
      // le regroupement souhaité, sans rien ajouter au YAML.
      expect(candidatOriginal.validate()).toEqual(fail('Un Bélier occupe déjà la position "avant"'));
    });
  });

  describe('BelierExplosifDecorator — interdit sur Léger, unique (limite globale), orientation requise, indépendant du Bélier', () => {
    it('refuse sur un véhicule de Poids Léger', () => {
      const base = new CatalogVehicleBuild(buggy);
      const candidat = new BelierExplosifDecorator(base, belierExplosif, installee(belierExplosif, 'avant'));

      expect(candidat.validate()).toEqual(fail('Le Bélier Explosif est interdit sur les véhicules de Poids Léger'));
    });

    it("refuse si aucune orientation n'est fournie, sur un véhicule par ailleurs autorisé", () => {
      const base = new CatalogVehicleBuild(monsterTruck);
      const candidat = new BelierExplosifDecorator(base, belierExplosif, installee(belierExplosif));

      expect(candidat.validate()).toEqual(fail('Une orientation est requise pour le Bélier Explosif'));
    });

    it('accepte la première pose sur un véhicule autorisé, avec orientation', () => {
      const base = new CatalogVehicleBuild(monsterTruck);
      const candidat = new BelierExplosifDecorator(base, belierExplosif, installee(belierExplosif, 'avant'));

      expect(candidat.validate()).toEqual(ok());
    });

    it('refuse un second Bélier Explosif — la limite est GLOBALE (1/véhicule), pas par position', () => {
      const avecUn = empiler(monsterTruck, [
        { Decorateur: BelierExplosifDecorator, amelioration: belierExplosif, orientation: 'avant' },
      ]);
      // Même sur une orientation DIFFÉRENTE : contrairement au Bélier, ce n'est pas
      // une question de position — `countByType` suffit, `hasOrientationFor` serait superflu.
      const candidat = new BelierExplosifDecorator(avecUn, belierExplosif, installee(belierExplosif, 'arrière'));

      expect(candidat.validate()).toEqual(fail('Un seul Bélier Explosif par véhicule'));
    });

    it('est COMPATIBLE et CUMULATIF avec un Bélier sur la MÊME orientation (texte du catalogue, cf. Ajustement n°2 du plan)', () => {
      const avecBelier = empiler(monsterTruck, [{ Decorateur: BelierDecorator, amelioration: belier, orientation: 'avant' }]);
      const candidatExplosif = new BelierExplosifDecorator(avecBelier, belierExplosif, installee(belierExplosif, 'avant'));

      // Cas contre-intuitif au premier abord (proximité des noms) — délibérément couvert :
      // ce test documente que la compatibilité est un comportement VOULU (confirmé par
      // la fiche de Bélier Explosif), pas un oubli. Chaque décorateur ignore l'existence
      // de l'autre type — `BelierExplosifDecorator` ne consulte JAMAIS les positions
      // occupées par les `BelierDecorator`, et réciproquement.
      expect(candidatExplosif.validate()).toEqual(ok());
    });
  });

  describe('BlindageDecorator — +2 carrosserie, cumulable sans limite (couvre aussi Micro-Blindage)', () => {
    it('modifie le profil : +2 carrosserie', () => {
      const base = new CatalogVehicleBuild(monsterTruck);
      const build = new BlindageDecorator(base, blindage, installee(blindage));

      expect(build.stats.carrosserie).toBe(monsterTruck.carrosserie + 2);
    });

    it('cumule les effets de plusieurs Blindages, sans aucune limite de pose', () => {
      const avecDeux = empiler(monsterTruck, [
        { Decorateur: BlindageDecorator, amelioration: blindage },
        { Decorateur: BlindageDecorator, amelioration: blindage },
      ]);
      const candidat = new BlindageDecorator(avecDeux, blindage, installee(blindage));

      expect(candidat.stats.carrosserie).toBe(monsterTruck.carrosserie + 2 * 3); // 3 couches × (+2)
      // "cumulable sans limite" = absence de règle de pose : le défaut hérité (ok())
      // exprime déjà exactement ce qu'il faut — aucun `validateSelf` à overrider.
      expect(candidat.validate()).toEqual(ok());
    });
  });

  describe('EquipementMishkinDecorator — un seul exemplaire (Réacteur Nucléaire / Téléporteur, même comportement)', () => {
    it('accepte la première pose', () => {
      const base = new CatalogVehicleBuild(monsterTruck);
      const candidat = new EquipementMishkinDecorator(base, reacteurNucleaire, installee(reacteurNucleaire));

      expect(candidat.validate()).toEqual(ok());
    });

    it('refuse un second exemplaire — y compris l\'AUTRE équipement Mishkin (même `comportement` ⇒ même classe ⇒ même règle)', () => {
      const avecReacteur = empiler(monsterTruck, [
        { Decorateur: EquipementMishkinDecorator, amelioration: reacteurNucleaire },
      ]);
      const candidatTeleporteur = new EquipementMishkinDecorator(avecReacteur, teleporteur, installee(teleporteur));

      // Le message reprend `this.amelioration.nom` du CANDIDAT — précis malgré le
      // partage de classe ("Téléporteur Expérimental", pas un message générique).
      expect(candidatTeleporteur.validate()).toEqual(
        fail('Un seul exemplaire de "Téléporteur Expérimental" par véhicule'),
      );
    });
  });
});
