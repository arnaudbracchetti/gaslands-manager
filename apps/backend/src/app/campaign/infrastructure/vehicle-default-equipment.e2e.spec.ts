/**
 * Test de bout en bout (sans base de données, sans HTTP) reproduisant le bug
 * corrigé : un véhicule acheté en atelier campagne n'avait pas son équipement
 * intégré (Arceaux du Buggy, Canon de 125mm sur Tourelle du Char d'assaut).
 *
 * Contrairement aux tests unitaires de `equipment-changed.event.spec.ts` (qui
 * fabriquent les Value Objects catalogue à la main), ce test utilise le VRAI
 * catalogue YAML (`RealCatalogService`, même pattern que `catalog.data.spec.ts`)
 * et enchaîne les DEUX points de résolution réels du bug :
 *
 * 1. Write-time — `ChangeEquipmentUseCase.execute()` : achat du véhicule,
 *    résolution catalogue de `resolvedVehicleType`/`resolvedDefaultImprovementTypes`.
 * 2. Persistance simulée — conversion de l'événement en ligne `GameEventOrm`,
 *    avec exactement les champs que `CampaignRepository.eventToOrm()` extrairait
 *    en production (`nomInterne`, pas les Value Objects résolus — eux ne sont
 *    jamais persistés, ils sont toujours re-résolus au replay).
 * 3. Replay-time — `CampaignMapper.toCampaign()` : reconstruit l'agrégat
 *    `Campaign` depuis la ligne ORM, ré-résolvant `resolvedDefaultImprovementTypes`/
 *    `resolvedDefaultWeaponType` depuis le catalogue.
 * 4. `campaign.replay()` reconstruit l'état final du `Team` — assertions sur le
 *    véhicule obtenu, exactement comme un rechargement de page taperait
 *    `GET /api/campaigns/:id/workshop` après redémarrage du serveur.
 */
import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CatalogService } from '../../catalog/catalog.service';
import { CampaignMapper } from './campaign.mapper';
import { ChangeEquipmentUseCase } from '../application/change-equipment.usecase';
import { CampaignReplayService } from './campaign-replay.service';
import { EquipmentChangedEvent } from '../domain/events/equipment-changed.event';
import { GameStatus } from '../domain/enums/game-status.enum';
import { CampaignState, ParticipantStatus } from '../domain/enums/campaign.enums';
import { EquipmentOperation, EquipmentEntityType } from '../domain/enums/equipment-change.enums';
import { Team } from '../../team/domain/team';
import type { GameEvent } from '../domain/events/game-event';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { CampaignOrm } from './entities/campaign.entity';
import type { CampaignParticipantOrm } from './entities/campaign-participant.entity';
import type { GameOrm } from './entities/game.entity';
import type { GameEventOrm } from './entities/game-event.entity';

// ── Catalogue réel (mêmes fichiers YAML que la production) ────────────────────
//
// __dirname = apps/backend/src/app/campaign/infrastructure/
// → 6 niveaux up → racine du workspace (cf. catalog.data.spec.ts pour le même
// pattern, à une profondeur de répertoire différente).
class RealCatalogService extends CatalogService {
  protected override readFileContent(filename: string): string {
    const filePath = path.resolve(__dirname, '../../../../../../', 'database_init', 'data', filename);
    return fs.readFileSync(filePath, 'utf-8');
  }
}

/** Mirroir de `CampaignRepository.eventToOrm()` (branche EQUIPMENT_CHANGED) — ne
 * transporte jamais les Value Objects résolus, seulement `nomInterne` : le
 * replay doit les re-résoudre lui-même depuis le catalogue (c'est justement le
 * point de résolution que ce test vérifie). */
function equipmentEventToOrm(event: EquipmentChangedEvent, id: number): GameEventOrm {
  return {
    id,
    gameId: event.gameId,
    participantId: event.participantId,
    eventOrder: id,
    eventType: 'EQUIPMENT_CHANGED',
    operation: event.operation,
    entityType: event.entityType,
    nomInterne: event.nomInterne,
    cost: event.cost,
    targetVehicleId: event.targetVehicleId,
    targetEntityId: event.targetEntityId,
    orientation: event.orientation,
    freeAdvantageNomInterne: null,
    rank: null, championshipPoints: null, gatesCrossed: null, weightClass: null,
    amount: null, walletReason: null, vehicleId: null, weaponId: null,
    diceRoll: null, chocsBefore: null, wreckResult: null, chocsGained: null,
    createdAt: new Date(),
  } as GameEventOrm;
}

describe('Achat d\'un véhicule en atelier — équipement par défaut (bout en bout, catalogue réel)', () => {
  it('un Buggy acheté en atelier reçoit ses Arceaux (estDefaut, prix 0) après persistance + replay', async () => {
    const catalog = new RealCatalogService();
    catalog.onModuleInit();
    const mapper = new CampaignMapper(catalog);

    const campaignId = 1;
    const gameId = 10;
    const participantId = 100;
    const userId = 42;

    const teamId = 1;

    // Journal simulé (remplace la table game_events) — appendEvents y écrit,
    // findCampaign le relit via le VRAI CampaignMapper (replay-time).
    const journal: GameEventOrm[] = [];
    let nextEventId = 1;

    const repo: ICampaignRepository = {
      findCampaign: vi.fn(async (id: number) => {
        expect(id).toBe(campaignId);
        // Équipe reconstruite à neuf à CHAQUE appel (0 véhicule persisté) — mirroir
        // fidèle d'`ITeamRepository.findManyByIds`, qui hydraterait toujours l'état
        // réellement en base (jamais les véhicules transients d'atelier, recréés
        // uniquement par le replay des événements ci-dessous). Réutiliser un même
        // objet `Team` muté entre deux replays produirait des véhicules en double.
        const team = new Team(teamId, userId, 'Les Furieux', 'Miyazaki', 50, null, []);
        const campaignOrm = { id: campaignId, name: 'Campagne', state: CampaignState.EN_CONSTRUCTION, inviteCode: 'code' } as CampaignOrm;
        const participantOrm = {
          id: participantId, campaignId, userId, teamId, isOrganizer: true,
          status: ParticipantStatus.VALIDATED,
        } as CampaignParticipantOrm;
        const gameOrm = {
          id: gameId, campaignId, scenarioId: 'scen', type: 'EVENEMENT_TELE', status: GameStatus.ATELIER, order: 1, playedAt: new Date(),
        } as GameOrm;
        const eventsByGameId = new Map([[gameId, journal]]);
        return mapper.toCampaign(campaignOrm, [participantOrm], [team], [gameOrm], eventsByGameId);
      }),
      appendEvents: vi.fn(async (_gameId: number, events: GameEvent[]) => {
        for (const e of events) {
          expect(e).toBeInstanceOf(EquipmentChangedEvent);
          journal.push(equipmentEventToOrm(e as EquipmentChangedEvent, nextEventId++));
        }
      }),
      deleteEvent: vi.fn(),
      deleteEvents: vi.fn(),
      saveCampaign: vi.fn(),
      createCampaign: vi.fn(),
      saveStructural: vi.fn(),
      deleteCampaign: vi.fn(),
      isTeamEngaged: vi.fn(),
    };

    const replayService = new CampaignReplayService(repo);
    const useCase = new ChangeEquipmentUseCase(repo, replayService, catalog);

    // 1. Achat — write-time : résolution catalogue réelle (Buggy + Arceaux).
    await useCase.execute({
      campaignId,
      userId,
      operation: EquipmentOperation.BUY,
      entityType: EquipmentEntityType.VEHICLE,
      nomInterne: 'buggy',
    });

    expect(journal).toHaveLength(1);
    expect(journal[0].nomInterne).toBe('buggy');

    // 2. Replay-time — reconstruit l'agrégat depuis le journal simulé, via le
    // VRAI CampaignMapper (résolution catalogue de l'équipement par défaut).
    const replayed = await replayService.loadAndReplay(campaignId);
    const replayedParticipant = replayed.findParticipant(participantId);
    const vehicle = replayedParticipant.team.vehicles[0];

    expect(vehicle).toBeDefined();
    expect(vehicle.type.nomInterne).toBe('buggy');
    expect(vehicle.improvements).toHaveLength(1);
    expect(vehicle.improvements[0].type.nomInterne).toBe('arceaux');
    expect(vehicle.improvements[0].estDefaut).toBe(true);
    expect(vehicle.improvements[0].price).toBe(0);
    expect(() => vehicle.removeImprovement(vehicle.improvements[0].id)).toThrow();
  });
});
