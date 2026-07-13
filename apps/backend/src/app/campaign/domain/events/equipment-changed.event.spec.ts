import { describe, it, expect } from 'vitest';
import { EquipmentChangedEvent } from './equipment-changed.event';
import { EquipmentOperation, EquipmentEntityType } from '../enums/equipment-change.enums';
import { SequellaType } from '../../../team/domain/value-objects/sequella-type';
import {
  makeTestParticipant,
  makeTestParticipantWithAdvantage,
  makeVehicleType,
  makeWeaponType,
  makeImprovementType,
  makeAdvantageType,
} from '../test-helpers';

function makeSequellaType(chocsCost = 1): SequellaType {
  return SequellaType.from({
    nom: 'Suicidaire', nom_interne: 'suicidaire', description: '', chocs_cost: chocsCost, origine: 'ATELIER',
  });
}

function makeDurACuireType(): SequellaType {
  return SequellaType.from({
    nom: 'Dur à Cuire', nom_interne: 'dur_a_cuire', description: '', chocs_cost: 6, origine: 'ATELIER',
  });
}

describe('EquipmentChangedEvent — execute / undo', () => {
  describe('BUY — crée une entité transiente (id = -event.id), undo la retire', () => {
    it('BUY VEHICLE', () => {
      const { team, participant, participants } = makeTestParticipant();
      const event = new EquipmentChangedEvent(
        7, 10, participant.id, 0,
        EquipmentOperation.BUY, EquipmentEntityType.VEHICLE, 'voiture', 12,
        null, null, null,
        makeVehicleType(), null,
      );

      event.execute(participants);
      expect(team.vehicles.some((v) => v.id === -7)).toBe(true);

      event.undo(participants);
      expect(team.vehicles.some((v) => v.id === -7)).toBe(false);
    });

    it('BUY WEAPON', () => {
      const { vehicle, participant, participants } = makeTestParticipant();
      const event = new EquipmentChangedEvent(
        8, 10, participant.id, 0,
        EquipmentOperation.BUY, EquipmentEntityType.WEAPON, 'mitrailleuse', 5,
        vehicle.id, null, 'avant',
        null, makeWeaponType(),
      );

      event.execute(participants);
      expect(vehicle.weapons.some((w) => w.id === -8)).toBe(true);

      event.undo(participants);
      expect(vehicle.weapons.some((w) => w.id === -8)).toBe(false);
    });

    it('BUY IMPROVEMENT', () => {
      const { vehicle, participant, participants } = makeTestParticipant();
      const event = new EquipmentChangedEvent(
        9, 10, participant.id, 0,
        EquipmentOperation.BUY, EquipmentEntityType.IMPROVEMENT, 'blindage', 4,
        vehicle.id, null, null,
        null, null, makeImprovementType(),
      );

      event.execute(participants);
      expect(vehicle.improvements.some((i) => i.id === -9)).toBe(true);

      event.undo(participants);
      expect(vehicle.improvements.some((i) => i.id === -9)).toBe(false);
    });

    it('BUY ADVANTAGE', () => {
      const { vehicle, participant, participants } = makeTestParticipant();
      const event = new EquipmentChangedEvent(
        11, 10, participant.id, 0,
        EquipmentOperation.BUY, EquipmentEntityType.ADVANTAGE, 'tireur_elite', 2,
        vehicle.id, null, null,
        null, null, null, makeAdvantageType(),
      );

      event.execute(participants);
      expect(vehicle.advantages.some((a) => a.id === -11)).toBe(true);

      event.undo(participants);
      expect(vehicle.advantages.some((a) => a.id === -11)).toBe(false);
    });

    it('BUY SEQUELLE — débite les Chocs du véhicule (pas la cagnotte), crée la séquelle', () => {
      const { team, vehicle, participant, participants } = makeTestParticipant();
      vehicle.addChocs(5);
      const remainingBudgetBefore = team.remainingBudget;
      const event = new EquipmentChangedEvent(
        21, 10, participant.id, 0,
        EquipmentOperation.BUY, EquipmentEntityType.SEQUELLE, 'suicidaire', 1,
        vehicle.id, null, null,
        null, null, null, null, makeSequellaType(1),
      );

      event.execute(participants);
      expect(vehicle.chocs).toBe(4);
      expect(vehicle.sequellas.some((s) => s.id === -21)).toBe(true);
      expect(team.remainingBudget).toBe(remainingBudgetBefore); // jamais touché par une séquelle

      event.undo(participants);
      expect(vehicle.chocs).toBe(5);
      expect(vehicle.sequellas.some((s) => s.id === -21)).toBe(false);
    });

    it('BUY SEQUELLE "dur_a_cuire" — un seul événement crée la séquelle ET l\'avantage gratuit taggé', () => {
      const { vehicle, participant, participants } = makeTestParticipant();
      vehicle.addChocs(6);
      const event = new EquipmentChangedEvent(
        22, 10, participant.id, 0,
        EquipmentOperation.BUY, EquipmentEntityType.SEQUELLE, 'dur_a_cuire', 6,
        vehicle.id, null, null,
        null, null, null, null, makeDurACuireType(), makeAdvantageType(),
      );

      event.execute(participants);
      expect(vehicle.chocs).toBe(0);
      expect(vehicle.sequellas.some((s) => s.id === -22)).toBe(true);
      const granted = vehicle.advantages.find((a) => a.id === -22);
      expect(granted).toBeDefined();
      expect(granted?.grantedBySequellaNomInterne).toBe('dur_a_cuire');

      event.undo(participants);
      expect(vehicle.chocs).toBe(6);
      expect(vehicle.sequellas.some((s) => s.id === -22)).toBe(false);
      expect(vehicle.advantages.some((a) => a.id === -22)).toBe(false);
    });
  });

  describe('SELL SEQUELLE — flag isSold, toujours 0 remboursement', () => {
    it('execute marque isSold, ne crédite aucun Choc (refund=0) ; undo restaure', () => {
      const { vehicle, participant, participants } = makeTestParticipant();
      const sequella = vehicle.addCampaignSequella(makeSequellaType(1), 30);
      const event = new EquipmentChangedEvent(
        23, 10, participant.id, 0,
        EquipmentOperation.SELL, EquipmentEntityType.SEQUELLE, 'suicidaire', 0,
        vehicle.id, sequella.id, null,
        null, null, null, null, makeSequellaType(1),
      );

      event.execute(participants);
      expect(sequella.isSold).toBe(true);
      expect(vehicle.chocs).toBe(0);

      event.undo(participants);
      expect(sequella.isSold).toBe(false);
      expect(vehicle.chocs).toBe(0);
    });

    it('SELL "dur_a_cuire" — revend aussi l\'avantage gratuit taggé, retrouvé sans lien d\'id', () => {
      const { vehicle, participant, participants } = makeTestParticipant();
      const sequella = vehicle.addCampaignSequella(makeDurACuireType(), 30);
      const granted = vehicle.addCampaignAdvantage(makeAdvantageType(), 31, 'dur_a_cuire');
      const event = new EquipmentChangedEvent(
        24, 10, participant.id, 0,
        EquipmentOperation.SELL, EquipmentEntityType.SEQUELLE, 'dur_a_cuire', 0,
        vehicle.id, sequella.id, null,
        null, null, null, null, makeDurACuireType(),
      );

      event.execute(participants);
      expect(sequella.isSold).toBe(true);
      expect(granted.isSold).toBe(true);

      event.undo(participants);
      expect(sequella.isSold).toBe(false);
      expect(granted.isSold).toBe(false);
    });
  });

  describe('SELL WEAPON / IMPROVEMENT / ADVANTAGE — flag isSold, jamais de suppression', () => {
    it('SELL WEAPON : prix résiduel à l\'execute, prix plein restauré à l\'undo', () => {
      const { vehicle, weapon, participant, participants } = makeTestParticipant();
      const priceBefore = weapon.price; // 5
      const event = new EquipmentChangedEvent(
        12, 10, participant.id, 0,
        EquipmentOperation.SELL, EquipmentEntityType.WEAPON, 'mitrailleuse', 2,
        vehicle.id, weapon.id, null,
        null, null,
      );

      event.execute(participants);
      expect(weapon.isSold).toBe(true);
      expect(weapon.price).toBe(Math.ceil(priceBefore / 2)); // 3

      event.undo(participants);
      expect(weapon.isSold).toBe(false);
      expect(weapon.price).toBe(priceBefore);
    });

    it('SELL IMPROVEMENT : prix résiduel à l\'execute, prix plein restauré à l\'undo', () => {
      const { vehicle, improvement, participant, participants } = makeTestParticipant();
      const priceBefore = improvement.price; // 4
      const event = new EquipmentChangedEvent(
        13, 10, participant.id, 0,
        EquipmentOperation.SELL, EquipmentEntityType.IMPROVEMENT, 'blindage', 2,
        vehicle.id, improvement.id, null,
        null, null,
      );

      event.execute(participants);
      expect(improvement.isSold).toBe(true);
      expect(improvement.price).toBe(Math.ceil(priceBefore / 2)); // 2

      event.undo(participants);
      expect(improvement.isSold).toBe(false);
      expect(improvement.price).toBe(priceBefore);
    });

    it('SELL ADVANTAGE : prix INCHANGÉ à l\'execute (perte totale) — seul isSold varie', () => {
      const { vehicle, advantage, participant, participants } = makeTestParticipantWithAdvantage();
      const priceBefore = advantage.price; // 2
      const event = new EquipmentChangedEvent(
        14, 10, participant.id, 0,
        EquipmentOperation.SELL, EquipmentEntityType.ADVANTAGE, 'tireur_elite', 0,
        vehicle.id, advantage.id, null,
        null, null,
      );

      event.execute(participants);
      expect(advantage.isSold).toBe(true);
      expect(advantage.price).toBe(priceBefore); // jamais réduit

      event.undo(participants);
      expect(advantage.isSold).toBe(false);
      expect(advantage.price).toBe(priceBefore);
    });
  });

  describe('SELL VEHICLE — flag isSold, cascade sur l\'équipement pas encore vendu', () => {
    it('execute flague le véhicule ET tout son équipement pas encore vendu ; undo restaure tout', () => {
      const { team, vehicle, weapon, improvement, advantage, participant, participants } = makeTestParticipantWithAdvantage();
      const event = new EquipmentChangedEvent(
        15, 10, participant.id, 0,
        EquipmentOperation.SELL, EquipmentEntityType.VEHICLE, 'voiture', 10,
        null, vehicle.id, null,
        null, null,
      );

      event.execute(participants);
      expect(vehicle.isSold).toBe(true);
      expect(weapon.isSold).toBe(true);
      expect(improvement.isSold).toBe(true);
      expect(advantage.isSold).toBe(true);
      // 27 (cagnotte avant vente) + 10 (floor(12/2)+floor(5/2)+floor(4/2)+0) = 37.
      expect(team.remainingBudget).toBe(37);

      event.undo(participants);
      expect(vehicle.isSold).toBe(false);
      expect(weapon.isSold).toBe(false);
      expect(improvement.isSold).toBe(false);
      expect(advantage.isSold).toBe(false);
      expect(team.remainingBudget).toBe(27);
    });

    it('ne dé-marque pas, à l\'undo, un enfant déjà vendu individuellement AVANT cette vente', () => {
      const { vehicle, weapon, improvement, participant, participants } = makeTestParticipant();
      // Vente individuelle antérieure (session déjà close), hors de l'événement testé ici.
      weapon.markSold();

      const event = new EquipmentChangedEvent(
        16, 10, participant.id, 0,
        EquipmentOperation.SELL, EquipmentEntityType.VEHICLE, 'voiture', 8,
        null, vehicle.id, null,
        null, null,
      );

      event.execute(participants);
      expect(improvement.isSold).toBe(true); // cascadée par CETTE vente

      event.undo(participants);
      expect(weapon.isSold).toBe(true); // reste vendue — pas cascadée par cet événement
      expect(improvement.isSold).toBe(false); // dé-cascadée
    });
  });

  describe('describe()', () => {
    it('BUY : "Achat : <nom> <orientation> (<cost> jerricans)"', () => {
      const { participant, participants } = makeTestParticipant();
      const event = new EquipmentChangedEvent(
        17, 10, participant.id, 0,
        EquipmentOperation.BUY, EquipmentEntityType.VEHICLE, 'voiture', 12,
        null, null, null,
        makeVehicleType(), null,
      );
      expect(event.describe(participants)).toBe('Achat : Voiture (12 jerricans)');
    });

    it('SELL d\'un équipement monté : mentionne le véhicule hôte', () => {
      const { vehicle, weapon, participant, participants } = makeTestParticipant();
      const event = new EquipmentChangedEvent(
        18, 10, participant.id, 0,
        EquipmentOperation.SELL, EquipmentEntityType.WEAPON, 'mitrailleuse', 2,
        vehicle.id, weapon.id, 'avant',
        null, makeWeaponType(),
      );
      expect(event.describe(participants)).toBe('Vente : Mitrailleuse avant, sur Voiture (2 jerricans)');
    });

    it('BUY SEQUELLE : monnaie affichée en "chocs", pas en jerricans', () => {
      const { vehicle, participant, participants } = makeTestParticipant();
      const event = new EquipmentChangedEvent(
        25, 10, participant.id, 0,
        EquipmentOperation.BUY, EquipmentEntityType.SEQUELLE, 'suicidaire', 1,
        vehicle.id, null, null,
        null, null, null, null, makeSequellaType(1),
      );
      expect(event.describe(participants)).toBe('Achat : Suicidaire sur Voiture (1 chocs)');
    });

    it('BUY SEQUELLE "dur_a_cuire" : mentionne l\'avantage gratuit accordé', () => {
      const { vehicle, participant, participants } = makeTestParticipant();
      const event = new EquipmentChangedEvent(
        26, 10, participant.id, 0,
        EquipmentOperation.BUY, EquipmentEntityType.SEQUELLE, 'dur_a_cuire', 6,
        vehicle.id, null, null,
        null, null, null, null, makeDurACuireType(), makeAdvantageType(),
      );
      expect(event.describe(participants)).toBe('Achat : Dur à Cuire sur Voiture, + avantage Tireur d\'Élite (6 chocs)');
    });
  });
});
