import { describe, it, expect, vi } from 'vitest';
import { RecordResultUseCase } from './record-result.usecase';
import type { ICampaignRepository } from '../domain/campaign.repository.interface';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { CampaignReplayService as RealCampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { EvenementTeleGame } from '../domain/games/evenement-tele-game';
import { EscarmoucheGame } from '../domain/games/escarmouche-game';
import { GameStatus } from '../domain/enums/game-status.enum';
import { CampaignState } from '../domain/enums/campaign.enums';
import { ParticipantStatus } from '../domain/enums/campaign.enums';
import { RankingAssignedEvent } from '../domain/events/ranking-assigned.event';
import { WalletMovementEvent } from '../domain/events/wallet-movement.event';
import { VehicleDestroyedEvent } from '../domain/events/vehicle-destroyed.event';
import { EquipmentChangedEvent } from '../domain/events/equipment-changed.event';
import { EquipmentOperation, EquipmentEntityType } from '../domain/enums/equipment-change.enums';
import { Vehicle } from '../../team/domain/vehicle';
import { Team } from '../../team/domain/team';
import { makeVehicleType } from '../domain/test-helpers';

function makeFixture(game: EvenementTeleGame | EscarmoucheGame): {
  useCase: RecordResultUseCase;
  campaignRepo: ICampaignRepository;
  campaign: Campaign;
} {
  const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
  const p2 = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
  const enemyVehicle = new Vehicle(56, 3, makeVehicleType('Lourd'), [], []);
  const enemyTeam = new Team(3, 7, 'Les Ennemis', 'Rutherford', 50, null, [enemyVehicle]);
  p2.attachTeam(enemyTeam);
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [p1, p2], [game]);

  const campaignRepo: ICampaignRepository = {
    appendEvents: vi.fn().mockResolvedValue(undefined),
  } as unknown as ICampaignRepository;
  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;

  const useCase = new RecordResultUseCase(campaignRepo, replayService);
  return { useCase, campaignRepo, campaign };
}

describe('RecordResultUseCase — Événement Télévisé (results)', () => {
  it('enregistre le classement et persiste les événements', async () => {
    const game = new EvenementTeleGame(10, 1, GameStatus.PLANIFIE, 1, 'course_de_la_mort', null, []);
    const { useCase, campaignRepo } = makeFixture(game);

    await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42,
      results: [{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }],
    });

    expect(campaignRepo.appendEvents).toHaveBeenCalledWith(10, expect.arrayContaining([
      expect.any(RankingAssignedEvent),
    ]));
    expect(game.events.some((e) => e instanceof RankingAssignedEvent)).toBe(true);
  });

  it('refuse results sur une Escarmouche (garde domaine Game.recordResult)', async () => {
    const game = new EscarmoucheGame(10, 1, GameStatus.PLANIFIE, 1, 'embuscade', null, []);
    const { useCase } = makeFixture(game);

    await expect(
      useCase.execute({ campaignId: 1, gameId: 10, userId: 42, results: [{ participantId: 1, rank: 1 }] }),
    ).rejects.toThrow('Événement Télévisé');
  });
});

describe('RecordResultUseCase — Escarmouche (jerricanGains / destroyedVehicles)', () => {
  it('crédite le butin manuel de jerricans (WalletMovementEvent)', async () => {
    const game = new EscarmoucheGame(10, 1, GameStatus.PLANIFIE, 1, 'pillage_de_convoi', null, []);
    const { useCase, campaignRepo } = makeFixture(game);

    await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42,
      jerricanGains: [{ participantId: 1, amount: 5 }],
    });

    expect(campaignRepo.appendEvents).toHaveBeenCalledWith(10, [
      expect.objectContaining({ participantId: 1, amount: 5 }),
    ]);
    expect(game.events[0]).toBeInstanceOf(WalletMovementEvent);
  });

  it('trace un véhicule ennemi détruit à 0 PC (aucun effet sur le classement)', async () => {
    const game = new EscarmoucheGame(10, 1, GameStatus.PLANIFIE, 1, 'embuscade', null, []);
    const { useCase, campaignRepo } = makeFixture(game);

    await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42,
      destroyedVehicles: [{ destroyerId: 1, vehicleId: 56 }],
    });

    expect(campaignRepo.appendEvents).toHaveBeenCalledWith(10, [
      expect.objectContaining({ participantId: 1, vehicleId: 56, championshipPoints: 0 }),
    ]);
    expect(game.events[0]).toBeInstanceOf(VehicleDestroyedEvent);
  });

  it('ne persiste rien si les trois champs sont absents', async () => {
    const game = new EscarmoucheGame(10, 1, GameStatus.PLANIFIE, 1, 'embuscade', null, []);
    const { useCase, campaignRepo } = makeFixture(game);

    await useCase.execute({ campaignId: 1, gameId: 10, userId: 42 });

    expect(campaignRepo.appendEvents).not.toHaveBeenCalled();
  });

  it('cumule jerricanGains et destroyedVehicles en un seul appendEvents', async () => {
    const game = new EscarmoucheGame(10, 1, GameStatus.PLANIFIE, 1, 'pillage_de_convoi', null, []);
    const { useCase, campaignRepo } = makeFixture(game);

    await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42,
      jerricanGains: [{ participantId: 1, amount: 3 }],
      destroyedVehicles: [{ destroyerId: 1, vehicleId: 56 }],
    });

    expect(campaignRepo.appendEvents).toHaveBeenCalledTimes(1);
    expect(campaignRepo.appendEvents).toHaveBeenCalledWith(10, [
      expect.any(WalletMovementEvent),
      expect.any(VehicleDestroyedEvent),
    ]);
  });
});

describe('RecordResultUseCase — véhicule transient (id négatif, D-S11)', () => {
  it('destroyedVehicles cible un véhicule acheté en atelier lors d\'une partie antérieure, sans DomainException (régression : le use case doit rejouer le journal, pas juste charger l\'agrégat)', async () => {
    // Contrairement aux tests ci-dessus (campagne pré-construite à la main, `loadAndReplay`
    // mocké pour la retourner telle quelle), ce test utilise le VRAI `CampaignReplayService`
    // pour que `campaign.replay()` s'exécute réellement et recrée le véhicule transient
    // (id = -eventId) depuis un `EquipmentChangedEvent(BUY, VEHICLE)` brut — seul moyen de
    // reproduire le bug "Véhicule #-137 introuvable dans la campagne" (RecordResultUseCase
    // appelait `.load()`, qui ne rejoue jamais le journal).
    const vehicleType = makeVehicleType('Lourd');

    const p1 = new CampaignParticipant(1, 42, 1, true, ParticipantStatus.VALIDATED);
    p1.attachTeam(new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, []));

    const p2 = new CampaignParticipant(2, 7, 3, false, ParticipantStatus.VALIDATED);
    p2.attachTeam(new Team(3, 7, 'Les Ennemis', 'Rutherford', 50, null, []));

    // Partie antérieure déjà JOUE : le véhicule ennemi y a été acheté en atelier
    // (jamais persisté en base — id = -event.id = -77 une fois rejoué).
    const buyVehicleEvent = new EquipmentChangedEvent(
      77, 5, p2.id, 0,
      EquipmentOperation.BUY, EquipmentEntityType.VEHICLE, 'voiture', 12,
      null, null, null, vehicleType, null, null, null,
    );
    const previousGame = new EscarmoucheGame(5, 1, GameStatus.JOUE, 1, 'pillage_de_convoi', new Date(), [buyVehicleEvent]);
    const currentGame = new EscarmoucheGame(10, 1, GameStatus.PLANIFIE, 2, 'embuscade', null, []);

    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [p1, p2], [previousGame, currentGame]);

    const campaignRepo: ICampaignRepository = {
      findCampaign: vi.fn().mockResolvedValue(campaign),
      appendEvents: vi.fn().mockResolvedValue(undefined),
    } as unknown as ICampaignRepository;

    const useCase = new RecordResultUseCase(campaignRepo, new RealCampaignReplayService(campaignRepo));

    await useCase.execute({
      campaignId: 1, gameId: 10, userId: 42,
      destroyedVehicles: [{ destroyerId: 1, vehicleId: -77 }],
    });

    expect(campaignRepo.appendEvents).toHaveBeenCalledWith(10, [
      expect.objectContaining({ vehicleId: -77, championshipPoints: 0 }),
    ]);
  });
});
