/**
 * Tests unitaires pour TeamController.
 *
 * Le controller délègue maintenant à 4 use cases distincts (architecture DDD).
 * On mocke chaque use case pour tester le câblage HTTP en isolation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TeamController } from './team.controller';
import { GetTeamSummariesUseCase } from './application/get-team-summaries.usecase';
import { CreateTeamUseCase } from './application/create-team.usecase';
import { UpdateTeamUseCase } from './application/update-team.usecase';
import { RemoveTeamUseCase } from './application/remove-team.usecase';
import { GetTeamSheetUseCase } from './application/get-team-sheet.usecase';
import type { TeamSummaryDto } from './domain/team.repository.interface';

const mockUser = { id: 42, email: 'test@test.com' };
const mockRequest = { user: mockUser };

const mockSummary: TeamSummaryDto = {
  id: 1,
  name: 'Les Furieux du Désert',
  sponsor: 'Rutherford',
  cans: 50,
  description: null,
  vehicleCount: 0,
  isEngaged: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('TeamController', () => {
  let controller: TeamController;

  const mockGetSummaries = { execute: vi.fn() };
  const mockCreate = { execute: vi.fn() };
  const mockUpdate = { execute: vi.fn() };
  const mockRemove = { execute: vi.fn() };
  const mockGetSheet = { execute: vi.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamController],
      providers: [
        { provide: GetTeamSummariesUseCase, useValue: mockGetSummaries },
        { provide: CreateTeamUseCase, useValue: mockCreate },
        { provide: UpdateTeamUseCase, useValue: mockUpdate },
        { provide: RemoveTeamUseCase, useValue: mockRemove },
        { provide: GetTeamSheetUseCase, useValue: mockGetSheet },
      ],
    }).compile();

    controller = module.get<TeamController>(TeamController);
    vi.clearAllMocks();
  });

  describe('getAll()', () => {
    it('délègue à GetTeamSummariesUseCase avec userId', async () => {
      mockGetSummaries.execute.mockResolvedValue([mockSummary]);

      const result = await controller.getAll(mockRequest as never);

      expect(mockGetSummaries.execute).toHaveBeenCalledWith({ userId: 42 });
      expect(result).toEqual([mockSummary]);
    });
  });

  describe('create()', () => {
    it('délègue à CreateTeamUseCase avec userId et les champs du DTO', async () => {
      const dto = { name: 'Nouvelle équipe', sponsor: 'Miyazaki', cans: 60 };
      mockCreate.execute.mockResolvedValue({ ...mockSummary, ...dto });

      const result = await controller.create(mockRequest as never, dto);

      expect(mockCreate.execute).toHaveBeenCalledWith({ userId: 42, ...dto });
      expect(result).toMatchObject({ name: 'Nouvelle équipe' });
    });
  });

  describe('update()', () => {
    it('délègue à UpdateTeamUseCase avec teamId, userId et les champs du DTO', async () => {
      const dto = { name: 'Nom modifié', cans: 75 };
      mockUpdate.execute.mockResolvedValue({ ...mockSummary, ...dto });

      const result = await controller.update(1, mockRequest as never, dto);

      expect(mockUpdate.execute).toHaveBeenCalledWith({ teamId: 1, userId: 42, ...dto });
      expect(result).toMatchObject({ name: 'Nom modifié' });
    });
  });

  describe('remove()', () => {
    it('délègue à RemoveTeamUseCase avec teamId et userId', async () => {
      mockRemove.execute.mockResolvedValue(undefined);

      await controller.remove(1, mockRequest as never);

      expect(mockRemove.execute).toHaveBeenCalledWith({ teamId: 1, userId: 42 });
    });
  });

  describe('getSheet()', () => {
    it('délègue à GetTeamSheetUseCase avec teamId et userId', async () => {
      mockGetSheet.execute.mockResolvedValue('<!doctype html>...');

      const result = await controller.getSheet(1, mockRequest as never);

      expect(mockGetSheet.execute).toHaveBeenCalledWith({ teamId: 1, userId: 42 });
      expect(result).toBe('<!doctype html>...');
    });
  });
});
