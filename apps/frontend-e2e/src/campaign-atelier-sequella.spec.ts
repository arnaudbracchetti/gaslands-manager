import { test, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail } from './support/auth';
import { createTeamWithVehicles } from './support/teams';
import { createCampaign, addGame, runResultWizard, openAtelier, addBystanderParticipant } from './support/campaigns';

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
 * par les tests unitaires (`equipment-manager.spec.ts`,
 * `get-workshop-available-sequelles.usecase.spec.ts`) - obtenir des Chocs de
 * façon fiable en e2e nécessiterait un mécanisme de seed du D6 qui n'existe
 * pas encore dans ce projet.
 *
 * Ce test vérifie malgré tout, sur une VRAIE requête HTTP + base de données
 * (pas de mock) : que la nouvelle route `available-sequelles` répond, que
 * les séquelles s'affichent comme 4ᵉ catégorie d'équipement intégrée à
 * `EquipmentManager` (pas un composant séparé), et que le verdict "Chocs
 * insuffisants" est correctement rendu pour chaque séquelle.
 */
test.describe('Campagnes — Atelier — Séquelles', () => {
  test('affiche le solde de Chocs à 0 et grise toutes les séquelles disponibles (Chocs insuffisants)', async ({ page, browser }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Sequelles',
      email: uniqueEmail('e2e-atelier-sequelles'),
      password: 'test1234',
    });

    const teamName = 'Escouade Séquelles';
    await createTeamWithVehicles(page, { name: teamName, vehicleNames: ['Camion à glaces'] });

    await createCampaign(page, { name: 'Saison E2E Atelier Séquelles', teamName });
    const { teamName: joineeTeamName, context: joineeContext } = await addBystanderParticipant(page, browser, 'atelier-sequelles');
    await addGame(page);
    // Aucune désignation d'épave : le véhicule engagé n'est jamais mis en
    // épave, donc son solde de Chocs reste garanti à 0 (pas de tirage D6).
    await runResultWizard(page, { teamNames: [teamName, joineeTeamName] });

    await openAtelier(page);
    await page.getByTestId('vehicle-card-manage').first().click();
    await expect(page).toHaveURL(/\/campaigns\/\d+\/atelier\/vehicles\/\d+$/);

    // Séquelles intégrées à EquipmentManager (4ᵉ catégorie d'équipement, pas
    // un composant `app-sequella-manager` séparé) - gated par le même toggle
    // "Afficher les indisponibles" que les armes/améliorations/avantages. Un
    // véhicule fraîchement engagé a 0 Chocs, donc les 10 séquelles ATELIER
    // sont masquées par défaut.
    await page.getByRole('button', { name: /Afficher les indisponibles/ }).click();

    await expect(page.locator('.vcs-chocs')).toContainText('0');

    // La liste "Disponibles" répond bien depuis la vraie route
    // GET .../workshop/vehicles/:id/available-sequelles (10 séquelles ATELIER
    // dans le catalogue réel - cf. database_init/data/sequelle.yml, PAS 11 comme
    // l'affirme à tort docs/spec/CAMPAIGN.md, un écart pré-existant non lié à
    // cette fonctionnalité).
    const sequellaCards = page.locator('.em-sequella-card');
    await expect(sequellaCards).toHaveCount(10);
    await expect(page.locator('.em-sequella-card--unavailable')).toHaveCount(10);

    // Chaque séquelle (coût ≥ 1) est indisponible à 0 Choc - aucun bouton
    // "Acquérir", et la raison du backend est affichée telle quelle.
    await expect(page.locator('.em-sequella-card__acquire')).toHaveCount(0);
    const reasons = page.locator('.em-sequella-card__reason');
    await expect(reasons.first()).toContainText('Chocs insuffisants');
    expect(await reasons.count()).toBe(10);

    // Aucune séquelle acquise sur un véhicule fraîchement engagé.
    await expect(page.getByText('Séquelles (0)')).toBeVisible();
    await expect(page.getByText('Aucune séquelle acquise.')).toBeVisible();

    await joineeContext.close();
  });
});
