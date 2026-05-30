# ============================================================
# Dockerfile — Backend NestJS (Gaslands)
# Build multi-stage : compilation dans le builder,
# image de production avec Node.js + bundle + dépendances.
# ============================================================


# ────────────────────────────────────────────────────────────
# STAGE 1 : "builder"
# On installe les dépendances et on compile le backend.
# ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# ── Copie des manifestes de dépendances AVANT le code source ──
# Astuce Docker : si package.json ne change pas entre deux builds,
# Docker réutilise le layer npm install depuis son cache (plus rapide).
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/

# Installation de TOUTES les dépendances (dev incluses)
# car Nx/webpack/TypeScript sont nécessaires pour compiler.
RUN npm install

# Copie du reste du code source après npm install
COPY . .

# ── Compilation du backend avec Nx ──
# NX_IGNORE_UNSUPPORTED_TS_SETUP=true : contourne une incompatibilité
# entre tsconfig.base.json (options project references) et Angular/Nx.
#
# Le NxAppWebpackPlugin (target: 'node') compile TypeScript → main.js
# MAIS garde les node_modules comme dépendances EXTERNES (non bundlées).
# C'est le comportement standard pour les applications Node.js :
# webpack ne copie pas les modules npm dans le bundle, il génère des
# appels require() qui sont résolus à l'exécution.
RUN NX_IGNORE_UNSUPPORTED_TS_SETUP=true npx nx build backend


# ────────────────────────────────────────────────────────────
# STAGE 2 : "runner" (image de production)
# On copie le bundle compilé ET les node_modules nécessaires.
# ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# ── Copie du bundle compilé ──
# main.js contient tout le code de l'application (NestJS, services,
# entités TypeORM…) mais pas les dépendances npm.
COPY --from=builder /app/apps/backend/dist/main.js ./main.js

# ── Copie des node_modules depuis le builder ──
# Nécessaire car webpack garde les modules npm comme dépendances
# externes (require('@nestjs/common') est résolu à l'exécution).
#
# Pour une image plus légère en production avancée, on pourrait :
# 1. Utiliser "nx run backend:prune" pour n'installer que les deps prod
# 2. Ou activer le bundling complet dans NxAppWebpackPlugin
# Pour l'instant, on copie tout pour la simplicité et la fiabilité.
COPY --from=builder /app/node_modules ./node_modules

# ── Copie des fichiers de contenu Markdown ──
# Le ContentService lit ces fichiers depuis le chemin défini par
# la variable d'environnement CONTENT_DIR (définie dans docker-compose.yml)
COPY --from=builder /app/content ./content

# Port exposé par le serveur NestJS
EXPOSE 3000

# Démarrage de l'application NestJS
CMD ["node", "main.js"]
