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
- PowerShell (Windows)

---

## Déploiement — Développement local

### Démarrage rapide

```powershell
.\dev.ps1
```

Ce script démarre automatiquement PostgreSQL via Docker, puis ouvre deux fenêtres PowerShell pour le backend et le frontend.

| Service  | URL                       |
|----------|---------------------------|
| Frontend | http://localhost:4200      |
| API      | http://localhost:3000/api |

### Démarrage manuel

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

### Configuration de l'environnement

Copier le fichier d'exemple et renseigner les valeurs :

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
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

> ⚠️ Ne jamais commiter `.env` — il est dans `.gitignore`. Les identifiants Docker Compose sont définis dans `docker-compose.yml`.

---

## Déploiement — Production (Docker)

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

```powershell
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
