import { describe, it, expect } from 'vitest';
import {
  MoteurEndommageDecorator,
  DirectionEndommageDecorator,
  BlindageArrachéDecorator,
  SiegeIrrecuperableDecorator,
  SEQUELLA_DECORATOR_FACTORIES,
} from './sequella-decorators';
import { SequellaType } from './value-objects/sequella-type';
import { CatalogVehicleBuild } from './vehicle-build';
import type { Vehicule } from '../../catalog/catalog.interfaces';

/** Fabrique un Vehicule catalogue avec des stats contrôlées pour les tests. */
function makeVehicule(overrides: Partial<Vehicule> = {}): Vehicule {
  return {
    nom: 'Voiture', nom_interne: 'voiture', poids: 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2, emplacements: 4,
    prix: 12, description: '', regles: '', sponsors_autorises: [],
    ...overrides,
  };
}

const MOTEUR_ENDOMMAGE = SequellaType.from({
  nom: 'Moteur endommagé', nom_interne: 'moteur_endommage', description: '', chocs_cost: 0, origine: 'TABLE_EPAVES',
});
const DIRECTION_ENDOMMAGE = SequellaType.from({
  nom: 'Direction endommagée', nom_interne: 'direction_endommage', description: '', chocs_cost: 0, origine: 'TABLE_EPAVES',
});
const BLINDAGE_ARRACHE = SequellaType.from({
  nom: 'Blindage arraché', nom_interne: 'blindage_arrache', description: '', chocs_cost: 0, origine: 'TABLE_EPAVES',
});
const SIEGE_IRRECUPERABLE = SequellaType.from({
  nom: 'Siège irrécupérable', nom_interne: 'siege_irrecuperable', description: '', chocs_cost: 0, origine: 'TABLE_EPAVES',
});

describe('MoteurEndommageDecorator', () => {
  it('réduit vitesse_max de 1', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ vitesse_max: 6 }));
    const decorated = new MoteurEndommageDecorator(base, MOTEUR_ENDOMMAGE);
    expect(decorated.stats.vitesse_max).toBe(5);
  });

  it('ne descend pas sous 1 (vitesse minimum)', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ vitesse_max: 1 }));
    const decorated = new MoteurEndommageDecorator(base, MOTEUR_ENDOMMAGE);
    expect(decorated.stats.vitesse_max).toBe(1);
  });

  it('ne modifie pas les autres stats', () => {
    const base = new CatalogVehicleBuild(makeVehicule());
    const decorated = new MoteurEndommageDecorator(base, MOTEUR_ENDOMMAGE);
    expect(decorated.stats.carrosserie).toBe(6);
    expect(decorated.stats.manoeuvrabilite).toBe(4);
  });

  it('validate() délègue vers l\'inner sans contrôle d\'emplacement', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ emplacements: 0 }));
    const decorated = new MoteurEndommageDecorator(base, MOTEUR_ENDOMMAGE);
    expect(decorated.validate().ok).toBe(true);
  });
});

describe('DirectionEndommageDecorator', () => {
  it('réduit manoeuvrabilite de 1', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ manoeuvrabilite: 4 }));
    const decorated = new DirectionEndommageDecorator(base, DIRECTION_ENDOMMAGE);
    expect(decorated.stats.manoeuvrabilite).toBe(3);
  });

  it('ne descend pas sous 1', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ manoeuvrabilite: 1 }));
    const decorated = new DirectionEndommageDecorator(base, DIRECTION_ENDOMMAGE);
    expect(decorated.stats.manoeuvrabilite).toBe(1);
  });
});

describe('BlindageArrachéDecorator', () => {
  it('réduit carrosserie de 2', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ carrosserie: 6 }));
    const decorated = new BlindageArrachéDecorator(base, BLINDAGE_ARRACHE);
    expect(decorated.stats.carrosserie).toBe(4);
  });

  it('ne descend pas sous 0', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ carrosserie: 1 }));
    const decorated = new BlindageArrachéDecorator(base, BLINDAGE_ARRACHE);
    expect(decorated.stats.carrosserie).toBe(0);
  });
});

describe('SiegeIrrecuperableDecorator', () => {
  it('réduit equipage de 1', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ equipage: 2 }));
    const decorated = new SiegeIrrecuperableDecorator(base, SIEGE_IRRECUPERABLE);
    expect(decorated.stats.equipage).toBe(1);
  });

  it('ne descend pas sous 1', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ equipage: 1 }));
    const decorated = new SiegeIrrecuperableDecorator(base, SIEGE_IRRECUPERABLE);
    expect(decorated.stats.equipage).toBe(1);
  });
});

describe('SEQUELLA_DECORATOR_FACTORIES', () => {
  it('contient les 4 entrées', () => {
    expect(SEQUELLA_DECORATOR_FACTORIES.has('moteur_endommage')).toBe(true);
    expect(SEQUELLA_DECORATOR_FACTORIES.has('direction_endommage')).toBe(true);
    expect(SEQUELLA_DECORATOR_FACTORIES.has('blindage_arrache')).toBe(true);
    expect(SEQUELLA_DECORATOR_FACTORIES.has('siege_irrecuperable')).toBe(true);
  });

  it('moteur_endommage — la factory instancie le bon décorateur avec le type fourni', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ vitesse_max: 6 }));
    const decorated = SEQUELLA_DECORATOR_FACTORIES.get('moteur_endommage')!(base, MOTEUR_ENDOMMAGE);
    expect(decorated.stats.vitesse_max).toBe(5);
  });

  it('les séquelles s\'empilent correctement (chaîne de décorateurs)', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ vitesse_max: 6, manoeuvrabilite: 4 }));
    const avec1 = new MoteurEndommageDecorator(base, MOTEUR_ENDOMMAGE);
    const avec2 = new DirectionEndommageDecorator(avec1, DIRECTION_ENDOMMAGE);
    expect(avec2.stats.vitesse_max).toBe(5);
    expect(avec2.stats.manoeuvrabilite).toBe(3);
  });
});
