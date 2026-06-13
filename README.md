# Gaslands Manager

Application web de gestion d'équipes pour le jeu de figurines **[Gaslands](https://gaslands.com/)** (course automobile post-apocalyptique).

**Stack technique :** Angular 21 · NestJS 11 · PostgreSQL 16 · Docker · Nx Monorepo

---

## Architecture

```
gaslands/
├── apps/
│   ├── frontend/        → Angular 21 (zoneless, signals, lazy routing)
│   ├── frontend-e2e/    → Tests E2E Playwright
│   ├── backend/         → NestJS 11 (API REST /api/*)
│   └── backend-e2e/     → Tests E2E backend
└── content/             → Fichiers Markdown servis via l'API
```

### Flux de données

`content/*.md` → `ContentService` → `GET /api/content/:slug` → composant Angular `[innerHTML]`

### En production (Docker Compose)

Trois services interconnectés sur le réseau interne `gaslands_net` :

| Service    | Image          | Port exposé    |
|------------|----------------|----------------|
| `postgres`  | postgres:16    | 5432 (interne) |
| `backend`   | node:alpine    | 3000           |
| `frontend`  | nginx:alpine   | 4200           |

Le frontend (nginx) proxie automatiquement `/api/*` vers `http://backend:3000`.

---

## Prérequis

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) + Docker Compose
- bash (Linux/WSL)

---

## Déploiement — Développement local

### Démarrage rapide

```bash
./dev.sh
```

Ce script démarre automatiquement PostgreSQL + pgAdmin via Docker, puis lance le backend et le frontend en arrière-plan, avec logs dans `/tmp/gaslands-backend.log` et `/tmp/gaslands-frontend.log`.

| Service  | URL                       |
|----------|---------------------------|
| Frontend | http://localhost:4200      |
| API      | http://localhost:3000/api |

### Démarrage manuel

```bash
# 1. Démarrer PostgreSQL (Docker requis)
docker compose up -d postgres

# 2. Backend NestJS → http://localhost:3000/api (dans un terminal)
npx nx serve backend

# 3. Frontend Angular → http://localhost:4200 (dans un autre terminal)
npx nx serve frontend
```

> En cas d'erreur de configuration TypeScript au démarrage de Nx, voir
> [Dépannage](#dépannage).

### Configuration de l'environnement

Copier les fichiers d'exemple et renseigner les valeurs :

```bash
cp apps/backend/.env.example apps/backend/.env
cp .env.example .env
```

```env
# apps/backend/.env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=your_db_user
DATABASE_PASSWORD=your_db_password
DATABASE_NAME=gaslands
CONTENT_DIR=content
```

> ⚠️ Ne jamais commiter `.env` — il est dans `.gitignore`. Les identifiants Docker Compose (`.env` à la racine) sont définis via `.env.example`, et utilisés par `docker-compose.yml`.

---

## Déploiement — Production (Docker)

> Sous WSL, Docker fonctionne soit via **Docker Desktop avec l'intégration WSL2**
> activée (Settings → Resources → WSL Integration), soit via un **Docker Engine natif**
> installé directement dans la distribution Linux.

### Démarrage complet

```bash
docker compose up --build -d
```

Construit les images et démarre tous les services en arrière-plan.

| Service  | URL                       |
|----------|---------------------------|
| Frontend | http://localhost:4200      |
| API      | http://localhost:3000/api |

### Commandes utiles

```bash
# Arrêter les services
docker compose down

# Suivre les logs en temps réel
docker compose logs -f

# Rebuild et redémarrer après un changement de code
docker compose up --build

# Voir l'état des conteneurs
docker compose ps
```

### Détail des images Docker

**Frontend** (`apps/frontend/Dockerfile`) — build multi-stage :
1. `builder` (node:20-alpine) — compile l'app Angular avec `nx build frontend --configuration=production`
2. `runner` (nginx:alpine) — sert les fichiers statiques, proxie `/api/*` vers le backend

**Backend** (`apps/backend/Dockerfile`) — build multi-stage :
1. `builder` (node:20-alpine) — compile NestJS avec `nx build backend`
2. `runner` (node:20-alpine) — exécute `main.js`, sert le dossier `content/`

---

## Commandes Nx courantes

```bash
# Installation des dépendances
npm install

# Builds de production
npx nx build frontend
npx nx build backend

# Tests
npx nx run frontend:test       # tests unitaires Angular
npx nx run backend-e2e:e2e     # tests E2E backend

# Synchroniser les références TypeScript (si Nx se plaint)
npx nx sync
```

---

## Ajouter du contenu

Créer un fichier `content/<slug>.md` — il sera automatiquement disponible via :

```
GET /api/content/<slug>
```

Aucun redémarrage du backend n'est nécessaire.

---

## Dépannage

- **`NX_IGNORE_UNSUPPORTED_TS_SETUP=true`** : contourne une incompatibilité entre
  `tsconfig.base.json` (`composite`/`emitDeclarationOnly`) et la config Angular. Si Nx
  affiche une erreur de configuration TypeScript au démarrage, exporter cette variable
  avant les commandes `npx nx` :
  ```bash
  export NX_IGNORE_UNSUPPORTED_TS_SETUP=true
  ```
  Sinon, elle peut être omise.

- **`NODE_TLS_REJECT_UNAUTHORIZED=0`** : uniquement si `npm`/`npx` échouent avec une
  erreur de certificat (réseau d'entreprise filtrant le trafic SSL) :
  ```bash
  export NODE_TLS_REJECT_UNAUTHORIZED=0
  ```

- **`dev.sh`** : démarre PostgreSQL + pgAdmin via Docker, puis lance le backend et le
  frontend en arrière-plan, avec logs dans `/tmp/gaslands-backend.log` et
  `/tmp/gaslands-frontend.log` (`tail -f` pour les suivre).
