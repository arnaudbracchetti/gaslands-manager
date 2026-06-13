/**
 * Tests unitaires pour UsersService.
 * Mirroir de teams.service.spec.ts.
 */

import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UsersService } from './users.service';
import { User } from '../../auth/auth.model';

const mockUser: User = {
  id: 2,
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'jean@test.com',
  role: 'user',
  isActive: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('UsersService', () => {
  let service: UsersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UsersService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(UsersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── getAll() ──────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('effectue GET /api/users et retourne un tableau d\'utilisateurs', () => {
      let result: User[] | undefined;

      service.getAll().subscribe((users) => { result = users; });

      const req = httpMock.expectOne('/api/users');
      expect(req.request.method).toBe('GET');

      req.flush([mockUser]);

      expect(result).toEqual([mockUser]);
    });
  });

  // ── remove() ─────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('effectue DELETE /api/users/:id', () => {
      let completed = false;

      service.remove(2).subscribe({ complete: () => { completed = true; } });

      const req = httpMock.expectOne('/api/users/2');
      expect(req.request.method).toBe('DELETE');

      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── setActive() ──────────────────────────────────────────────────────────

  describe('setActive()', () => {
    it('effectue PATCH /api/users/:id/active avec { isActive }', () => {
      let result: User | undefined;

      service.setActive(2, false).subscribe((user) => { result = user; });

      const req = httpMock.expectOne('/api/users/2/active');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ isActive: false });

      req.flush({ ...mockUser, isActive: false });

      expect(result?.isActive).toBe(false);
    });
  });
});
