/**
 * Configuration Vitest pour les tests unitaires du backend NestJS.
 *
 * Vitest est le framework de test utilisé dans ce projet.
 * Il est compatible avec l'API Jest (describe, it, expect, beforeEach, etc.)
 * mais s'exécute via Vite, ce qui le rend plus rapide et modern.
 *
 * Problème spécifique NestJS :
 * NestJS utilise les décorateurs TypeScript avec `emitDecoratorMetadata: true`.
 * Le compilateur TypeScript par défaut de Vitest (esbuild) ne supporte pas
 * cette option. On utilise donc unplugin-swc qui compile avec SWC + décorateurs.
 *
 * unplugin-swc : plugin universel (Vite/Rollup/webpack) qui remplace le
 * compilateur TypeScript par SWC (Speedy Web Compiler, en Rust = ultra-rapide).
 */

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // swc.vite() : active la compilation SWC pour Vite/Vitest
    // spec: true → utilise la config SWC pour les fichiers de test
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,        // Support des décorateurs TypeScript
          dynamicImport: true,
        },
        transform: {
          decoratorMetadata: true, // CRUCIAL pour NestJS : génère reflect-metadata
          legacyDecorator: true,
        },
        target: 'es2020',
      },
    }),
  ],
  test: {
    // globals: true → pas besoin d'importer describe/it/expect dans chaque test
    // Attention : Vitest utilise vi.fn() / vi.spyOn() — PAS jest.fn() / jest.spyOn()
    globals: true,
    // environment: 'node' → pas de DOM (backend = Node.js pur)
    environment: 'node',
    // Fichiers de test à inclure
    include: ['src/**/*.spec.ts'],
    // Pas de coverage pour l'instant, pour garder les tests rapides
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/app/auth/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.entity.ts'],
    },
    // Import de reflect-metadata nécessaire pour les décorateurs NestJS
    setupFiles: ['src/test-setup.ts'],
  },
});
