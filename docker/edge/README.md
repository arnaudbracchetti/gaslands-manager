# Déployer une application sur ce serveur — guide générique

> Ce fichier vit à côté de `docker-compose.yml` et `Caddyfile`, à la racine du
> stack `edge` (`/opt/edge/` sur ce serveur). Il est **générique** :
> remplacer `<app>` par le nom réel de l'application à déployer partout où il
> apparaît. Aucune connaissance d'une application précise n'est nécessaire
> pour le lire — il se suffit à lui-même.
>
> Public visé : quiconque doit déployer une **nouvelle** application sur ce
> VPS, ou mettre à jour une application déjà en place.

---

## 1. Vue d'ensemble & principes

Ce serveur héberge un reverse proxy Caddy **partagé** (le stack `edge`, à côté
duquel ce fichier vit), seul point d'entrée public, et autant de stacks
applicatifs indépendants que nécessaire — chacun isolé, aucun ne publiant de
port sur l'hôte.

```
                                internet
                                   │ 80 / 443 / 443·udp — SEULS ports publiés sur tout le serveur
                                   ▼
                         ┌───────────────────┐
                         │  /opt/edge/        │  stack "edge" — Caddy, TLS Let's Encrypt auto
                         │  (déployé 1 fois)  │  1 bloc de site importé par app dans sites/*.caddy
                         └─────────┬─────────┘
                                   │ réseau Docker "edge_net" (externe, partagé)
                 ┌─────────────────┼─────────────────┐
                 ▼                                   ▼
       ┌───────────────────┐               ┌───────────────────┐
       │  /opt/<app-1>/     │               │  /opt/<app-2>/     │
       │  alias uniques :   │               │  alias uniques :    │
       │  <app-1>-backend   │               │  <app-2>-backend     │
       │  <app-1>-frontend  │               │  <app-2>-frontend    │
       └─────────┬──────────┘               └──────────┬──────────┘
                 │ réseau interne "<app-1>_db_net"      │ réseau interne "<app-2>_db_net"
                 ▼ (internal: true, jamais joignable    ▼ (idem, propre à chaque app)
             base de données app-1                  base de données app-2
```

**Principes qui gouvernent tout le reste de ce document** :

- **Un seul possesseur de ports sur l'hôte, pour toujours** : le stack `edge`.
  Aucune application, quelle qu'elle soit, ne déclare jamais `ports:` dans son
  `docker-compose.yml`.
- **Rien n'est construit sur ce serveur.** Chaque application est buildée
  ailleurs (CI), poussée vers un registre d'images, et ce serveur ne fait
  jamais que `docker compose pull`.
- **Ce serveur n'accepte aucune action déclenchée depuis l'extérieur.** Il va
  chercher lui-même les images (pull), personne ne lui en envoie (pas de
  webhook, pas de SSH entrant automatisé) — voir §9 pour la discussion sur
  l'auto-déploiement, volontairement laissée ouverte.
- **Chaque application est isolée** : son propre réseau de base de données
  (`internal: true`, injoignable même depuis `edge_net`), son propre
  répertoire `/opt/<app>/`, son propre `.env`.
- **Ajouter une application ne modifie jamais le stack `edge`.** Elle dépose
  juste son fichier de site dans `sites/` et déclenche un `reload`.

---

## 2. Mise en place initiale (une fois par serveur)

À sauter si le stack `edge` (les fichiers juste à côté de ce document) tourne
déjà — direction §3.

### 2.1 Provisionner le système

En SSH, sur un serveur Ubuntu/Debian neuf :

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh          # Docker Engine + plugin Compose
docker compose version                           # vérifier

adduser deploy
usermod -aG docker deploy
# se reconnecter (ou `newgrp docker`) pour que le groupe s'applique à la session

apt install -y ufw fail2ban
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable
systemctl enable --now fail2ban
```

> ⚠️ **`deploy` dans le groupe `docker` équivaut à un accès root complet** —
> Docker ne fait aucune vérification de permission une fois qu'on peut parler
> à son démon (on peut monter `/` de l'hôte dans un conteneur et y lire/écrire
> en root). Acceptable sur un serveur à propriétaire unique, qui a de toute
> façon déjà l'accès root par ailleurs — pas une vraie séparation de
> privilèges, juste un confort (pas de `sudo` à répéter).

### 2.2 Déployer le stack `edge`

```bash
sudo mkdir -p /opt/edge/sites
sudo chown deploy:deploy /opt/edge      # /opt appartient à root par défaut
```

Copier `docker-compose.yml`, `Caddyfile` et ce fichier lui-même dans
`/opt/edge/`, créer `/opt/edge/.env` :

```
LETSENCRYPT_EMAIL=<un email que vous consultez réellement>
```

> Cet email sert uniquement à Let's Encrypt (notifications d'expiration de
> certificat, changements de service) — jamais visible des visiteurs, sans
> rapport avec les comptes des applications elles-mêmes.

Puis :

```bash
cd /opt/edge
docker compose up -d
docker compose ps        # attendu : caddy "healthy"
```

Normal que Caddy ne serve encore aucun vrai site à ce stade (`sites/` est
vide) — c'est le rôle de chaque application déployée ensuite (§3).

---

## 3. Déployer une nouvelle application

### 3.1 Ce que l'application doit fournir

- Un `docker-compose.yml` (ou `docker-compose.prod.yml`) qui :
  - ne publie **aucun** `ports:`,
  - donne à chacun de ses services exposés à Caddy un **alias explicite et
    globalement unique** sur `edge_net` (ex. `<app>-backend`, jamais
    `backend` nu — deux apps qui partageraient le même alias entreraient en
    collision DNS sur ce réseau partagé),
  - déclare `edge_net` en `external: true`,
  - garde sa base de données sur un réseau `internal: true` **qui lui est
    propre** (`<app>_db_net`, jamais partagé entre applications),
  - référence ses images via `image: <registre>/<app>-<service>:${IMAGE_TAG:-latest}`
    plutôt que de les construire sur place.

  Squelette générique :

  ```yaml
  name: <app>-prod

  services:
    database:
      image: postgres:16-alpine   # ou tout autre moteur
      environment:
        POSTGRES_USER: ${DB_USER}
        POSTGRES_PASSWORD: ${DB_PASSWORD}
        POSTGRES_DB: ${DB_NAME}
      volumes:
        - db_data:/var/lib/postgresql/data
      networks:
        - <app>_db_net
      restart: unless-stopped

    backend:
      image: <registre>/<app>-backend:${IMAGE_TAG:-latest}
      environment:
        DATABASE_HOST: database
        # ... variables propres à l'application
      depends_on:
        database:
          condition: service_healthy
      networks:
        edge_net:
          aliases:
            - <app>-backend
        <app>_db_net: {}
      restart: unless-stopped

    frontend:
      image: <registre>/<app>-frontend:${IMAGE_TAG:-latest}
      depends_on:
        backend:
          condition: service_healthy
      networks:
        edge_net:
          aliases:
            - <app>-frontend
      restart: unless-stopped

  networks:
    edge_net:
      external: true      # créé par le stack "edge", jamais par ce fichier
    <app>_db_net:
      driver: bridge
      internal: true       # aucune route vers l'extérieur, ni depuis caddy/frontend

  volumes:
    db_data:
  ```

- Un fichier `.caddy` (un bloc de site Caddy, PAS un Caddyfile complet — pas
  de bloc global `{ email ... }`, qui vit uniquement dans le `Caddyfile` du
  stack `edge`) :

  ```
  __PUBLIC_DOMAIN__ {
      encode gzip

      header {
          Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
          X-Content-Type-Options "nosniff"
          Referrer-Policy "strict-origin-when-cross-origin"
          X-Frame-Options "DENY"
          -Server
      }

      handle /api/* {
          reverse_proxy <app>-backend:3000 {
              # ÉCRASE (et non ajoute) X-Forwarded-For/X-Real-IP avec la vraie IP
              # du visiteur — nécessaire si le backend fait du rate-limiting ou
              # journalise l'IP cliente à partir du premier hop de confiance.
              header_up X-Forwarded-For {http.request.remote.host}
              header_up X-Real-IP {http.request.remote.host}
          }
      }

      handle {
          reverse_proxy <app>-frontend:80
      }
  }
  ```

  À déposer dans `sites/<app>.caddy` de ce stack `edge` — jamais dans le
  stack applicatif lui-même, qui ne publie aucun port.

  > ⚠️ **`__PUBLIC_DOMAIN__` est un placeholder TEXTE, pas une variable
  > d'environnement Caddy.** Ne jamais écrire `{$PUBLIC_DOMAIN}` : cette
  > syntaxe Caddy lit une variable de l'environnement du conteneur qui
  > **interprète** le fichier — le conteneur `caddy` de ce stack `edge`, qui
  > ne connaît que `LETSENCRYPT_EMAIL`, jamais le domaine d'une application
  > particulière. Non définie, elle se résout en chaîne vide → le bloc de
  > site perd sa clé → Caddy le prend pour un second bloc de configuration
  > globale et refuse de démarrer (`server block without any key ... must be
  > first`). D'où un vrai placeholder textuel, substitué **avant** que Caddy
  > ne lise le fichier (§3.3).

### 3.2 Construire et publier les images (CI)

Un seul workflow CI par dépôt suffit (exemple GitHub Actions, adapter les
noms) :

```yaml
name: Build and publish Docker images

on:
  push:
    tags:
      - 'v*.*.*'

permissions:
  contents: read
  packages: write

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target: [backend, frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/${{ matrix.target }}/Dockerfile
          push: true
          tags: |
            ghcr.io/<compte>/<app>-${{ matrix.target }}:${{ github.ref_name }}
            ghcr.io/<compte>/<app>-${{ matrix.target }}:latest
```

Pourquoi ce choix précis :
- **Déclenché sur un tag de version** (`v*.*.*`), pas à chaque push — chaque
  publication d'image correspond à une release explicite.
- **Runner `ubuntu-latest` = amd64 natif**, comme la quasi-totalité des
  serveurs — aucune cross-compilation nécessaire.
- **Jeton d'authentification intégré à la CI** : aucun secret à créer/gérer
  pour publier.
- **Packages rendus publics** (une fois, après leur première publication) :
  aucun secret n'est jamais intégré à une image (les `.env` sont injectés au
  démarrage du conteneur, jamais au moment du build) — le serveur n'a donc
  besoin d'aucune authentification pour `pull`.

### 3.3 Déployer sur le serveur

```bash
# Une fois : préparer le dossier
ssh deploy@<ip-serveur> "sudo mkdir -p /opt/<app> && sudo chown deploy:deploy /opt/<app>"

# Depuis votre machine locale, à la racine du dépôt de l'app :
scp docker-compose.prod.yml deploy@<ip-serveur>:/opt/<app>/

# Le fichier .caddy : substitution du domaine AVANT dépôt (jamais {$VAR} Caddy, cf. 3.1)
sed "s/__PUBLIC_DOMAIN__/<vraidomaine.tld>/" <app>.caddy \
  | ssh deploy@<ip-serveur> "cat > /opt/edge/sites/<app>.caddy"
```

Créer `/opt/<app>/.env` (jamais committé) avec les secrets propres à
l'application, plus au minimum :

```
PUBLIC_DOMAIN=<vraidomaine.tld>
IMAGE_TAG=v0.1.0
```

Puis :

```bash
cd /opt/<app>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps      # attendu : tout "healthy"

docker compose -f /opt/edge/docker-compose.yml exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```

Ce dernier `reload` est **indispensable** à chaque nouvelle application (ou
changement de son fichier `.caddy`) — Caddy ne surveille pas `sites/` en
continu, il ne relit sa configuration que sur demande explicite. **Aucune
coupure** pour les applications déjà en ligne : `reload` remplace la
configuration en mémoire sans jamais fermer les connexions existantes ni
redémarrer le conteneur.

### 3.4 Vérifications post-déploiement

- `docker compose exec backend id` → utilisateur non-root
- Depuis une machine **externe** au serveur : `nmap -p <ports internes de
  l'app> <ip-serveur>` → tout `closed`/`filtered` (seul Caddy doit être
  joignable)
- `curl -I http://<domaine>` → `308` (redirection HTTPS)
- `curl -I https://<domaine>` → en-têtes de sécurité présents, vrai
  certificat Let's Encrypt (pas d'avertissement navigateur)
- Passe fonctionnelle manuelle sur les parcours clés de l'application

---

## 4. Mettre à jour une application déjà déployée

```bash
git tag vX.Y.Z && git push origin vX.Y.Z    # déclenche la CI (§3.2)
```

Vérifier que le build CI réussit, puis sur le serveur :

```bash
sed -i 's/IMAGE_TAG=.*/IMAGE_TAG=vX.Y.Z/' /opt/<app>/.env
cd /opt/<app>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

> ⚠️ **Piège vécu** : oublier de changer `IMAGE_TAG` dans `.env` avant le
> `pull` fait que Docker retélécharge (ou reconfirme, si déjà en cache)
> l'ancienne version, sans erreur ni avertissement — donnant l'impression
> trompeuse que "l'image n'a pas été reconstruite" alors que la CI a très
> bien fonctionné. Toujours vérifier `grep IMAGE_TAG /opt/<app>/.env` avant
> de conclure à un problème côté CI.

Jamais de `--build` sur ce serveur — ni ici, ni ailleurs dans ce document.

---

## 5. Ajouter une 2ᵉ application (ou une 3ᵉ, ...)

Répéter le §3 en entier avec le nouveau nom d'application. Rien à modifier
dans `/opt/edge/` lui-même : ni son `docker-compose.yml`, ni son `Caddyfile`
(qui importe déjà `sites/*.caddy` — un nouveau fichier y suffit). Seul un
`caddy reload` est nécessaire pour que le nouveau site soit pris en compte,
sans jamais redémarrer Caddy ni interrompre les applications déjà en ligne.

Rappel des deux règles qui rendent ça sûr :
- Alias **uniques** sur `edge_net` (`<app>-backend`, jamais `backend` nu).
- Réseau de base de données **propre à chaque application** (`internal:
  true`), jamais partagé.

---

## 6. Pièges connus (rencontrés en conditions réelles)

| Symptôme | Cause | Correctif |
|---|---|---|
| `Error: adapting config using caddyfile: server block without any key is global configuration, and if used, it must be first` au `caddy reload` | `{$PUBLIC_DOMAIN}` (variable Caddy) non définie dans l'environnement du conteneur `caddy` de ce stack `edge` → résolue en chaîne vide | Utiliser un placeholder **textuel** (`__PUBLIC_DOMAIN__`), substitué par `sed` avant dépôt du fichier (§3.1/§3.3), jamais une variable Caddy |
| `Error: ... subject does not qualify for certificate: '{domaine}'` | Domaine entouré d'accolades littérales laissées par une substitution manuelle incomplète (confusion avec la syntaxe `{$VAR}` d'origine) | Le domaine doit être **nu**, sans aucune accolade autour de lui — seule l'accolade qui ouvre le bloc de site doit rester |
| Page en ligne sans aucun style ou avec des fonctionnalités cassées, console : violation `Content-Security-Policy` (`script-src`) | Une CSP stricte (posée ici par Caddy) bloque tout script inline — y compris certains attributs `on*` et certaines optimisations de build front-end qui injectent un handler d'événement inline | Chercher d'abord une violation CSP dans la console avant d'accuser autre chose ; désactiver l'optimisation en cause côté build, plutôt que d'assouplir la CSP |
| `docker compose pull` "réussit" mais rien ne change en production après une mise à jour | `IMAGE_TAG` pas mis à jour dans `.env` avant le `pull` | Voir §4 — toujours vérifier la valeur avant de conclure |
| `docker compose up` échoue avec *"dependency failed to start"* sur un service applicatif | Le plus souvent une variable de `.env` manquante/invalide — beaucoup de backends valident strictement leur environnement au démarrage et s'arrêtent volontairement sinon | `docker compose logs <service>` pour le message exact ; vérifier qu'aucun placeholder du type `<...>` n'est resté tel quel dans `.env` (`grep '<' .env`) |

---

## 7. Question ouverte : auto-déploiement

Aujourd'hui, la mise à jour d'une application (§4) est **manuelle** : un tag
Git déclenche la publication de l'image, mais c'est un humain qui met à jour
`IMAGE_TAG` et relance `pull`/`up -d` sur le serveur. Deux façons
d'automatiser cette dernière étape ont été identifiées, non retenues pour
l'instant :

- **"Push"** — un job CI se connecte en SSH au serveur après la publication
  de l'image. Permettrait de rester sur des tags de version précis, mais
  introduirait le **premier** secret capable de déclencher une action sur le
  serveur depuis l'extérieur (jusqu'ici, le serveur n'accepte jamais rien
  d'entrant hors SSH administratif) — un secret CI qui fuiterait donnerait un
  accès quasi-root au serveur.
- **"Pull"** — un outil comme *Watchtower*, sur le serveur lui-même, qui
  surveille périodiquement si l'image `:latest` a changé sur le registre et
  se redéploie seul. Cohérent avec le principe "rien n'entre depuis
  l'extérieur", mais impose de suivre le tag mutable `:latest` plutôt qu'un
  tag figé (perte de traçabilité "quelle version tourne exactement" au
  niveau de `.env` — récupérable via l'historique Git/registre si besoin).

Aucune des deux n'est mise en œuvre à ce jour — décision à prendre plus tard
si la fréquence des mises à jour le justifie.
