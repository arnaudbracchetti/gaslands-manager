import { Directive, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * DocLinksDirective — navigation fluide entre chapitres de documentation.
 *
 * Le contenu d'un chapitre est injecté en HTML brut (`[innerHTML]`, cf.
 * DocumentationChapter) : Angular ne compile jamais ce DOM, donc un `<a>`
 * qu'il contient n'est jamais intercepté par le Router — un clic dessus
 * déclencherait une navigation navigateur classique (rechargement complet
 * de la page), ce qui casse l'effet SPA partout ailleurs dans l'appli.
 *
 * Cette directive écoute les clics sur le CONTENEUR (délégation d'événement
 * — on ne peut pas écouter chaque `<a>` individuellement, ils n'existent pas
 * encore au moment où Angular compile le template) et prend la main
 * uniquement sur les liens internes vers `/documentation/...`, écrits en
 * dur dans le Markdown source (ex. `[Voir l'Atelier](/documentation/atelier)`).
 *
 * Les ancres same-page (`#section`) n'ont besoin d'aucune interception : le
 * navigateur fait défiler la page nativement sans recharger tant que le
 * chemin ne change pas.
 */
@Directive({
  selector: '[appDocLinks]',
  standalone: true,
  host: {
    '(click)': 'onClick($event)',
  },
})
export class DocLinksDirective {
  private readonly router: Router = inject(Router);

  onClick(event: MouseEvent): void {
    // closest('a') : fonctionne même si le clic tombe sur un <strong>/<code>
    // imbriqué dans le lien plutôt que sur le <a> lui-même.
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) {
      return;
    }
    // N'intercepte que les liens réellement internes à la documentation —
    // un lien externe éventuel garde son comportement natif.
    const isSameOrigin = anchor.origin === window.location.origin;
    const isDocLink = anchor.pathname.startsWith('/documentation');
    // Une ancre same-page (#section, résolue par le navigateur avec le même
    // pathname que la page courante) reste hors interception : la laisser au
    // navigateur (défilement natif, gratuit) évite de dépendre du traitement
    // par le Router d'une navigation vers une URL de même chemin — non
    // garanti identique au cas où seul le fragment change.
    const isSamePage = anchor.pathname === window.location.pathname;
    if (!isSameOrigin || !isDocLink || isSamePage) {
      return;
    }

    event.preventDefault();
    this.router.navigateByUrl(anchor.pathname + anchor.hash);
  }
}
