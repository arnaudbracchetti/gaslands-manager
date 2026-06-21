
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

- @docs/SPECIFICATION.md — index des spécifications (contexte général + table des matières vers les sous-documents thématiques)
  - @docs/spec/AUTH.md — authentification, rôles, compte admin
  - @docs/spec/TEAMS.md — CRUD équipes, verrouillage sponsor
  - @docs/spec/VEHICLES.md — catalogue, construction véhicule, règles métier Gaslands
  - @docs/spec/SEASONS.md — saisons, inscriptions, transitions d'état
  - @docs/spec/NAVIGATION.md — routes Angular, backlog
- @ARCHITECTURE.md — stack, choix d'architecture, fichiers clés, patterns à respecter
- @docs/COMPONENTS.md — catalogue de tous les composants Angular (rôles, inputs/outputs, diagramme Mermaid des dépendances)

---

## Environnement de développement (WSL)

**Dépannage Nx + TypeScript** : si Nx se plaint d'une configuration TypeScript incompatible
(`tsconfig.base.json` contient `composite`/`emitDeclarationOnly`, incompatibles avec Angular),
définir `export NX_IGNORE_UNSUPPORTED_TS_SETUP=true` avant la commande.

---

## Commandes de développement

```bash
./dev.sh                          # démarrer tout l'environnement (recommandé)
npx nx serve backend              # backend seul → http://localhost:3000/api
npx nx serve frontend             # frontend seul → http://localhost:4200
npx nx test backend               # tests unitaires backend (Vitest)
npx nx test frontend               # tests unitaires frontend (Vitest)
npx nx e2e backend-e2e             # tests E2E backend (axios)
npx nx run frontend:build          # build production
npx nx sync                        # si Nx se plaint de "workspace out of sync"
```

---

## Règles Git

- **Ne jamais commiter sans demande explicite** de l'utilisateur.
- **Ne jamais créer de branche sans demande explicite** de l'utilisateur.
- Si plusieurs types de modifications distincts sont présents dans les fichiers modifiés, **proposer de les répartir en plusieurs commits**.

---

## Conventions non-évidentes

**Angular zoneless** : zone.js absent — toute mise à jour de template doit passer par un Signal (`signal()`, `computed()`). Une mutation directe ne déclenchera pas de re-rendu.

**TypeScript** : typage explicite strict imposé par ESLint (`explicit-function-return-type`, `no-explicit-any`). Exception : variables locales et `*.spec.ts`. ESLint rejettera le code non conforme.

**NestJS** : `import type` pour les interfaces/types dans les signatures décorées (`emitDecoratorMetadata`).

**CSS — Design tokens** : couleurs, fonds et opacités d'overlay sont centralisés comme propriétés CSS natives (`--clr-*`) dans le bloc `:root` de `apps/frontend/src/styles.scss`. Ne jamais coder une couleur en dur dans un fichier `.scss` de composant — utiliser `var(--clr-nom)`.

---

## Scaffolding — étapes post-génération

Utiliser le skill `nx-generate` pour les générateurs. Points non-évidents :

- **Module NestJS** : importer dans `app.module.ts`, ajouter l'entité dans la liste `entities` de TypeORM.
- **Composant Angular** : ajouter la route lazy dans [apps/frontend/src/app/app.routes.ts](apps/frontend/src/app/app.routes.ts).
- **Contenu Markdown** : créer `content/<slug>.md` → disponible sans redémarrage via `GET /api/content/<slug>`.
