import { test, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail } from './support/auth';
import { createTeamWithVehicles, openEquipmentManager, optionCard } from './support/teams';
import { createCampaign, addGame, runResultWizard, openAtelier, waitForEquipmentEvent } from './support/campaigns';

/**
 * Atelier campagne (boutique d'équipement à cagnotte dérivée) — cf.
 * docs/spec/CAMPAIGN.md "Annulation d'achat vs revente" et "Cagnotte dérivée".
 *
 * La cagnotte de départ = `team.remainingBudget` au moment de l'entrée en
 * campagne (pas de dotation séparée) — d'où le calcul explicite ci-dessous :
 * budget 50 par défaut, véhicule "Camion à glaces" = 8, arme "Mitrailleuse"
 * montée EN CONSTRUCTION D'ÉQUIPE (avant la campagne, donc "pré-existante"
 * du point de vue de l'atelier) = 2 → cagnotte de départ = 40.
 */
test.describe('Campagnes — Atelier', () => {
  test('achat Tourelle, annulation même session, revente pré-existante, achat amélioration', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Atelier',
      email: uniqueEmail('e2e-atelier-shop'),
      password: 'test1234',
    });

    const teamName = 'Escouade Boutique';
    await createTeamWithVehicles(page, { name: teamName, vehicleNames: ['Camion à glaces'] });

    // Arme montée AVANT la campagne — objet "pré-existant" du point de vue de
    // l'atelier, revendable à moitié prix (contrairement à un achat de la
    // session en cours, qui s'annule intégralement).
    await openEquipmentManager(page);
    const mitrailleuseOption = optionCard(page, 'Mitrailleuse');
    await mitrailleuseOption.getByRole('button', { name: 'Ajouter' }).click();
    await mitrailleuseOption.getByRole('button', { name: 'avant', exact: true }).click();
    await expect(page.locator('.me-item').filter({ hasText: 'Mitrailleuse' })).toBeVisible();

    const campaignId = await createCampaign(page, { name: 'Saison E2E Atelier Boutique', teamName });
    await addGame(page);
    await runResultWizard(page, { teamNames: [teamName] });

    await openAtelier(page);
    // Cagnotte de départ : 50 (budget) - 8 (véhicule) - 2 (Mitrailleuse) = 40.
    await expect(page.locator('.atp-wallet-value')).toHaveText('40 jerricans');

    await page.getByTestId('vehicle-card-manage').first().click();
    await expect(page).toHaveURL(/\/campaigns\/\d+\/atelier\/vehicles\/\d+$/);

    // ── Achat d'une arme montée sur Tourelle : coût ×3 (Minigun, prix 5 → 15) ──
    const minigunOption = optionCard(page, 'Minigun');
    await waitForEquipmentEvent(page, async () => {
      await minigunOption.getByRole('button', { name: 'Ajouter' }).click();
      await minigunOption.getByRole('button', { name: 'Tourelle x3' }).click();
    });
    const minigunItem = page.locator('.me-item').filter({ hasText: 'Minigun' });
    await expect(minigunItem).toBeVisible();
    await expect(minigunItem.getByText('(Tourelle)')).toBeVisible();

    await page.goto(`/campaigns/${campaignId}/atelier`);
    await expect(page.locator('.atp-wallet-value')).toHaveText('25 jerricans'); // 40 - 15

    // ── Annulation du même achat (session en cours) : remboursement intégral ──
    await page.getByTestId('vehicle-card-manage').first().click();
    const minigunItemAgain = page.locator('.me-item').filter({ hasText: 'Minigun' });
    await minigunItemAgain.getByRole('button', { name: 'Retirer' }).click();
    const cancelDialog = page.getByRole('dialog', { name: 'Annuler l\'achat de "Minigun" ?' });
    await expect(cancelDialog).toBeVisible();
    await waitForEquipmentEvent(page, () => cancelDialog.getByRole('button', { name: 'Retirer', exact: true }).click());
    await expect(page.locator('.me-item').filter({ hasText: 'Minigun' })).toHaveCount(0);

    await page.goto(`/campaigns/${campaignId}/atelier`);
    await expect(page.locator('.atp-wallet-value')).toHaveText('40 jerricans');

    // ── Revente de l'arme PRÉ-EXISTANTE (Mitrailleuse, moitié prix floor(2/2)=1) ──
    await page.getByTestId('vehicle-card-manage').first().click();
    const mitrailleuseItem = page.locator('.me-item').filter({ hasText: 'Mitrailleuse' });
    await mitrailleuseItem.getByRole('button', { name: 'Retirer' }).click();
    const resellDialog = page.getByRole('dialog', { name: 'Revendre "Mitrailleuse" pour 1 jerricans (50%) ?' });
    await expect(resellDialog).toBeVisible();
    await waitForEquipmentEvent(page, () => resellDialog.getByRole('button', { name: 'Retirer', exact: true }).click());
    // L'arme vendue est masquée par défaut (filtre "équipements vendus") —
    // reste consultable (barrée, badge "Vendu") via le bouton de bascule,
    // plutôt que disparaître — cf. docs/spec/CAMPAIGN.md, annulation vs revente.
    await page.locator('.me-toggle').click();
    await expect(page.locator('.me-item--sold').filter({ hasText: 'Mitrailleuse' })).toBeVisible();

    await page.goto(`/campaigns/${campaignId}/atelier`);
    await expect(page.locator('.atp-wallet-value')).toHaveText('41 jerricans'); // 40 + 1

    // ── Achat d'une amélioration (entityType IMPROVEMENT, Arceaux, prix 4) ──
    await page.getByTestId('vehicle-card-manage').first().click();
    const arceauxOption = optionCard(page, 'Arceaux');
    await waitForEquipmentEvent(page, () => arceauxOption.getByRole('button', { name: 'Ajouter' }).click());
    await expect(page.locator('.me-item').filter({ hasText: 'Arceaux' })).toBeVisible();

    await page.goto(`/campaigns/${campaignId}/atelier`);
    await expect(page.locator('.atp-wallet-value')).toHaveText('37 jerricans'); // 41 - 4
  });

  test('avantage : achat + annulation même session, puis revente pré-existante à perte totale', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Atelier',
      email: uniqueEmail('e2e-atelier-advantage'),
      password: 'test1234',
    });

    const teamName = 'Escouade Avantages';
    await createTeamWithVehicles(page, { name: teamName, vehicleNames: ['Camion à glaces'] });

    // Avantage acquis AVANT la campagne — "pré-existant" du point de vue de
    // l'atelier, revendu à PERTE TOTALE (contrairement à une arme/amélioration,
    // moitié prix) — cf. docs/spec/CAMPAIGN.md, Annulation d'achat vs revente.
    await openEquipmentManager(page);
    const tireurEliteOption = optionCard(page, 'Tireur d\'Élite');
    await tireurEliteOption.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.locator('.me-item').filter({ hasText: 'Tireur d\'Élite' })).toBeVisible();

    const campaignId = await createCampaign(page, { name: 'Saison E2E Atelier Avantages', teamName });
    await addGame(page);
    await runResultWizard(page, { teamNames: [teamName] });

    await openAtelier(page);
    // Cagnotte de départ : 50 (budget) - 8 (véhicule) - 2 (Tireur d'Élite) = 40.
    await expect(page.locator('.atp-wallet-value')).toHaveText('40 jerricans');

    await page.getByTestId('vehicle-card-manage').first().click();

    // ── Achat d'un second avantage (session en cours), Baril de Poudre (prix 1) ──
    const barilOption = optionCard(page, 'Baril de Poudre');
    await waitForEquipmentEvent(page, () => barilOption.getByRole('button', { name: 'Ajouter' }).click());
    await expect(page.locator('.me-item').filter({ hasText: 'Baril de Poudre' })).toBeVisible();

    await page.goto(`/campaigns/${campaignId}/atelier`);
    await expect(page.locator('.atp-wallet-value')).toHaveText('39 jerricans'); // 40 - 1

    // ── Annulation du même achat (session en cours) : remboursement intégral ──
    await page.getByTestId('vehicle-card-manage').first().click();
    const barilItemAgain = page.locator('.me-item').filter({ hasText: 'Baril de Poudre' });
    await barilItemAgain.getByRole('button', { name: 'Retirer' }).click();
    const cancelDialog = page.getByRole('dialog', { name: 'Annuler l\'achat de "Baril de Poudre" ?' });
    await expect(cancelDialog).toBeVisible();
    await waitForEquipmentEvent(page, () => cancelDialog.getByRole('button', { name: 'Retirer', exact: true }).click());
    await expect(page.locator('.me-item').filter({ hasText: 'Baril de Poudre' })).toHaveCount(0);

    await page.goto(`/campaigns/${campaignId}/atelier`);
    await expect(page.locator('.atp-wallet-value')).toHaveText('40 jerricans');

    // ── Revente de l'avantage PRÉ-EXISTANT (Tireur d'Élite) : PERTE TOTALE ──
    await page.getByTestId('vehicle-card-manage').first().click();
    const tireurEliteItem = page.locator('.me-item').filter({ hasText: 'Tireur d\'Élite' });
    await tireurEliteItem.getByRole('button', { name: 'Retirer' }).click();
    const resellDialog = page.getByRole(
      'dialog',
      { name: 'Revendre "Tireur d\'Élite" ? Le prix total (2 jerricans) est perdu, aucun remboursement.' },
    );
    await expect(resellDialog).toBeVisible();
    await waitForEquipmentEvent(page, () => resellDialog.getByRole('button', { name: 'Retirer', exact: true }).click());
    await page.locator('.me-toggle').click();
    await expect(page.locator('.me-item--sold').filter({ hasText: 'Tireur d\'Élite' })).toBeVisible();

    await page.goto(`/campaigns/${campaignId}/atelier`);
    // Aucun remboursement — la cagnotte reste à 40 (contrairement à la moitié-prix
    // récupérée pour une arme/amélioration revendue).
    await expect(page.locator('.atp-wallet-value')).toHaveText('40 jerricans');
  });

  test('grille AtelierPage — plusieurs véhicules, bouton d\'ajout de véhicule présent', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Atelier',
      email: uniqueEmail('e2e-atelier-grid'),
      password: 'test1234',
    });

    const teamName = 'Escouade Garage';
    await createTeamWithVehicles(page, { name: teamName, vehicleNames: ['Camion à glaces', 'Ambulance'] });

    await createCampaign(page, { name: 'Saison E2E Atelier Garage', teamName });
    await addGame(page);
    await runResultWizard(page, { teamNames: [teamName] });

    await openAtelier(page);
    await expect(page.locator('.atp-vehicles-grid app-vehicle-summary-card')).toHaveCount(2);

    // Achat de véhicule désormais possible en atelier (cf. tests dédiés ci-dessous
    // pour le flux complet achat/annulation/revente) — le bouton est bien présent.
    await expect(page.getByRole('button', { name: /AJOUTER UN VÉHICULE/i })).toBeVisible();

    await page.getByTestId('vehicle-card-manage').nth(1).click();
    await expect(page).toHaveURL(/\/campaigns\/\d+\/atelier\/vehicles\/\d+$/);
  });

  test('achat d\'un véhicule en atelier, équipement dans la même session, puis annulation cascade intégrale', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Atelier',
      email: uniqueEmail('e2e-atelier-buy-cancel'),
      password: 'test1234',
    });

    const teamName = 'Escouade Achat';
    await createTeamWithVehicles(page, { name: teamName, vehicleNames: ['Camion à glaces'] });

    const campaignId = await createCampaign(page, { name: 'Saison E2E Atelier Achat', teamName });
    await addGame(page);
    await runResultWizard(page, { teamNames: [teamName] });

    await openAtelier(page);
    // Cagnotte de départ : 50 (budget) - 8 (Camion à glaces, sans équipement) = 42.
    await expect(page.locator('.atp-wallet-value')).toHaveText('42 jerricans');

    // ── Achat d'un second véhicule (Ambulance, prix 20) ──
    await page.getByRole('button', { name: /AJOUTER UN VÉHICULE/i }).click();
    const ambulanceCard = page.locator('.choice-card').filter({ hasText: 'Ambulance' });
    await waitForEquipmentEvent(page, () => ambulanceCard.getByRole('button', { name: 'Choisir ce véhicule' }).click());
    await expect(page.locator('.atp-vehicles-grid app-vehicle-summary-card')).toHaveCount(2);
    await expect(page.locator('.atp-wallet-value')).toHaveText('22 jerricans'); // 42 - 20

    // ── Équipement de ce véhicule DANS LA MÊME SESSION (arme + amélioration) ──
    // L'Ambulance vient d'être ajoutée en fin de liste (index 1). Son id est
    // TRANSIENT et négatif (-eventId, D-S11) — d'où le `-?` dans la regex,
    // absent des autres routes de ce fichier qui ciblent des véhicules pré-existants.
    await page.getByTestId('vehicle-card-manage').nth(1).click();
    await expect(page).toHaveURL(/\/campaigns\/\d+\/atelier\/vehicles\/-?\d+$/);

    const mitrailleuseOption = optionCard(page, 'Mitrailleuse');
    await waitForEquipmentEvent(page, async () => {
      await mitrailleuseOption.getByRole('button', { name: 'Ajouter' }).click();
      await mitrailleuseOption.getByRole('button', { name: 'avant', exact: true }).click();
    });
    const arceauxOption = optionCard(page, 'Arceaux');
    await waitForEquipmentEvent(page, () => arceauxOption.getByRole('button', { name: 'Ajouter' }).click());

    await page.goto(`/campaigns/${campaignId}/atelier`);
    // 22 - 2 (Mitrailleuse) - 4 (Arceaux) = 16.
    await expect(page.locator('.atp-wallet-value')).toHaveText('16 jerricans');

    // ── Annulation cascade : retirer le véhicule acheté cette session rembourse
    // INTÉGRALEMENT tout ce qui a été dépensé dessus (véhicule + arme +
    // amélioration), sans laisser d'événement orphelin dans le journal — cf.
    // Game.collectSessionEventsForVehicle.
    await expect(page.locator('.atp-vehicles-grid app-vehicle-summary-card')).toHaveCount(2);
    await page.getByTestId('vehicle-card-delete').nth(1).click();
    const cancelDialog = page.getByRole('dialog', { name: 'Annuler l\'achat de ce véhicule ?' });
    await expect(cancelDialog).toBeVisible();
    await waitForEquipmentEvent(page, () => cancelDialog.getByRole('button', { name: 'Annuler l\'achat' }).click());

    await expect(page.locator('.atp-vehicles-grid app-vehicle-summary-card')).toHaveCount(1);
    await expect(page.locator('.atp-wallet-value')).toHaveText('42 jerricans'); // remboursement intégral

    // Le reste du journal (Camion à glaces initial) doit rester consultable —
    // preuve que la cascade n'a pas cassé le replay de la campagne.
    await page.reload();
    await expect(page.locator('.atp-vehicles-grid app-vehicle-summary-card')).toHaveCount(1);
    await expect(page.locator('.atp-wallet-value')).toHaveText('42 jerricans');
  });

  test('revente d\'un véhicule pré-existant en atelier — règle par élément (moitié prix)', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Atelier',
      email: uniqueEmail('e2e-atelier-sell-vehicle'),
      password: 'test1234',
    });

    const teamName = 'Escouade Revente';
    await createTeamWithVehicles(page, { name: teamName, vehicleNames: ['Camion à glaces'] });

    // Arme + amélioration montées AVANT la campagne — "pré-existantes" du point
    // de vue de l'atelier, chacune remboursée à moitié prix lors de la revente
    // du véhicule ENTIER (cf. Vehicle.resaleRefund).
    await openEquipmentManager(page);
    const mitrailleuseOption = optionCard(page, 'Mitrailleuse');
    await mitrailleuseOption.getByRole('button', { name: 'Ajouter' }).click();
    await mitrailleuseOption.getByRole('button', { name: 'avant', exact: true }).click();
    const arceauxOption = optionCard(page, 'Arceaux');
    await arceauxOption.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.locator('.me-item').filter({ hasText: 'Mitrailleuse' })).toBeVisible();
    await expect(page.locator('.me-item').filter({ hasText: 'Arceaux' })).toBeVisible();

    await createCampaign(page, { name: 'Saison E2E Atelier Revente Véhicule', teamName });
    await addGame(page);
    await runResultWizard(page, { teamNames: [teamName] });

    await openAtelier(page);
    // Cagnotte de départ : 50 - 8 (véhicule) - 2 (Mitrailleuse) - 4 (Arceaux) = 36.
    await expect(page.locator('.atp-wallet-value')).toHaveText('36 jerricans');

    await page.getByTestId('vehicle-card-delete').first().click();
    const sellDialog = page.getByRole('dialog', { name: 'Vendre ce véhicule ?' });
    await expect(sellDialog).toBeVisible();
    // floor(8/2) châssis + floor(2/2) Mitrailleuse + floor(4/2) Arceaux = 4 + 1 + 2 = 7.
    await expect(sellDialog.locator('.svm-modal__refund-amount')).toContainText('7');
    await waitForEquipmentEvent(page, () => sellDialog.getByRole('button', { name: 'Vendre', exact: true }).click());

    await expect(page.locator('.atp-vehicles-grid app-vehicle-summary-card')).toHaveCount(0);
    await expect(page.locator('.atp-wallet-value')).toHaveText('43 jerricans'); // 36 + 7
  });
});
