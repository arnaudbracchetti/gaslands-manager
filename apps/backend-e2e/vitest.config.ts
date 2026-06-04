/**
 * Configuration Vitest pour les tests e2e du backend Gaslands Manager.
 *
 * Ces tests sont des tests d'intégration HTTP : ils utilisent axios pour
 * appeler les vraies routes de l'API et vérifier les réponses.
 * Ils nécessitent que le backend soit lancé sur http://localhost:3000.
 *
 * Différence avec les tests unitaires (apps/backend/vitest.config.ts) :
 * - Pas de décorateurs NestJS → pas besoin de SWC
 * - globalSetup : attend que le serveur soit prêt avant de démarrer les tests
 * - setupFiles : configure axios avec la baseURL du serveur
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // globalSetup : exécuté une seule fois avant tous les tests (hors contexte de test)
    // Utilisé pour attendre que le backend soit prêt
    globalSetup: ['src/support/global-setup.ts'],
    // setupFiles : exécuté avant chaque fichier de test (dans le contexte de test)
    // Utilisé pour configurer axios
    setupFiles: ['src/support/test-setup.ts'],
  },
});
