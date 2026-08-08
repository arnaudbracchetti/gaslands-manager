/**
 * Tests unitaires pour ViewportService.
 *
 * `window.matchMedia` n'existe pas dans jsdom (environnement de test) — chaque
 * test pose son propre stub avant l'injection du service (le service ne lit
 * `matchMedia` qu'une seule fois, à la construction).
 */

import { TestBed } from '@angular/core/testing';
import { ViewportService } from './viewport.service';

type MatchMediaStub = (query: string) => MediaQueryList;

describe('ViewportService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    // @ts-expect-error -- nettoyage du stub posé par le test, absent par défaut sous jsdom
    delete window.matchMedia;
  });

  it('résout isMobile à false quand matchMedia est indisponible (cas réel sous jsdom)', () => {
    expect(typeof window.matchMedia).toBe('undefined');

    const service = TestBed.inject(ViewportService);

    expect(service.isMobile()).toBe(false);
  });

  it("résout l'état initial depuis matchMedia().matches", () => {
    window.matchMedia = ((query: string) =>
      ({
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList) as MatchMediaStub;

    const service = TestBed.inject(ViewportService);

    expect(service.isMobile()).toBe(true);
  });

  it('réagit à un changement de correspondance du média', () => {
    let capturedListener: ((event: MediaQueryListEvent) => void) | undefined;
    window.matchMedia = ((query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          capturedListener = listener;
        },
        removeEventListener: () => {},
      }) as unknown as MediaQueryList) as MatchMediaStub;

    const service = TestBed.inject(ViewportService);
    expect(service.isMobile()).toBe(false);

    capturedListener?.({ matches: true } as MediaQueryListEvent);

    expect(service.isMobile()).toBe(true);
  });
});
