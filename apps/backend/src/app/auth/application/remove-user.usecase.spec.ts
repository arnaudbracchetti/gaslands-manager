/**
 * Tests unitaires de `RemoveUserUseCase` - doubles littéraux simples (`vi.fn()`),
 * même style que `register.usecase.spec.ts`.
 *
 * Le cas central : la suppression doit être bloquée AVANT tout appel à
 * `userRepo.remove` si elle laisserait une campagne sans organisateur
 * `VALIDATED` - la preuve que la garde coupe la mutation, pas seulement
 * qu'elle finit par renvoyer une erreur.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ICampaignRepository } from '../../campaign/domain/campaign.repository.interface';
import { User } from '../domain/user';
import { UserRole } from '../domain/user-role';
import type { IUserRepository } from '../domain/user.repository.interface';
import { RemoveUserUseCase } from './remove-user.usecase';

function buildUser(id: number): User {
  return new User(id, 'Max', 'Rockatansky', 'MadMax', 'max@test.com', 'hashed:x', UserRole.USER, true, new Date(), new Date());
}

describe('RemoveUserUseCase', () => {
  const mockUserRepo: IUserRepository = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findAll: vi.fn(),
    findAdmin: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };

  const mockCampaignRepo: Pick<ICampaignRepository, 'findCampaignsWhereSoleValidatedOrganizer'> = {
    findCampaignsWhereSoleValidatedOrganizer: vi.fn(),
  };

  let useCase: RemoveUserUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new RemoveUserUseCase(mockUserRepo, mockCampaignRepo as ICampaignRepository);
  });

  it('supprime le compte quand aucune campagne ne serait orpheline', async () => {
    (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(buildUser(2));
    (mockCampaignRepo.findCampaignsWhereSoleValidatedOrganizer as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await useCase.execute({ userId: 2, requesterId: 1 });

    expect(mockUserRepo.remove).toHaveBeenCalledWith(2);
  });

  it('refuse (400) et ne supprime jamais si le compte est le seul organisateur validé d\'une campagne', async () => {
    (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(buildUser(2));
    (mockCampaignRepo.findCampaignsWhereSoleValidatedOrganizer as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 10, name: 'Course à la Mort' },
    ]);

    await expect(useCase.execute({ userId: 2, requesterId: 1 })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ userId: 2, requesterId: 1 })).rejects.toThrow(/Course à la Mort/);
    expect(mockUserRepo.remove).not.toHaveBeenCalled();
  });

  it('refuse (403) l\'auto-suppression AVANT même de consulter les campagnes', async () => {
    (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(buildUser(1));

    await expect(useCase.execute({ userId: 1, requesterId: 1 })).rejects.toThrow(ForbiddenException);
    expect(mockCampaignRepo.findCampaignsWhereSoleValidatedOrganizer).not.toHaveBeenCalled();
    expect(mockUserRepo.remove).not.toHaveBeenCalled();
  });

  it('renvoie 404 si le compte cible n\'existe pas', async () => {
    (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(useCase.execute({ userId: 999, requesterId: 1 })).rejects.toThrow(NotFoundException);
  });
});
