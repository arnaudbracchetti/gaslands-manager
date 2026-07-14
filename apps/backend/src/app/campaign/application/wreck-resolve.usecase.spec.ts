import { describe, it, expect, vi } from 'vitest';
import { WreckResolveUseCase } from './wreck-resolve.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { WreckTable } from '../domain/wreck/wreck-table';
import type { IRandomizer } from '../domain/randomizer.interface';
import type { ICatalogRepository } from '../../team/domain/catalog.repository.interface';
import { SequellaType } from '../../team/domain/value-objects/sequella-type';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { EvenementTeleGame } from '../domain/games/evenement-tele-game';
import { GameStatus } from '../domain/enums/game-status.enum';
import { CampaignState } from '../domain/enums/campaign.enums';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import { makeTestParticipant } from '../domain/test-helpers';
import type { Vehicle } from '../../team/domain/vehicle';

/** Randomizer déterministe — implémente IRandomizer sans sous-classer WreckTable. */
class FixedRandomizer implements IRandomizer {
  constructor(private readonly fixedRoll: number, private readonly fixedPickIndex = 0) {}
  roll(_sides: number): number { return this.fixedRoll; }
  pick<T>(pool: T[]): T { return pool[this.fixedPickIndex]; }
}

const SIEGE_IRRECUPERABLE = SequellaType.from({
  nom: 'Siège irrécupérable', nom_interne: 'siege_irrecuperable', description: '', regles: '', chocs_cost: 0, origine: 'TABLE_EPAVES',
});

/** Catalogue minimal — seule `getSequellaType('siege_irrecuperable')` est appelée par WreckTable. */
const catalog: ICatalogRepository = {
  getVehicleType: () => undefined,
  getWeaponType: () => undefined,
  getImprovementType: () => undefined,
  getAdvantageType: () => undefined,
  getSequellaType: (nomInterne: string) => (nomInterne === 'siege_irrecuperable' ? SIEGE_IRRECUPERABLE : undefined),
  getVehicleTypesForSponsor: () => [],
  getWeaponTypesForSponsor: () => [],
  getImprovementTypesForSponsor: () => [],
  getAdvantageTypesForSponsor: () => [],
};

/**
 * Régression du bug "écran 3 du wizard bloqué" : la partie doit rester PLANIFIE au
 * moment où l'organisateur résout la Table des Épaves (l'entrée en atelier n'a lieu
 * qu'à la toute fin du wizard, via EnterAtelierUseCase — cf. Campaign.recordResult qui
 * ne fait pas entrer la partie en atelier). Ces tests exercent donc le use case avec
 * une partie PLANIFIE, exactement le scénario réel du wizard.
 */
function makeFixture(wreckTable: WreckTable): {
  useCase: WreckResolveUseCase;
  campaignRepo: ICampaignRepository;
  game: EvenementTeleGame;
  vehicle: Vehicle;
} {
  const { participant, vehicle } = makeTestParticipant(1);
  const organizer = new CampaignParticipant(1, 42, 1, true);
  organizer.attachTeam(participant.team);
  const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [organizer], [game]);

  const campaignRepo: ICampaignRepository = {
    appendEvents: vi.fn().mockResolvedValue(undefined),
  } as unknown as ICampaignRepository;
  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;

  const useCase = new WreckResolveUseCase(campaignRepo, replayService, wreckTable);
  return { useCase, campaignRepo, game, vehicle };
}

// Vehicle Moyen, chocs=0, weightModifier=0 → modifiedRoll = diceRoll + chocs
// pool = [weapon(id=10), improvement(id=20)]

describe('WreckResolveUseCase', () => {
  it('résout une partie encore PLANIFIE sans lever (bug historique : addEvent refusait tout une fois JOUE)', async () => {
    // diceRoll=2, modifiedRoll=2 → INDEMNE
    const { useCase, game } = makeFixture(new WreckTable(new FixedRandomizer(2), catalog));
    expect(game.status).toBe(GameStatus.PLANIFIE);

    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });

    expect(result.outcome.wreckResult).toBe(WreckResult.INDEMNE);
    expect(game.status).toBe(GameStatus.PLANIFIE); // toujours pas finalisée après un tirage
  });

  it('DEBOSSELE : une seule description (WreckResolvedEvent)', async () => {
    // diceRoll=1, modifiedRoll=1 → DEBOSSELE, chocsGained=0 (chocsBefore=0 → clamp min)
    const { useCase } = makeFixture(new WreckTable(new FixedRandomizer(1), catalog));
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });
    expect(result.descriptions).toHaveLength(1);
    expect(result.descriptions[0]).toContain('Débosselé');
  });

  it('ARRACHEE avec une arme perdue : deux descriptions (WreckResolved + WeaponLost)', async () => {
    // diceRoll=5, modifiedRoll=5 → ARRACHEE, pickIndex=0 → weapon(id=10)
    const { useCase } = makeFixture(new WreckTable(new FixedRandomizer(5, 0), catalog));
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });
    expect(result.descriptions).toHaveLength(2);
    expect(result.descriptions[1]).toBe('Arme perdue sur le véhicule Voiture : Mitrailleuse');
  });

  it('ARRACHEE avec une amélioration perdue : deux descriptions (WreckResolved + ImprovementLost)', async () => {
    // diceRoll=5, modifiedRoll=5 → ARRACHEE, pickIndex=1 → improvement(id=20)
    const { useCase } = makeFixture(new WreckTable(new FixedRandomizer(5, 1), catalog));
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });
    expect(result.descriptions).toHaveLength(2);
    expect(result.descriptions[1]).toBe('Amélioration perdue sur le véhicule Voiture : Blindage');
  });

  it('SIEGE_IRRECUPERABLE : deux descriptions (WreckResolved + EquipmentChangedEvent SEQUELLE)', async () => {
    // diceRoll=6, vehicle.addChocs(1) → modifiedRoll=7 → SIEGE_IRRECUPERABLE
    const { useCase, vehicle } = makeFixture(new WreckTable(new FixedRandomizer(6), catalog));
    vehicle.addChocs(1);
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });
    expect(result.descriptions).toHaveLength(2);
    expect(result.descriptions[1]).toContain('Siège irrécupérable');
  });

  it('VEHICULE_DETRUIT sans favori du public : deux descriptions (WreckResolved + VehicleLost)', async () => {
    // diceRoll=6, vehicle.addChocs(4) → modifiedRoll=10 → VEHICULE_DETRUIT
    const { useCase, vehicle } = makeFixture(new WreckTable(new FixedRandomizer(6), catalog));
    vehicle.addChocs(4);
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });
    expect(result.descriptions).toHaveLength(2);
    expect(result.descriptions[1]).toBe('Véhicule détruit : Voiture');
  });

  it('VEHICULE_DETRUIT avec favori du public en attente : trois descriptions (+ FavoriDuPublicBonus)', async () => {
    // diceRoll=6, vehicle.addChocs(4) → modifiedRoll=10 → VEHICULE_DETRUIT
    const { useCase, vehicle } = makeFixture(new WreckTable(new FixedRandomizer(6), catalog));
    vehicle.addChocs(4);
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1, pendingFavoriDuPublic: true,
    });
    expect(result.descriptions).toHaveLength(3);
    expect(result.descriptions[2]).toContain('Bonus Favori du public');
  });

  it('persiste tous les événements créés via appendEvents', async () => {
    // diceRoll=6, vehicle.addChocs(2) → modifiedRoll=8 → CHASSIS_FRAGILISE
    const { useCase, vehicle, campaignRepo } = makeFixture(new WreckTable(new FixedRandomizer(6), catalog));
    vehicle.addChocs(2);
    await useCase.execute({ campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1 });
    expect(campaignRepo.appendEvents).toHaveBeenCalledWith(10, expect.arrayContaining([
      expect.objectContaining({ gameId: 10, participantId: 1 }),
    ]));
  });
});
