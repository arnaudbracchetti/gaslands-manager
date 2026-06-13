#!/usr/bin/env bash
# ============================================================
# dev.sh -- Script de demarrage de l'environnement de dev (Linux/WSL)
#
# Equivalent de dev.ps1 pour bash. Lance les trois composants
# necessaires au dev :
#   1. PostgreSQL + pgAdmin (via Docker)
#   2. Backend NestJS   --> http://localhost:3000/api
#   3. Frontend Angular --> http://localhost:4200
#
# Sous WSL/Linux il n'existe pas d'equivalent universel a
# "Start-Process powershell" (nouvelle fenetre). Ce script tente
# d'ouvrir un terminal graphique (Windows Terminal via wt.exe,
# ou x-terminal-emulator) pour le backend et le frontend ; si
# aucun n'est disponible, il les lance en arriere-plan et journalise
# leur sortie dans /tmp.
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
step "Demarrage de PostgreSQL et pgAdmin..."
docker compose -f "$PROJECT_ROOT/docker-compose.yml" up -d postgres pgadmin
ok "PostgreSQL demarre sur localhost:5432"
ok "pgAdmin demarre sur http://localhost:5050"

# ── 3. (optionnel) Remise a zero du cache Nx ──────────────────
# Declenchee uniquement si --reset est passe en argument.
# `npx nx reset` supprime le dossier .nx/cache et les sorties
# compilees mises en cache -- Nx recompilera depuis les sources au
# prochain `nx serve`.
if [[ "$RESET" == true ]]; then
    step "Remise a zero du cache Nx (--reset detecte)..."
    npx nx reset
    ok "Cache Nx vide -- les serveurs recompileront depuis les sources"
fi

# ── 4. Lancement du backend et du frontend ────────────────────
# Sous WSL/Linux, pas d'equivalent direct a "Start-Process powershell".
# On tente d'ouvrir des terminaux separes (Windows Terminal depuis WSL,
# ou un emulateur de terminal Linux) ; sinon, on lance en arriere-plan
# avec logs dans /tmp.
BACKEND_CMD="cd '$PROJECT_ROOT' && npx nx serve backend"
FRONTEND_CMD="cd '$PROJECT_ROOT' && npx nx serve frontend"

launch_in_terminal() {
    local title="$1"
    local cmd="$2"

    if command -v wt.exe > /dev/null 2>&1; then
        # Windows Terminal (accessible depuis WSL) : nouvel onglet
        wt.exe new-tab --title "$title" wsl.exe bash -lic "$cmd; exec bash" > /dev/null 2>&1 &
        return 0
    elif command -v x-terminal-emulator > /dev/null 2>&1; then
        x-terminal-emulator -T "$title" -e bash -lic "$cmd; exec bash" > /dev/null 2>&1 &
        return 0
    elif command -v gnome-terminal > /dev/null 2>&1; then
        gnome-terminal --title="$title" -- bash -lic "$cmd; exec bash" > /dev/null 2>&1 &
        return 0
    fi
    return 1
}

step "Demarrage du backend NestJS..."
if launch_in_terminal "Gaslands - Backend :3000" "$BACKEND_CMD"; then
    ok "Terminal backend ouvert"
else
    nohup bash -lic "$BACKEND_CMD" > /tmp/gaslands-backend.log 2>&1 &
    ok "Backend lance en arriere-plan (logs : tail -f /tmp/gaslands-backend.log)"
fi

step "Demarrage du frontend Angular..."
if launch_in_terminal "Gaslands - Frontend :4200" "$FRONTEND_CMD"; then
    ok "Terminal frontend ouvert"
else
    nohup bash -lic "$FRONTEND_CMD" > /tmp/gaslands-frontend.log 2>&1 &
    ok "Frontend lance en arriere-plan (logs : tail -f /tmp/gaslands-frontend.log)"
fi

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
