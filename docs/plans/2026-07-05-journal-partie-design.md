# Journal d'une partie (mode campagne) — Design

> Document de conception. Implémentation à suivre dans un plan dédié.
> Sous-document lié : [`docs/spec/CAMPAIGN.md`](../spec/CAMPAIGN.md) (à mettre à jour après implémentation).

---

## Contexte

Une partie (`Game`) traverse `PLANIFIE → ATELIER → JOUE`, et journalise tous ses
événements (classement, exploits, table des épaves, achats/reventes d'atelier,
séquelles, contact Résistance) dans `game_events` — mais rien n'expose
aujourd'hui ce journal de façon lisible à un joueur. Seul `GET .../results`
dérive une vue partielle (classement uniquement) du journal.

Objectif : un bouton accessible à **tout participant `VALIDATED`** de la
campagne (pas seulement l'organisateur), sur chaque partie en statut
`ATELIER` ou `JOUE`, ouvrant une modale qui liste **tous** les événements de
la partie de façon compréhensible — y compris l'événement Contact Résistance
(la mécanique elle-même n'est pas secrète, seul le total cumulé de PR d'un
joueur doit rester caché ; le voir apparaître ponctuellement dans un journal
est accepté).

---

## Organisation retenue : groupé par participant

Une section par participant ayant au moins un événement sur cette partie,
dans l'ordre d'apparition de son premier événement chronologique. À
l'intérieur d'une section, les événements du participant restent dans l'ordre
chronologique du journal (`eventOrder`).

```
▸ Alice (Sponsor Rutherford)
  Classé 1 (+10 PC)
  Véhicule ennemi détruit (Moyen, +2 PC)
  Achat : Blindage (4 jerricans)

▸ Bob (Sponsor Idris)
  Classé 2 (+5 PC)
  2 portes franchies (+2 PC)
  Table des Épaves : Arrachée (D6=4+0 chocs, +1 choc)
```

Alternatives écartées : liste chronologique pure (moins lisible "qu'est-ce
qui est arrivé à mon équipe") et groupement par phase (ambigu pour
`WalletMovementEvent`, qui peut être une récompense manuelle comme un
mouvement d'atelier).

---

## Backend

### Agrégat `Campaign` (domain/campaign.ts) — nouvelle méthode

```typescript
gameJournal(gameId: number): GameJournalEntry[] {
  const game = this.findGame(gameId);
  return game.events.map(e => ({
    eventId: e.id,
    participantId: e.participantId,
    description: e.describe(),
  }));
}
```

`GameJournalEntry` est un type de données domaine (pas une entité). C'est
l'agrégat, et lui seul, qui sait transformer son journal d'événements internes
en descriptions — cohérent avec la règle du projet (logique métier →
agrégat, cf. ARCHITECTURE.md §3.4). `game.events` est déjà trié par
`eventOrder` (`game.ts:34`), donc la liste retournée est déjà chronologique.
Aucun filtre d'exclusion sur les types d'événements.

### `CampaignQueryService.getGameJournal(campaignId, gameId, userId)`

1. `campaignReplayService.loadAndReplay(campaignId)` — même point d'entrée
   que les autres lectures/écritures.
2. `assertVisibleParticipant(campaign, userId)` — 404 si non-participant
   validé, cohérent avec le reste du module.
3. `campaign.gameJournal(gameId)` → `{ eventId, participantId, description }[]`.
4. Enrichissement **hors domaine**, propre à la couche lecture :
   - `userName` / `teamName` par `participantId`, via le même helper que
     `toParticipantDto` (jointure user/team déjà en place).
   - `createdAt` par `eventId` : requête complémentaire sur `GameEventOrm`
     (`SELECT id, createdAt WHERE gameId = X`) — l'horodatage n'existe pas
     sur le domaine `GameEvent` (choix existant, non nécessaire aux règles
     métier), donc rejoint ici depuis la persistance uniquement pour
     l'affichage.
5. Retourne `GameJournalEntryDto[] = { participantId, userName, teamName,
   description, createdAt }`, **non groupé** — le regroupement par
   participant est une préoccupation de présentation, faite côté frontend.

### Route

`GET /api/campaigns/:id/games/:gameId/journal` — JWT, tout participant
`VALIDATED`. Ajoutée dans `campaign.controller.ts`, délègue à
`CampaignQueryService.getGameJournal`.

---

## Frontend

### `CampaignsService`

Nouvelle méthode `getGameJournal(campaignId: number, gameId: number):
Observable<GameJournalEntryDto[]>` — `http.get` simple, même pattern que
`getResults`/`resolveWreck`.

### `GameList` (`campaigns/game-list/`)

- Nouvel `output()` `openJournal: Game`.
- Nouveau bouton "📜 Journal" affiché quand `game.status === 'ATELIER' ||
  game.status === 'JOUE'` — visible pour **tous**, indépendant de
  `canManage`/`canRecord`. Aujourd'hui ces statuts n'affichent aucune action :
  ce sera la seule sur ces lignes-là.

### `CampaignProgram` (smart, orchestrateur)

- Reçoit `openJournal`, appelle `campaignsService.getGameJournal(...)`.
- Signals : `journalGame: Game | null` (contrôle l'ouverture), `journalEntries:
  GameJournalEntryDto[]`, `loadingJournal: boolean`.
- Passe ces signaux en `input()` à `GameJournalModal` ; `closed` réinitialise
  les trois.

### `GameJournalModal` (nouveau, `campaigns/game-journal-modal/`, dumb)

- `input()` : `game: Game`, `entries: GameJournalEntryDto[]`, `loading:
  boolean`.
- `output()` : `closed: void`.
- `computed()` `groupedEntries` : regroupe `entries` par `participantId` en
  préservant l'ordre d'apparition (Map, premier événement chronologique
  détermine la position du groupe) ; chaque groupe garde ses entrées dans
  l'ordre reçu (déjà chronologique).
- En-tête de groupe : `userName (teamName)`. Chaque ligne : `description`,
  heure (`createdAt`) en texte secondaire optionnel.
- État vide : "Aucun événement enregistré".

Découpage cohérent avec le pattern Smart/Dumb déjà en place (`CampaignProgram`
porte l'appel HTTP ; la modale reste pure présentation) — même schéma que
`WreckResolutionStep`/`participantVehicles`.

---

## Tests

**Backend**
- `campaign.spec.ts` : `gameJournal(gameId)` — ordre chronologique, tous
  types d'événements représentés (y compris `ResistanceContactedEvent`),
  `gameId` inexistant lève.
- `campaign-query.service.spec.ts` : enrichissement `userName`/`teamName`/
  `createdAt`, `assertVisibleParticipant` (404), partie sans événement
  (tableau vide).
- `campaign.controller.spec.ts` : route 200, délégation au query service.

**Frontend**
- `game-journal-modal.spec.ts` : regroupement par participant, préservation
  de l'ordre, état vide, état chargement.
- `game-list.spec.ts` : bouton "Journal" visible en `ATELIER`/`JOUE`, absent
  en `PLANIFIE`.
- Pas de nouveau spec e2e Playwright obligatoire (lecture pure) ; extension
  possible du spec Campagnes existant si couverture bout-en-bout souhaitée.

**Cas limites**
- Partie `ATELIER` en cours : lecture toujours à jour, pas de cache.
- Participant retiré avant `EN_COURS` : pas de trou de données possible pour
  une partie déjà jouée (aucun retrait possible après `EN_COURS`).
- Ordre des groupes : détermined par le premier événement chronologique de
  chaque participant, pas par ordre alphabétique.

---

## Documentation à mettre à jour après implémentation

- `docs/spec/CAMPAIGN.md` : nouvelle section "Journal d'une partie" +
  nouvelle ligne dans la table des endpoints.
- `docs/COMPONENTS.md` : nouveau composant `GameJournalModal`, mise à jour de
  `GameList` (nouvel output) et `CampaignProgram` (nouveaux signals), ajout
  au diagramme Mermaid de dépendances.
- `docs/DOMAIN_MODEL.md` : ajout de `gameJournal(gameId)` à la fiche
  `Campaign` (§4).
