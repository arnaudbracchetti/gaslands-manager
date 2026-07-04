import { test, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail } from './support/auth';
import { createTeam, addVehicle, setSponsor, openEquipmentManager, saveAndWait } from './support/teams';

/**
 * Flux pilote e2e : Teams + création d'un véhicule.
 *
 * Sert de preuve de concept pour le socle e2e (DB de test "gaslands_test",
 * backend dédié, helpers d'auth — cf. src/support/). Le pattern est
 * réutilisable tel quel pour de futurs specs Vehicles/Campagnes.
 *
 * La base "gaslands_test" est vidée par global-setup.ts avant le run —
 * un email fixe suffit, pas besoin d'horodatage pour éviter les collisions.
 */
test.describe('Teams — flux pilote', () => {
  test('crée une équipe, la renomme, et lui ajoute un véhicule', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Max',
      lastName: 'Rockatansky',
      email: 'e2e-teams@test.local',
      password: 'test1234',
    });

    // ── Création rapide d'une équipe (valeurs par défaut, cf. Teams.createAndEdit()) ──
    await page.goto('/teams');
    await page.getByRole('button', { name: /Nouvelle équipe/ }).click();
    await expect(page).toHaveURL(/\/teams\/\d+\/edit/);

    // ── Renommage — sauvegarde automatique au blur (pas de bouton "Enregistrer") ──
    const teamName = 'Escouade Furiosa';
    const nameInput = page.getByLabel("Nom de l'équipe");
    await nameInput.fill(teamName);
    // saveAndWait : attend la réponse PUT avant de recharger — un blur() seul
    // n'offre aucun signal de sauvegarde (pas de bouton "Enregistrer"), et un
    // reload() immédiat peut le devancer sous charge (plusieurs workers
    // Playwright contre le même backend de test).
    await saveAndWait(page, () => nameInput.blur());

    // La persistance se vérifie par un rechargement complet de la page.
    await page.reload();
    await expect(page.getByLabel("Nom de l'équipe")).toHaveValue(teamName);

    // ── Le nom mis à jour apparaît bien dans la liste des équipes ──
    await page.goto('/teams');
    await expect(page.getByText(teamName)).toBeVisible();

    // ── Retour sur la page d'édition pour ajouter un véhicule ──
    await page.getByText(teamName).click();
    await expect(page).toHaveURL(/\/teams\/\d+\/edit/);

    await page.getByRole('button', { name: /AJOUTER UN VÉHICULE/i }).click();
    // Premier véhicule de l'équipe → modale d'avertissement de verrouillage du sponsor.
    // exact: true — sans quoi "Ajouter un véhicule" matche aussi en sous-chaîne
    // le bouton "+ AJOUTER UN VÉHICULE" resté affiché sous l'overlay.
    await page.getByRole('button', { name: 'Ajouter un véhicule', exact: true }).click();

    await expect(page).toHaveURL(/\/teams\/\d+\/vehicles\/new/);
    await page.getByRole('button', { name: 'Choisir ce véhicule' }).first().click();

    // Le configurateur bascule sur la gestion d'équipement du véhicule "nu" créé.
    await expect(page.getByRole('button', { name: 'Terminer' })).toBeVisible();
    await page.getByRole('button', { name: 'Terminer' }).click();

    // ── De retour sur l'édition d'équipe : le véhicule apparaît dans la liste ──
    await expect(page).toHaveURL(/\/teams\/\d+\/edit/);
    await expect(page.getByText('Aucun véhicule dans cette équipe.')).not.toBeVisible();
    await expect(page.locator('.tep-vehicle-card')).toHaveCount(1);
  });
});

/**
 * CRUD équipe/véhicule — cycle de vie complet au-delà du flux pilote.
 *
 * Chaque test enregistre son propre utilisateur (email unique — `gaslands_test`
 * n'est vidée qu'une fois par run entier, cf. global-setup.ts). La liste `/teams`
 * étant filtrée par `userId` côté backend (cf. TEAMS.md), un utilisateur frais
 * par test suffit à isoler les assertions sans avoir besoin de noms d'équipe
 * uniques en plus.
 */
test.describe('Teams — cycle de vie équipe/véhicule', () => {
  test("modifie le sponsor, la description et le budget d'une équipe sans véhicule", async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-teams-fields'),
      password: 'test1234',
    });

    await createTeam(page);
    await setSponsor(page, 'Miyazaki');

    const description = 'Escouade spécialisée dans la précision et le drift.';
    const descriptionInput = page.getByLabel('Description');
    await descriptionInput.fill(description);
    await saveAndWait(page, () => descriptionInput.blur());

    const cansInput = page.getByLabel('Budget (Jerricans)');
    await cansInput.fill('75');
    await saveAndWait(page, () => cansInput.blur());

    // La persistance des trois champs se vérifie par un rechargement complet.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Miyazaki', exact: true })).toBeVisible();
    await expect(page.getByLabel('Description')).toHaveValue(description);
    await expect(page.getByLabel('Budget (Jerricans)')).toHaveValue('75');
  });

  test('verrouille le sponsor dès l\'ajout du premier véhicule et bloque sa modification', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-teams-lock'),
      password: 'test1234',
    });

    await createTeam(page);

    await page.getByRole('button', { name: /AJOUTER UN VÉHICULE/i }).click();
    // Sponsor par défaut du catalogue (premier de la liste, cf. Teams.createAndEdit) = Rutherford.
    await expect(
      page.getByText(/Le sponsor Rutherford sera définitivement verrouillé/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter un véhicule', exact: true }).click();

    await expect(page).toHaveURL(/\/teams\/\d+\/vehicles\/new/);
    await page.locator('.choice-card').first().getByRole('button', { name: 'Choisir ce véhicule' }).click();
    await page.getByRole('button', { name: 'Terminer' }).click();
    await expect(page).toHaveURL(/\/teams\/\d+\/edit/);

    // ── Verrouillage : badge visible, navigation du carousel désactivée ──
    await expect(page.getByText(/Sponsor verrouillé/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sponsor précédent' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Sponsor suivant' })).toBeDisabled();
    await expect(page.getByRole('tab', { name: 'Rutherford' })).toBeDisabled();

    // Persiste après rechargement.
    await page.reload();
    await expect(page.getByText(/Sponsor verrouillé/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rutherford', exact: true })).toBeVisible();
  });

  test("supprime un véhicule et déverrouille le sponsor si c'était le dernier", async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-teams-unlock'),
      password: 'test1234',
    });

    await createTeam(page);
    await addVehicle(page);
    await expect(page.getByText(/Sponsor verrouillé/)).toBeVisible();

    await page.getByTestId('vehicle-card-delete').click();
    // Scopé au dialog : le bouton "🗑 Supprimer l'équipe" reste dans le DOM
    // sous l'overlay et matcherait aussi "Supprimer" en sous-chaîne sinon.
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();

    await expect(page.getByText('Aucun véhicule dans cette équipe.')).toBeVisible();
    await expect(page.getByText(/Sponsor verrouillé/)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Sponsor suivant' })).toBeEnabled();
  });

  test('supprime une équipe et vérifie la suppression en cascade de ses véhicules', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-teams-delete'),
      password: 'test1234',
    });

    const teamName = 'Escouade Cascade';
    await createTeam(page, teamName);
    await addVehicle(page);
    await addVehicle(page);
    await expect(page.locator('.tep-vehicle-card')).toHaveCount(2);

    await page.getByRole('button', { name: /Supprimer l'équipe/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();

    await expect(page).toHaveURL(/\/teams$/);
    await expect(page.getByText(teamName)).toBeHidden();
  });

  test('édite un véhicule déjà existant en rouvrant le configurateur', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-teams-reopen'),
      password: 'test1234',
    });

    await createTeam(page);
    await addVehicle(page);

    // Mode édition (vehicleId numérique dans l'URL, pas "new") → bouton "Fermer".
    await openEquipmentManager(page);
    await expect(page.getByRole('button', { name: 'Fermer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Terminer' })).toBeHidden();
  });

  test('annule l\'ajout du 1er véhicule et le sponsor reste modifiable', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-teams-cancel'),
      password: 'test1234',
    });

    await createTeam(page);

    await page.getByRole('button', { name: /AJOUTER UN VÉHICULE/i }).click();
    await page.getByRole('button', { name: 'Annuler' }).click();

    await expect(page).toHaveURL(/\/teams\/\d+\/edit/);
    await expect(page.getByText('Aucun véhicule dans cette équipe.')).toBeVisible();
    await expect(page.getByText(/Sponsor verrouillé/)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Sponsor suivant' })).toBeEnabled();
  });
});
