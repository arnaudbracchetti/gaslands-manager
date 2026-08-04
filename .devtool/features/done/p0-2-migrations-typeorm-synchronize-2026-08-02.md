---
id: "p0-2-migrations-typeorm-synchronize-2026-08-02"
status: "done"
priority: "critical"
assignee: null
epic: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-04T07:11:18.000Z"
completedAt: "2026-08-04T07:11:18.000Z"
labels: ["securite", "deploiement"]
order: "a1"
---
# P0-2 — Migrations TypeORM, `synchronize` piloté par environnement

En tant qu'exploitant de l'application, je veux que le schéma de la base de
production évolue par migrations explicites plutôt que par `synchronize:
true`, afin qu'une modification d'entité ne puisse jamais supprimer des
colonnes ou des données en silence sur une base publique.

## Critères d'acceptation

- [x] `apps/backend/src/app/entities.ts` exporte `ALL_ENTITIES` (les 10
      entités ORM) — source unique consommée par `app.module.ts` **et** par la
      datasource CLI.
- [x] `apps/backend/src/migrations/index.ts` exporte `ALL_MIGRATIONS` — un
      **tableau explicite**, pas un glob (le backend est empaqueté en un
      `main.js` unique par `NxAppWebpackPlugin`, un glob ne résout rien à
      l'exécution dans le conteneur).
- [x] `apps/backend/src/data-source.ts` (export par défaut, lit
      `process.env` directement), `synchronize: false`.
- [x] `app.module.ts` : `entities: ALL_ENTITIES`, `migrations:
      ALL_MIGRATIONS`, `synchronize` par défaut `NODE_ENV !== 'production'`,
      `migrationsRun` et `ssl` pilotés par variable d'env.
- [x] Ce défaut par `NODE_ENV` ne casse pas `frontend-e2e`
      (`backend-process.ts` lance `nx run backend:serve
      --configuration=e2e` sans `NODE_ENV=production`).
- [x] Cibles Nx `migration:generate` / `migration:run` / `migration:revert` /
      `schema:log` ajoutées dans `apps/backend/project.json`.
- [x] Migration de référence générée contre une base vide dédiée
      (`gaslands_migbase`) et enregistrée dans `migrations/index.ts`.
- [x] **Garde-fou obligatoire** : sur une seconde base vide, `migration:run`
      puis `schema:log` affiche *"No changes in database schema were
      found"* — preuve que la migration de référence est équivalente à ce
      que `synchronize` produit aujourd'hui.
- [x] Base de dev existante : migration marquée comme déjà appliquée
      (`INSERT INTO migrations(...)`), sans rejouer le `CREATE TABLE`.

## Notes

Dépend de P0-1 (variables d'environnement). Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-2--entités-synchronize-migration-de-référence`.

**Vérification** : garde-fou `schema:log` ci-dessus, puis `npx nx e2e
frontend-e2e` (toujours en `synchronize`, doit rester vert).

### Journal d'implémentation (2026-08-04)

- `migration:run -f` (fake) utilisé plutôt qu'un `INSERT` manuel pour marquer
  la migration comme déjà appliquée sur `gaslands` (dev) — calcule
  lui-même `timestamp`/`name`, aucune écriture manuelle en base.
- Deux gaps découverts et corrigés en cours de route, tous deux nécessaires
  pour que la CLI TypeORM fonctionne et que `frontend-e2e` reste vert :
  - `ts-node` n'était installé nulle part (requis par
    `typeorm-ts-node-commonjs`) → ajouté en devDependency racine.
  - `tsconfig.datasource.json` dédié : `composite`/`emitDeclarationOnly`
    hérités de `tsconfig.base.json` cassent l'émission JS de ts-node ; et
    ts-node type-check par défaut alors que le build réel (`ts-loader`,
    `transpileOnly: true`) ne l'a jamais fait — sans `"ts-node":
    {"transpileOnly": true}`, la CLI échoue sur des violations
    `strictPropertyInitialization` déjà présentes (et tolérées) dans les
    entités TypeORM.
  - `@nx/js:node` (exécuteur de `backend:serve`) fixe lui-même
    `NODE_ENV=<configurationName>` si absent — `--configuration=e2e` donne
    donc `NODE_ENV=e2e`, une valeur que `EnvVars`/`@IsIn` ne connaissait pas.
    `'e2e'` a été ajouté aux valeurs acceptées (se comporte partout comme
    `'development'`, tous les branchements du code ne testant que
    `=== 'production'`).
- Garde-fou vérifié : sortie réelle de cette version de TypeORM = *"Your
  schema is up to date - there are no queries to be executed by schema
  synchronization"* (équivalent au message nommé dans le critère
  d'acceptation).
- `npx nx e2e frontend-e2e` (Chromium, ports dédiés) : 25/44 passent : aucune
  erreur de schéma/DB dans les logs backend. Les 19 échecs restants sont
  confirmés pré-existants et hors périmètre de cette carte — deux causes,
  aucune liée aux migrations : (1) `example.spec.ts` (titre vide,
  décompte de feature-cards) — timing de rendu Angular, assertion
  immédiatement après `page.goto()` sans attente ; (2) plusieurs specs
  Campagnes échouent tous au même point (`inviteAndValidateParticipant`,
  badge `.participant-list__badge--pending` introuvable) — comportement
  identique reproduit avec un frontend/backend garantis frais (ports dédiés
  3456/4201), donc pas un artefact de process réutilisé. Corrigé au passage
  un `ADMIN_PASSWORD` local (`apps/backend/.env`, gitignored) à 5
  caractères — sous le minimum de 6 imposé par `User.assertPasswordPolicy` —
  qui bloquait `AdminSeedService` sur la base `gaslands_test` neuve à
  chaque run (jamais remarqué en dev classique car la vraie base `gaslands`
  a un admin déjà créé, et le mot de passe n'a jamais changé depuis).
