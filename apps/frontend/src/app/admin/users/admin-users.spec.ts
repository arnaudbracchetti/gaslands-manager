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
    email: 'jean@test.com',
    role: 'user',
    isActive: true,
    createdAt: '2025-01-02T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
  },
];

describe('AdminUsers Component', () => {
  let component: AdminUsers;
  let fixture: ComponentFixture<AdminUsers>;
  let mockUsersService: {
    getAll: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    setActive: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    currentUser: ReturnType<typeof signal<User | null>>;
    isLoggedIn: ReturnType<typeof computed<boolean>>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockUsersService = {
      getAll: vi.fn().mockReturnValue(of(mockUsers)),
      remove: vi.fn(),
      setActive: vi.fn(),
    };

    // Connecté en tant qu'admin (id: 1) — ligne 0 de mockUsers.
    const currentUser = signal<User | null>(mockUsers[0]);
    mockAuthService = {
      currentUser,
      isLoggedIn: computed(() => currentUser() !== null),
      logout: vi.fn(),
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
    expect(rows.length).toBe(2);
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

  it('masque les boutons d\'action sur la ligne du compte courant', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('tbody tr');

    // Ligne 0 = admin (id: 1) = compte courant → pas de boutons
    const adminActions = rows[0].querySelector('.admin-users-actions') as HTMLElement;
    expect(adminActions.querySelectorAll('button').length).toBe(0);

    // Ligne 1 = jean (id: 2) → boutons présents
    const userActions = rows[1].querySelector('.admin-users-actions') as HTMLElement;
    expect(userActions.querySelectorAll('button').length).toBe(2);
  });
});
