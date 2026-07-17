import { test, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail } from './support/auth';
import { createTeamWithVehicles } from './support/teams';
import { createCampaign, addGame, completePreDesignationSteps, designateWreck, addBystanderParticipant, inviteAndValidateParticipant } from './support/campaigns';

/**
 * Désignation des épaves (écran 2 du wizard de fin de partie) avec de VRAIS
 * véhicules — le seul test existant (campaign-program.spec.ts) utilise une
 * équipe sans véhicule, donc cet écran y est toujours vide.
 *
 * ⚠️ Le tirage D6 de la Table des Épaves (écran 3) est non déterministe côté
 * serveur (`Math.random()`, aucune graine injectable hors tests unitaires) —
 * aucun test ici n'asserte une valeur de résultat précise, seulement qu'un
 * résultat quelconque est apparu.
 */
test.describe('Campagnes — Désignation des épaves', () => {
  test('"Mis en épave seul" + "Favori du public" en solo', async ({ page, browser }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Epave',
      email: uniqueEmail('e2e-wreck-solo'),
      password: 'test1234',
    });

    // "Solo" désigne ici le véhicule (mis en épave seul, sans destructeur) —
    // pas le nombre de participants à la partie : une partie à un seul
    // participant est refusée dès l'écran Présence (`PresenceStep`, minimum
    // deux équipes cochées). Le second participant est un pur figurant, sans
    // véhicule.
    const teamName = 'Escouade Épave Solo';
    await createTeamWithVehicles(page, { name: teamName, vehicleNames: ['Camion à glaces'] });
    await createCampaign(page, { name: 'Saison E2E Épave Solo', teamName });

    const { teamName: joineeTeamName, context: joineeContext } = await addBystanderParticipant(page, browser, 'wreck-solo');

    await addGame(page);

    // ── Présence + écrans intermédiaires variables ──────────────────────────
    await page.getByRole('button', { name: '🎯 Saisir les rangs' }).click();
    await completePreDesignationSteps(page, [teamName, joineeTeamName]);

    // ── Désignation — "Mis en épave seul" + Favori du public ────────────────
    const vehicleItem = page.locator('.wds__item').filter({ hasText: 'Camion à glaces' });
    await expect(vehicleItem).toBeVisible();
    await designateWreck(page, 'Camion à glaces', 'alone');

    const favoriCheckbox = vehicleItem.locator('.wds__favori-checkbox');
    await expect(favoriCheckbox).toBeVisible();
    await expect(favoriCheckbox).toContainText('Favori du public (partie précédente)');
    await favoriCheckbox.locator('input[type="checkbox"]').check();

    const recordResultResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/results$/.test(r.url()),
    );
    await page.getByRole('button', { name: 'Suivant — résoudre les épaves' }).click();
    await recordResultResponse;

    // ── Résolution automatique — résultat quelconque, jamais précis ──
    await expect(page.locator('.wrs__outcome')).toBeVisible({ timeout: 15000 });
    const terminerButton = page.getByRole('button', { name: 'Terminer' });
    await expect(terminerButton).toBeEnabled({ timeout: 15000 });

    const enterAtelierResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/enter-atelier$/.test(r.url()),
    );
    await terminerButton.click();
    await enterAtelierResponse;

    await joineeContext.close();
  });

  test('"Détruit par…" désigne un AUTRE participant, jamais soi-même', async ({ page, browser }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Epave',
      email: uniqueEmail('e2e-wreck-destroyed-organizer'),
      password: 'test1234',
    });

    const organizerTeam = 'Escouade Attaquée';
    await createTeamWithVehicles(page, { name: organizerTeam, vehicleNames: ['Camion à glaces'] });
    const campaignId = await createCampaign(page, { name: 'Saison E2E Épave Duo', teamName: organizerTeam });

    const joineeTeam = 'Escouade Destructrice';
    const { joineeContext } = await inviteAndValidateParticipant(page, browser, {
      joineeUser: {
        firstName: 'Max',
        lastName: 'Rockatansky',
        email: uniqueEmail('e2e-wreck-destroyed-joinee'),
        password: 'test1234',
      },
      joineeTeamName: joineeTeam,
    });

    await page.goto(`/campaigns/${campaignId}`);
    await addGame(page);

    // ── Les deux équipes présentes + écrans intermédiaires variables ───────
    await page.getByRole('button', { name: '🎯 Saisir les rangs' }).click();
    await completePreDesignationSteps(page, [organizerTeam, joineeTeam]);

    // ── Le véhicule de l'organisateur est "Détruit par…" l'autre ────────────
    const vehicleItem = page.locator('.wds__item').filter({ hasText: 'Camion à glaces' });
    await vehicleItem.locator('label').filter({ hasText: 'Détruit par…' }).locator('input[type="radio"]').check();

    const destroyerSelect = vehicleItem.locator('select.wds__destroyer-select');
    await expect(destroyerSelect.locator('option', { hasText: joineeTeam })).toHaveCount(1);
    await expect(destroyerSelect.locator('option', { hasText: organizerTeam })).toHaveCount(0);
    await destroyerSelect.selectOption({ label: joineeTeam });

    const recordResultResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/results$/.test(r.url()),
    );
    await page.getByRole('button', { name: 'Suivant — résoudre les épaves' }).click();
    await recordResultResponse;

    // ── Résolution — résultat quelconque, badge du destructeur affiché ─────────
    const resolvedItem = page.locator('.wrs__item').filter({ hasText: 'Camion à glaces' });
    await expect(resolvedItem.locator('.wrs__destroyer-badge')).toContainText(joineeTeam);
    await expect(resolvedItem.locator('.wrs__outcome')).toBeVisible({ timeout: 15000 });

    const terminerButton = page.getByRole('button', { name: 'Terminer' });
    await expect(terminerButton).toBeEnabled({ timeout: 15000 });
    const enterAtelierResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/enter-atelier$/.test(r.url()),
    );
    await terminerButton.click();
    await enterAtelierResponse;

    await joineeContext.close();
  });
});
