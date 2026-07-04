/**
 * Démarre/arrête le backend NestJS pointé sur la base de test
 * (`DATABASE_NAME=gaslands_test`) pour la durée de la suite e2e frontend.
 *
 * Ce process est démarré manuellement (spawn), et non via l'option
 * `webServer` de Playwright, car l'ordre est ici critique : la base
 * `gaslands_test` doit exister et être vidée (cf. db.ts) *avant* que
 * TypeORM ne tente de s'y connecter — Playwright ne garantit pas cet
 * ordre entre `globalSetup` et `webServer`.
 *
 * Le backend tourne sur le port 3000, le même que celui ciblé par le
 * proxy Angular (apps/frontend/proxy.conf.json) — il ne peut donc pas
 * cohabiter avec un backend de dev déjà lancé sur ce port (ex: dev.sh).
 */
import { ChildProcess, spawn } from 'node:child_process';
import { workspaceRoot } from '@nx/devkit';

let backendProcess: ChildProcess | null = null;

async function waitForHealthcheck(maxWaitMs = 30000): Promise<void> {
  const url = 'http://localhost:3000/api/catalog/sponsors';
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return;
      }
    } catch {
      // Backend pas encore prêt à accepter des connexions — on réessaie.
    }
    await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, 500));
  }

  throw new Error(
    `Le backend de test n'a pas démarré dans les ${maxWaitMs / 1000}s sur ${url}. ` +
    `Vérifiez qu'aucun autre process (ex: dev.sh) n'occupe déjà le port 3000.`,
  );
}

/** Démarre le backend avec DATABASE_NAME=gaslands_test et attend qu'il réponde. */
export async function startTestBackend(): Promise<void> {
  backendProcess = spawn('npx', ['nx', 'run', 'backend:serve'], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      DATABASE_NAME: 'gaslands_test',
      PORT: '3000',
    },
    stdio: 'pipe',
    shell: true,
    // detached: true fait de ce process le leader d'un nouveau groupe —
    // indispensable pour pouvoir tuer toute la chaîne (npm exec -> nx -> node)
    // via un signal de groupe (process.kill(-pid, ...)) dans stopTestBackend().
    detached: true,
  });

  backendProcess.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[backend:test] ${chunk}`);
  });
  backendProcess.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[backend:test] ${chunk}`);
  });

  await waitForHealthcheck();
  console.log('\n✅ Backend de test prêt sur http://localhost:3000 (DATABASE_NAME=gaslands_test)\n');
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
