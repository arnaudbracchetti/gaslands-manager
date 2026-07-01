import { describe, it, expect } from 'vitest';
import { WreckResolverService } from './wreck-resolver.service';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import { VehicleType } from '../../team/domain/value-objects/vehicle-type';
import { Vehicle } from '../../team/domain/vehicle';

/**
 * Sous-classe testable : injecte un dé fixe pour rendre les tests déterministes.
 */
class TestWreckResolver extends WreckResolverService {
  constructor(private readonly fixedRoll: number) { super(); }
  protected override rollD6(): number { return this.fixedRoll; }
}

function makeVehicleWithPoids(poids: 'Léger' | 'Moyen' | 'Lourd', chocs = 0): Vehicle {
  const raw = {
    nom: 'Test', nom_interne: 'test', poids,
    carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
    emplacements: 4, prix: 12, description: '', regles: '', sponsors_autorises: [],
    ameliorations_defaut: [],
  };
  const vehicleType = VehicleType.from(raw);
  const v = new Vehicle(1, 1, vehicleType, [], []);
  if (chocs > 0) v.addChocs(chocs);
  return v;
}

describe('WreckResolverService — Table des Épaves', () => {
  describe('avec un véhicule Moyen (modificateur 0)', () => {
    it('D6=1, chocs=0 → modifié=1 → CHOCS_GAGNE(0)', () => {
      const resolver = new TestWreckResolver(1);
      const vehicle = makeVehicleWithPoids('Moyen', 0);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.CHOCS_GAGNE);
      expect(outcome.chocsGained).toBe(0);
      expect(outcome.diceRoll).toBe(1);
    });

    it('D6=4, chocs=0 → modifié=4 → CHOCS_GAGNE(1)', () => {
      const resolver = new TestWreckResolver(4);
      const vehicle = makeVehicleWithPoids('Moyen', 0);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.CHOCS_GAGNE);
      expect(outcome.chocsGained).toBe(1);
    });

    it('D6=6, chocs=0 → modifié=6 → CHOCS_GAGNE(2)', () => {
      const resolver = new TestWreckResolver(6);
      const vehicle = makeVehicleWithPoids('Moyen', 0);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.CHOCS_GAGNE);
      expect(outcome.chocsGained).toBe(2);
    });

    it('D6=3, chocs=5 → modifié=8 → ARME_PERDUE', () => {
      const resolver = new TestWreckResolver(3);
      const vehicle = makeVehicleWithPoids('Moyen', 5);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.ARME_PERDUE);
      expect(outcome.chocsGained).toBe(0);
    });

    it('D6=6, chocs=5 → modifié=11 → EPAVE', () => {
      const resolver = new TestWreckResolver(6);
      const vehicle = makeVehicleWithPoids('Moyen', 5);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.EPAVE);
    });
  });

  describe('modificateur de poids', () => {
    it('Léger +1 : D6=6, chocs=1 → modifié=6+1+1=8 → ARME_PERDUE', () => {
      const resolver = new TestWreckResolver(6);
      const vehicle = makeVehicleWithPoids('Léger', 1);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.ARME_PERDUE);
    });

    it('Lourd -1 : D6=6, chocs=1 → modifié=6+1-1=6 → CHOCS_GAGNE(2)', () => {
      const resolver = new TestWreckResolver(6);
      const vehicle = makeVehicleWithPoids('Lourd', 1);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.wreckResult).toBe(WreckResult.CHOCS_GAGNE);
      expect(outcome.chocsGained).toBe(2);
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

    it('vehicleIsLost est vrai uniquement pour EPAVE', () => {
      const resolver = new TestWreckResolver(6);
      const vehicle = makeVehicleWithPoids('Moyen', 5);
      const outcome = resolver.resolve(vehicle);
      expect(outcome.vehicleIsLost).toBe(true);
    });

    it('weaponIsLost faux si ARME_PERDUE mais pas d\'arme choisie', () => {
      const resolver = new TestWreckResolver(3);
      const vehicle = makeVehicleWithPoids('Moyen', 5);
      const outcome = resolver.resolve(vehicle, null);
      expect(outcome.wreckResult).toBe(WreckResult.ARME_PERDUE);
      expect(outcome.weaponIsLost).toBe(false);
    });

    it('weaponIsLost vrai si ARME_PERDUE avec arme choisie', () => {
      const resolver = new TestWreckResolver(3);
      const vehicle = makeVehicleWithPoids('Moyen', 5);
      const outcome = resolver.resolve(vehicle, 7);
      expect(outcome.weaponIsLost).toBe(true);
      expect(outcome.weaponLostId).toBe(7);
    });
  });
});
