/**
 * Modal — fenêtre modale générique réutilisable (dumb).
 *
 * Composant "dumb" au sens de l'ARCHITECTURE.md §2.5 : il ne connaît ni le
 * contenu qu'il affiche, ni la raison pour laquelle on souhaite le fermer.
 * Il se contente de :
 *  - afficher/masquer un overlay plein écran selon `visible`
 *  - projeter le contenu fourni par le parent via `<ng-content />`
 *  - signaler une DEMANDE de fermeture (`closeRequested`) sur trois interactions
 *    (clic sur l'overlay, clic sur la croix, touche Échap) — c'est au parent de
 *    décider s'il ferme réellement (cf. `Teams.closeVehicleBuilder`, qui referme
 *    ET recharge la liste pour rafraîchir `vehicleCount`).
 *
 * Pas de dossier `shared/` dans ce projet (cf. ARCHITECTURE.md §2.6, table des
 * fichiers clés — seul `teams/` regroupe des sous-composants). Ce composant est
 * co-localisé ici car aujourd'hui seul `VehicleBuilder` l'utilise ; rien n'empêche
 * de le déplacer vers un dossier partagé si un second besoin apparaissait.
 *
 * Pattern Angular 17+ : input() / output() (API Signals), cf. TeamCard pour le
 * même découpage dumb.
 */
import { Component, HostListener, InputSignal, OutputEmitterRef, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /**
   * Affiche ou masque la modale.
   * input.required<boolean>() : le parent DOIT piloter explicitement la visibilité
   * (pas de valeur par défaut qui masquerait un oubli — cf. TeamCard.team).
   */
  visible: InputSignal<boolean> = input.required<boolean>();

  /** Titre affiché dans l'en-tête. Optionnel : une modale sans titre reste valide. */
  title: InputSignal<string> = input<string>('');

  // ── Output ──────────────────────────────────────────────────────────────────

  /**
   * Émis quand l'utilisateur DEMANDE la fermeture — overlay, croix ou Échap.
   * `void` : aucune donnée à transmettre, seule l'intention compte. Le parent
   * choisit la suite (fermer immédiatement, demander confirmation, etc.).
   */
  closeRequested: OutputEmitterRef<void> = output<void>();

  // ── Interactions ─────────────────────────────────────────────────────────────

  /**
   * Échap ferme la modale — convention d'accessibilité standard pour les
   * fenêtres modales (cf. WAI-ARIA Authoring Practices, pattern "Dialog (Modal)").
   * `@HostListener('document:keydown.escape')` écoute au niveau du document :
   * fonctionne même si le focus est resté sur un élément hors de la modale.
   * On ne réagit que si la modale est effectivement visible, pour ne pas
   * intercepter Échap ailleurs dans l'application.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) {
      this.closeRequested.emit();
    }
  }

  /** Clic sur l'overlay (zone sombre autour du contenu) → demande de fermeture. */
  onOverlayClick(): void {
    this.closeRequested.emit();
  }

  /**
   * Clic sur le contenu projeté → on stoppe la propagation pour qu'il ne
   * remonte PAS jusqu'à l'overlay (sinon cliquer n'importe où dans la modale
   * la refermerait — comportement piégeux pour l'utilisateur).
   */
  onContentClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
