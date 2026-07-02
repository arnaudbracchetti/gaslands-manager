# Campagnes

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md).
> Mettre à jour après tout changement du module Campaign.
> Document de conception détaillé : [`docs/plans/2026-06-14-saisons-design.md`](../plans/2026-06-14-saisons-design.md) (conception initiale, terminologie "saison" — renommée `Campaign` depuis, cf. commit `727d6e3`).

---

## Vue d'ensemble

Une **Campagne** est une "ligue" regroupant plusieurs équipes (chacune appartenant à un
utilisateur différent) qui jouent ensemble plusieurs parties au fil du temps. Un
utilisateur crée la campagne (devenant automatiquement son organisateur), peut y inviter
d'autres joueurs via un code partageable, et valide leurs demandes d'inscription.

**Cycle de vie** (`CampaignState`) : `EN_CONSTRUCTION` (état initial — gestion libre des
inscriptions) → `EN_COURS` → `TERMINEE` (séquentiel, pas de retour en arrière).

---

## Inscription

`ParticipantStatus` : `PENDING` | `VALIDATED` | `REJECTED`

- Toute personne disposant du code d'invitation peut soumettre une demande
  d'inscription (choix d'une de ses équipes) → crée un `CampaignParticipant` `PENDING`.
- Un organisateur valide (`PENDING → VALIDATED`) ou refuse (`PENDING → REJECTED`) chaque
  demande.
- **"Refuser" un participant validé** (`VALIDATED → REJECTED`) : action réversible,
  distincte du retrait définitif (`DELETE`). Réservée aux organisateurs,
  `EN_CONSTRUCTION` uniquement. Un organisateur ne peut pas se refuser lui-même s'il est
  le dernier organisateur `VALIDATED` de la campagne (pas de campagne "orpheline").
- **"Valider" un participant refusé** (`REJECTED → VALIDATED`) : revalidation, sans
  contrainte d'état supplémentaire.
- **Retirer un participant** (`DELETE`) : suppression définitive de la ligne
  `CampaignParticipant`, réservée aux organisateurs, `EN_CONSTRUCTION` uniquement.

**Changer l'équipe engagée** : tant que la campagne est `EN_CONSTRUCTION`, chaque
participant `VALIDATED` (organisateur ou non) peut changer l'équipe qu'il engage parmi
ses propres équipes, via le sélecteur "Votre équipe" de l'écran `/campaigns/:id`.

---

## Écran `/campaigns/:id` — structure par visibilité

- En-tête : nom, état, badge "🏆 Organisateur" et bouton "🗑 Supprimer la campagne"
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

Sécurité : un utilisateur ne peut accéder qu'aux campagnes où il est `CampaignParticipant`
`VALIDATED` (ou via le code d'invitation pour les infos minimales). Toute autre
tentative d'accès retourne HTTP 404 (pas de fuite d'information).

---

## Programme Télé (mode campagne — US-A1)

Une section **Programme Télé** est affichée sur `/campaigns/:id` **dans tous les
états** de la campagne. L'organisateur y planifie des **parties** (`Game`) — chacune
rattachée à un *scénario* du catalogue (`EVENEMENT_TELE` ou `ESCARMOUCHE`). La
gestion est possible en `EN_CONSTRUCTION` et `EN_COURS` ; en `TERMINEE`, le
programme reste **visible en lecture seule**.

- **Catalogue de scénarios** : chargé au démarrage depuis
  `database_init/data/scenarios.yml` par `ScenarioCatalogService` (même mécanisme
  que le catalogue de jeu, cf. ARCHITECTURE.md §3.3). Exposé en lecture publique
  via `GET /api/catalog/scenarios`.
- **Ajout d'une partie** (`POST /api/campaigns/:id/games`) : organisateur, campagne
  `EN_CONSTRUCTION` ou `EN_COURS` (refusé en `TERMINEE`, HTTP 400). La partie est
  créée `PLANIFIE`, en **fin de programme** (ordre auto-append = MAX+1). Le type
  est repris du scénario par défaut.
- **Édition / suppression** (`PUT`/`DELETE .../games/:gameId`) : organisateur,
  `EN_CONSTRUCTION` ou `EN_COURS` (refusé en `TERMINEE`, HTTP 400). Une partie
  `JOUE` est **figée** (HTTP 400 si on tente de la modifier ou supprimer). *Le
  statut `JOUE` n'est pas encore atteignable — l'enregistrement de résultat est
  une story ultérieure ; la garde est posée dès maintenant.*
- **Consultation** (`GET /api/campaigns/:id/games`) : tout participant `VALIDATED`
  voit le programme trié, en lecture seule, **quel que soit l'état** de la campagne.
  Les actions de gestion ne s'affichent que pour l'organisateur et hors `TERMINEE`.
- **Réordonnancement** (changer l'ordre au-delà de l'auto-append) : **hors
  périmètre d'US-A1**, suivi en US-A4 (cf.
  [backlog](../plans/2026-06-21-mode-campagne-backlog.md)).

Sécurité : autorisation assurée dans chaque use case (écritures) via les helpers
`assertOrganizer` / `assertParticipant` opérant sur l'état replay, et dans
`CampaignQueryService` (lectures) via `assertVisibleParticipant` — toute tentative
non autorisée retourne HTTP 404 (pas de fuite d'information), même pattern que le
reste du module Campaign.

---

## Hors scope de l'itération actuelle

Réordonnancement du Programme (US-A4), verrouillage effectif `isLocked` en
`EN_COURS`, visibilité partielle pour un `PENDING`, quitter une campagne
volontairement, rotation du code d'invitation.

> Les résultats de parties (classement, Points de Championnat), l'Atelier et la Table
> des Épaves sont désormais **implémentés** (cf. tables d'endpoints ci-dessous et
> l'event-sourcing du module `campaign/`).

---

## Modèles de données

### `Campaign`

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
| `myRole` | `'organizer' \| 'participant'` | Rôle de l'utilisateur connecté dans cette campagne. |

### `CampaignParticipant`

Une ligne par (utilisateur, équipe choisie) inscrit à une campagne. Contrainte unique
`(campaignId, userId)` : un utilisateur ne peut engager qu'une seule de ses équipes par
campagne — modifiable (`teamId`) tant que la campagne est `EN_CONSTRUCTION`.

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `campaignId` | number | FK → Campaign (`CASCADE`) |
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

### `Game` _(mode campagne — Programme Télé et Atelier)_

Une partie ou un atelier du Programme d'une campagne. Le scénario est référencé par
`scenarioId` (FK logique vers `Scenario.nom_interne`, catalogue en mémoire) — `null`
pour les ateliers.

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `campaignId` | number | FK → Campaign (`CASCADE`) |
| `scenarioId` | string \| null | référence `Scenario.nom_interne` — `null` pour `ATELIER` |
| `type` | `'EVENEMENT_TELE' \| 'ESCARMOUCHE' \| 'ATELIER'` | `ATELIER` créé automatiquement par `FinalizeGameUseCase` |
| `status` | `'PLANIFIE' \| 'JOUE' \| 'OUVERT' \| 'CLOTURE'` | `OUVERT`/`CLOTURE` réservés aux ateliers |
| `order` | number | `double precision` — auto-append MAX+1 ; ateliers intercalés à `partie.order + 0.5` |
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

## API Endpoints — Campagnes

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/campaigns` | JWT | Mes campagnes (participant `VALIDATED`) |
| POST | `/api/campaigns` | JWT | Créer une campagne (`name` + `teamId` du créateur, devient organisateur) |
| GET | `/api/campaigns/pending` | JWT | Mes demandes d'inscription en attente |
| GET | `/api/campaigns/organizing/pending-requests` | JWT | Inscriptions en attente dans mes campagnes (organisateur) |
| GET | `/api/campaigns/by-code/:code` | JWT | Infos minimales d'une campagne par son code d'invitation |
| GET | `/api/campaigns/:id` | JWT | Détail d'une campagne (participant `VALIDATED`) |
| DELETE | `/api/campaigns/:id` | JWT | Supprimer la campagne (organisateur, cascade sur les participants) |
| PUT | `/api/campaigns/:id/state` | JWT | Transition d'état (organisateur) |
| GET | `/api/campaigns/:id/participants` | JWT | Liste des participants |
| POST | `/api/campaigns/:id/participants` | JWT | Demande d'inscription (`{ teamId }`) |
| PUT | `/api/campaigns/:id/participants/me` | JWT | Changer l'équipe engagée par l'utilisateur connecté (`{ teamId }`, `EN_CONSTRUCTION` uniquement) |
| PUT | `/api/campaigns/:id/participants/:pid/validate` | JWT | Valider/refuser (`{ accept }`, organisateur) — couvre `PENDING→VALIDATED/REJECTED`, `VALIDATED→REJECTED`, `REJECTED→VALIDATED` |
| PUT | `/api/campaigns/:id/participants/:pid/promote` | JWT | Promouvoir co-organisateur (organisateur) |
| DELETE | `/api/campaigns/:id/participants/:pid` | JWT | Retirer un participant (organisateur, `EN_CONSTRUCTION` uniquement) |

> Routes participants déclarées dans cet ordre dans `campaign.controller.ts` : la route
> `PUT :id/participants/me` est définie **avant** `PUT :id/participants/:pid/validate`,
> pour éviter que NestJS ne capture `me` comme valeur de `:pid`.

## API Endpoints — Programme Télé (mode campagne)

Tous déclarés dans le **`campaign.controller.ts` unique** (le second controller `game.controller.ts`
a été supprimé au basculement Phase 2). Le contrôle d'accès en écriture est assuré dans chaque
use case via `assertOrganizer` / `assertParticipant` opérant sur l'état replay (pas d'accès SQL
supplémentaire) ; en lecture via `CampaignQueryService.assertVisibleParticipant`.

### Gestion du Programme (CRUD parties)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/catalog/scenarios` | Non | Liste publique des scénarios du catalogue |
| GET | `/api/campaigns/:id/games` | JWT | Programme trié (participant `VALIDATED`) |
| POST | `/api/campaigns/:id/games` | JWT | Ajouter une partie (`{ scenarioId, type? }`, organisateur, `EN_CONSTRUCTION`/`EN_COURS`) |
| PUT | `/api/campaigns/:id/games/:gameId` | JWT | Éditer une partie `PLANIFIE` (organisateur, `EN_CONSTRUCTION`/`EN_COURS`) |
| DELETE | `/api/campaigns/:id/games/:gameId` | JWT | Supprimer une partie `PLANIFIE` (organisateur, `EN_CONSTRUCTION`/`EN_COURS`) |
| POST | `/api/campaigns/:id/games/:gameId/results` | JWT | Enregistrer le résultat (`{ results: [{ participantId, rank }] }`, organisateur) → partie `JOUE` + atelier `OUVERT`. Crée des `RankingAssignedEvent` via `Campaign.recordResult` (convergence event-sourcing) |
| GET | `/api/campaigns/:id/games/:gameId/results` | JWT | Résultats triés par rang (participant `VALIDATED`) — **dérivés du journal `game_events`** (`eventType = RANKING_ASSIGNED`), plus de table `game_results` |

> Ce sont ces deux routes `/results` (et non les endpoints `/events/*`) que consomme le
> frontend Angular. Leur forme de réponse (`Game` pour le POST, `GameResult[]` pour le GET)
> est **inchangée** malgré la bascule vers l'event-sourcing.

### Résultats et classement — endpoints event-sourcing (Partie 4)

> Endpoints granulaires du système event-sourcing, **non consommés par le frontend** (usage API direct).

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/campaigns/:id/games/:gameId/events/ranking` | JWT | Enregistrer le rang et les PC d'un participant (organisateur) — 204 |
| POST | `/api/campaigns/:id/games/:gameId/events/wallet` | JWT | Mouvement de cagnotte `{ participantId, amount, reason }` (organisateur) — 204 |
| POST | `/api/campaigns/:id/games/:gameId/events/vehicle-lost` | JWT | Perte d'un véhicule `{ participantId, vehicleId, weaponIds? }` (organisateur) — 204 |
| POST | `/api/campaigns/:id/games/:gameId/events/resistance` | JWT | Contact Résistance `{ participantId }` (+3 PR secrets, organisateur) — 204 |
| POST | `/api/campaigns/:id/games/:gameId/finalize` | JWT | Finalise la partie `PLANIFIE → JOUE` ; crée un `AtelierGame OUVERT` (organisateur) |
| GET | `/api/campaigns/:id/standings` | JWT | Classement après replay complet (tout participant `VALIDATED`) |

### Atelier et épaves (Partie 5)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/campaigns/:id/workshop` | JWT | État campagne de l'équipe du participant connecté (véhicules transients, chocs, séquelles, wallet) |
| POST | `/api/campaigns/:id/games/:gameId/events/equipment` | JWT | Achat/revente `{ operation, entityType, nomInterne, … }` dans un `AtelierGame OUVERT` — 204 |
| POST | `/api/campaigns/:id/games/:gameId/events/wreck` | JWT | Table des Épaves — D6 serveur `{ participantId, vehicleId, weaponIdChoice? }` (organisateur) |
| POST | `/api/campaigns/:id/games/:gameId/events/sequella` | JWT | Séquelle permanente `{ vehicleId, sequellaTypeNom }` dans un `AtelierGame OUVERT` — 204 |
