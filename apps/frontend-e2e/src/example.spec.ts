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

test('la page d\'accueil affiche le logo Gaslands Manager', async ({ page }) => {
  await page.goto('/');

  // Le <h1 class="hero-title"> ne porte plus le titre en texte - il contient
  // désormais le logo (home.html), le nom de l'app est porté par son alt.
  const logo = page.locator('h1.hero-title img.hero-logo');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('alt', 'Gaslands Manager');
});

test('la page d\'accueil contient les liens de navigation principaux', async ({ page }) => {
  await page.goto('/');

  // 3 feature cards (Équipes/Saisons/Documentation) - les placeholders
  // Véhicules/Armes ont été retirés de l'accueil (refactor home).
  const cards = page.locator('.feature-card');
  await expect(cards).toHaveCount(3);
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
