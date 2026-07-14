#!/usr/bin/env bash
# Lanceur e2e sur des ports dédiés, toujours auto-gérés (démarrés puis détruits par
# Playwright lui-même - cf. playwright.config.ts:usingCustomPorts). Ne vérifie jamais
# l'état des ports 3000/4200 : que dev.sh tourne ou non n'a aucune importance, cette
# suite ne les utilise jamais.
#
# Usage : ./quick-e2e.sh [-g "nom du test"]  (pas de "--" a fournir, deja gere ici)
set -euo pipefail

BACKEND_PORT=3456 FRONTEND_PORT=4201 npx nx e2e frontend-e2e --skip-nx-cache -- --project=chromium "$@"
