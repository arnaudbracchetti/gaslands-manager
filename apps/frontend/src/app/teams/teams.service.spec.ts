/**
 * Tests unitaires pour TeamsService.
 *
 * On utilise HttpTestingController pour intercepter les requêtes HTTP
 * et vérifier qu'elles sont bien construites (méthode, URL, corps).
 * Aucun appel réseau réel n'est effectué.
 */

import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TeamsService } from './teams.service';
import { Team } from './team.model';

// Données fictives réutilisées dans les tests
const mockTeam: Team = {
  id: 1,
  name: 'Les Furieux du Désert',
  sponsor: 'Rutherford',
  cans: 50,
  description: 'Une équipe redoutable',
  userId: 42,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('TeamsService', () => {
  let service: TeamsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TeamsService,
        provideHttpClient(),
        // provideHttpClientTesting() remplace le vrai HttpClient par un mock
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(TeamsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  // Après chaque test : vérifie qu'aucune requête non-attendue n'est restée en suspens
  afterEach(() => httpMock.verify());

  // ── getAll() ──────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('effectue GET /api/teams et retourne un tableau d\'équipes', () => {
      let result: Team[] | undefined;

      service.getAll().subscribe((teams) => { result = teams; });

      // expectOne intercepte la requête sortante et vérifie l'URL
      const req = httpMock.expectOne('/api/teams');
      expect(req.request.method).toBe('GET');

      // flush() simule la réponse du serveur
      req.flush([mockTeam]);

      expect(result).toEqual([mockTeam]);
    });

    it('retourne un tableau vide si l\'API retourne []', () => {
      let result: Team[] | undefined;

      service.getAll().subscribe((teams) => { result = teams; });

      const req = httpMock.expectOne('/api/teams');
      req.flush([]);

      expect(result).toEqual([]);
    });
  });

  // ── create() ─────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('effectue POST /api/teams avec le DTO et retourne l\'équipe créée', () => {
      const dto = { name: 'Nouvelle équipe', sponsor: 'Miyazaki', cans: 60 };
      let result: Team | undefined;

      service.create(dto).subscribe((team) => { result = team; });

      const req = httpMock.expectOne('/api/teams');
      expect(req.request.method).toBe('POST');
      // Vérifie que le corps de la requête contient bien le DTO
      expect(req.request.body).toEqual(dto);

      req.flush({ id: 2, ...dto, userId: 42, createdAt: '', updatedAt: '' });

      expect(result?.name).toBe('Nouvelle équipe');
    });
  });

  // ── update() ─────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('effectue PUT /api/teams/:id avec le DTO et retourne l\'équipe modifiée', () => {
      const dto = { name: 'Nom modifié', cans: 75 };
      let result: Team | undefined;

      service.update(1, dto).subscribe((team) => { result = team; });

      const req = httpMock.expectOne('/api/teams/1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);

      req.flush({ ...mockTeam, ...dto });

      expect(result?.name).toBe('Nom modifié');
      expect(result?.cans).toBe(75);
    });
  });

  // ── remove() ─────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('effectue DELETE /api/teams/:id', () => {
      let completed = false;

      service.remove(1).subscribe({ complete: () => { completed = true; } });

      const req = httpMock.expectOne('/api/teams/1');
      expect(req.request.method).toBe('DELETE');

      req.flush(null);

      expect(completed).toBe(true);
    });
  });
});
