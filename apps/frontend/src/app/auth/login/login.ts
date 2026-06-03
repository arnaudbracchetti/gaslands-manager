/**
 * Composant de connexion.
 *
 * Architecture zoneless + Signals :
 * - Toutes les propriétés affichées dans le template sont des signal()
 * - Le template utilise @if / @else (pas *ngIf)
 * - La liaison two-way avec les inputs utilise [ngModel]="sig()" + (ngModelChange)="sig.set($event)"
 *   car [(ngModel)] classique ne déclenche pas le changement avec les Signals en zoneless.
 *
 * FormsModule : nécessaire pour utiliser ngModel dans le template.
 * RouterLink  : nécessaire pour les liens routerLink dans le template.
 */

import { HttpErrorResponse } from '@angular/common/http';
import { Component, WritableSignal, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  // Annotations de membre de classe (règle memberVariableDeclaration).
  private readonly authService: AuthService = inject(AuthService);
  private readonly router: Router = inject(Router);

  // WritableSignal<T> : type retourné par signal(). Visible à la lecture du code.
  // États du formulaire — chaque signal déclenche un re-rendu quand il change
  readonly email: WritableSignal<string> = signal('');
  readonly password: WritableSignal<string> = signal('');
  readonly errorMessage: WritableSignal<string> = signal('');
  readonly isLoading: WritableSignal<boolean> = signal(false);

  onSubmit(): void {
    // Validation côté client minimale
    if (!this.email() || !this.password()) {
      this.errorMessage.set('Veuillez remplir tous les champs');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.login(this.email(), this.password()).subscribe({
      next: () => {
        // Navigation vers la page d'accueil après connexion réussie
        this.router.navigate(['/home']);
      },
      // HttpErrorResponse : type Angular pour les erreurs HTTP.
      // err.error = corps de la réponse d'erreur (JSON parsé par Angular).
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Identifiants invalides');
        this.isLoading.set(false);
      },
    });
  }
}
