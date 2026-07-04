import { test, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail } from './support/auth';
import { createTeam, createTeamWithVehicles, addVehicle, openEquipmentManager, optionCard, saveAndWait } from './support/teams';

/**
 * Gestion de l'équipement d'un véhicule — armes, améliorations, cas particulier
 * de la Tourelle et garde de budget (EquipmentManager, cf. COMPONENTS.md).
 *
 * Véhicule par défaut utilisé : "Camion à glaces" — premier véhicule autorisé
 * pour Rutherford (sponsor par défaut du catalogue, cf. teams.spec.ts) qui
 * n'exige pas de sponsor dédié comme le Char d'assaut. Prix 8, 2 emplacements —
 * suffisant pour monter une arme + une amélioration sans dépasser le budget
 * par défaut (50 jerricans).
 *
 * Chaque test enregistre son propre utilisateur (email unique) — cf.
 * teams.spec.ts pour le raisonnement sur l'isolation par `userId`.
 */
test.describe('Vehicle equipment — armes, améliorations, Tourelle, budget', () => {
  test('ajoute une arme avec orientation et la retrouve montée', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-add-weapon'),
      password: 'test1234',
    });

    await createTeamWithVehicles(page, { vehicleNames: ['Camion à glaces'] });
    await openEquipmentManager(page);

    const mitrailleuseOption = optionCard(page, 'Mitrailleuse');
    await mitrailleuseOption.getByRole('button', { name: 'Ajouter' }).click();

    // Sélecteur d'orientation affiché — arme de type "base", orientable.
    await expect(mitrailleuseOption.getByRole('button', { name: 'avant', exact: true })).toBeVisible();
    await mitrailleuseOption.getByRole('button', { name: 'avant', exact: true }).click();

    const mountedWeapon = page.locator('.me-item').filter({ hasText: 'Mitrailleuse' });
    await expect(mountedWeapon).toBeVisible();
    await expect(mountedWeapon.getByText('(avant)')).toBeVisible();
    await expect(page.getByText('Armes (1)')).toBeVisible();
  });

  test('retire une arme montée avec confirmation', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-remove-weapon'),
      password: 'test1234',
    });

    await createTeamWithVehicles(page, { vehicleNames: ['Camion à glaces'] });
    await openEquipmentManager(page);

    const mitrailleuseOption = optionCard(page, 'Mitrailleuse');
    await mitrailleuseOption.getByRole('button', { name: 'Ajouter' }).click();
    await mitrailleuseOption.getByRole('button', { name: 'avant', exact: true }).click();
    await expect(page.getByText('Armes (1)')).toBeVisible();

    await page.locator('.me-item').filter({ hasText: 'Mitrailleuse' }).getByRole('button', { name: 'Retirer' }).click();
    // Scopé au dialog : le bouton "Retirer" de mounted-equipment reste dans le
    // DOM sous l'overlay et porte le même libellé exact que celui de confirmation.
    await page.getByRole('dialog').getByRole('button', { name: 'Retirer', exact: true }).click();

    await expect(page.getByText('Armes (0)')).toBeVisible();
    await expect(page.getByText('Aucune arme montée.')).toBeVisible();
  });

  test('ajoute puis retire une amélioration non-Tourelle', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-improvement'),
      password: 'test1234',
    });

    await createTeamWithVehicles(page, { vehicleNames: ['Camion à glaces'] });
    await openEquipmentManager(page);

    const arceauxOption = optionCard(page, 'Arceaux');
    await arceauxOption.getByRole('button', { name: 'Ajouter' }).click();

    const mountedImprovement = page.locator('.me-item').filter({ hasText: 'Arceaux' });
    await expect(mountedImprovement).toBeVisible();
    await expect(page.getByText('Améliorations (1)')).toBeVisible();

    await mountedImprovement.getByRole('button', { name: 'Retirer', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Retirer', exact: true }).click();

    await expect(page.getByText('Améliorations (0)')).toBeVisible();
    await expect(page.getByText('Aucune amélioration installée.')).toBeVisible();
  });

  test("une amélioration par défaut (estDefaut) ne peut pas être retirée", async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-defaut'),
      password: 'test1234',
    });

    // Char d'assaut (Rutherford, sponsor par défaut) porte une Tourelle intégrée
    // (`estDefaut: true`, cf. VEHICLES.md — "Améliorations par défaut").
    await createTeamWithVehicles(page, { vehicleNames: ["Char d'assaut"] });
    await openEquipmentManager(page);

    const tourelleOrpheline = page.locator('.me-item--tourelle-orpheline');
    await expect(tourelleOrpheline).toBeVisible();
    await expect(tourelleOrpheline.getByText('🔒 Intégré')).toBeVisible();
    await expect(tourelleOrpheline.getByRole('button', { name: 'Retirer', exact: true })).toHaveCount(0);
  });

  test('assigne une arme à une Tourelle orpheline et vérifie le coût x3', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-tourelle-assign'),
      password: 'test1234',
    });

    // Char d'assaut a bien une Tourelle orpheline dès la création, mais elle est
    // `estDefaut: true` — son prix reste TOUJOURS 0 une fois l'arme assignée
    // (`Improvement.price` renvoie 0 avant même de regarder `weaponAssignee`,
    // cf. backend `domain/improvement.ts`). Pour vérifier la règle de coût ×3,
    // il faut une Tourelle ACHETÉE (non estDefaut) — cf. Camion à glaces ici,
    // même montage que le test "retire une Tourelle achetée" ci-dessous.
    await createTeamWithVehicles(page, { vehicleNames: ['Camion à glaces'] });
    await openEquipmentManager(page);

    await optionCard(page, 'Tourelle').getByRole('button', { name: 'Ajouter' }).click();
    await page.locator('.me-item--tourelle-orpheline').getByRole('button', { name: 'Assigner une arme' }).click();

    await expect(page.getByRole('dialog', { name: "Choisir l'arme de la Tourelle" })).toBeVisible();
    const mitrailleuseChoice = page.getByTestId('tam-weapon-mitrailleuse');
    // Prix affiché = 3 × le prix catalogue de l'arme (2 🛢️ → 6 🛢️, cf. amelioration.yml/armes.yml).
    await expect(mitrailleuseChoice).toContainText('6');
    await mitrailleuseChoice.click();

    const assignedTourelle = page.locator('.me-item--tourelle');
    await expect(assignedTourelle).toBeVisible();
    await expect(assignedTourelle.getByText('Mitrailleuse')).toBeVisible();
    await expect(assignedTourelle.getByText('(Tourelle)')).toBeVisible();
    // improvement.prix = 3 × prix de l'arme montée — coût total, arme incluse.
    await expect(assignedTourelle).toContainText('6');
  });

  test("désassigne une arme d'une Tourelle", async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-tourelle-unassign'),
      password: 'test1234',
    });

    await createTeamWithVehicles(page, { vehicleNames: ['Camion à glaces'] });
    await openEquipmentManager(page);

    await optionCard(page, 'Tourelle').getByRole('button', { name: 'Ajouter' }).click();
    await page.locator('.me-item--tourelle-orpheline').getByRole('button', { name: 'Assigner une arme' }).click();
    await page.getByTestId('tam-weapon-mitrailleuse').click();
    await expect(page.locator('.me-item--tourelle')).toBeVisible();

    await page.locator('.me-item--tourelle').getByRole('button', { name: 'Désassigner' }).click();

    const tourelleOrpheline = page.locator('.me-item--tourelle-orpheline');
    await expect(tourelleOrpheline).toBeVisible();
    await expect(tourelleOrpheline.getByText('⚠ Aucune arme assignée')).toBeVisible();
    await expect(tourelleOrpheline.getByRole('button', { name: 'Assigner une arme' })).toBeVisible();
  });

  test('retire une Tourelle achetée (non estDefaut) entièrement', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-tourelle-remove'),
      password: 'test1234',
    });

    // Camion à glaces n'a PAS de Tourelle intégrée — celle-ci sera achetée
    // (estDefaut: false), donc entièrement retirable.
    await createTeamWithVehicles(page, { vehicleNames: ['Camion à glaces'] });
    await openEquipmentManager(page);

    const tourelleOption = optionCard(page, 'Tourelle');
    await tourelleOption.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText('Améliorations (1)')).toBeVisible();

    await page.locator('.me-item--tourelle-orpheline').getByRole('button', { name: 'Assigner une arme' }).click();
    await page.getByTestId('tam-weapon-mitrailleuse').click();

    const assignedTourelle = page.locator('.me-item--tourelle');
    await expect(assignedTourelle).toBeVisible();
    // Tourelle ACHETÉE (pas estDefaut) → bouton "Retirer la Tourelle" disponible,
    // en plus de "Désassigner" (cf. mounted-equipment.html).
    await assignedTourelle.getByRole('button', { name: 'Retirer la Tourelle' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Retirer', exact: true }).click();

    await expect(page.getByText('Améliorations (0)')).toBeVisible();
    await expect(page.getByText('Aucune amélioration installée.')).toBeVisible();
    // L'arme n'a jamais existé comme entité Weapon séparée — rien à nettoyer côté "Armes".
    await expect(page.getByText('Armes (0)')).toBeVisible();
  });

  test('le budget de l\'équipe empêche l\'ajout d\'un équipement trop cher', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-budget'),
      password: 'test1234',
    });

    await createTeam(page);
    const cansInput = page.getByLabel('Budget (Jerricans)');
    await cansInput.fill('0');
    await saveAndWait(page, () => cansInput.blur());

    // Camion à glaces coûte déjà 8 — le budget (0) est dépassé dès l'ajout du véhicule.
    await addVehicle(page, { vehicleName: 'Camion à glaces' });
    await openEquipmentManager(page);

    await page.getByRole('button', { name: /Afficher les indisponibles/ }).click();

    const mitrailleuseOption = optionCard(page, 'Mitrailleuse');
    await expect(mitrailleuseOption.getByText(/Budget de l'équipe insuffisant/)).toBeVisible();
    await expect(mitrailleuseOption.getByRole('button', { name: 'Ajouter' })).toHaveCount(0);
  });

  test("ouvre la modale de détail d'un équipement sans l'ajouter", async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-detail'),
      password: 'test1234',
    });

    await createTeamWithVehicles(page, { vehicleNames: ['Camion à glaces'] });
    await openEquipmentManager(page);

    // Clic sur le NOM (zone de la carte), pas sur le bouton "+" — ouvre la popup
    // de détail sans déclencher l'ajout (cf. equipment-option.html, doc de openDetails).
    await optionCard(page, 'Mitrailleuse').locator('.option__name').click();

    const dialog = page.getByRole('dialog', { name: 'Mitrailleuse' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText('Aucune arme montée.')).toBeVisible();
  });
});
