/**
 * Global setup Vitest pour les tests e2e backend.
 *
 * Exécuté une seule fois avant tous les tests, hors contexte de test.
 * Utilisé pour s'assurer que le backend est prêt à répondre avant de démarrer.
 *
 * Le backend est supposé être déjà lancé (via `npx nx serve backend` ou `dev.ps1`).
 * Ce setup attend simplement que le port 3000 soit disponible.
 */

/**
 * Tente de se connecter au backend pendant 30 secondes.
 * Lance une erreur si le backend ne répond pas dans ce délai.
 */
async function waitForBackend(host: string, port: number, maxWaitMs = 30000): Promise<void> {
  const url = `http://${host}:${port}/api/catalog/sponsors`;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`\n✅ Backend prêt sur http://${host}:${port}\n`);
        return;
      }
    } catch {
      // Le serveur n'est pas encore disponible, on réessaie
    }
    await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, 500));
  }

  throw new Error(
    `Le backend n'a pas démarré dans les ${maxWaitMs / 1000}s. ` +
    `Assurez-vous que le serveur tourne sur http://${host}:${port}`,
  );
}

// Vitest global setup : exporte une fonction default (ou un objet avec setup/teardown)
export default async function setup(): Promise<void> {
  const host = process.env['HOST'] ?? '127.0.0.1';
  const port = process.env['PORT'] ? Number(process.env['PORT']) : 3000;
  await waitForBackend(host, port);
}
