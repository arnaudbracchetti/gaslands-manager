import { describe, it, expect } from 'vitest';
import { CampaignRepository } from './campaign.repository';
import { CampaignMapper } from './campaign.mapper';
import type { GameEventOrm } from './entities/game-event.entity';
import type { GameEvent } from '../domain/events/game-event';
import { GameEventType } from '../domain/enums/game-event-type.enum';
import { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import { WalletMovementEvent } from '../domain/events/wallet-movement.event';
import { VehicleLostEvent } from '../domain/events/vehicle-lost.event';
import { WeaponLostEvent } from '../domain/events/weapon-lost.event';
import { ImprovementLostEvent } from '../domain/events/improvement-lost.event';
import { AdvantageLostEvent } from '../domain/events/advantage-lost.event';
import { WreckResolvedEvent } from '../domain/events/wreck-resolved.event';
import { EquipmentChangedEvent } from '../domain/events/equipment-changed.event';
import { EquipmentOperation, EquipmentEntityType } from '../domain/enums/equipment-change.enums';
import { ResistanceContactedEvent } from '../domain/events/resistance-contacted.event';
import { GatesCrossedEvent } from '../domain/events/gates-crossed.event';
import { VehicleDestroyedEvent } from '../domain/events/vehicle-destroyed.event';
import { FavoriDuPublicBonusEvent } from '../domain/events/favori-du-public-bonus.event';
import { VehicleRenamedEvent } from '../domain/events/vehicle-renamed.event';
import { SabotagePointsSpentEvent } from '../domain/events/sabotage-points-spent.event';
import { WalletReason } from '../domain/enums/wallet-reason.enum';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import { WeightClass } from '../domain/enums/weight-class.enum';

/**
 * Régression C2 (cf. docs/plans/2026-07-17-vehicle-instance-name-design.md) et suite du
 * TODO traité dans `CampaignRepository.eventToOrm` : ce dispatch se faisait par
 * duck-typing (cascade de `'propriété' in e`), remplacé depuis par un discriminant
 * explicite (`GameEvent.eventType`, `GameEventType`) et un `switch` exhaustif. Les deux
 * tests ci-dessous documentent la régression d'origine (`VehicleRenamedEvent` collisionnait
 * avec `VEHICLE_LOST`) ; le bloc "exhaustivité" plus bas généralise la protection à tous
 * les types — c'est en écrivant ce filet qu'un second cas réel a été trouvé :
 * `FavoriDuPublicBonusEvent`, ajouté après coup, n'avait jamais reçu son propre `case` ni
 * côté `eventToOrm` ni côté `CampaignMapper.toEvent` — il était persisté (et rechargé)
 * comme `VEHICLE_LOST`, perdant son `championshipPoints` et marquant à tort le véhicule
 * perdu au prochain replay.
 *
 * `eventToOrm`/`toEvent` sont privées — accédées ici via cast, aucune des deux
 * méthodes ne touche aux dépendances injectées (repositories TypeORM/CatalogService),
 * donc des dépendances factices suffisent (sauf pour `EQUIPMENT_CHANGED` côté `toEvent`,
 * qui résout des types catalogue — hors périmètre de ce fichier, déjà couvert par
 * `vehicle-default-equipment.e2e.spec.ts`).
 */
function makeRepo(): CampaignRepository {
  return new CampaignRepository(
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
  );
}

describe('CampaignRepository.eventToOrm — VehicleRenamedEvent', () => {
  it('classe VehicleRenamedEvent comme VEHICLE_RENAMED, jamais VEHICLE_LOST', () => {
    const repo = makeRepo();
    const event = new VehicleRenamedEvent(0, 10, 1, 1, 5, 'Buggy', 'La Teigne');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orm = (repo as any).eventToOrm(event, 1) as Partial<GameEventOrm>;

    expect(orm.eventType).toBe('VEHICLE_RENAMED');
    expect(orm.eventType).not.toBe('VEHICLE_LOST');
    expect(orm.vehicleId).toBe(5);
    expect(orm.previousVehicleName).toBe('Buggy');
    expect(orm.newVehicleName).toBe('La Teigne');
  });

  it('VehicleLostEvent reste classé normalement (non-régression du check instanceof déjà en place)', () => {
    const repo = makeRepo();
    const event = new VehicleLostEvent(0, 10, 1, 1, 5);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orm = (repo as any).eventToOrm(event, 1) as Partial<GameEventOrm>;

    expect(orm.eventType).toBe('VEHICLE_LOST');
  });
});

describe('CampaignMapper.toEvent — VEHICLE_RENAMED', () => {
  it('reconstruit un VehicleRenamedEvent (pas un VehicleLostEvent) depuis une ligne VEHICLE_RENAMED', () => {
    const mapper = new CampaignMapper({} as never);
    const ormRow = {
      id: 99, gameId: 10, participantId: 1, eventOrder: 1, eventType: 'VEHICLE_RENAMED',
      vehicleId: 5, previousVehicleName: 'Buggy', newVehicleName: 'La Teigne',
    } as unknown as GameEventOrm;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = (mapper as any).toEvent(ormRow) as VehicleRenamedEvent;

    expect(event).toBeInstanceOf(VehicleRenamedEvent);
    expect(event.vehicleId).toBe(5);
    expect(event.previousName).toBe('Buggy');
    expect(event.newName).toBe('La Teigne');
  });
});

describe('CampaignRepository.eventToOrm — FAVORI_DU_PUBLIC_BONUS (régression bug trouvé)', () => {
  it('classe FavoriDuPublicBonusEvent comme FAVORI_DU_PUBLIC_BONUS, jamais VEHICLE_LOST — championshipPoints préservé', () => {
    const repo = makeRepo();
    const event = new FavoriDuPublicBonusEvent(0, 10, 1, 1, 7, 5);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orm = (repo as any).eventToOrm(event, 1) as Partial<GameEventOrm>;

    expect(orm.eventType).toBe('FAVORI_DU_PUBLIC_BONUS');
    expect(orm.eventType).not.toBe('VEHICLE_LOST');
    expect(orm.vehicleId).toBe(7);
    expect(orm.championshipPoints).toBe(5);
  });
});

describe('CampaignMapper.toEvent — FAVORI_DU_PUBLIC_BONUS (régression bug trouvé)', () => {
  it('reconstruit un FavoriDuPublicBonusEvent (pas un VehicleLostEvent) depuis une ligne FAVORI_DU_PUBLIC_BONUS', () => {
    const mapper = new CampaignMapper({} as never);
    const ormRow = {
      id: 99, gameId: 10, participantId: 1, eventOrder: 1, eventType: 'FAVORI_DU_PUBLIC_BONUS',
      vehicleId: 7, championshipPoints: 5,
    } as unknown as GameEventOrm;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = (mapper as any).toEvent(ormRow) as FavoriDuPublicBonusEvent;

    expect(event).toBeInstanceOf(FavoriDuPublicBonusEvent);
    expect(event.vehicleId).toBe(7);
    expect(event.championshipPoints).toBe(5);
  });
});

/**
 * Filet de sécurité générique : verrouille l'exhaustivité des deux `switch`
 * (`eventToOrm` / `toEvent`) sur les 14 valeurs de `GameEventType`, plutôt que de ne
 * couvrir que les deux collisions déjà rencontrées ci-dessus. Un futur `GameEventType`
 * ajouté sans son `case` de chaque côté échouera ici (`eventToOrm` ne compile plus,
 * `toEvent` lève `DomainException`) ou dans le test "couvre les 14 valeurs" si son
 * `case` existe mais que ce fichier n'a pas été mis à jour pour l'exercer.
 */
describe('CampaignRepository.eventToOrm — exhaustivité (14 types)', () => {
  const repo = makeRepo();

  const cases: Array<{ label: string; event: GameEvent; expected: Partial<GameEventOrm> }> = [
    {
      label: 'RankingAssignedEvent',
      event: new RankingAssignedEvent(0, 10, 1, 1, 2, 10),
      expected: { eventType: 'RANKING_ASSIGNED', rank: 2, championshipPoints: 10 },
    },
    {
      label: 'WalletMovementEvent',
      event: new WalletMovementEvent(0, 10, 1, 1, 4, WalletReason.RECOMPENSE),
      expected: { eventType: 'WALLET_MOVEMENT', amount: 4, walletReason: WalletReason.RECOMPENSE },
    },
    {
      label: 'VehicleLostEvent',
      event: new VehicleLostEvent(0, 10, 1, 1, 7),
      expected: { eventType: 'VEHICLE_LOST', vehicleId: 7 },
    },
    {
      label: 'WeaponLostEvent',
      event: new WeaponLostEvent(0, 10, 1, 1, 8),
      expected: { eventType: 'WEAPON_LOST', weaponId: 8 },
    },
    {
      label: 'ImprovementLostEvent',
      event: new ImprovementLostEvent(0, 10, 1, 1, 9),
      expected: { eventType: 'IMPROVEMENT_LOST', improvementId: 9 },
    },
    {
      label: 'AdvantageLostEvent',
      event: new AdvantageLostEvent(0, 10, 1, 1, 11),
      expected: { eventType: 'ADVANTAGE_LOST', advantageId: 11 },
    },
    {
      label: 'WreckResolvedEvent',
      event: new WreckResolvedEvent(0, 10, 1, 1, 7, 5, 2, WreckResult.ARRACHEE, 1),
      expected: {
        eventType: 'WRECK_RESOLVED', vehicleId: 7, diceRoll: 5, chocsBefore: 2,
        wreckResult: WreckResult.ARRACHEE, chocsGained: 1,
      },
    },
    {
      label: 'EquipmentChangedEvent',
      event: new EquipmentChangedEvent(
        0, 10, 1, 1,
        EquipmentOperation.SELL, EquipmentEntityType.WEAPON, 'mitrailleuse', 2,
        5, 12, null, null, null,
      ),
      expected: {
        eventType: 'EQUIPMENT_CHANGED', operation: EquipmentOperation.SELL,
        entityType: EquipmentEntityType.WEAPON, nomInterne: 'mitrailleuse', cost: 2,
        targetVehicleId: 5, targetEntityId: 12, orientation: null, freeAdvantageNomInterne: null,
      },
    },
    {
      label: 'ResistanceContactedEvent',
      event: new ResistanceContactedEvent(0, 10, 1, 1),
      expected: { eventType: 'RESISTANCE_CONTACTED' },
    },
    {
      label: 'GatesCrossedEvent',
      event: new GatesCrossedEvent(0, 10, 1, 1, 3, 3),
      expected: { eventType: 'GATES_CROSSED', gatesCrossed: 3, championshipPoints: 3 },
    },
    {
      label: 'VehicleDestroyedEvent',
      event: new VehicleDestroyedEvent(0, 10, 1, 1, 7, WeightClass.LOURD, 3),
      expected: { eventType: 'VEHICLE_DESTROYED', vehicleId: 7, weightClass: WeightClass.LOURD, championshipPoints: 3 },
    },
    {
      label: 'FavoriDuPublicBonusEvent',
      event: new FavoriDuPublicBonusEvent(0, 10, 1, 1, 7, 5),
      expected: { eventType: 'FAVORI_DU_PUBLIC_BONUS', vehicleId: 7, championshipPoints: 5 },
    },
    {
      label: 'VehicleRenamedEvent',
      event: new VehicleRenamedEvent(0, 10, 1, 1, 5, 'Buggy', 'La Teigne'),
      expected: { eventType: 'VEHICLE_RENAMED', vehicleId: 5, previousVehicleName: 'Buggy', newVehicleName: 'La Teigne' },
    },
    {
      label: 'SabotagePointsSpentEvent',
      event: new SabotagePointsSpentEvent(0, 10, 1, 1, 3),
      expected: { eventType: 'SABOTAGE_POINTS_SPENT', sabotagePointsSpent: 3 },
    },
  ];

  it.each(cases)('classe $label avec son propre eventType et ses champs propres', ({ event, expected }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orm = (repo as any).eventToOrm(event, 1) as Partial<GameEventOrm>;
    expect(orm).toMatchObject(expected);
  });

  it('couvre les 14 valeurs de GameEventType (aucune oubliée)', () => {
    const covered = new Set(cases.map((c) => c.expected.eventType));
    const allValues = Object.values(GameEventType);
    expect(covered.size).toBe(allValues.length);
    for (const value of allValues) {
      expect(covered.has(value)).toBe(true);
    }
  });
});

/**
 * Même filet côté reconstruction (ORM → domaine), pour les types qui ne nécessitent pas
 * de résolution catalogue (tous sauf EQUIPMENT_CHANGED — cf. tête de fichier).
 */
describe('CampaignMapper.toEvent — exhaustivité (12 types hors EQUIPMENT_CHANGED)', () => {
  const mapper = new CampaignMapper({} as never);

  const cases: Array<{ label: string; orm: Partial<GameEventOrm>; instanceOf: new (...args: never[]) => GameEvent }> = [
    {
      label: 'RANKING_ASSIGNED',
      orm: { eventType: 'RANKING_ASSIGNED', rank: 2, championshipPoints: 10 },
      instanceOf: RankingAssignedEvent,
    },
    {
      label: 'WALLET_MOVEMENT',
      orm: { eventType: 'WALLET_MOVEMENT', amount: 4, walletReason: WalletReason.RECOMPENSE },
      instanceOf: WalletMovementEvent,
    },
    {
      label: 'VEHICLE_LOST',
      orm: { eventType: 'VEHICLE_LOST', vehicleId: 7 },
      instanceOf: VehicleLostEvent,
    },
    {
      label: 'WEAPON_LOST',
      orm: { eventType: 'WEAPON_LOST', weaponId: 8 },
      instanceOf: WeaponLostEvent,
    },
    {
      label: 'IMPROVEMENT_LOST',
      orm: { eventType: 'IMPROVEMENT_LOST', improvementId: 9 },
      instanceOf: ImprovementLostEvent,
    },
    {
      label: 'ADVANTAGE_LOST',
      orm: { eventType: 'ADVANTAGE_LOST', advantageId: 11 },
      instanceOf: AdvantageLostEvent,
    },
    {
      label: 'WRECK_RESOLVED',
      orm: {
        eventType: 'WRECK_RESOLVED', vehicleId: 7, diceRoll: 5, chocsBefore: 2,
        wreckResult: WreckResult.ARRACHEE, chocsGained: 1,
      },
      instanceOf: WreckResolvedEvent,
    },
    {
      label: 'RESISTANCE_CONTACTED',
      orm: { eventType: 'RESISTANCE_CONTACTED' },
      instanceOf: ResistanceContactedEvent,
    },
    {
      label: 'GATES_CROSSED',
      orm: { eventType: 'GATES_CROSSED', gatesCrossed: 3, championshipPoints: 3 },
      instanceOf: GatesCrossedEvent,
    },
    {
      label: 'VEHICLE_DESTROYED',
      orm: { eventType: 'VEHICLE_DESTROYED', vehicleId: 7, weightClass: WeightClass.LOURD, championshipPoints: 3 },
      instanceOf: VehicleDestroyedEvent,
    },
    {
      label: 'FAVORI_DU_PUBLIC_BONUS',
      orm: { eventType: 'FAVORI_DU_PUBLIC_BONUS', vehicleId: 7, championshipPoints: 5 },
      instanceOf: FavoriDuPublicBonusEvent,
    },
    {
      label: 'VEHICLE_RENAMED',
      orm: { eventType: 'VEHICLE_RENAMED', vehicleId: 5, previousVehicleName: 'Buggy', newVehicleName: 'La Teigne' },
      instanceOf: VehicleRenamedEvent,
    },
  ];

  it.each(cases)('reconstruit $label dans la bonne classe concrète', ({ orm, instanceOf }) => {
    const ormRow = { id: 99, gameId: 10, participantId: 1, eventOrder: 1, ...orm } as unknown as GameEventOrm;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = (mapper as any).toEvent(ormRow) as GameEvent;
    expect(event).toBeInstanceOf(instanceOf);
  });
});
