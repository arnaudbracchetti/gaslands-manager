---
id: "p0-5-limite-de-debit-throttler-2026-08-02"
status: "backlog"
priority: "critical"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-02T05:39:41.000Z"
completedAt: null
labels: ["securite", "auth"]
order: "aL"
---
# P0-5 — Limite de débit (`@nestjs/throttler`)

En tant qu'exploitant de l'application, je veux limiter le nombre de requêtes
par IP sur les routes sensibles, afin que `/auth/login` et `/auth/register`
ne restent pas ouverts au bourrage d'identifiants et à la création de comptes
en masse.

## Critères d'acceptation

- [ ] `@nestjs/throttler` installé en `dependencies`, `ThrottlerModule.forRootAsync`
      + `{ provide: APP_GUARD, useClass: ThrottlerGuard }` dans `app.module.ts`.
- [ ] Limites appliquées :
  - [ ] Global : 300 / 60 s par IP.
  - [ ] `POST /auth/login` : 5 / 60 s **et** 20 / 3600 s (double fenêtre).
  - [ ] `POST /auth/register` : 3 / 3600 s.
  - [ ] `PATCH /auth/me/password` : 5 / 300 s.
  - [ ] `GET /api/health` : `@SkipThrottle()`.
- [ ] `frontend-e2e` neutralisé via `skipIf: () => config.get('NODE_ENV') !==
      'production'` dans la factory du throttler (un seul interrupteur,
      aucun contournement par test). Limites pilotées par `THROTTLE_*`.
- [ ] Contre-mesure Caddy contre le contournement de `trust proxy` :
      `header_up X-Forwarded-For {http.request.remote.host}` +
      `header_up X-Real-IP {http.request.remote.host}` (écraser, pas ajouter)
      dans le Caddyfile de P0-8, et `/api/*` routé **directement** vers
      `backend:3000` (jamais via le conteneur nginx).

## Notes

Dépend de P0-3 (`trust proxy`). Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-5--limite-de-débit`.

**Vérification** : `npx nx e2e frontend-e2e` doit rester vert (preuve que
`skipIf` fonctionne). En `NODE_ENV=production` local : 8 `POST /auth/login`
en boucle → `401 ×5` puis `429`. Derrière Caddy,
`curl -H 'X-Forwarded-For: 1.2.3.4'` en boucle doit **quand même** atteindre
la limite.
