# ============================================================
# Dockerfile — Frontend Angular (Gaslands)
# Build multi-stage : compilation Node.js → image nginx légère.
# ============================================================


# ────────────────────────────────────────────────────────────
# STAGE 1 : "builder"
# On compile l'application Angular avec les outils Node.js.
# ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# ── Copie des manifestes de dépendances en premier ──
# Docker met ce layer en cache : si package.json ne change pas,
# npm ci n'est pas ré-exécuté → économie de temps considérable.
COPY package.json package-lock.json ./

# Installation de toutes les dépendances
# (@angular/build, @nx/angular, etc. sont dans devDependencies)
# npm install plutôt que npm ci : npm ci est strict sur la synchronisation
# exacte du lock file avec la version de npm de l'image → source de conflits.
RUN npm install

# Copie du reste du code source après npm ci
COPY . .

# ── Build Angular en mode production ──
# - outputHashing: 'all' → noms de fichiers avec hash (cache busting)
# - tree-shaking, minification, optimisations activées
# - Output : dist/apps/frontend/browser/
#
# NX_IGNORE_UNSUPPORTED_TS_SETUP=true : même contournement que
# le backend pour l'incompatibilité tsconfig.base.json / Angular.
RUN NX_IGNORE_UNSUPPORTED_TS_SETUP=true npx nx build frontend --configuration=production


# ────────────────────────────────────────────────────────────
# STAGE 2 : "runner" (image de production)
# nginx:alpine est une image extrêmement légère (~5MB).
# Elle ne contient que le serveur web, aucun outil de build.
# ────────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# ── Copie des fichiers statiques Angular compilés ──
# Angular 19+ place les fichiers dans un sous-dossier /browser/
# (séparation des bundles server-side rendering / client-side).
# nginx les sert comme des fichiers statiques normaux.
COPY --from=builder /app/dist/apps/frontend/browser /usr/share/nginx/html

# ── Configuration nginx personnalisée ──
# Remplace la config par défaut de nginx pour :
#   - Activer le SPA fallback (Angular Router)
#   - Activer le proxy /api/* → backend NestJS
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Port exposé par nginx dans le container
EXPOSE 80

# nginx démarre automatiquement (comportement par défaut de l'image nginx)
# CMD est hérité : ["nginx", "-g", "daemon off;"]
