# Gaslands Manager

Application web de gestion d'équipes pour le jeu de plateau **[Gaslands](https://gaslands.com/)**
(course automobile post-apocalyptique) — construction de véhicules, catalogue
de jeu complet, et un mode Campagne (ligue à plusieurs joueurs, Programme
Télé, Atelier, Table des Épaves, Séquelles...).

**Stack technique** : Angular 21 (zoneless + Signals) · NestJS 11 · PostgreSQL 16
via TypeORM · JWT + bcrypt · Nx 22.7 (monorepo)

---

## Fonctionnalités

| Domaine | État |
|---------|------|
| Authentification (inscription, connexion, rôles, compte admin) | ✅ |
| Catalogue de jeu (13 sponsors, 22 véhicules, 38 armes, 19 améliorations, 72 avantages) | ✅ |
| Équipes — CRUD, verrouillage du sponsor, construction de véhicule | ✅ |
| Mode Campagne — ligue, inscriptions, Programme Télé (parties planifiées) | ✅ |
| Mode Campagne — Atelier (achat/revente d'équipement via une cagnotte) | ✅ |
| Mode Campagne — Table des Épaves, Séquelles, classement | ✅ |
| Fiche d'équipe exportable (HTML imprimable, A4) | ✅ |

Détail complet, endpoints et modèles de données : [docs/SPECIFICATION.md](docs/SPECIFICATION.md).

---

## Structure du dépôt

```
gaslands-manager/
├── apps/
│   ├── frontend/            # Angular 21 (port 4200)
│   ├── frontend-e2e/        # Tests E2E Playwright
│   ├── backend/             # NestJS 11 (API REST /api/*, port 3000)
│   └── backend-e2e/         # Tests E2E backend (Vitest + axios)
├── content/                 # Contenu Markdown (documentation utilisateur, pages statiques)
├── database_init/data/      # Catalogue de jeu (sponsors, véhicules, armes... en YAML)
├── docker/
│   ├── edge/                # Stack reverse proxy partagé (Caddy, TLS auto) — VPS
│   └── caddy/                # Fichier de site Caddy de cette application
├── docker-compose.yml       # Stack de développement (postgres, backend, frontend, pgadmin)
├── docker-compose.prod.yml  # Stack de production (images pré-construites, pas de build)
├── dev.sh                   # Script de démarrage de l'environnement de dev
└── docs/                    # Documentation technique (architecture, domaine, déploiement...)
```

---

## Démarrage rapide (développement local)

### Prérequis

- [Node.js](https://nodejs.org/) 20+ et npm (pas de pnpm/yarn dans ce projet)
- [Docker](https://www.docker.com/) + Docker Compose
- bash (Linux/WSL)

### Configuration

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
```

Deux fichiers `.env` distincts et non substituables l'un à l'autre :
- `.env` (racine) alimente Docker Compose (postgres/pgadmin, et le backend
  quand il tourne en conteneur) ;
- `apps/backend/.env` alimente `npx nx serve backend` en développement local
  **hors** Docker.

Renseigner au minimum `DB_PASSWORD`/`DATABASE_PASSWORD`, `JWT_SECRET` et
`ADMIN_PASSWORD` (des placeholders `change_me` explicites sont refusés en
production, tolérés en dev).

### Lancer l'environnement

```bash
npm install
./dev.sh
```

`dev.sh` démarre PostgreSQL + pgAdmin via Docker, puis lance le backend et le
frontend en arrière-plan (logs dans `/tmp/gaslands-backend.log` et
`/tmp/gaslands-frontend.log`, `tail -f` pour les suivre). Options utiles :

```bash
./dev.sh --reset   # vide le cache Nx avant de démarrer (build obsolète)
./dev.sh --debug   # backend en mode debug, port 9229 (attacher VSCode)
./dev.sh --kill    # arrête tous les serveurs sans les relancer
```

Alternative manuelle (contrôle fin, un terminal par service) :

```bash
docker compose up -d postgres    # base de données seule
npx nx serve backend             # → http://localhost:3000/api
npx nx serve frontend            # → http://localhost:4200
```

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:4200 |
| API      | http://localhost:3000/api |
| pgAdmin  | http://localhost:5050 |

> En cas d'erreur de configuration TypeScript au démarrage de Nx
> (`composite`/`emitDeclarationOnly` incompatibles avec Angular), exporter
> `NX_IGNORE_UNSUPPORTED_TS_SETUP=true` avant les commandes `npx nx`.

### Commandes Nx courantes

Toujours passer par `nx` (`nx run`, `nx run-many`, `nx affected`) plutôt que
par l'outil sous-jacent :

```bash
npx nx build frontend              # build de production
npx nx build backend
npx nx test frontend               # tests unitaires (Vitest)
npx nx test backend
npx nx e2e frontend-e2e            # tests E2E Playwright (arrêter dev.sh avant — port 3000)
npx nx e2e backend-e2e             # tests E2E backend (axios)
npx nx sync                        # si Nx se plaint de "workspace out of sync"
```

---

## Déploiement en production (VPS)

Guide opérationnel complet, avec toutes les commandes et les pièges connus :
**[docs/VPS_DEPLOYMENT.md](docs/VPS_DEPLOYMENT.md)**. Résumé ci-dessous.

### Architecture

```
internet ──80/443──▶ stack "edge" (Caddy partagé, TLS Let's Encrypt auto)
                            │  réseau Docker "edge_net"
                            ▼
              gaslands-backend / gaslands-frontend   (aucun port publié)
                            │  réseau interne "gaslands_db_net"
                            ▼
                        postgres
```

Un seul stack Caddy partagé possède les ports 80/443 de tout le VPS. Chaque
application (Gaslands compris) est un stack Docker Compose isolé qui ne
publie jamais de port sur l'hôte et n'est jamais construit sur le serveur —
les images sont buildées par CI et publiées sur GHCR
(`.github/workflows/docker-publish.yml`, déclenché par un tag `vX.Y.Z`), le
VPS ne fait que `docker compose pull`.

### Prérequis

- Un VPS sur lequel le stack `edge` a déjà été provisionné une fois (voir
  [docs/VPS_DEPLOYMENT.md §2](docs/VPS_DEPLOYMENT.md#2-le-stack-edge--mise-en-place-initiale-une-fois-par-vps)).
- Un tag Git poussé (`git tag vX.Y.Z && git push origin vX.Y.Z`) pour que la
  CI publie les images `ghcr.io/.../gaslands-manager-{backend,frontend}`.

### Premier déploiement

```bash
# Sur le VPS
sudo mkdir -p /opt/gaslands && sudo chown deploy:deploy /opt/gaslands

# Depuis votre machine, à la racine du dépôt
scp docker-compose.prod.yml deploy@<ip-vps>:/opt/gaslands/
sed "s/__PUBLIC_DOMAIN__/<votredomaine.tld>/" docker/caddy/gaslands.caddy \
  | ssh deploy@<ip-vps> "cat > /opt/edge/sites/gaslands.caddy"
```

Créer `/opt/gaslands/.env` sur le VPS (à partir de `.env.example`, jamais
committé) en renseignant au minimum : `DB_USER`/`DB_PASSWORD`/`DB_NAME`,
`JWT_SECRET` (32 caractères min.), `ADMIN_EMAIL`/`ADMIN_PASSWORD`,
`TURNSTILE_SECRET_KEY`, `CORS_ORIGIN`, `PUBLIC_DOMAIN`, `IMAGE_TAG` (ex.
`v0.1.0`), et en production toujours `DB_SYNCHRONIZE=false` +
`DB_MIGRATIONS_RUN=true` (schéma géré par migrations explicites, jamais par
synchronisation automatique sur des données réelles).

```bash
cd /opt/gaslands
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

docker compose -f /opt/edge/docker-compose.yml exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```

Ce dernier `reload` est indispensable (Caddy ne relit sa configuration que
sur demande) mais ne coupe jamais les autres applications déjà en ligne.

### Mettre à jour un déploiement existant

```bash
git tag vX.Y.Z && git push origin vX.Y.Z   # déclenche la CI
```

Une fois le build CI terminé, sur le VPS :

```bash
sed -i 's/IMAGE_TAG=.*/IMAGE_TAG=vX.Y.Z/' /opt/gaslands/.env
cd /opt/gaslands
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

> ⚠️ Oublier de mettre à jour `IMAGE_TAG` dans `.env` avant le `pull` fait
> retélécharger silencieusement l'ancienne version — toujours vérifier
> `grep IMAGE_TAG /opt/gaslands/.env` en cas de doute.

Pour le provisionnement initial du stack `edge`, l'ajout d'une 2ᵉ
application sur le même VPS, les vérifications post-déploiement et la table
des pièges déjà rencontrés (Caddyfile, CSP, migrations...) : voir
[docs/VPS_DEPLOYMENT.md](docs/VPS_DEPLOYMENT.md).

---

## Documentation complémentaire

| Document | Contenu |
|----------|---------|
| [docs/SPECIFICATION.md](docs/SPECIFICATION.md) | Spécifications fonctionnelles complètes, endpoints, modèles de données |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Choix techniques, structure du code, patterns DDD, sécurité, infra Docker |
| [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) | Diagrammes UML du modèle de domaine (agrégats, ERD) |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | Catalogue des composants Angular |
| [docs/VPS_DEPLOYMENT.md](docs/VPS_DEPLOYMENT.md) | Guide opérationnel de déploiement/mise à jour en production |

La documentation destinée aux joueurs (fonctionnement de l'application,
comportement observable) est accessible directement dans l'application via
`/documentation`.
