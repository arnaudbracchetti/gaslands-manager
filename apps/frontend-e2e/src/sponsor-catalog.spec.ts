import { test, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail } from './support/auth';
import { createTeam, createTeamWithVehicles, setSponsor, openEquipmentManager, optionCard } from './support/teams';

/**
 * Filtrage du catalogue par sponsor — véhicules et armes exclusifs.
 *
 * `CatalogService` pré-résout, pour chaque sponsor, la liste EXACTE des
 * véhicules/armes/améliorations qu'il est autorisé à utiliser (cf.
 * VEHICLES.md — "chaque sponsor expose directement la liste..."). Un item
 * hors catalogue du sponsor n'apparaît donc PAS DU TOUT dans les listes —
 * ni comme "indisponible avec raison", ni derrière le bouton "Afficher les
 * indisponibles" (qui ne révèle que les refus définitifs PARMI les items
 * déjà proposés au sponsor courant, cf. `EquipmentManager.hiddenCount`).
 */
test.describe('Sponsor catalog — véhicules et armes exclusifs', () => {
  test(
    "le catalogue de véhicules Rutherford propose Hélicoptère et Char d'assaut, exclus pour un autre sponsor",
    async ({ page }) => {
      await registerTestUser(page, {
        firstName: 'Furiosa',
        lastName: 'Jabassa',
        email: uniqueEmail('e2e-catalog-vehicles'),
        password: 'test1234',
      });

      // Sponsor par défaut du catalogue (premier de la liste) = Rutherford.
      await createTeam(page);
      await page.getByRole('button', { name: /AJOUTER UN VÉHICULE/i }).click();
      await page.getByRole('button', { name: 'Ajouter un véhicule', exact: true }).click();
      await expect(page).toHaveURL(/\/teams\/\d+\/vehicles\/new/);

      await expect(page.getByRole('heading', { name: 'Hélicoptère', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: "Char d'assaut", exact: true })).toBeVisible();

      // ── Deuxième équipe, sponsor Miyazaki : véhicules exclusifs Rutherford absents ──
      await createTeam(page);
      await setSponsor(page, 'Miyazaki');
      await page.getByRole('button', { name: /AJOUTER UN VÉHICULE/i }).click();
      await page.getByRole('button', { name: 'Ajouter un véhicule', exact: true }).click();
      await expect(page).toHaveURL(/\/teams\/\d+\/vehicles\/new/);

      await expect(page.getByRole('heading', { name: 'Hélicoptère', exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: "Char d'assaut", exact: true })).toHaveCount(0);
    },
  );

  test(
    'le catalogue d\'armes Mishkin propose les armes électroniques, exclues pour un autre sponsor',
    async ({ page }) => {
      await registerTestUser(page, {
        firstName: 'Furiosa',
        lastName: 'Jabassa',
        email: uniqueEmail('e2e-catalog-weapons'),
        password: 'test1234',
      });

      // Camion à glaces est autorisé pour Mishkin ET Idris (cf. vehicules.yml) —
      // même type de véhicule des deux côtés, seule la variable testée change.
      await createTeamWithVehicles(page, { sponsor: 'Mishkin', vehicleNames: ['Camion à glaces'] });
      await openEquipmentManager(page);
      await expect(optionCard(page, 'Canon à Arc Électrique')).toBeVisible();

      await createTeamWithVehicles(page, { sponsor: 'Idris', vehicleNames: ['Camion à glaces'] });
      await openEquipmentManager(page);
      await expect(optionCard(page, 'Canon à Arc Électrique')).toHaveCount(0);
    },
  );
});
