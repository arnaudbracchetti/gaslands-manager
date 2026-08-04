/**
 * Tests unitaires de `validateEnv` — fonction pure, aucun module NestJS à
 * monter : on appelle directement `validateEnv(raw)` avec des objets
 * représentant `process.env`, comme le ferait `ConfigModule.forRoot({
 * validate })` au démarrage.
 */

import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation';

const VALID_SECRET = 'a'.repeat(32);

function baseEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: '5432',
    DATABASE_USER: 'gaslands',
    DATABASE_PASSWORD: 'dev-password',
    DATABASE_NAME: 'gaslands',
    JWT_SECRET: 'dev-secret',
    ADMIN_EMAIL: 'admin@gaslands.local',
    ADMIN_PASSWORD: 'dev-admin-password',
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('accepte une configuration de développement minimale', () => {
    const env = validateEnv(baseEnv());

    expect(env.NODE_ENV).toBe('development');
    expect(env.DATABASE_PORT).toBe(5432);
    expect(env.JWT_EXPIRATION).toBe('7d');
    expect(env.THROTTLE_TTL).toBe(60);
    expect(env.THROTTLE_LIMIT).toBe(300);
  });

  it('convertit THROTTLE_TTL/THROTTLE_LIMIT en nombres quand ils sont fournis', () => {
    const env = validateEnv(baseEnv({ THROTTLE_TTL: '30', THROTTLE_LIMIT: '600' }));

    expect(env.THROTTLE_TTL).toBe(30);
    expect(env.THROTTLE_LIMIT).toBe(600);
  });

  it('rejette une configuration sans JWT_SECRET, en nommant la variable', () => {
    const env = baseEnv();
    delete (env as Record<string, string | undefined>).JWT_SECRET;

    expect(() => validateEnv(env)).toThrow(/JWT_SECRET/);
  });

  it('rejette un ADMIN_EMAIL mal formé', () => {
    expect(() => validateEnv(baseEnv({ ADMIN_EMAIL: 'pas-un-email' }))).toThrow(/ADMIN_EMAIL/);
  });

  it('rejette NODE_ENV=production sans CORS_ORIGIN ni TURNSTILE_SECRET_KEY', () => {
    expect(() =>
      validateEnv(
        baseEnv({
          NODE_ENV: 'production',
          JWT_SECRET: VALID_SECRET,
          DATABASE_PASSWORD: VALID_SECRET,
          ADMIN_PASSWORD: VALID_SECRET,
        }),
      ),
    ).toThrow(/CORS_ORIGIN|TURNSTILE_SECRET_KEY/);
  });

  it('rejette NODE_ENV=production avec JWT_SECRET=change_me', () => {
    expect(() =>
      validateEnv(
        baseEnv({
          NODE_ENV: 'production',
          JWT_SECRET: 'change_me',
          DATABASE_PASSWORD: VALID_SECRET,
          ADMIN_PASSWORD: VALID_SECRET,
          CORS_ORIGIN: 'https://gaslands.example',
          TURNSTILE_SECRET_KEY: 'turnstile-secret',
        }),
      ),
    ).toThrow(/JWT_SECRET/);
  });

  it('rejette NODE_ENV=production avec un JWT_SECRET trop court', () => {
    expect(() =>
      validateEnv(
        baseEnv({
          NODE_ENV: 'production',
          JWT_SECRET: 'trop-court',
          DATABASE_PASSWORD: VALID_SECRET,
          ADMIN_PASSWORD: VALID_SECRET,
          CORS_ORIGIN: 'https://gaslands.example',
          TURNSTILE_SECRET_KEY: 'turnstile-secret',
        }),
      ),
    ).toThrow(/JWT_SECRET/);
  });

  it('accepte une configuration de production complète et durcie', () => {
    const env = validateEnv(
      baseEnv({
        NODE_ENV: 'production',
        JWT_SECRET: VALID_SECRET,
        DATABASE_PASSWORD: VALID_SECRET,
        ADMIN_PASSWORD: VALID_SECRET,
        CORS_ORIGIN: 'https://gaslands.example',
        TURNSTILE_SECRET_KEY: 'turnstile-secret',
      }),
    );

    expect(env.NODE_ENV).toBe('production');
  });
});
