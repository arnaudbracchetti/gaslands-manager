import { describe, it, expect } from 'vitest';
import { Vehicle } from './vehicle';
import { VehicleType } from './value-objects/vehicle-type';
import { WeaponType } from './value-objects/weapon-type';
import { ImprovementType } from './value-objects/improvement-type';
import { SequellaType } from './value-objects/sequella-type';
import { Improvement } from './improvement';
import { DomainException } from './vehicle';

function makeVehicleType(emplacements = 4, prix = 12): VehicleType {
  return VehicleType.from({
    nom: 'Voiture', nom_interne: 'voiture', poids: 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements, prix, description: '', regles: '', sponsors_autorises: [],
  });
}

function makeWeaponType(prix = 5, emplacement = 1): WeaponType {
  return WeaponType.from({
    nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base',
    prix, emplacement, description: '', regles: '', sponsors_autorises: [],
  });
}

function makeImprovementType(prix = 4, emplacement = 1): ImprovementType {
  return ImprovementType.from({
    nom: 'Bélier', nom_interne: 'belier', prix, emplacement,
    description: '', regles: '', sponsors_autorises: [],
  });
}

function makeVehicle(emplacements = 4, prix = 12): Vehicle {
  return new Vehicle(1, 10, makeVehicleType(emplacements, prix), [], []);
}

describe('Vehicle — champs transients de campagne', () => {
  describe('markLost / clearLost', () => {
    it('isLost est false par défaut', () => {
      expect(makeVehicle().isLost).toBe(false);
    });

    it('markLost est idempotent', () => {
      const v = makeVehicle();
      v.markLost();
      v.markLost();
      expect(v.isLost).toBe(true);
    });

    it('clearLost remet le véhicule à l\'état actif', () => {
      const v = makeVehicle();
      v.markLost();
      v.clearLost();
      expect(v.isLost).toBe(false);
    });
  });

  describe('canAddWeapon — garde _isLost', () => {
    it('retourne fail si le véhicule est perdu', () => {
      const v = makeVehicle();
      v.markLost();
      const result = v.canAddWeapon(makeWeaponType(), 'avant', 100);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain('hors combat');
    });

    it('autorise l\'ajout si le véhicule n\'est pas perdu', () => {
      const v = makeVehicle();
      const result = v.canAddWeapon(makeWeaponType(), 'avant', 100);
      expect(result.ok).toBe(true);
    });
  });

  describe('canAddImprovement — garde _isLost', () => {
    it('retourne fail si le véhicule est perdu', () => {
      const v = makeVehicle();
      v.markLost();
      const result = v.canAddImprovement(makeImprovementType(), null, 100);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain('hors combat');
    });

    it('autorise l\'ajout si le véhicule n\'est pas perdu', () => {
      const v = makeVehicle();
      const result = v.canAddImprovement(makeImprovementType(), null, 100);
      expect(result.ok).toBe(true);
    });
  });

  describe('addChocs', () => {
    it('chocs est 0 par défaut', () => {
      expect(makeVehicle().chocs).toBe(0);
    });

    it('incrémente les chocs', () => {
      const v = makeVehicle();
      v.addChocs(3);
      expect(v.chocs).toBe(3);
    });

    it('décrémente les chocs avec une valeur négative', () => {
      const v = makeVehicle();
      v.addChocs(5);
      v.addChocs(-2);
      expect(v.chocs).toBe(3);
    });

    it('lève DomainException si le résultat serait négatif', () => {
      const v = makeVehicle();
      v.addChocs(2);
      expect(() => v.addChocs(-3)).toThrow(DomainException);
    });
  });

  describe('addSequella / removeLastSequella', () => {
    const moteur = SequellaType.from({ nom: 'Moteur endommagé', nom_interne: 'moteur_endommage', description: '', chocs_cost: 2 });
    const direction = SequellaType.from({ nom: 'Direction endommagée', nom_interne: 'direction_endommage', description: '', chocs_cost: 2 });

    it('sequellas est vide par défaut', () => {
      expect(makeVehicle().sequellas).toHaveLength(0);
    });

    it('addSequella empile les SequellaType dans l\'ordre d\'application', () => {
      const v = makeVehicle();
      v.addSequella(moteur);
      v.addSequella(direction);
      expect(v.sequellas).toHaveLength(2);
      expect(v.sequellas[0].nomInterne).toBe('moteur_endommage');
      expect(v.sequellas[1].nomInterne).toBe('direction_endommage');
    });

    it('removeLastSequella annule la dernière séquelle (undo)', () => {
      const v = makeVehicle();
      v.addSequella(moteur);
      v.addSequella(direction);
      v.removeLastSequella();
      expect(v.sequellas).toHaveLength(1);
      expect(v.sequellas[0].nomInterne).toBe('moteur_endommage');
    });
  });
});

// ── Règles de pose des améliorations (chaîne Decorator relocalisée dans domain/) ──
//
// Ces règles Gaslands vivent dans `improvement-decorators.ts` (validateSelf) et sont
// désormais invoquées par `Vehicle.canAddImprovement` via `buildChain().validate()`.
// Avant le correctif, elles n'étaient jamais appliquées à l'écriture.

/** Améliorations de test : le décorateur est choisi d'après `comportement`. */
function improvementType(nomInterne: string, comportement: string, emplacement = 0): ImprovementType {
  return ImprovementType.from({
    nom: nomInterne, nom_interne: nomInterne, prix: 0, emplacement,
    description: '', regles: '', sponsors_autorises: [], comportement,
  });
}

function vehicleWith(
  improvements: Improvement[],
  opts: { nomInterne?: string; poids?: 'Léger' | 'Moyen' | 'Lourd'; equipage?: number; emplacements?: number } = {},
): Vehicle {
  const type = VehicleType.from({
    nom: 'V', nom_interne: opts.nomInterne ?? 'voiture', poids: opts.poids ?? 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: opts.equipage ?? 2,
    emplacements: opts.emplacements ?? 10, prix: 12, description: '', regles: '', sponsors_autorises: [],
  });
  return new Vehicle(1, 10, type, [], improvements);
}

describe('Vehicle.canAddImprovement — règles de pose (chaîne Decorator)', () => {
  it('refuse les Chenilles sur un véhicule incompatible (char_assaut)', () => {
    const v = vehicleWith([], { nomInterne: 'char_assaut', poids: 'Lourd' });
    const r = v.canAddImprovement(improvementType('chenilles', 'chenilles', 1), null, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Chenilles incompatibles');
  });

  it('refuse une deuxième paire de Chenilles', () => {
    const existing = new Improvement(1, improvementType('chenilles', 'chenilles', 1), null, false);
    const v = vehicleWith([existing]);
    const r = v.canAddImprovement(improvementType('chenilles', 'chenilles', 1), null, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Une seule paire de Chenilles');
  });

  it('refuse un membre d\'équipage au-delà du double de l\'équipage de base', () => {
    const crew = (): Improvement => new Improvement(0, improvementType('membre_equipage', 'membre_equipage', 0), null, false);
    // base 2 → max 4 ; deux membres (=4) sont valides, le troisième (=5) dépasse.
    const v = vehicleWith([crew(), crew()], { equipage: 2 });
    const r = v.canAddImprovement(improvementType('membre_equipage', 'membre_equipage', 0), null, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Maximum d\'équipage');
  });

  it('refuse un deuxième Bélier sur la même orientation', () => {
    const belier = new Improvement(1, improvementType('belier', 'belier', 1), 'avant', false);
    const v = vehicleWith([belier]);
    const r = v.canAddImprovement(improvementType('belier', 'belier', 1), 'avant', 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Un Bélier occupe déjà');
  });

  it('autorise un Bélier sur une orientation libre', () => {
    const belier = new Improvement(1, improvementType('belier', 'belier', 1), 'avant', false);
    const v = vehicleWith([belier]);
    const r = v.canAddImprovement(improvementType('belier', 'belier', 1), 'gauche', 100);
    expect(r.ok).toBe(true);
  });

  it('refuse le Bélier Explosif sur un véhicule de Poids Léger', () => {
    const v = vehicleWith([], { poids: 'Léger' });
    const r = v.canAddImprovement(improvementType('belier_explosif', 'belier_explosif', 0), 'avant', 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Poids Léger');
  });

  it('refuse un deuxième équipement Mishkin exclusif', () => {
    const reacteur = new Improvement(1, improvementType('reacteur_nucleaire', 'mishkin_exclusif', 0), null, false);
    const v = vehicleWith([reacteur]);
    const r = v.canAddImprovement(improvementType('reacteur_nucleaire', 'mishkin_exclusif', 0), null, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Un seul exemplaire');
  });

  it('ignore les améliorations par défaut (estDefaut) dans le comptage des règles', () => {
    // Une Tourelle intégrée (estDefaut) ne doit pas compter comme un Bélier occupant un arc.
    const defaultTourelle = new Improvement(1, improvementType('tourelle', 'tourelle', 0), 'avant', true);
    const v = vehicleWith([defaultTourelle]);
    const r = v.canAddImprovement(improvementType('belier', 'belier', 1), 'avant', 100);
    expect(r.ok).toBe(true);
  });
});
