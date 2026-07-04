/**
 * Helpers d'authentification réutilisables par tous les specs e2e
 * authentifiés (Teams, puis Vehicles/Campagnes).
 *
 * Les formulaires register/login utilisent des `<label for>` propres
 * (cf. apps/frontend/src/app/auth/{login,register}/*.html) — pas besoin
 * de `data-testid`, `page.getByLabel(...)` suffit.
 */
import { Page, expect } from '@playwright/test';

export interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/** Inscrit un nouvel utilisateur via /register et attend la redirection vers /home. */
export async function registerTestUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Prénom').fill(user.firstName);
  // exact: true — "Nom" est sinon aussi un match en sous-chaîne de "Prénom"
  // (suffixe "...énom").
  await page.getByLabel('Nom', { exact: true }).fill(user.lastName);
  await page.getByLabel('Email').fill(user.email);
  // getByLabel matche par défaut en sous-chaîne — le label complet du
  // formulaire d'inscription est "Mot de passe (6 caractères minimum)".
  await page.getByLabel('Mot de passe').fill(user.password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/home/);
}

/** Connecte un utilisateur existant via /login et attend la redirection vers /home. */
export async function login(page: Page, credentials: Pick<TestUser, 'email' | 'password'>): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Mot de passe').fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/home/);
}

/**
 * Génère un email unique pour l'inscription d'un utilisateur de test.
 *
 * Contrairement au test pilote (`teams.spec.ts`, email fixe car seul test du
 * fichier à l'origine), les specs qui suivent contiennent PLUSIEURS tests —
 * et `gaslands_test` n'est vidée qu'UNE fois par run entier (`global-setup.ts`),
 * pas entre tests ni entre projets de navigateur (`playwright.config.ts` liste
 * chromium/firefox/webkit, exécutés par défaut). Un suffixe horodaté + aléatoire
 * évite toute collision d'email entre tests et entre navigateurs.
 */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}
