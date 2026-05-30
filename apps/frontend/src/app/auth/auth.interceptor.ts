/**
 * Intercepteur HTTP d'authentification.
 *
 * Un intercepteur Angular se place entre le service HttpClient et le serveur :
 * il peut modifier toutes les requêtes sortantes et/ou les réponses entrantes.
 *
 * Ici, son rôle est d'ajouter automatiquement le JWT dans le header
 * de chaque requête HTTP, sans avoir à le faire manuellement dans chaque service.
 *
 * Format de l'intercepteur :
 * - Angular 15+ recommande les intercepteurs FONCTIONNELS (HttpInterceptorFn)
 *   plutôt que des classes, car ils sont plus simples et compatibles avec
 *   l'injection standalone (pas de module nécessaire).
 * - On lit localStorage directement (pas d'injection de AuthService) pour
 *   éviter une dépendance circulaire (AuthService → HttpClient → intercepteur → AuthService).
 *
 * Enregistrement dans app.config.ts :
 *   provideHttpClient(withInterceptors([authInterceptor]))
 */

import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('gaslands_token');

  // Si pas de token → on laisse passer la requête sans modification
  if (!token) {
    return next(req);
  }

  // req.clone() crée une copie immuable de la requête avec les headers modifiés.
  // Les requêtes Angular HttpClient sont immuables, d'où le clone.
  const authRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(authRequest);
};
