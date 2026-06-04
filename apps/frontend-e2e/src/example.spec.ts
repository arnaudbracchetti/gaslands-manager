/**
 * Tests e2e Playwright pour Gaslands Manager (frontend).
 *
 * Ces tests simulent un vrai navigateur et vérifient le comportement
 * de l'application du point de vue de l'utilisateur.
 *
 * Prérequis : l'application tourne sur http://localhost:4200
 * (géré automatiquement par la config Playwright webServer).
 */
import { test, expect } from '@playwright/test';

// ── Page d'accueil ───────────────────────────────────────────────────────────

test('la page d\'accueil affiche le titre GASLANDS MANAGER', async ({ page }) => {
  await page.goto('/');

  // La page d'accueil a un <h1 class="hero-title"> avec le titre de l'app
  const title = await page.locator('h1.hero-title').innerText();
  expect(title).toContain('GASLANDS MANAGER');
});

test('la page d\'accueil contient les liens de navigation principaux', async ({ page }) => {
  await page.goto('/');

  // Les 4 feature cards doivent être présentes
  const cards = page.locator('.feature-card');
  await expect(cards).toHaveCount(4);
});

// ── Authentification ─────────────────────────────────────────────────────────

test('accéder à /teams sans être connecté redirige vers /login', async ({ page }) => {
  await page.goto('/teams');

  // Le guard auth redirige vers /login
  await expect(page).toHaveURL(/\/login/);
});

test('la page de login affiche le formulaire d\'authentification', async ({ page }) => {
  await page.goto('/login');

  // Le formulaire de connexion doit être présent
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});
