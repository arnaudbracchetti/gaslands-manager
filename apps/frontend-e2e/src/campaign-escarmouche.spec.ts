import { test, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail } from './support/auth';
import { createTeam } from './support/teams';
import { createCampaign, addGame, addBystanderParticipant } from './support/campaigns';

/**
 * Wizard de fin de partie — parcours Escarmouche, de bout en bout.
 *
 * Couverture jusqu'ici manquante (cf. session de refonte du wizard à étapes
 * variables, `docs/plans/2026-07-17-wizard-fin-partie-e-et-design.md`) :
 * tous les autres specs Campaigns exercent uniquement le scénario par défaut
 * (`course_de_la_mort`, Événement Télévisé) via `addGame()`/`runResultWizard()`.
 * Une Escarmouche n'a NI classement NI portes — l'écran Présence enchaîne
 * directement sur l'écran Jerricans (si le scénario porte `gain_jerricans`,
 * ex. "Pillage de Convoi", 7ᵉ scénario du catalogue) puis Désignation, et
 * l'écran Résolution y ajoute un tirage de revenu D6 par participant présent
 * (`POST .../events/income`) avant les éventuels tirages d'épave.
 *
 * Comme pour la Table des Épaves, le tirage de revenu est non déterministe
 * côté serveur (`Math.random()`) — aucune assertion sur sa valeur exacte,
 * seulement qu'un résultat quelconque est apparu (cf. WRITING.md).
 *
 * Deux participants engagés (une partie à un seul participant est refusée
 * dès l'écran Présence, cf. `PresenceStep` — minimum deux équipes cochées).
 * Le second est un pur figurant (`addBystanderParticipant`, sans véhicule) :
 * l'écran Désignation n'a rien à afficher (mêmes raisons que
 * `campaign-program.spec.ts`), ce qui isole le test sur ce qui est nouveau
 * (saut des écrans Classement/Portes, écran Jerricans, revenu de base) sans
 * dupliquer la couverture déjà assurée par `campaign-wreck-designation.spec.ts`.
 */
test.describe('Campagnes — Wizard de fin de partie (Escarmouche)', () => {
  test('présence → jerricans (pas de classement ni portes) → désignation vide → revenu D6 → atelier', async ({ page, browser }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Pillarde',
      email: uniqueEmail('e2e-escarmouche-happy'),
      password: 'test1234',
    });

    const teamName = 'Escouade Pillarde';
    await createTeam(page, teamName);
    await createCampaign(page, { name: 'Saison E2E Escarmouche', teamName });
    const { teamName: joineeTeamName, context: joineeContext } = await addBystanderParticipant(page, browser, 'escarmouche-happy');
    // Scénario n°7 du catalogue (database_init/data/scenarios.yml) : "Pillage
    // de Convoi", ESCARMOUCHE avec gain_jerricans: true.
    await addGame(page, { scenarioIndex: 7 });

    await page.getByRole('button', { name: '🎯 Saisir les rangs' }).click();

    // ── Écran Présence : deux équipes cochées (minimum requis) ──────────────
    await page.locator('.pst__participant-row').filter({ hasText: teamName }).locator('input[type="checkbox"]').check();
    await page.locator('.pst__participant-row').filter({ hasText: joineeTeamName }).locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();

    // ── Écran Jerricans directement (ni Classement ni Portes pour une Escarmouche) ──
    await expect(page.locator('.jst__hint')).toBeVisible();
    const jerricanRow = page.locator('.jst__item').filter({ hasText: teamName });
    await jerricanRow.locator('.jst__input').fill('5');
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();

    // ── Écran Désignation : aucun véhicule dans aucune des deux équipes ─────
    await expect(page.locator('.wds__empty')).toBeVisible();

    const recordResultResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/results$/.test(r.url()),
    );
    await page.getByRole('button', { name: 'Suivant — résoudre les épaves' }).click();
    await recordResultResponse;

    // ── Écran Résolution : revenu de base D6, un par participant présent ───
    const incomeItem = page.locator('.wrs__income .wrs__item').filter({ hasText: teamName });
    await expect(incomeItem.locator('.wrs__outcome-result')).toContainText('jerricans', { timeout: 15000 });
    const bystanderIncomeItem = page.locator('.wrs__income .wrs__item').filter({ hasText: joineeTeamName });
    await expect(bystanderIncomeItem.locator('.wrs__outcome-result')).toContainText('jerricans', { timeout: 15000 });
    // Aucun véhicule désigné : pas de tirage d'épave à attendre, seuls les
    // deux revenus conditionnent "Terminer".
    await expect(page.locator('.wrs__wrecks .wrs__item')).toHaveCount(0);

    const terminerButton = page.getByRole('button', { name: 'Terminer' });
    await expect(terminerButton).toBeEnabled({ timeout: 15000 });

    const enterAtelierResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/enter-atelier$/.test(r.url()),
    );
    await terminerButton.click();
    await enterAtelierResponse;

    const gameItem = page.locator('.game-list__item').first();
    await expect(gameItem.locator('.game-list__badge--status')).toHaveText('Atelier');

    await joineeContext.close();
  });

  test('"Annuler" à l\'écran Résolution réinitialise la partie côté serveur', async ({ page, browser }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Hesitante',
      email: uniqueEmail('e2e-escarmouche-cancel'),
      password: 'test1234',
    });

    const teamName = 'Escouade Hésitante';
    await createTeam(page, teamName);
    await createCampaign(page, { name: 'Saison E2E Escarmouche Annulation', teamName });
    const { teamName: joineeTeamName, context: joineeContext } = await addBystanderParticipant(page, browser, 'escarmouche-cancel');
    await addGame(page, { scenarioIndex: 7 }); // Pillage de Convoi (gain_jerricans)

    const gameItem = page.locator('.game-list__item').first();

    await page.getByRole('button', { name: '🎯 Saisir les rangs' }).click();
    await page.locator('.pst__participant-row').filter({ hasText: teamName })
      .locator('input[type="checkbox"]').check();
    await page.locator('.pst__participant-row').filter({ hasText: joineeTeamName })
      .locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();

    // Aucun butin saisi — 0 par défaut, ce test porte sur l'annulation, pas la valeur.
    await expect(page.locator('.jst__hint')).toBeVisible();
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();

    await expect(page.locator('.wds__empty')).toBeVisible();
    const recordResultResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/results$/.test(r.url()),
    );
    await page.getByRole('button', { name: 'Suivant — résoudre les épaves' }).click();
    await recordResultResponse;

    // Écran Résolution atteint — le lot (jerricanGains) est déjà persisté.
    await expect(page.locator('.wrs__income .wrs__item').first()).toBeVisible();

    const resetResponse = page.waitForResponse(
      (r) => r.request().method() === 'DELETE' && /\/api\/campaigns\/\d+\/games\/\d+\/results$/.test(r.url()),
    );
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await resetResponse;

    // Le wizard se ferme, la partie reste (redevient) "Planifiée" — jamais
    // passée en Atelier puisque "Terminer" n'a jamais été cliqué.
    await expect(page.locator('.grw-overlay')).toHaveCount(0);
    await expect(gameItem.locator('.game-list__badge--status')).toHaveText('Planifiée');

    // Rouvrir le wizard démarre un parcours vierge (aucun résidu du lot annulé) :
    // preuve que le reset serveur a bien vidé le journal, pas seulement fermé la pop-up.
    await page.getByRole('button', { name: '🎯 Saisir les rangs' }).click();
    await expect(page.locator('.pst__participant-row').filter({ hasText: teamName })).toBeVisible();

    await joineeContext.close();
  });
});
