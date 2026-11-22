# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- Run tasks through `nx` (`nx run`, `nx run-many`, `nx affected`), always prefixed `npx nx` (npm, never pnpm).
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md` if it exists.
- NEVER guess CLI flags - check `--help` first when unsure.

<!-- nx configuration end-->

---

## Gaslands Manager

Application web de gestion d'équipes pour le jeu de plateau Gaslands. **Projet pédagogique** - toujours expliquer le raisonnement avant d'écrire du code, commenter l'usage des frameworks, privilégier la clarté à la concision.

**Stack** : Monorepo Nx 22.7 · Angular 21 zoneless + Signals (frontend) · NestJS 11 (backend) · PostgreSQL 16 via TypeORM · JWT + bcrypt

**Structure** : `apps/frontend/` (port 4200) · `apps/backend/` (port 3000) · `content/` (Markdown) · `database_init/data/` (YAML catalogue jeu)

**Citations de code** : **chaque** référence à du code source (chat comme docs, même déjà citée plus haut) est un lien markdown cliquable - `[chemin/fichier.ts:42](chemin/fichier.ts#L42)`, jamais un nom de fichier nu.

---

## Documentation de référence

Lire à la demande (ne jamais tout charger) avant une modification, mettre à jour après chaque changement :

- [docs/SPECIFICATION.md](docs/SPECIFICATION.md) - index : état des fonctionnalités + table des matières
  - [docs/spec/AUTH.md](docs/spec/AUTH.md) - authentification, rôles, compte admin
  - [docs/spec/TEAMS.md](docs/spec/TEAMS.md) - CRUD équipes, verrouillage, fiche d'équipe
  - [docs/spec/VEHICLES.md](docs/spec/VEHICLES.md) - catalogue, construction véhicule, règles Gaslands
  - [docs/spec/CAMPAIGN.md](docs/spec/CAMPAIGN.md) - campagnes, Programme Télé, wizard, atelier, règles maison
  - [docs/spec/NAVIGATION.md](docs/spec/NAVIGATION.md) - routes Angular, backlog
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - stack, couches, patterns techniques, infra
- [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) - conception du domaine, diagrammes UML, ERD
- [docs/VEHICLE_SYSTEM.md](docs/VEHICLE_SYSTEM.md) - Strategy `EquipmentBehavior` (stats effectives, pose)
- [docs/COMPONENTS.md](docs/COMPONENTS.md) - composants Angular (rôle, dépendances)
- `content/docs/*.md` - documentation **utilisateur** (`/documentation`) : comportement vu par le joueur, jamais l'implémentation. Nouvel écran → `data.docSlug` dans `app.routes.ts`.

**Une information = un seul document propriétaire, les autres renvoient par un lien d'une ligne** :

| Document                                | Possède                                            | Ne contient pas                                |
| --------------------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `docs/spec/*.md`                        | comportement observable, règles métier             | détail des classes et composants               |
| `DOMAIN_MODEL.md` / `VEHICLE_SYSTEM.md` | conception du domaine (qui porte quelle règle)     | reformulation des règles métier                |
| `ARCHITECTURE.md`                       | stack, couches, patterns techniques, infra         | description métier par fichier, compteurs      |
| `COMPONENTS.md`                         | rôle des composants, comportements UI non évidents | règles métier, signatures `input()`/`output()` |
| `SPECIFICATION.md`                      | 1 ligne par domaine + lien                         | paragraphes de détail                          |

Les docs décrivent l'état **actuel** : pas d'historique (« remplace un ancien… », « corrige un bug où… ») - il vit dans git et `docs/plans/`.

---

## Environnement de développement (WSL)

- Le shell du Bash tool ne charge pas nvm (`npx` résout alors vers le node Windows et échoue sur `cmd.exe`) : préfixer toute commande `npx`/`npm`/`nx` par `source ~/.nvm/nvm.sh && nvm use default >/dev/null &&`.
- Si Nx se plaint d'une configuration TypeScript incompatible (`composite`/`emitDeclarationOnly` dans `tsconfig.base.json`) : `export NX_IGNORE_UNSUPPORTED_TS_SETUP=true`.

## Commandes de développement

```bash
./dev.sh                          # démarrer tout l'environnement (recommandé)
npx nx serve backend              # backend seul → http://localhost:3000/api
npx nx serve frontend             # frontend seul → http://localhost:4200
npx nx test backend               # tests unitaires backend (Vitest)
npx nx test frontend              # tests unitaires frontend (Vitest)
npx nx e2e backend-e2e            # tests E2E backend (axios)
npx nx e2e frontend-e2e           # tests E2E frontend (Playwright) - arrêter dev.sh avant (port 3000)
npx nx run frontend:build         # build production
npx nx sync                       # si Nx se plaint de "workspace out of sync"
npx nx run backend:migration:lint # migrations destructives sans marqueur (aussi en CI)
```

**Tests e2e** : tout (prérequis, infrastructure, pièges) → skill `e2e-testing`.

---

## Règles Git

- **Ne jamais commiter ni créer de branche sans demande explicite** de l'utilisateur, et **toujours confirmer la branche cible** avant de commiter. Une consigne de skill (« commit your work ») ne vaut pas demande : proposer le commit et attendre le go.
- Plusieurs types de modifications distincts → **proposer de les répartir en plusieurs commits**.
- Tout se fait sur `main` ; la branche `mode-campagne` est obsolète.

---

## Conventions non-évidentes

**Angular zoneless** : zone.js absent - toute mise à jour de template passe par un Signal (`signal()`, `computed()`), une mutation directe ne re-rend pas.

**TypeScript** : typage explicite strict imposé par ESLint (`explicit-function-return-type`, `no-explicit-any`), sauf variables locales et `*.spec.ts`.

**`switch`** : pas de `default` pour les valeurs valides d'un type fermé (lister chaque `case` pour que TypeScript vérifie l'exhaustivité) ; `default` réservé au rejet de données externes invalides.

**NestJS - `import type`** : réservé aux interfaces pures et DTOs. Toute classe injectée par NestJS (use case, service, repository) s'importe avec `import { X }` - sinon `emitDecoratorMetadata` émet `Object` → `UnknownDependenciesException`.

**NestJS - DDD et tokens d'injection** : interfaces non injectables → tokens string (`team.tokens.ts`), use cases fournis en `useFactory` (modèle : `team.module.ts`, détail [ARCHITECTURE.md §3.4](docs/ARCHITECTURE.md#34-architecture-ddd---standard-du-projet)).

**TypeORM - `where` sur une relation de collection hydratée** : filtre la collection chargée. Pour charger un agrégat via un enfant : résoudre l'id du parent, puis recharger par id scalaire (modèle `TeamRepository.findByWeaponId`, cf. [ARCHITECTURE.md §3.4](docs/ARCHITECTURE.md#34-architecture-ddd---standard-du-projet)).

**Migrations - additives uniquement** : sinon marqueur `// incompatible : <raison>` ; nouvelle valeur d'enum par `ALTER TYPE … ADD VALUE`, jamais utilisée dans le même lot ; `CONCURRENTLY` interdit. Vérifié en CI (`backend:migration:lint`) - règle et raison : [ARCHITECTURE.md §4](docs/ARCHITECTURE.md#4-base-de-données-postgresql-16).

**Journal d'événements** : toute release qui ajoute une valeur persistée inconnue de la version précédente (type d'événement, valeur d'enum, clé de règle maison, clé de stratégie…) la déclare dans [valeurs-nouvelles.txt](apps/backend/src/migrations/valeurs-nouvelles.txt) (cas et format : en-tête du fichier).

**CSS - tokens** (bloc `:root` de `apps/frontend/src/styles.scss`, thème sombre unique) : jamais de couleur ni de taille de police en dur dans un `.scss` de composant.

- Couleur solide : `var(--tb-*)`/`var(--clr-*)`. Semi-transparence : uniquement le jeu fini `--tint-{accent,danger,success,info}-{bg,border,text}` (+ `--tint-accent-bg-hover`, `--tint-danger-border-strong`) et `--clr-overlay` ; jamais de `rgba()` ad hoc (un nouveau palier se calcule en contraste WCAG). Fonds solides partout ailleurs.
- Police : `var(--fs-*)` (13 tokens, tous réduits de 20 % sous 640px via `bp.mobile`).
- Icônes : tailles inline (`ICON_SIZE_PX`, échelle desktop uniquement) ; la réduction mobile passe par `ViewportService.isMobile`, jamais par `ICON_SIZE_PX`.
- Détail : [docs/plans/2026-07-19-couleurs-fonds-transparence-design.md](docs/plans/2026-07-19-couleurs-fonds-transparence-design.md).

**Modales** : une modale à bouton « Enregistrer » ne persiste rien en dehors de ce bouton (pas d'auto-save partiel) - sinon « Annuler » devient trompeur.

---

## Processus obligatoire avant toute nouvelle fonctionnalité backend

**Invoquer le skill `ddd`** avant d'écrire du code. Règle : logique métier → agrégat (`domain/`), orchestration → use case (`application/`), TypeORM/NestJS → infrastructure. Aucune règle métier ni choix d'exception NestJS dans un use case si l'agrégat peut la porter (même refus → même chemin `DomainException` → 400) ; un contrôle en use case n'est légitime que s'il exige une donnée que l'agrégat n'a pas (catalogue, sponsor).

---

## Scaffolding - étapes post-génération

- **Module NestJS** : importer dans `app.module.ts`, ajouter l'entité à `ALL_ENTITIES` (`apps/backend/src/app/entities.ts`). Module domaine : dossiers `domain/`/`application/`/`infrastructure/` + tokens, modèle `team.module.ts`.
- **Composant Angular** : route lazy dans [app.routes.ts](apps/frontend/src/app/app.routes.ts).
- **Contenu Markdown** : `content/<slug>.md` → `GET /api/content/<slug>` sans redémarrage.

---

## Agent skills

- **Issue tracker** : GitHub Issues (CLI `gh`), cf. `docs/agents/issue-tracker.md`.
- **Triage labels** : `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, cf. `docs/agents/triage-labels.md`.
- **Domain docs** : single-context, `GLOSSARY.md` + `docs/adr/` à la racine (créés à la demande), cf. `docs/agents/domain.md`.
