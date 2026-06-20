/**
 * Composant AdminUsers — écran d'administration "Gestion des utilisateurs".
 *
 * Accessible uniquement aux admins (cf. adminGuard, app.routes.ts).
 * Composant smart unique : pas de sous-composant dumb, une ligne de table
 * affiche les données et porte ses propres actions (mirroir simplifié de Teams).
 *
 * Responsabilités :
 * - Charger la liste des comptes via UsersService
 * - Supprimer un compte (confirmation + suppression optimiste, mirroir deleteTeam)
 * - Activer/désactiver un compte (toggle réversible, pas de confirmation)
 * - Masquer les actions sur la ligne du compte courant (garde-fou UI, en plus du 403 backend)
 */
import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../auth/auth.model';
import { UsersService } from './users.service';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [DatePipe, ConfirmModal],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
})
export class AdminUsers implements OnInit {
  private usersService: UsersService = inject(UsersService);
  authService: AuthService = inject(AuthService);

  /** Liste des comptes chargés depuis l'API */
  users: WritableSignal<User[]> = signal<User[]>([]);

  /** Vrai pendant le chargement initial */
  loading: WritableSignal<boolean> = signal(true);

  /** Message d'erreur API affiché à l'utilisateur (vide = pas d'erreur) */
  error: WritableSignal<string> = signal('');

  /** Utilisateur en attente de confirmation de suppression (null = aucun) */
  pendingDeleteUser: WritableSignal<User | null> = signal<User | null>(null);

  ngOnInit(): void {
    this.loadUsers();
  }

  /** Charge tous les comptes depuis l'API et met à jour le signal */
  loadUsers(): void {
    this.loading.set(true);
    this.error.set('');

    this.usersService.getAll().subscribe({
      next: (users: User[]) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les utilisateurs. Vérifiez votre connexion.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Supprime un compte après confirmation (mirroir de Teams.deleteTeam).
   * Suppression optimiste : retire le compte du signal local immédiatement.
   */
  deleteUser(user: User): void {
    this.pendingDeleteUser.set(user);
  }

  onConfirmDeleteUser(): void {
    const user = this.pendingDeleteUser();
    this.pendingDeleteUser.set(null);
    if (!user) return;

    this.users.update((list: User[]) => list.filter((u: User) => u.id !== user.id));

    this.usersService.remove(user.id).subscribe({
      error: () => {
        this.error.set('Erreur lors de la suppression. La liste a été actualisée.');
        this.loadUsers();
      },
    });
  }

  /**
   * Active ou désactive un compte (toggle réversible — pas de confirmation).
   * Met à jour l'entrée du signal au retour de l'API ; en cas d'échec, affiche
   * une erreur sans modification locale (rien n'a été changé optimistiquement).
   */
  toggleActive(user: User): void {
    this.usersService.setActive(user.id, !user.isActive).subscribe({
      next: (updated: User) => {
        this.users.update((list: User[]) => list.map((u: User) => (u.id === updated.id ? updated : u)));
      },
      error: () => {
        this.error.set('Erreur lors de la mise à jour du statut du compte.');
      },
    });
  }
}
