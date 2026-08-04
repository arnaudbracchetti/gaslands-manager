---
id: "p0-1-contrat-variables-environnement-2026-08-02"
status: "done"
priority: "critical"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-03T21:35:25.000Z"
completedAt: "2026-08-03T21:35:25.000Z"
labels: ["securite", "deploiement"]
order: "a1"
---
# P0-1 — Contrat de variables d'environnement

En tant qu'exploitant de l'application, je veux que le backend refuse de
démarrer avec une configuration incomplète ou dangereuse (secret par défaut,
mot de passe faible), afin qu'un déploiement en production ne puisse jamais
tourner silencieusement avec des valeurs de développement.

## Critères d'acceptation

- [x] `apps/backend/src/app/config/env.validation.ts` : classe `EnvVars`
      (`class-validator`) + fonction `validateEnv(raw): EnvVars`
      (`plainToInstance` + `validateSync`), branchée dans
      `ConfigModule.forRoot({ validate: validateEnv, cache: true })`.
- [x] Toujours requis : `DATABASE_{HOST,PORT,USER,PASSWORD,NAME}`,
      `JWT_SECRET`, `ADMIN_EMAIL` (`@IsEmail()`), `ADMIN_PASSWORD`.
- [x] `NODE_ENV` : `@IsIn(['development','test','production'])`, défaut
      `development`.
- [x] Requis uniquement en production (`@ValidateIf`) : `TURNSTILE_SECRET_KEY`,
      `CORS_ORIGIN`, plus `@MinLength(32)` et `@NotEquals('change_me')` sur
      `JWT_SECRET` / `ADMIN_PASSWORD` / `DATABASE_PASSWORD`.
- [x] Optionnels avec défaut : `JWT_EXPIRATION`, `PORT`, `CONTENT_DIR`,
      `DB_SYNCHRONIZE`, `DB_MIGRATIONS_RUN`, `DB_SSL`, `THROTTLE_*`.
- [x] `auth.module.ts` et `jwt.strategy.ts` : `config.getOrThrow('JWT_SECRET')`
      (suppression du `!` et du commentaire trompeur qui prétend que
      l'absence fait déjà crasher le démarrage).
- [x] `.env.example` (racine) mis à jour : `JWT_SECRET`, `JWT_EXPIRATION`,
      `ADMIN_*`, `TURNSTILE_SECRET_KEY`, `CORS_ORIGIN`, `PUBLIC_DOMAIN`,
      `LETSENCRYPT_EMAIL`, `THROTTLE_*`, `DB_SYNCHRONIZE=false`,
      `DB_MIGRATIONS_RUN=true`, avec un commentaire distinguant le `.env`
      racine (Compose) de `apps/backend/.env` (`nx serve`).

## Notes

Premier item de la chaîne P0 (bloque tout le reste — rien n'est testable tant
que le conteneur backend ne démarre pas). Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-1--contrat-de-variables-denvironnement`.

**Vérification** : `unset JWT_SECRET && npx nx serve backend` doit échouer au
démarrage avec la variable **nommée**, pas une pile d'appels. Idem avec
`JWT_SECRET=change_me` en `NODE_ENV=production`.

**Implémentation (2026-08-03)** :
- `class-validator`/`class-transformer` ajoutés en `dependencies`.
- Piège rencontré : `@ValidateIf(condition)` désactive **tous** les
  décorateurs de la propriété (pas seulement ceux placés après lui) quand la
  condition est fausse — empilé sur un champ déjà `@IsNotEmpty()` (toujours
  requis), il aurait aussi désactivé cette règle de base hors production.
  Les 3 secrets "toujours requis ET renforcés en production"
  (`JWT_SECRET`/`ADMIN_PASSWORD`/`DATABASE_PASSWORD`) sont donc validés en
  deux passes : décorateurs de base inconditionnels + vérification manuelle
  (longueur/`change_me`) dans `validateEnv()` quand `NODE_ENV === 'production'`.
  `@ValidateIf` reste utilisé tel quel pour `TURNSTILE_SECRET_KEY`/
  `CORS_ORIGIN` (entièrement conditionnels, aucun autre décorateur empilé).
- Vérifié en conditions réelles (build + exécution du bundle) : démarrage
  sans `JWT_SECRET` → `Error: Configuration d'environnement invalide :
  JWT_SECRET should not be empty, JWT_SECRET must be a string` ; démarrage
  `NODE_ENV=production` avec `JWT_SECRET=change_me` → erreur nommant
  `JWT_SECRET`, `DATABASE_PASSWORD`, `ADMIN_PASSWORD`, `CORS_ORIGIN`,
  `TURNSTILE_SECRET_KEY` ; démarrage avec le `.env` de dev existant →
  validation passe, échec attendu uniquement sur la connexion Postgres
  (non démarré dans cette session).
- Nouveau test `env.validation.spec.ts` (7 cas). `npx nx test backend` :
  847/847 verts. `npx nx build backend` : succès. Erreurs pré-existantes de
  `lint`/`typecheck` backend (fichiers `team/`, hors périmètre de cette
  carte) confirmées présentes sur `main` avant ce changement (`git stash`) —
  aucune régression introduite.
