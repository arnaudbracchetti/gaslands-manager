# ============================================================
# dev.ps1 -- Script de demarrage de l'environnement de dev
#
# Lance les trois composants necessaires au dev :
#   1. PostgreSQL (via Docker)
#   2. Backend NestJS   --> http://localhost:3000/api
#   3. Frontend Angular --> http://localhost:4200
#
# Chaque serveur s'ouvre dans sa propre fenetre PowerShell
# pour voir les logs separement.
#
# Usage :
#   .\dev.ps1           # demarrage normal
#   .\dev.ps1 -Reset    # vide le cache Nx avant de demarrer
#
# Quand utiliser -Reset ?
#   Quand tes modifications du backend ou du frontend ne semblent
#   pas prises en compte au redemarrage des serveurs. Nx met en
#   cache les binaires compiles : si le cache est obsolete, il sert
#   l'ancienne version sans recompiler. `npx nx reset` le vide.
# ============================================================

param(
    # -Reset : execute `npx nx reset` avant de lancer les serveurs.
    # Vide le cache de compilation Nx pour forcer une recompilation
    # complete des sources.
    [switch]$Reset
)

$ErrorActionPreference = "Stop"

# Fonctions d'affichage pour les messages de statut
function Write-Step($msg) { Write-Host "" ; Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   OK : $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "   ERREUR : $msg" -ForegroundColor Red }

# $PSScriptRoot : dossier du script, quel que soit le repertoire courant
$projectRoot = $PSScriptRoot

Write-Host ""
Write-Host "======================================" -ForegroundColor Yellow
Write-Host "   Gaslands -- Environnement de dev   " -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow

# ── 1. Verification que Docker est accessible ─────────────────
Write-Step "Verification de Docker..."
try {
    docker info 2>&1 | Out-Null
    Write-Ok "Docker est disponible"
} catch {
    Write-Err "Docker n'est pas demarre. Lance Docker Desktop puis relance ce script."
    exit 1
}

# ── 2. Demarrage de PostgreSQL + pgAdmin ──────────────────────
# On demarre UNIQUEMENT postgres et pgadmin du docker-compose.yml.
# Le frontend et le backend tournent en local (hot reload, debogage).
# L'option -d (detached) lance les containers en arriere-plan.
Write-Step "Demarrage de PostgreSQL et pgAdmin..."
docker compose -f "$projectRoot\docker-compose.yml" up -d postgres pgadmin
Write-Ok "PostgreSQL demarre sur localhost:5432"
Write-Ok "pgAdmin demarre sur http://localhost:5050"

# ── 3. (optionnel) Remise a zero du cache Nx ──────────────────
# Declenchee uniquement si -Reset est passe en argument.
# `npx nx reset` supprime le dossier .nx/cache et les sorties
# compilees mises en cache -- Nx recompilera depuis les sources au
# prochain `nx serve`.
if ($Reset) {
    Write-Step "Remise a zero du cache Nx (-Reset detecte)..."
    $env:NODE_TLS_REJECT_UNAUTHORIZED = '0'
    $env:NX_IGNORE_UNSUPPORTED_TS_SETUP = 'true'
    npx nx reset
    Write-Ok "Cache Nx vide -- les serveurs recompileront depuis les sources"
}

# ── 4. Fenetre PowerShell -- Backend NestJS ───────────────────
# Start-Process ouvre une NOUVELLE fenetre PowerShell.
# On construit la commande en une seule chaine (pas de here-string :
# le here-string multilignes est fragile avec -ArgumentList en PS 5.1).
#
# Variables d'environnement necessaires :
#   NODE_TLS_REJECT_UNAUTHORIZED=0      --> reseau SSL intercepte (proxy)
#   NX_IGNORE_UNSUPPORTED_TS_SETUP=true --> contourne l'incompatibilite tsconfig
Write-Step "Demarrage du backend NestJS..."

$backendCmd = "`$host.UI.RawUI.WindowTitle = 'Gaslands - Backend :3000';" `
            + " Set-Location '$projectRoot';" `
            + " `$env:NODE_TLS_REJECT_UNAUTHORIZED = '0';" `
            + " `$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = 'true';" `
            + " Write-Host 'Backend NestJS --> http://localhost:3000/api' -ForegroundColor Cyan;" `
            + " npx nx serve backend"

Start-Process powershell -ArgumentList @("-NoExit", "-Command", $backendCmd)
Write-Ok "Fenetre backend ouverte"

# ── 5. Fenetre PowerShell -- Frontend Angular ─────────────────
Write-Step "Demarrage du frontend Angular..."

$frontendCmd = "`$host.UI.RawUI.WindowTitle = 'Gaslands - Frontend :4200';" `
             + " Set-Location '$projectRoot';" `
             + " `$env:NODE_TLS_REJECT_UNAUTHORIZED = '0';" `
             + " `$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = 'true';" `
             + " Write-Host 'Frontend Angular --> http://localhost:4200' -ForegroundColor Cyan;" `
             + " npx nx serve frontend"

Start-Process powershell -ArgumentList @("-NoExit", "-Command", $frontendCmd)
Write-Ok "Fenetre frontend ouverte"

# ── Resume ────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================" -ForegroundColor Yellow
Write-Host "  Environnement de dev lance !" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend  --> http://localhost:4200" -ForegroundColor White
Write-Host "  Backend   --> http://localhost:3000/api" -ForegroundColor White
Write-Host "  Base      --> localhost:5432 (gaslands)" -ForegroundColor White
Write-Host "  pgAdmin   --> http://localhost:5050" -ForegroundColor White
Write-Host ""
Write-Host "  Attends ~10s que les serveurs demarrent." -ForegroundColor Gray
Write-Host "======================================" -ForegroundColor Yellow
Write-Host ""
