/**
 * Global teardown Playwright pour les tests e2e frontend.
 *
 * Arrête le backend de test démarré par global-setup.ts. Le frontend
 * (démarré via l'option `webServer` de Playwright) est arrêté par
 * Playwright lui-même — rien à faire ici pour lui.
 */
import { stopTestBackend } from './backend-process';

export default async function globalTeardown(): Promise<void> {
  await stopTestBackend();
  console.log('\n✅ Tests e2e frontend terminés — backend de test arrêté.\n');
}
