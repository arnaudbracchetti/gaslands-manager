import { describe, it, expect } from 'vitest';
import {
  MoteurEndommageDecorator,
  DirectionEndommageDecorator,
  BlindageArrachéDecorator,
  SEQUELLA_REGISTRY,
  SEQUELLA_MOTEUR_ENDOMMAGE,
  SEQUELLA_DIRECTION_ENDOMMAGE,
  SEQUELLA_BLINDAGE_ARRACHE,
} from './sequella-decorators';
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

describe('SequellaType — catalogue statique', () => {
  it('SEQUELLA_MOTEUR_ENDOMMAGE expose les bonnes propriétés', () => {
    expect(SEQUELLA_MOTEUR_ENDOMMAGE.nomInterne).toBe('moteur_endommage');
    expect(SEQUELLA_MOTEUR_ENDOMMAGE.chocsCost).toBe(2);
  });

  it('SEQUELLA_DIRECTION_ENDOMMAGE expose les bonnes propriétés', () => {
    expect(SEQUELLA_DIRECTION_ENDOMMAGE.nomInterne).toBe('direction_endommage');
  });

  it('SEQUELLA_BLINDAGE_ARRACHE expose les bonnes propriétés', () => {
    expect(SEQUELLA_BLINDAGE_ARRACHE.nomInterne).toBe('blindage_arrache');
    expect(SEQUELLA_BLINDAGE_ARRACHE.chocsCost).toBe(3);
  });
});

describe('MoteurEndommageDecorator', () => {
  it('réduit vitesse_max de 1', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ vitesse_max: 6 }));
    const decorated = new MoteurEndommageDecorator(base);
    expect(decorated.stats.vitesse_max).toBe(5);
  });

  it('ne descend pas sous 1 (vitesse minimum)', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ vitesse_max: 1 }));
    const decorated = new MoteurEndommageDecorator(base);
    expect(decorated.stats.vitesse_max).toBe(1);
  });

  it('ne modifie pas les autres stats', () => {
    const base = new CatalogVehicleBuild(makeVehicule());
    const decorated = new MoteurEndommageDecorator(base);
    expect(decorated.stats.carrosserie).toBe(6);
    expect(decorated.stats.manoeuvrabilite).toBe(4);
  });

  it('validate() délègue vers l\'inner sans contrôle d\'emplacement', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ emplacements: 0 }));
    const decorated = new MoteurEndommageDecorator(base);
    expect(decorated.validate().ok).toBe(true);
  });
});

describe('DirectionEndommageDecorator', () => {
  it('réduit manoeuvrabilite de 1', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ manoeuvrabilite: 4 }));
    const decorated = new DirectionEndommageDecorator(base);
    expect(decorated.stats.manoeuvrabilite).toBe(3);
  });

  it('ne descend pas sous 1', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ manoeuvrabilite: 1 }));
    const decorated = new DirectionEndommageDecorator(base);
    expect(decorated.stats.manoeuvrabilite).toBe(1);
  });
});

describe('BlindageArrachéDecorator', () => {
  it('réduit carrosserie de 2', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ carrosserie: 6 }));
    const decorated = new BlindageArrachéDecorator(base);
    expect(decorated.stats.carrosserie).toBe(4);
  });

  it('ne descend pas sous 0', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ carrosserie: 1 }));
    const decorated = new BlindageArrachéDecorator(base);
    expect(decorated.stats.carrosserie).toBe(0);
  });
});

describe('SEQUELLA_REGISTRY', () => {
  it('contient les 3 entrées', () => {
    expect(SEQUELLA_REGISTRY.has('moteur_endommage')).toBe(true);
    expect(SEQUELLA_REGISTRY.has('direction_endommage')).toBe(true);
    expect(SEQUELLA_REGISTRY.has('blindage_arrache')).toBe(true);
  });

  it('chaque entrée expose le SequellaType correspondant', () => {
    expect(SEQUELLA_REGISTRY.get('moteur_endommage')!.type).toBe(SEQUELLA_MOTEUR_ENDOMMAGE);
    expect(SEQUELLA_REGISTRY.get('blindage_arrache')!.type).toBe(SEQUELLA_BLINDAGE_ARRACHE);
  });

  it('moteur_endommage — la factory instancie le bon décorateur', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ vitesse_max: 6 }));
    const decorated = SEQUELLA_REGISTRY.get('moteur_endommage')!.factory(base);
    expect(decorated.stats.vitesse_max).toBe(5);
  });

  it('les séquelles s\'empilent correctement (chaîne de décorateurs)', () => {
    const base = new CatalogVehicleBuild(makeVehicule({ vitesse_max: 6, manoeuvrabilite: 4 }));
    const avec1 = new MoteurEndommageDecorator(base);
    const avec2 = new DirectionEndommageDecorator(avec1);
    expect(avec2.stats.vitesse_max).toBe(5);
    expect(avec2.stats.manoeuvrabilite).toBe(3);
  });
});
