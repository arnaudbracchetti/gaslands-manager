---
id: "p0-2-migrations-typeorm-synchronize-2026-08-02"
status: "backlog"
priority: "critical"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-02T05:39:41.000Z"
completedAt: null
labels: ["securite", "deploiement"]
order: "aI"
---
# P0-2 — Migrations TypeORM, `synchronize` piloté par environnement

En tant qu'exploitant de l'application, je veux que le schéma de la base de
production évolue par migrations explicites plutôt que par `synchronize:
true`, afin qu'une modification d'entité ne puisse jamais supprimer des
colonnes ou des données en silence sur une base publique.

## Critères d'acceptation

- [ ] `apps/backend/src/app/entities.ts` exporte `ALL_ENTITIES` (les 10
      entités ORM) — source unique consommée par `app.module.ts` **et** par la
      datasource CLI.
- [ ] `apps/backend/src/migrations/index.ts` exporte `ALL_MIGRATIONS` — un
      **tableau explicite**, pas un glob (le backend est empaqueté en un
      `main.js` unique par `NxAppWebpackPlugin`, un glob ne résout rien à
      l'exécution dans le conteneur).
- [ ] `apps/backend/src/data-source.ts` (export par défaut, lit
      `process.env` directement), `synchronize: false`.
- [ ] `app.module.ts` : `entities: ALL_ENTITIES`, `migrations:
      ALL_MIGRATIONS`, `synchronize` par défaut `NODE_ENV !== 'production'`,
      `migrationsRun` et `ssl` pilotés par variable d'env.
- [ ] Ce défaut par `NODE_ENV` ne casse pas `frontend-e2e`
      (`backend-process.ts` lance `nx run backend:serve
      --configuration=e2e` sans `NODE_ENV=production`).
- [ ] Cibles Nx `migration:generate` / `migration:run` / `migration:revert` /
      `schema:log` ajoutées dans `apps/backend/project.json`.
- [ ] Migration de référence générée contre une base vide dédiée
      (`gaslands_migbase`) et enregistrée dans `migrations/index.ts`.
- [ ] **Garde-fou obligatoire** : sur une seconde base vide, `migration:run`
      puis `schema:log` affiche *"No changes in database schema were
      found"* — preuve que la migration de référence est équivalente à ce
      que `synchronize` produit aujourd'hui.
- [ ] Base de dev existante : migration marquée comme déjà appliquée
      (`INSERT INTO migrations(...)`), sans rejouer le `CREATE TABLE`.

## Notes

Dépend de P0-1 (variables d'environnement). Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-2--entités-synchronize-migration-de-référence`.

**Vérification** : garde-fou `schema:log` ci-dessus, puis `npx nx e2e
frontend-e2e` (toujours en `synchronize`, doit rester vert).
