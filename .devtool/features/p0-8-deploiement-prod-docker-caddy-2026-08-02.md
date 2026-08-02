---
id: "p0-8-deploiement-prod-docker-caddy-2026-08-02"
status: "backlog"
priority: "critical"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-02T05:39:41.000Z"
completedAt: null
labels: ["securite", "deploiement"]
order: "aO"
---
# P0-8 — Déploiement production (Docker Compose + Caddy/TLS)

En tant qu'exploitant de l'application, je veux un déploiement Docker Compose
de production qui n'expose que les ports 80/443, avec TLS automatique et des
en-têtes de sécurité, afin que Postgres/backend/pgAdmin ne soient plus jamais
accessibles directement depuis internet.

## Critères d'acceptation

- [ ] `docker-compose.yml` (dev) inchangé sauf ajout des healthchecks et des
      variables backend manquantes (`JWT_SECRET`, `ADMIN_*`,
      `NODE_ENV=development`) — corrige le crash-loop local actuel.
- [ ] `docker-compose.prod.yml` créé : **aucun `ports:`** sur `postgres`,
      `backend`, `frontend` (seul Caddy expose 80/443 + 443/udp) ; **pgAdmin
      entièrement retiré** ; healthchecks (`pg_isready`, fetch sur
      `/api/health`) ; `mem_limit`/`cpus` ; `security_opt:
      ["no-new-privileges:true"]` ; `read_only: true` + `tmpfs: [/tmp]` sur
      le backend ; `NODE_ENV=production`, `DB_SYNCHRONIZE=false`,
      `DB_MIGRATIONS_RUN=true`, `CORS_ORIGIN=https://${PUBLIC_DOMAIN}`.
- [ ] `docker/caddy/Caddyfile` créé : TLS Let's Encrypt automatique,
      `request_body { max_size 1MB }`, en-têtes de sécurité (HSTS,
      `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`,
      `Permissions-Policy`, `-Server`), `handle /api/*` →
      `reverse_proxy backend:3000` avec la réécriture `X-Forwarded-For` de
      P0-5, `handle` → `reverse_proxy frontend:80`.
- [ ] CSP : `style-src 'self' 'unsafe-inline'` obligatoire (styles Angular
      inline) ; `script-src`/`frame-src`/`connect-src` vers
      `challenges.cloudflare.com` pour Turnstile ; option
      `Content-Security-Policy-Report-Only` envisagée 24h avant bascule.
- [ ] `apps/backend/Dockerfile` : étape `deps` séparée (`npm ci --omit=dev`,
      compilation native `bcrypt`), `ENV NODE_ENV=production`, `USER node`,
      `--init` (SIGTERM). Vérifier que `class-validator`,
      `class-transformer`, `@nestjs/throttler`, `helmet` sont bien en
      `dependencies` (pas seulement présents en local via un
      `node_modules` de dev).
- [ ] `apps/frontend/nginx.conf` : suppression du bloc `location /api/`
      (second saut non fiable), `client_max_body_size 1m`, `server_tokens
      off`, cache long sur assets hachés, `no-cache` sur `index.html`.

## Notes

Dépend de P0-7 (dernier item de la chaîne P0). Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-8--déploiement`.

**Prérequis externes** : nom de domaine pointant vers le VPS, compte
Cloudflare (widget Turnstile), adresse email pour le compte ACME Let's
Encrypt.

**Vérification** : `docker compose -f docker-compose.prod.yml up --build -d`
sur un hôte de recette ; `docker compose ps` → tout `healthy` ; `docker
compose exec backend id` → `uid=1000(node)` ; `nmap -p 5432,3000,5050 <ip>`
depuis l'extérieur → tout fermé ; `curl -I https://domaine` → en-têtes
présents ; `curl -I http://domaine` → 308 ; securityheaders.com et SSL Labs
en A/A+. Puis recette complète avant bascule DNS : `npx nx run-many -t lint
test build typecheck` + les deux e2e, passe manuelle (inscription avec
captcha → équipe → véhicule → campagne → résultat → mot de passe →
désactivation admin → 401 à la requête suivante).
