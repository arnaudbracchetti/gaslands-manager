
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

### Branches du mode campagne

- **Branche `mode-campagne`** : tout ce qui concerne l'implémentation du mode campagne Gaslands (cf. les User Stories de [docs/plans/2026-06-21-mode-campagne-backlog.md](docs/plans/2026-06-21-mode-campagne-backlog.md) et la conception [docs/plans/2026-06-21-mode-campagne-design.md](docs/plans/2026-06-21-mode-campagne-design.md)) doit être commité sur cette branche.
- **Branche `main`** : tout ce qui ne concerne **pas** le mode campagne doit être commité sur `main`.
- **Toujours confirmer la branche cible avant de commiter** : ne jamais commiter sans que l'utilisateur ait validé que le commit part sur la bonne branche.

---

## Conventions non-évidentes

**Angular zoneless** : zone.js absent — toute mise à jour de template doit passer par un Signal (`signal()`, `computed()`). Une mutation directe ne déclenchera pas de re-rendu.

**TypeScript** : typage explicite strict imposé par ESLint (`explicit-function-return-type`, `no-explicit-any`). Exception : variables locales et `*.spec.ts`. ESLint rejettera le code non conforme.

**NestJS — `import type`** : `import type` est réservé aux interfaces pures et aux DTOs. Pour toute classe instanciée par le conteneur NestJS (use cases, services, repositories), utiliser `import { X }` — `emitDecoratorMetadata` émet `Object` pour les `import type`, ce qui cause `UnknownDependenciesException` au démarrage.

**NestJS — DDD et tokens d'injection** : les interfaces TypeScript (`IVehicleRepository`, `ICatalogRepository`) ne sont pas injectables directement. Utiliser des tokens string (voir `vehicle.tokens.ts`) et fournir les use cases en `useFactory` dans le module pour garder le domaine sans décorateurs NestJS.

**TypeORM — `where` sur une relation de collection** : un `where` posé sur une relation `OneToMany`/`ManyToMany` qui est aussi hydratée via `relations` **filtre la collection chargée** — elle ne contiendra que les lignes correspondant au critère, pas toutes. Pour récupérer l'agrégat complet à partir d'un de ses enfants, résoudre d'abord l'`id` du parent (`select: { id: true }`) puis recharger via un find par `id` scalaire (qui, lui, n'altère pas l'hydratation). Modèle : `VehicleRepository.findByWeaponId` → `findByIdForUser`.

**CSS — Design tokens** : couleurs, fonds et opacités d'overlay sont centralisés comme propriétés CSS natives (`--clr-*`) dans le bloc `:root` de `apps/frontend/src/styles.scss`. Ne jamais coder une couleur en dur dans un fichier `.scss` de composant — utiliser `var(--clr-nom)`.

---

## Processus obligatoire avant toute nouvelle fonctionnalité backend

Avant d'écrire la moindre ligne de code, **invoquer le skill `brainstorming`** et répondre aux questions suivantes :

- La fonctionnalité introduit-elle un **nouvel agrégat** (entité racine avec son propre cycle de vie et ses propres règles) ?
- Ou s'agit-il d'une **nouvelle règle métier dans un agrégat existant** (ex : nouvelle contrainte sur `Vehicle`) ?
- Quelles **entités enfants ou Value Objects** sont créés ou modifiés ?
- Quelles **interfaces de repository** évoluent (`IVehicleRepository`, etc.) ?
- Quel **use case** porte la commande ? Y a-t-il plusieurs commandes distinctes ?

Ce brainstorming évite de placer des règles métier au mauvais endroit (controller, repository, service utilitaire). La règle : logique métier → agrégat (`domain/`), orchestration → use case (`application/`), TypeORM/NestJS → infrastructure uniquement.

---

## Scaffolding — étapes post-génération

Utiliser le skill `nx-generate` pour les générateurs. Points non-évidents :

- **Module NestJS simple** : importer dans `app.module.ts`, ajouter l'entité dans la liste `entities` de TypeORM.
- **Module NestJS domaine (DDD)** : créer les dossiers `domain/`, `application/`, `infrastructure/`. Déclarer des tokens d'injection dans `xxx.tokens.ts`. Fournir use cases et mapper en `useFactory` dans le module (voir `vehicle.module.ts` comme modèle).
- **Composant Angular** : ajouter la route lazy dans [apps/frontend/src/app/app.routes.ts](apps/frontend/src/app/app.routes.ts).
- **Contenu Markdown** : créer `content/<slug>.md` → disponible sans redémarrage via `GET /api/content/<slug>`.
