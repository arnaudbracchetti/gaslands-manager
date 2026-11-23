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
scp docker/edge/docker-compose.yml docker/edge/Caddyfile docker/edge/README.md deploy@<ip-vps>:/opt/edge/
```

> `docker/edge/README.md` est le pendant **générique et autonome** de la §3
> ci-dessous (aucune mention de Gaslands, exemples entièrement inline) —
> déployé une fois pour toutes aux côtés du stack `edge`, il reste
> disponible directement sur le VPS (`/opt/edge/README.md`) pour quiconque
> déploie une future application sans avoir besoin de ce dépôt.

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

> Version générique et autonome de cette même procédure (sans aucune mention
> de Gaslands, exemples entièrement inline) : [`docker/edge/README.md`](../docker/edge/README.md) —
> déployée sur le VPS lui-même (`/opt/edge/README.md`, cf. §2.2 ci-dessus),
> c'est le document à consulter en priorité une fois sur le serveur.

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
  - référence ses images via `image: <registre>/<app>-<service>:${IMAGE_TAG:?}`
    (`IMAGE_TAG` exigé : sans lui, Compose échoue au lieu de deviner une version)
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
first`). D'où un vrai placeholder textuel, substitué **avant** que Caddy
  > ne lise le fichier (§3.3).

### 3.2 Construire et publier les images (CI)

La publication vit dans le **même** workflow que la vérification du code
(un seul fichier, adapter les noms) : un job `image` qui ne tourne que si le
job de vérification est vert, et seulement sur un tag :

```yaml
on:
  push:
    branches: [main]
    tags: ['v*.*.*']
  pull_request:

jobs:
  verify:
    # format, lint, tests, build, concordance des migrations...

  image:
    needs: verify
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        target: [backend, frontend]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Vérifier que le commit taggé est sur main
        run: |
          git fetch origin main
          git merge-base --is-ancestor "$GITHUB_SHA" origin/main
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
          tags: ghcr.io/<compte>/<app>-${{ matrix.target }}:${{ github.ref_name }}
```

Pourquoi ce choix précis :

- **Déclenché sur un tag de version** (`v*.*.*`), pas à chaque push — chaque
  publication d'image correspond à une release explicite.
- **`needs: verify`** : aucune image n'est publiée si la CI est rouge (c'est
  arrivé pour Gaslands v0.1.1 à v1.0.0, avant ce garde-fou).
- **Tag posé sur `main` uniquement** : un tag sur une branche de travail ne
  publie rien, la prod ne reçoit que du code fusionné.
- **Un seul tag d'image, la version**, pas de `latest` : la version déployée
  est toujours celle écrite dans `IMAGE_TAG`, jamais une étiquette mobile.
- **Runner `ubuntu-latest` = amd64 natif**, comme la quasi-totalité des VPS —
  aucune cross-compilation nécessaire, contrairement à un build local sur un
  Mac Apple Silicon (arm64).
- **`GITHUB_TOKEN` intégré** : aucun secret à créer/gérer pour publier.
- **Packages rendus publics** (GitHub → Packages → _Change visibility_ →
  _Public_, une fois après leur première publication) : aucun secret n'est
  jamais intégré à une image (les `.env` sont injectés au démarrage du
  conteneur, jamais au moment du build) — le VPS n'a donc besoin d'aucun
  `docker login` pour `pull`.

Exemple réel : [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

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

Puis, pour ce premier lancement (pour Gaslands, les mises à jour suivantes
passent par le script, §4) :

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

## 4. Exploiter Gaslands avec `deploy-gaslands.sh`

Une fois l'application en ligne (§3), tout se fait par le script
[`deploy-gaslands.sh`](../deploy-gaslands.sh), copié dans `/opt/gaslands/` :
déployer, revenir à la version précédente, sauvegarder, restaurer, voir
l'état. Cette section donne la vue de l'exploitant (ce qu'on lance, ce qui
est demandé, ce qui peut être perdu) ; l'enchaînement exact des étapes est
dans l'en-tête du script, les choix de fond (retour arrière sans
restauration, migrations additives) dans l'ADR
[0001](adr/0001-retour-arriere-par-l-image-precedente-sans-restauration.md).

```bash
cd /opt/gaslands
./deploy-gaslands.sh            # menu : 1 Déployer, 2 Revenir, 3 Sauvegarder, 4 Restaurer, 5 État, 6 Quitter
./deploy-gaslands.sh vX.Y.Z     # déploie directement cette version
```

### 4.1 Installation unique

À faire une fois, dans cet ordre, avant la première release déployée par le
script. Le VPS est en UTC, `rclone` y est déjà installé (sauvegardes de
Chimères), le compte `deploy` n'a pas `sudo` : les `apt install` se font avec
le compte d'administration.

**0. Dump manuel de la prod, copié hors du VPS** (avant toute autre action) :

```bash
# Sur le VPS
cd /opt/gaslands
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > ~/gaslands-manuel-$(date +%F).dump
ls -lh ~/gaslands-manuel-*.dump        # taille non nulle

# Depuis votre machine
scp deploy@<ip-vps>:~/gaslands-manuel-AAAA-MM-JJ.dump .
```

**1. Bucket et clé B2** (interface Backblaze, même compte que Chimères) :

- bucket privé `gaslands-sauvegardes`, avec le chiffrement par défaut
  activé (_Default Encryption : Enable_, soit SSE-B2) : B2 chiffre au repos
  les dumps, qui partent en clair du serveur. Ce chiffrement protège les
  disques de Backblaze, pas d'un accès au compte B2 ou à la clé B2 du `.env` ;
- règle de cycle de vie personnalisée sur tout le bucket : masquer les
  fichiers 15 jours après l'envoi, les supprimer 1 jour après ;
- clé d'application limitée au bucket, **sans `deleteFiles`** : l'interface ne
  propose que des lots de droits (« Read and Write » comprend la
  suppression), donc créer la clé avec l'outil `b2` (sur votre machine :
  `pipx install b2`, puis `b2 account authorize` avec la clé principale du
  compte) :

  ```bash
  b2 key create --bucket gaslands-sauvegardes gaslands-serveur listBuckets,listFiles,readFiles,writeFiles
  ```

- noter dans Dashlane le keyID, la clé et le nom du bucket.

**2. Préparer le VPS** (compte `deploy`) :

```bash
mkdir -p /opt/gaslands/sauvegardes
chmod 700 /opt/gaslands/sauvegardes                    # dumps locaux en clair
```

Dans `/opt/gaslands/.env` (et la fiche Dashlane, copie de référence du
`.env`), modifier les clés déjà présentes et ajouter les autres, sans jamais
créer de doublon (le script lit la clé par `grep` : deux lignes `IMAGE_TAG=`
faussent tous ses contrôles), puis `chmod 600 /opt/gaslands/.env` :

```
PUBLIC_DOMAIN=<vraidomaine.tld>    # contrôle de version par https://<domaine>/api/version
IMAGE_TAG=v1.0.0                   # la version en place avant le premier passage par le script
B2_KEY_ID=<keyID de la clé, pas l'identifiant du compte>
B2_APP_KEY=<clé d'application>
B2_BUCKET=gaslands-sauvegardes     # le NOM du bucket, pas son ID
```

**3. Copier le script et le fichier Compose** (depuis votre machine, à la
racine du dépôt) :

```bash
scp deploy-gaslands.sh docker-compose.prod.yml deploy@<ip-vps>:/opt/gaslands/
ssh deploy@<ip-vps> chmod +x /opt/gaslands/deploy-gaslands.sh
```

Le script utilise le [`docker-compose.prod.yml`](../docker-compose.prod.yml)
de `/opt/gaslands/` : il doit être celui du dépôt, qui exige `IMAGE_TAG`. Le
recopier à chaque modification de ce fichier.

**4. Sauvegarde de nuit** : cron du compte `deploy` (`crontab -e`) :

```
45 3 * * * /opt/gaslands/deploy-gaslands.sh sauvegarde-nuit >> /opt/gaslands/sauvegardes.log 2>&1
```

3 h 45 UTC (4 h 45 ou 5 h 45 à Paris), 15 minutes après la ligne de Chimères
(`30 3`) pour ne pas chevaucher. Ne pas changer le fuseau du serveur, cela
décalerait Chimères.

Premier essai à la main : `/opt/gaslands/deploy-gaslands.sh sauvegarde-nuit`.
Attendu : `=== Sauvegarde de nuit : réussie ... ===`. Vérifier dans
l'interface B2 que `gaslands-AAAA-MM-JJ-v1.0.0.dump` est dans le bucket et
que sa fiche indique un chiffrement SSE-B2,
qu'aucun autre bucket n'est apparu (signe d'un ID mis à la place du nom), et
qu'aucun fichier ne reste dans `sauvegardes/`. Le lendemain, relire
`/opt/gaslands/sauvegardes.log` pour confirmer le passage du cron.

**5. Tester une restauration** d'un dump de nuit, sur une base jetable (jamais
sur la prod) :

```bash
# Sur le VPS, compte deploy
cd /opt/gaslands
lire() { grep -oP "^$1=\K.*" .env; }                   # une clé de .env, sans tout sourcer
export RCLONE_CONFIG=/dev/null RCLONE_CONFIG_B2_TYPE=b2 \
  RCLONE_CONFIG_B2_ACCOUNT="$(lire B2_KEY_ID)" RCLONE_CONFIG_B2_KEY="$(lire B2_APP_KEY)"
rclone lsf "b2:$(lire B2_BUCKET)"                        # choisir un fichier
rclone cat "b2:$(lire B2_BUCKET)/gaslands-AAAA-MM-JJ-v1.0.0.dump" > /tmp/essai.dump

docker run -d --name essai-restauration -e POSTGRES_PASSWORD=essai postgres:16-alpine
until docker exec essai-restauration pg_isready -U postgres -q; do sleep 1; done
docker exec -i essai-restauration pg_restore -U postgres -d postgres --no-owner --exit-on-error \
  < /tmp/essai.dump
docker exec essai-restauration psql -U postgres -c 'select count(*) from teams;'

docker rm -f essai-restauration; rm -f /tmp/essai.dump
```

Attendu : un nombre d'équipes plausible.

### 4.2 Publier une release

1. Si la release ajoute une valeur persistée que la version précédente ne
   connaît pas, une section `## vX.Y.Z` dans
   [`valeurs-nouvelles.txt`](../apps/backend/src/migrations/valeurs-nouvelles.txt)
   (règle et format : en-tête du fichier).
2. Tag sur un commit de `main`. Le script ne lit que la section dont le titre
   est exactement ce tag : la première release passée par le script est donc
   `v1.1.0`, la section déjà rédigée.
   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```
3. Attendre que le workflow `CI` réussisse (`verify` puis `image`). Si la CI
   échoue, aucune image n'est publiée et le script s'arrête sans rien toucher.

### 4.3 Déployer une version (option 1)

```bash
/opt/gaslands/deploy-gaslands.sh vX.Y.Z
```

Le script :

- refuse un tag mal formé, déjà en place, ou plus ancien que la version en
  place et la précédente ;
- tire les **deux** images (backend et frontend) ; si l'une manque, il
  s'arrête sans rien toucher ;
- fait un dump `sauvegardes/avant-deploiement-<date>-<version en place>.dump` ;
- change `IMAGE_TAG` dans `.env` et relance : les migrations s'appliquent au
  démarrage du backend ;
- attend le `healthy` du backend (120 s au plus), puis vérifie que
  `https://<PUBLIC_DOMAIN>/api/version` renvoie le nouveau tag ;
- note le déploiement dans `deploiements.log`, ne garde que les images N et
  N-1, efface les dumps locaux de plus de 30 jours.

Si la nouvelle version ne répond pas correctement, il restaure le dump
d'avant et relance la version précédente. Si cette restauration échoue
elle-même : message `CRITIQUE` avec le chemin du dump, restauration à faire à
la main (§4.6, sauvegarde locale).

Pas de `caddy reload` à une mise à jour : seulement si
[`gaslands.caddy`](../docker/caddy/gaslands.caddy) change.

### 4.4 Revenir à la version précédente (option 2)

Seule la version précédente (N-1, lue dans `deploiements.log`) est proposée.
Le script compare les migrations embarquées dans les images N et N-1 et
choisit entre deux issues :

- **Relance de N-1 sur la base telle quelle**, sans perte : quand aucune
  migration nouvelle de N ne porte `// incompatible : <raison>` et que la
  section de N dans
  [`valeurs-nouvelles.txt`](../apps/backend/src/migrations/valeurs-nouvelles.txt)
  est vide ou absente, ou que vous répondez « Non » à sa question (le script
  cite ces actions avec la date du déploiement et demande si quelqu'un en a
  fait une depuis). Confirmation par `o`. Si N-1 ne démarre pas, le script
  relance N : une perte de données reste toujours un choix explicite.
- **Restauration du dump fait avant le déploiement de N**, puis relance de
  N-1 : quand une migration porte le marqueur (raison affichée), ou que vous
  répondez « Oui » ou « Je ne sais pas ». Les saisies faites depuis le
  déploiement sont perdues ; un dump de la base actuelle est fait avant.
  Confirmation en tapant `RESTAURER`.

Remonter plus loin que N-1 passe par une restauration (§4.6). Les images
v1.0.0 n'embarquent pas de migrations : vers v1.0.0, toutes les migrations de
N comptent comme nouvelles.

### 4.5 Sauvegardes

| Sauvegarde                 | Quand                                  | Où                           | Durée de vie                |
| -------------------------- | -------------------------------------- | ---------------------------- | --------------------------- |
| De nuit, chiffrée par B2   | cron, 3 h 45 UTC                       | B2 `gaslands-sauvegardes`    | 15 jours (règle du bucket)  |
| Avant déploiement / retour | à chaque déploiement ou retour arrière | `/opt/gaslands/sauvegardes/` | 30 jours (ménage du script) |
| Manuelle (option 3)        | avant une intervention                 | `/opt/gaslands/sauvegardes/` | 30 jours                    |

Chaque nom de dump porte la version en place au moment du dump
(`...-vX.Y.Z.dump`, `gaslands-AAAA-MM-JJ-vX.Y.Z.dump`) : c'est elle qui
dit avec quelle version il est compatible. Les dumps locaux sont en clair
(dossier `chmod 700`) et jamais envoyés sur B2 ; la sauvegarde de nuit n'est
pas gardée en local. Le serveur n'efface jamais rien sur B2.

Le périmètre est la base seule : le `.env` a sa copie de référence dans
Dashlane, les certificats sont refaits par Caddy.

### 4.6 Restaurer une sauvegarde (option 4)

Choisir une sauvegarde locale ou une sauvegarde de nuit B2 dans une liste,
confirmer en tapant `RESTAURER`.

- Dump de la version en place ou plus ancien : restauré, puis la version en
  place applique au démarrage les migrations qui lui manquent.
- Dump plus récent que la version en place : refusé (« redéployez d'abord
  vD, puis restaurez »).

Le script fait d'abord un dump `avant-restauration-...` de la base actuelle.
Une restauration ne change jamais `IMAGE_TAG`.

### 4.7 État (option 5)

Version en place et précédente, version qui répond sur `/api/version`,
derniers déploiements, conteneurs, derniers dumps locaux, date de la dernière
sauvegarde de nuit réussie, images présentes.

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

| Symptôme                                                                                                                                        | Cause                                                                                                                                                                                                                                                    | Correctif                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Error: adapting config using caddyfile: server block without any key is global configuration, and if used, it must be first` au `caddy reload` | `{$PUBLIC_DOMAIN}` (variable Caddy) non définie dans l'environnement du conteneur `caddy` du stack `edge` → résolue en chaîne vide                                                                                                                       | Utiliser un placeholder **textuel** (`__PUBLIC_DOMAIN__`), substitué par `sed` avant dépôt du fichier (§3.1/§3.3), jamais une variable Caddy                          |
| `Error: ... subject does not qualify for certificate: '{domaine}'`                                                                              | Domaine entouré d'accolades littérales laissées par une substitution manuelle incomplète (confusion avec la syntaxe `{$VAR}` d'origine)                                                                                                                  | Le domaine doit être **nu**, sans aucune accolade autour de lui — seule l'accolade qui ouvre le bloc de site doit rester                                              |
| Page en ligne sans aucun style, console : `Executing inline event handler violates ... 'script-src'`                                            | Angular (`@angular/build:application`, config `production`) inline le CSS critique et active le reste via `<link media="print" onload="this.media='all'">` — un attribut `onload` inline, bloqué par une CSP stricte (`script-src` sans `unsafe-inline`) | `optimization.styles.inlineCritical: false` dans la configuration `production` du projet Angular concerné (`project.json`)                                            |
| `docker compose pull` "réussit" mais rien ne change en production après une mise à jour faite à la main (hors script)                           | `IMAGE_TAG` pas mis à jour dans `.env` avant le `pull`                                                                                                                                                                                                   | Pour Gaslands, déployer par le script (§4.3), qui change `IMAGE_TAG` et vérifie `/api/version` ; à la main, toujours vérifier `grep IMAGE_TAG .env` avant de conclure |
| `docker compose up` échoue avec _"dependency failed to start"_ sur le backend                                                                   | Le plus souvent une variable de `.env` manquante/invalide — le backend valide strictement son environnement au démarrage et s'arrête volontairement sinon                                                                                                | `docker compose logs backend` pour le message exact ; vérifier qu'aucun placeholder du type `<...>` n'est resté tel quel dans `.env` (`grep '<' .env`)                |

---

## 7. Question ouverte : auto-déploiement

Aujourd'hui, la mise à jour d'une application est **lancée à la main** : un
tag Git déclenche la publication de l'image, mais c'est un humain qui lance
le déploiement sur le VPS (pour Gaslands, `deploy-gaslands.sh vX.Y.Z`, §4.3).
Deux façons d'automatiser
cette dernière étape ont été identifiées, non retenues pour l'instant :

- **"Push"** — un job CI se connecte en SSH au VPS après la publication de
  l'image. Permettrait de rester sur des tags de version précis, mais
  introduirait le **premier** secret capable de déclencher une action sur le
  VPS depuis l'extérieur (jusqu'ici, le VPS n'accepte jamais rien
  d'entrant hors SSH administratif) — un secret CI qui fuiterait donnerait un
  accès quasi-root au VPS.
- **"Pull"** — un outil comme _Watchtower_, sur le VPS lui-même, qui surveille
  périodiquement si une image a changé sur le registre et se redéploie
  seul. Cohérent avec le principe "rien n'entre depuis l'extérieur", mais
  impose de suivre un tag mutable (type `:latest`) plutôt qu'un tag figé,
  incompatible avec le choix actuel de ne publier que des tags de version
  et d'exiger `IMAGE_TAG` (cf. §3.2).

Aucune des deux n'est mise en œuvre à ce jour — décision à prendre plus tard
si la fréquence des mises à jour le justifie.
