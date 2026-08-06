---
id: "p0-8-deploiement-prod-docker-caddy-2026-08-02"
status: "done"
priority: "critical"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-06T09:00:00.000Z"
completedAt: "2026-08-06T09:00:00.000Z"
labels: ["securite", "deploiement"]
order: "aO"
---
# P0-8 — Déploiement production (Docker Compose + Caddy/TLS)

En tant qu'exploitant de l'application, je veux un déploiement Docker Compose
de production qui n'expose que les ports 80/443, avec TLS automatique et des
en-têtes de sécurité, afin que Postgres/backend/pgAdmin ne soient plus jamais
accessibles directement depuis internet.

## Critères d'acceptation

- [x] `docker-compose.yml` (dev) inchangé sauf ajout des healthchecks et des
      variables backend manquantes (`JWT_SECRET`, `ADMIN_*`,
      `NODE_ENV=development`) — corrige le crash-loop local actuel.
- [x] `docker-compose.prod.yml` créé : **aucun `ports:`** sur `postgres`,
      `backend`, `frontend` (seul Caddy expose 80/443 + 443/udp) ; **pgAdmin
      entièrement retiré** ; healthchecks (`pg_isready`, fetch sur
      `/api/health`) ; `mem_limit`/`cpus` ; `security_opt:
      ["no-new-privileges:true"]` ; `read_only: true` + `tmpfs: [/tmp]` sur
      le backend ; `NODE_ENV=production`, `DB_SYNCHRONIZE=false`,
      `DB_MIGRATIONS_RUN=true`, `CORS_ORIGIN=https://${PUBLIC_DOMAIN}`. Deux
      réseaux (`gaslands_net` bridge normal, `gaslands_db_net` `internal:
      true`) plutôt qu'un seul - postgres injoignable depuis caddy/frontend
      même en cas de compromission.
- [x] `docker/caddy/Caddyfile` créé : TLS Let's Encrypt automatique,
      `request_body { max_size 1MB }`, en-têtes de sécurité (HSTS,
      `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`,
      `Permissions-Policy`, `-Server`), `handle /api/*` →
      `reverse_proxy backend:3000` avec la réécriture `X-Forwarded-For` de
      P0-5, `handle` → `reverse_proxy frontend:80`.
- [x] CSP : `style-src 'self' 'unsafe-inline'` obligatoire (styles Angular
      inline) ; `script-src`/`frame-src`/`connect-src` vers
      `challenges.cloudflare.com` pour Turnstile ; option
      `Content-Security-Policy-Report-Only` envisagée 24h avant bascule
      (commentée dans le Caddyfile, prête à décommenter). **Étendue** par
      rapport à la rédaction initiale : `style-src`/`font-src` incluent aussi
      `fonts.googleapis.com`/`fonts.gstatic.com` - `styles.scss` importe des
      polices Google Fonts, bloquées silencieusement sans ces deux domaines
      (repli police système, aucune erreur HTTP visible).
- [x] `apps/backend/Dockerfile` : `ENV NODE_ENV=production`, `USER node`,
      `init: true` (posé sur le service `backend` de
      `docker-compose.prod.yml` - c'est une option Compose/`docker run`, pas
      une instruction Dockerfile ; la rédaction initiale de ce critère se
      trompait sur ce point). **Écart volontaire** sur l'étape `deps`
      séparée (`npm ci --omit=dev`) envisagée initialement : testée puis
      abandonnée - elle casse la production (`Cannot find module 'express'`
      puis `'body-parser'`) car ce monorepo a des paquets requis à
      l'exécution (`express`, `@nestjs/platform-express`) marqués "dev" au
      niveau racine du lockfile à cause d'un devDependency sans rapport qui
      hoiste une autre version du même nom - `--omit=dev` les exclut alors
      qu'ils sont nécessaires. Revenu à la copie intégrale du `node_modules`
      du stage `builder` (comportement déjà éprouvé, image plus lourde mais
      fiable). Le binding natif de `bcrypt` n'a jamais eu besoin d'une
      recompilation séparée : builder et runner partagent déjà la même image
      de base (`node:20-alpine`). `class-validator`/`class-transformer`/
      `@nestjs/throttler`/`helmet` confirmés en `dependencies` racine (pas
      seulement dev local).
- [x] `apps/frontend/nginx.conf` : suppression du bloc `location /api/`
      (second saut non fiable), `client_max_body_size 1m`, `server_tokens
      off`, cache long sur assets hachés, `no-cache` sur `index.html`.

## Notes

Dépend de P0-7 (dernier item de la chaîne P0). Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-8--déploiement`.

**Prérequis externes** (pour la bascule VPS réelle, pas encore effectuée) :
nom de domaine pointant vers le VPS, compte Cloudflare (widget Turnstile),
adresse email pour le compte ACME Let's Encrypt.

**Vérifié en local** (`PUBLIC_DOMAIN=localhost`, certificat interne Caddy,
sans domaine réel ni DNS) : `docker compose -f docker-compose.prod.yml up
--build -d` → 4 services `healthy` ; `docker compose port backend 3000`/
`postgres 5432`/`frontend 80` → aucun port publié (seul `caddy` expose
80/443/443·udp) ; `docker exec gaslands_prod_backend id` →
`uid=1000(node)` ; `curl -Ik https://localhost/` → 200 + tous les en-têtes de
sécurité présents (HSTS, CSP avec Google Fonts, X-Frame-Options, pas de
`Server`) ; `curl -Ik https://localhost/api/health` → `{"status":"ok"}` ;
`curl -I http://localhost/` → 308 ; migrations exécutées (`DB_MIGRATIONS_RUN`,
tables créées malgré `DB_SYNCHRONIZE=false`) ; `AdminSeedService` a bien créé
le compte admin. Bug corrigé en cours de route : les healthchecks `wget`
utilisant `localhost` résolvaient en IPv6 (`::1`) alors que nginx/Caddy
n'écoutent qu'en IPv4 - remplacés par `127.0.0.1` explicite.

**Reste à faire sur un hôte de recette réel avant bascule DNS** :
`nmap -p 5432,3000,5050 <ip>` depuis l'extérieur → tout fermé ; vrai
certificat Let's Encrypt (défi ACME HTTP-01, nécessite le domaine et le DNS
réels) ; securityheaders.com et SSL Labs en A/A+ ; `npx nx run-many -t lint
test build typecheck` + les deux e2e ; passe manuelle complète (inscription
avec captcha → équipe → véhicule → campagne → résultat → mot de passe →
désactivation admin → 401 à la requête suivante).
