import { test, expect } from '@playwright/test';
import { registerTestUser } from './support/auth';
import { createTeam } from './support/teams';

/**
 * Flux pilote e2e : mode campagne — Programme Télé et wizard de fin de partie.
 *
 * Premier spec e2e du domaine Campaigns (cf. ARCHITECTURE.md §8.3, jusqu'ici
 * non couvert). Suit le pattern posé par teams.spec.ts (pilote Teams) :
 * un seul test de bout en bout, email fixe (DB de test vidée par
 * global-setup.ts avant le run, un seul test dans ce fichier).
 *
 * Couvre en particulier la refonte du cycle de vie Atelier
 * (docs/plans/2026-07-05-atelier-lifecycle-design.md) : une partie ne passe
 * plus JOUE directement mais PLANIFIE → ATELIER au clic sur "Terminer" —
 * c'est précisément ce que ce test vérifie (régression du bug de badge
 * "Planifiée" affiché à tort pour une partie en ATELIER).
 *
 * Aucun véhicule n'est ajouté à l'équipe engagée : l'écran 2 du wizard
 * (désignation des épaves) n'a alors rien à afficher, tous les véhicules
 * restent implicitement "Intact" — ce qui laisse l'écran 3 s'activer
 * immédiatement ("Terminer" actif dès l'arrivée, aucune épave à résoudre).
 */
test.describe('Campagnes — Programme Télé et wizard de fin de partie', () => {
  test('crée une saison, planifie une partie, saisit son résultat et la fait entrer en atelier', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Atelier',
      email: 'e2e-campaign-program@test.local',
      password: 'test1234',
    });

    const teamName = 'Escouade Atelier';
    await createTeam(page, teamName);

    // ── Création de la saison, équipe engagée dès la création ──────────────
    await page.goto('/campaigns');
    await page.getByRole('button', { name: '+ Créer une saison' }).click();

    await page.getByLabel('Nom de la saison').fill('Saison E2E Atelier');
    await page.getByLabel('Mon équipe engagée').selectOption({ label: teamName });

    const createCampaignResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns$/.test(r.url()),
    );
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await createCampaignResponse;
    await expect(page).toHaveURL(/\/campaigns\/\d+$/);

    // ── Ajout d'une partie au Programme (premier scénario du catalogue) ─────
    await page.getByRole('button', { name: '➕ Ajouter une partie' }).click();
    await page.getByLabel('Scénario').selectOption({ index: 1 });

    const createGameResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games$/.test(r.url()),
    );
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await createGameResponse;

    const gameItem = page.locator('.game-list__item').first();
    await expect(gameItem.locator('.game-list__badge--status')).toHaveText('Planifiée');

    // ── Écran 1 du wizard : présence + classement ───────────────────────────
    await page.getByRole('button', { name: '🎯 Saisir les rangs' }).click();

    const participantRow = page.locator('.rst__participant-row').filter({ hasText: teamName });
    await participantRow.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Suivant — désigner les épaves' }).click();

    // ── Écran 2 du wizard : désignation des épaves (rien à désigner ici) ────
    // Aucun véhicule dans l'équipe → tous les véhicules restent "Intact" par
    // défaut, rien à cocher. Ce clic déclenche POST .../results.
    const recordResultResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/results$/.test(r.url()),
    );
    await page.getByRole('button', { name: 'Suivant — résoudre les épaves' }).click();
    await recordResultResponse;

    // ── Écran 3 du wizard : résolution automatique (vide ici) puis "Terminer" ──
    // Sans véhicule mis en épave, allResolved() est vrai dès l'arrivée sur cet
    // écran (aucun tirage à attendre) — le bouton "Terminer" est donc déjà actif.
    const terminerButton = page.getByRole('button', { name: 'Terminer' });
    await expect(terminerButton).toBeEnabled();

    const enterAtelierResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/enter-atelier$/.test(r.url()),
    );
    await terminerButton.click();
    await enterAtelierResponse;

    // ── Le wizard se ferme, la partie affiche désormais le statut Atelier ───
    await expect(page.getByRole('button', { name: 'Terminer' })).toHaveCount(0);
    await expect(gameItem.locator('.game-list__badge--status')).toHaveText('Atelier');
    await expect(gameItem.locator('.game-list__badge--status')).toHaveClass(/game-list__badge--atelier/);
    // Une partie en ATELIER n'est plus "à enregistrer" : le bouton disparaît.
    await expect(gameItem.getByRole('button', { name: '🎯 Saisir les rangs' })).toHaveCount(0);

    // La persistance se vérifie par un rechargement complet de la page.
    await page.reload();
    await expect(gameItem.locator('.game-list__badge--status')).toHaveText('Atelier');
  });
});
