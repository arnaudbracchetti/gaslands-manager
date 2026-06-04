/**
 * Global teardown Vitest pour les tests e2e backend.
 *
 * Exécuté une seule fois après tous les tests.
 * Le backend étant lancé séparément (via dev.ps1 ou manuellement),
 * on ne le tue pas ici — on laisse simplement un message.
 */
export default async function teardown(): Promise<void> {
  console.log('\n✅ Tests e2e backend terminés.\n');
}
