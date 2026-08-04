---
id: "p0-3-bootstrap-securite-main-ts-2026-08-02"
status: "done"
priority: "critical"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-04T16:20:00.000Z"
completedAt: "2026-08-04T16:20:00.000Z"
labels: ["securite", "auth"]
order: "aJ"
---
# P0-3 — Bootstrap sécurisé de `main.ts`

En tant qu'exploitant de l'application, je veux que le serveur backend
applique les protections HTTP de base (proxy de confiance, en-têtes de
sécurité, limites de taille de corps, CORS restreint), afin qu'il soit prêt à
être placé derrière un reverse proxy public.

## Critères d'acceptation

- [x] `NestFactory.create<NestExpressApplication>(AppModule)` puis
      `app.set('trust proxy', 1)` — exactement un saut (Caddy).
- [x] `app.use(helmet({ contentSecurityPolicy: false }))` — la CSP vit
      uniquement dans Caddy (pas de double source de CSP).
- [x] `app.use(json({ limit: '128kb' }))` +
      `urlencoded({ limit: '16kb' })`.
- [x] CORS configuré depuis `CORS_ORIGIN` (liste séparée par virgules), repli
      `http://localhost:4200` en dev.
- [x] La ligne de log `🚀 Backend Gaslands démarré sur
      http://localhost:${port}/api` est conservée **verbatim** —
      `frontend-e2e/src/support/backend-process.ts` la cherche dans stdout.
- [x] `@Get('health')` ajouté dans `app.controller.ts` (`SELECT 1` via
      `DataSource`), décoré `@SkipThrottle()`, consommé par le healthcheck
      Docker de P0-8.

## Notes

Dépend de P0-2. Prérequis de P0-5 (le throttler doit voir la vraie IP
client via `trust proxy`). Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-3--bootstrap-maints`.
