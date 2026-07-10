# Gaslands Manager — Exécuter les tests E2E (guide pratique)

> Prérequis d'environnement et procédure exacte pour lancer `backend-e2e` et
> `frontend-e2e` sur une machine ou un conteneur neuf, jusqu'au bout.
> Complète [TESTING.md](TESTING.md) (qui documente l'*architecture* de
> l'infra e2e — `global-setup.ts`, base `gaslands_test`, helpers) : ce
> document-ci répond à *quelles commandes taper, dans quel ordre, et quoi
> faire quand ça casse*. Mettre à jour dès qu'un nouveau piège d'environnement
> est découvert (nouvelle distro, nouvelle version de Playwright…).

---

## 1. `backend-e2e` (Vitest + axios)

Contrairement à `frontend-e2e`, cette suite **ne démarre pas son propre backend** —
`global-setup.ts` se contente d'attendre qu'un serveur réponde déjà sur le port 3000
(`GET /api/catalog/sponsors`). Il faut donc le démarrer manuellement au préalable :

```bash
# Terminal 1 — laisser tourner
npx nx serve backend
# attendre la ligne "🚀 Backend Gaslands démarré sur http://localhost:3000/api"

# Terminal 2
npx nx e2e backend-e2e
```

Lancer directement `npx nx e2e backend-e2e` sans backend déjà démarré échoue avec
`Le backend n'a pas démarré dans les 30s` (cf. Troubleshooting §3).

---

## 2. `frontend-e2e` (Playwright)

### 2.1 Prérequis — navigateurs

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

### 2.2 Prérequis — bibliothèques système (Linux headless)

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
majeur — la commande ci-dessus échoue intégralement (voir piège ci-dessous) :

| Paquet attendu (Ubuntu 24.04) | Paquet réel (Ubuntu 26.04) |
|---|---|
| `libicu74` | `libicu78` |
| `libevent-2.1-7` | `libevent-2.1-7t64` |
| `libx264-164` | `libx264-165` |
| `libxml2` (fournit `libxml2.so.2`) | **aucun** — `libxml2-16` ne fournit que `.so.16`, ABI incompatible |
| `libwoff2dec1.0.2` | **aucun paquet équivalent dans les dépôts** |

**Conséquence** : sur Ubuntu 26.04 (ou toute distro dont libxml2/ICU ont dépassé les
sonames attendus par le build WebKit précompilé de Playwright), **WebKit ne peut pas
être satisfait via `apt`** — vérifié, ce n'est pas une histoire de nom de paquet mal
orthographié : `libxml2.so.2` n'existe simplement plus dans les dépôts de cette distro.
Deux options :

1. **Se limiter à Chromium + Firefox** (suffisant pour la couverture actuelle du
   projet, cf. §2.3) — c'est le choix retenu quand WebKit est indisponible.
2. **Image Docker officielle** `mcr.microsoft.com/playwright:v1.60.0-noble` (fige
   Ubuntu 24.04, libs garanties correctes) si WebKit est réellement nécessaire (CI par
   exemple).

### 2.3 Lancer la suite

Le backend de test réutilise le port 3000 (proxy Angular,
`apps/frontend/proxy.conf.json`) — il ne peut pas cohabiter avec un backend de dev déjà
lancé sur ce port :

```bash
./dev.sh --kill   # ou Ctrl+C sur le process ./dev.sh, ou tuer manuellement (cf. §3)

# Suite complète (3 navigateurs — échoue si WebKit est indisponible, cf. §2.2)
npx nx e2e frontend-e2e

# Limité à Chromium + Firefox (contournement WebKit)
npx nx e2e frontend-e2e -- --project=chromium --project=firefox
```

Sur une distro non officiellement supportée (§2.1), préfixer avec
`PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` (même valeur qu'à l'installation) —
sinon la suite refuse de démarrer avec la même erreur `does not support`.

### 2.4 Flakiness connue — Firefox en exécution parallèle

`campaign-program.spec.ts` (et occasionnellement `teams.spec.ts`) peut échouer
sporadiquement **sur `[firefox]` uniquement** lors d'un run multi-tests en parallèle,
avec un timeout dans `registerTestUser()` :

```
Error: expect(page).toHaveURL(/\/home/) failed
Received string: "http://localhost:4200/register"
```

Rejoué seul (`-g "<titre exact du test>" --project=firefox`), il passe
systématiquement — course entre workers sur le formulaire d'inscription (chaque test
crée son propre utilisateur via `registerTestUser()`), pas une régression du code
testé. **Un échec isolé sur `[firefox]` qui disparaît en isolation n'est pas un signal
d'alerte** ; un échec qui persiste en isolation, ou qui apparaît aussi sur `[chromium]`,
en est un.

---

## 3. Troubleshooting

| Symptôme | Cause | Fix |
|---|---|---|
| `backend-e2e` : « No test files found » puis « Le backend n'a pas démarré dans les 30s » | Aucun backend ne tourne sur `:3000` | Démarrer `npx nx serve backend` dans un terminal séparé, attendre le healthcheck, puis relancer `backend-e2e` (§1) |
| `frontend-e2e` : « Le backend de test n'a pas démarré dans les 30s … occupe déjà le port 3000 » | Un process `nx serve backend` **orphelin** d'un run précédent tient encore le port | `lsof -i :3000 -sTCP:LISTEN` pour trouver les PID, puis tuer **toute la chaîne** (`npm exec` → `nx` → `node`), pas seulement le process Node final — sinon des enfants survivent et retiennent le port |
| `browserType.launch: Executable doesn't exist at .../pw_run.sh` | Navigateurs Playwright non installés dans ce conteneur | `npx playwright install <browser>` (§2.1) |
| `ERROR: Playwright does not support chromium on ubuntuXX.04-x64` | Distro plus récente que la dernière officiellement supportée par cette version de Playwright | `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` (ou la LTS la plus proche) avant `install` **et** avant `e2e` (§2.1) |
| `apt-get install` échoue avec `Unable to locate package` sur un nom de la liste WebKit | Renommage de paquet suite à un bump de soname (ICU, libx264…) sur une distro très récente | Chercher le nom réel via `apt-cache search <lib>` / `apt list \| grep <lib>`, cf. tableau §2.2. Si `libxml2`/`libwoff2dec` restent introuvables, WebKit est un cul-de-sac sur cette distro — repli sur §2.2 option 1 ou 2 |
| `apt-get install` échoue sur **un seul** nom de paquet, mais le log affiche « Note, selecting X instead of Y » pour d'autres avant l'erreur | **Toute la transaction a échoué** — `apt-get` n'installe **rien** si un seul nom de la liste est introuvable, même les paquets « sélectionnés avec succès » listés avant l'erreur | Corriger tous les noms fautifs (tableau §2.2) puis relancer la commande complète en une seule fois ; vérifier avec `dpkg -l \| grep <paquet>` que l'installation a bien eu lieu avant de reprendre |
| Un test échoue uniquement sur `[firefox]` dans un run multi-navigateurs, mais passe rejoué seul | Flakiness liée aux workers Playwright en parallèle (§2.4) | Rejouer avec `-g "<titre exact>" --project=firefox` avant de conclure à une régression |
