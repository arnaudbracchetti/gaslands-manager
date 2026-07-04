/**
 * Helpers de mise en place réutilisables par tous les specs e2e du domaine
 * Teams/Vehicles — création rapide d'équipe, changement de sponsor, ajout de
 * véhicule. Pilotage 100% UI (pas de seed direct en base), cohérent avec
 * `auth.ts`/`db.ts`.
 *
 * Chaque helper suppose l'utilisateur déjà authentifié (cf. `registerTestUser`/
 * `login`, `auth.ts`) — appelé AVANT ces helpers dans chaque test.
 */
import { Page, Locator, expect } from '@playwright/test';

/**
 * Déclenche `action` (typiquement un `.blur()` sur un champ auto-save) et
 * attend la réponse `PUT /api/teams/:id` correspondante avant de continuer.
 *
 * `TeamEditPage.saveField()` ne donne aucun signal visuel de sauvegarde (pas
 * de bouton "Enregistrer", pas de toast) — enchaîner `blur()` puis
 * `page.reload()` sans attendre la requête est une course : sous charge
 * (plusieurs workers Playwright contre un même backend de test), le reload
 * peut arriver avant que le PUT n'ait été traité, faisant échouer
 * l'assertion de persistance de façon intermittente.
 */
export async function saveAndWait(page: Page, action: () => Promise<void>): Promise<void> {
  const responsePromise = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && /\/api\/teams\/\d+$/.test(r.url()),
  );
  await action();
  await responsePromise;
}

/**
 * Carte de catalogue (`.option`, `EquipmentManager`) correspondant EXACTEMENT
 * à `name`. `.filter({ hasText })` seul ferait un match en sous-chaîne — ambigu
 * dans ce catalogue : ex. "Mitrailleuse" est aussi un préfixe de "Mitrailleuse
 * Lourde" (cf. armes.yml).
 */
export function optionCard(page: Page, name: string): Locator {
  return page.locator('.option').filter({ has: page.getByText(name, { exact: true }) });
}

/**
 * Crée une équipe via le bouton "Nouvelle équipe" (valeurs par défaut :
 * sponsor = premier du catalogue, budget 50) et attend l'arrivée sur la page
 * d'édition. Renomme ensuite si `name` est fourni (sauvegarde au blur).
 */
export async function createTeam(page: Page, name?: string): Promise<void> {
  await page.goto('/teams');
  // exact: true — sans quoi le bouton "+ Nouvelle équipe" matche aussi en
  // sous-chaîne toute carte d'équipe déjà nommée "Nouvelle équipe" (valeur par
  // défaut de Teams.createAndEdit()), ambigu dès qu'un test crée >1 équipe.
  await page.getByRole('button', { name: '+ Nouvelle équipe', exact: true }).click();
  await expect(page).toHaveURL(/\/teams\/\d+\/edit/);

  if (name) {
    const nameInput = page.getByLabel("Nom de l'équipe");
    await nameInput.fill(name);
    await saveAndWait(page, () => nameInput.blur());
  }
}

/**
 * Sélectionne un sponsor dans le carousel de la page d'édition d'équipe, via
 * les dots de navigation (`role="tab"`, `aria-label="{{sponsor.nom}}"` —
 * cf. sponsor-carousel.html). Suppose le carousel déjà chargé et non verrouillé
 * (aucun véhicule dans l'équipe).
 */
export async function setSponsor(page: Page, sponsorName: string): Promise<void> {
  const tab = page.getByRole('tab', { name: sponsorName });
  await saveAndWait(page, () => tab.click());
}

/**
 * Ajoute un véhicule depuis la page d'édition d'équipe : clique "AJOUTER UN
 * VÉHICULE", confirme la modale d'avertissement de verrouillage sponsor SI
 * elle apparaît (seulement au premier véhicule de l'équipe), choisit un
 * véhicule (par défaut le premier de la grille) puis clique "Terminer" pour
 * revenir sur la page d'édition.
 */
export async function addVehicle(page: Page, options?: { vehicleName?: string }): Promise<void> {
  await page.getByRole('button', { name: /AJOUTER UN VÉHICULE/i }).click();

  // La modale de verrouillage n'apparaît qu'au premier véhicule de l'équipe —
  // exact: true pour ne pas matcher en sous-chaîne le bouton "+ AJOUTER UN
  // VÉHICULE" resté affiché sous l'overlay (cf. teams.spec.ts, pilote).
  // `.isVisible()` seul ne retente pas — appelé immédiatement après le clic,
  // avant qu'Angular n'ait rendu la modale, il renvoie `false` à tort et le
  // clic de confirmation est sauté (véhicule jamais créé, navigation bloquée
  // sur /edit). `.waitFor()` avec un timeout court laisse le temps au rendu
  // sans bloquer indéfiniment quand la modale n'apparaît vraiment pas.
  const lockWarningButton = page.getByRole('button', { name: 'Ajouter un véhicule', exact: true });
  try {
    await lockWarningButton.waitFor({ state: 'visible', timeout: 2000 });
    await lockWarningButton.click();
  } catch {
    // Pas le premier véhicule de l'équipe — aucune modale à confirmer.
  }

  await expect(page).toHaveURL(/\/teams\/\d+\/vehicles\/new/);

  const vehicleCard = options?.vehicleName
    ? page.locator('.choice-card').filter({ hasText: options.vehicleName })
    : page.locator('.choice-card').first();
  await vehicleCard.getByRole('button', { name: 'Choisir ce véhicule' }).click();

  await expect(page.getByRole('button', { name: 'Terminer' })).toBeVisible();
  await page.getByRole('button', { name: 'Terminer' }).click();

  await expect(page).toHaveURL(/\/teams\/\d+\/edit/);
}

/**
 * Ouvre le configurateur d'équipement d'un véhicule existant depuis la page
 * d'édition d'équipe (bouton "GÉRER L'ÉQUIPEMENT", `data-testid="vehicle-card-manage"`).
 * `index` sélectionne la carte véhicule à cibler quand l'équipe en a plusieurs
 * (0 = la première, ordre d'affichage de `TeamEditPage`).
 */
export async function openEquipmentManager(page: Page, index: number = 0): Promise<void> {
  await page.getByTestId('vehicle-card-manage').nth(index).click();
  // Pas d'ancre `$` — l'URL porte `?returnTo=edit` (cf. VehicleConfiguratorPage).
  await expect(page).toHaveURL(/\/teams\/\d+\/vehicles\/\d+(\?|$)/);
}

/**
 * Compose les helpers ci-dessus pour les specs équipement/budget/Tourelle qui
 * n'ont pas besoin de revalider la création d'équipe à chaque test — arrive
 * directement sur la page d'édition avec le sponsor et les véhicules demandés.
 */
export async function createTeamWithVehicles(
  page: Page,
  options: { name?: string; sponsor?: string; vehicleNames: string[] },
): Promise<void> {
  await createTeam(page, options.name);
  if (options.sponsor) {
    await setSponsor(page, options.sponsor);
  }
  for (const vehicleName of options.vehicleNames) {
    await addVehicle(page, { vehicleName });
  }
}
