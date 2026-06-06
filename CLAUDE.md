
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

---

## Gaslands Manager

Application web de gestion d'équipes pour le jeu de plateau Gaslands. **Projet pédagogique** — toujours expliquer le raisonnement avant d'écrire du code, commenter l'usage des frameworks, privilégier la clarté à la concision.

**Stack** : Monorepo Nx 22.7 · Angular 21 zoneless + Signals (frontend) · NestJS 11 (backend) · PostgreSQL 16 via TypeORM · JWT + bcrypt

**Structure** : `apps/frontend/` (port 4200) · `apps/backend/` (port 3000) · `content/` (Markdown) · `database_init/data/` (YAML catalogue jeu)

---

## Documentation de référence

Lire avant toute modification — mettre à jour après chaque changement :

- @SPECIFICATION.md — fonctionnalités, modèles de données, API endpoints, règles métier Gaslands
- @ARCHITECTURE.md — stack, choix d'architecture, fichiers clés, patterns à respecter

---

## Environnement Windows — Contraintes critiques

**SSL** : préfixer `npm`/`npx` avec `$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"`. git SSL désactivé globalement.

**Nx + TypeScript** : définir `$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"` avant toute commande Nx (déjà dans `dev.ps1`).

**Réseau** : utiliser `127.0.0.1` (pas `localhost`) dans toutes les configs.

---

## Commandes de développement

```powershell
.\dev.ps1                        # démarrer tout l'environnement (recommandé)
npx nx serve backend             # backend seul → http://127.0.0.1:3000/api
npx nx serve frontend            # frontend seul → http://localhost:4200
npx nx test backend              # tests unitaires backend (Vitest)
npx nx test frontend             # tests unitaires frontend (Vitest)
npx nx e2e backend-e2e           # tests E2E backend (axios)
npx nx run frontend:build        # build production
npx nx sync                      # si Nx se plaint de "workspace out of sync"
```

⚠️ Préfixer avec les deux variables d'env Windows ci-dessus.

---

## Conventions non-évidentes

**Angular zoneless** : zone.js absent — toute mise à jour de template doit passer par un Signal (`signal()`, `computed()`). Une mutation directe ne déclenchera pas de re-rendu.

**TypeScript** : typage explicite strict imposé par ESLint (`explicit-function-return-type`, `no-explicit-any`). Exception : variables locales et `*.spec.ts`. ESLint rejettera le code non conforme.

**NestJS** : `import type` pour les interfaces/types dans les signatures décorées (`emitDecoratorMetadata`).

---

## Scaffolding — étapes post-génération

Utiliser le skill `nx-generate` pour les générateurs. Points non-évidents :

- **Module NestJS** : importer dans `app.module.ts`, ajouter l'entité dans la liste `entities` de TypeORM.
- **Composant Angular** : ajouter la route lazy dans [apps/frontend/src/app/app.routes.ts](apps/frontend/src/app/app.routes.ts).
- **Contenu Markdown** : créer `content/<slug>.md` → disponible sans redémarrage via `GET /api/content/<slug>`.
