/**
 * Tests unitaires pour `ImprovementDecoratorFactory` — le registre `comportement → classe`.
 *
 * Ce qu'on vérifie ici N'EST PAS la règle métier de chaque décorateur (couvert par
 * `improvement-decorators.spec.ts`) mais le CÂBLAGE : `wrap()` instancie-t-il la
 * bonne classe pour chaque clé `comportement`, retombe-t-il sur `NeutralDecorator`
 * en l'absence (ou en cas de valeur inconnue), et — point clé du design — produit-il
 * bien la MÊME classe pour deux entrées catalogue qui partagent le même `comportement`
 * (variantes sponsor) ? C'est cette dernière propriété qui permet à `countByType` /
 * `hasOrientationFor` de regrouper "Bélier" et "Bélier (Slime)" sans rien ajouter au YAML.
 */

import { describe, it, expect } from 'vitest';
import type { Amelioration, Vehicule } from '../catalog/catalog.interfaces';
import { CatalogVehicleBuild, NeutralDecorator, type InstalledImprovement, type VehicleBuild } from './vehicle-build';
import { ImprovementDecoratorFactory } from './improvement-decorator.factory';
import {
  BelierDecorator,
  BelierExplosifDecorator,
  BlindageDecorator,
  ChenillesDecorator,
  EquipementMishkinDecorator,
  MembreEquipageDecorator,
} from './improvement-decorators';

// ── Fixtures minimales ────────────────────────────────────────────────────────

const vehiculeTest: Vehicule = {
  nom: 'Voiture',
  nom_interne: 'voiture',
  poids: 'Moyen',
  carrosserie: 10,
  manoeuvrabilite: 2,
  vitesse_max: 8,
  equipage: 1,
  emplacements: 4,
  prix: 12,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

/** Construit une amélioration de test minimale, avec le `comportement` à essayer. */
function amelioration(nomInterne: string, comportement?: string): Amelioration {
  return {
    nom: `Amélioration "${nomInterne}"`,
    nom_interne: nomInterne,
    comportement,
    prix: 1,
    emplacement: 0,
    description: '',
    regles: '',
    sponsors_autorises: ['Rutherford'],
  };
}

const instance: InstalledImprovement = { nom_interne: 'peu-importe' };

describe('ImprovementDecoratorFactory', () => {
  const factory = new ImprovementDecoratorFactory();
  const base: VehicleBuild = new CatalogVehicleBuild(vehiculeTest);

  describe('wrap() — sélection de la classe selon `comportement`', () => {
    // Une ligne par entrée du REGISTRE — la table documente le mapping complet,
    // et tout ajout de règle (cf. plan : "une classe + une ligne ici") devra
    // s'accompagner d'une ligne dans CETTE table pour rester couvert.
    it.each([
      ['chenilles', ChenillesDecorator],
      ['membre_equipage', MembreEquipageDecorator],
      ['belier', BelierDecorator],
      ['belier_explosif', BelierExplosifDecorator],
      ['blindage', BlindageDecorator],
      ['mishkin_exclusif', EquipementMishkinDecorator],
    ] as const)('"%s" → %s', (comportement, ClasseAttendue) => {
      const resultat = factory.wrap(base, amelioration('peu-importe', comportement), instance);

      expect(resultat).toBeInstanceOf(ClasseAttendue);
    });

    it('retombe sur NeutralDecorator quand `comportement` est absent (amélioration neutre)', () => {
      const resultat = factory.wrap(base, amelioration('arceaux', undefined), instance);

      expect(resultat).toBeInstanceOf(NeutralDecorator);
    });

    it('retombe sur NeutralDecorator quand `comportement` ne correspond à aucune entrée du registre', () => {
      // Filet de sécurité : une faute de frappe dans le YAML ne doit jamais faire
      // planter le serveur — `catalog.data.spec.ts` détecte ce cas séparément, en
      // amont, comme une INCOHÉRENCE de données ; ici, on vérifie juste que `wrap`
      // dégrade proprement plutôt que de lever une exception à l'exécution.
      const resultat = factory.wrap(base, amelioration('mystere', 'comportement_qui_nexiste_pas'), instance);

      expect(resultat).toBeInstanceOf(NeutralDecorator);
    });
  });

  describe('wrap() — regroupement des variantes sponsor par `comportement` partagé', () => {
    it('"Bélier" et "Bélier (Slime)" produisent la MÊME classe — même comportement déclaré', () => {
      const original = factory.wrap(base, amelioration('belier', 'belier'), instance);
      const varianteSlime = factory.wrap(base, amelioration('belier_slime', 'belier'), instance);

      // Pas seulement "les deux sont des BelierDecorator" : on vérifie qu'il s'agit
      // du MÊME constructeur — c'est précisément ce que `countByType`/`hasOrientationFor`
      // comparent (`this.constructor === type`) pour regrouper les variantes.
      expect(original.constructor).toBe(varianteSlime.constructor);
      expect(original).toBeInstanceOf(BelierDecorator);
      expect(varianteSlime).toBeInstanceOf(BelierDecorator);
    });

    it('"Réacteur Nucléaire" et "Téléporteur" (mishkin_exclusif) produisent aussi la même classe', () => {
      const reacteur = factory.wrap(base, amelioration('reacteur_nucleaire', 'mishkin_exclusif'), instance);
      const teleporteur = factory.wrap(base, amelioration('teleporteur', 'mishkin_exclusif'), instance);

      expect(reacteur.constructor).toBe(teleporteur.constructor);
      expect(reacteur).toBeInstanceOf(EquipementMishkinDecorator);
    });
  });

  describe('wrap() — délégation au contrat VehicleBuild', () => {
    it('retourne un objet qui enveloppe correctement `inner` (le contrat reste celui de VehicleBuild)', () => {
      const candidat = amelioration('chenilles', 'chenilles');
      const resultat = factory.wrap(base, candidat, instance);

      // `wrap` ne fait qu'instancier — il ne modifie ni ne contourne le contrat :
      // describe() doit empiler exactement une ligne de plus que `base`.
      expect(resultat.describe()).toEqual([...base.describe(), { nom: candidat.nom }]);
    });
  });
});
