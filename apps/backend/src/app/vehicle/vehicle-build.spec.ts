/**
 * Tests unitaires pour le MÉCANISME GÉNÉRIQUE du Pattern Decorator (`vehicle-build.ts`) :
 * `CatalogVehicleBuild`, `ImprovementDecorator` et son Template Method `validate`.
 *
 * ⚠️ Ce fichier ne teste AUCUNE règle métier Gaslands — c'est le rôle de
 * `improvement-decorators.spec.ts`. Ici, on vérifie uniquement que la MÉCANIQUE
 * D'EMPILEMENT elle-même est correcte : accumulation de `stats`/`describe`,
 * comptage par type, et la séquence fixe du Template Method (générique → spécifique
 * → délégation). Pour cela, on utilise des décorateurs de TEST minimaux — pas les
 * décorateurs de production — afin de ne dépendre d'aucune règle métier réelle :
 * un changement de règle (ex: le seuil de Blindage) ne doit jamais faire échouer
 * ces tests, qui portent sur la STRUCTURE, pas sur le CONTENU des règles.
 */

import { describe, it, expect } from 'vitest';
import type { Amelioration, Vehicule } from '../catalog/catalog.interfaces';
import {
  CatalogVehicleBuild,
  ImprovementDecorator,
  NeutralDecorator,
  ok,
  fail,
  type InstalledImprovement,
  type Orientation,
  type RuleResult,
  type VehicleBuild,
  type VehicleStats,
} from './vehicle-build';

// ── Fixtures catalogue minimales ──────────────────────────────────────────────

const buggy: Vehicule = {
  nom: 'Buggy',
  nom_interne: 'buggy',
  poids: 'Léger',
  carrosserie: 8,
  manoeuvrabilite: 3,
  vitesse_max: 8,
  equipage: 1,
  emplacements: 2, // volontairement petit : facilite les scénarios de dépassement
  prix: 6,
  description: 'Un buggy léger et maniable',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const ameliorationUnEmplacement: Amelioration = {
  nom: 'Amélioration test (1 emplacement)',
  nom_interne: 'amelioration_test_1',
  prix: 2,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const ameliorationDeuxEmplacements: Amelioration = {
  nom: 'Amélioration test (2 emplacements)',
  nom_interne: 'amelioration_test_2',
  prix: 4,
  emplacement: 2,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

/** Construit l'`InstalledImprovement` correspondant à une amélioration de test. */
function installee(amelioration: Amelioration, orientation?: Orientation): InstalledImprovement {
  return { nom_interne: amelioration.nom_interne, orientation };
}

// ── Décorateurs de test minimaux (pas de règle métier réelle) ─────────────────

/** Modifie la carrosserie de +1 — sert uniquement à observer l'ACCUMULATION de `stats`. */
class RenfortCarrosserieTest extends ImprovementDecorator {
  override get stats(): VehicleStats {
    return { ...this.inner.stats, carrosserie: this.inner.stats.carrosserie + 1 };
  }
}

/** Échoue systématiquement sa propre validation — sert à observer la séquence du Template Method. */
class RegleEchecTest extends ImprovementDecorator {
  protected override validateSelf(): RuleResult {
    return fail('Échec de test (RegleEchecTest)');
  }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('VehicleBuild — chaîne de base et accumulation (Pattern Decorator)', () => {
  describe('CatalogVehicleBuild — le maillon de base, sans amélioration', () => {
    const statsAttendues: VehicleStats = {
      nom_interne: 'buggy',
      poids: 'Léger',
      carrosserie: 8,
      manoeuvrabilite: 3,
      vitesse_max: 8,
      equipage: 1,
      emplacements: 2,
    };

    it('expose les stats du véhicule catalogue — stats et baseStats sont identiques (rien ne les distingue encore)', () => {
      const build = new CatalogVehicleBuild(buggy);
      expect(build.stats).toEqual(statsAttendues);
      expect(build.baseStats).toEqual(statsAttendues);
    });

    it('describe() ne retourne qu\'une ligne : le nom du véhicule', () => {
      const build = new CatalogVehicleBuild(buggy);
      expect(build.describe()).toEqual([{ nom: 'Buggy' }]);
    });

    it('countByType / hasOrientationFor / totalEmplacements sont à zéro : aucune couche au-dessus', () => {
      const build = new CatalogVehicleBuild(buggy);
      expect(build.countByType(RenfortCarrosserieTest)).toBe(0);
      expect(build.hasOrientationFor(RenfortCarrosserieTest, 'avant')).toBe(false);
      expect(build.totalEmplacements()).toBe(0);
    });

    it('valide systématiquement avec succès — rien à valider sur un véhicule nu', () => {
      const build = new CatalogVehicleBuild(buggy);
      expect(build.validate()).toEqual(ok());
    });
  });

  describe('ImprovementDecorator — délégation et accumulation à travers la chaîne', () => {
    it('par défaut (NeutralDecorator), délègue stats/baseStats/describe à `inner` sans rien changer', () => {
      const base = new CatalogVehicleBuild(buggy);
      const neutre = new NeutralDecorator(base, ameliorationUnEmplacement, installee(ameliorationUnEmplacement));

      // Ni `stats` ni `baseStats` ne sont altérés : NeutralDecorator n'override aucun des deux.
      expect(neutre.stats).toEqual(base.stats);
      expect(neutre.baseStats).toEqual(base.baseStats);
      // describe() empile néanmoins SA ligne — la couche existe, même sans effet de profil.
      expect(neutre.describe()).toEqual([{ nom: 'Buggy' }, { nom: ameliorationUnEmplacement.nom }]);
    });

    it('accumule les effets de profil de couche en couche, dans l\'ordre d\'empilement — baseStats reste fixe', () => {
      let build: VehicleBuild = new CatalogVehicleBuild(buggy); // carrosserie 8
      build = new RenfortCarrosserieTest(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement)); // 9
      build = new RenfortCarrosserieTest(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement)); // 10

      expect(build.stats.carrosserie).toBe(10);
      // Le profil de RÉFÉRENCE ne bouge jamais, peu importe le nombre de couches empilées —
      // c'est ce qui permet aux règles "en fonction de la valeur de départ" de rester fiables.
      expect(build.baseStats.carrosserie).toBe(8);
    });

    it('describe() empile les lignes du véhicule de base vers le sommet, dans l\'ordre de pose', () => {
      let build: VehicleBuild = new CatalogVehicleBuild(buggy);
      build = new NeutralDecorator(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement));
      build = new RenfortCarrosserieTest(build, ameliorationDeuxEmplacements, installee(ameliorationDeuxEmplacements));

      expect(build.describe()).toEqual([
        { nom: 'Buggy' },
        { nom: ameliorationUnEmplacement.nom },
        { nom: ameliorationDeuxEmplacements.nom },
      ]);
    });

    it('countByType regroupe par CLASSE de décorateur — pas par nom_interne — à travers toute la chaîne', () => {
      let build: VehicleBuild = new CatalogVehicleBuild(buggy);
      build = new RenfortCarrosserieTest(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement));
      build = new NeutralDecorator(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement));
      build = new RenfortCarrosserieTest(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement));

      expect(build.countByType(RenfortCarrosserieTest)).toBe(2);
      expect(build.countByType(NeutralDecorator)).toBe(1);
      expect(build.countByType(RegleEchecTest)).toBe(0); // absent de la chaîne
    });

    it('hasOrientationFor matche sur LE COUPLE (type de décorateur, orientation)', () => {
      let build: VehicleBuild = new CatalogVehicleBuild(buggy);
      build = new NeutralDecorator(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement, 'avant'));

      expect(build.hasOrientationFor(NeutralDecorator, 'avant')).toBe(true);
      expect(build.hasOrientationFor(NeutralDecorator, 'arrière')).toBe(false); // bonne classe, mauvaise position
      expect(build.hasOrientationFor(RenfortCarrosserieTest, 'avant')).toBe(false); // bonne position, mauvaise classe
    });

    it('totalEmplacements additionne le coût de chaque couche, base comprise (qui vaut 0)', () => {
      let build: VehicleBuild = new CatalogVehicleBuild(buggy);
      build = new NeutralDecorator(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement)); // +1
      build = new NeutralDecorator(build, ameliorationDeuxEmplacements, installee(ameliorationDeuxEmplacements)); // +2

      expect(build.totalEmplacements()).toBe(3);
    });
  });

  describe('validate() — Template Method : séquence FIXE générique → spécifique → délégation', () => {
    it('1. la règle GÉNÉRIQUE (capacité) est vérifiée en premier — elle peut refuser même si validateSelf accepterait', () => {
      // buggy : 2 emplacements. On empile 2× une amélioration de 2 emplacements (total 4 > 2).
      // Ni l'une ni l'autre couche n'a de validateSelf personnalisé : seule la règle
      // GÉNÉRIQUE — vivant dans la classe abstraite — peut donc être à l'origine du refus.
      let build: VehicleBuild = new CatalogVehicleBuild(buggy);
      build = new NeutralDecorator(build, ameliorationDeuxEmplacements, installee(ameliorationDeuxEmplacements));
      build = new NeutralDecorator(build, ameliorationDeuxEmplacements, installee(ameliorationDeuxEmplacements));

      expect(build.validate()).toEqual(fail("Capacité d'emplacements dépassée (max 2)"));
    });

    it('2. la règle SPÉCIFIQUE (validateSelf) est vérifiée ensuite — seulement si la générique a accepté', () => {
      let build: VehicleBuild = new CatalogVehicleBuild(buggy);
      build = new RegleEchecTest(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement)); // 1/2 : générique OK, spécifique KO

      expect(build.validate()).toEqual(fail('Échec de test (RegleEchecTest)'));
    });

    it('3. en cas de succès local, la validation se DÉLÈGUE vers `inner` — un échec plus profond remonte tel quel', () => {
      let build: VehicleBuild = new CatalogVehicleBuild(buggy);
      build = new RegleEchecTest(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement)); // échoue, ici, en profondeur
      build = new NeutralDecorator(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement)); // lui-même valide

      // Le sommet de la chaîne (Neutral) est cohérent ; il délègue vers le dessous,
      // qui remonte SON échec — sans le masquer ni le transformer.
      expect(build.validate()).toEqual(fail('Échec de test (RegleEchecTest)'));
    });

    it('4. valide la chaîne entière — succès — quand chaque maillon, du sommet à la base, est cohérent', () => {
      let build: VehicleBuild = new CatalogVehicleBuild(buggy);
      build = new NeutralDecorator(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement));
      build = new RenfortCarrosserieTest(build, ameliorationUnEmplacement, installee(ameliorationUnEmplacement));

      expect(build.validate()).toEqual(ok());
    });
  });
});
