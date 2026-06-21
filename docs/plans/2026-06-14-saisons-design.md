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

**Transitions de statut via `PUT .../participants/:pid/validate` (`{ accept: boolean }`)** :
ce même endpoint couvre désormais trois cas, distingués par le statut de départ du
participant ciblé :
- `PENDING → VALIDATED` (`accept: true`) ou `PENDING → REJECTED` (`accept: false`) —
  traitement initial d'une demande d'inscription.
- `VALIDATED → REJECTED` (`accept: false`, bouton "Refuser" sur "Les autres équipes") —
  réversible, contrairement à `DELETE .../participants/:pid` (retrait définitif).
  Requiert `season.state === EN_CONSTRUCTION` et, si le participant est organisateur,
  qu'il reste au moins un autre organisateur `VALIDATED` (même garde-fou que pour le
  retrait définitif).
- `REJECTED → VALIDATED` (`accept: true`, bouton "Valider" dans la section "Refusé") —
  revalidation, aucune contrainte d'état supplémentaire.

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
| DELETE | `/api/seasons/:id` | supprimer la saison — implémenté (organisateur, cascade sur les participants, équipes non affectées) |
| PUT | `/api/seasons/:id/state` | transition d'état (organisateur) |
| GET | `/api/seasons/by-code/:code` | infos minimales par code (utilisateur connecté) |
| GET | `/api/seasons/:id/participants` | liste des participants |
| POST | `/api/seasons/:id/participants` | demande d'inscription (`{ teamId }`) |
| PUT | `/api/seasons/:id/participants/me` | changer l'équipe engagée par l'utilisateur connecté (`{ teamId }`, `EN_CONSTRUCTION` uniquement) |
| PUT | `/api/seasons/:id/participants/:pid/validate` | valider/refuser — `PENDING→VALIDATED/REJECTED`, `VALIDATED→REJECTED`, `REJECTED→VALIDATED` (`{ accept }`, organisateur) |
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

## 7. Frontend — UX et règles de visibilité

> Composants implémentés (`Seasons`, `SeasonDetail`, `SeasonJoin`, `ParticipantList`…) : voir [@docs/COMPONENTS.md](../COMPONENTS.md).

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
  EN_CONSTRUCTION   🏆 Organisateur        [🗑 Supprimer la saison]

  —— Votre équipe ——
  [ select: Furies ▾ ]   (lecture seule si saison ≠ EN_CONSTRUCTION)

  —— Les autres équipes ——
  ┌──────────────────────────────────────────────┐
  │ Bob · Scrap Kings              [Refuser]       │
  │ Dan · Roadkill    🏆 Organisateur               │
  └──────────────────────────────────────────────┘

  —— En attente de validation (1) ——     (organisateur uniquement)
  ┌──────────────────────────────────────────────┐
  │ Alice · Buggy Crew   [Valider] [Refuser] [Retirer] │
  └──────────────────────────────────────────────┘

  —— Refusé (1) ——                        (organisateur uniquement)
  ┌──────────────────────────────────────────────┐
  │ Eve · Outlaws                    [Valider]     │
  └──────────────────────────────────────────────┘
```

- Le bouton "🗑 Supprimer la saison" et le badge "🏆 Organisateur" du bandeau ne sont
  visibles que pour les organisateurs.
- **"Votre équipe"** : tout participant `VALIDATED` peut changer l'équipe qu'il engage
  via `PUT .../participants/me` tant que la saison est `EN_CONSTRUCTION` (sélecteur
  parmi ses propres équipes, `TeamsService.getAll()`) — affichage en lecture seule sinon.
- **"Les autres équipes"** : participants `VALIDATED` autres que l'utilisateur courant.
  Le bouton "Refuser" (`VALIDATED → REJECTED`, cf. §4) n'est visible qu'aux
  organisateurs, masqué sur l'unique organisateur restant (garde-fou UI, doublé côté
  backend).
- **"En attente de validation"** et **"Refusé"** : entièrement absentes du DOM pour les
  non-organisateurs (`@if (isOrganizer())`), pas seulement masquées visuellement —
  un participant normal ne voit jamais ces statuts pour les autres. "Refuser" dans
  "En attente" reste le retrait de la demande initiale (`PENDING → REJECTED`) ; "Retirer"
  (`DELETE`) supprime définitivement la ligne tant que `EN_CONSTRUCTION`. "Valider" dans
  "Refusé" revalide (`REJECTED → VALIDATED`).
- Section Parties : non implémentée dans cette itération (cf. §8).

### Écran de création / rejoindre une saison

- **Créer** : modale simple (`name` + sélection d'une de ses équipes via un select),
  même esprit que `team-form`.
- **Rejoindre** : page dédiée `/seasons/join/:code` — affiche les infos de la saison
  (nom, organisateur, état) puis sélection d'équipe + bouton "Demander à rejoindre".

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
