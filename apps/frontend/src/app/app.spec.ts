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
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { of, throwError } from 'rxjs';
import { App } from './app';
import type { User } from './auth/auth.model';
import { AuthService } from './auth/auth.service';

const mockUser: User = {
  id: 1,
  firstName: 'Jean',
  lastName: 'Dupont',
  pseudo: 'JeanLeFou',
  callName: 'JeanLeFou',
  email: 'jean@test.com',
  role: 'user',
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// Mock minimal d'AuthService pour ce test de fumée — isLoggedIn dérive de
// currentUser (comme le vrai service) pour que les tests du menu utilisateur
// puissent basculer l'état connecté simplement via currentUserSignal.set(...).
// Signal déclaré à part (plutôt qu'inline dans l'objet) pour éviter la
// référence circulaire dans le typage de mockAuthService (TS7022/TS7024).
const currentUserSignal = signal<User | null>(null);
const mockAuthService = {
  currentUser: currentUserSignal,
  isLoggedIn: computed(() => currentUserSignal() !== null),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
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
    // Le logo est une image (cf. commit 2e08843, "remplace le logo texte par
    // le logo image") — plus de texte visible dans `.navbar-brand`, on vérifie
    // donc l'attribut `alt` de l'image à la place.
    expect(compiled.querySelector('.navbar-brand img')?.getAttribute('alt')).toContain('Gaslands');
  });

  // ── Menu utilisateur + dialog "Détails du compte" ─────────────────────────

  describe('Menu utilisateur', () => {
    let overlayContainer: OverlayContainer;

    /**
     * Le menu utilisateur est rendu via Angular CDK Overlay
     * (cdkConnectedOverlay, app.html) - son contenu est porté dans le
     * conteneur global de l'overlay (attaché à <body>, cf.
     * `OverlayContainer`), PAS dans le sous-arbre DOM de `compiled`. Même
     * pattern que `ParticipantList` (cf. participant-list.spec.ts).
     */
    function menuContainer(): HTMLElement {
      return overlayContainer.getContainerElement();
    }

    beforeEach(() => {
      // vi.restoreAllMocks() (afterEach global) ne réinitialise pas
      // l'historique d'appel des vi.fn() sans implémentation d'origine —
      // clearAllMocks() efface calls/results explicitement avant chaque test.
      vi.clearAllMocks();
      mockAuthService.currentUser.set(mockUser);
      overlayContainer = TestBed.inject(OverlayContainer);
    });

    afterEach(() => {
      mockAuthService.currentUser.set(null);
      // Un overlay laissé ouvert par un test survivrait dans le DOM partagé
      // de l'environnement de test (le conteneur est un singleton par
      // TestBed) et fausserait `menuContainer()` du test suivant.
      overlayContainer.ngOnDestroy();
    });

    it('ouvre le menu au clic sur le prénom, et le ferme au clic sur le backdrop', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;

      expect(menuContainer().querySelector('.navbar-user-menu__panel')).toBeFalsy();

      (compiled.querySelector('.user-name--trigger') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(menuContainer().querySelector('.navbar-user-menu__panel')).toBeTruthy();

      (menuContainer().querySelector('.cdk-overlay-backdrop') as HTMLDivElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(menuContainer().querySelector('.navbar-user-menu__panel')).toBeFalsy();
    });

    it('ouvre le dialog "Détails du compte" et ferme le menu', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;

      (compiled.querySelector('.user-name--trigger') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      (menuContainer().querySelector('.navbar-user-menu__panel button') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(compiled.querySelector('app-user-details-modal')).toBeTruthy();
      expect(menuContainer().querySelector('.navbar-user-menu__panel')).toBeFalsy();
    });

    it('ouvre le dialog "Changer le mot de passe" et ferme le menu', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;

      (compiled.querySelector('.user-name--trigger') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      const menuButtons = menuContainer().querySelectorAll<HTMLButtonElement>('.navbar-user-menu__panel button');
      menuButtons[1].click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(compiled.querySelector('app-change-password-modal')).toBeTruthy();
      expect(compiled.querySelector('app-user-details-modal')).toBeFalsy();
      expect(menuContainer().querySelector('.navbar-user-menu__panel')).toBeFalsy();
    });

    it('onProfileSubmitted() appelle authService.updateProfile(), efface profileSaving et ferme le dialog au succès', async () => {
      mockAuthService.updateProfile.mockReturnValue(of(undefined));
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      fixture.componentInstance.activeAccountModal.set('userDetails');

      const dto = { firstName: 'Jeanne', lastName: 'Martin', pseudo: 'Furiosa', email: 'jeanne@test.com' };
      fixture.componentInstance.onProfileSubmitted(dto);

      expect(mockAuthService.updateProfile).toHaveBeenCalledWith(dto);
      expect(fixture.componentInstance.profileSaving()).toBe(false);
      expect(fixture.componentInstance.profileError()).toBe('');
      expect(fixture.componentInstance.activeAccountModal()).toBeNull();
    });

    it('onProfileSubmitted() renseigne profileError() en cas d\'erreur HTTP', async () => {
      mockAuthService.updateProfile.mockReturnValue(
        throwError(() => new HttpErrorResponse({ error: { message: 'Cet email est déjà utilisé' }, status: 409 })),
      );
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();

      fixture.componentInstance.onProfileSubmitted({ firstName: 'Jeanne', lastName: 'Martin', pseudo: 'Furiosa', email: 'jeanne@test.com' });

      expect(fixture.componentInstance.profileError()).toBe('Cet email est déjà utilisé');
      expect(fixture.componentInstance.profileSaving()).toBe(false);
    });

    it('onPasswordSubmitted() appelle authService.changePassword(), ferme le dialog puis logout() au succès', async () => {
      mockAuthService.changePassword.mockReturnValue(of(undefined));
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      fixture.componentInstance.activeAccountModal.set('changePassword');

      const dto = { currentPassword: 'ancien', newPassword: 'nouveauMdp123' };
      fixture.componentInstance.onPasswordSubmitted(dto);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(dto);
      expect(fixture.componentInstance.activeAccountModal()).toBeNull();
      expect(mockAuthService.logout).toHaveBeenCalled();
    });

    it('onPasswordSubmitted() renseigne passwordError() en cas d\'erreur HTTP, sans déconnecter', async () => {
      mockAuthService.changePassword.mockReturnValue(
        throwError(() => new HttpErrorResponse({ error: { message: 'Mot de passe actuel incorrect' }, status: 400 })),
      );
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();

      fixture.componentInstance.onPasswordSubmitted({ currentPassword: 'faux', newPassword: 'nouveauMdp123' });

      expect(fixture.componentInstance.passwordError()).toBe('Mot de passe actuel incorrect');
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });
  });
});
