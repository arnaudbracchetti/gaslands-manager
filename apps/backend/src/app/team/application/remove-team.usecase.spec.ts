/**
 * Tests unitaires de `RemoveTeamUseCase` — même style que
 * `remove-user.usecase.spec.ts` : doubles littéraux (`vi.fn()`).
 *
 * Le cas central : la suppression doit être bloquée AVANT tout appel à
 * `teamRepo.remove` si elle laisserait une campagne sans organisateur
 * `VALIDATED` (cascade SQL `campaign_participants.teamId`, qui ne passe
 * jamais par `Campaign.assertNotLastOrganizer()`) — preuve que la garde
 * coupe la mutation, pas seulement qu'une erreur finit par apparaître.
 */
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Team } from '../domain/team';
import type { ITeamRepository } from '../domain/team.repository.interface';
import { RemoveTeamUseCase } from './remove-team.usecase';

function buildTeam(isLocked = false): Team {
  return new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [], isLocked);
}

describe('RemoveTeamUseCase', () => {
  const mockTeamRepo: Pick<ITeamRepository, 'findByIdForUser' | 'findCampaignsOrphanedIfTeamRemoved' | 'remove'> = {
    findByIdForUser: vi.fn(),
    findCampaignsOrphanedIfTeamRemoved: vi.fn(),
    remove: vi.fn(),
  };

  let useCase: RemoveTeamUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new RemoveTeamUseCase(mockTeamRepo as ITeamRepository);
  });

  it('supprime l\'équipe quand aucune campagne ne serait orpheline', async () => {
    (mockTeamRepo.findByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(buildTeam());
    (mockTeamRepo.findCampaignsOrphanedIfTeamRemoved as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await useCase.execute({ teamId: 1, userId: 42 });

    expect(mockTeamRepo.remove).toHaveBeenCalledWith(1, 42);
  });

  it(
    'refuse (400) et ne supprime jamais si l\'équipe est celle du dernier organisateur validé d\'une campagne',
    async () => {
      (mockTeamRepo.findByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(buildTeam());
      (mockTeamRepo.findCampaignsOrphanedIfTeamRemoved as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 10, name: 'Course à la Mort' },
      ]);

      await expect(useCase.execute({ teamId: 1, userId: 42 })).rejects.toThrow(BadRequestException);
      await expect(useCase.execute({ teamId: 1, userId: 42 })).rejects.toThrow(/Course à la Mort/);
      expect(mockTeamRepo.remove).not.toHaveBeenCalled();
    },
  );

  it('refuse (400) une équipe verrouillée par une campagne EN_COURS AVANT même de consulter la garde organisateur', async () => {
    (mockTeamRepo.findByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(buildTeam(true));

    await expect(useCase.execute({ teamId: 1, userId: 42 })).rejects.toThrow(BadRequestException);
    expect(mockTeamRepo.findCampaignsOrphanedIfTeamRemoved).not.toHaveBeenCalled();
    expect(mockTeamRepo.remove).not.toHaveBeenCalled();
  });
});
