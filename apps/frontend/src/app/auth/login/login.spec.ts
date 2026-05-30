/**
 * Tests unitaires pour le composant Login.
 *
 * Note : RouterLink (utilisé dans le template) a besoin de provideRouter([]).
 * On l'ajoute aux providers du TestBed.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../auth.service';
import { Login } from './login';

describe('Login Component', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let mockAuthService: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthService = { login: vi.fn() };
    // localStorage mock (évite les erreurs si AuthService est injecté)
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        // provideRouter([]) est nécessaire pour que RouterLink fonctionne
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Rendu initial ─────────────────────────────────────────────────────────

  it('affiche le formulaire de connexion', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.auth-title')?.textContent).toContain('Connexion');
    expect(compiled.querySelector('input[type="email"]')).toBeTruthy();
    expect(compiled.querySelector('input[type="password"]')).toBeTruthy();
    expect(compiled.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('n\'affiche pas de message d\'erreur au démarrage', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.auth-error')).toBeNull();
  });

  it('affiche un lien vers /register', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('.auth-switch a');
    expect(link).toBeTruthy();
  });

  // ── Soumission réussie ────────────────────────────────────────────────────

  it('appelle authService.login() et navigue vers /home en cas de succès', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.email.set('jean@test.com');
    component.password.set('password123');
    mockAuthService.login.mockReturnValue(of(undefined));

    component.onSubmit();

    expect(mockAuthService.login).toHaveBeenCalledWith('jean@test.com', 'password123');
    expect(navigateSpy).toHaveBeenCalledWith(['/home']);
  });

  // ── Soumission échouée ────────────────────────────────────────────────────

  it('affiche le message d\'erreur du serveur en cas d\'échec', () => {
    component.email.set('jean@test.com');
    component.password.set('wrong');
    mockAuthService.login.mockReturnValue(
      throwError(() => ({ error: { message: 'Identifiants invalides' } })),
    );

    component.onSubmit();
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('.auth-error');
    expect(errorEl?.textContent).toContain('Identifiants invalides');
  });

  // ── État de chargement ────────────────────────────────────────────────────

  it('désactive le bouton pendant le chargement', () => {
    component.isLoading.set(true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  // ── Validation côté client ────────────────────────────────────────────────

  it('affiche un message si les champs sont vides et ne soumet pas', () => {
    component.onSubmit();
    fixture.detectChanges();

    expect(mockAuthService.login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.auth-error')).toBeTruthy();
  });
});
