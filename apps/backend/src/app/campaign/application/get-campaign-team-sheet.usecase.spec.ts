import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { GetCampaignTeamSheetUseCase } from './get-campaign-team-sheet.usecase';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { CampaignState } from '../domain/enums/campaign.enums';
import { makeTestParticipant, makeVehicleType } from '../domain/test-helpers';
import { Team } from '../../team/domain/team';
import { Vehicle } from '../../team/domain/vehicle';

/** Second participant (userId distinct de 42, contrairement à `makeTestParticipant`) — pour simuler un leader avec un écart de PC connu, ou un organisateur/tiers. */
function makeOtherParticipant(participantId: number, userId: number, points: number, isOrganizer = false): CampaignParticipant {
  const vehicle = new Vehicle(1000 + participantId, 1000 + participantId, makeVehicleType(), [], []);
  const team = new Team(1000 + participantId, userId, 'Autre équipe', 'Rutherford', 50, null, [vehicle]);
  const participant = new CampaignParticipant(participantId, userId, team.id, isOrganizer);
  participant.attachTeam(team);
  participant.addPoints(points);
  return participant;
}

function makeFixture() {
  const { participant, vehicle } = makeTestParticipant(1);
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;
  const useCase = new GetCampaignTeamSheetUseCase(replayService);
  return { useCase, vehicle, campaign };
}

describe('GetCampaignTeamSheetUseCase', () => {
  it('génère la fiche HTML pour le participant courant', async () => {
    const { useCase } = makeFixture();

    const html = await useCase.execute({ campaignId: 1, userId: 42, playerName: 'Jean Dupont' });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Rutherford');
  });

  it('affiche le nom du joueur transmis dans la commande', async () => {
    const { useCase } = makeFixture();

    const html = await useCase.execute({ campaignId: 1, userId: 42, playerName: 'Jean Dupont' });

    expect(html).toContain('Joueur : Jean Dupont');
  });

  it('affiche une case par point de sabotage disponible (dérivé des Points de Résistance)', async () => {
    const { useCase, campaign } = makeFixture();
    campaign.participants[0]?.addResistance(9); // floor(9/3) = 3 points de sabotage

    const html = await useCase.execute({ campaignId: 1, userId: 42, playerName: 'Jean Dupont' });

    const boxes = html.match(/<span class="sabotage-boxes">((?:<span class="box small"><\/span>)*)<\/span>/);
    expect(boxes?.[1]?.match(/<span class="box small">/g)).toHaveLength(3);
  });

  it('affiche 0 VP à la place du coût total quand ce participant est seul classé (repli sur ses propres PC)', async () => {
    const { useCase } = makeFixture();

    const html = await useCase.execute({ campaignId: 1, userId: 42, playerName: 'Jean Dupont' });

    expect(html).toContain('<div class="team-total">0 <span class="unit">VP</span></div>');
  });

  it('affiche les Votes du Public dérivés de l\'écart de PC avec le leader de la campagne', async () => {
    const { participant: me } = makeTestParticipant(1); // 0 PC
    const leader = makeOtherParticipant(2, 999, 15); // écart de 15 PC → 1 VP
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [me, leader], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetCampaignTeamSheetUseCase(replayService);

    const html = await useCase.execute({ campaignId: 1, userId: 42, playerName: 'Jean Dupont' });

    expect(html).toContain('<div class="team-total">1 <span class="unit">VP</span></div>');
  });

  it('reflète les chocs réels accumulés en campagne (jamais visibles depuis la lecture équipe directe)', async () => {
    const { useCase, vehicle } = makeFixture();
    vehicle.addChocs(3);

    const html = await useCase.execute({ campaignId: 1, userId: 42, playerName: 'Jean Dupont' });

    expect(html).toContain('Chocs : 3');
  });

  it('rejette avec NotFoundException si l\'utilisateur n\'est pas participant', async () => {
    const { participant } = makeTestParticipant(1);
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetCampaignTeamSheetUseCase(replayService);

    await expect(useCase.execute({ campaignId: 1, userId: 999, playerName: 'Jean Dupont' })).rejects.toThrow(NotFoundException);
  });

  it('rejette avec NotFoundException si le participant n\'a pas d\'équipe attachée', async () => {
    const participant = new CampaignParticipant(1, 42, null, false);
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetCampaignTeamSheetUseCase(replayService);

    await expect(useCase.execute({ campaignId: 1, userId: 42, playerName: 'Jean Dupont' })).rejects.toThrow(NotFoundException);
  });

  describe('participantId — fiche d\'un tiers (organisateur uniquement)', () => {
    it('l\'organisateur peut récupérer la fiche d\'un autre participant', async () => {
      const organizer = makeOtherParticipant(1, 42, 0, true);
      const target = makeOtherParticipant(2, 999, 0);
      const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [organizer, target], []);
      const replayService: CampaignReplayService = {
        loadAndReplay: vi.fn().mockResolvedValue(campaign),
      } as unknown as CampaignReplayService;
      const useCase = new GetCampaignTeamSheetUseCase(replayService);

      const html = await useCase.execute({
        campaignId: 1, userId: 42, playerName: 'Nom De La Cible', participantId: 2,
      });

      expect(html).toContain('<!doctype html>');
      expect(html).toContain('Joueur : Nom De La Cible');
      expect(html).toContain('<span class="team-name">Autre équipe</span>');
    });

    it('rejette avec NotFoundException si l\'appelant n\'est pas organisateur', async () => {
      const caller = makeOtherParticipant(1, 42, 0, false);
      const target = makeOtherParticipant(2, 999, 0);
      const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [caller, target], []);
      const replayService: CampaignReplayService = {
        loadAndReplay: vi.fn().mockResolvedValue(campaign),
      } as unknown as CampaignReplayService;
      const useCase = new GetCampaignTeamSheetUseCase(replayService);

      await expect(
        useCase.execute({ campaignId: 1, userId: 42, playerName: 'X', participantId: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejette avec NotFoundException si le participant ciblé n\'existe pas', async () => {
      const organizer = makeOtherParticipant(1, 42, 0, true);
      const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [organizer], []);
      const replayService: CampaignReplayService = {
        loadAndReplay: vi.fn().mockResolvedValue(campaign),
      } as unknown as CampaignReplayService;
      const useCase = new GetCampaignTeamSheetUseCase(replayService);

      await expect(
        useCase.execute({ campaignId: 1, userId: 42, playerName: 'X', participantId: 999 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('affiche les points de sabotage réels sur la fiche d\'un tiers (route déjà réservée à l\'organisateur, secret D-S4 non applicable ici)', async () => {
      const organizer = makeOtherParticipant(1, 42, 0, true);
      const target = makeOtherParticipant(2, 999, 0);
      target.addResistance(9); // 3 points de sabotage réels
      const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [organizer, target], []);
      const replayService: CampaignReplayService = {
        loadAndReplay: vi.fn().mockResolvedValue(campaign),
      } as unknown as CampaignReplayService;
      const useCase = new GetCampaignTeamSheetUseCase(replayService);

      const html = await useCase.execute({ campaignId: 1, userId: 42, playerName: 'X', participantId: 2 });

      const boxes = html.match(/<span class="sabotage-boxes">((?:<span class="box small"><\/span>)*)<\/span>/);
      expect(boxes?.[1]?.match(/<span class="box small">/g)).toHaveLength(3);
    });

    it('calcule les Votes du Public normalement sur la fiche d\'un tiers (pas secret)', async () => {
      const organizer = makeOtherParticipant(1, 42, 20, true); // leader, 20 PC
      const target = makeOtherParticipant(2, 999, 5); // écart de 15 PC → 1 VP
      const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [organizer, target], []);
      const replayService: CampaignReplayService = {
        loadAndReplay: vi.fn().mockResolvedValue(campaign),
      } as unknown as CampaignReplayService;
      const useCase = new GetCampaignTeamSheetUseCase(replayService);

      const html = await useCase.execute({ campaignId: 1, userId: 42, playerName: 'X', participantId: 2 });

      expect(html).toContain('<div class="team-total">1 <span class="unit">VP</span></div>');
    });
  });
});
