/**
 * Composant d'inscription.
 * Même architecture que Login : standalone, Signals, FormsModule.
 * Champs : prénom, nom, pseudo, email, mot de passe - plus, si
 * `environment.turnstileSiteKey` est renseignée (production, P0-6), le
 * widget Turnstile (captcha anti-robot, contrôle principal anti-inscription
 * massive - cf. docs/spec/AUTH.md).
 */

import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  WritableSignal,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth.service';
import { loadTurnstileScript } from './turnstile';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
})
export class Register {
  private readonly authService: AuthService = inject(AuthService);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly firstName: WritableSignal<string> = signal('');
  readonly lastName: WritableSignal<string> = signal('');
  readonly pseudo: WritableSignal<string> = signal('');
  readonly email: WritableSignal<string> = signal('');
  readonly password: WritableSignal<string> = signal('');
  readonly confirmPassword: WritableSignal<string> = signal('');
  readonly errorMessage: WritableSignal<string> = signal('');
  readonly isLoading: WritableSignal<boolean> = signal(false);

  /**
   * Coche client uniquement, même pattern que ChangePasswordModal - ne se
   * déclenche qu'une fois les deux champs renseignés pour ne pas flasher une
   * erreur avant que l'utilisateur ait atteint le second champ.
   */
  readonly passwordMismatch = computed<boolean>(
    () => this.confirmPassword() !== '' && this.password() !== this.confirmPassword(),
  );
  readonly passwordTooShort = computed<boolean>(() => this.password().length > 0 && this.password().length < 6);

  /**
   * Faux en dev/e2e (clé de site vide, cf. environments/environment.ts) : le
   * widget n'est alors jamais rendu et le bouton reste toujours actif - c'est
   * tout le mécanisme de neutralisation du captcha hors production.
   */
  readonly captchaEnabled: WritableSignal<boolean> = signal(environment.turnstileSiteKey !== '');
  readonly captchaToken: WritableSignal<string> = signal('');
  readonly canSubmit = computed<boolean>(
    () => (!this.captchaEnabled() || this.captchaToken() !== '') && !this.passwordMismatch() && !this.passwordTooShort(),
  );

  private readonly turnstileHost = viewChild<ElementRef<HTMLDivElement>>('turnstileHost');
  private widgetId: string | undefined;

  constructor() {
    // Rendu explicite du widget après le premier rendu du template - c'est
    // à ce moment que `turnstileHost()` référence un élément DOM réel.
    afterNextRender(() => {
      if (!this.captchaEnabled()) return;
      const host = this.turnstileHost()?.nativeElement;
      if (!host) return;

      loadTurnstileScript()
        .then((turnstile) => {
          this.widgetId = turnstile.render(host, {
            sitekey: environment.turnstileSiteKey,
            // Point critique zoneless : Cloudflare invoque ces callbacks
            // depuis un événement DOM brut, hors de tout contexte Angular -
            // `signal.set()` est ce qui porte la notification de rendu ;
            // une simple affectation de champ ne déclencherait rien.
            callback: (token: string) => this.captchaToken.set(token),
            'expired-callback': () => this.captchaToken.set(''),
            'error-callback': () => this.captchaToken.set(''),
          });
        })
        .catch(() => {
          this.errorMessage.set('Impossible de charger la vérification anti-robot. Rechargez la page.');
        });
    });

    this.destroyRef.onDestroy(() => {
      if (this.captchaEnabled() && this.widgetId !== undefined) {
        window.turnstile?.remove(this.widgetId);
      }
    });
  }

  onSubmit(): void {
    if (!this.firstName() || !this.lastName() || !this.pseudo() || !this.email() || !this.password()) {
      this.errorMessage.set('Veuillez remplir tous les champs');
      return;
    }
    if (this.passwordTooShort()) {
      this.errorMessage.set('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (this.password() !== this.confirmPassword()) {
      this.errorMessage.set('Les mots de passe ne correspondent pas');
      return;
    }
    if (!this.canSubmit()) {
      this.errorMessage.set('Merci de valider la vérification anti-robot');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService
      .register({
        firstName: this.firstName(),
        lastName: this.lastName(),
        pseudo: this.pseudo(),
        email: this.email(),
        password: this.password(),
        ...(this.captchaEnabled() ? { captchaToken: this.captchaToken() } : {}),
      })
      .subscribe({
        next: () => {
          this.router.navigate(['/home']);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(err.error?.message ?? 'Erreur lors de la création du compte');
          this.isLoading.set(false);
          // Les jetons Turnstile sont à usage unique : sans ce reset, un 409
          // "email déjà pris" rendrait toute nouvelle tentative impossible.
          this.resetCaptcha();
        },
      });
  }

  private resetCaptcha(): void {
    if (this.captchaEnabled() && this.widgetId !== undefined) {
      window.turnstile?.reset(this.widgetId);
    }
    this.captchaToken.set('');
  }
}
