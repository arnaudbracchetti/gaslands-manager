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
#   ./dev.sh --debug   # lance le backend en mode debug (port 9229)
#   ./dev.sh --kill    # arrete tous les serveurs sans les relancer
#   ./dev.sh --reset --debug  # combinaison possible
#
# Quand utiliser --reset ?
#   Quand tes modifications du backend ou du frontend ne semblent
#   pas prises en compte au redemarrage des serveurs. Nx met en
#   cache les binaires compiles : si le cache est obsolete, il sert
#   l'ancienne version sans recompiler. `npx nx reset` le vide.
#
# Quand utiliser --debug ?
#   Pour poser des points d'arret VSCode sur le backend. Le process
#   Node ecoute le debogueur sur le port 9229 (--inspect). Attacher
#   VSCode : Run & Debug --> "Attach to NestJS" (voir .vscode/launch.json).
#
# Quand utiliser --kill ?
#   Pour arreter tous les serveurs (backend, frontend, Docker) sans
#   les relancer -- utile pour liberer les ports en fin de journee.
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
DEBUG=false
KILL=false
for ARG in "$@"; do
    case "$ARG" in
        --reset) RESET=true ;;
        --debug) DEBUG=true ;;
        --kill)  KILL=true  ;;
        *) echo -e "${RED}Option inconnue : $ARG${NC}"; exit 1 ;;
    esac
done

echo ""
echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}   Gaslands -- Environnement de dev   ${NC}"
echo -e "${YELLOW}======================================${NC}"

# ── 0. Mode --kill : arreter tout et sortir ───────────────────
if [[ "$KILL" == true ]]; then
    step "Arret de tous les serveurs (--kill)..."
    for PATTERN in "nx serve" "run-executor.js" "nx/dist/daemon"; do
        pkill -9 -f "$PATTERN" 2>/dev/null || true
    done
    ok "Processus Nx arretes (serve, executeur, daemon)"
    for PORT in 3000 4200 9229; do
        PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
        if [[ -n "$PIDS" ]]; then
            kill -9 $PIDS 2>/dev/null || true
            ok "Processus sur le port $PORT arrete"
        fi
    done
    docker compose -f "$PROJECT_ROOT/docker-compose.yml" stop postgres pgadmin 2>/dev/null || true
    ok "PostgreSQL et pgAdmin arretes"
    echo ""
    echo -e "${GREEN}  Tous les serveurs sont arretes.${NC}"
    echo ""
    exit 0
fi

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
    bash -lc "cd '$PROJECT_ROOT' && npx nx reset"
    ok "Cache Nx vide -- les serveurs recompileront depuis les sources"
fi

# ── 4. Arret des anciens serveurs (backend/frontend) ──────────
# Si dev.sh a deja ete lance precedemment, des processus `nx serve`
# tournent peut-etre encore -- on les tue avant de relancer, sinon le
# nouveau `nx serve` echoue (EADDRINUSE) ou cohabite avec l'ancien
# (versions desynchronisees).
#
# Tuer uniquement le processus lie au port (ancien comportement) ne
# suffit pas : `nx serve` lance une CHAINE de processus (npm exec -> sh
# -c "nx" -> node .../nx -> run-executor.js, et un daemon Nx partage).
# Si seul le process sur le port est tue, le reste de la chaine
# survit -- le PROCHAIN `nx serve` se bloque alors sur "Waiting for
# backend:serve:development in another nx process" car il detecte ces
# processus orphelins. On tue donc d'abord toute la chaine par motif
# (pkill -f), puis on nettoie par port en filet de securite.
step "Arret des anciens serveurs (nx serve + daemon + ports 3000/4200/9229)..."
# pkill -f "nx serve" : cible les processus `sh -c "nx" serve ...` et
# `node .../nx.js serve ...` mais PAS le daemon Nx ni les run-executor.js
# qui sont des processus freres sans "serve" dans leur ligne de commande.
# On les tue separement pour eviter le blocage "Waiting for another nx process".
for PATTERN in "nx serve" "run-executor.js" "nx/dist/daemon"; do
    pkill -9 -f "$PATTERN" 2>/dev/null || true
done
ok "Processus Nx arretes (serve, executeur, daemon)"

for PORT in 3000 4200 9229; do
    PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
    if [[ -n "$PIDS" ]]; then
        kill -9 $PIDS 2>/dev/null || true
        ok "Processus sur le port $PORT arrete (PID(s) : $PIDS)"
    fi
done

# ── 5. Lancement du backend et du frontend ────────────────────
# Les deux serveurs sont lances en arriere-plan, avec logs dans /tmp.
#
# Mode --debug : l'executeur @nx/js:node supporte nativement --inspect,
# qu'il passe uniquement au process Node final (pas a Nx lui-meme).
# Evite le "address already in use" qu'on obtiendrait avec NODE_OPTIONS
# (qui contaminerait tous les sous-processus Nx). Le port debogueur
# est 9229. VSCode s'y attache via "Attach to NestJS" (.vscode/launch.json).
FRONTEND_CMD="cd '$PROJECT_ROOT' && npx nx serve frontend"
if [[ "$DEBUG" == true ]]; then
    # --skip-nx-cache : force la recompilation sans servir un build cache
    # qui ne contiendrait pas les flags --inspect. Sans ca, Nx peut servir
    # un build production cache, puis bloquer sur "Waiting for another nx process".
    BACKEND_CMD="cd '$PROJECT_ROOT' && npx nx serve backend --inspect --skip-nx-cache"
else
    BACKEND_CMD="cd '$PROJECT_ROOT' && npx nx serve backend"
fi

step "Demarrage du backend NestJS..."
# bash -lc (login, non-interactif) : source ~/.bashrc pour resoudre npx/node
# vers les binaires Linux (nvm). Le -i (interactif) est omis -- nohup n'a pas
# de terminal, bash -lic emettrait "no job control in background".
nohup bash -lc "$BACKEND_CMD" > /tmp/gaslands-backend.log 2>&1 &
if [[ "$DEBUG" == true ]]; then
    ok "Backend lance en mode DEBUG -- port debogueur : 9229 (logs : tail -f /tmp/gaslands-backend.log)"
else
    ok "Backend lance en arriere-plan (logs : tail -f /tmp/gaslands-backend.log)"
fi

step "Demarrage du frontend Angular..."
nohup bash -lc "$FRONTEND_CMD" > /tmp/gaslands-frontend.log 2>&1 &
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
if [[ "$DEBUG" == true ]]; then
echo -e "  Debogueur --> localhost:9229  (attacher VSCode : Run & Debug --> Attach to NestJS)"
fi
echo ""
echo -e "${GRAY}  Attends ~10s que les serveurs demarrent.${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""
