/**
 * Tests unitaires pour authInterceptor.
 *
 * Note environnement Angular-Vitest :
 * vi.stubGlobal('localStorage', ...) remplace l'objet global localStorage.
 * vi.spyOn(Storage.prototype, ...) ne fonctionne pas dans cet environnement.
 */

import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;

  // Crée un mock de localStorage avec un token optionnel
  const setupWithToken = (token: string | null) => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(token),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  };

  afterEach(() => {
    httpMock?.verify();
    vi.unstubAllGlobals();
  });

  it('ajoute le header Authorization si un token est en localStorage', () => {
    setupWithToken('my.jwt.token');

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my.jwt.token');
    req.flush({});
  });

  it('ne modifie pas la requête si aucun token n\'est en localStorage', () => {
    setupWithToken(null);

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({});
  });
});
