/**
 * Tests unitaires pour le composant AdminUsers.
 * Mirroir simplifié de teams.spec.ts (composant smart unique, pas de sous-composants).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { signal, computed } from '@angular/core';
import { AdminUsers } from './admin-users';
import { UsersService } from './users.service';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../auth/auth.model';

const mockUsers: User[] = [
  {
    id: 1,
    firstName: 'Admin',
    lastName: 'Système',
    pseudo: 'Admin',
    callName: 'Admin',
    email: 'admin@gaslands.local',
    role: 'admin',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    firstName: 'Jean',
    lastName: 'Dupont',
    pseudo: 'JeanLeFou',
    callName: 'JeanLeFou',
    email: 'jean@test.com',
    role: 'user',
    isActive: true,
    createdAt: '2025-01-02T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
  },
  {
    id: 3,
    firstName: 'Autre',
    lastName: 'Admin',
    pseudo: 'AutreAdmin',
    callName: 'AutreAdmin',
    email: 'autre-admin@test.com',
    role: 'admin',
    isActive: true,
    createdAt: '2025-01-03T00:00:00.000Z',
    updatedAt: '2025-01-03T00:00:00.000Z',
  },
];

describe('AdminUsers Component', () => {
  let component: AdminUsers;
  let fixture: ComponentFixture<AdminUsers>;
  let mockUsersService: {
    getAll: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    setActive: ReturnType<typeof vi.fn>;
    resetPassword: ReturnType<typeof vi.fn>;
    impersonate: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    currentUser: ReturnType<typeof signal<User | null>>;
    isLoggedIn: ReturnType<typeof computed<boolean>>;
    logout: ReturnType<typeof vi.fn>;
    startImpersonation: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockUsersService = {
      getAll: vi.fn().mockReturnValue(of(mockUsers)),
      remove: vi.fn(),
      setActive: vi.fn(),
      resetPassword: vi.fn(),
      impersonate: vi.fn(),
    };

    // Connecté en tant qu'admin (id: 1) — ligne 0 de mockUsers.
    const currentUser = signal<User | null>(mockUsers[0]);
    mockAuthService = {
      currentUser,
      isLoggedIn: computed(() => currentUser() !== null),
      logout: vi.fn(),
      startImpersonation: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AdminUsers],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement initial ─────────────────────────────────────────────────────

  it('appelle UsersService.getAll() au démarrage', () => {
    expect(mockUsersService.getAll).toHaveBeenCalledTimes(1);
  });

  it('affiche les utilisateurs après chargement', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(compiled.textContent).toContain('jean@test.com');
  });

  it('affiche un message d\'état vide si aucun utilisateur', () => {
    mockUsersService.getAll.mockReturnValue(of([]));

    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.admin-users-empty')).toBeTruthy();
  });

  it('affiche un message d\'erreur si le chargement échoue', () => {
    mockUsersService.getAll.mockReturnValue(throwError(() => new Error('Network error')));

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.error()).toContain('Impossible de charger');
  });

  // ── Suppression ────────────────────────────────────────────────────────────

  it('appelle UsersService.remove() après confirmation et retire l\'utilisateur de la liste', () => {
    mockUsersService.remove.mockReturnValue(of(undefined));

    component.deleteUser(mockUsers[1]);
    expect(component.pendingDeleteUser()).toEqual(mockUsers[1]);
    expect(mockUsersService.remove).not.toHaveBeenCalled();

    component.onConfirmDeleteUser();

    expect(mockUsersService.remove).toHaveBeenCalledWith(2);
    expect(component.users().find((u) => u.id === 2)).toBeUndefined();
    expect(component.pendingDeleteUser()).toBeNull();
  });

  it('affiche le message serveur (ex. campagne orpheline) si la suppression échoue', () => {
    mockUsersService.remove.mockReturnValue(
      throwError(() => ({
        error: { message: 'La suppression laisserait les campagnes suivantes sans organisateur : Course à la Mort.' },
      })),
    );

    component.deleteUser(mockUsers[1]);
    component.onConfirmDeleteUser();

    expect(component.error()).toBe(
      'La suppression laisserait les campagnes suivantes sans organisateur : Course à la Mort.',
    );
  });

  it('retombe sur un message générique si la suppression échoue sans message serveur', () => {
    mockUsersService.remove.mockReturnValue(throwError(() => new Error('Network error')));

    component.deleteUser(mockUsers[1]);
    component.onConfirmDeleteUser();

    expect(component.error()).toContain('Erreur lors de la suppression');
  });

  it('n\'appelle pas remove() si l\'utilisateur annule la confirmation', () => {
    component.deleteUser(mockUsers[1]);
    expect(component.pendingDeleteUser()).toEqual(mockUsers[1]);

    component.pendingDeleteUser.set(null);

    expect(mockUsersService.remove).not.toHaveBeenCalled();
  });

  // ── Toggle actif/inactif ────────────────────────────────────────────────────

  it('appelle UsersService.setActive() et met à jour l\'entrée correspondante', () => {
    mockUsersService.setActive.mockReturnValue(of({ ...mockUsers[1], isActive: false }));

    component.toggleActive(mockUsers[1]);

    expect(mockUsersService.setActive).toHaveBeenCalledWith(2, false);
    expect(component.users().find((u) => u.id === 2)?.isActive).toBe(false);
  });

  it('affiche une erreur si setActive échoue, sans modifier la liste', () => {
    mockUsersService.setActive.mockReturnValue(throwError(() => new Error('API error')));

    component.toggleActive(mockUsers[1]);

    expect(component.error()).toContain('statut');
    expect(component.users().find((u) => u.id === 2)?.isActive).toBe(true);
  });

  // ── Masquage des actions sur le compte courant ──────────────────────────────

  it('masque le menu "⋯" sur la ligne du compte courant', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('tbody tr');

    // Ligne 0 = admin (id: 1) = compte courant → pas de menu
    const adminActions = rows[0].querySelector('.admin-users-actions') as HTMLElement;
    expect(adminActions.querySelectorAll('button').length).toBe(0);

    // Ligne 1 = jean (id: 2) → déclencheur "⋯" présent (menu fermé par défaut)
    const userActions = rows[1].querySelector('.admin-users-actions') as HTMLElement;
    expect(userActions.querySelectorAll('button').length).toBe(1);
  });

  // ── Menu "⋯" ─────────────────────────────────────────────────────────────

  it('ouvre puis referme le menu au clic sur le déclencheur', () => {
    expect(component.openMenuUserId()).toBeNull();

    component.toggleMenu(2);
    expect(component.openMenuUserId()).toBe(2);

    component.toggleMenu(2);
    expect(component.openMenuUserId()).toBeNull();
  });

  it('ferme le menu ouvert au clic sur le déclencheur d\'une autre ligne', () => {
    component.toggleMenu(1);
    component.toggleMenu(2);

    expect(component.openMenuUserId()).toBe(2);
  });

  it('closeMenu() referme le menu ouvert', () => {
    component.toggleMenu(2);
    component.closeMenu();

    expect(component.openMenuUserId()).toBeNull();
  });

  it('onMenuToggleActive() referme le menu et bascule le statut', () => {
    mockUsersService.setActive.mockReturnValue(of({ ...mockUsers[1], isActive: false }));
    component.toggleMenu(2);

    component.onMenuToggleActive(mockUsers[1]);

    expect(component.openMenuUserId()).toBeNull();
    expect(mockUsersService.setActive).toHaveBeenCalledWith(2, false);
  });

  it('onMenuResetPassword() referme le menu et ouvre la modale de réinitialisation', () => {
    component.toggleMenu(2);

    component.onMenuResetPassword(mockUsers[1]);

    expect(component.openMenuUserId()).toBeNull();
    expect(component.pendingResetPasswordUser()).toEqual(mockUsers[1]);
  });

  it('onMenuDelete() referme le menu et ouvre la confirmation de suppression', () => {
    component.toggleMenu(2);

    component.onMenuDelete(mockUsers[1]);

    expect(component.openMenuUserId()).toBeNull();
    expect(component.pendingDeleteUser()).toEqual(mockUsers[1]);
  });

  // ── Usurpation d'identité ("Se connecter en tant que") ──────────────────────

  it('affiche l\'entrée "Se connecter en tant que" pour un compte USER, jamais pour un autre ADMIN', () => {
    component.toggleMenu(2); // Jean, role: 'user'
    fixture.detectChanges();
    let menu = fixture.nativeElement.querySelector('.admin-users-menu') as HTMLElement;
    expect(menu.textContent).toContain('Se connecter en tant que');

    component.closeMenu();
    component.toggleMenu(3); // Autre Admin, role: 'admin'
    fixture.detectChanges();
    menu = fixture.nativeElement.querySelector('.admin-users-menu') as HTMLElement;
    expect(menu.textContent).not.toContain('Se connecter en tant que');
  });

  it('onMenuImpersonate() referme le menu et bascule la session via AuthService', () => {
    const authResponse = { access_token: 'target.jwt.token', user: mockUsers[1] };
    mockUsersService.impersonate.mockReturnValue(of(authResponse));
    component.toggleMenu(2);

    component.onMenuImpersonate(mockUsers[1]);

    expect(component.openMenuUserId()).toBeNull();
    expect(mockUsersService.impersonate).toHaveBeenCalledWith(2);
    expect(mockAuthService.startImpersonation).toHaveBeenCalledWith(authResponse);
  });

  it('affiche une erreur si l\'usurpation échoue', () => {
    mockUsersService.impersonate.mockReturnValue(throwError(() => new Error('API error')));

    component.onMenuImpersonate(mockUsers[1]);

    expect(component.error()).toContain('connexion en tant que');
    expect(mockAuthService.startImpersonation).not.toHaveBeenCalled();
  });

  // ── Réinitialisation du mot de passe ────────────────────────────────────────

  it('appelle UsersService.resetPassword() et ferme la modale au succès', () => {
    mockUsersService.resetPassword.mockReturnValue(of(undefined));
    component.openResetPassword(mockUsers[1]);

    component.onResetPasswordSubmitted('nouveaumdp');

    expect(mockUsersService.resetPassword).toHaveBeenCalledWith(2, 'nouveaumdp');
    expect(component.pendingResetPasswordUser()).toBeNull();
    expect(component.resettingPassword()).toBe(false);
  });

  it('affiche une erreur si resetPassword échoue, sans fermer la modale', () => {
    mockUsersService.resetPassword.mockReturnValue(throwError(() => new Error('API error')));
    component.openResetPassword(mockUsers[1]);

    component.onResetPasswordSubmitted('nouveaumdp');

    expect(component.resetPasswordError()).toContain('réinitialisation');
    expect(component.pendingResetPasswordUser()).toEqual(mockUsers[1]);
  });

  it('n\'appelle pas resetPassword() si l\'utilisateur annule', () => {
    component.openResetPassword(mockUsers[1]);

    component.onCancelResetPassword();

    expect(mockUsersService.resetPassword).not.toHaveBeenCalled();
    expect(component.pendingResetPasswordUser()).toBeNull();
  });
});
