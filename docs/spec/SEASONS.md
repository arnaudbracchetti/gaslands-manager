# Saisons

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md).
> Mettre à jour après tout changement du module Season.
> Document de conception détaillé : [`docs/plans/2026-06-14-saisons-design.md`](../plans/2026-06-14-saisons-design.md).

---

## Vue d'ensemble

Une **Saison** est une "ligue" regroupant plusieurs équipes (chacune appartenant à un
utilisateur différent) qui jouent ensemble plusieurs parties au fil du temps. Un
utilisateur crée la saison (devenant automatiquement son organisateur), peut y inviter
d'autres joueurs via un code partageable, et valide leurs demandes d'inscription.

**Cycle de vie** (`SeasonState`) : `EN_CONSTRUCTION` (état initial — gestion libre des
inscriptions) → `EN_COURS` → `TERMINEE` (séquentiel, pas de retour en arrière).

---

## Inscription

`ParticipantStatus` : `PENDING` | `VALIDATED` | `REJECTED`

- Toute personne disposant du code d'invitation peut soumettre une demande
  d'inscription (choix d'une de ses équipes) → crée un `SeasonParticipant` `PENDING`.
- Un organisateur valide (`PENDING → VALIDATED`) ou refuse (`PENDING → REJECTED`) chaque
  demande.
- **"Refuser" un participant validé** (`VALIDATED → REJECTED`) : action réversible,
  distincte du retrait définitif (`DELETE`). Réservée aux organisateurs,
  `EN_CONSTRUCTION` uniquement. Un organisateur ne peut pas se refuser lui-même s'il est
  le dernier organisateur `VALIDATED` de la saison (pas de saison "orpheline").
- **"Valider" un participant refusé** (`REJECTED → VALIDATED`) : revalidation, sans
  contrainte d'état supplémentaire.
- **Retirer un participant** (`DELETE`) : suppression définitive de la ligne
  `SeasonParticipant`, réservée aux organisateurs, `EN_CONSTRUCTION` uniquement.

**Changer l'équipe engagée** : tant que la saison est `EN_CONSTRUCTION`, chaque
participant `VALIDATED` (organisateur ou non) peut changer l'équipe qu'il engage parmi
ses propres équipes, via le sélecteur "Votre équipe" de l'écran `/seasons/:id`.

---

## Écran `/seasons/:id` — structure par visibilité

- En-tête : nom, état, badge "🏆 Organisateur" et bouton "🗑 Supprimer la saison"
  (organisateurs uniquement).
- "Votre équipe" : sélecteur modifiable (`EN_CONSTRUCTION`) ou affichage en lecture
  seule sinon.
- "Les autres équipes" : participants `VALIDATED` autres que l'utilisateur courant,
  avec un bouton "Refuser" (organisateurs uniquement, masqué sur le dernier
  organisateur).
- "En attente de validation" et "Refusé" : **visibles uniquement par les
  organisateurs** — entièrement absentes du DOM pour les autres participants, pas
  seulement masquées. Boutons Valider/Refuser/Retirer (en attente) et Valider
  (refusé) respectivement.

Sécurité : un utilisateur ne peut accéder qu'aux saisons où il est `SeasonParticipant`
`VALIDATED` (ou via le code d'invitation pour les infos minimales). Toute autre
tentative d'accès retourne HTTP 404 (pas de fuite d'information).

---

## Programme Télé (mode campagne — US-A1)

Une section **Programme Télé** est affichée sur `/seasons/:id` **dans tous les
états** de la saison. L'organisateur y planifie des **parties** (`Game`) — chacune
rattachée à un *scénario* du catalogue (`EVENEMENT_TELE` ou `ESCARMOUCHE`). La
gestion est possible en `EN_CONSTRUCTION` et `EN_COURS` ; en `TERMINEE`, le
programme reste **visible en lecture seule**.

- **Catalogue de scénarios** : chargé au démarrage depuis
  `database_init/data/scenarios.yml` par `ScenarioCatalogService` (même mécanisme
  que le catalogue de jeu, cf. ARCHITECTURE.md §3.3). Exposé en lecture publique
  via `GET /api/catalog/scenarios`.
- **Ajout d'une partie** (`POST /api/seasons/:id/games`) : organisateur, saison
  `EN_CONSTRUCTION` ou `EN_COURS` (refusé en `TERMINEE`, HTTP 400). La partie est
  créée `PLANIFIE`, en **fin de programme** (ordre auto-append = MAX+1). Le type
  est repris du scénario par défaut.
- **Édition / suppression** (`PUT`/`DELETE .../games/:gameId`) : organisateur,
  `EN_CONSTRUCTION` ou `EN_COURS` (refusé en `TERMINEE`, HTTP 400). Une partie
  `JOUE` est **figée** (HTTP 400 si on tente de la modifier ou supprimer). *Le
  statut `JOUE` n'est pas encore atteignable — l'enregistrement de résultat est
  une story ultérieure ; la garde est posée dès maintenant.*
- **Consultation** (`GET /api/seasons/:id/games`) : tout participant `VALIDATED`
  voit le programme trié, en lecture seule, **quel que soit l'état** de la saison.
  Les actions de gestion ne s'affichent que pour l'organisateur et hors `TERMINEE`.
- **Réordonnancement** (changer l'ordre au-delà de l'auto-append) : **hors
  périmètre d'US-A1**, suivi en US-A4 (cf.
  [backlog](../plans/2026-06-21-mode-campagne-backlog.md)).

Sécurité : autorisation déléguée à `SeasonService.assertOrganizer` /
`SeasonService.assertVisibleParticipant` — toute tentative non autorisée retourne
HTTP 404 (pas de fuite d'information), même pattern que le reste du module Season.

---

## Hors scope de l'itération actuelle

Résultats des parties (`GameResult`, classement, Points de Championnat),
réordonnancement du Programme (US-A4), verrouillage effectif `isLocked` en
`EN_COURS`, visibilité partielle pour un `PENDING`, quitter une saison
volontairement, rotation du code d'invitation.

---

## Modèles de données

### `Season`

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `name` | string(100) | obligatoire |
| `state` | `'EN_CONSTRUCTION' \| 'EN_COURS' \| 'TERMINEE'` | défaut `EN_CONSTRUCTION` |
| `inviteCode` | string | unique, indexé — token généré à la création |
| `createdAt` / `updatedAt` | Date | auto |

**Champs calculés dans la réponse API** (non stockés en base) :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `participantCount` | number | Nombre de participants `VALIDATED`. |
| `myRole` | `'organizer' \| 'participant'` | Rôle de l'utilisateur connecté dans cette saison. |

### `SeasonParticipant`

Une ligne par (utilisateur, équipe choisie) inscrit à une saison. Contrainte unique
`(seasonId, userId)` : un utilisateur ne peut engager qu'une seule de ses équipes par
saison — modifiable (`teamId`) tant que la saison est `EN_CONSTRUCTION`.

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `seasonId` | number | FK → Season (`CASCADE`) |
| `userId` | number | FK → User (`CASCADE`) |
| `teamId` | number | FK → Team (`CASCADE`) |
| `status` | `'PENDING' \| 'VALIDATED' \| 'REJECTED'` | défaut `PENDING` |
| `isOrganizer` | boolean | défaut `false` |
| `isLocked` | boolean | défaut `false` — posé pour `EN_COURS`, aucune logique d'application pour l'instant |
| `createdAt` / `updatedAt` | Date | auto |

**Champs calculés dans la réponse API** (non stockés en base) :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `userName` | string | Prénom + nom de l'utilisateur. |
| `teamName` | string | Nom de l'équipe engagée. |

### `Game` _(mode campagne — Programme Télé)_

Une partie planifiée du Programme d'une saison. Le scénario est référencé par
`scenarioId` (FK logique vers `Scenario.nom_interne`, catalogue en mémoire).

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `seasonId` | number | FK → Season (`CASCADE`) |
| `scenarioId` | string | référence `Scenario.nom_interne` du catalogue |
| `type` | `'EVENEMENT_TELE' \| 'ESCARMOUCHE'` | repris du scénario par défaut |
| `status` | `'PLANIFIE' \| 'JOUE'` | défaut `PLANIFIE` |
| `order` | number | position dans le programme (colonne `displayOrder` — `order` réservé SQL). Auto-append = MAX+1 |
| `playedAt` | Date \| null | null tant que `PLANIFIE` |
| `createdAt` / `updatedAt` | Date | auto |

**Champ calculé dans la réponse API** (non stocké en base) :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `scenarioName` | string | Libellé du scénario résolu depuis `ScenarioCatalogService`. |

### `Scenario` _(catalogue en mémoire, pas en base)_

Chargé depuis `database_init/data/scenarios.yml` au démarrage par
`ScenarioCatalogService`. Champs : `nom`, `nom_interne`, `type`
(`EVENEMENT_TELE` \| `ESCARMOUCHE`), `description` (Markdown → HTML au chargement).

---

## API Endpoints — Saisons

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/seasons` | JWT | Mes saisons (participant `VALIDATED`) |
| POST | `/api/seasons` | JWT | Créer une saison (`name` + `teamId` du créateur, devient organisateur) |
| GET | `/api/seasons/pending` | JWT | Mes demandes d'inscription en attente |
| GET | `/api/seasons/organizing/pending-requests` | JWT | Inscriptions en attente dans mes saisons (organisateur) |
| GET | `/api/seasons/by-code/:code` | JWT | Infos minimales d'une saison par son code d'invitation |
| GET | `/api/seasons/:id` | JWT | Détail d'une saison (participant `VALIDATED`) |
| DELETE | `/api/seasons/:id` | JWT | Supprimer la saison (organisateur, cascade sur les participants) |
| PUT | `/api/seasons/:id/state` | JWT | Transition d'état (organisateur) |
| GET | `/api/seasons/:id/participants` | JWT | Liste des participants |
| POST | `/api/seasons/:id/participants` | JWT | Demande d'inscription (`{ teamId }`) |
| PUT | `/api/seasons/:id/participants/me` | JWT | Changer l'équipe engagée par l'utilisateur connecté (`{ teamId }`, `EN_CONSTRUCTION` uniquement) |
| PUT | `/api/seasons/:id/participants/:pid/validate` | JWT | Valider/refuser (`{ accept }`, organisateur) — couvre `PENDING→VALIDATED/REJECTED`, `VALIDATED→REJECTED`, `REJECTED→VALIDATED` |
| PUT | `/api/seasons/:id/participants/:pid/promote` | JWT | Promouvoir co-organisateur (organisateur) |
| DELETE | `/api/seasons/:id/participants/:pid` | JWT | Retirer un participant (organisateur, `EN_CONSTRUCTION` uniquement) |

> Routes participants déclarées dans cet ordre dans `season.controller.ts` : la route
> `PUT :id/participants/me` est définie **avant** `PUT :id/participants/:pid/validate`,
> pour éviter que NestJS ne capture `me` comme valeur de `:pid`.

## API Endpoints — Programme Télé (mode campagne)

Déclarés dans `game/game.controller.ts` (module `GameModule`, distinct du
`SeasonController`). Le contrôle d'accès est délégué à `SeasonService`.

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/catalog/scenarios` | Non | Liste publique des scénarios du catalogue |
| GET | `/api/seasons/:id/games` | JWT | Programme trié (participant `VALIDATED`) |
| POST | `/api/seasons/:id/games` | JWT | Ajouter une partie (`{ scenarioId, type? }`, organisateur, `EN_CONSTRUCTION`/`EN_COURS` ; 400 si `TERMINEE`) |
| PUT | `/api/seasons/:id/games/:gameId` | JWT | Éditer une partie `PLANIFIE` (organisateur, `EN_CONSTRUCTION`/`EN_COURS` ; 400 si `TERMINEE` ou `JOUE`) |
| DELETE | `/api/seasons/:id/games/:gameId` | JWT | Supprimer une partie `PLANIFIE` (organisateur, `EN_CONSTRUCTION`/`EN_COURS` ; 400 si `TERMINEE` ou `JOUE`) |
