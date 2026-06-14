# Saisons — Document de conception

> Statut : validé en brainstorming, prêt pour planification d'implémentation.
> Périmètre : fondations (saisons, organisateurs, invitations, inscriptions, parties) —
> la saisie des résultats de parties et leurs impacts (argent, dégâts véhicules) sont
> **hors scope**, traités dans une itération future.

---

## 1. Contexte et objectif

Une **Saison** est une "ligue" regroupant plusieurs **équipes** (`Team`), chacune
appartenant à un utilisateur différent, qui jouent ensemble plusieurs **parties**
(`Game`) au fil du temps. Un utilisateur crée la saison, peut y inviter d'autres
joueurs via un code partageable, et valide leurs demandes d'inscription. La saison
suit un cycle de vie en 3 états qui encadre quand les inscriptions/parties peuvent
être modifiées.

---

## 2. Modèle de données

### `Season` (table `seasons`)

| Champ | Type | Contraintes |
|---|---|---|
| `id` | number | PK, auto-incrémenté |
| `name` | string(100) | obligatoire |
| `state` | enum `SeasonState` | `EN_CONSTRUCTION` \| `EN_COURS` \| `TERMINEE`, défaut `EN_CONSTRUCTION` |
| `inviteCode` | string | unique, indexé — token généré à la création |
| `createdAt` / `updatedAt` | Date | auto |

### `SeasonParticipant` (table `season_participants`)

Une ligne par (utilisateur, équipe choisie) inscrit à une saison.

| Champ | Type | Contraintes |
|---|---|---|
| `id` | number | PK, auto-incrémenté |
| `seasonId` | number | FK → Season, `CASCADE` |
| `userId` | number | FK → User, `CASCADE` |
| `teamId` | number | FK → Team, `CASCADE` |
| `status` | enum `ParticipantStatus` | `PENDING` \| `VALIDATED` \| `REJECTED`, défaut `PENDING` |
| `isOrganizer` | boolean | défaut `false` |
| `isLocked` | boolean | défaut `false` — posé pour `EN_COURS`, **aucune logique d'application pour l'instant** |
| `createdAt` / `updatedAt` | Date | auto |

**Contrainte unique `(seasonId, userId)`** : un utilisateur ne peut inscrire qu'**une seule** de ses équipes par saison — même s'il en possède plusieurs au total. Modifier `teamId` sur la ligne existante (tant que `EN_CONSTRUCTION`) permet de changer l'équipe engagée.

### `Game` (table `games`)

| Champ | Type | Contraintes |
|---|---|---|
| `id` | number | PK, auto-incrémenté |
| `seasonId` | number | FK → Season, `CASCADE` |
| `name` | string | obligatoire |
| `scheduledAt` | Date \| null | nullable |
| `createdAt` / `updatedAt` | Date | auto |

Pas de champ de résultat — hors scope (cf. §6).

### `GameParticipant` (table `game_participants`)

Sous-ensemble des participants de la saison qui jouent une partie donnée.

| Champ | Type | Contraintes |
|---|---|---|
| `id` | number | PK, auto-incrémenté |
| `gameId` | number | FK → Game, `CASCADE` |
| `seasonParticipantId` | number | FK → SeasonParticipant, `CASCADE` |
| `createdAt` | Date | auto |

Contrainte unique `(gameId, seasonParticipantId)`. Référence `SeasonParticipant` (et non `Team` directement) — garde le lien scopé "participant validé de cette saison" et servira de point d'ancrage pour les futurs résultats par participant.

### Enums (`season/season.enums.ts`)

```typescript
export enum SeasonState {
  EN_CONSTRUCTION = 'EN_CONSTRUCTION',
  EN_COURS = 'EN_COURS',
  TERMINEE = 'TERMINEE',
}

export enum ParticipantStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
}
```

---

## 3. Cycle de vie de la saison

- **`EN_CONSTRUCTION`** (état initial) : les organisateurs peuvent gérer les invitations,
  valider/refuser les demandes, créer/modifier/supprimer des parties librement. Un
  participant peut changer l'équipe qu'il engage (`UPDATE teamId`).
- **`EN_COURS`** : plus d'ajout/retrait de participants. `isLocked` est positionné sur
  les `SeasonParticipant` (sans logique de blocage effective pour l'instant — réservé
  pour une itération future). Les parties peuvent toujours être ajoutées/jouées.
- **`TERMINEE`** : saison archivée en lecture seule, `isLocked` retombe à `false`.

Transitions possibles : `EN_CONSTRUCTION → EN_COURS → TERMINEE` (séquentiel, pas de retour en arrière prévu).

---

## 4. Organisateurs et invitations

- Le créateur de la saison devient automatiquement `SeasonParticipant` avec
  `isOrganizer=true, status=VALIDATED`, avec l'équipe qu'il choisit à la création.
- Un organisateur peut **promouvoir** n'importe quel participant `VALIDATED` au rang
  de co-organisateur (`isOrganizer=true`) — droits identiques au créateur.
- **Invitation par code** : `Season.inviteCode` est un token partageable hors-app.
  Toute personne disposant du code peut soumettre une demande d'inscription
  (`POST /api/seasons/:id/participants`, choix d'une de ses équipes) → crée une ligne
  `SeasonParticipant` en `PENDING`.
- Un organisateur valide ou refuse chaque demande (`PUT .../participants/:pid/validate`).
- **Garde-fou** : un organisateur ne peut pas se rétrograder lui-même s'il est le seul
  organisateur restant (pas de saison "orpheline").

---

## 5. Backend — Module `season/`

`apps/backend/src/app/season/`

**Entités** : `season.entity.ts`, `season-participant.entity.ts`, `game.entity.ts`, `game-participant.entity.ts`, `season.enums.ts`.

**Services** :
- `SeasonService` — `findAll(userId)`, `findOne(id, userId)`, `create(userId, dto)`,
  `transitionState(id, userId, newState)`, `findByInviteCode(code)`,
  `findPendingForUser(userId)`, `findOrganizedWithPendingRequests(userId)`.
- `SeasonParticipantService` — `requestJoin(seasonId, userId, teamId)`,
  `findParticipants(seasonId, userId)`, `validate(seasonId, pid, organizerUserId, accept)`,
  `promote(seasonId, pid, organizerUserId)`, `remove(seasonId, pid, organizerUserId)`.
- `GameService` — `findAllForSeason(seasonId, userId)`, `create(seasonId, userId, dto)`,
  `update(...)`, `remove(...)` — sélection des participants via une liste d'IDs
  `SeasonParticipant`, validés comme appartenant à la saison et `VALIDATED`.

Pattern commun (suit `team.service.ts`) : vérifications d'accès via
`NotFoundException` (jamais 403), pour ne pas révéler l'existence d'une ressource
non accessible. Un helper privé `assertOrganizer(seasonId, userId)` centralise la
vérification organisateur.

**Contrôleurs et routes** :

| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/seasons` | mes saisons (participant validé) |
| POST | `/api/seasons` | créer (`name` + `teamId` du créateur) |
| GET | `/api/seasons/pending` | mes demandes d'inscription en attente (candidat) |
| GET | `/api/seasons/organizing/pending-requests` | inscriptions en attente dans mes saisons (organisateur) |
| GET | `/api/seasons/:id` | détail (participant validé) |
| PUT | `/api/seasons/:id/state` | transition d'état (organisateur) |
| GET | `/api/seasons/by-code/:code` | infos minimales par code (utilisateur connecté) |
| GET | `/api/seasons/:id/participants` | liste des participants |
| POST | `/api/seasons/:id/participants` | demande d'inscription (`{ teamId }`) |
| PUT | `/api/seasons/:id/participants/:pid/validate` | valider/refuser (`{ accept }`, organisateur) |
| PUT | `/api/seasons/:id/participants/:pid/promote` | promouvoir co-organisateur (organisateur) |
| DELETE | `/api/seasons/:id/participants/:pid` | retirer (organisateur, `EN_CONSTRUCTION` uniquement) |
| GET/POST | `/api/seasons/:id/games` | lister / créer une partie (création : organisateur) |
| PUT/DELETE | `/api/seasons/:id/games/:gameId` | modifier / supprimer (organisateur) |

**DTOs** : `CreateSeasonDto` (`name`, `teamId`), `SeasonResponseDto` (Season +
`participantCount`, `myRole`), `JoinSeasonDto` (`teamId`), `ValidateParticipantDto`
(`accept`), `SeasonParticipantResponseDto` (participant + prénom/nom utilisateur +
nom équipe), `CreateGameDto` (`name`, `scheduledAt?`, `participantIds: number[]`),
`GameResponseDto`.

**`app.module.ts`** : ajouter les 4 nouvelles entités à la liste `entities` de TypeORM,
importer `SeasonModule`.

---

## 6. Permissions — récapitulatif

| Action | Détenteur du code (connecté) | Participant validé | Organisateur |
|---|---|---|---|
| Voir la saison via le code | oui (infos minimales) | — | — |
| Soumettre une demande d'inscription | oui (choix d'équipe) | n/a | n/a |
| Voir détail / participants / parties | non | oui | oui |
| Valider / refuser une inscription | non | non | oui |
| Promouvoir co-organisateur | non | non | oui |
| Retirer un participant (pré-`EN_COURS`) | non | non | oui |
| Transitions d'état | non | non | oui |
| Créer / modifier / supprimer une partie | non | non | oui |

---

## 7. Frontend — `apps/frontend/src/app/seasons/`

### Routes (`app.routes.ts`, toutes sous `authGuard`)

- `/seasons` — `Seasons` (smart) : liste unique de cartes (saisons organisées,
  participations, demandes en attente), badges de rôle/statut.
- `/seasons/join/:code` — `SeasonJoin` (smart) : affiche nom/organisateur/état de la
  saison, sélection d'une équipe, soumission de la demande.
- `/seasons/:id` — `SeasonDetail` (smart) : page unique à sections empilées
  (Participants, Parties, Paramètres).

### Écran `/seasons` — liste de cartes avec badges

Une grille de cartes type `/teams`, chaque carte affichant :
- nom de la saison, état (`EN_CONSTRUCTION` / `EN_COURS` / `TERMINEE`)
- badge de rôle : 🏆 Organisateur / 🏎️ Participant (+ nom de l'équipe engagée) / ⏳ En attente
- alerte ⚠️ "X à valider" sur les cartes où l'utilisateur est organisateur et a des
  demandes `PENDING`

Actions globales : **+ Créer une saison** (modale), **Rejoindre via code** (champ de
saisie → navigue vers `/seasons/join/:code`).

### Écran `/seasons/:id` — page à sections empilées

```
/seasons/12 - Coupe Verney --------------------------------
  🔔 EN_CONSTRUCTION   🔗 Code: ABCD-1234   [Passer en EN_COURS]

  —— Participants (3 validés, 2 en attente) ——
  ┌──────────────────────────────────────────────┐
  │ Alice · Furies        🏆 Organisateur          │
  │ Bob · Scrap Kings                              │
  │ Dan · Roadkill        [Valider] [Refuser]      │
  └──────────────────────────────────────────────┘

  —— Parties (4) ——                        [+ Ajouter]
  ┌──────────────────────────────────────────────┐
  │ Manche 1 · 12/06 · 3 équipes                    │
  │ Manche 2 · 19/06 · 4 équipes                    │
  └──────────────────────────────────────────────┘
```

- Le bandeau d'état + bouton de transition + code d'invitation ne sont visibles/actifs
  que pour les organisateurs.
- Section Participants : actions Valider/Refuser/Promouvoir/Retirer visibles
  uniquement aux organisateurs, sur les lignes concernées.
- Section Parties : bouton "+ Ajouter" (organisateur) ouvre `game-form` — sélection
  multiple des participants validés.

### Écran de création / rejoindre une saison

- **Créer** : modale simple (`name` + sélection d'une de ses équipes via un select),
  même esprit que `team-form`.
- **Rejoindre** : page dédiée `/seasons/join/:code` — affiche les infos de la saison
  (nom, organisateur, état) puis sélection d'équipe + bouton "Demander à rejoindre".

### Composants dumb

`season-card/`, `participant-list/`, `game-card/`, `game-form/`, `invite-link/`.

### Services et modèles

`seasons.service.ts`, `season-participants.service.ts`, `season-games.service.ts` +
`season.model.ts`, `season-participant.model.ts`, `game.model.ts` (mêmes conventions
que `team.model.ts`/`teams.service.ts`).

---

## 8. Hors scope / différé

- **Résultats de parties et leurs impacts** (gains de jerricans, dégâts/destruction
  de véhicules) — `Game`/`GameParticipant` ne sont que des structures d'accroche pour
  une itération future.
- **Application effective du verrouillage `isLocked`** sur les équipes en `EN_COURS`
  (le champ existe, aucune règle ne l'exploite encore).
- **Visibilité partielle de `/api/seasons/:id`** pour un utilisateur en attente de
  validation (`PENDING`) — non traité, accès restreint aux `VALIDATED` pour l'instant.
- **Quitter une saison volontairement** une fois `VALIDATED` et la saison `EN_COURS`
  — non traité.
- **Rotation/expiration du code d'invitation** — non prévue, token statique pour la
  durée de vie de la saison.
