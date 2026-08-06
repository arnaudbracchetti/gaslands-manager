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

ENV NODE_ENV=production

WORKDIR /app

# ── Copie du bundle compilé ──
# main.js contient tout le code de l'application (NestJS, services,
# entités TypeORM…) mais pas les dépendances npm.
COPY --from=builder --chown=node:node /app/apps/backend/dist/main.js ./main.js

# ── Copie des node_modules depuis le builder ──
# Nécessaire car webpack garde les modules npm comme dépendances
# externes (require('@nestjs/common') est résolu à l'exécution).
#
# Volontairement le node_modules COMPLET du builder (dev inclus), pas un
# second stage "npm ci --omit=dev" isolé : ce monorepo a des paquets requis
# en production (ex. "express", nécessaire à @nestjs/platform-express) qui
# se retrouvent marqués "dev" au niveau racine du lockfile parce qu'un
# devDependency sans rapport en hoiste une autre version - --omit=dev les
# exclurait alors qu'ils sont bien nécessaires à l'exécution (confirmé par
# un crash "Cannot find module 'express'"/"body-parser" en testant cette
# alternative). Le binding natif de bcrypt n'a pas besoin d'être recompilé
# séparément non plus : builder et runner utilisent la même image de base
# (node:20-alpine, même libc musl), le node_modules du builder fonctionne
# donc tel quel.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# ── Copie des fichiers de contenu Markdown ──
# Le ContentService lit ces fichiers depuis le chemin défini par
# la variable d'environnement CONTENT_DIR (définie dans docker-compose.yml)
COPY --from=builder --chown=node:node /app/content ./content

# ── Copie des assets statiques (ex. logo en filigrane de la fiche d'équipe) ──
# Lus depuis process.cwd()/assets par team-sheet.renderer.ts - même convention
# que CONTENT_DIR ci-dessus, sans variable d'environnement (chemin fixe, un seul
# fichier pour l'instant).
COPY --from=builder --chown=node:node /app/assets ./assets

# ── Copie du catalogue YAML ──
# CatalogService et ScenarioCatalogService le lisent depuis
# process.cwd()/database_init/data au démarrage (OnModuleInit,
# fail-fast si absent) - sans cette copie, le conteneur crash-loop
# même une fois les variables d'environnement correctement renseignées.
COPY --from=builder --chown=node:node /app/database_init ./database_init

# ── Utilisateur non-root ──
# "node" existe déjà dans l'image node:20-alpine. Posé après les COPY
# --chown ci-dessus (donc aucun chown supplémentaire nécessaire au runtime).
USER node

# Port exposé par le serveur NestJS
EXPOSE 3000

# Démarrage de l'application NestJS
CMD ["node", "main.js"]
