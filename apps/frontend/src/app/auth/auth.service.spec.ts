/**
 * Tests unitaires pour AuthService (frontend).
 *
 * Note sur l'environnement @angular/build:unit-test :
 * Ce runner utilise une implémentation custom de localStorage (pas window.localStorage).
 * vi.spyOn(Storage.prototype, ...) ne fonctionne pas ici.
 * Solution : vi.stubGlobal('localStorage', ...) qui remplace l'objet entier.
 */

import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

const mockUser = {
  id: 1,
  firstName: 'Jean',
  lastName: 'Dupont',
  pseudo: 'JeanLeFou',
  callName: 'JeanLeFou',
  email: 'jean@test.com',
  role: 'user' as const,
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockAuthResponse = {
  access_token: 'mocked.jwt.token',
  user: mockUser,
};

// Fabrique un mock de localStorage contrôlable
function createLocalStorageMock(initialToken: string | null = null) {
  const store: Record<string, string> = {};
  if (initialToken) store['gaslands_token'] = initialToken;
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    store, // exposé pour les assertions
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let mockLocalStorage: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    mockLocalStorage = createLocalStorageMock();
    // stubGlobal remplace l'objet global localStorage dans l'environnement de test
    vi.stubGlobal('localStorage', mockLocalStorage);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);

    // Nettoie les requêtes du constructeur (pas de token = pas de requête)
    httpMock.match('/api/auth/me').forEach((req) =>
      req.flush(null, { status: 401, statusText: 'Unauthorized' }),
    );
  });

  afterEach(() => {
    httpMock.verify();
    vi.unstubAllGlobals();
  });

  // ── État initial ─────────────────────────────────────────────────────────

  it('démarre avec currentUser = null', () => {
    expect(service.currentUser()).toBeNull();
  });

  it('isLoggedIn() retourne false quand currentUser est null', () => {
    expect(service.isLoggedIn()).toBe(false);
  });

  it('whenSessionReady() se résout immédiatement si aucun token n\'est en localStorage', async () => {
    await expect(firstValueFrom(service.whenSessionReady())).resolves.toBeUndefined();
  });

  // ── login() ──────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('stocke le token en localStorage et met à jour currentUser', () => {
      let resolved = false;

      service.login('jean@test.com', 'password123').subscribe(() => {
        resolved = true;
      });

      const req = httpMock.expectOne('/api/auth/login');
      expect(req.request.method).toBe('POST');
      req.flush(mockAuthResponse);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('gaslands_token', 'mocked.jwt.token');
      expect(service.currentUser()).toEqual(mockUser);
      expect(service.isLoggedIn()).toBe(true);
      expect(resolved).toBe(true);
    });

    it('ne modifie pas currentUser en cas d\'erreur serveur', () => {
      let errored = false;

      service.login('jean@test.com', 'wrong').subscribe({
        error: () => { errored = true; },
      });

      const req = httpMock.expectOne('/api/auth/login');
      req.flush({ message: 'Identifiants invalides' }, { status: 401, statusText: 'Unauthorized' });

      expect(service.currentUser()).toBeNull();
      expect(errored).toBe(true);
    });
  });

  // ── register() ───────────────────────────────────────────────────────────

  describe('register()', () => {
    it('stocke le token et met à jour currentUser après inscription', () => {
      service.register({
        firstName: 'Jean',
        lastName: 'Dupont',
        pseudo: 'JeanLeFou',
        email: 'jean@test.com',
        password: 'password123',
      }).subscribe();

      const req = httpMock.expectOne('/api/auth/register');
      req.flush(mockAuthResponse);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('gaslands_token', 'mocked.jwt.token');
      expect(service.currentUser()).toEqual(mockUser);
    });
  });

  // ── logout() ─────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('efface le token, met currentUser à null et navigue vers /login', () => {
      service.currentUser.set(mockUser);

      service.logout();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('gaslands_token');
      expect(service.currentUser()).toBeNull();
      expect(service.isLoggedIn()).toBe(false);
    });
  });

  // ── updateProfile() ──────────────────────────────────────────────────────

  describe('updateProfile()', () => {
    it('envoie PATCH /api/auth/me et met à jour currentUser avec la réponse', () => {
      service.currentUser.set(mockUser);
      const dto = { firstName: 'Jeanne', lastName: 'Martin', pseudo: 'Furiosa', email: 'jeanne@test.com' };
      const updatedUser = { ...mockUser, ...dto };

      service.updateProfile(dto).subscribe();

      const req = httpMock.expectOne('/api/auth/me');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(dto);
      req.flush(updatedUser);

      expect(service.currentUser()).toEqual(updatedUser);
    });

    it('ne modifie pas currentUser en cas d\'erreur serveur', () => {
      service.currentUser.set(mockUser);
      let errored = false;

      service.updateProfile({ firstName: 'X', lastName: 'Y', pseudo: 'XY', email: 'pris@test.com' }).subscribe({
        error: () => { errored = true; },
      });

      const req = httpMock.expectOne('/api/auth/me');
      req.flush({ message: 'Cet email est déjà utilisé' }, { status: 409, statusText: 'Conflict' });

      expect(service.currentUser()).toEqual(mockUser);
      expect(errored).toBe(true);
    });
  });

  // ── changePassword() ─────────────────────────────────────────────────────

  describe('changePassword()', () => {
    it('envoie PATCH /api/auth/me/password sans modifier currentUser', () => {
      service.currentUser.set(mockUser);
      const dto = { currentPassword: 'ancien', newPassword: 'nouveauMdp123' };

      service.changePassword(dto).subscribe();

      const req = httpMock.expectOne('/api/auth/me/password');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(dto);
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(service.currentUser()).toEqual(mockUser);
    });

    it('propage l\'erreur serveur (ex. mot de passe actuel incorrect)', () => {
      let errored = false;

      service.changePassword({ currentPassword: 'faux', newPassword: 'nouveauMdp123' }).subscribe({
        error: () => { errored = true; },
      });

      const req = httpMock.expectOne('/api/auth/me/password');
      req.flush({ message: 'Mot de passe actuel incorrect' }, { status: 400, statusText: 'Bad Request' });

      expect(errored).toBe(true);
    });
  });

  // ── restoreSession() ──────────────────────────────────────────────────────

  describe('restoreSession()', () => {
    it('appelle GET /api/auth/me si un token est en localStorage', () => {
      // Token présent dans le store dès le départ
      const lsWithToken = createLocalStorageMock('existing.jwt.token');
      vi.stubGlobal('localStorage', lsWithToken);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AuthService,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: Router, useValue: { navigate: vi.fn() } },
        ],
      });

      const freshService = TestBed.inject(AuthService);
      const freshHttpMock = TestBed.inject(HttpTestingController);

      const req = freshHttpMock.expectOne('/api/auth/me');
      req.flush(mockUser);

      expect(freshService.currentUser()).toEqual(mockUser);
      freshHttpMock.verify();
    });

    it('whenSessionReady() se résout une fois GET /api/auth/me terminé (succès)', async () => {
      const lsWithToken = createLocalStorageMock('existing.jwt.token');
      vi.stubGlobal('localStorage', lsWithToken);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AuthService,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: Router, useValue: { navigate: vi.fn() } },
        ],
      });

      const freshService = TestBed.inject(AuthService);
      const freshHttpMock = TestBed.inject(HttpTestingController);

      const ready = firstValueFrom(freshService.whenSessionReady());

      const req = freshHttpMock.expectOne('/api/auth/me');
      req.flush(mockUser);

      await expect(ready).resolves.toBeUndefined();
      expect(freshService.currentUser()).toEqual(mockUser);
      freshHttpMock.verify();
    });

    it('efface le token si GET /api/auth/me retourne 401', () => {
      const lsWithToken = createLocalStorageMock('expired.jwt.token');
      vi.stubGlobal('localStorage', lsWithToken);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AuthService,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: Router, useValue: { navigate: vi.fn() } },
        ],
      });

      const freshService = TestBed.inject(AuthService);
      const freshHttpMock = TestBed.inject(HttpTestingController);

      const req = freshHttpMock.expectOne('/api/auth/me');
      req.flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(freshService.currentUser()).toBeNull();
      expect(lsWithToken.removeItem).toHaveBeenCalledWith('gaslands_token');
      freshHttpMock.verify();
    });
  });
});
