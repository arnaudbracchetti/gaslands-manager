#!/usr/bin/env bash
# ============================================================
# dev.sh -- Script de demarrage de l'environnement de dev (Linux/WSL)
#
# Lance les trois composants necessaires au dev :
#   1. PostgreSQL + pgAdmin (via Docker)
#   2. Backend NestJS   --> http://localhost:3000/api
#   3. Frontend Angular --> http://localhost:4200
#
# Le backend et le frontend sont lances en arriere-plan (nohup),
# avec leur sortie journalisee dans /tmp/gaslands-backend.log et
# /tmp/gaslands-frontend.log (`tail -f` pour les suivre).
#
# Usage :
#   ./dev.sh           # demarrage normal
#   ./dev.sh --reset   # vide le cache Nx avant de demarrer
#
# Quand utiliser --reset ?
#   Quand tes modifications du backend ou du frontend ne semblent
#   pas prises en compte au redemarrage des serveurs. Nx met en
#   cache les binaires compiles : si le cache est obsolete, il sert
#   l'ancienne version sans recompiler. `npx nx reset` le vide.
# ============================================================

set -euo pipefail

# Couleurs pour les messages de statut
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

step() { echo ""; echo -e "${CYAN}>> $1${NC}"; }
ok()   { echo -e "${GREEN}   OK : $1${NC}"; }
err()  { echo -e "${RED}   ERREUR : $1${NC}"; }

# $PROJECT_ROOT : dossier du script, quel que soit le repertoire courant
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

RESET=false
if [[ "${1:-}" == "--reset" ]]; then
    RESET=true
fi

echo ""
echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}   Gaslands -- Environnement de dev   ${NC}"
echo -e "${YELLOW}======================================${NC}"

# ── 1. Verification que Docker est accessible ─────────────────
step "Verification de Docker..."
if docker info > /dev/null 2>&1; then
    ok "Docker est disponible"
else
    err "Docker n'est pas demarre (ou pas accessible depuis WSL). Demarre Docker puis relance ce script."
    exit 1
fi

# ── 2. Demarrage de PostgreSQL + pgAdmin ──────────────────────
# On demarre UNIQUEMENT postgres et pgadmin du docker-compose.yml.
# Le frontend et le backend tournent en local (hot reload, debogage).
# L'option -d (detached) lance les containers en arriere-plan.
#
# Si l'environnement a deja ete lance precedemment, les containers
# "gaslands_db"/"gaslands_pgadmin" tournent peut-etre deja.
# `docker compose up` echouerait alors avec un conflit de nom -- on
# verifie donc d'abord s'ils sont deja actifs avant de les (re)creer.
step "Demarrage de PostgreSQL et pgAdmin..."
if docker ps --filter "name=^gaslands_db$" --filter "status=running" --format '{{.Names}}' | grep -q . \
    && docker ps --filter "name=^gaslands_pgadmin$" --filter "status=running" --format '{{.Names}}' | grep -q .; then
    ok "PostgreSQL et pgAdmin sont deja demarres (containers existants)"
else
    docker compose -f "$PROJECT_ROOT/docker-compose.yml" up -d postgres pgadmin
fi
ok "PostgreSQL disponible sur localhost:5432"
ok "pgAdmin disponible sur http://localhost:5050"

# ── 3. (optionnel) Remise a zero du cache Nx ──────────────────
# Declenchee uniquement si --reset est passe en argument.
# `npx nx reset` supprime le dossier .nx/cache et les sorties
# compilees mises en cache -- Nx recompilera depuis les sources au
# prochain `nx serve`.
if [[ "$RESET" == true ]]; then
    step "Remise a zero du cache Nx (--reset detecte)..."
    # bash -lic : shell de login interactif -- source ~/.bashrc (nvm), pour
    # que `npx`/`nx` resolvent vers le node Linux et non le binaire Windows
    # (/mnt/c/Program Files/nodejs/npx), utilise par defaut dans un shell non interactif.
    bash -lic "cd '$PROJECT_ROOT' && npx nx reset"
    ok "Cache Nx vide -- les serveurs recompileront depuis les sources"
fi

# ── 4. Arret des anciens serveurs (backend/frontend) ──────────
# Si dev.sh a deja ete lance precedemment, les processus `nx serve`
# tournent peut-etre encore sur les ports 3000/4200 -- on les tue
# avant de relancer, sinon le nouveau `nx serve` echoue (EADDRINUSE)
# ou cohabite avec l'ancien (versions desynchronisees).
step "Arret des anciens serveurs (ports 3000/4200)..."
for PORT in 3000 4200; do
    PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
    if [[ -n "$PIDS" ]]; then
        kill $PIDS 2>/dev/null || true
        ok "Processus sur le port $PORT arrete (PID(s) : $PIDS)"
    fi
done

# ── 5. Lancement du backend et du frontend ────────────────────
# Les deux serveurs sont lances en arriere-plan, avec logs dans /tmp.
BACKEND_CMD="cd '$PROJECT_ROOT' && npx nx serve backend"
FRONTEND_CMD="cd '$PROJECT_ROOT' && npx nx serve frontend"

step "Demarrage du backend NestJS..."
nohup bash -lic "$BACKEND_CMD" > /tmp/gaslands-backend.log 2>&1 &
ok "Backend lance en arriere-plan (logs : tail -f /tmp/gaslands-backend.log)"

step "Demarrage du frontend Angular..."
nohup bash -lic "$FRONTEND_CMD" > /tmp/gaslands-frontend.log 2>&1 &
ok "Frontend lance en arriere-plan (logs : tail -f /tmp/gaslands-frontend.log)"

# ── Resume ────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}======================================${NC}"
echo -e "${GREEN}  Environnement de dev lance !${NC}"
echo ""
echo -e "  Frontend  --> http://localhost:4200"
echo -e "  Backend   --> http://localhost:3000/api"
echo -e "  Base      --> localhost:5432 (gaslands)"
echo -e "  pgAdmin   --> http://localhost:5050"
echo ""
echo -e "${GRAY}  Attends ~10s que les serveurs demarrent.${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""
