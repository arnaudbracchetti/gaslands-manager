import { test, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail } from './support/auth';
import { createTeam } from './support/teams';
import { createCampaign, addGame, inviteAndValidateParticipant } from './support/campaigns';

/**
 * Journal d'une partie (`GameJournalModal`) — jamais ouvert par aucun test
 * existant. Accessible à TOUT participant VALIDATED (pas seulement
 * l'organisateur, cf. `assertVisibleParticipant` côté backend) une fois la
 * partie en ATELIER ou JOUE.
 *
 * Fixture minimale : deux participants présents et classés génère déjà une
 * entrée de journal par participant (`RankingAssignedEvent`) — inutile
 * d'ajouter des véhicules/épaves pour ce test, qui porte sur l'AFFICHAGE du
 * journal, pas sur son contenu détaillé.
 */
test.describe('Campagnes — Journal de partie', () => {
  async function setUpGameInAtelier(page: import('@playwright/test').Page, browser: import('@playwright/test').Browser, suffix: string) {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Organisatrice',
      email: uniqueEmail(`e2e-journal-org-${suffix}`),
      password: 'test1234',
    });

    const organizerTeam = 'Escouade Journal';
    await createTeam(page, organizerTeam);
    const campaignId = await createCampaign(page, { name: 'Saison E2E Journal', teamName: organizerTeam });

    const joineeTeam = 'Escouade Chroniqueuse';
    const { joineeContext, joineePage } = await inviteAndValidateParticipant(page, browser, {
      joineeUser: {
        firstName: 'Cheedo',
        lastName: 'Journaliste',
        email: uniqueEmail(`e2e-journal-joinee-${suffix}`),
        password: 'test1234',
      },
      joineeTeamName: joineeTeam,
    });

    await addGame(page);
    await page.getByRole('button', { name: '🎯 Saisir les rangs' }).click();
    await page.locator('.rst__participant-row').filter({ hasText: organizerTeam }).locator('input[type="checkbox"]').check();
    await page.locator('.rst__participant-row').filter({ hasText: joineeTeam }).locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Suivant — désigner les épaves' }).click();

    const recordResultResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/results$/.test(r.url()),
    );
    await page.getByRole('button', { name: 'Suivant — résoudre les épaves' }).click();
    await recordResultResponse;

    const terminerButton = page.getByRole('button', { name: 'Terminer' });
    await expect(terminerButton).toBeEnabled({ timeout: 15000 });
    const enterAtelierResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/enter-atelier$/.test(r.url()),
    );
    await terminerButton.click();
    await enterAtelierResponse;

    return { campaignId, organizerTeam, joineeTeam, joineeContext, joineePage };
  }

  test('organisateur ouvre le journal, un groupe par participant', async ({ page, browser }) => {
    const { organizerTeam, joineeTeam, joineeContext } = await setUpGameInAtelier(page, browser, 'organizer');

    const gameItem = page.locator('.game-list__item').first();
    await expect(gameItem.getByRole('button', { name: '📜 Journal' })).toBeVisible();

    const journalResponse = page.waitForResponse(
      (r) => r.request().method() === 'GET' && /\/api\/campaigns\/\d+\/games\/\d+\/journal$/.test(r.url()),
    );
    await gameItem.getByRole('button', { name: '📜 Journal' }).click();
    await journalResponse;

    const modal = page.getByRole('dialog', { name: 'Journal de la partie' });
    await expect(modal).toBeVisible();
    await expect(modal.locator('.gjm-modal__title')).toContainText('📜 Journal');

    await expect(modal.locator('.gjm-group')).toHaveCount(2);
    const organizerGroup = modal.locator('.gjm-group').filter({ hasText: organizerTeam });
    await expect(organizerGroup.locator('.gjm-group__title')).toContainText(organizerTeam);
    await expect(organizerGroup.locator('.gjm-group__entry').first()).toBeVisible();
    await expect(organizerGroup.locator('.gjm-group__description').first()).not.toHaveText('');

    const joineeGroup = modal.locator('.gjm-group').filter({ hasText: joineeTeam });
    await expect(joineeGroup.locator('.gjm-group__title')).toContainText(joineeTeam);

    await modal.locator('.gjm-modal__close').click();
    await expect(modal).toHaveCount(0);

    await joineeContext.close();
  });

  test('un participant non-organisateur peut aussi ouvrir le journal', async ({ page, browser }) => {
    const { joineePage, joineeContext, campaignId } = await setUpGameInAtelier(page, browser, 'joinee');

    await joineePage.goto(`/campaigns/${campaignId}`);
    const gameItem = joineePage.locator('.game-list__item').first();
    await expect(gameItem.getByRole('button', { name: '📜 Journal' })).toBeVisible();
    await gameItem.getByRole('button', { name: '📜 Journal' }).click();

    const modal = joineePage.getByRole('dialog', { name: 'Journal de la partie' });
    await expect(modal).toBeVisible();
    await expect(modal.locator('.gjm-group')).toHaveCount(2);

    await joineeContext.close();
  });
});
