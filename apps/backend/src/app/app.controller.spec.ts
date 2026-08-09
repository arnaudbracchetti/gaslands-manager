/**
 * Tests unitaires pour AppController.
 *
 * Cas testés :
 * - GET / → délègue à AppService.getData()
 * - GET /health → exécute un SELECT 1 via DataSource et retourne { status: 'ok' }
 * - GET /health → laisse remonter l'exception si la base est indisponible
 * - GET /version → délègue à AppService.getVersion()
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let appService: { getData: ReturnType<typeof vi.fn>; getVersion: ReturnType<typeof vi.fn> };
  let dataSource: { query: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dataSource = { query: vi.fn() };
    appService = {
      getData: vi.fn().mockReturnValue({ message: 'Hello API' }),
      getVersion: vi.fn().mockReturnValue({ version: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: appService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    controller = module.get(AppController);
  });

  describe('GET /', () => {
    it('délègue à AppService.getData()', () => {
      expect(controller.getData()).toEqual({ message: 'Hello API' });
    });
  });

  describe('GET /health', () => {
    it('exécute SELECT 1 et retourne { status: "ok" } si la base répond', async () => {
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.getHealth();

      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(result).toEqual({ status: 'ok' });
    });

    it("laisse remonter l'exception si la base est indisponible", async () => {
      dataSource.query.mockRejectedValue(new Error('connection refused'));

      await expect(controller.getHealth()).rejects.toThrow('connection refused');
    });
  });

  describe('GET /version', () => {
    it('délègue à AppService.getVersion() et retourne le tag tel quel', () => {
      appService.getVersion.mockReturnValue({ version: 'v1.2.3' });

      expect(controller.getVersion()).toEqual({ version: 'v1.2.3' });
    });

    it('relaie { version: null } sans y substituer de valeur', () => {
      appService.getVersion.mockReturnValue({ version: null });

      expect(controller.getVersion()).toEqual({ version: null });
    });
  });
});
