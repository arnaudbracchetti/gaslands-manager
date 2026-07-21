/**
 * Helpers de mise en place réutilisables par tous les specs e2e du domaine
 * Campaigns/Atelier — création de saison, ajout de partie, pilotage du wizard
 * de fin de partie, désignation des épaves, atelier, invitation. Miroir de
 * `support/teams.ts` pour ce domaine.
 *
 * Chaque helper suppose l'utilisateur déjà authentifié et, pour la plupart,
 * déjà sur (ou navigable depuis) la page `/campaigns/:id` correspondante.
 */
import { Page, Browser, BrowserContext, Locator, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail, TestUser } from './auth';
import { createTeam } from './teams';

/**
 * Crée une saison via "+ Créer une saison" (page `/campaigns`) et attend
 * l'arrivée sur `/campaigns/:id`. Renseigne `teamName` comme équipe engagée
 * si fourni. Retourne l'id de la campagne créée (extrait de l'URL).
 */
export async function createCampaign(page: Page, options: { name: string; teamName?: string }): Promise<string> {
  await page.goto('/campaigns');
  await page.getByRole('button', { name: '+ Créer une saison' }).click();

  await page.getByLabel('Nom de la saison').fill(options.name);
  if (options.teamName) {
    await page.getByLabel('Mon équipe engagée').selectOption({ label: options.teamName });
  }

  const createCampaignResponse = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/api\/campaigns$/.test(r.url()),
  );
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await createCampaignResponse;

  await expect(page).toHaveURL(/\/campaigns\/\d+$/);
  const match = /\/campaigns\/(\d+)$/.exec(page.url());
  if (!match) throw new Error(`URL de campagne inattendue : ${page.url()}`);
  return match[1];
}

/**
 * Ajoute une partie au Programme Télé (bouton "Ajouter une partie" — icône SVG
 * `app-icon` depuis la migration emoji→icônes, cf. commit `17d95b8`, le nom
 * accessible ne porte donc plus l'emoji), suppose l'utilisateur déjà sur
 * `/campaigns/:id`. `scenarioIndex` sélectionne le scénario du catalogue par
 * position (1 = premier, défaut — cohérent avec le test pilote
 * `campaign-program.spec.ts`).
 */
export async function addGame(page: Page, options?: { scenarioIndex?: number }): Promise<void> {
  await page.getByRole('button', { name: 'Ajouter une partie' }).click();
  await page.getByLabel('Scénario').selectOption({ index: options?.scenarioIndex ?? 1 });

  const createGameResponse = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games$/.test(r.url()),
  );
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await createGameResponse;
}

/**
 * Coche les équipes présentes (écran Présence, toujours la première étape du
 * wizard) puis avance à travers les écrans intermédiaires à ÉTAPES VARIABLES
 * (Classement, Portes, Jerricans — dépendent du type de partie et des
 * métadonnées du scénario, cf. `GameResultWizard.activeSteps`) jusqu'à l'écran
 * Désignation des épaves. Un simple clic "Suivant" suffit à chaque écran
 * intermédiaire : aucune saisie n'y est requise pour les besoins des tests e2e
 * (l'ordre du classement et les valeurs de portes/jerricans n'affectent aucune
 * assertion existante). Boucle bornée (5 itérations max) détectant l'arrivée
 * sur l'écran Désignation via `.wds__list`/`.wds__empty`.
 */
export async function completePreDesignationSteps(page: Page, teamNames: string[]): Promise<void> {
  for (const teamName of teamNames) {
    const row = page.locator('.pst__participant-row').filter({ hasText: teamName });
    await row.locator('input[type="checkbox"]').check();
  }
  await page.getByRole('button', { name: 'Suivant', exact: true }).click();

  // `.count()` lit le DOM instantanément, sans attendre — juste après un clic
  // "Suivant", Angular n'a pas forcément fini de re-rendre l'écran suivant, ce
  // qui peut faire lire un état obsolète (encore l'ancien écran) et déclencher
  // un clic "Suivant" de trop, jamais résolu une fois l'écran Désignation déjà
  // atteint (son bouton n'est plus "Suivant" seul mais "Suivant — résoudre les
  // épaves"). `waitFor` avec un timeout court, lui, attend réellement le
  // re-rendu avant de conclure qu'on n'a pas encore atteint la Désignation.
  const designationMarker = page.locator('.wds__list, .wds__empty').first();
  for (let i = 0; i < 5; i++) {
    const reachedDesignation = await designationMarker
      .waitFor({ state: 'visible', timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    if (reachedDesignation) return;
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();
  }
}

/**
 * Sélectionne le statut d'un véhicule à l'écran Désignation des épaves du
 * wizard — `li.wds__item` scopé par nom de véhicule. Les 3 statuts radio sont
 * "Intact"/"Mis en épave par…"/"Mis en épave seul" (le "…" est l'ellipse Unicode
 * U+2026, pas trois points). Si `status: 'destroyed'`, `destroyerTeamName`
 * sélectionne le destructeur dans `select.wds__destroyer-select` (liste les
 * AUTRES participants présents, jamais le propriétaire du véhicule).
 */
export async function designateWreck(
  page: Page,
  vehicleName: string,
  status: 'destroyed' | 'alone',
  options?: { destroyerTeamName?: string; favoriDuPublic?: boolean },
): Promise<void> {
  const item = page.locator('.wds__item').filter({ hasText: vehicleName });
  const radioLabel = status === 'destroyed' ? 'Mis en épave par…' : 'Mis en épave seul';
  await item.locator('label').filter({ hasText: radioLabel }).locator('input[type="radio"]').check();

  if (options?.destroyerTeamName) {
    await item.locator('select.wds__destroyer-select').selectOption({ label: options.destroyerTeamName });
  }
  if (options?.favoriDuPublic) {
    await item.locator('.wds__favori-checkbox input[type="checkbox"]').check();
  }
}

/**
 * Pilote entièrement le wizard de fin de partie (étapes variables E/ET)
 * depuis le bouton "🎯 Saisir les rangs" jusqu'à l'entrée en Atelier ("Terminer").
 *
 * `teamNames` : équipes à cocher présentes à l'écran Présence (l'ordre de
 * classement lui-même n'a pas d'importance pour les specs qui utilisent ce
 * helper, seul le fait d'être présent compte — cf. `completePreDesignationSteps`).
 * `wreckDesignations` : désignations à l'écran Désignation — absent/vide
 * reproduit le chemin "équipe sans véhicule" du test pilote (rien à désigner).
 *
 * Écran Résolution : AUCUNE assertion sur la valeur du tirage D6 (non
 * déterministe côté serveur, cf. plan) — seulement qu'un résultat quelconque
 * est apparu pour chaque véhicule désigné, puis que "Terminer" devient actif.
 */
export async function runResultWizard(
  page: Page,
  options: {
    teamNames: string[];
    wreckDesignations?: Array<{
      vehicleName: string;
      status: 'destroyed' | 'alone';
      destroyerTeamName?: string;
      favoriDuPublic?: boolean;
    }>;
  },
): Promise<void> {
  await page.getByRole('button', { name: '🎯 Saisir les rangs' }).click();
  await completePreDesignationSteps(page, options.teamNames);

  const recordResultResponse = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/results$/.test(r.url()),
  );
  for (const designation of options.wreckDesignations ?? []) {
    await designateWreck(page, designation.vehicleName, designation.status, designation);
  }
  await page.getByRole('button', { name: 'Suivant — résoudre les épaves' }).click();
  await recordResultResponse;

  const expectedOutcomes = options.wreckDesignations?.length ?? 0;
  if (expectedOutcomes > 0) {
    await expect(page.locator('.wrs__outcome')).toHaveCount(expectedOutcomes, { timeout: 15000 });
  }
  const terminerButton = page.getByRole('button', { name: 'Terminer' });
  await expect(terminerButton).toBeEnabled({ timeout: 15000 });

  const enterAtelierResponse = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/games\/\d+\/enter-atelier$/.test(r.url()),
  );
  await terminerButton.click();
  await enterAtelierResponse;
}

/** Ouvre l'atelier depuis le bouton "Atelier" (icône SVG) d'une partie en statut ATELIER. */
export async function openAtelier(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Atelier' }).click();
  await expect(page).toHaveURL(/\/campaigns\/\d+\/atelier$/);
}

/**
 * Déclenche `action` (achat/revente/annulation d'équipement dans l'atelier) et
 * attend la mutation `POST .../events/equipment` PUIS la relecture
 * `GET .../workshop` qui la suit systématiquement (`AtelierVehiclePage.
 * onVehicleChanged()`), avant de continuer — mirroir de `saveAndWait` côté
 * équipe, adapté au double aller-retour propre à l'atelier (event-sourcing).
 * Les deux `waitForResponse` sont armés AVANT `action()` pour éviter la course
 * où la réponse arrive avant que le listener ne soit posé.
 */
export async function waitForEquipmentEvent(page: Page, action: () => Promise<void>): Promise<void> {
  const postResponse = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/events\/equipment$/.test(r.url()),
  );
  const getWorkshopResponse = page.waitForResponse(
    (r) => r.request().method() === 'GET' && /\/api\/campaigns\/\d+\/workshop$/.test(r.url()),
  );
  await action();
  await postResponse;
  await getWorkshopResponse;
}

/**
 * Invite un second utilisateur dans la campagne de `organizerPage` et le fait
 * valider (ou refuser, si `accept: false`) par l'organisateur.
 *
 * Ouvre un second contexte navigateur (`browser.newContext()`) — inscription,
 * création d'équipe, puis rejoint via `/campaigns/join/:code` (code lu depuis
 * `.invite-link__code` chez l'organisateur, donc `organizerPage` doit déjà
 * être sur `/campaigns/:id` en tant qu'organisateur EN_CONSTRUCTION/EN_COURS
 * pour que ce lien soit affiché). Retourne le contexte/page du second
 * utilisateur, encore ouverts, pour que l'appelant continue à le piloter
 * (promotion, retrait, changement d'équipe, journal…) — à fermer en fin de
 * test (`joineeContext.close()`) si le test ne compte pas sur le teardown
 * automatique de fin de run.
 */
export async function inviteAndValidateParticipant(
  organizerPage: Page,
  browser: Browser,
  options: { joineeUser: TestUser; joineeTeamName: string; accept?: boolean },
): Promise<{ joineeContext: BrowserContext; joineePage: Page }> {
  const code = (await organizerPage.locator('.invite-link__code').innerText()).trim();

  const joineeContext = await browser.newContext();
  const joineePage = await joineeContext.newPage();
  await registerTestUser(joineePage, options.joineeUser);
  await createTeam(joineePage, options.joineeTeamName);

  await joineePage.goto(`/campaigns/join/${code}`);
  await expect(joineePage.locator('.campaign-join-card')).toBeVisible();
  await joineePage.getByLabel('Avec quelle équipe ?').selectOption({ label: options.joineeTeamName });

  const joinResponse = joineePage.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/api\/campaigns\/\d+\/participants$/.test(r.url()),
  );
  await joineePage.getByRole('button', { name: 'Demander à rejoindre →' }).click();
  await joinResponse;
  await expect(joineePage.locator('.campaign-join-success')).toBeVisible();

  await organizerPage.reload();
  const row: Locator = organizerPage.locator('.participant-list__item').filter({ hasText: options.joineeUser.firstName });
  await expect(row.locator('.participant-list__badge--pending')).toBeVisible();

  const validateResponse = organizerPage.waitForResponse(
    (r) => r.request().method() === 'PUT' && /\/api\/campaigns\/\d+\/participants\/\d+\/validate$/.test(r.url()),
  );
  const buttonName = options.accept === false ? 'Refuser' : 'Valider';
  await row.getByRole('button', { name: buttonName, exact: true }).click();
  await validateResponse;

  return { joineeContext, joineePage };
}

/**
 * Invite un second participant "figurant" (sans véhicule) dans la campagne de
 * l'organisateur — uniquement pour satisfaire le minimum de deux équipes
 * présentes exigé par l'écran Présence du wizard de fin de partie
 * (`PresenceStep` : bouton "Suivant" désactivé tant que moins de deux équipes
 * ne sont cochées, une partie à un seul participant n'est pas enregistrable).
 * Pure délégation à `inviteAndValidateParticipant` avec une identité fixe —
 * `suffix` distingue l'email d'un test à l'autre (isolation, cf. `uniqueEmail`).
 * Retourne le nom d'équipe du figurant (à inclure dans `teamNames`) et son
 * contexte navigateur (à fermer en fin de test, `context.close()`).
 */
export async function addBystanderParticipant(
  page: Page,
  browser: Browser,
  suffix: string,
): Promise<{ teamName: string; context: BrowserContext }> {
  const teamName = 'Escouade Figurante';
  const { joineeContext } = await inviteAndValidateParticipant(page, browser, {
    joineeUser: {
      firstName: 'Max',
      lastName: 'Figurant',
      email: uniqueEmail(`e2e-bystander-${suffix}`),
      password: 'test1234',
    },
    joineeTeamName: teamName,
  });
  return { teamName, context: joineeContext };
}
