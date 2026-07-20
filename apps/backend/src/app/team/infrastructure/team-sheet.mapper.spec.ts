import { describe, it, expect } from 'vitest';
import { Vehicle } from '../domain/vehicle';
import { VehicleType } from '../domain/value-objects/vehicle-type';
import { WeaponType } from '../domain/value-objects/weapon-type';
import { ImprovementType } from '../domain/value-objects/improvement-type';
import { AdvantageType } from '../domain/value-objects/advantage-type';
import { SequellaType } from '../domain/value-objects/sequella-type';
import { Weapon } from '../domain/weapon';
import { Improvement } from '../domain/improvement';
import { Advantage } from '../domain/advantage';
import { vehicleToSheetDto, teamToSheetDto } from './team-sheet.mapper';

function makeVehicleType(): VehicleType {
  return VehicleType.from({
    nom: 'Voiture', nom_interne: 'voiture', poids: 'Moyen',
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements: 4, prix: 12, description: '', regles: '', sponsors_autorises: [],
  });
}

function makeWeaponType(overrides: Partial<Parameters<typeof WeaponType.from>[0]> = {}): WeaponType {
  return WeaponType.from({
    nom: 'Mitrailleuse Lourde', nom_interne: 'mitrailleuse_lourde', type: 'base',
    prix: 3, emplacement: 1, description: '', regles: '<p>Portée : Double.</p>',
    sponsors_autorises: [], necessite_orientation: true,
    ...overrides,
  });
}

function makeEquipageWeaponType(): WeaponType {
  return WeaponType.from({
    nom: 'Grenades', nom_interne: 'grenades', type: 'équipage',
    prix: 1, emplacement: 0, description: '', regles: '<p>Blitz.</p>',
    sponsors_autorises: [], necessite_orientation: false,
    munitions: 5, effet_court: 'Blitz + impact',
  });
}

function makeImprovementType(overrides: Partial<Parameters<typeof ImprovementType.from>[0]> = {}): ImprovementType {
  return ImprovementType.from({
    nom: 'Blindage', nom_interne: 'blindage', prix: 4, emplacement: 1,
    description: '', regles: '<p>+2 Carrosserie.</p>', sponsors_autorises: [],
    necessite_orientation: false,
    ...overrides,
  });
}

function makeAdvantageType(overrides: Partial<Parameters<typeof AdvantageType.from>[0]> = {}): AdvantageType {
  return AdvantageType.from({
    nom: 'Expertise', nom_interne: 'expertise', categorie: 'Précision', prix: 3,
    description: '', regles: '<p>+1 Manœuvrabilité.</p>', effet_court: '+1 Manœuvrabilité',
    ...overrides,
  });
}

function makeSequellaType(overrides: Partial<Parameters<typeof SequellaType.from>[0]> = {}): SequellaType {
  return SequellaType.from({
    nom: 'Rouille', nom_interne: 'maintenu_par_la_rouille', description: '',
    regles: 'Double tirage.', chocs_cost: 5, origine: 'ATELIER',
    effet_court: 'Double tirage Épaves',
    ...overrides,
  });
}

function makeVehicle(): Vehicle {
  return new Vehicle(1, 10, makeVehicleType(), [], []);
}

describe('vehicleToSheetDto', () => {
  it('reprend les stats effectives et le coût du véhicule', () => {
    const vehicle = makeVehicle();
    const dto = vehicleToSheetDto(vehicle);

    expect(dto.id).toBe(1);
    expect(dto.typeNom).toBe('Voiture');
    expect(dto.poids).toBe('Moyen');
    expect(dto.carrosserie).toBe(6);
    expect(dto.manoeuvrabilite).toBe(4);
    expect(dto.gearMax).toBe(6);
    expect(dto.equipage).toBe(2);
    expect(dto.emplacementsTotal).toBe(4);
    expect(dto.cost).toBe(12);
  });

  it('chocs et séquelles sont vides pour un véhicule hors contexte campagne', () => {
    const dto = vehicleToSheetDto(makeVehicle());
    expect(dto.chocs).toBe(0);
    expect(dto.equipment.filter((e) => e.category === 'sequelle')).toHaveLength(0);
  });

  it('inclut une arme active avec son libellé court et ses munitions', () => {
    const vehicle = makeVehicle();
    vehicle.addWeapon(makeWeaponType({ munitions: 3, effet_court: 'Impact + recul' }), 'avant', 100);
    const dto = vehicleToSheetDto(vehicle);

    const row = dto.equipment.find((e) => e.category === 'arme');
    expect(row).toBeDefined();
    expect(row?.nom).toBe('Mitrailleuse Lourde');
    expect(row?.facing).toBe('Avant');
    expect(row?.shortLabel).toBe('Impact + recul');
    expect(row?.munitions).toBe(3);
  });

  it('replie shortLabel et munitions à null quand absents du catalogue', () => {
    const vehicle = makeVehicle();
    vehicle.addWeapon(makeWeaponType(), 'arrière', 100);
    const dto = vehicleToSheetDto(vehicle);

    const row = dto.equipment.find((e) => e.category === 'arme');
    expect(row?.shortLabel).toBeNull();
    expect(row?.munitions).toBeNull();
  });

  it('formate "Équipage" pour une arme d\'équipage (orientation null)', () => {
    const vehicle = makeVehicle();
    vehicle.addWeapon(makeEquipageWeaponType(), null, 100);
    const dto = vehicleToSheetDto(vehicle);

    const row = dto.equipment.find((e) => e.category === 'arme');
    expect(row?.facing).toBe('Équipage');
    expect(row?.munitions).toBe(5);
  });

  it('formate "360°" pour une arme à arc automatique non-équipage (orientation null)', () => {
    const vehicle = makeVehicle();
    const boule = makeWeaponType({
      nom: 'Boule de démolition', nom_interne: 'boule_de_demolition', type: 'avancée',
      necessite_orientation: false,
    });
    vehicle.addWeapon(boule, null, 100);
    const dto = vehicleToSheetDto(vehicle);

    expect(dto.equipment.find((e) => e.category === 'arme')?.facing).toBe('360°');
  });

  it('formate "Tourelle" pour une arme montée sur Tourelle', () => {
    const vehicle = makeVehicle();
    vehicle.addWeapon(makeWeaponType({ montable_tourelle: true }), 'tourelle', 100);
    const dto = vehicleToSheetDto(vehicle);

    expect(dto.equipment.find((e) => e.category === 'arme')?.facing).toBe('Tourelle');
  });

  it('exclut une arme vendue ou perdue', () => {
    const vehicle = makeVehicle();
    vehicle.addWeapon(makeWeaponType(), 'avant', 100);
    const weapon = vehicle.weapons[0] as Weapon;
    weapon.markSold();
    expect(vehicleToSheetDto(vehicle).equipment).toHaveLength(0);
  });

  it('une amélioration orientée formate son arc, une non-orientée affiche "—"', () => {
    const vehicle = makeVehicle();
    vehicle.addImprovement(makeImprovementType(), null, 100);
    const belier = makeImprovementType({
      nom: 'Bélier', nom_interne: 'belier', comportement: 'belier', necessite_orientation: true,
    });
    vehicle.addImprovement(belier, 'lateral', 100);
    const dto = vehicleToSheetDto(vehicle);

    const rows = dto.equipment.filter((e) => e.category === 'amelioration');
    expect(rows.find((r) => r.nomInterne === 'blindage')?.facing).toBe('—');
    expect(rows.find((r) => r.nomInterne === 'belier')?.facing).toBe('Latéral');
  });

  it('une amélioration à usage limité (ex. Bélier Explosif, Nitro) expose ses munitions', () => {
    const vehicle = makeVehicle();
    const belierExplosif = makeImprovementType({
      nom: 'Bélier Explosif', nom_interne: 'belier_explosif', comportement: 'belier_explosif',
      necessite_orientation: true, munitions: 1, effet_court: '+6 dés 1er choc',
    });
    vehicle.addImprovement(belierExplosif, 'avant', 100);
    const dto = vehicleToSheetDto(vehicle);

    const row = dto.equipment.find((e) => e.category === 'amelioration');
    expect(row?.munitions).toBe(1);
    expect(row?.shortLabel).toBe('+6 dés 1er choc');
  });

  it('exclut une amélioration vendue ou perdue', () => {
    const vehicle = makeVehicle();
    vehicle.addImprovement(makeImprovementType(), null, 100);
    (vehicle.improvements[0] as Improvement).markLost();
    expect(vehicleToSheetDto(vehicle).equipment).toHaveLength(0);
  });

  it('un avantage a toujours facing "—", jamais de munitions', () => {
    const vehicle = makeVehicle();
    vehicle.addAdvantage(makeAdvantageType(), 100);
    const dto = vehicleToSheetDto(vehicle);

    const row = dto.equipment.find((e) => e.category === 'avantage');
    expect(row?.facing).toBe('—');
    expect(row?.munitions).toBeNull();
    expect(row?.shortLabel).toBe('+1 Manœuvrabilité');
  });

  it('exclut un avantage vendu ou perdu', () => {
    const vehicle = makeVehicle();
    vehicle.addAdvantage(makeAdvantageType(), 100);
    (vehicle.advantages[0] as Advantage).markSold();
    expect(vehicleToSheetDto(vehicle).equipment).toHaveLength(0);
  });

  it('inclut une séquelle active, avec facing "—"', () => {
    const vehicle = makeVehicle();
    vehicle.addCampaignSequella(makeSequellaType(), 1);
    const dto = vehicleToSheetDto(vehicle);

    const row = dto.equipment.find((e) => e.category === 'sequelle');
    expect(row).toBeDefined();
    expect(row?.facing).toBe('—');
    expect(row?.shortLabel).toBe('Double tirage Épaves');
  });

  it('exclut une séquelle vendue (aucune notion de "perdue" pour une séquelle)', () => {
    const vehicle = makeVehicle();
    const sequella = vehicle.addCampaignSequella(makeSequellaType(), 1);
    vehicle.markSequellaSold(sequella.id);
    expect(vehicleToSheetDto(vehicle).equipment).toHaveLength(0);
  });
});

describe('teamToSheetDto', () => {
  it('assemble le nom d\'équipe, le sponsor et les véhicules actifs', () => {
    const dto = teamToSheetDto('Les Enragés', 'Rutherford', [makeVehicle()]);
    expect(dto.teamName).toBe('Les Enragés');
    expect(dto.sponsor).toBe('Rutherford');
    expect(dto.vehicles).toHaveLength(1);
  });

  it('exclut un véhicule vendu de la fiche', () => {
    const vehicle = makeVehicle();
    vehicle.markSold();
    const dto = teamToSheetDto('Les Enragés', 'Rutherford', [vehicle]);
    expect(dto.vehicles).toHaveLength(0);
  });
});
