/**
 * Test de fumée du composant racine App.
 *
 * Ce test vérifie que le composant App se monte correctement
 * et contient la navbar.
 *
 * Note : le test d'origine importait NxWelcome (composant de bienvenue Nx)
 * qui n'existe plus dans ce projet. Il a été remplacé par un test simple
 * vérifiant la présence de la navbar Gaslands.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { AuthService } from './auth/auth.service';
import { signal, computed } from '@angular/core';

// Mock minimal d'AuthService pour ce test de fumée
const mockAuthService = {
  currentUser: signal(null),
  isLoggedIn: computed(() => false),
  logout: vi.fn(),
};

describe('App (composant racine)', () => {
  beforeEach(async () => {
    // Simule un token absent pour éviter la requête GET /api/auth/me
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('monte le composant sans erreur', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('affiche la navbar Gaslands', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.navbar')).toBeTruthy();
    expect(compiled.querySelector('.navbar-brand')?.textContent).toContain('Gaslands');
  });
});
