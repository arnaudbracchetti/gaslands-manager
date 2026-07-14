import { test, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail } from './support/auth';
import { createTeamWithVehicles } from './support/teams';
import { createCampaign, addGame, runResultWizard, openAtelier } from './support/campaigns';

/**
 * Atelier campagne — séquelles (cf. docs/spec/CAMPAIGN.md §Séquelles).
 *
 * Couverture VOLONTAIREMENT limitée à ce qui est déterministe : un véhicule
 * fraîchement engagé (jamais mis en épave) a TOUJOURS `chocs = 0`, donc AUCUNE
 * séquelle ATELIER (toutes coûtent ≥ 1 Choc) n'est achetable — condition
 * garantie sans dépendre du tirage D6 de la Table des Épaves, réellement
 * aléatoire côté serveur e2e (pas de randomizer fixé, contrairement aux tests
 * unitaires backend qui utilisent `FixedRandomizer`). L'achat réel d'une
 * séquelle (Dur à Cuire, revente via Légende Vivante) reste couvert uniquement
 * par les tests unitaires (`sequella-manager.spec.ts`,
 * `get-workshop-available-sequelles.usecase.spec.ts`) — obtenir des Chocs de
 * façon fiable en e2e nécessiterait un mécanisme de seed du D6 qui n'existe
 * pas encore dans ce projet.
 *
 * Ce test vérifie malgré tout, sur une VRAIE requête HTTP + base de données
 * (pas de mock) : que la nouvelle route `available-sequelles` répond, que
 * `SequellaManager` s'affiche sous `EquipmentManager`, et que le verdict
 * "Chocs insuffisants" est correctement rendu pour chaque séquelle.
 */
test.describe('Campagnes — Atelier — Séquelles', () => {
  test('affiche le solde de Chocs à 0 et grise toutes les séquelles disponibles (Chocs insuffisants)', async ({ page }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Sequelles',
      email: uniqueEmail('e2e-atelier-sequelles'),
      password: 'test1234',
    });

    const teamName = 'Escouade Séquelles';
    await createTeamWithVehicles(page, { name: teamName, vehicleNames: ['Camion à glaces'] });

    await createCampaign(page, { name: 'Saison E2E Atelier Séquelles', teamName });
    await addGame(page);
    // Aucune désignation d'épave : le véhicule engagé n'est jamais mis en
    // épave, donc son solde de Chocs reste garanti à 0 (pas de tirage D6).
    await runResultWizard(page, { teamNames: [teamName] });

    await openAtelier(page);
    await page.getByTestId('vehicle-card-manage').first().click();
    await expect(page).toHaveURL(/\/campaigns\/\d+\/atelier\/vehicles\/\d+$/);

    await expect(page.locator('app-sequella-manager')).toBeVisible();
    await expect(page.locator('.sm__chocs')).toContainText('0');

    // La liste "Disponibles" répond bien depuis la vraie route
    // GET .../workshop/vehicles/:id/available-sequelles (10 séquelles ATELIER
    // dans le catalogue réel — cf. database_init/data/sequelle.yml, PAS 11 comme
    // l'affirme à tort docs/spec/CAMPAIGN.md, un écart pré-existant non lié à
    // cette fonctionnalité).
    const availableGroup = page.locator('.sm__group').first();
    await expect(availableGroup.locator('.sm__item')).toHaveCount(10);

    // Chaque séquelle (coût ≥ 1) est indisponible à 0 Choc — aucun bouton
    // "Acquérir", et la raison du backend est affichée telle quelle.
    await expect(availableGroup.locator('.sm__acquire')).toHaveCount(0);
    const reasons = availableGroup.locator('.sm__reason');
    await expect(reasons.first()).toContainText('Chocs insuffisants');
    expect(await reasons.count()).toBe(10);

    // Aucune séquelle acquise sur un véhicule fraîchement engagé.
    const ownedGroup = page.locator('.sm__group').nth(1);
    await expect(ownedGroup).toContainText('Aucune séquelle acquise.');
  });
});
