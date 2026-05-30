/**
 * Composant d'inscription.
 * Même architecture que Login : standalone, Signals, FormsModule.
 * Quatre champs : prénom, nom, email, mot de passe.
 */

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
})
export class Register {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly errorMessage = signal('');
  readonly isLoading = signal(false);

  onSubmit(): void {
    if (!this.firstName() || !this.lastName() || !this.email() || !this.password()) {
      this.errorMessage.set('Veuillez remplir tous les champs');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService
      .register({
        firstName: this.firstName(),
        lastName: this.lastName(),
        email: this.email(),
        password: this.password(),
      })
      .subscribe({
        next: () => {
          this.router.navigate(['/home']);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Erreur lors de la création du compte');
          this.isLoading.set(false);
        },
      });
  }
}
