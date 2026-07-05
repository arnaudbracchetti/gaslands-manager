import { describe, it, expect } from 'vitest';
import { WreckResolverService } from './wreck-resolver.service';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import { VehicleType } from '../../team/domain/value-objects/vehicle-type';
import { WeaponType } from '../../team/domain/value-objects/weapon-type';
import { ImprovementType } from '../../team/domain/value-objects/improvement-type';
import { Vehicle } from '../../team/domain/vehicle';
import { Weapon } from '../../team/domain/weapon';
import { Improvement } from '../../team/domain/improvement';

/**
 * Sous-classe testable : injecte un dé et/ou un index de tirage fixes pour rendre les
 * tests déterministes — même principe que `rollD6` pour l'index du pool armes/améliorations.
 */
class TestWreckResolver extends WreckResolverService {
  constructor(private readonly fixedRoll: number, private readonly fixedPoolIndex = 0) { super(); }
  protected override rollD6(): number { return this.fixedRoll; }
  protected override pickRandom<T>(pool: T[]): T { return pool[this.fixedPoolIndex]; }
}

function makeVehicleWithPoids(
  poids: 'Léger' | 'Moyen' | 'Lourd',
  chocs = 0,
  weapons: Weapon[] = [],
  improvements: Improvement[] = [],
): Vehicle {
  const raw = {
    nom: 'Test', nom_interne: 'test', poids,
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements: 4, prix: 12, description: '', regles: '', sponsors_autorises: [],
    ameliorations_defaut: [],
  };
  const vehicleType = VehicleType.from(raw);
  const v = new Vehicle(1, 1, vehicleType, weapons, improvements);
  if (chocs > 0) v.addChocs(chocs);
  return v;
}

function makeWeapon(id: number): Weapon {
  const type = WeaponType.from({
    nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base' as const,
    prix: 5, emplacement: 1, description: '', regles: '', sponsors_autorises: [],
  });
  return new Weapon(id, type, 'avant');
}

function makeImprovement(id: number, estDefaut = false): Improvement {
  const type = ImprovementType.from({
    nom: 'Blindage', nom_interne: 'blindage', prix: 4, emplacement: 1,
    description: '', regles: '', sponsors_autorises: [],
  });
  return new Improvement(id, type, null, estDefaut);
}

describe('WreckResolverService — Table des Épaves (9 lignes)', () => {
  describe('avec un véhicule Moyen (modificateur 0)', () => {
    it('D6=1, chocs=0 → modifié=1 → DEBOSSELE, -1 choc clampé à 0', () => {
      const resolver = new TestWreckResolver(1);
      const vehicle = makeVehicleWithPoids('Moyen', 0);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.DEBOSSELE);
      expect(outcome.chocsGained).toBe(0); // min(1, 0) = 0
      expect(outcome.diceRoll).toBe(1);
    });

    it('borne haute de DEBOSSELE : D6=1, chocs=0, poids Lourd → modifié=0 → DEBOSSELE', () => {
      const resolver = new TestWreckResolver(1);
      const vehicle = makeVehicleWithPoids('Lourd', 0);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.DEBOSSELE);
    });

    it('D6=2, chocs=0 → modifié=2 → INDEMNE', () => {
      const resolver = new TestWreckResolver(2);
      const vehicle = makeVehicleWithPoids('Moyen', 0);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.INDEMNE);
      expect(outcome.chocsGained).toBe(0);
    });

    it('D6=4, chocs=0 → modifié=4 → ROUE_CABOSSEE (+1)', () => {
      const resolver = new TestWreckResolver(4);
      const vehicle = makeVehicleWithPoids('Moyen', 0);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.ROUE_CABOSSEE);
      expect(outcome.chocsGained).toBe(1);
    });

    it('D6=5, chocs=0, avec une arme et une amélioration → ARRACHEE (+1), perte tirée dans le pool', () => {
      const resolver = new TestWreckResolver(5, 0);
      const weapon = makeWeapon(7);
      const improvement = makeImprovement(8);
      const vehicle = makeVehicleWithPoids('Moyen', 0, [weapon], [improvement]);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.ARRACHEE);
      expect(outcome.chocsGained).toBe(1);
      expect(outcome.lostEquipment).toEqual({ kind: 'weapon', id: 7 });
      expect(outcome.weaponLostId).toBe(7);
      expect(outcome.improvementLostId).toBeNull();
    });

    it('ARRACHEE avec pool pointant sur une amélioration', () => {
      const resolver = new TestWreckResolver(5, 1); // 2e élément du pool = l'amélioration
      const weapon = makeWeapon(7);
      const improvement = makeImprovement(8);
      const vehicle = makeVehicleWithPoids('Moyen', 0, [weapon], [improvement]);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.lostEquipment).toEqual({ kind: 'improvement', id: 8 });
      expect(outcome.improvementLostId).toBe(8);
      expect(outcome.weaponLostId).toBeNull();
    });

    it('ARRACHEE sans équipement éligible → aucune perte', () => {
      const resolver = new TestWreckResolver(5);
      const vehicle = makeVehicleWithPoids('Moyen', 0);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.ARRACHEE);
      expect(outcome.lostEquipment).toBeNull();
    });

    it('ARRACHEE exclut les améliorations estDefaut du pool', () => {
      const resolver = new TestWreckResolver(5, 0);
      const defaultImprovement = makeImprovement(9, true);
      const vehicle = makeVehicleWithPoids('Moyen', 0, [], [defaultImprovement]);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.lostEquipment).toBeNull();
    });

    it('ARRACHEE exclut une arme déjà isLost du pool — pas de perte redondante', () => {
      const resolver = new TestWreckResolver(5, 0);
      const lostWeapon = makeWeapon(7);
      lostWeapon.markLost();
      const vehicle = makeVehicleWithPoids('Moyen', 0, [lostWeapon]);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.lostEquipment).toBeNull();
    });

    it('ARRACHEE exclut une amélioration déjà isLost du pool, en tire une autre encore valide', () => {
      const resolver = new TestWreckResolver(5, 0);
      const lostImprovement = makeImprovement(8);
      lostImprovement.markLost();
      const stillMounted = makeImprovement(9);
      const vehicle = makeVehicleWithPoids('Moyen', 0, [], [lostImprovement, stillMounted]);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.lostEquipment).toEqual({ kind: 'improvement', id: 9 });
    });

    it('D6=6, chocs=0 → modifié=6 → PIGNON_ENDOMMAGE (+1)', () => {
      const resolver = new TestWreckResolver(6);
      const vehicle = makeVehicleWithPoids('Moyen', 0);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.PIGNON_ENDOMMAGE);
      expect(outcome.chocsGained).toBe(1);
    });

    it('D6=3, chocs=4 → modifié=7 → SIEGE_IRRECUPERABLE (+2)', () => {
      const resolver = new TestWreckResolver(3);
      const vehicle = makeVehicleWithPoids('Moyen', 4);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.SIEGE_IRRECUPERABLE);
      expect(outcome.chocsGained).toBe(2);
    });

    it('D6=3, chocs=5 → modifié=8 → CHASSIS_FRAGILISE (+2)', () => {
      const resolver = new TestWreckResolver(3);
      const vehicle = makeVehicleWithPoids('Moyen', 5);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.CHASSIS_FRAGILISE);
      expect(outcome.chocsGained).toBe(2);
    });

    it('D6=3, chocs=6 → modifié=9 → FAVORI_DU_PUBLIC (+3)', () => {
      const resolver = new TestWreckResolver(3);
      const vehicle = makeVehicleWithPoids('Moyen', 6);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.FAVORI_DU_PUBLIC);
      expect(outcome.chocsGained).toBe(3);
    });

    it('D6=6, chocs=5 → modifié=11 → VEHICULE_DETRUIT', () => {
      const resolver = new TestWreckResolver(6);
      const vehicle = makeVehicleWithPoids('Moyen', 5);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.VEHICULE_DETRUIT);
      expect(outcome.vehicleIsLost).toBe(true);
    });
  });

  describe('modificateur de poids', () => {
    it('Léger +1 : D6=4, chocs=0 → modifié=4+1=5 → ARRACHEE', () => {
      const resolver = new TestWreckResolver(4);
      const vehicle = makeVehicleWithPoids('Léger', 0);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.ARRACHEE);
    });

    it('Lourd -1 : D6=6, chocs=1 → modifié=6+1-1=6 → PIGNON_ENDOMMAGE', () => {
      const resolver = new TestWreckResolver(6);
      const vehicle = makeVehicleWithPoids('Lourd', 1);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.PIGNON_ENDOMMAGE);
      expect(outcome.chocsGained).toBe(1);
    });
  });

  describe('snapshot WreckOutcome', () => {
    it('snapshot contient vehicleId, diceRoll, chocsBefore', () => {
      const resolver = new TestWreckResolver(3);
      const vehicle = makeVehicleWithPoids('Moyen', 2);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.vehicleId).toBe(vehicle.id);
      expect(outcome.diceRoll).toBe(3);
      expect(outcome.chocsBefore).toBe(2);
    });
  });
});
