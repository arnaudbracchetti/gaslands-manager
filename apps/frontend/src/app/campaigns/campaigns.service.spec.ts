/**
 * Tests unitaires pour CampaignsService.
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
import { CampaignsService } from './campaigns.service';
import { Campaign, CampaignSummary } from './campaign.model';
import { CampaignParticipant } from './campaign-participant.model';

const mockCampaign: Campaign = {
  id: 1,
  name: 'Coupe Verney',
  state: 'EN_CONSTRUCTION',
  inviteCode: 'abcdef123456',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  participantCount: 1,
  myRole: 'organizer',
};

describe('CampaignsService', () => {
  let service: CampaignsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CampaignsService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CampaignsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── getAll() ──────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('effectue GET /api/campaigns et retourne un tableau de saisons', () => {
      let result: Campaign[] | undefined;

      service.getAll().subscribe((campaigns) => { result = campaigns; });

      const req = httpMock.expectOne('/api/campaigns');
      expect(req.request.method).toBe('GET');

      req.flush([mockCampaign]);

      expect(result).toEqual([mockCampaign]);
    });

    it('retourne un tableau vide si l\'API retourne []', () => {
      let result: Campaign[] | undefined;

      service.getAll().subscribe((campaigns) => { result = campaigns; });

      const req = httpMock.expectOne('/api/campaigns');
      req.flush([]);

      expect(result).toEqual([]);
    });
  });

  // ── getPending() ─────────────────────────────────────────────────────────

  describe('getPending()', () => {
    it('effectue GET /api/campaigns/pending et retourne un tableau de saisons', () => {
      const pending: Campaign[] = [{ ...mockCampaign, myRole: 'participant' }];
      let result: Campaign[] | undefined;

      service.getPending().subscribe((campaigns) => { result = campaigns; });

      const req = httpMock.expectOne('/api/campaigns/pending');
      expect(req.request.method).toBe('GET');

      req.flush(pending);

      expect(result).toEqual(pending);
    });
  });

  // ── getOrganizingPendingRequests() ──────────────────────────────────────

  describe('getOrganizingPendingRequests()', () => {
    it('effectue GET /api/campaigns/organizing/pending-requests et retourne un tableau de saisons', () => {
      const organized: Campaign[] = [{ ...mockCampaign, pendingRequestsCount: 2 }];
      let result: Campaign[] | undefined;

      service.getOrganizingPendingRequests().subscribe((campaigns) => { result = campaigns; });

      const req = httpMock.expectOne('/api/campaigns/organizing/pending-requests');
      expect(req.request.method).toBe('GET');

      req.flush(organized);

      expect(result).toEqual(organized);
    });
  });

  // ── create() ─────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('effectue POST /api/campaigns avec le DTO et retourne la saison créée', () => {
      const dto = { name: 'Coupe Verney', teamId: 7 };
      let result: Campaign | undefined;

      service.create(dto).subscribe((campaign) => { result = campaign; });

      const req = httpMock.expectOne('/api/campaigns');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);

      req.flush(mockCampaign);

      expect(result?.name).toBe('Coupe Verney');
    });
  });

  // ── getByCode() ──────────────────────────────────────────────────────────

  describe('getByCode()', () => {
    it('effectue GET /api/campaigns/by-code/:code et retourne le résumé', () => {
      const summary: CampaignSummary = {
        id: 1,
        name: 'Coupe Verney',
        state: 'EN_CONSTRUCTION',
        organizerName: 'Jean Dupont',
        participantCount: 3,
      };
      let result: CampaignSummary | undefined;

      service.getByCode('abcdef123456').subscribe((s) => { result = s; });

      const req = httpMock.expectOne('/api/campaigns/by-code/abcdef123456');
      expect(req.request.method).toBe('GET');

      req.flush(summary);

      expect(result).toEqual(summary);
    });
  });

  // ── requestJoin() ────────────────────────────────────────────────────────

  describe('requestJoin()', () => {
    it('effectue POST /api/campaigns/:id/participants avec le DTO', () => {
      const dto = { teamId: 7 };
      let done = false;

      service.requestJoin(1, dto).subscribe(() => { done = true; });

      const req = httpMock.expectOne('/api/campaigns/1/participants');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);

      req.flush({});

      expect(done).toBe(true);
    });
  });

  // ── getOne() ─────────────────────────────────────────────────────────────

  describe('getOne()', () => {
    it('effectue GET /api/campaigns/:id et retourne la saison', () => {
      let result: Campaign | undefined;

      service.getOne(1).subscribe((campaign) => { result = campaign; });

      const req = httpMock.expectOne('/api/campaigns/1');
      expect(req.request.method).toBe('GET');

      req.flush(mockCampaign);

      expect(result).toEqual(mockCampaign);
    });
  });

  // ── getParticipants() ────────────────────────────────────────────────────

  describe('getParticipants()', () => {
    it('effectue GET /api/campaigns/:id/participants et retourne la liste', () => {
      const participants: CampaignParticipant[] = [
        { id: 1, userId: 42, teamId: 7, status: 'VALIDATED', isOrganizer: true, userName: 'Jean Dupont', teamName: 'Furies' },
      ];
      let result: CampaignParticipant[] | undefined;

      service.getParticipants(1).subscribe((p) => { result = p; });

      const req = httpMock.expectOne('/api/campaigns/1/participants');
      expect(req.request.method).toBe('GET');

      req.flush(participants);

      expect(result).toEqual(participants);
    });
  });

  // ── validateParticipant() ────────────────────────────────────────────────

  describe('validateParticipant()', () => {
    it('effectue PUT /api/campaigns/:id/participants/:pid/validate avec le DTO', () => {
      const dto = { accept: true };
      const updated: CampaignParticipant = {
        id: 2, userId: 43, teamId: 8, status: 'VALIDATED', isOrganizer: false, userName: 'Alice Martin', teamName: 'Scrap Kings',
      };
      let result: CampaignParticipant | undefined;

      service.validateParticipant(1, 2, dto).subscribe((p) => { result = p; });

      const req = httpMock.expectOne('/api/campaigns/1/participants/2/validate');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);

      req.flush(updated);

      expect(result).toEqual(updated);
    });
  });

  // ── remove() ─────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('effectue DELETE /api/campaigns/:id', () => {
      let done = false;

      service.remove(1).subscribe(() => { done = true; });

      const req = httpMock.expectOne('/api/campaigns/1');
      expect(req.request.method).toBe('DELETE');

      req.flush(null);

      expect(done).toBe(true);
    });
  });

  // ── Programme Télé (mode campagne) ─────────────────────────────────────────

  describe('getScenarios()', () => {
    it('effectue GET /api/catalog/scenarios', () => {
      service.getScenarios().subscribe();

      const req = httpMock.expectOne('/api/catalog/scenarios');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getGames()', () => {
    it('effectue GET /api/campaigns/:id/games', () => {
      service.getGames(1).subscribe();

      const req = httpMock.expectOne('/api/campaigns/1/games');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createGame()', () => {
    it('effectue POST /api/campaigns/:id/games avec le DTO', () => {
      const dto = { scenarioId: 'course_de_la_mort' };

      service.createGame(1, dto).subscribe();

      const req = httpMock.expectOne('/api/campaigns/1/games');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('updateGame()', () => {
    it('effectue PUT /api/campaigns/:id/games/:gameId avec le DTO', () => {
      const dto = { scenarioId: 'embuscade' };

      service.updateGame(1, 10, dto).subscribe();

      const req = httpMock.expectOne('/api/campaigns/1/games/10');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });
  });

  describe('deleteGame()', () => {
    it('effectue DELETE /api/campaigns/:id/games/:gameId', () => {
      let done = false;

      service.deleteGame(1, 10).subscribe(() => { done = true; });

      const req = httpMock.expectOne('/api/campaigns/1/games/10');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(done).toBe(true);
    });
  });
});
