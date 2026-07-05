# Gaslands Manager — Tests

> Détail des patterns de test et de l'infrastructure e2e. Contexte général et
> commandes : [ARCHITECTURE.md §8](ARCHITECTURE.md#8-tests).
> Mettre à jour après tout changement de pattern de test ou d'infrastructure e2e.

---

## 1. Backend — Patterns de test

**Service avec TypeORM** : mock du `Repository` via `getRepositoryToken` dans `Test.createTestingModule`.

**Service sans DI** (ex : `CatalogService`) : instanciation directe + Pattern Template Method (voir [ARCHITECTURE.md §3.3](ARCHITECTURE.md#33-catalogue-de-jeu--singleton-en-mémoire)). Appeler `service.onModuleInit()` manuellement dans `beforeEach`.

Ce qu'on teste : cas nominaux, `NotFoundException`, isolation par `userId`, câblage controller → service, relations pré-résolues.
Ce qu'on ne teste pas en unitaire : auth JWT (testé via le guard), SQL réel (→ e2e).

---

## 2. Frontend — Patterns de test

**Smart component** : mock du service dans `providers`, sous-composants rendent normalement.

**Dumb component** :

```typescript
// Initialiser un input() Signal
fixture.componentRef.setInput('team', mockTeam);
fixture.detectChanges();  // déclenche effect() si présent

// Observer un output() Signal
import { outputToObservable } from '@angular/core/rxjs-interop';
outputToObservable(component.editClicked).subscribe(t => emitted.push(t));
```

**Outils clés** : `HttpTestingController`, `of(data)` / `throwError(() => ...)`, `vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))`.

| Que tester ? | Fichier spec |
|---|---|
| Orchestration, appels API, visibilité formulaire | `teams.spec.ts` |
| Affichage carte, émission boutons | `team-card.spec.ts` |
| Pré-remplissage, validation, émission DTO | `team-form.spec.ts` |
| Requêtes HTTP (verbe, URL, corps) | `teams.service.spec.ts` |

---

## 3. E2E frontend — base de test dédiée et backend isolé

`apps/frontend-e2e/` (Playwright) dispose d'une base PostgreSQL de test
(`gaslands_test`) **distincte de la base de dev** (`gaslands`), mais hébergée dans le
**même conteneur** `gaslands_db` — pas de second conteneur Docker à gérer. L'isolation
repose sur un point technique : le comportement par défaut de `dotenv` (utilisé par
`@nestjs/config`) est de **ne jamais écraser une variable déjà présente dans
`process.env`** — il suffit donc d'exporter `DATABASE_NAME=gaslands_test` avant de
démarrer le backend pour qu'il pointe sur la base de test, sans toucher à
`apps/backend/.env` ni `app.module.ts`. `synchronize: true` (déjà actif, cf.
[ARCHITECTURE.md §4](ARCHITECTURE.md#4-base-de-données--postgresql-16)) crée alors le
schéma automatiquement au premier démarrage.

**Fichiers clés** (`apps/frontend-e2e/src/support/`) :

| Fichier | Rôle |
|---------|------|
| `db.ts` | Crée `gaslands_test` si absente, puis vide (`TRUNCATE ... CASCADE`) toutes les tables applicatives — état propre garanti à chaque run |
| `backend-process.ts` | `spawn`/`kill` d'un backend dédié avec `DATABASE_NAME=gaslands_test`, `PORT=3000` ; attend un healthcheck (`GET /api/catalog/sponsors`) avant de rendre la main |
| `global-setup.ts` | Orchestre `db.ts` puis `backend-process.ts`, dans cet ordre précis |
| `global-teardown.ts` | Arrête le backend de test en fin de run |
| `auth.ts` | Helpers `registerTestUser()` / `login()` réutilisables par tout futur spec authentifié (Vehicles, Campagnes…) |

**⚠️ Ordre critique `globalSetup` vs `webServer`** — le backend de test n'est
volontairement **pas** déclaré via l'option `webServer` de `playwright.config.ts`
(qui ne démarre que le frontend Angular). La base `gaslands_test` doit exister et être
vidée **avant** que TypeORM ne s'y connecte, et l'ordre d'exécution entre `globalSetup`
et `webServer` n'est pas garanti par Playwright pour ce cas d'usage — `global-setup.ts`
prend donc la main lui-même sur le cycle de vie du process backend (spawn → healthcheck
→ tests → kill en teardown), plutôt que de déléguer cette étape à `webServer`.

**Contrainte locale** : le backend de test tourne sur le port 3000, celui ciblé par le
proxy Angular (`apps/frontend/proxy.conf.json`, valeur fixe) — il ne peut donc pas
cohabiter avec un backend de dev déjà lancé sur ce port. Arrêter `dev.sh` (`./dev.sh
--kill`) avant `npx nx e2e frontend-e2e`.

**Couverture Teams/Vehicles** : `teams.spec.ts` (CRUD équipe/véhicule — création,
renommage, sponsor/description/budget, verrouillage sponsor, suppression équipe/véhicule
en cascade), `vehicle-equipment.spec.ts` (armes/améliorations, cas particulier de la
Tourelle — assignation/désassignation/retrait, coût ×3 —, garde de budget) et
`sponsor-catalog.spec.ts` (filtrage du catalogue véhicules/armes par sponsor). Helpers
partagés dans `support/teams.ts` (`createTeam`, `setSponsor`, `addVehicle`,
`createTeamWithVehicles`, `openEquipmentManager`, `optionCard`, `saveAndWait` — ce
dernier attend la réponse `PUT /api/teams/:id` avant tout `page.reload()`, nécessaire
car `TeamEditPage.saveField()` sauvegarde au blur sans aucun signal visuel de fin
d'écriture). Deux `data-testid` ajoutés pour fiabiliser des sélecteurs autrement
ambigus : `tam-weapon-{nomInterne}` (`tourelle-assignment-modal.html`) et
`vehicle-card-manage`/`vehicle-card-delete` (`vehicle-summary-card.html`).

**Couverture Campaigns** : `campaign-program.spec.ts` — spec pilote couvrant la
création d'une saison (équipe engagée dès la création), l'ajout d'une partie au
Programme Télé, et le wizard de fin de partie en bout en bout (classement →
désignation des épaves → résolution automatique de la Table des Épaves →
"Terminer"), avec vérification que la partie passe bien `PLANIFIE → ATELIER`
(badge de statut, cf. refonte du cycle de vie Atelier,
[design doc](plans/2026-07-05-atelier-lifecycle-design.md)). Aucun `data-testid`
dans les templates Campaigns : sélecteurs par rôle/label/texte français exact
(cf. commentaires du spec pour les pièges — ex. bouton "Enregistrer" nécessitant
`exact: true` pour ne pas matcher "Enregistrement...").

**Hors périmètre actuel** : intégration CI (`backend-e2e` n'y est pas non plus
aujourd'hui), inscriptions multi-utilisateurs (organisateur + participants
invités via code) et Atelier (achats/reventes d'équipement — aucune UI
frontend n'existe encore, cf. docs/spec/CAMPAIGN.md).
