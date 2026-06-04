
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

## Conventions TypeScript — Typage explicite obligatoire

Le projet applique une politique de **typage explicite strict**, renforcée par ESLint (`eslint.config.mjs`).

### Règles actives (erreur si violation)

| Règle | Effet |
|---|---|
| `explicit-function-return-type` | Type de retour obligatoire sur toutes les fonctions/méthodes |
| `explicit-module-boundary-types` | Idem sur les exports publics |
| `no-explicit-any` | `any` interdit — utiliser `unknown` + narrowing |
| `typedef (parameter)` | Type obligatoire sur les paramètres de fonction |
| `typedef (memberVariableDeclaration)` | Type obligatoire sur les membres de classe |

### Patterns à respecter dans tout nouveau code

**Membres de classe Angular (inject, signals) :**
```typescript
// ✅ Correct
private readonly http: HttpClient = inject(HttpClient);
readonly loading: WritableSignal<boolean> = signal(false);
readonly isLoggedIn: Signal<boolean> = computed(() => ...);
readonly teams: InputSignal<Team[]> = input<Team[]>([]);
readonly saved: OutputEmitterRef<Team> = output<Team>();

// ❌ Interdit
private readonly http = inject(HttpClient);
readonly loading = signal(false);
```

**Types de retour sur toutes les fonctions :**
```typescript
// ✅ Correct
async getAll(): Promise<Team[]> { ... }
ngOnInit(): void { ... }
getData(): { message: string } { ... }

// ❌ Interdit
async getAll() { ... }
ngOnInit() { ... }
```

**Paramètres de callback :**
```typescript
// ✅ Correct
.filter((f: string) => f.endsWith('.md'))
subscribe({ next: (teams: Team[]) => { ... }, error: (err: HttpErrorResponse) => { ... } })
tap((res: AuthResponse) => { ... })

// ❌ Interdit
.filter((f) => ...)
subscribe({ next: (teams) => { ... }, error: (err) => { ... } })
```

**Blocs catch :**
```typescript
// ✅ Correct — unknown + narrowing
catch (err: unknown) {
  const pgError = err as { code?: string };
  if (pgError?.code === '23505') { ... }
}

// ❌ Interdit
catch (err: any) { ... }
catch (err) { ... }
```

**`import type` pour NestJS (emitDecoratorMetadata) :**
```typescript
// ✅ Correct — interfaces et type aliases utilisés dans des signatures décorées
import { type AuthResponse, AuthService } from './auth.service';
import type { SafeUser } from './user.service';

// Les classes ont une représentation runtime → import normal
import { RegisterDto } from './dto/register.dto';
```

### Exemptions intentionnelles

- `variableDeclaration: false` — les variables locales inférées ne sont PAS annotées (`const x = foo()` OK)
- Les fichiers `*.spec.ts` sont exemptés de `explicit-function-return-type` et `typedef`
- `no-inferrable-types` est désactivé (contradisait `typedef memberVariableDeclaration`)

---

## Documentation de référence

Lire SPECIFICATION.md et ARCHITECTURE.md fichiers avant toute modification. 
Les mettre à jour SPECIFICATION.md et ARCHITECTURE.md a chaque modification.

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
