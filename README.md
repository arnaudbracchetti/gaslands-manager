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
- PowerShell (Windows) **ou** bash (Linux/WSL)

---

## Déploiement — Développement local

### Démarrage rapide

**Windows (PowerShell)**

```powershell
.\dev.ps1
```

**Linux / WSL (bash)**

```bash
./dev.sh
```

Ce script démarre automatiquement PostgreSQL + pgAdmin via Docker, puis lance le backend et le frontend (fenêtres/onglets séparés si possible, sinon en arrière-plan avec logs dans `/tmp`).

| Service  | URL                       |
|----------|---------------------------|
| Frontend | http://localhost:4200      |
| API      | http://localhost:3000/api |

### Démarrage manuel

**Windows (PowerShell)**

```powershell
# 1. Démarrer PostgreSQL (Docker requis)
docker compose up -d postgres

# 2. Backend NestJS → http://localhost:3000/api
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
npx nx serve backend

# 3. Frontend Angular → http://localhost:4200
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
npx nx serve frontend
```

**Linux / WSL (bash)**

```bash
# 1. Démarrer PostgreSQL (Docker requis)
docker compose up -d postgres

# 2. Backend NestJS → http://localhost:3000/api (dans un terminal)
npx nx serve backend

# 3. Frontend Angular → http://localhost:4200 (dans un autre terminal)
npx nx serve frontend
```

> Sous Linux/WSL, les variables `NODE_TLS_REJECT_UNAUTHORIZED` et
> `NX_IGNORE_UNSUPPORTED_TS_SETUP` ne sont en général pas nécessaires —
> voir [Notes Linux / WSL](#notes-linux--wsl).

### Configuration de l'environnement

Copier les fichiers d'exemple et renseigner les valeurs :

**Windows (PowerShell)**

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item .env.example .env
```

**Linux / WSL (bash)**

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

> Les commandes ci-dessous sont identiques sous Windows (PowerShell) et Linux/WSL.
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

> Identiques sous Windows (PowerShell) et Linux/WSL (bash).

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

## Notes Windows

Ce projet est développé sous Windows. Deux variables d'environnement sont nécessaires avant les commandes `npx nx` :

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"        # SSL non vérifié sur ce réseau
$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"   # Compatibilité TypeScript Angular
```

Le script `dev.ps1` les applique automatiquement.

---

## Notes Linux / WSL

Le projet est en cours de migration vers Linux/WSL. Quelques différences avec
l'environnement Windows ci-dessus :

- **`NODE_TLS_REJECT_UNAUTHORIZED=0`** : ce contournement répond à une interception
  SSL propre au réseau Windows de certains postes. **Pas nécessaire en général sous
  Linux/WSL.** Si `npm`/`npx` échouent avec une erreur de certificat (réseau
  d'entreprise filtrant aussi le trafic WSL), l'exporter avant les commandes Nx :
  ```bash
  export NODE_TLS_REJECT_UNAUTHORIZED=0
  ```

- **`NX_IGNORE_UNSUPPORTED_TS_SETUP=true`** : contourne une incompatibilité entre
  `tsconfig.base.json` et la config Angular. Si Nx affiche une erreur de configuration
  TypeScript au démarrage, exporter cette variable avant les commandes `npx nx` :
  ```bash
  export NX_IGNORE_UNSUPPORTED_TS_SETUP=true
  ```
  Sinon, elle peut être omise.

- **`127.0.0.1` vs `localhost`** : la contrainte Windows (où `localhost` peut résoudre
  en IPv6 `::1`, incompatible avec un backend en écoute IPv4) ne s'applique pas sous
  WSL2 — `localhost` fonctionne normalement. Le `.env` et
  `apps/frontend/proxy.conf.json` peuvent utiliser `localhost` ou `127.0.0.1`
  indifféremment.

- **`dev.sh`** : équivalent de `dev.ps1` pour bash. Tente d'ouvrir des terminaux
  séparés pour le backend et le frontend (Windows Terminal via `wt.exe` si lancé
  depuis WSL, ou un émulateur de terminal Linux) ; sinon les deux serveurs tournent
  en arrière-plan avec leurs logs dans `/tmp/gaslands-backend.log` et
  `/tmp/gaslands-frontend.log` (`tail -f` pour les suivre).
