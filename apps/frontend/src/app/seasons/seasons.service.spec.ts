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
import { SeasonParticipant } from './season-participant.model';

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

  // ── getOne() ─────────────────────────────────────────────────────────────

  describe('getOne()', () => {
    it('effectue GET /api/seasons/:id et retourne la saison', () => {
      let result: Season | undefined;

      service.getOne(1).subscribe((season) => { result = season; });

      const req = httpMock.expectOne('/api/seasons/1');
      expect(req.request.method).toBe('GET');

      req.flush(mockSeason);

      expect(result).toEqual(mockSeason);
    });
  });

  // ── getParticipants() ────────────────────────────────────────────────────

  describe('getParticipants()', () => {
    it('effectue GET /api/seasons/:id/participants et retourne la liste', () => {
      const participants: SeasonParticipant[] = [
        { id: 1, userId: 42, teamId: 7, status: 'VALIDATED', isOrganizer: true, userName: 'Jean Dupont', teamName: 'Furies' },
      ];
      let result: SeasonParticipant[] | undefined;

      service.getParticipants(1).subscribe((p) => { result = p; });

      const req = httpMock.expectOne('/api/seasons/1/participants');
      expect(req.request.method).toBe('GET');

      req.flush(participants);

      expect(result).toEqual(participants);
    });
  });

  // ── validateParticipant() ────────────────────────────────────────────────

  describe('validateParticipant()', () => {
    it('effectue PUT /api/seasons/:id/participants/:pid/validate avec le DTO', () => {
      const dto = { accept: true };
      const updated: SeasonParticipant = {
        id: 2, userId: 43, teamId: 8, status: 'VALIDATED', isOrganizer: false, userName: 'Alice Martin', teamName: 'Scrap Kings',
      };
      let result: SeasonParticipant | undefined;

      service.validateParticipant(1, 2, dto).subscribe((p) => { result = p; });

      const req = httpMock.expectOne('/api/seasons/1/participants/2/validate');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);

      req.flush(updated);

      expect(result).toEqual(updated);
    });
  });
});
