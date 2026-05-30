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

import { Component, inject, signal } from '@angular/core';
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
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // États du formulaire — chaque signal déclenche un re-rendu quand il change
  readonly email = signal('');
  readonly password = signal('');
  readonly errorMessage = signal('');
  readonly isLoading = signal(false);

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
      error: (err) => {
        // err.error.message = message envoyé par NestJS (ex: "Identifiants invalides")
        this.errorMessage.set(err?.error?.message ?? 'Identifiants invalides');
        this.isLoading.set(false);
      },
    });
  }
}
