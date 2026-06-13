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
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

const mockUser = {
  id: 1,
  firstName: 'Jean',
  lastName: 'Dupont',
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
        provideRouter([]),
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
          provideRouter([]),
        ],
      });

      const freshService = TestBed.inject(AuthService);
      const freshHttpMock = TestBed.inject(HttpTestingController);

      const req = freshHttpMock.expectOne('/api/auth/me');
      req.flush(mockUser);

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
          provideRouter([]),
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
