import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from './auth/auth.service';
// AuthService importé pour annoter le membre de classe (règle memberVariableDeclaration).

// App est le composant racine : il est chargé en premier et encadre toute l'application
// RouterModule fournit les directives routerLink, routerLinkActive et router-outlet
@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // string : type explicite du membre de classe (règle memberVariableDeclaration).
  title: string = 'Gaslands Manager';

  // inject(AuthService) : accès au service singleton d'authentification.
  // On l'expose comme propriété publique pour que le template puisse lire
  // authService.isLoggedIn() et authService.currentUser().
  // Comme authService est un singleton (providedIn: 'root'), c'est la même
  // instance partout dans l'app : pas de duplication d'état.
  readonly authService: AuthService = inject(AuthService);
}
