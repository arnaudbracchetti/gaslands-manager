/**
 * Global setup Playwright pour les tests e2e frontend.
 *
 * Exécuté une seule fois avant tous les tests. Contrairement à `webServer`
 * (qui ne démarre que le frontend, cf. playwright.config.ts), l'ordre exact
 * est ici piloté à la main car il est critique :
 *
 *   1. s'assurer que la base "gaslands_test" existe et est vidée
 *   2. démarrer le backend pointé sur cette base
 *   3. attendre qu'il réponde
 *
 * (le backend crasherait à la connexion si l'étape 1 n'était pas terminée
 * avant son démarrage — cf. backend-process.ts pour le détail du choix).
 */
import { prepareTestDatabase } from './db';
import { startTestBackend } from './backend-process';

export default async function globalSetup(): Promise<void> {
  await prepareTestDatabase();
  await startTestBackend();
}
