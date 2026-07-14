/**
 * Démarre/arrête le backend NestJS pointé sur la base de test
 * (`DATABASE_NAME=gaslands_test`) pour la durée de la suite e2e frontend.
 *
 * Ce process est démarré manuellement (spawn), et non via l'option
 * `webServer` de Playwright, car l'ordre est ici critique : la base
 * `gaslands_test` doit exister et être vidée (cf. db.ts) *avant* que
 * TypeORM ne tente de s'y connecter - Playwright ne garantit pas cet
 * ordre entre `globalSetup` et `webServer`.
 *
 * `--configuration=e2e` (cf. apps/backend/project.json) est TOUJOURS
 * utilisée, y compris quand BACKEND_PORT n'est pas personnalisé, et pas
 * seulement pour choisir un build : Nx suit les tâches continues (`serve`)
 * par id complet `project:target:configuration`, pas par les arguments CLI.
 * Sans une configuration distincte de celle de dev.sh (`backend:serve:development`),
 * lancer ce spawn pendant que dev.sh tourne déjà ne démarre PAS un second
 * process indépendant : Nx attend silencieusement que l'instance de dev.sh
 * se termine, et son healthcheck répond quand même (même endpoint) - les
 * tests tourneraient alors, à l'insu de tous, contre le backend et la base
 * de DEV plutôt que contre `gaslands_test`. La configuration `e2e` élimine
 * ce risque : soit un process réellement indépendant démarre, soit le port
 * choisi est déjà occupé par autre chose et l'échec est bruyant (port déjà
 * utilisé), jamais silencieux.
 *
 * Le backend tourne par défaut sur le port 3000, le même que celui ciblé
 * par le proxy Angular (apps/frontend/proxy.conf.cjs) - il ne peut donc pas
 * cohabiter avec un backend de dev déjà lancé sur ce port (ex: dev.sh),
 * SAUF si la variable BACKEND_PORT est positionnée sur un port libre avant
 * de lancer la suite (voir aussi FRONTEND_PORT dans playwright.config.ts,
 * indispensable en complément - cf. docs/E2E_TESTING.md).
 */
import { ChildProcess, spawn } from 'node:child_process';
import { workspaceRoot } from '@nx/devkit';

const BACKEND_PORT = process.env['BACKEND_PORT'] || '3000';

/**
 * Marqueur attendu dans la sortie STANDARD DE CE PROCESS PRÉCIS (pas une
 * requête HTTP externe) - cf. `Logger.log` dans apps/backend/src/main.ts.
 * Nécessaire car un simple healthcheck HTTP ne suffit PAS à garantir qu'on
 * parle au backend qu'on vient de spawn : si le build de `backend:serve:e2e`
 * échoue (ou si le port choisi est déjà occupé), notre process ne démarre
 * jamais, MAIS un backend de dev déjà lancé sur ce même port (ex: dev.sh)
 * répondrait quand même 200 OK sur `/api/catalog/sponsors` - le healthcheck
 * réussirait alors "par accident", et les tests s'exécuteraient à l'insu de
 * tous contre le backend et la base de DEV plutôt que contre `gaslands_test`.
 * Observer le flux stdout DE NOTRE PROPRE process (garanti exclusif à
 * l'instance qu'on vient de spawn) élimine cette ambiguïté : si CE texte
 * n'apparaît jamais dans NOTRE flux, c'est que NOTRE process n'a jamais
 * démarré, quoi qu'un healthcheck externe puisse laisser croire.
 */
function startedMarker(port: string): string {
  return `démarré sur http://localhost:${port}/api`;
}

let backendProcess: ChildProcess | null = null;

/** Attend que CE process précis (stdout observé ci-dessus) confirme son propre démarrage. */
async function waitForOwnStartup(proc: ChildProcess, maxWaitMs: number = 30000): Promise<void> {
  const marker = startedMarker(BACKEND_PORT);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let buffer = '';

    const onStdout = (chunk: Buffer): void => {
      buffer += chunk.toString();
      if (!settled && buffer.includes(marker)) {
        settled = true;
        resolve();
      }
    };
    const onExit = (code: number | null): void => {
      if (!settled) {
        settled = true;
        reject(new Error(
          `Le process backend de test s'est arrêté (code ${code}) avant d'avoir démarré. ` +
          `Vérifiez les logs [backend:test] ci-dessus (build en échec, port ${BACKEND_PORT} déjà ` +
          `occupé par un autre process...).`,
        ));
      }
    };
    const timer = setTimeout((): void => {
      if (!settled) {
        settled = true;
        reject(new Error(
          `Le process backend de test n'a pas confirmé son démarrage dans les ${maxWaitMs / 1000}s ` +
          `(cf. logs [backend:test] ci-dessus).`,
        ));
      }
    }, maxWaitMs);

    proc.stdout?.on('data', onStdout);
    proc.once('exit', onExit);
    // Nettoyage : le timer ne doit pas maintenir le process Node en vie inutilement.
    if (typeof timer.unref === 'function') timer.unref();
  });
}

/** Healthcheck HTTP en complément - confirme que le port choisi est bien joignable. */
async function waitForHealthcheck(maxWaitMs: number = 10000): Promise<void> {
  const url = `http://localhost:${BACKEND_PORT}/api/catalog/sponsors`;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return;
      }
    } catch {
      // Backend pas encore prêt à accepter des connexions - on réessaie.
    }
    await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, 500));
  }

  throw new Error(`Le backend de test ne répond pas sur ${url} bien qu'il ait confirmé son démarrage.`);
}

/** Démarre le backend avec DATABASE_NAME=gaslands_test et attend qu'il réponde. */
export async function startTestBackend(): Promise<void> {
  const proc = spawn('npx', ['nx', 'run', 'backend:serve', '--configuration=e2e'], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      DATABASE_NAME: 'gaslands_test',
      PORT: BACKEND_PORT,
    },
    stdio: 'pipe',
    shell: true,
    // detached: true fait de ce process le leader d'un nouveau groupe -
    // indispensable pour pouvoir tuer toute la chaîne (npm exec -> nx -> node)
    // via un signal de groupe (process.kill(-pid, ...)) dans stopTestBackend().
    detached: true,
  });
  backendProcess = proc;

  proc.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[backend:test] ${chunk}`);
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[backend:test] ${chunk}`);
  });

  await waitForOwnStartup(proc);
  await waitForHealthcheck();
  console.log(`\n✅ Backend de test prêt sur http://localhost:${BACKEND_PORT} (DATABASE_NAME=gaslands_test)\n`);
}

/** Arrête le backend de test démarré par startTestBackend(). */
export async function stopTestBackend(): Promise<void> {
  if (!backendProcess || backendProcess.killed) {
    return;
  }
  // `nx run backend:serve` lance une chaîne de process (npm exec -> nx -> node) ;
  // tuer uniquement le PID direct laisserait les enfants orphelins. Un signal
  // négatif (-pid) cible le groupe de process entier (le process est démarré
  // avec `shell: true`, donc détient bien son propre groupe).
  const pid = backendProcess.pid;
  if (pid) {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      backendProcess.kill('SIGTERM');
    }
  }
  backendProcess = null;
}
