# ============================================================
# dev.ps1 -- Script de démarrage de l'environnement de développement
#
# Ce script lance les trois composants nécessaires au dev :
#   1. PostgreSQL (via Docker)
#   2. Backend NestJS   --> http://localhost:3000/api
#   3. Frontend Angular --> http://localhost:4200
#
# Chaque serveur s'ouvre dans sa propre fenêtre PowerShell
# pour que tu puisses voir les logs séparément.
#
# Usage :
#   .\dev.ps1
# ============================================================

$ErrorActionPreference = "Stop"

# Fonctions d'affichage pour les messages de statut
function Write-Step($msg) { Write-Host "" ; Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   OK : $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "   ERREUR : $msg" -ForegroundColor Red }

# Récupère le chemin absolu du dossier où se trouve ce script.
# $PSScriptRoot est toujours le dossier du script, peu importe
# depuis quel répertoire tu l'appelles.
$projectRoot = $PSScriptRoot

Write-Host ""
Write-Host "======================================" -ForegroundColor Yellow
Write-Host "   Gaslands -- Environnement de dev   " -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow

# ── 1. Vérification que Docker est accessible ─────────────────
Write-Step "Vérification de Docker..."
try {
    docker info 2>&1 | Out-Null
    Write-Ok "Docker est disponible"
} catch {
    Write-Err "Docker n'est pas démarre. Lance Docker Desktop puis relance ce script."
    exit 1
}

# ── 2. Démarrage de PostgreSQL ────────────────────────────────
# On démarre UNIQUEMENT le service "postgres" du docker-compose.yml.
# Le frontend et le backend tournent en local (hot reload, débogage).
# L'option -d (detached) lance le container en arrière-plan.
Write-Step "Démarrage de PostgreSQL..."
docker compose -f "$projectRoot\docker-compose.yml" up -d postgres
Write-Ok "PostgreSQL démarré sur localhost:5432"

# ── 3. Fenêtre PowerShell -- Backend NestJS ──────────────────
# Start-Process ouvre une NOUVELLE fenêtre PowerShell.
# -ArgumentList passe les commandes à exécuter dans cette fenêtre.
#
# On définit les variables d'environnement nécessaires :
#   NODE_TLS_REJECT_UNAUTHORIZED=0     --> réseau SSL intercepté (proxy)
#   NX_IGNORE_UNSUPPORTED_TS_SETUP=true --> contourne l'incompatibilité tsconfig
Write-Step "Démarrage du backend NestJS..."

$backendCmd = @"
`$host.UI.RawUI.WindowTitle = 'Gaslands - Backend :3000';
Set-Location '$projectRoot';
`$env:NODE_TLS_REJECT_UNAUTHORIZED = '0';
`$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = 'true';
Write-Host 'Backend NestJS --> http://localhost:3000/api' -ForegroundColor Cyan;
npx nx serve backend
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Write-Ok "Fenêtre backend ouverte"

# ── 4. Fenêtre PowerShell -- Frontend Angular ────────────────
Write-Step "Démarrage du frontend Angular..."

$frontendCmd = @"
`$host.UI.RawUI.WindowTitle = 'Gaslands - Frontend :4200';
Set-Location '$projectRoot';
`$env:NODE_TLS_REJECT_UNAUTHORIZED = '0';
`$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = 'true';
Write-Host 'Frontend Angular --> http://localhost:4200' -ForegroundColor Cyan;
npx nx serve frontend
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
Write-Ok "Fenêtre frontend ouverte"

# ── Résumé ───────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================" -ForegroundColor Yellow
Write-Host "  Environnement de dev lance !" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend  --> http://localhost:4200" -ForegroundColor White
Write-Host "  Backend   --> http://localhost:3000/api" -ForegroundColor White
Write-Host "  Base      --> localhost:5432 (gaslands)" -ForegroundColor White
Write-Host ""
Write-Host "  Attends ~10s que les serveurs démarrent." -ForegroundColor Gray
Write-Host "======================================" -ForegroundColor Yellow
Write-Host ""
