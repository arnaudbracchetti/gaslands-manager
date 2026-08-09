import { Component, InputSignal, OutputEmitterRef, input, output } from '@angular/core';

/**
 * Bandeau permanent affiché tant qu'un administrateur agit en usurpant
 * l'identité d'un autre compte ("se connecter en tant que", cf.
 * `AuthService.impersonationActive`) — rendu dans `App` entre la navbar et le
 * contenu de la page, seul emplacement garanti visible sur tout écran.
 *
 * Composant dumb : ne connaît ni `AuthService` ni la notion d'usurpation elle-
 * même, seulement le nom à afficher et le clic sur "Revenir à mon compte".
 */
@Component({
  selector: 'app-impersonation-banner',
  standalone: true,
  templateUrl: './impersonation-banner.html',
  styleUrl: './impersonation-banner.scss',
})
export class ImpersonationBanner {
  /** Nom d'affichage (callName) du compte actuellement usurpé. */
  impersonatedUserName: InputSignal<string> = input.required<string>();

  /** Émis au clic sur "Revenir à mon compte". */
  returnClicked: OutputEmitterRef<void> = output<void>();
}
