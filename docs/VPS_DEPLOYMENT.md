# Déploiement VPS — architecture et guide opérationnel

> Document de référence pour l'infrastructure de production. Décrit
> l'architecture réellement en place sur le VPS (pas seulement l'intention),
> et le mode d'emploi pour déployer/mettre à jour une application dessus.
> Mettre à jour après tout changement de cette infrastructure.
> Pour le détail des choix de conception (pourquoi ces décisions plutôt que
> d'autres) : [ARCHITECTURE.md §5](ARCHITECTURE.md#5-infrastructure-docker).

---

## 1. Vue d'ensemble

Le VPS héberge un stack Caddy **partagé**, seul point d'entrée public, et
autant de stacks applicatifs indépendants que nécessaire — chacun isolé,
aucun ne publiant de port sur l'hôte.

```
                                internet
                                   │ 80 / 443 / 443·udp — SEULS ports publiés sur tout le VPS
                                   ▼
                         ┌───────────────────┐
                         │  /opt/edge/        │  stack "edge" — Caddy, TLS Let's Encrypt auto
                         │  (déployé 1 fois)  │  1 bloc de site importé par app dans sites/*.caddy
                         └─────────┬─────────┘
                                   │ reseau Docker "edge_net" (externe, partagé)
                 ┌─────────────────┼─────────────────┐
                 ▼                                   ▼
       ┌───────────────────┐               ┌───────────────────┐
       │  /opt/gaslands/    │               │  /opt/<autre-app>/ │
       │  backend + frontend│               │  ...                │
       │  alias uniques :   │               │  alias uniques :    │
       │  gaslands-backend  │               │  <app>-backend       │
       │  gaslands-frontend │               │  <app>-frontend      │
       └─────────┬──────────┘               └──────────┬──────────┘
                 │ réseau interne "gaslands_db_net"                │ réseau interne "<app>_db_net"
                 ▼ (internal: true, jamais joignable                ▼ (idem, propre à chaque app)
            postgres (Gaslands)                                postgres/mysql/... (autre app)
```

**Principes qui gouvernent tout le reste de ce document** :

- **Un seul possesseur de ports sur l'hôte, pour toujours** : le stack `edge`.
  Aucune application, quelle qu'elle soit, ne déclare jamais `ports:` dans son
  `docker-compose.yml`.
- **Rien n'est construit sur le VPS.** Chaque application est buildée ailleurs
  (CI), poussée vers un registre d'images, et le VPS ne fait jamais que
  `docker compose pull`.
- **Le VPS n'accepte aucune action déclenchée depuis l'extérieur.** Il va
  chercher lui-même les images (pull), personne ne lui en envoie (pas de
  webhook, pas de SSH entrant automatisé) — voir §7 pour la discussion sur
  l'auto-déploiement, volontairement laissée ouverte.
- **Chaque application est isolée** : son propre réseau de base de données
  (`internal: true`, injoignable même depuis `edge_net`), son propre
  répertoire `/opt/<app>/`, son propre `.env`.
- **Ajouter une application ne modifie jamais le stack `edge`.** Elle dépose
  juste son fichier de site et déclenche un `reload`.

---

## 2. Le stack `edge` — mise en place initiale (une fois par VPS)

Fichiers sources dans le dépôt : `docker/edge/docker-compose.yml`,
`docker/edge/Caddyfile`.

### 2.1 Provisionner le système (une fois)

En SSH, sur un VPS Ubuntu/Debian neuf :

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
> en root). Acceptable ici parce que c'est un VPS à propriétaire unique, qui
> a de toute façon déjà l'accès root par ailleurs — pas une vraie séparation
> de privilèges, juste un confort (pas de `sudo` à répéter). Le mode
> "rootless" de Docker éviterait ça mais complique le binding des ports
> 80/443 (interdits par défaut aux processus non-root) : non retenu.

### 2.2 Déployer le stack

```bash
sudo mkdir -p /opt/edge/sites
sudo chown deploy:deploy /opt/edge      # /opt appartient à root par défaut
```

Depuis votre machine locale, à la racine du dépôt :

```bash
scp docker/edge/docker-compose.yml docker/edge/Caddyfile deploy@<ip-vps>:/opt/edge/
```

Sur le VPS, créer `/opt/edge/.env` :

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
vide) — c'est le rôle de chaque application déployée ensuite.

---

## 3. Déployer une nouvelle application — procédure générique

Cette section décrit le **patron réutilisable**, illustré avec Gaslands
Manager comme exemple concret. Une nouvelle application suit exactement les
mêmes étapes, en remplaçant `gaslands` par son propre nom partout.

### 3.1 Ce que l'application doit fournir

- Un `docker-compose.yml` (ou `docker-compose.prod.yml`) qui :
  - ne publie **aucun** `ports:`,
  - donne à chacun de ses services exposés à Caddy un **alias explicite et
    globalement unique** sur `edge_net` (ex. `gaslands-backend`, jamais
    `backend` nu — deux apps qui partageraient le même alias entreraient en
    collision DNS sur ce réseau partagé),
  - déclare `edge_net` en `external: true`,
  - garde sa base de données sur un réseau `internal: true` **qui lui est
    propre** (`<app>_db_net`, jamais partagé entre applications),
  - référence ses images via `image: <registre>/<app>-<service>:${IMAGE_TAG:-latest}`
    plutôt que de les construire sur place (`build:` peut rester présent pour
    un usage local ponctuel, jamais utilisé en production).

  Exemple réel : [`docker-compose.prod.yml`](../docker-compose.prod.yml).

- Un fichier `.caddy` (un bloc de site Caddy, PAS un Caddyfile complet — pas
  de bloc global `{ email ... }`, qui vit uniquement dans `docker/edge/Caddyfile`) :

  ```
  __PUBLIC_DOMAIN__ {
      handle /api/* {
          reverse_proxy gaslands-backend:3000
      }
      handle {
          reverse_proxy gaslands-frontend:80
      }
  }
  ```

  Exemple réel : [`docker/caddy/gaslands.caddy`](../docker/caddy/gaslands.caddy).

  > ⚠️ **`__PUBLIC_DOMAIN__` est un placeholder TEXTE, pas une variable
  > d'environnement Caddy.** Ne jamais écrire `{$PUBLIC_DOMAIN}` : cette
  > syntaxe Caddy lit une variable de l'environnement du conteneur qui
  > **interprète** le fichier — le conteneur `caddy` du stack `edge`, qui ne
  > connaît que `LETSENCRYPT_EMAIL`, jamais le domaine d'une application
  > particulière. Non définie, elle se résout en chaîne vide → le bloc de
  > site perd sa clé → Caddy le prend pour un second bloc de configuration
  > globale et refuse de démarrer (`server block without any key ... must be
  > first`). D'où un vrai placeholder textuel, substitué **avant** que Caddy
  > ne lise le fichier (§3.3).

### 3.2 Construire et publier les images (CI)

Un seul workflow GitHub Actions par dépôt suffit (adapter les noms) :

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
- **Runner `ubuntu-latest` = amd64 natif**, comme la quasi-totalité des VPS —
  aucune cross-compilation nécessaire, contrairement à un build local sur un
  Mac Apple Silicon (arm64).
- **`GITHUB_TOKEN` intégré** : aucun secret à créer/gérer pour publier.
- **Packages rendus publics** (GitHub → Packages → *Change visibility* →
  *Public*, une fois après leur première publication) : aucun secret n'est
  jamais intégré à une image (les `.env` sont injectés au démarrage du
  conteneur, jamais au moment du build) — le VPS n'a donc besoin d'aucun
  `docker login` pour `pull`.

Exemple réel : [`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml).

### 3.3 Déployer sur le VPS

```bash
# Une fois : préparer le dossier
ssh deploy@<ip-vps> "sudo mkdir -p /opt/<app> && sudo chown deploy:deploy /opt/<app>"

# Depuis votre machine locale, à la racine du dépôt de l'app :
scp docker-compose.prod.yml deploy@<ip-vps>:/opt/<app>/

# Le fichier .caddy : substitution du domaine AVANT dépôt (jamais {$VAR} Caddy, cf. 3.1)
sed "s/__PUBLIC_DOMAIN__/<vraidomaine.tld>/" docker/caddy/<app>.caddy \
  | ssh deploy@<ip-vps> "cat > /opt/edge/sites/<app>.caddy"
```

Créer `/opt/<app>/.env` (jamais committé) avec les secrets propres à
l'application (voir l'exemple Gaslands : `DB_*`, `JWT_SECRET`, etc.) plus, au
minimum :

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
- Depuis une machine **externe** au VPS : `nmap -p <ports internes de l'app>
  <ip-vps>` → tout `closed`/`filtered` (seul Caddy doit être joignable)
- `curl -I http://<domaine>` → `308` (redirection HTTPS)
- `curl -I https://<domaine>` → en-têtes de sécurité présents, vrai certificat
  Let's Encrypt (pas d'avertissement navigateur)
- Passe fonctionnelle manuelle sur les parcours clés de l'application

---

## 4. Mettre à jour une application déjà déployée

```bash
git tag vX.Y.Z && git push origin vX.Y.Z    # déclenche la CI (§3.2)
```

Vérifier dans l'onglet **Actions** du dépôt que le build réussit, puis sur le
VPS :

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

Jamais de `--build` sur le VPS — ni ici, ni ailleurs dans ce document.

---

## 5. Ajouter une 2ᵉ application (ou une 3ᵉ, ...)

Répéter la §3 en entier avec le nouveau nom d'application. Rien à modifier
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
| `Error: adapting config using caddyfile: server block without any key is global configuration, and if used, it must be first` au `caddy reload` | `{$PUBLIC_DOMAIN}` (variable Caddy) non définie dans l'environnement du conteneur `caddy` du stack `edge` → résolue en chaîne vide | Utiliser un placeholder **textuel** (`__PUBLIC_DOMAIN__`), substitué par `sed` avant dépôt du fichier (§3.1/§3.3), jamais une variable Caddy |
| `Error: ... subject does not qualify for certificate: '{domaine}'` | Domaine entouré d'accolades littérales laissées par une substitution manuelle incomplète (confusion avec la syntaxe `{$VAR}` d'origine) | Le domaine doit être **nu**, sans aucune accolade autour de lui — seule l'accolade qui ouvre le bloc de site doit rester |
| Page en ligne sans aucun style, console : `Executing inline event handler violates ... 'script-src'` | Angular (`@angular/build:application`, config `production`) inline le CSS critique et active le reste via `<link media="print" onload="this.media='all'">` — un attribut `onload` inline, bloqué par une CSP stricte (`script-src` sans `unsafe-inline`) | `optimization.styles.inlineCritical: false` dans la configuration `production` du projet Angular concerné (`project.json`) |
| `docker compose pull` "réussit" mais rien ne change en production après une mise à jour | `IMAGE_TAG` pas mis à jour dans `.env` avant le `pull` | Voir §4 — toujours vérifier la valeur avant de conclure |
| `docker compose up` échoue avec *"dependency failed to start"* sur le backend | Le plus souvent une variable de `.env` manquante/invalide — le backend valide strictement son environnement au démarrage et s'arrête volontairement sinon | `docker compose logs backend` pour le message exact ; vérifier qu'aucun placeholder du type `<...>` n'est resté tel quel dans `.env` (`grep '<' .env`) |

---

## 7. Question ouverte : auto-déploiement

Aujourd'hui, la mise à jour d'une application (§4) est **manuelle** : un tag
Git déclenche la publication de l'image, mais c'est un humain qui met à jour
`IMAGE_TAG` et relance `pull`/`up -d` sur le VPS. Deux façons d'automatiser
cette dernière étape ont été identifiées, non retenues pour l'instant :

- **"Push"** — un job CI se connecte en SSH au VPS après la publication de
  l'image. Permettrait de rester sur des tags de version précis, mais
  introduirait le **premier** secret capable de déclencher une action sur le
  VPS depuis l'extérieur (jusqu'ici, le VPS n'accepte jamais rien
  d'entrant hors SSH administratif) — un secret CI qui fuiterait donnerait un
  accès quasi-root au VPS.
- **"Pull"** — un outil comme *Watchtower*, sur le VPS lui-même, qui surveille
  périodiquement si l'image `:latest` a changé sur le registre et se
  redéploie seul. Cohérent avec le principe "rien n'entre depuis
  l'extérieur", mais impose de suivre le tag mutable `:latest` plutôt qu'un
  tag figé (perte de traçabilité "quelle version tourne exactement" au
  niveau de `.env` — récupérable via l'historique Git/GHCR si besoin).

Aucune des deux n'est mise en œuvre à ce jour — décision à prendre plus tard
si la fréquence des mises à jour le justifie.
