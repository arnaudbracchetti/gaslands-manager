/**
 * Expose si le viewport est actuellement ≤ 640px, en signal réactif au
 * redimensionnement — même seuil que le mixin SCSS `bp.mobile`
 * (`shared/styles/_breakpoints.scss`). Utilisé par `Icon` pour réduire la
 * taille des icônes en mobile, au même titre que les tailles de police
 * (`--fs-*`, cf. `styles.scss`) — les deux mondes (SCSS et TS) ne partageant
 * aucune source commune, ce seuil est à resynchroniser manuellement si l'un
 * des deux change.
 *
 * Singleton (`providedIn: 'root'`) : un seul `MediaQueryList` partagé, quel
 * que soit le nombre d'icônes (ou d'autres consommateurs futurs) à l'écran.
 *
 * `window.matchMedia` n'est pas implémenté par jsdom (environnement de test) —
 * la garde ci-dessous fait retomber `isMobile` sur `false` plutôt que de
 * lever une exception à l'instanciation du service.
 */
import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';

const MOBILE_BREAKPOINT_PX = 640;

@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly mediaQuery: MediaQueryList | null =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`)
      : null;

  private readonly _isMobile = signal<boolean>(this.mediaQuery?.matches ?? false);

  /** Vrai sous 640px de large — même seuil que `bp.mobile` (SCSS). */
  readonly isMobile: Signal<boolean> = this._isMobile.asReadonly();

  constructor() {
    if (!this.mediaQuery) {
      return;
    }

    const listener = (event: MediaQueryListEvent): void => this._isMobile.set(event.matches);
    this.mediaQuery.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => this.mediaQuery?.removeEventListener('change', listener));
  }
}
