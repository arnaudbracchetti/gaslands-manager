/**
 * Composant d'inscription.
 * Même architecture que Login : standalone, Signals, FormsModule.
 * Quatre champs : prénom, nom, email, mot de passe.
 */

import { HttpErrorResponse } from '@angular/common/http';
import { Component, WritableSignal, inject, signal } from '@angular/core';
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
  private readonly authService: AuthService = inject(AuthService);
  private readonly router: Router = inject(Router);

  readonly firstName: WritableSignal<string> = signal('');
  readonly lastName: WritableSignal<string> = signal('');
  readonly email: WritableSignal<string> = signal('');
  readonly password: WritableSignal<string> = signal('');
  readonly errorMessage: WritableSignal<string> = signal('');
  readonly isLoading: WritableSignal<boolean> = signal(false);

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
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Erreur lors de la création du compte');
          this.isLoading.set(false);
        },
      });
  }
}
