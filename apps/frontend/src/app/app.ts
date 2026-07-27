import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import type { ChangePasswordDto, UpdateProfileDto } from './auth/auth.model';
import { AuthService } from './auth/auth.service';
import { UserDetailsModal } from './auth/user-details-modal/user-details-modal';
import { Icon } from './shared/icon/icon';
// AuthService importé pour annoter le membre de classe (règle memberVariableDeclaration).

// App est le composant racine : il est chargé en premier et encadre toute l'application
// RouterModule fournit les directives routerLink, routerLinkActive et router-outlet
@Component({
  imports: [RouterModule, Icon, UserDetailsModal],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  // string : type explicite du membre de classe (règle memberVariableDeclaration).
  title: string = 'Gaslands Manager';

  // inject(AuthService) : accès au service singleton d'authentification.
  // On l'expose comme propriété publique pour que le template puisse lire
  // authService.isLoggedIn() et authService.currentUser().
  // Comme authService est un singleton (providedIn: 'root'), c'est la même
  // instance partout dans l'app : pas de duplication d'état.
  readonly authService: AuthService = inject(AuthService);

  private router: Router = inject(Router);

  /**
   * Chapitre de documentation utilisateur lié à l'écran actuellement affiché
   * — lu depuis `data.docSlug` de la route active la plus profonde (cf.
   * app.routes.ts), `null` si cet écran n'en déclare pas. Alimente le lien
   * "❓ Aide sur cet écran" de la navbar (app.html). Un seul endroit à
   * modifier (ce composant + le champ `data` de la route concernée) pour
   * qu'un nouvel écran obtienne son aide contextuelle — jamais besoin de
   * toucher le composant de l'écran lui-même.
   */
  docSlug: WritableSignal<string | null> = signal(null);

  /** Menu déroulant ouvert au clic sur le prénom dans la navbar. */
  userMenuOpen: WritableSignal<boolean> = signal(false);

  /** Dialog "Détails du compte", ouvert depuis l'entrée du menu ci-dessus. */
  showUserDetailsModal: WritableSignal<boolean> = signal(false);

  /** État du sous-formulaire "Informations" du dialog — possédé ici (parent smart). */
  profileSaving: WritableSignal<boolean> = signal(false);
  profileError: WritableSignal<string> = signal('');

  /** État du sous-formulaire "Mot de passe" du dialog — possédé ici (parent smart). */
  passwordSaving: WritableSignal<boolean> = signal(false);
  passwordError: WritableSignal<string> = signal('');

  ngOnInit(): void {
    // Paramètre typé `unknown` (plutôt que le type `Event` du routeur, non
    // ré-exporté sans ambiguïté par @angular/router) : `instanceof` fonctionne
    // sur `unknown`, et un prédicat qui accepte `unknown` reste assignable
    // partout où `filter` attend un prédicat sur le type réel des événements.
    this.router.events
      .pipe(filter((e: unknown): boolean => e instanceof NavigationEnd))
      .subscribe((): void => {
        this.docSlug.set(this.resolveDocSlug());
      });
  }

  // Descend jusqu'à la route active la plus profonde — les routes de ce
  // projet sont aujourd'hui toutes plates (pas de routes enfants imbriquées
  // dans app.routes.ts), donc un seul niveau suffit à couvrir tous les cas.
  private resolveDocSlug(): string | null {
    let route: ActivatedRoute = this.router.routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return (route.snapshot.data['docSlug'] as string | undefined) ?? null;
  }

  toggleUserMenu(): void {
    this.userMenuOpen.set(!this.userMenuOpen());
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  openUserDetails(): void {
    this.closeUserMenu();
    this.profileError.set('');
    this.passwordError.set('');
    this.showUserDetailsModal.set(true);
  }

  closeUserDetails(): void {
    this.showUserDetailsModal.set(false);
  }

  onProfileSubmitted(dto: UpdateProfileDto): void {
    this.profileSaving.set(true);
    this.profileError.set('');
    this.authService.updateProfile(dto).subscribe({
      next: (): void => {
        this.profileSaving.set(false);
      },
      error: (err: HttpErrorResponse): void => {
        this.profileError.set(err.error?.message ?? 'Erreur lors de la mise à jour du profil');
        this.profileSaving.set(false);
      },
    });
  }

  // Après un changement de mot de passe réussi, on force la déconnexion
  // (pas de mécanisme de révocation JWT côté serveur) : la reconnexion se
  // fait naturellement avec le nouveau mot de passe. logout() redirige vers
  // /login, ce qui démonte le dialog par la même occasion.
  onPasswordSubmitted(dto: ChangePasswordDto): void {
    this.passwordSaving.set(true);
    this.passwordError.set('');
    this.authService.changePassword(dto).subscribe({
      next: (): void => {
        this.passwordSaving.set(false);
        this.authService.logout();
      },
      error: (err: HttpErrorResponse): void => {
        this.passwordError.set(err.error?.message ?? 'Erreur lors du changement de mot de passe');
        this.passwordSaving.set(false);
      },
    });
  }
}
