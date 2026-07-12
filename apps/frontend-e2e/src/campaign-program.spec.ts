import { test, expect } from '@playwright/test';
import { registerTestUser } from './support/auth';
import { createTeam } from './support/teams';
import { createCampaign, addGame, runResultWizard } from './support/campaigns';

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
 *
 * Le pilotage générique (création de saison, ajout de partie, traversée du
 * wizard) est délégué à `support/campaigns.ts` — réutilisé tel quel par les
 * autres specs Campaigns/Atelier — ce test garde seulement ses assertions
 * spécifiques (badges, disparition du bouton, persistance au reload).
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

    await createCampaign(page, { name: 'Saison E2E Atelier', teamName });

    await addGame(page);

    const gameItem = page.locator('.game-list__item').first();
    await expect(gameItem.locator('.game-list__badge--status')).toHaveText('Planifiée');

    await runResultWizard(page, { teamNames: [teamName] });

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
