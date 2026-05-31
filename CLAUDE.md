
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

## Type de projet — Apprentissage

Ce projet est un **support pédagogique** : l'utilisateur monte en compétences sur la stack technique.

- **Toujours expliquer le raisonnement** avant d'écrire du code
- **Commenter le code** pour expliquer l'usage des frameworks (Angular Signals, NestJS DI, TypeORM, JWT…)
- Privilégier la clarté à la concision quand les deux s'opposent

---

## Documentation de référence

> Lire SPECIFICATION.md et ARCHITECTURE.md fichiers avant toute modification. 
> Les mettre à jour SPECIFICATION.md et ARCHITECTURE.md quand le projet évolue.

- [SPECIFICATION.md](SPECIFICATION.md) — Fonctionnalités, modèles de données, API endpoints, règles métier Gaslands
- [ARCHITECTURE.md](ARCHITECTURE.md) — Stack technique, choix d'architecture, points d'attention, patterns à respecter

---

## Environnement Windows — Contraintes critiques

**SSL non vérifié** — préfixer toutes les commandes `npm`/`npx` :
```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
```

**git SSL** : désactivé globalement (`git config --global http.sslVerify false`).

**TypeScript incompatibilité** — définir avant chaque commande Nx :
```powershell
$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
```

**IPv4 obligatoire** : utiliser `127.0.0.1` (pas `localhost`) dans toutes les configs réseau.

---

## Commandes de développement

```powershell
# Démarrer tout l'environnement de dev (recommandé)
.\dev.ps1

# Manuellement :
docker compose up -d postgres                                          # PostgreSQL uniquement

$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"; $env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
npx nx serve backend    # → http://localhost:3000/api
npx nx serve frontend   # → http://localhost:4200

# Build de production
npx nx run frontend:build
npx nx run backend:build

# Synchroniser TypeScript (si Nx se plaint de "workspace out of sync")
npx nx sync
```

---

## Scaffolding

### Nouveau module NestJS

```powershell
$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
npx nx g @nx/nest:module --name=<nom> --project=backend
npx nx g @nx/nest:controller --name=<nom> --project=backend
npx nx g @nx/nest:service --name=<nom> --project=backend
```

Puis : importer dans `app.module.ts` et ajouter l'entité dans la liste `entities` de TypeORM.

### Nouveau composant Angular

```powershell
$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
npx nx g @nx/angular:component --name=<nom> --project=frontend --standalone
```

Puis : ajouter la route lazy-loaded dans [apps/frontend/src/app/app.routes.ts](apps/frontend/src/app/app.routes.ts).

### Nouveau contenu Markdown

Créer `content/<slug>.md` → disponible immédiatement via `GET /api/content/<slug>` sans redémarrage.
