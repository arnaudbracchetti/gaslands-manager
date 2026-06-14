/**
 * Tests unitaires pour SeasonsService.
 *
 * Même pattern que teams.service.spec.ts : HttpTestingController intercepte
 * les requêtes HTTP, aucun appel réseau réel.
 */

import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SeasonsService } from './seasons.service';
import { Season, SeasonSummary } from './season.model';

const mockSeason: Season = {
  id: 1,
  name: 'Coupe Verney',
  state: 'EN_CONSTRUCTION',
  inviteCode: 'abcdef123456',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  participantCount: 1,
  myRole: 'organizer',
};

describe('SeasonsService', () => {
  let service: SeasonsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SeasonsService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(SeasonsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── getAll() ──────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('effectue GET /api/seasons et retourne un tableau de saisons', () => {
      let result: Season[] | undefined;

      service.getAll().subscribe((seasons) => { result = seasons; });

      const req = httpMock.expectOne('/api/seasons');
      expect(req.request.method).toBe('GET');

      req.flush([mockSeason]);

      expect(result).toEqual([mockSeason]);
    });

    it('retourne un tableau vide si l\'API retourne []', () => {
      let result: Season[] | undefined;

      service.getAll().subscribe((seasons) => { result = seasons; });

      const req = httpMock.expectOne('/api/seasons');
      req.flush([]);

      expect(result).toEqual([]);
    });
  });

  // ── create() ─────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('effectue POST /api/seasons avec le DTO et retourne la saison créée', () => {
      const dto = { name: 'Coupe Verney', teamId: 7 };
      let result: Season | undefined;

      service.create(dto).subscribe((season) => { result = season; });

      const req = httpMock.expectOne('/api/seasons');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);

      req.flush(mockSeason);

      expect(result?.name).toBe('Coupe Verney');
    });
  });

  // ── getByCode() ──────────────────────────────────────────────────────────

  describe('getByCode()', () => {
    it('effectue GET /api/seasons/by-code/:code et retourne le résumé', () => {
      const summary: SeasonSummary = {
        id: 1,
        name: 'Coupe Verney',
        state: 'EN_CONSTRUCTION',
        organizerName: 'Jean Dupont',
      };
      let result: SeasonSummary | undefined;

      service.getByCode('abcdef123456').subscribe((s) => { result = s; });

      const req = httpMock.expectOne('/api/seasons/by-code/abcdef123456');
      expect(req.request.method).toBe('GET');

      req.flush(summary);

      expect(result).toEqual(summary);
    });
  });

  // ── requestJoin() ────────────────────────────────────────────────────────

  describe('requestJoin()', () => {
    it('effectue POST /api/seasons/:id/participants avec le DTO', () => {
      const dto = { teamId: 7 };
      let done = false;

      service.requestJoin(1, dto).subscribe(() => { done = true; });

      const req = httpMock.expectOne('/api/seasons/1/participants');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);

      req.flush({});

      expect(done).toBe(true);
    });
  });
});
