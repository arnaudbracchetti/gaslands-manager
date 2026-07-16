import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth/auth.interceptor';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    // Mode "zoneless" : Angular 19+ n'utilise plus zone.js pour détecter
    // les changements. À la place, il s'appuie sur les Signals (signal())
    // qui notifient Angular uniquement quand une valeur change réellement.
    // C'est plus performant et plus explicite que l'ancienne approche zone.js
    // qui interceptait toutes les opérations async du navigateur.
    provideZonelessChangeDetection(),

    // withInMemoryScrolling({ anchorScrolling: 'enabled' }) : sans cette option,
    // le Router met bien à jour l'URL avec un fragment (#section) mais ne fait
    // jamais défiler la page jusqu'à l'élément portant cet id — nécessaire pour
    // les ancres de la documentation utilisateur (cf. DocsService.withHeadingIds).
    // scrollPositionRestoration reste au défaut ('disabled') : comportement de
    // scroll inchangé pour toutes les autres routes de l'appli.
    provideRouter(appRoutes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    // withInterceptors([...]) enregistre nos intercepteurs HTTP fonctionnels.
    // authInterceptor ajoute automatiquement le JWT dans chaque requête.
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
