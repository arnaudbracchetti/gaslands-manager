import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

/**
 * FRONTEND_PORT/BACKEND_PORT : permettent de lancer cette suite sur des ports
 * différents de ceux de `dev.sh` (4200/3000), pour ne jamais avoir à
 * l'arrêter avant `npx nx e2e frontend-e2e` (cf. docs/E2E_TESTING.md). Sans
 * ces variables, comportement strictement identique à avant (4200/3000).
 * Le backend de test (démarré par global-setup.ts) lit directement
 * BACKEND_PORT ; le proxy Angular (apps/frontend/proxy.conf.cjs) aussi -
 * les deux valeurs doivent donc rester cohérentes, ce qui est garanti ici
 * puisqu'il n'y a qu'UNE variable d'environnement pour les deux.
 */
const frontendPort = process.env['FRONTEND_PORT'] || '4200';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || `http://localhost:${frontendPort}`;

/**
 * Reprendre un frontend Angular déjà lancé (ex: dev.sh) n'est SÛR que si son
 * proxy cible le même backend que celui que cette suite s'apprête à
 * démarrer - vrai uniquement dans le cas par défaut (personne n'a
 * personnalisé BACKEND_PORT/FRONTEND_PORT). Dès qu'une des deux variables
 * est positionnée, on force un frontend FRAIS : le pire cas devient une
 * erreur explicite (port déjà occupé) plutôt qu'un silence - le navigateur
 * de test parlerait sinon au backend de dev (et sa vraie base de données)
 * au lieu du backend de test isolé.
 */
const usingCustomPorts = Boolean(process.env['BACKEND_PORT'] || process.env['FRONTEND_PORT']);

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /*
   * globalSetup/globalTeardown : préparent la base "gaslands_test" (créée +
   * vidée) puis démarrent/arrêtent un backend dédié pointé dessus. Ce backend
   * n'est volontairement PAS déclaré via `webServer` ci-dessous : l'ordre
   * entre `globalSetup` et `webServer` n'est pas garanti, alors que la base
   * de test doit impérativement exister avant que ce backend ne s'y connecte
   * (cf. src/support/global-setup.ts).
   */
  globalSetup: require.resolve('./src/support/global-setup'),
  globalTeardown: require.resolve('./src/support/global-teardown'),
  /*
   * Run your local dev server before starting the tests.
   *
   * `--configuration=e2e` (uniquement quand des ports personnalisés sont
   * demandés) : Nx suit les tâches "continues" (`serve`) par id complet
   * `project:target:configuration`, PAS par les arguments CLI (`--port`
   * inclus) - invoquer `frontend:serve:development` une seconde fois pendant
   * que `dev.sh` la fait déjà tourner ne lance donc PAS un second process
   * indépendant, Nx attend indéfiniment que l'instance de `dev.sh` se
   * termine (message "Waiting for frontend:serve:development in another nx
   * process", jamais résolu puisque dev.sh tourne en continu). La
   * configuration `e2e` (cf. apps/frontend/project.json, même buildTarget
   * que `development`) a un id de tâche distinct (`frontend:serve:e2e`),
   * donc aucune collision avec l'instance de dev.sh.
   */
  webServer: {
    command: usingCustomPorts
      ? `npx nx run frontend:serve --configuration=e2e --port=${frontendPort}`
      : 'npx nx run frontend:serve',
    url: `http://localhost:${frontendPort}`,
    reuseExistingServer: !usingCustomPorts,
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});
