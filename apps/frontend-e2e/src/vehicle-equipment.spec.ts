import { test, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail } from './support/auth';
import { createTeam, createTeamWithVehicles, addVehicle, openEquipmentManager, optionCard, saveAndWait } from './support/teams';

/**
 * Gestion de l'équipement d'un véhicule — armes, améliorations, montage sur
 * Tourelle (attribut de l'arme) et garde de budget (EquipmentManager, cf.
 * COMPONENTS.md).
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
test.describe('Vehicle equipment — armes, améliorations, montage sur Tourelle, budget', () => {
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

  test('ajoute puis retire une amélioration', async ({ page }) => {
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

  test("une arme intégrée par défaut (estDefaut) ne peut pas être retirée", async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-defaut'),
      password: 'test1234',
    });

    // Char d'assaut (Rutherford, sponsor par défaut) porte un Canon de 125 mm monté
    // sur Tourelle, intégré (`Weapon.estDefaut: true`, cf. VEHICLES.md — "Améliorations
    // et armes par défaut") — ce n'est plus une amélioration mais une arme.
    await createTeamWithVehicles(page, { vehicleNames: ["Char d'assaut"] });
    await openEquipmentManager(page);

    const canonIntegre = page.locator('.me-item').filter({ hasText: 'Canon de 125 mm' });
    await expect(canonIntegre).toBeVisible();
    await expect(canonIntegre.getByText('(Tourelle)')).toBeVisible();
    await expect(canonIntegre.getByText('🔒 Intégré')).toBeVisible();
    await expect(canonIntegre.getByRole('button', { name: 'Retirer', exact: true })).toHaveCount(0);
  });

  test('monte une arme sur Tourelle (case à cocher) et vérifie le coût x3', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-tourelle-mount'),
      password: 'test1234',
    });

    await createTeamWithVehicles(page, { vehicleNames: ['Camion à glaces'] });
    await openEquipmentManager(page);

    const mitrailleuseOption = optionCard(page, 'Mitrailleuse');
    await mitrailleuseOption.getByRole('button', { name: 'Ajouter' }).click();

    // Bouton « Tourelle x3 » — visible car Mitrailleuse est montable_tourelle.
    await mitrailleuseOption.getByRole('button', { name: 'Tourelle x3' }).click();

    const mountedWeapon = page.locator('.me-item').filter({ hasText: 'Mitrailleuse' });
    await expect(mountedWeapon).toBeVisible();
    await expect(mountedWeapon.getByText('(Tourelle)')).toBeVisible();
    // Prix ×3 (2 🛢️ → 6 🛢️, cf. armes.yml) — pas d'orientation affichée (arc 360°).
    await expect(mountedWeapon).toContainText('6');
    await expect(mountedWeapon.getByText(/^\(avant\)$|^\(arrière\)$|^\(gauche\)$|^\(droite\)$/)).toHaveCount(0);
  });

  test('retire une arme montée sur Tourelle comme n\'importe quelle arme', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-tourelle-remove'),
      password: 'test1234',
    });

    await createTeamWithVehicles(page, { vehicleNames: ['Camion à glaces'] });
    await openEquipmentManager(page);

    const mitrailleuseOption = optionCard(page, 'Mitrailleuse');
    await mitrailleuseOption.getByRole('button', { name: 'Ajouter' }).click();
    await mitrailleuseOption.getByRole('button', { name: 'Tourelle x3' }).click();
    await expect(page.getByText('Armes (1)')).toBeVisible();

    await page.locator('.me-item').filter({ hasText: 'Mitrailleuse' }).getByRole('button', { name: 'Retirer' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Retirer', exact: true }).click();

    await expect(page.getByText('Armes (0)')).toBeVisible();
    await expect(page.getByText('Aucune arme montée.')).toBeVisible();
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

  test('une arme d\'équipage (necessite_orientation=false) s\'ajoute directement, sans sélecteur d\'orientation', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-no-orientation-weapon'),
      password: 'test1234',
    });

    await createTeamWithVehicles(page, { vehicleNames: ['Camion à glaces'] });
    await openEquipmentManager(page);

    // Grenades : type "équipage", necessite_orientation=false (armes.yml) — le clic
    // sur "Ajouter" monte l'arme immédiatement, sans afficher le sélecteur 4 directions.
    const grenadesOption = optionCard(page, 'Grenades');
    await grenadesOption.getByRole('button', { name: 'Ajouter' }).click();

    const mountedWeapon = page.locator('.me-item').filter({ hasText: 'Grenades' });
    await expect(mountedWeapon).toBeVisible();
    await expect(page.getByText('Armes (1)')).toBeVisible();
    // Aucune orientation affichée sur l'arme montée (arc à 360° automatique).
    await expect(mountedWeapon.getByText(/^\(avant\)$|^\(arrière\)$|^\(gauche\)$|^\(droite\)$/)).toHaveCount(0);
  });

  test('une amélioration Bélier (necessite_orientation=true) requiert une orientation avant l\'ajout', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Jabassa',
      email: uniqueEmail('e2e-equip-orientation-improvement'),
      password: 'test1234',
    });

    await createTeamWithVehicles(page, { vehicleNames: ['Camion à glaces'] });
    await openEquipmentManager(page);

    // Bélier : necessite_orientation=true (amelioration.yml) — la garde générique
    // de `Vehicle.canAddImprovement` (et non plus une vérification propre au
    // décorateur) impose le même sélecteur 4 directions qu'une arme orientable.
    const belierOption = optionCard(page, 'Bélier');
    await belierOption.getByRole('button', { name: 'Ajouter' }).click();

    await expect(belierOption.getByRole('button', { name: 'avant', exact: true })).toBeVisible();
    await belierOption.getByRole('button', { name: 'avant', exact: true }).click();

    const mountedImprovement = page.locator('.me-item').filter({ hasText: 'Bélier' });
    await expect(mountedImprovement).toBeVisible();
    await expect(mountedImprovement.getByText('(avant)')).toBeVisible();
    await expect(page.getByText('Améliorations (1)')).toBeVisible();
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
