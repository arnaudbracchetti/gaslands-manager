#!/usr/bin/env bash
# Concordance entités TypeORM / migrations (cible Nx `backend:migration:check`).
#
# 1. Joue toutes les migrations de l'index (src/migrations/index.ts) sur la base
#    pointée par DATABASE_* (cf. src/data-source.ts).
# 2. Demande à TypeORM le diff entre ce schéma et les entités
#    (`migration:generate --check`) : code de sortie 1 s'il reste un écart.
#
# À lancer sur une base VIDE et jetable : sur une base déjà peuplée par
# `synchronize: true` (base de dev), l'étape 1 échouerait ou masquerait un écart.
# La connexion est lue dans l'environnement (pas de fichier .env : absent en CI).
#
# Lancé depuis apps/backend (cwd de la cible Nx), avec TS_NODE_PROJECT déjà fixé.
set -euo pipefail

DATA_SOURCE="src/data-source.ts"

echo "==> Application des migrations sur ${DATABASE_HOST:-localhost}:${DATABASE_PORT:-5432}/${DATABASE_NAME:-gaslands}"
npx typeorm-ts-node-commonjs migration:run -d "$DATA_SOURCE"

echo "==> Comparaison du schéma obtenu avec les entités"
# --check n'écrit jamais de fichier ; le chemin est seulement exigé par la CLI.
# La sortie est conservée pour distinguer un vrai écart de schéma (message
# "Unexpected changes" de TypeORM) d'une autre erreur (connexion, compilation),
# qui sort aussi en code 1 mais pour laquelle l'indice ci-dessous serait faux.
OUTPUT_FILE="$(mktemp)"
trap 'rm -f "$OUTPUT_FILE"' EXIT
if ! npx typeorm-ts-node-commonjs migration:generate -d "$DATA_SOURCE" --check src/migrations/MigrationCheck 2>&1 | tee "$OUTPUT_FILE"; then
  if ! grep -q "Unexpected changes in database schema" "$OUTPUT_FILE"; then
    echo "ÉCHEC : la comparaison du schéma n'a pas pu s'exécuter (voir l'erreur ci-dessus)." >&2
    exit 1
  fi
  cat >&2 <<'EOF'

ÉCHEC : les migrations ne reproduisent pas exactement les entités TypeORM.
  - Entité modifiée sans migration ? Générez-la avec `npx nx run backend:migration:generate`.
  - Migration non enregistrée dans l'index ? Une migration absente de
    apps/backend/src/migrations/index.ts (ALL_MIGRATIONS) n'est jamais jouée.
EOF
  exit 1
fi
