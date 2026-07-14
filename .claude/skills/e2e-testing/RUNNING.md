# e2e-testing — Lancer les tests

> Chargé par `SKILL.md` pour la branche par défaut (lancer des tests). Ne contient rien
> sur l'écriture de nouveaux tests — cf. `WRITING.md` pour ça.

Toutes les commandes de ce fichier sont relatives à la racine du repo. Elles ont été
exécutées et vérifiées dans une session de travail réelle - pas de la documentation
paraphrasée.

## Prérequis

### Navigateurs Playwright

```bash
npx playwright install chromium firefox webkit
```

Sur une distro plus récente que la dernière officiellement supportée par la version de
Playwright installée (ex. Ubuntu 26.04 au moment d'écrire ces lignes, alors que
Playwright 1.60 ne connaît qu'Ubuntu ≤ 24.04), l'installation refuse de démarrer :

```
ERROR: Playwright does not support chromium on ubuntu26.04-x64
```

Contournement — forcer la détection vers la dernière LTS supportée (télécharge le build
de repli, compatible glibc) :

```bash
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright install chromium firefox webkit
```

Même préfixe requis **avant `e2e`** sur cette distro, pas seulement à l'installation
(sinon la suite refuse de démarrer avec la même erreur `does not support`).

### Bibliothèques système (Linux headless)

**Chromium et Firefox n'ont besoin d'aucune bibliothèque supplémentaire** sur une image
Ubuntu standard récente (validé sur Ubuntu 26.04 minimal, sans aucun paquet installé au
préalable — `npx playwright install chromium`/`firefox` ne signalent aucune dépendance
manquante).

**WebKit**, en revanche, réclame une longue liste de bibliothèques GTK/GStreamer/ICU/flite.
Sur Ubuntu 24.04/25.x :

```bash
sudo apt-get update
sudo apt-get install -y \
  libgtk-4-1 libgraphene-1.0-0 \
  libicu74 libxml2 libxslt1.1 \
  libevent-2.1-7 libopus0 \
  libgstreamer-plugins-base1.0-0 libgstreamer-gl1.0-0 libgstreamer-plugins-bad1.0-0 \
  libflite1 \
  libwebpdemux2 libwebpmux3 libwebp7 libavif16 \
  libharfbuzz-icu0 libjpeg8 \
  libwayland-server0 libmanette-0.2-0 \
  libenchant-2-2 libhyphen0 libsecret-1-0 \
  libwoff2dec1.0.2 libgles2 libx264-164
```

Sur Ubuntu 26.04, plusieurs de ces paquets ont changé de nom suite à un bump de soname
majeur — la commande ci-dessus échoue intégralement :

| Paquet attendu (Ubuntu 24.04) | Paquet réel (Ubuntu 26.04) |
|---|---|
| `libicu74` | `libicu78` |
| `libevent-2.1-7` | `libevent-2.1-7t64` |
| `libx264-164` | `libx264-165` |
| `libxml2` (fournit `libxml2.so.2`) | **aucun** — `libxml2-16` ne fournit que `.so.16`, ABI incompatible |
| `libwoff2dec1.0.2` | **aucun paquet équivalent dans les dépôts** |

**Conséquence** : sur Ubuntu 26.04 (ou toute distro dont libxml2/ICU ont dépassé les
sonames attendus par le build WebKit précompilé de Playwright), **WebKit ne peut pas
être satisfait via `apt`** — ce n'est pas une histoire de nom de paquet mal orthographié :
`libxml2.so.2` n'existe simplement plus dans les dépôts de cette distro. Deux options :

1. **Se limiter à Chromium + Firefox** (suffisant pour la couverture actuelle du projet)
   — c'est le choix retenu quand WebKit est indisponible.
2. **Image Docker officielle** `mcr.microsoft.com/playwright:v1.60.0-noble` (fige Ubuntu
   24.04, libs garanties correctes) si WebKit est réellement nécessaire (CI par exemple).

## Commandes - lancement rapide

Toutes exécutées et confirmées dans une session réelle (résultats réels, pas inventés).

**Par défaut, toujours utiliser des ports dédiés et auto-gérés** - jamais besoin de
vérifier si `dev.sh` tourne ou d'aller `lsof` les ports 3000/4200. Dès que
`BACKEND_PORT`/`FRONTEND_PORT` sont positionnés (même à des valeurs arbitraires),
`playwright.config.ts` (`usingCustomPorts`) démarre systématiquement un frontend ET un
backend **dédiés** (jamais celui de `dev.sh`, jamais un `reuseExistingServer`), que
`dev.sh` tourne ou non, et Playwright les détruit lui-même en fin de run
(`globalTeardown`). Ce chemin ne regarde jamais l'état des ports 3000/4200 - il n'y a
donc rien à détecter ni à décider avant de lancer :
```bash
.claude/skills/e2e-testing/quick-e2e.sh -g "<nom du describe ou du test>"
```
Équivalent explicite (le script ci-dessus n'est qu'un raccourci pour cette commande,
toujours sur les mêmes ports 3456/4201, sans détection de quoi que ce soit) :
```bash
BACKEND_PORT=3456 FRONTEND_PORT=4201 npx nx e2e frontend-e2e --skip-nx-cache -- --project=chromium -g "<nom>"
```
Les DEUX variables doivent être positionnées ENSEMBLE - en laisser une à sa valeur par
défaut alors que l'autre est personnalisée fait échouer le démarrage plutôt que de
tourner contre le mauvais backend (cf. Pièges ci-dessous).

`--skip-nx-cache` est déjà inclus ci-dessus : `BACKEND_PORT`/`FRONTEND_PORT` ne sont
PAS des inputs de cache Nx déclarés, donc relancer la même commande filtrée sans cette
option peut rejouer un ancien résultat en cache plutôt que réellement ré-exécuter
(piège vécu en session).

**Suite complète**, toujours sur ports dédiés :
```bash
BACKEND_PORT=3456 FRONTEND_PORT=4201 npx nx e2e frontend-e2e --skip-nx-cache
```

**Ports par défaut (3000/4200), en réutilisant le frontend de `dev.sh` s'il tourne
déjà** - option secondaire, seulement si on veut délibérément profiter d'un frontend
déjà chaud (évite un rebuild Angular) plutôt que d'en démarrer un dédié. Nécessite
d'arrêter `dev.sh` d'abord s'il tourne (sinon collision sur le port 3000, cf.
Troubleshooting) :
```bash
npx nx e2e frontend-e2e
```

**Limité à Chromium + Firefox** (contournement WebKit indisponible, cf. Prérequis
ci-dessus) :
```bash
npx nx e2e frontend-e2e -- --project=chromium --project=firefox
```

**`backend-e2e`** - contrairement à `frontend-e2e`, cette suite **ne démarre pas son
propre backend** : `global-setup.ts` se contente d'attendre qu'un serveur réponde déjà
(`GET /api/catalog/sponsors`). Il faut donc le démarrer manuellement au préalable. Lancer
directement `npx nx e2e backend-e2e` sans backend déjà démarré échoue avec `Le backend
n'a pas démarré dans les 30s` (cf. Troubleshooting ci-dessous) :
```bash
# Terminal 1 — laisser tourner
npx nx serve backend
# attendre la ligne "🚀 Backend Gaslands démarré sur http://localhost:3000/api"

# Terminal 2
npx nx e2e backend-e2e
```
`HOST`/`PORT` sont déjà lus depuis l'environnement (`support/test-setup.ts`/
`support/global-setup.ts`, défaut `localhost:3000`) - aucune modification de code requise
pour éviter un conflit avec `dev.sh` :
```bash
# Terminal 1 - un backend sur un port libre, distinct de celui de dev.sh
PORT=3001 npx nx serve backend

# Terminal 2 - cibler ce même port
PORT=3001 npx nx e2e backend-e2e
```

**Équivalent exact de la CI** (atomisé par fichier de spec, distribué via Nx Cloud - cf.
`.github/workflows/ci.yml:37`) :
```bash
npx nx run-many -t lint test build typecheck e2e-ci
```
Isoler le comportement CI d'un seul fichier :
```bash
npx nx run frontend-e2e:e2e-ci--src/<fichier>.spec.ts
```

## Infrastructure technique - base de test dédiée et backend isolé

`apps/frontend-e2e/` (Playwright) dispose d'une base PostgreSQL de test (`gaslands_test`)
**distincte de la base de dev** (`gaslands`), mais hébergée dans le **même conteneur**
`gaslands_db` - pas de second conteneur Docker à gérer. L'isolation repose sur un point
technique : le comportement par défaut de `dotenv` (utilisé par `@nestjs/config`) est de
**ne jamais écraser une variable déjà présente dans `process.env`** - il suffit donc
d'exporter `DATABASE_NAME=gaslands_test` avant de démarrer le backend pour qu'il pointe
sur la base de test, sans toucher à `apps/backend/.env` ni `app.module.ts`.
`synchronize: true` (déjà actif en dev) crée alors le schéma automatiquement au premier
démarrage.

**⚠️ Ordre critique `globalSetup` vs `webServer`** - le backend de test n'est
volontairement **pas** déclaré via l'option `webServer` de `playwright.config.ts` (qui ne
démarre que le frontend Angular). La base `gaslands_test` doit exister et être vidée
**avant** que TypeORM ne s'y connecte, et l'ordre d'exécution entre `globalSetup` et
`webServer` n'est pas garanti par Playwright pour ce cas d'usage - `global-setup.ts`
prend donc la main lui-même sur le cycle de vie du process backend (spawn → healthcheck →
tests → kill en teardown), plutôt que de déléguer cette étape à `webServer`.

**Ports configurables** : le backend de test tourne par défaut sur le port 3000, celui
ciblé par le proxy Angular (`apps/frontend/proxy.conf.cjs`, module CommonJS lisant
`process.env.BACKEND_PORT` au démarrage du dev-server plutôt que du JSON statique) - il ne
peut donc pas cohabiter avec un backend de dev déjà lancé sur ce port. Deux options :
arrêter `dev.sh` (`./dev.sh --kill`) avant `npx nx e2e frontend-e2e`, ou positionner
`BACKEND_PORT`/`FRONTEND_PORT` (lu par `playwright.config.ts`) sur des ports libres pour
lancer la suite en parallèle sans y toucher (cf. "Commandes - lancement rapide"
ci-dessus). Les deux variables doivent être positionnées ENSEMBLE - laisser
`FRONTEND_PORT` à sa valeur par défaut (4200) alors que `dev.sh` tourne dessus ferait
échouer le démarrage du frontend dédié (port déjà occupé), ce qui est le comportement
voulu (échec bruyant plutôt que réutiliser par erreur le frontend de `dev.sh`).

## Pièges découverts en session

- **Nx sérialise les tâches continues (`serve`) par id `project:target:configuration`,
  PAS par les arguments CLI.** Les tâches continues sont suivies par Nx dans un registre
  inter-process, indexé par l'id complet `project:target:configuration` - PAS par les
  arguments (`--port` inclus). Lancer `nx run backend:serve --port=3456` pendant que
  `dev.sh` fait déjà tourner `backend:serve:development` ne démarre donc PAS un second
  process indépendant : Nx attend silencieusement que l'instance de `dev.sh` se termine
  (jamais, en pratique), et son healthcheck répond quand même puisque c'est le même
  endpoint - les tests tourneraient alors, à l'insu de tous, contre le backend et la base
  de DEV plutôt que contre `gaslands_test`. C'est pourquoi `backend-process.ts` force
  TOUJOURS `--configuration=e2e` (une configuration dédiée dans `apps/backend/
  project.json`, même `buildTarget` que `development`, seul son nom change) - id de tâche
  distinct garanti, donc jamais de collision : soit un process réellement indépendant
  démarre, soit le port choisi est occupé par autre chose et l'échec est bruyant (port
  déjà utilisé), jamais silencieux. Même principe côté frontend (`apps/frontend/
  project.json`, configuration `serve:e2e`), mais seulement quand `BACKEND_PORT`/
  `FRONTEND_PORT` sont personnalisés - sinon `playwright.config.ts` réutilise le frontend
  de `dev.sh` déjà lancé (`reuseExistingServer`), qui cible déjà le bon port (3000) par
  défaut.
- **Un healthcheck HTTP seul ne suffit pas à prouver qu'on parle au bon backend.** Même
  avec `--configuration=e2e`, un healthcheck HTTP classique (`fetch(url).ok`) ne suffit
  pas à garantir qu'on parle au backend qu'on vient de spawn : si son build échoue (ou si
  le port choisi est occupé par autre chose qu'un `backend:serve`, donc sans collision
  Nx), notre process ne démarre jamais - mais si un backend de dev répond par ailleurs sur
  ce même port, le healthcheck réussirait "par accident" (même endpoint), et les tests
  tourneraient à l'insu de tous contre le backend et la base de DEV. `backend-process.ts`
  observe donc d'abord le flux stdout DE SON PROPRE process spawné (`waitForOwnStartup`,
  garanti exclusif à l'instance qu'il vient de créer) pour y guetter le message de
  démarrage émis par `main.ts` - et rejette immédiatement si le process sort (build en
  échec, port déjà occupé) avant de l'avoir émis. Le healthcheck HTTP classique
  n'intervient qu'ENSUITE, en confirmation complémentaire.
- **Nx peut rejouer un résultat en cache** si on relance le même test filtré sans changer
  un input de cache déclaré (`BACKEND_PORT`/`FRONTEND_PORT` n'en sont pas) -
  `--skip-nx-cache` pour garantir un run frais.
- **Warning cosmétique** `Starting inspector on localhost:9229 failed: address already in
  use` quand `dev.sh` tourne en parallèle : collision du port de debug Node
  (`--inspect`), sans impact sur le test lui-même (healthcheck + démarrage confirmés
  indépendamment).
- **Flakiness Firefox connue en exécution parallèle multi-specs.** `campaign-
  program.spec.ts` (et occasionnellement `teams.spec.ts`) peut échouer sporadiquement
  **sur `[firefox]` uniquement** lors d'un run multi-tests en parallèle, avec un timeout
  dans `registerTestUser()` :
  ```
  Error: expect(page).toHaveURL(/\/home/) failed
  Received string: "http://localhost:4200/register"
  ```
  Rejoué seul (`-g "<titre exact du test>" --project=firefox`), il passe
  systématiquement - course entre workers sur le formulaire d'inscription (chaque test
  crée son propre utilisateur via `registerTestUser()`), pas une régression du code
  testé. **Un échec isolé sur `[firefox]` qui disparaît en isolation n'est pas un signal
  d'alerte** ; un échec qui persiste en isolation, ou qui apparaît aussi sur `[chromium]`,
  en est un.

## Troubleshooting

| Symptôme | Cause | Fix |
|---|---|---|
| Reste bloqué, log `Waiting for ...:development in another nx process` | `dev.sh` tourne déjà, `serve` relancé sans configuration `e2e` distincte | Ne devrait plus arriver (configuration `e2e` forcée) - sinon vérifier qu'aucun script ne relance `nx run backend:serve`/`frontend:serve` sans `--configuration=e2e` |
| Le backend de test ne démarre pas dans les 30s, erreur explicite avec le port | Port déjà occupé (ex. `dev.sh`) | `BACKEND_PORT=<port libre>` (et `FRONTEND_PORT` en cohérence) |
| `backend-e2e` : « No test files found » puis « Le backend n'a pas démarré dans les 30s » | Aucun backend ne tourne sur `:3000` | Démarrer `npx nx serve backend` dans un terminal séparé, attendre le healthcheck, puis relancer `backend-e2e` |
| `frontend-e2e` : « Le backend de test n'a pas démarré dans les 30s … occupe déjà le port 3000 » | Un process `nx serve backend` **orphelin** d'un run précédent tient encore le port | `lsof -i :3000 -sTCP:LISTEN` pour trouver les PID, puis tuer **toute la chaîne** (`npm exec` → `nx` → `node`), pas seulement le process Node final - sinon des enfants survivent et retiennent le port. Alternative : `BACKEND_PORT=<port libre>` |
| Un test passe suspicieusement vite (quelques secondes) alors qu'il enregistre normalement un utilisateur/une campagne complète | Résultat rejoué depuis le cache Nx | Relancer avec `--skip-nx-cache` |
| `browserType.launch: Executable doesn't exist` | Navigateurs Playwright non installés | `npx playwright install <browser>` (cf. Prérequis ci-dessus) |
| `ERROR: Playwright does not support chromium on ubuntuXX.04-x64` | Distro plus récente que la dernière officiellement supportée par cette version de Playwright | `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` (ou la LTS la plus proche) avant `install` **et** avant `e2e` |
| Erreur libs système WebKit sur distro récente / `apt-get install` échoue avec `Unable to locate package` | Renommage de paquet suite à un bump de soname (ICU, libx264…) sur une distro très récente | Chercher le nom réel via `apt-cache search <lib>` / `apt list \| grep <lib>` (cf. table Prérequis ci-dessus). Si `libxml2`/`libwoff2dec` restent introuvables, WebKit est un cul-de-sac sur cette distro - repli sur Chromium+Firefox ou l'image Docker officielle |
| `apt-get install` échoue sur **un seul** nom de paquet, mais le log affiche « Note, selecting X instead of Y » pour d'autres avant l'erreur | **Toute la transaction a échoué** — `apt-get` n'installe **rien** si un seul nom de la liste est introuvable, même les paquets « sélectionnés avec succès » listés avant l'erreur | Corriger tous les noms fautifs puis relancer la commande complète en une seule fois ; vérifier avec `dpkg -l \| grep <paquet>` que l'installation a bien eu lieu avant de reprendre |
| Échec isolé sur `[firefox]` uniquement, en exécution parallèle | Flakiness connue (`registerTestUser`) | Rejouer avec `-g "<titre exact>" --project=firefox` avant de conclure à une régression |
