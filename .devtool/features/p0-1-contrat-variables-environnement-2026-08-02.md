---
id: "p0-1-contrat-variables-environnement-2026-08-02"
status: "todo"
priority: "critical"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-02T05:39:41.000Z"
completedAt: null
labels: ["securite", "deploiement"]
order: "a1"
---
# P0-1 — Contrat de variables d'environnement

En tant qu'exploitant de l'application, je veux que le backend refuse de
démarrer avec une configuration incomplète ou dangereuse (secret par défaut,
mot de passe faible), afin qu'un déploiement en production ne puisse jamais
tourner silencieusement avec des valeurs de développement.

## Critères d'acceptation

- [ ] `apps/backend/src/app/config/env.validation.ts` : classe `EnvVars`
      (`class-validator`) + fonction `validateEnv(raw): EnvVars`
      (`plainToInstance` + `validateSync`), branchée dans
      `ConfigModule.forRoot({ validate: validateEnv, cache: true })`.
- [ ] Toujours requis : `DATABASE_{HOST,PORT,USER,PASSWORD,NAME}`,
      `JWT_SECRET`, `ADMIN_EMAIL` (`@IsEmail()`), `ADMIN_PASSWORD`.
- [ ] `NODE_ENV` : `@IsIn(['development','test','production'])`, défaut
      `development`.
- [ ] Requis uniquement en production (`@ValidateIf`) : `TURNSTILE_SECRET_KEY`,
      `CORS_ORIGIN`, plus `@MinLength(32)` et `@NotEquals('change_me')` sur
      `JWT_SECRET` / `ADMIN_PASSWORD` / `DATABASE_PASSWORD`.
- [ ] Optionnels avec défaut : `JWT_EXPIRATION`, `PORT`, `CONTENT_DIR`,
      `DB_SYNCHRONIZE`, `DB_MIGRATIONS_RUN`, `DB_SSL`, `THROTTLE_*`.
- [ ] `auth.module.ts` et `jwt.strategy.ts` : `config.getOrThrow('JWT_SECRET')`
      (suppression du `!` et du commentaire trompeur qui prétend que
      l'absence fait déjà crasher le démarrage).
- [ ] `.env.example` (racine) mis à jour : `JWT_SECRET`, `JWT_EXPIRATION`,
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
