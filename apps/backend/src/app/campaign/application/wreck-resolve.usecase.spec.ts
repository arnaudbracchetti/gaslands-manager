import { describe, it, expect, vi } from 'vitest';
import { WreckResolveUseCase } from './wreck-resolve.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import type { WreckResolverService } from '../infrastructure/wreck-resolver.service';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { EvenementTeleGame } from '../domain/games/evenement-tele-game';
import { GameStatus } from '../domain/enums/game-status.enum';
import { CampaignState } from '../domain/enums/campaign.enums';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import { WreckOutcome } from '../domain/wreck/wreck-outcome';
import { makeTestParticipant } from '../domain/test-helpers';

/**
 * Régression du bug "écran 3 du wizard bloqué" : la partie doit rester PLANIFIE au
 * moment où l'organisateur résout la Table des Épaves (l'entrée en atelier n'a lieu
 * qu'à la toute fin du wizard, via EnterAtelierUseCase — cf. Campaign.recordResult qui
 * ne fait pas entrer la partie en atelier). Ces tests exercent donc le use case avec
 * une partie PLANIFIE, exactement le scénario réel du wizard.
 */
function makeFixture(wreckResult: WreckResult, outcomeOverrides: Partial<WreckOutcome> = {}) {
  const { participant, vehicle } = makeTestParticipant(1);
  const organizer = new CampaignParticipant(1, 42, 1, true);
  organizer.attachTeam(participant.team);
  const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'scen', null, []);
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [organizer], [game]);

  const outcome = new WreckOutcome(
    vehicle.id,
    outcomeOverrides.diceRoll ?? 3,
    outcomeOverrides.chocsBefore ?? 0,
    wreckResult,
    outcomeOverrides.chocsGained ?? 0,
    outcomeOverrides.lostEquipment ?? null,
  );

  const campaignRepo: ICampaignRepository = {
    appendEvents: vi.fn().mockResolvedValue(undefined),
  } as unknown as ICampaignRepository;
  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;
  const wreckResolver: WreckResolverService = {
    resolve: vi.fn().mockReturnValue(outcome),
  } as unknown as WreckResolverService;

  const useCase = new WreckResolveUseCase(campaignRepo, replayService, wreckResolver);
  return { useCase, campaignRepo, game, vehicle };
}

describe('WreckResolveUseCase', () => {
  it('résout une partie encore PLANIFIE sans lever (bug historique : addEvent refusait tout une fois JOUE)', async () => {
    const { useCase, game } = makeFixture(WreckResult.INDEMNE);
    expect(game.status).toBe(GameStatus.PLANIFIE);

    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });

    expect(result.outcome.wreckResult).toBe(WreckResult.INDEMNE);
    expect(game.status).toBe(GameStatus.PLANIFIE); // toujours pas finalisée après un tirage
  });

  it('DEBOSSELE : une seule description (WreckResolvedEvent)', async () => {
    // chocsGained=0 (véhicule sans choc au départ) — le clamp à 0 est la règle
    // (cf. WreckOutcome.lookupTable), pas un choix arbitraire du test.
    const { useCase } = makeFixture(WreckResult.DEBOSSELE, { chocsGained: 0 });
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });
    expect(result.descriptions).toHaveLength(1);
    expect(result.descriptions[0]).toContain('Débosselé');
  });

  it('ARRACHEE avec une arme perdue : deux descriptions (WreckResolved + WeaponLost)', async () => {
    const { useCase } = makeFixture(WreckResult.ARRACHEE, {
      chocsGained: 1,
      lostEquipment: { kind: 'weapon', id: 10 },
    });
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });
    expect(result.descriptions).toHaveLength(2);
    expect(result.descriptions[1]).toBe('Arme perdue');
  });

  it('ARRACHEE avec une amélioration perdue : deux descriptions (WreckResolved + ImprovementLost)', async () => {
    const { useCase } = makeFixture(WreckResult.ARRACHEE, {
      chocsGained: 1,
      lostEquipment: { kind: 'improvement', id: 20 },
    });
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });
    expect(result.descriptions).toHaveLength(2);
    expect(result.descriptions[1]).toBe('Amélioration perdue');
  });

  it('SIEGE_IRRECUPERABLE : deux descriptions (WreckResolved + SequellaAdded)', async () => {
    const { useCase } = makeFixture(WreckResult.SIEGE_IRRECUPERABLE, { chocsGained: 2 });
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });
    expect(result.descriptions).toHaveLength(2);
    expect(result.descriptions[1]).toContain('Séquelle acquise');
  });

  it('VEHICULE_DETRUIT sans favori du public : une description (VehicleLost)', async () => {
    const { useCase } = makeFixture(WreckResult.VEHICULE_DETRUIT);
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1,
    });
    expect(result.descriptions).toHaveLength(2);
    expect(result.descriptions[1]).toBe('Véhicule détruit');
  });

  it('VEHICULE_DETRUIT avec favori du public en attente : trois descriptions (+ FavoriDuPublicBonus)', async () => {
    const { useCase } = makeFixture(WreckResult.VEHICULE_DETRUIT);
    const result = await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1, pendingFavoriDuPublic: true,
    });
    expect(result.descriptions).toHaveLength(3);
    expect(result.descriptions[2]).toContain('Bonus Favori du public');
  });

  it('persiste tous les événements créés via appendEvents', async () => {
    const { useCase, campaignRepo } = makeFixture(WreckResult.CHASSIS_FRAGILISE, { chocsGained: 2 });
    await useCase.execute({ campaignId: 1, gameId: 10, userId: 42, participantId: 1, vehicleId: 1 });
    expect(campaignRepo.appendEvents).toHaveBeenCalledWith(10, expect.arrayContaining([
      expect.objectContaining({ gameId: 10, participantId: 1 }),
    ]));
  });
});
