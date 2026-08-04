/**
 * Façade typée pour l'API globale `window.turnstile`, injectée par le script
 * Cloudflare `api.js?render=explicit`. Rendu explicite (pas de `data-sitekey`
 * automatique dans le HTML) + injection paresseuse depuis `Register`
 * (jamais dans `index.html`) : sinon Cloudflare serait chargé sur chaque
 * route de l'application, y compris pour les visiteurs qui ne s'inscrivent
 * jamais.
 */

export interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_ID = 'cf-turnstile-script';

/**
 * Injecte le script Cloudflare une seule fois (idempotent - vérifie la
 * présence du tag avant d'en ajouter un second) et résout une fois
 * `window.turnstile` disponible.
 */
export function loadTurnstileScript(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile as TurnstileApi));
      existing.addEventListener('error', () => reject(new Error('Échec du chargement de Turnstile')));
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(window.turnstile as TurnstileApi));
    script.addEventListener('error', () => reject(new Error('Échec du chargement de Turnstile')));
    document.head.appendChild(script);
  });
}
