import { describe, it, expect } from 'vitest';
import { Vehicle } from './vehicle';
import { VehicleType } from './value-objects/vehicle-type';
import { WeaponType } from './value-objects/weapon-type';
import { ImprovementType } from './value-objects/improvement-type';
import { AdvantageType } from './value-objects/advantage-type';
import { SequellaType } from './value-objects/sequella-type';
import { Improvement } from './improvement';
import { Weapon } from './weapon';
import { Advantage } from './advantage';
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

function makeAdvantageType(nomInterne: string, prix = 3, categorie = 'Précision', comportement?: string): AdvantageType {
  return AdvantageType.from({
    nom: nomInterne, nom_interne: nomInterne, categorie, prix,
    description: '', regles: '', comportement,
  });
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

  describe('markFavoriDuPublic / clearFavoriDuPublic', () => {
    it('hasFavoriDuPublic est false par défaut', () => {
      expect(makeVehicle().hasFavoriDuPublic).toBe(false);
    });

    it('markFavoriDuPublic est idempotent', () => {
      const v = makeVehicle();
      v.markFavoriDuPublic();
      v.markFavoriDuPublic();
      expect(v.hasFavoriDuPublic).toBe(true);
    });

    it('clearFavoriDuPublic remet le véhicule à l\'état sans bonus', () => {
      const v = makeVehicle();
      v.markFavoriDuPublic();
      v.clearFavoriDuPublic();
      expect(v.hasFavoriDuPublic).toBe(false);
    });
  });

  describe('clearCampaignState', () => {
    it('remet tous les états transients de campagne à leur valeur par défaut', () => {
      const v = makeVehicle();
      v.markLost();
      v.markSold();
      v.addChocs(3);
      v.markFavoriDuPublic();

      v.clearCampaignState();

      expect(v.isLost).toBe(false);
      expect(v.isSold).toBe(false);
      expect(v.chocs).toBe(0);
      expect(v.hasFavoriDuPublic).toBe(false);
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

  describe('addCampaignSequella / removeSequella', () => {
    const siege = SequellaType.from({
      nom: 'Siège irrécupérable', nom_interne: 'siege_irrecuperable', description: '', regles: '', chocs_cost: 2, origine: 'TABLE_EPAVES',
    });
    const chassis = SequellaType.from({
      nom: 'Châssis fragilisé', nom_interne: 'chassis_fragilise', description: '', regles: '', chocs_cost: 2, origine: 'TABLE_EPAVES',
    });

    it('sequellas est vide par défaut', () => {
      expect(makeVehicle().sequellas).toHaveLength(0);
    });

    it('addCampaignSequella empile les séquelles dans l\'ordre d\'application, avec l\'id fourni', () => {
      const v = makeVehicle();
      v.addCampaignSequella(siege, -1);
      v.addCampaignSequella(chassis, -2);
      expect(v.sequellas).toHaveLength(2);
      expect(v.sequellas[0].type.nomInterne).toBe('siege_irrecuperable');
      expect(v.sequellas[0].id).toBe(-1);
      expect(v.sequellas[1].type.nomInterne).toBe('chassis_fragilise');
    });

    it('removeSequella retire la séquelle ciblée par son id (undo d\'un achat)', () => {
      const v = makeVehicle();
      v.addCampaignSequella(siege, -1);
      v.addCampaignSequella(chassis, -2);
      v.removeSequella(-2);
      expect(v.sequellas).toHaveLength(1);
      expect(v.sequellas[0].type.nomInterne).toBe('siege_irrecuperable');
    });

    it('removeSequella lève DomainException si la séquelle est introuvable', () => {
      const v = makeVehicle();
      expect(() => v.removeSequella(-1)).toThrow(DomainException);
    });
  });

  describe('canAddSequella', () => {
    const suicidaire = SequellaType.from({
      nom: 'Suicidaire', nom_interne: 'suicidaire', description: '', regles: '', chocs_cost: 1, origine: 'ATELIER',
    });
    const siegeIrrecuperable = SequellaType.from({
      nom: 'Siège irrécupérable', nom_interne: 'siege_irrecuperable', description: '', regles: '', chocs_cost: 0, origine: 'TABLE_EPAVES',
    });

    it('rejette une séquelle TABLE_EPAVES (jamais achetable en atelier)', () => {
      const v = makeVehicle();
      v.addChocs(5);
      const result = v.canAddSequella(siegeIrrecuperable);
      expect(result.ok).toBe(false);
    });

    it('rejette si les Chocs sont insuffisants', () => {
      const v = makeVehicle();
      expect(v.canAddSequella(suicidaire).ok).toBe(false);
    });

    it('rejette si la séquelle ATELIER est déjà active sur ce véhicule', () => {
      const v = makeVehicle();
      v.addChocs(5);
      v.addCampaignSequella(suicidaire, -1);
      expect(v.canAddSequella(suicidaire).ok).toBe(false);
    });

    it('accepte une séquelle ATELIER avec Chocs suffisants et pas déjà acquise', () => {
      const v = makeVehicle();
      v.addChocs(5);
      expect(v.canAddSequella(suicidaire).ok).toBe(true);
    });
  });

  describe('assertCanAddSequella', () => {
    const suicidaire = SequellaType.from({
      nom: 'Suicidaire', nom_interne: 'suicidaire', description: '', regles: '', chocs_cost: 1, origine: 'ATELIER',
    });
    const durACuire = SequellaType.from({
      nom: 'Dur à Cuire', nom_interne: 'dur_a_cuire', description: '', regles: '', chocs_cost: 1, origine: 'ATELIER',
    });
    const avantageGratuit = makeAdvantageType('coriace');

    it('lève DomainException quand le verdict canAddSequella échoue (Chocs insuffisants)', () => {
      const v = makeVehicle();
      expect(() => v.assertCanAddSequella(suicidaire, null)).toThrow(DomainException);
    });

    it('ne lève pas pour une séquelle ATELIER ordinaire valide (sans avantage gratuit)', () => {
      const v = makeVehicle();
      v.addChocs(5);
      expect(() => v.assertCanAddSequella(suicidaire, null)).not.toThrow();
    });

    it('lève pour "Dur à Cuire" si aucun avantage gratuit n\'est fourni', () => {
      const v = makeVehicle();
      v.addChocs(5);
      expect(() => v.assertCanAddSequella(durACuire, null)).toThrow(DomainException);
      expect(() => v.assertCanAddSequella(durACuire, null)).toThrow('Dur à Cuire');
    });

    it('ne lève pas pour "Dur à Cuire" quand un avantage gratuit est fourni', () => {
      const v = makeVehicle();
      v.addChocs(5);
      expect(() => v.assertCanAddSequella(durACuire, avantageGratuit)).not.toThrow();
    });
  });

  describe('canRemoveSequella / isSequellaRemovable / hasActiveSequella', () => {
    const legendeVivante = SequellaType.from({
      nom: 'Légende Vivante', nom_interne: 'legende_vivante', description: '', regles: '', chocs_cost: 11, origine: 'ATELIER',
    });
    const suicidaire = SequellaType.from({
      nom: 'Suicidaire', nom_interne: 'suicidaire', description: '', regles: '', chocs_cost: 1, origine: 'ATELIER',
    });
    const siegeIrrecuperable = SequellaType.from({
      nom: 'Siège irrécupérable', nom_interne: 'siege_irrecuperable', description: '', regles: '', chocs_cost: 0, origine: 'TABLE_EPAVES',
    });

    it('rejette la revente par défaut (pas de Légende Vivante active)', () => {
      const v = makeVehicle();
      expect(v.canRemoveSequella(suicidaire).ok).toBe(false);
    });

    it('autorise la revente d\'une séquelle ATELIER si Légende Vivante est active sur ce véhicule', () => {
      const v = makeVehicle();
      v.addCampaignSequella(legendeVivante, -1);
      expect(v.canRemoveSequella(suicidaire).ok).toBe(true);
      expect(v.hasActiveSequella('legende_vivante')).toBe(true);
    });

    it('rejette toujours une séquelle TABLE_EPAVES, même avec Légende Vivante active', () => {
      const v = makeVehicle();
      v.addCampaignSequella(legendeVivante, -1);
      expect(v.canRemoveSequella(siegeIrrecuperable).ok).toBe(false);
    });

    it('isSequellaRemovable retourne false pour une origine TABLE_EPAVES, true pour ATELIER', () => {
      const v = makeVehicle();
      expect(v.isSequellaRemovable(siegeIrrecuperable)).toBe(false);
      expect(v.isSequellaRemovable(suicidaire)).toBe(true);
    });

    it('hasActiveSequella retourne false pour une séquelle absente', () => {
      expect(makeVehicle().hasActiveSequella('legende_vivante')).toBe(false);
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
    const r = v.canAddImprovement(improvementType('belier', 'belier', 1), 'lateral', 100);
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

  it('une paire de Chenilles VENDUE ne compte plus pour l\'unicité — en remonter une nouvelle est autorisé', () => {
    const vendue = new Improvement(1, improvementType('chenilles', 'chenilles', 1), null, false);
    vendue.markSold();
    const v = vehicleWith([vendue]);
    const r = v.canAddImprovement(improvementType('chenilles', 'chenilles', 1), null, 100);
    expect(r.ok).toBe(true);
  });

  it('membre d\'équipage : le seuil (baseStats.equipage) n\'est pas réduit par une séquelle, contrairement à la valeur testée', () => {
    const siegeIrrecuperable = SequellaType.from({
      nom: 'Siège irrécupérable', nom_interne: 'siege_irrecuperable', description: '', regles: '', chocs_cost: 0, origine: 'TABLE_EPAVES',
    });
    const crew = (): Improvement => new Improvement(0, improvementType('membre_equipage', 'membre_equipage', 0), null, false);
    // Sans séquelle, 2 membres existants + candidat donnent un effectif de 5 > seuil 4 (base×2)
    // → refusé (cf. le test « refuse un membre d'équipage au-delà du double » ci-dessus).
    // Avec Siège Irrécupérable (-1 équipage), l'effectif tombe à 4 = seuil → autorisé, alors que
    // le SEUIL lui-même reste ancré sur `baseStats.equipage` (2), jamais réduit par la séquelle.
    const v = vehicleWith([crew(), crew()], { equipage: 2 });
    v.addCampaignSequella(siegeIrrecuperable, -1);
    const r = v.canAddImprovement(improvementType('membre_equipage', 'membre_equipage', 0), null, 100);
    expect(r.ok).toBe(true);
  });
});

describe('Vehicle — Remorques (capacité extensible via applyStats)', () => {
  it('Remorque Moyenne refusée sur un véhicule de Poids Léger', () => {
    const v = vehicleWith([], { poids: 'Léger' });
    const r = v.canAddImprovement(improvementType('remorque_moyenne', 'remorque_moyenne', 0), null, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Remorque Moyenne');
  });

  it('Remorque Moyenne acceptée sur un véhicule de Poids Moyen', () => {
    const v = vehicleWith([], { poids: 'Moyen' });
    const r = v.canAddImprovement(improvementType('remorque_moyenne', 'remorque_moyenne', 0), null, 100);
    expect(r.ok).toBe(true);
  });

  it('Remorque Lourde refusée sur un véhicule de Poids Moyen', () => {
    const v = vehicleWith([], { poids: 'Moyen' });
    const r = v.canAddImprovement(improvementType('remorque_lourde', 'remorque_lourde', 0), null, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Remorque Lourde');
  });

  it('Remorque Lourde acceptée sur un véhicule de Poids Lourd', () => {
    const v = vehicleWith([], { poids: 'Lourd' });
    const r = v.canAddImprovement(improvementType('remorque_lourde', 'remorque_lourde', 0), null, 100);
    expect(r.ok).toBe(true);
  });

  it('une seule remorque par véhicule — Remorque Moyenne montée bloque la Remorque Lourde', () => {
    const moyenne = new Improvement(1, improvementType('remorque_moyenne', 'remorque_moyenne', 0), null, false);
    const v = vehicleWith([moyenne], { poids: 'Lourd' });
    const r = v.canAddImprovement(improvementType('remorque_lourde', 'remorque_lourde', 0), null, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('une seule remorque');
  });

  it('une seule remorque par véhicule — Remorque Lourde montée bloque la Remorque Moyenne', () => {
    const lourde = new Improvement(1, improvementType('remorque_lourde', 'remorque_lourde', 0), null, false);
    const v = vehicleWith([lourde], { poids: 'Lourd' });
    const r = v.canAddImprovement(improvementType('remorque_moyenne', 'remorque_moyenne', 0), null, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('une seule remorque');
  });

  it('la Remorque Moyenne augmente la capacité effective disponible (+1 emplacement)', () => {
    // Capacité totale 1, entièrement consommée par un premier objet — la Remorque elle-même
    // coûte 0 emplacement au catalogue, donc son propre ajout ne dépend jamais de la capacité.
    const filler = new Improvement(1, makeImprovementType(4, 1), null, false);
    const v = vehicleWith([filler], { poids: 'Moyen', emplacements: 1 });

    // Sans remorque : plus aucun emplacement disponible pour un second objet de 1 slot.
    const refuse = v.canAddImprovement(makeImprovementType(4, 1), null, 100);
    expect(refuse.ok).toBe(false);
    if (!refuse.ok) expect(refuse.reason).toBe('Emplacements insuffisants sur ce véhicule');

    v.addImprovement(improvementType('remorque_moyenne', 'remorque_moyenne', 0), null, 100);

    // Après la Remorque (+1), la capacité effective passe à 2 — le second objet devient acceptable.
    const accepte = v.canAddImprovement(makeImprovementType(4, 1), null, 100);
    expect(accepte.ok).toBe(true);
  });
});

describe('Vehicle.canAddImprovementInAnyOrientation — verdict de disponibilité (listing)', () => {
  it('renvoie ok() directement si l\'amélioration ne nécessite aucune orientation', () => {
    const v = vehicleWith([]);
    const r = v.canAddImprovementInAnyOrientation(improvementType('chenilles', 'chenilles', 1), 100);
    expect(r.ok).toBe(true);
  });

  it('sonde chaque arc et renvoie le signal "orientation requise" dès qu\'un arc est libre (Bélier avant occupé, lateral libre) — pas un ok() muet', () => {
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
    const orientations: readonly ('avant' | 'arrière' | 'lateral')[] = ['avant', 'arrière', 'lateral'];
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

// Régression : RemoveImprovementUseCase levait autrefois un ForbiddenException (403)
// dupliquant ce contrôle en amont de l'agrégat — l'agrégat le faisait déjà (400, comme
// removeWeapon ci-dessus), mais rien ne le testait à ce niveau. Cf. [[feedback_business_rules_in_domain_only]].
describe('Vehicle.removeImprovement — miroir de removeWeapon (mêmes garanties)', () => {
  it('refuse de retirer une amélioration estDefaut (ex. Arceaux du Buggy)', () => {
    const arceaux = new Improvement(1, makeImprovementType(), null, true);
    const v = new Vehicle(1, 10, makeVehicleType(), [], [arceaux]);
    expect(() => v.removeImprovement(1)).toThrow('intégrées au profil de base');
  });

  it('lève DomainException si l\'amélioration est introuvable', () => {
    const v = makeVehicle();
    expect(() => v.removeImprovement(999)).toThrow('introuvable');
  });

  it('retire normalement une amélioration achetée (estDefaut: false)', () => {
    const belier = new Improvement(1, makeImprovementType(), null, false);
    const v = new Vehicle(1, 10, makeVehicleType(), [], [belier]);
    v.removeImprovement(1);
    expect(v.improvements).toHaveLength(0);
  });
});

describe('Vehicle.buildChain — contribution portée par les flags (refactor)', () => {
  // Sonde : Cascadeur exige une Manœuvrabilité EFFECTIVE ≥ 3 ; son verdict révèle donc
  // ce que la chaîne a réellement plié (défauts, séquelles, objets vendus).
  const cascadeur = (): AdvantageType => makeAdvantageType('cascadeur', 7, 'Audace', 'cascadeur');

  // Véhicule Moyen, manœuvrabilité 3 : Cascadeur tout juste éligible sans modificateur.
  function moyenManoeuvre3(): VehicleType {
    return VehicleType.from({
      nom: 'V', nom_interne: 'voiture', poids: 'Moyen',
      carrosserie: 6, manoeuvrabilite: 3, vitesse_max: 6, equipage: 2,
      emplacements: 10, prix: 12, description: '', regles: '', sponsors_autorises: [],
    });
  }
  function moyenManoeuvre2(): VehicleType {
    return VehicleType.from({
      nom: 'Ambulance', nom_interne: 'ambulance', poids: 'Moyen',
      carrosserie: 6, manoeuvrabilite: 2, vitesse_max: 5, equipage: 2,
      emplacements: 10, prix: 12, description: '', regles: '', sponsors_autorises: [],
    });
  }

  const siegeIrrecuperable = SequellaType.from({
    nom: 'Siège irrécupérable', nom_interne: 'siege_irrecuperable', description: '', regles: '', chocs_cost: 0, origine: 'TABLE_EPAVES',
  });
  const suicidaire = SequellaType.from({
    nom: 'Suicidaire', nom_interne: 'suicidaire', description: '', regles: '', chocs_cost: 1, origine: 'ATELIER',
  });

  it('séquelle câblée : "Siège irrécupérable" (-1 équipage) modifie bien les stats effectives', () => {
    const v = new Vehicle(1, 10, moyenManoeuvre3(), [], []);
    expect(v.effectiveStats.equipage).toBe(2); // sans séquelle
    v.addCampaignSequella(siegeIrrecuperable, -1);
    expect(v.effectiveStats.equipage).toBe(1); // 2 - 1
  });

  it('séquelle vendue neutralisée : un "Siège irrécupérable" vendu ne réduit plus l\'équipage', () => {
    const v = new Vehicle(1, 10, moyenManoeuvre3(), [], []);
    v.addCampaignSequella(siegeIrrecuperable, -1);
    v.markSequellaSold(-1);
    expect(v.effectiveStats.equipage).toBe(2); // effet annulé
  });

  it('séquelle sans effet chiffré ("Suicidaire") : repli Neutral, aucune stat modifiée', () => {
    const v = new Vehicle(1, 10, moyenManoeuvre3(), [], []);
    v.addCampaignSequella(suicidaire, -1);
    expect(v.canAddAdvantage(cascadeur(), 100).ok).toBe(true); // manœuvrabilité inchangée = 3
  });

  it('amélioration intégrée à effet chiffré : ses stats sont pliées (Chenilles estDefaut +1 → Cascadeur éligible)', () => {
    // Chenilles INTÉGRÉE (estDefaut: true) : applique son +1 manœuvrabilité, sans consommer d'emplacement.
    const chenillesDefaut = new Improvement(1, improvementType('chenilles', 'chenilles', 1), null, true);
    const v = new Vehicle(1, 10, moyenManoeuvre2(), [], [chenillesDefaut]);
    expect(v.canAddAdvantage(cascadeur(), 100).ok).toBe(true); // 2 + 1 (défaut) = 3
  });

  it('avantage vendu neutralisé : un "Expertise" vendu ne réapplique pas son +1 manœuvrabilité', () => {
    const expertiseVendu = new Advantage(1, makeAdvantageType('expertise', 3, 'Précision', 'expertise'));
    expertiseVendu.markSold();
    const v = new Vehicle(1, 10, moyenManoeuvre2(), [], [], [expertiseVendu]);
    expect(v.canAddAdvantage(cascadeur(), 100).ok).toBe(false); // +1 non appliqué → 2 < 3
  });

  it('régression isSold (amélioration) : une amélioration vendue ne consomme plus d\'emplacement dans la chaîne', () => {
    // Capacité 2 ; une amélioration de 2 emplacements, VENDUE → slots libérés (0).
    const vendue = new Improvement(1, makeImprovementType(4, 2), null, false);
    vendue.markSold();
    const v = new Vehicle(1, 10, makeVehicleType(2, 12), [], [vendue]);
    // Ajouter une amélioration de 2 emplacements doit passer (l'objet vendu compte 0
    // dans totalEmplacements ; avant le refactor, il sur-comptait et faisait échouer).
    expect(v.canAddImprovement(makeImprovementType(4, 2), null, 100).ok).toBe(true);
  });
});

// ── Avantages ──────────────────────────────────────────────────────────────────

describe('Vehicle.cost — inclut les avantages', () => {
  it('additionne le prix des avantages au coût total', () => {
    const v = makeVehicle();
    v.addAdvantage(makeAdvantageType('expertise', 3), 100);
    // 12 (véhicule nu) + 3 (expertise)
    expect(v.cost).toBe(15);
  });
});

describe('Vehicle.resaleRefund — règle par élément (châssis + équipement actif à moitié prix, avantages à 0)', () => {
  it('vaut la moitié du prix châssis (arrondi inférieur) sur un véhicule nu', () => {
    const v = makeVehicle(4, 12);
    expect(v.resaleRefund).toBe(6); // floor(12/2)
  });

  it('ajoute la moitié du prix de chaque arme/amélioration ACTIVE (arrondi inférieur)', () => {
    const v = makeVehicle(4, 12);
    v.addWeapon(makeWeaponType(5), 'avant', 100);
    v.addImprovement(makeImprovementType(4), null, 100);
    // floor(12/2) + floor(5/2) + floor(4/2) = 6 + 2 + 2 = 10
    expect(v.resaleRefund).toBe(10);
  });

  it('les avantages ne contribuent jamais (perte totale)', () => {
    const v = makeVehicle(4, 12);
    v.addAdvantage(makeAdvantageType('expertise', 3), 100);
    expect(v.cost).toBe(15);
    expect(v.resaleRefund).toBe(6); // floor(12/2) seulement — l'avantage n'ajoute rien
  });

  it('exclut de la somme une arme/amélioration DÉJÀ vendue — pas de double remboursement', () => {
    const v = makeVehicle(4, 12);
    v.addWeapon(makeWeaponType(5), 'avant', 100);
    v.addImprovement(makeImprovementType(4), null, 100);
    v.markWeaponSold(v.weapons[0].id);
    // L'arme déjà vendue a déjà été remboursée à sa vente individuelle : seule
    // l'amélioration encore active contribue. floor(12/2) + floor(4/2) = 6 + 2 = 8.
    expect(v.resaleRefund).toBe(8);
  });

  it('ignore les armes/améliorations estDefaut (prix nul, non séparément revendables)', () => {
    const canon = new Weapon(1, makeTourelleWeaponType(6, 3), 'tourelle', true);
    const v = new Vehicle(1, 10, makeVehicleType(4, 12), [canon], []);
    expect(v.resaleRefund).toBe(6); // floor(12/2) — le canon intégré n'ajoute rien
  });

  it('lève DomainException si le véhicule est détruit (isLost) — délègue à chassisResaleRefund', () => {
    const v = makeVehicle(4, 12);
    v.markLost();
    expect(() => v.resaleRefund).toThrow(DomainException);
  });
});

describe('Vehicle.chassisResaleRefund — remboursement du châssis seul (isolé de resaleRefund)', () => {
  it('vaut la moitié du prix châssis (arrondi inférieur), indépendamment de l\'équipement monté', () => {
    const v = makeVehicle(4, 13);
    v.addWeapon(makeWeaponType(5), 'avant', 100);
    expect(v.chassisResaleRefund).toBe(6); // floor(13/2), ignore l'arme montée
  });

  it('lève DomainException si le véhicule est déjà vendu', () => {
    const v = makeVehicle(4, 12);
    v.markSold();
    expect(() => v.chassisResaleRefund).toThrow(DomainException);
  });

  it('lève DomainException si le véhicule est détruit (isLost) — plus aucune valeur de revente', () => {
    const v = makeVehicle(4, 12);
    v.markLost();
    expect(() => v.chassisResaleRefund).toThrow(DomainException);
  });
});

describe('Vehicle.canAddAdvantage / addAdvantage / removeAdvantage', () => {
  it('retourne fail si le véhicule est perdu', () => {
    const v = makeVehicle();
    v.markLost();
    const r = v.canAddAdvantage(makeAdvantageType('tireur_elite'), 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('hors combat');
  });

  it('refuse si le budget est insuffisant', () => {
    const v = makeVehicle();
    const r = v.canAddAdvantage(makeAdvantageType('tireur_elite', 999), 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Budget');
  });

  it('autorise un avantage neutre (sans comportement) si budget suffisant', () => {
    const v = makeVehicle();
    const r = v.canAddAdvantage(makeAdvantageType('tireur_elite', 2), 100);
    expect(r.ok).toBe(true);
  });

  it('refuse l\'acquisition d\'un même avantage une seconde fois (unicité)', () => {
    const v = makeVehicle();
    v.addAdvantage(makeAdvantageType('tireur_elite', 2), 100);
    const r = v.canAddAdvantage(makeAdvantageType('tireur_elite', 2), 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('déjà acquis');
  });

  it('permet de racheter un avantage déjà vendu (unicité ignore les avantages vendus)', () => {
    const v = makeVehicle();
    v.addAdvantage(makeAdvantageType('tireur_elite', 2), 100);
    v.markAdvantageSold(v.advantages[0].id);
    const r = v.canAddAdvantage(makeAdvantageType('tireur_elite', 2), 100);
    expect(r.ok).toBe(true);
  });

  it('addAdvantage ajoute l\'avantage au véhicule', () => {
    const v = makeVehicle();
    v.addAdvantage(makeAdvantageType('tireur_elite', 2), 100);
    expect(v.advantages).toHaveLength(1);
    expect(v.advantages[0].type.nomInterne).toBe('tireur_elite');
    expect(v.advantages[0].slots).toBe(0);
  });

  it('removeAdvantage retire l\'avantage ciblé', () => {
    const v = makeVehicle();
    v.addAdvantage(makeAdvantageType('tireur_elite', 2), 100);
    const id = v.advantages[0].id;
    v.removeAdvantage(id);
    expect(v.advantages).toHaveLength(0);
  });

  it('removeAdvantage lève DomainException si l\'avantage est introuvable', () => {
    const v = makeVehicle();
    expect(() => v.removeAdvantage(999)).toThrow(DomainException);
  });
});

describe('Advantage.price — perte totale à la revente (jamais réduit avec isSold)', () => {
  it('price reste inchangé après markSold (contrairement à Weapon/Improvement)', () => {
    const advantage = new Advantage(1, makeAdvantageType('expertise', 3));
    expect(advantage.price).toBe(3);
    advantage.markSold();
    expect(advantage.price).toBe(3); // toujours 3, jamais ceil(3/2)
    expect(advantage.slots).toBe(0);
  });

  it('clearSold est l\'inverse de markSold (idempotent)', () => {
    const advantage = new Advantage(1, makeAdvantageType('expertise', 3));
    advantage.markSold();
    advantage.markSold();
    expect(advantage.isSold).toBe(true);
    advantage.clearSold();
    expect(advantage.isSold).toBe(false);
  });

  it('clearCampaignState remet isSold à false', () => {
    const advantage = new Advantage(1, makeAdvantageType('expertise', 3));
    advantage.markSold();
    advantage.clearCampaignState();
    expect(advantage.isSold).toBe(false);
  });
});

describe('Vehicle — décorateurs d\'avantage (Expertise/Cascadeur/Sur Deux Roues)', () => {
  it('Cascadeur est refusé sur un véhicule de Poids Lourd, quelle que soit la manœuvrabilité', () => {
    const v = vehicleWith([], { poids: 'Lourd', emplacements: 10 });
    const r = v.canAddAdvantage(makeAdvantageType('cascadeur', 7, 'Audace', 'cascadeur'), 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Poids Léger ou Moyen');
  });

  it('Cascadeur est refusé sur un véhicule Léger/Moyen avec Manœuvrabilité effective < 3', () => {
    const type = VehicleType.from({
      nom: 'Ambulance', nom_interne: 'ambulance', poids: 'Moyen',
      carrosserie: 6, manoeuvrabilite: 2, vitesse_max: 5, equipage: 2,
      emplacements: 10, prix: 12, description: '', regles: '', sponsors_autorises: [],
    });
    const v = new Vehicle(1, 10, type, [], []);
    const r = v.canAddAdvantage(makeAdvantageType('cascadeur', 7, 'Audace', 'cascadeur'), 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("Manœuvrabilité effective d'au moins 3");
  });

  it('Cascadeur devient éligible si Expertise (+1) porte la Manœuvrabilité effective à 3', () => {
    const type = VehicleType.from({
      nom: 'Ambulance', nom_interne: 'ambulance', poids: 'Moyen',
      carrosserie: 6, manoeuvrabilite: 2, vitesse_max: 5, equipage: 2,
      emplacements: 10, prix: 12, description: '', regles: '', sponsors_autorises: [],
    });
    const v = new Vehicle(1, 10, type, [], []);
    v.addAdvantage(makeAdvantageType('expertise', 3, 'Précision', 'expertise'), 100);
    const r = v.canAddAdvantage(makeAdvantageType('cascadeur', 7, 'Audace', 'cascadeur'), 100);
    expect(r.ok).toBe(true);
  });

  it('Cascadeur devient éligible si Chenilles (amélioration, +1 manœuvrabilité) porte l\'effectif à 3', () => {
    const type = VehicleType.from({
      nom: 'Ambulance', nom_interne: 'ambulance', poids: 'Moyen',
      carrosserie: 6, manoeuvrabilite: 2, vitesse_max: 5, equipage: 2,
      emplacements: 10, prix: 12, description: '', regles: '', sponsors_autorises: [],
    });
    const chenilles = new Improvement(1, improvementType('chenilles', 'chenilles', 1), null, false);
    const v = new Vehicle(1, 10, type, [], [chenilles]);
    const r = v.canAddAdvantage(makeAdvantageType('cascadeur', 7, 'Audace', 'cascadeur'), 100);
    expect(r.ok).toBe(true);
  });

  it('Sur Deux Roues est refusé si Manœuvrabilité effective < 3 (aucune restriction de poids)', () => {
    const type = VehicleType.from({
      nom: 'Bus', nom_interne: 'bus', poids: 'Lourd',
      carrosserie: 10, manoeuvrabilite: 2, vitesse_max: 4, equipage: 2,
      emplacements: 10, prix: 20, description: '', regles: '', sponsors_autorises: [],
    });
    const v = new Vehicle(1, 10, type, [], []);
    const r = v.canAddAdvantage(makeAdvantageType('sur_deux_roues', 6, 'Optimisation', 'sur_deux_roues'), 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("Manœuvrabilité effective d'au moins 3");
  });

  it('Sur Deux Roues est autorisé sur un véhicule Lourd si la Manœuvrabilité effective atteint 3', () => {
    const type = VehicleType.from({
      nom: 'Bus', nom_interne: 'bus', poids: 'Lourd',
      carrosserie: 10, manoeuvrabilite: 2, vitesse_max: 4, equipage: 2,
      emplacements: 10, prix: 20, description: '', regles: '', sponsors_autorises: [],
    });
    const v = new Vehicle(1, 10, type, [], []);
    v.addAdvantage(makeAdvantageType('expertise', 3, 'Précision', 'expertise'), 100);
    const r = v.canAddAdvantage(makeAdvantageType('sur_deux_roues', 6, 'Optimisation', 'sur_deux_roues'), 100);
    expect(r.ok).toBe(true); // pas de restriction de poids, contrairement à Cascadeur
  });
});

describe('Vehicle — nom personnalisé (customName / nom / rename)', () => {
  it('customName est null tant que jamais renommé', () => {
    expect(makeVehicle().customName).toBeNull();
  });

  it('nom retourne le nom du type catalogue quand jamais renommé (sans parenthèse)', () => {
    expect(makeVehicle().nom).toBe('Voiture');
  });

  it('rename() met à jour customName et nom', () => {
    const v = makeVehicle();
    v.rename('La Teigne');
    expect(v.customName).toBe('La Teigne');
    expect(v.nom).toBe('La Teigne (Voiture)');
  });

  it('rename() trim les espaces superflus', () => {
    const v = makeVehicle();
    v.rename('  La Teigne  ');
    expect(v.customName).toBe('La Teigne');
  });

  it('nom ne montre pas de parenthèse si le nom personnalisé est identique au type', () => {
    const v = makeVehicle();
    v.rename('Voiture');
    expect(v.nom).toBe('Voiture');
  });

  it('rename() refuse une chaîne vide ou blanche', () => {
    const v = makeVehicle();
    expect(() => v.rename('')).toThrow(DomainException);
    expect(() => v.rename('   ')).toThrow(DomainException);
  });

  it('rename() refuse un nom de plus de 100 caractères', () => {
    const v = makeVehicle();
    expect(() => v.rename('a'.repeat(101))).toThrow(DomainException);
  });

  it('rename() accepte exactement 100 caractères', () => {
    const v = makeVehicle();
    expect(() => v.rename('a'.repeat(100))).not.toThrow();
  });

  it('le constructeur accepte un nom personnalisé initial (hydratation depuis l\'ORM)', () => {
    const v = new Vehicle(1, 10, makeVehicleType(), [], [], [], 'La Teigne');
    expect(v.customName).toBe('La Teigne');
    expect(v.nom).toBe('La Teigne (Voiture)');
  });
});
