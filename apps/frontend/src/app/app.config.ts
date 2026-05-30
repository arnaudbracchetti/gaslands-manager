import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
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

    provideRouter(appRoutes),
    // withInterceptors([...]) enregistre nos intercepteurs HTTP fonctionnels.
    // authInterceptor ajoute automatiquement le JWT dans chaque requête.
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
