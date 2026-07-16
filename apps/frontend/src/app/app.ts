import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';
import { Icon } from './shared/icon/icon';
// AuthService importé pour annoter le membre de classe (règle memberVariableDeclaration).

// App est le composant racine : il est chargé en premier et encadre toute l'application
// RouterModule fournit les directives routerLink, routerLinkActive et router-outlet
@Component({
  imports: [RouterModule, Icon],
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
}
