/**
 * Tests unitaires pour le composant Register.
 * provideRouter([]) est nécessaire pour RouterLink dans le template.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../auth.service';
import { Register } from './register';

describe('Register Component', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let mockAuthService: { register: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthService = { register: vi.fn() };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Rendu initial ─────────────────────────────────────────────────────────

  it('affiche le formulaire d\'inscription avec les 4 champs', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[name="firstName"]')).toBeTruthy();
    expect(compiled.querySelector('input[name="lastName"]')).toBeTruthy();
    expect(compiled.querySelector('input[type="email"]')).toBeTruthy();
    expect(compiled.querySelector('input[type="password"]')).toBeTruthy();
  });

  it('affiche un lien vers /login', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('.auth-switch a');
    expect(link).toBeTruthy();
  });

  // ── Soumission réussie ────────────────────────────────────────────────────

  it('appelle authService.register() avec les 4 champs et navigue vers /home', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.firstName.set('Jean');
    component.lastName.set('Dupont');
    component.email.set('jean@test.com');
    component.password.set('password123');
    mockAuthService.register.mockReturnValue(of(undefined));

    component.onSubmit();

    expect(mockAuthService.register).toHaveBeenCalledWith({
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean@test.com',
      password: 'password123',
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/home']);
  });

  // ── Soumission échouée ────────────────────────────────────────────────────

  it('affiche le message d\'erreur si l\'email est déjà utilisé', () => {
    component.firstName.set('Jean');
    component.lastName.set('Dupont');
    component.email.set('jean@test.com');
    component.password.set('password123');
    mockAuthService.register.mockReturnValue(
      throwError(() => ({ error: { message: 'Cet email est déjà utilisé' } })),
    );

    component.onSubmit();
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('.auth-error');
    expect(errorEl?.textContent).toContain('Cet email est déjà utilisé');
  });

  // ── Validation côté client ────────────────────────────────────────────────

  it('n\'envoie pas la requête si un champ est vide', () => {
    component.firstName.set('Jean');
    component.lastName.set('Dupont');
    component.email.set('jean@test.com');
    // password laissé vide

    component.onSubmit();

    expect(mockAuthService.register).not.toHaveBeenCalled();
  });
});
