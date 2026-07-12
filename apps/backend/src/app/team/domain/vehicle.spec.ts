import { describe, it, expect } from 'vitest';
import { Vehicle } from './vehicle';
import { VehicleType } from './value-objects/vehicle-type';
import { WeaponType } from './value-objects/weapon-type';
import { ImprovementType } from './value-objects/improvement-type';
import { SequellaType } from './value-objects/sequella-type';
import { Improvement } from './improvement';
import { Weapon } from './weapon';
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
    necessite_orientation: true,
  });
}

// Fixture générique "amélioration quelconque" — nommée Bélier par commodité mais SANS
// `comportement`, donc `necessite_orientation: false` (elle ne teste pas les règles
// spécifiques du Bélier, cf. `improvementType()` plus bas pour ça).
function makeImprovementType(prix = 4, emplacement = 1): ImprovementType {
  return ImprovementType.from({
    nom: 'Bélier', nom_interne: 'belier', prix, emplacement,
    description: '', regles: '', sponsors_autorises: [],
    necessite_orientation: false,
  });
}

function makeVehicle(emplacements = 4, prix = 12): Vehicle {
  return new Vehicle(1, 10, makeVehicleType(emplacements, prix), [], []);
}

function makeTourelleWeaponType(prix = 5, emplacement = 1): WeaponType {
  return WeaponType.from({
    nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base',
    prix, emplacement, description: '', regles: '', sponsors_autorises: [], montable_tourelle: true,
    necessite_orientation: true,
  });
}

describe('ImprovementType.requiresOrientation — lecture du catalogue', () => {
  it('est true pour le Bélier (necessite_orientation: true)', () => {
    const belier = ImprovementType.from({
      nom: 'Bélier', nom_interne: 'belier', prix: 4, emplacement: 1,
      description: '', regles: '', sponsors_autorises: [], comportement: 'belier',
      necessite_orientation: true,
    });
    expect(belier.requiresOrientation).toBe(true);
  });

  it('est false pour une amélioration neutre (necessite_orientation: false)', () => {
    const blindage = ImprovementType.from({
      nom: 'Blindage', nom_interne: 'blindage', prix: 4, emplacement: 1,
      description: '', regles: '', sponsors_autorises: [],
      necessite_orientation: false,
    });
    expect(blindage.requiresOrientation).toBe(false);
  });
});

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
    necessite_orientation: comportement === 'belier' || comportement === 'belier_explosif',
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

  it('refuse une amélioration nécessitant une orientation (necessite_orientation=true) sans orientation fournie', () => {
    const v = vehicleWith([]);
    const r = v.canAddImprovement(improvementType('belier', 'belier', 1), null, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('Une orientation est requise pour cette amélioration');
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

describe('Vehicle.canAddImprovementInAnyOrientation — verdict de disponibilité (listing)', () => {
  it('renvoie ok() directement si l\'amélioration ne nécessite aucune orientation', () => {
    const v = vehicleWith([]);
    const r = v.canAddImprovementInAnyOrientation(improvementType('chenilles', 'chenilles', 1), 100);
    expect(r.ok).toBe(true);
  });

  it('sonde chaque arc et renvoie le signal "orientation requise" dès qu\'un arc est libre (Bélier avant occupé, gauche libre) — pas un ok() muet', () => {
    // Un arc libre rend l'amélioration proposable, mais l'utilisateur doit encore
    // choisir laquelle : le verdict reste `fail('orientation requise')`, jamais
    // l'`ok()` d'un arc sondé silencieusement (cf. doc de la méthode).
    const belier = new Improvement(1, improvementType('belier', 'belier', 1), 'avant', false);
    const v = vehicleWith([belier]);
    const r = v.canAddImprovementInAnyOrientation(improvementType('belier', 'belier', 1), 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('Une orientation est requise pour cette amélioration');
  });

  it('refuse (dernière raison) si TOUS les arcs sont occupés', () => {
    const orientations: readonly ('avant' | 'arrière' | 'gauche' | 'droite')[] = ['avant', 'arrière', 'gauche', 'droite'];
    const beliers = orientations.map(
      (o, i) => new Improvement(i + 1, improvementType('belier', 'belier', 1), o, false),
    );
    const v = vehicleWith(beliers, { emplacements: 10 });
    const r = v.canAddImprovementInAnyOrientation(improvementType('belier', 'belier', 1), 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Un Bélier occupe déjà');
  });

  it('refuse sans sonder les arcs si le budget est insuffisant (garde commune à canAddImprovement)', () => {
    const cherBelier = ImprovementType.from({
      nom: 'belier', nom_interne: 'belier', prix: 999, emplacement: 1,
      description: '', regles: '', sponsors_autorises: [], comportement: 'belier',
      necessite_orientation: true,
    });
    const v = vehicleWith([]);
    const r = v.canAddImprovementInAnyOrientation(cherBelier, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Budget');
  });
});

describe('Vehicle.canAddWeapon/addWeapon — montage sur Tourelle (orientation \'tourelle\')', () => {
  it('refuse le montage sur Tourelle si l\'arme ne le permet pas', () => {
    const v = makeVehicle();
    const r = v.canAddWeapon(makeWeaponType(), 'tourelle', 100); // makeWeaponType() : montable_tourelle absent
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('ne peut pas être montée sur Tourelle');
  });

  it('calcule le coût ×3 pour un montage sur Tourelle', () => {
    const v = makeVehicle();
    const r = v.canAddWeapon(makeTourelleWeaponType(5), 'tourelle', 15);
    expect(r.ok).toBe(true); // 5×3=15, budget exactement suffisant
    const insuffisant = v.canAddWeapon(makeTourelleWeaponType(5), 'tourelle', 10);
    expect(insuffisant.ok).toBe(false);
    if (!insuffisant.ok) expect(insuffisant.reason).toContain('Budget');
  });

  it('addWeapon monte l\'arme sur Tourelle : orientation \'tourelle\', prix ×3', () => {
    const v = makeVehicle();
    v.addWeapon(makeTourelleWeaponType(5), 'tourelle', 100);
    expect(v.weapons[0].orientation).toBe('tourelle');
    expect(v.weapons[0].price).toBe(15);
  });

  it('removeWeapon refuse de retirer une arme estDefaut (Canon de 125mm du Char d\'assaut)', () => {
    const canon = new Weapon(1, makeTourelleWeaponType(6, 3), 'tourelle', true);
    const v = new Vehicle(1, 10, makeVehicleType(), [canon], []);
    expect(() => v.removeWeapon(1)).toThrow('intégrées au profil de base');
  });
});
