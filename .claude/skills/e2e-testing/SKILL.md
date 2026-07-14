---
name: e2e-testing
description: Run and write end-to-end tests for Gaslands Manager (Playwright frontend-e2e, Vitest+axios backend-e2e). Use when asked to run e2e tests, launch frontend-e2e/backend-e2e, test a flow end-to-end, run e2e in parallel with dev.sh, debug e2e flakiness, or decide whether a change needs e2e coverage vs a unit test.
---

# Tests de bout en bout (e2e) - Gaslands Manager

Deux suites e2e existent :
- **`frontend-e2e`** (Playwright) - un vrai navigateur (Chromium/Firefox/WebKit) contre
  un vrai backend NestJS et une base Postgres `gaslands_test` isolée, créée et vidée à
  chaque run.
- **`backend-e2e`** (Vitest + axios) - requêtes HTTP directes contre un backend NestJS
  déjà démarré manuellement.

**Ce fichier est volontairement minimal.** Le détail est réparti dans des fichiers
séparés, à lire seulement selon le besoin réel — inutile de charger les règles
d'écriture d'un test quand on veut juste lancer la suite, ou l'inverse :

| Fichier | Contenu | Quand le lire |
|---|---|---|
| `.claude/skills/e2e-testing/RUNNING.md` | Prérequis, commandes, infrastructure technique, pièges, troubleshooting | Branche par défaut (lancer des tests) |
| `.claude/skills/e2e-testing/WRITING.md` | Cadre de décision e2e-vs-unitaire, bonnes pratiques d'écriture | Branche `new` (générer un test) |
| `docs/E2E_TESTING.md` | Carte de couverture (specs) et helpers `support/` disponibles — **document vivant**, tenu à jour à chaque ajout de spec/helper | Avant d'écrire un test (savoir ce qui existe déjà), et mis à jour après (cf. `WRITING.md`) |

## Instructions d'exécution

```text
$ARGUMENTS
```

Ce skill est actionnable — n'affiche pas la documentation, **exécute** l'une des deux
branches suivantes selon `$ARGUMENTS`.

### Branche par défaut — lancer des tests (vide, `run`, `backend`, `ci`, ou un nom de test)

**Lire `.claude/skills/e2e-testing/RUNNING.md`**, puis :
- Vide ou `run` (éventuellement suivi d'un nom de test/spec) : lancer via
  `.claude/skills/e2e-testing/quick-e2e.sh`, filtré par `-g "<nom>"` si précisé — ports
  dédiés auto-gérés (démarrés puis détruits par Playwright), jamais besoin de vérifier
  l'état des ports 3000/4200 ou de `dev.sh`.
- `backend` : lancer `backend-e2e` (démarrer le backend manuellement au préalable).
- `ci` : lancer l'équivalent CI (`npx nx run-many -t lint test build typecheck e2e-ci`).

Toujours rapporter le résultat (pass/fail, specs concernés) de façon concise — ne pas
coller la sortie brute complète du terminal.

### Branche `new` — générer un test pertinent depuis la session en cours

Quand `$ARGUMENTS` commence par `new` : **lire `.claude/skills/e2e-testing/WRITING.md`
et `docs/E2E_TESTING.md`**, puis suivre le processus qui y est décrit (déduire ce qui a
été fait dans la session, appliquer le cadre de décision, vérifier/étendre la couverture
existante, écrire et exécuter le test, puis **mettre à jour `docs/E2E_TESTING.md`**).
Ne jamais affirmer qu'un test généré "devrait passer" sans l'avoir exécuté.
