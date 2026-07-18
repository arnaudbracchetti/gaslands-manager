import { describe, it, expect } from 'vitest';
import { CampaignRepository } from './campaign.repository';
import { CampaignMapper } from './campaign.mapper';
import type { GameEventOrm } from './entities/game-event.entity';
import { VehicleRenamedEvent } from '../domain/events/vehicle-renamed.event';
import { VehicleLostEvent } from '../domain/events/vehicle-lost.event';

/**
 * Régression C2 (cf. docs/plans/2026-07-17-vehicle-instance-name-design.md) :
 * `CampaignRepository.eventToOrm` dispatche par duck-typing (cascade de
 * `'propriété' in e`), pas par discriminant explicite. `VehicleRenamedEvent` porte
 * `vehicleId` sans `diceRoll`/`operation`/`weaponId` — exactement le pattern testé par
 * la branche `VEHICLE_LOST` de cette cascade. Sans le check `instanceof` dédié (avant
 * la cascade), il serait classé silencieusement comme `VEHICLE_LOST` : le véhicule
 * renommé apparaîtrait perdu au prochain replay.
 *
 * `eventToOrm`/`toEvent` sont privées — accédées ici via cast, aucune des deux
 * méthodes ne touche aux dépendances injectées (repositories TypeORM/CatalogService),
 * donc des dépendances factices suffisent.
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
