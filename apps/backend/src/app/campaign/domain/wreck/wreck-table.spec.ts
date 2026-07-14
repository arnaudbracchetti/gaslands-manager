import { describe, it, expect } from 'vitest';
import { WreckTable } from './wreck-table';
import { WreckResult } from '../enums/wreck-result.enum';
import type { IRandomizer } from '../randomizer.interface';
import type { ICatalogRepository } from '../../../team/domain/catalog.repository.interface';
import { VehicleType } from '../../../team/domain/value-objects/vehicle-type';
import { WeaponType } from '../../../team/domain/value-objects/weapon-type';
import { ImprovementType } from '../../../team/domain/value-objects/improvement-type';
import { SequellaType } from '../../../team/domain/value-objects/sequella-type';
import { Vehicle } from '../../../team/domain/vehicle';
import { Weapon } from '../../../team/domain/weapon';
import { Improvement } from '../../../team/domain/improvement';
import { WreckResolvedEvent } from '../events/wreck-resolved.event';
import { WeaponLostEvent } from '../events/weapon-lost.event';
import { ImprovementLostEvent } from '../events/improvement-lost.event';
import { EquipmentChangedEvent } from '../events/equipment-changed.event';
import { EquipmentEntityType } from '../enums/equipment-change.enums';
import { VehicleLostEvent } from '../events/vehicle-lost.event';

/** Randomizer déterministe — implémente IRandomizer sans sous-classer WreckTable. */
class FixedRandomizer implements IRandomizer {
  constructor(private readonly fixedRoll: number, private readonly fixedPickIndex = 0) {}
  roll(_sides: number): number { return this.fixedRoll; }
  pick<T>(pool: T[]): T { return pool[this.fixedPickIndex]; }
}

const SIEGE_IRRECUPERABLE = SequellaType.from({
  nom: 'Siège irrécupérable', nom_interne: 'siege_irrecuperable', description: '', regles: '', chocs_cost: 0, origine: 'TABLE_EPAVES',
});
const MAINTENU_PAR_LA_ROUILLE = SequellaType.from({
  nom: 'Maintenu par la Rouille', nom_interne: 'maintenu_par_la_rouille', description: '', regles: '', chocs_cost: 5, origine: 'ATELIER',
});
const LEGENDE_VIVANTE = SequellaType.from({
  nom: 'Légende Vivante', nom_interne: 'legende_vivante', description: '', regles: '', chocs_cost: 11, origine: 'ATELIER',
});

/** Catalogue minimal — seule `getSequellaType('siege_irrecuperable')` est appelée par WreckTable. */
class FixedCatalog implements ICatalogRepository {
  getVehicleType(): undefined { return undefined; }
  getWeaponType(): undefined { return undefined; }
  getImprovementType(): undefined { return undefined; }
  getAdvantageType(): undefined { return undefined; }
  getSequellaType(nomInterne: string): SequellaType | undefined {
    return nomInterne === 'siege_irrecuperable' ? SIEGE_IRRECUPERABLE : undefined;
  }
  getVehicleTypesForSponsor(): [] { return []; }
  getWeaponTypesForSponsor(): [] { return []; }
  getImprovementTypesForSponsor(): [] { return []; }
  getAdvantageTypesForSponsor(): [] { return []; }
}

const catalog = new FixedCatalog();

const GAME_ID = 10;
const PARTICIPANT_ID = 1;

function makeVehicle(
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
  const v = new Vehicle(1, 1, VehicleType.from(raw), weapons, improvements);
  if (chocs > 0) v.addChocs(chocs);
  return v;
}

function makeWeapon(id: number): Weapon {
  return new Weapon(id, WeaponType.from({
    nom: 'Mitrailleuse', nom_interne: 'mitrailleuse', type: 'base' as const,
    prix: 5, emplacement: 1, description: '', regles: '', sponsors_autorises: [],
    necessite_orientation: true,
  }), 'avant');
}

function makeImprovement(id: number, estDefaut = false): Improvement {
  return new Improvement(id, ImprovementType.from({
    nom: 'Blindage', nom_interne: 'blindage', prix: 4, emplacement: 1,
    description: '', regles: '', sponsors_autorises: [], necessite_orientation: false,
  }), null, estDefaut);
}

describe('WreckTable — Table des Épaves (10 lignes)', () => {
  describe('véhicule Moyen (modificateur 0)', () => {
    it('D6=1, chocs=0 → modifié=1 → DEBOSSELE, chocsGained=0 (min clampé)', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(1), catalog).resolve(makeVehicle('Moyen', 0), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.DEBOSSELE);
      expect(outcome.chocsGained).toBe(0);
      expect(outcome.diceRoll).toBe(1);
    });

    it('D6=1, chocs=2 → modifié=3 → INDEMNE (seuil haut DEBOSSELE)', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(1), catalog).resolve(makeVehicle('Moyen', 2), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.INDEMNE);
    });

    it('D6=1, chocs=0, poids Lourd → modifié=0 → DEBOSSELE', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(1), catalog).resolve(makeVehicle('Lourd', 0), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.DEBOSSELE);
    });

    it('D6=2, chocs=0 → modifié=2 → INDEMNE', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(2), catalog).resolve(makeVehicle('Moyen', 0), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.INDEMNE);
      expect(outcome.chocsGained).toBe(0);
    });

    it('D6=4, chocs=0 → modifié=4 → ROUE_CABOSSEE (+1)', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(4), catalog).resolve(makeVehicle('Moyen', 0), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.ROUE_CABOSSEE);
      expect(outcome.chocsGained).toBe(1);
    });

    it('D6=5, chocs=0, pool=[arme, amélio] → ARRACHEE (+1), perte = 1er élément du pool', () => {
      const weapon = makeWeapon(7);
      const improvement = makeImprovement(8);
      const { outcome } = new WreckTable(new FixedRandomizer(5, 0), catalog)
        .resolve(makeVehicle('Moyen', 0, [weapon], [improvement]), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.ARRACHEE);
      expect(outcome.chocsGained).toBe(1);
      expect(outcome.lostEquipment).toEqual({ kind: 'weapon', id: 7 });
      expect(outcome.weaponLostId).toBe(7);
      expect(outcome.improvementLostId).toBeNull();
    });

    it('ARRACHEE : pool pointant sur une amélioration', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(5, 1), catalog)
        .resolve(makeVehicle('Moyen', 0, [makeWeapon(7)], [makeImprovement(8)]), GAME_ID, PARTICIPANT_ID);
      expect(outcome.lostEquipment).toEqual({ kind: 'improvement', id: 8 });
    });

    it('ARRACHEE sans équipement éligible → lostEquipment null', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(5), catalog).resolve(makeVehicle('Moyen', 0), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.ARRACHEE);
      expect(outcome.lostEquipment).toBeNull();
    });

    it('ARRACHEE exclut les améliorations estDefaut du pool', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(5, 0), catalog)
        .resolve(makeVehicle('Moyen', 0, [], [makeImprovement(9, true)]), GAME_ID, PARTICIPANT_ID);
      expect(outcome.lostEquipment).toBeNull();
    });

    it('ARRACHEE exclut une arme déjà isLost', () => {
      const lostWeapon = makeWeapon(7);
      lostWeapon.markLost();
      const { outcome } = new WreckTable(new FixedRandomizer(5, 0), catalog)
        .resolve(makeVehicle('Moyen', 0, [lostWeapon]), GAME_ID, PARTICIPANT_ID);
      expect(outcome.lostEquipment).toBeNull();
    });

    it('ARRACHEE exclut une amélioration isLost, tire la suivante', () => {
      const lostImpro = makeImprovement(8); lostImpro.markLost();
      const stillMounted = makeImprovement(9);
      const { outcome } = new WreckTable(new FixedRandomizer(5, 0), catalog)
        .resolve(makeVehicle('Moyen', 0, [], [lostImpro, stillMounted]), GAME_ID, PARTICIPANT_ID);
      expect(outcome.lostEquipment).toEqual({ kind: 'improvement', id: 9 });
    });

    it('ARRACHEE exclut une arme isSold — vendue en atelier, plus physiquement sur le véhicule', () => {
      const soldWeapon = makeWeapon(7);
      soldWeapon.markSold();
      const { outcome } = new WreckTable(new FixedRandomizer(5, 0), catalog)
        .resolve(makeVehicle('Moyen', 0, [soldWeapon]), GAME_ID, PARTICIPANT_ID);
      expect(outcome.lostEquipment).toBeNull();
    });

    it('ARRACHEE exclut une amélioration isSold, tire la suivante', () => {
      const soldImpro = makeImprovement(8); soldImpro.markSold();
      const stillMounted = makeImprovement(9);
      const { outcome } = new WreckTable(new FixedRandomizer(5, 0), catalog)
        .resolve(makeVehicle('Moyen', 0, [], [soldImpro, stillMounted]), GAME_ID, PARTICIPANT_ID);
      expect(outcome.lostEquipment).toEqual({ kind: 'improvement', id: 9 });
    });

    it('D6=6, chocs=0 → modifié=6 → PIGNON_ENDOMMAGE (+1)', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(6), catalog).resolve(makeVehicle('Moyen', 0), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.PIGNON_ENDOMMAGE);
      expect(outcome.chocsGained).toBe(1);
    });

    it('D6=3, chocs=4 → modifié=7 → SIEGE_IRRECUPERABLE (+2)', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(3), catalog).resolve(makeVehicle('Moyen', 4), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.SIEGE_IRRECUPERABLE);
      expect(outcome.chocsGained).toBe(2);
    });

    it('D6=3, chocs=5 → modifié=8 → CHASSIS_FRAGILISE (+2)', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(3), catalog).resolve(makeVehicle('Moyen', 5), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.CHASSIS_FRAGILISE);
      expect(outcome.chocsGained).toBe(2);
    });

    it('D6=3, chocs=6 → modifié=9 → FAVORI_DU_PUBLIC (+3)', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(3), catalog).resolve(makeVehicle('Moyen', 6), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.FAVORI_DU_PUBLIC);
      expect(outcome.chocsGained).toBe(3);
    });

    it('D6=6, chocs=5 → modifié=11 → VEHICULE_DETRUIT', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(6), catalog).resolve(makeVehicle('Moyen', 5), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.VEHICULE_DETRUIT);
      expect(outcome.vehicleIsLost).toBe(true);
    });
  });

  describe('modificateur de poids', () => {
    it('Léger +1 : D6=4, chocs=0 → modifié=5 → ARRACHEE', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(4), catalog).resolve(makeVehicle('Léger', 0), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.ARRACHEE);
    });

    it('Lourd -1 : D6=6, chocs=1 → modifié=6 → PIGNON_ENDOMMAGE', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(6), catalog).resolve(makeVehicle('Lourd', 1), GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.PIGNON_ENDOMMAGE);
      expect(outcome.chocsGained).toBe(1);
    });
  });

  describe('snapshot WreckOutcome', () => {
    it('contient vehicleId, diceRoll, chocsBefore', () => {
      const vehicle = makeVehicle('Moyen', 2);
      const { outcome } = new WreckTable(new FixedRandomizer(3), catalog).resolve(vehicle, GAME_ID, PARTICIPANT_ID);
      expect(outcome.vehicleId).toBe(vehicle.id);
      expect(outcome.diceRoll).toBe(3);
      expect(outcome.chocsBefore).toBe(2);
    });
  });

  describe('WreckTable — événements générés', () => {
    it('toujours un WreckResolvedEvent en premier', () => {
      const { events } = new WreckTable(new FixedRandomizer(2), catalog).resolve(makeVehicle('Moyen', 0), GAME_ID, PARTICIPANT_ID);
      expect(events[0]).toBeInstanceOf(WreckResolvedEvent);
      expect((events[0] as WreckResolvedEvent).gameId).toBe(GAME_ID);
      expect((events[0] as WreckResolvedEvent).participantId).toBe(PARTICIPANT_ID);
    });

    it('INDEMNE → uniquement WreckResolvedEvent', () => {
      const { events } = new WreckTable(new FixedRandomizer(2), catalog).resolve(makeVehicle('Moyen', 0), GAME_ID, PARTICIPANT_ID);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(WreckResolvedEvent);
    });

    it('ARRACHEE avec arme → WreckResolvedEvent + WeaponLostEvent', () => {
      const weapon = makeWeapon(7);
      const { events } = new WreckTable(new FixedRandomizer(5, 0), catalog)
        .resolve(makeVehicle('Moyen', 0, [weapon], []), GAME_ID, PARTICIPANT_ID);
      expect(events).toHaveLength(2);
      expect(events[1]).toBeInstanceOf(WeaponLostEvent);
      expect((events[1] as WeaponLostEvent).weaponId).toBe(7);
    });

    it('ARRACHEE avec amélioration → WreckResolvedEvent + ImprovementLostEvent', () => {
      const impro = makeImprovement(8);
      const { events } = new WreckTable(new FixedRandomizer(5, 0), catalog)
        .resolve(makeVehicle('Moyen', 0, [], [impro]), GAME_ID, PARTICIPANT_ID);
      expect(events).toHaveLength(2);
      expect(events[1]).toBeInstanceOf(ImprovementLostEvent);
    });

    it('ARRACHEE sans équipement → uniquement WreckResolvedEvent', () => {
      const { events } = new WreckTable(new FixedRandomizer(5), catalog).resolve(makeVehicle('Moyen', 0), GAME_ID, PARTICIPANT_ID);
      expect(events).toHaveLength(1);
    });

    it('SIEGE_IRRECUPERABLE → WreckResolvedEvent + EquipmentChangedEvent(BUY, SEQUELLE, coût 0)', () => {
      const { events } = new WreckTable(new FixedRandomizer(3), catalog).resolve(makeVehicle('Moyen', 4), GAME_ID, PARTICIPANT_ID);
      expect(events).toHaveLength(2);
      expect(events[1]).toBeInstanceOf(EquipmentChangedEvent);
      const equipmentEvent = events[1] as EquipmentChangedEvent;
      expect(equipmentEvent.entityType).toBe(EquipmentEntityType.SEQUELLE);
      expect(equipmentEvent.nomInterne).toBe('siege_irrecuperable');
      expect(equipmentEvent.cost).toBe(0);
    });

    it('VEHICULE_DETRUIT → WreckResolvedEvent + VehicleLostEvent', () => {
      const { events } = new WreckTable(new FixedRandomizer(6), catalog).resolve(makeVehicle('Moyen', 5), GAME_ID, PARTICIPANT_ID);
      expect(events).toHaveLength(2);
      expect(events[1]).toBeInstanceOf(VehicleLostEvent);
    });

    it('ROUE_CABOSSEE → uniquement WreckResolvedEvent (pas d\'événement supplémentaire)', () => {
      const { events } = new WreckTable(new FixedRandomizer(4), catalog).resolve(makeVehicle('Moyen', 0), GAME_ID, PARTICIPANT_ID);
      expect(events).toHaveLength(1);
    });
  });

  describe('Légende Vivante — force chaque tirage à 1 (effet permanent)', () => {
    it('ignore le D6 réel et utilise 1, même avec un randomizer fixé à une autre valeur', () => {
      const vehicle = makeVehicle('Moyen', 0);
      vehicle.addCampaignSequella(LEGENDE_VIVANTE, 99);
      const { outcome } = new WreckTable(new FixedRandomizer(6), catalog).resolve(vehicle, GAME_ID, PARTICIPANT_ID);
      expect(outcome.diceRoll).toBe(1);
      expect(outcome.wreckResult).toBe(WreckResult.DEBOSSELE);
    });

    it('sans Légende Vivante, le D6 du randomizer est utilisé normalement', () => {
      const { outcome } = new WreckTable(new FixedRandomizer(6), catalog).resolve(makeVehicle('Moyen', 0), GAME_ID, PARTICIPANT_ID);
      expect(outcome.diceRoll).toBe(6);
    });
  });

  describe('Maintenu par la Rouille — double tirage chaîné (effet permanent)', () => {
    it('applique un second tirage avec les Chocs mis à jour par le premier', () => {
      const vehicle = makeVehicle('Moyen', 4);
      vehicle.addCampaignSequella(MAINTENU_PAR_LA_ROUILLE, 99);
      // D6 fixé à 3 pour les deux tirages : 1er (chocs=4) → modifié=7 → SIEGE_IRRECUPERABLE (+2) ;
      // 2nd (chocs=4+2=6) → modifié=9 → FAVORI_DU_PUBLIC (+3), résultat final retourné.
      const { outcome, events } = new WreckTable(new FixedRandomizer(3), catalog).resolve(vehicle, GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.FAVORI_DU_PUBLIC);
      expect(outcome.chocsBefore).toBe(6);
      // WreckResolvedEvent(1er) + EquipmentChangedEvent(siège irrécupérable) + WreckResolvedEvent(2nd).
      expect(events).toHaveLength(3);
      expect(events[0]).toBeInstanceOf(WreckResolvedEvent);
      expect(events[1]).toBeInstanceOf(EquipmentChangedEvent);
      expect(events[2]).toBeInstanceOf(WreckResolvedEvent);
    });

    it('ne déclenche pas de second tirage si le premier détruit déjà le véhicule', () => {
      const vehicle = makeVehicle('Moyen', 5);
      vehicle.addCampaignSequella(MAINTENU_PAR_LA_ROUILLE, 99);
      const { outcome, events } = new WreckTable(new FixedRandomizer(6), catalog).resolve(vehicle, GAME_ID, PARTICIPANT_ID);
      expect(outcome.wreckResult).toBe(WreckResult.VEHICULE_DETRUIT);
      // WreckResolvedEvent + VehicleLostEvent uniquement — pas de second tirage.
      expect(events).toHaveLength(2);
    });

    it('sans Maintenu par la Rouille, un seul tirage est effectué', () => {
      const vehicle = makeVehicle('Moyen', 4);
      const { events } = new WreckTable(new FixedRandomizer(3), catalog).resolve(vehicle, GAME_ID, PARTICIPANT_ID);
      expect(events).toHaveLength(2); // WreckResolvedEvent + EquipmentChangedEvent(siège irrécupérable)
    });

    it('composition avec Légende Vivante : les deux tirages sont forcés à 1', () => {
      const vehicle = makeVehicle('Moyen', 0);
      vehicle.addCampaignSequella(LEGENDE_VIVANTE, 98);
      vehicle.addCampaignSequella(MAINTENU_PAR_LA_ROUILLE, 99);
      const { events } = new WreckTable(new FixedRandomizer(6), catalog).resolve(vehicle, GAME_ID, PARTICIPANT_ID);
      const wreckEvents = events.filter((e): e is WreckResolvedEvent => e instanceof WreckResolvedEvent);
      expect(wreckEvents).toHaveLength(2);
      expect(wreckEvents[0].diceRoll).toBe(1);
      expect(wreckEvents[1].diceRoll).toBe(1);
    });
  });
});
