
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
## Type de projet

Ce projet est un projet pour que l'utilisateur puisse apprendre et monter en compétence sur la stack technique. Tu devras expliquer ton raisonnement et utiliser des commentaire dans le code pour expliquer les utilisation des différent framework que tu utilise. 


---

## Projet : Gaslands Manager

Application web de gestion d'équipes pour le jeu de figurines **Gaslands** (course automobile post-apocalyptique).

## Environnement Windows — Contraintes critiques

**SSL non vérifié** : le réseau intercepte les connexions HTTPS. Toujours préfixer les commandes npm/npx avec :
```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
```

**git SSL** : désactivé globalement (`git config --global http.sslVerify false`).

**TypeScript incompatibilité** : `tsconfig.base.json` contient des options de project references (`composite`, `emitDeclarationOnly`) incompatibles avec Angular. Toujours définir :
```powershell
$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
```
Ces options sont déjà surchargées dans [apps/frontend/tsconfig.app.json](apps/frontend/tsconfig.app.json).

## Commandes de développement

```powershell
# Démarrer tout l'environnement de dev en une commande (ouvre 2 fenêtres PowerShell)
.\dev.ps1

# Ou manuellement :

# Démarrer PostgreSQL uniquement (Docker requis)
docker compose up -d postgres

# Démarrer le backend NestJS  →  http://localhost:3000/api
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"; $env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
npx nx serve backend

# Démarrer le frontend Angular  →  http://localhost:4200
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"; $env:NX_IGNORE_UNSUPPORTED_TS_SUPPORT = "true"
npx nx serve frontend

# Build de production
npx nx run frontend:build
npx nx run backend:build

# Synchroniser les références TypeScript (à lancer si Nx se plaint de "workspace out of sync")
npx nx sync
```

## Architecture

Monorepo Nx avec deux applications et un dossier de contenu :

```
apps/frontend/   → Angular 21, standalone components, lazy routing
apps/backend/    → NestJS 11, API REST sur /api/*
content/         → Fichiers Markdown servis par le backend
```

### Flux de données Markdown → HTML

`content/*.md` → lus par `ContentService` → convertis via `marked` → API `GET /api/content/:slug` → `Rules` component Angular → `[innerHTML]`

### Backend NestJS (`apps/backend/src/app/`)

- **`app.module.ts`** : racine ; importe `ConfigModule` (`.env`), `TypeOrmModule` (PostgreSQL), `ContentModule`, `TeamModule`
- **`content/`** : lit les fichiers `content/*.md` depuis `process.cwd()` + `CONTENT_DIR` (.env)
- **`team/team.entity.ts`** : entité TypeORM avec `synchronize: true` (tables créées automatiquement — dev uniquement)
- Variables d'environnement dans `apps/backend/.env` (ne pas committer)

#### Contraintes NestJS sur Windows

- **`app.listen(port, '0.0.0.0')`** obligatoire dans `main.ts` : sans `'0.0.0.0'`, Node.js bind sur `::` (IPv6 uniquement) et les connexions IPv4 (`127.0.0.1`) sont refusées — cassant le proxy Vite et Docker.
- **`CONTENT_DIR=content`** dans `.env` : chemin relatif à `process.cwd()` qui est la **racine du workspace** lors d'un `nx serve`. Ne pas mettre `../../content` (relatif à `apps/backend/`).

### Frontend Angular (`apps/frontend/src/app/`)

- Fichiers nommés sans suffixe `.component` (convention Nx/Angular 19+) : `app.ts`, `home.ts`, etc.
- Proxy `/api/*` → `http://127.0.0.1:3000` (pas `localhost` — IPv6/IPv4 conflict sur Windows) configuré dans [apps/frontend/proxy.conf.json](apps/frontend/proxy.conf.json)
- `HttpClient` activé via `provideHttpClient()` dans [apps/frontend/src/app/app.config.ts](apps/frontend/src/app/app.config.ts)
- Routes lazy-loaded dans [apps/frontend/src/app/app.routes.ts](apps/frontend/src/app/app.routes.ts)

#### Angular 21 — Modèle Zoneless + Signals (IMPORTANT)

Ce projet est **zoneless** : `zone.js` n'est PAS installé ni utilisé.

- `app.config.ts` déclare `provideZonelessChangeDetection()` (Angular 21 — anciennement `provideExperimentalZonelessChangeDetection` en Angular 19)
- Sans signals, les propriétés classiques ne déclenchent **pas** de mise à jour du template après une opération async (HTTP, timer…)
- **Toujours utiliser `signal()` pour les états réactifs** dans les composants :

```typescript
// ❌ Ne fonctionne PAS en zoneless
loading = true;
// ✅ Correct
loading = signal(true);
this.loading.set(false); // déclenche le re-rendu
```

- Utiliser la nouvelle syntaxe de template `@if` / `@for` (pas `*ngIf` / `*ngFor`) :

```html
@if (loading()) { <span>Chargement...</span> }
@else { <div [innerHTML]="html()"></div> }
```

- Les signals se lisent comme des fonctions dans le template : `loading()`, `html()`, etc.

### Base de données

PostgreSQL 16 via Docker Compose. Credentials dans `docker-compose.yml` et `apps/backend/.env` :
- user: `gaslands` / password: `gaslands_pass` / db: `gaslands` / port: `5432`

## Ajouter un nouveau module NestJS

```powershell
$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
npx nx g @nx/nest:module --name=<nom> --project=backend
npx nx g @nx/nest:controller --name=<nom> --project=backend
npx nx g @nx/nest:service --name=<nom> --project=backend
```

Puis importer le module dans `app.module.ts` et ajouter l'entité à la liste `entities` de TypeORM.

## Ajouter une nouvelle page Angular

```powershell
$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
npx nx g @nx/angular:component --name=<nom> --project=frontend --standalone
```

Puis ajouter la route lazy-loaded dans [apps/frontend/src/app/app.routes.ts](apps/frontend/src/app/app.routes.ts).

## Ajouter du contenu Markdown

Créer un fichier `content/<slug>.md`. Il sera automatiquement disponible via `GET /api/content/<slug>` sans redémarrage du backend.
