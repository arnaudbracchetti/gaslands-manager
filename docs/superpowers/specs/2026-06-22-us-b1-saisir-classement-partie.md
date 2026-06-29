# US-B1 — Saisir le classement d'une partie

**Date :** 2026-06-22  
**Branche :** `mode-campagne`  
**Story :** En tant qu'organisateur, je veux saisir le rang final de chaque équipe ayant joué une partie, afin que l'appli calcule les Points de Championnat de classement.

---

## Contexte

Le Programme Télé (US-A1) permet de planifier des parties (`Game`) avec un statut `PLANIFIE`. US-B1 introduit la **première étape du workflow de saisie de résultat** : l'enregistrement du classement final des équipes. C'est l'étape 1 du workflow en 4 étapes décrit dans le design doc §6. La partie passe à `JOUE` dès cette étape, les étapes suivantes (exploits, épaves, résistance) étant couvertes par des stories ultérieures.

Les Points de Championnat (PC) de classement sont **dénormalisés** dans `GameResult.championshipPoints` — snapshot immuable au moment de la validation, indépendant de toute évolution future des règles.

---

## Modèle de données

### Nouvelle entité `GameResult`

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `gameId` | number | FK → Game (`CASCADE` on delete) |
| `participantId` | number | FK → SeasonParticipant (`CASCADE` on delete) |
| `rank` | number | Rang de l'équipe dans la partie (1 = premier) |
| `championshipPoints` | number | PC snapshot (0 pour ESCARMOUCHE ou non-classé) |
| `createdAt` | Date | auto |

**Contraintes uniques :**
- `(gameId, participantId)` — une ligne par équipe par partie
- `(gameId, rank)` — rangs uniques dans une partie

### Règle de calcul des PC (appliquée au moment de la validation, jamais recalculée)

```
POINTS_TABLE = [10, 5, 2, 1]
classés = ⌈participantsPresents / 2⌉   // moitié arrondie au supérieur

championshipPoints =
  si EVENEMENT_TELE && rank <= classés  →  POINTS_TABLE[rank - 1]
  sinon                                 →  0
```

Exemples :
- 4 participants présents → 2 classés → rang 1 = 10 PC, rang 2 = 5 PC, rangs 3-4 = 0 PC
- 5 participants présents → 3 classés → rang 1 = 10 PC, rang 2 = 5 PC, rang 3 = 2 PC, rangs 4-5 = 0 PC
- ESCARMOUCHE → tous à 0 PC

### Impact sur `Game`

Après validation : `status = 'JOUE'`, `playedAt = NOW()`.  
Une partie `JOUE` est **figée** (edit/delete déjà refusés par le service existant).

---

## API Backend

### Nouvel endpoint — Enregistrer un résultat

```
POST /api/seasons/:id/games/:gameId/results
Auth  : JWT, organisateur uniquement
Body  : { results: [{ participantId: number, rank: number }] }
```

Seules les équipes **présentes** sont dans le tableau. Les absents ne reçoivent pas de `GameResult`.

**Validations (dans l'ordre) :**
1. `assertOrganizer(seasonId, userId)` → 404 si non-organisateur ou saison inconnue
2. Game trouvé et appartient à la saison → 404 sinon
3. `game.status === 'PLANIFIE'` → 400 si déjà `JOUE`
4. `results` non vide → 400 sinon
5. Tous les `participantId` sont des participants `VALIDATED` de la saison → 400 sinon
6. Rangs consécutifs à partir de 1, sans doublons → 400 sinon

**Exécution atomique (transaction TypeORM) :**
1. Calcul `championshipPoints` pour chaque ligne
2. `INSERT` de tous les `GameResult`
3. `UPDATE Game SET status = 'JOUE', playedAt = NOW()`

**Réponse :** `200 OK` — `GameResponseDto` (même shape qu'existant, avec `status: 'JOUE'`)

### Nouvel endpoint — Lire les résultats d'une partie

```
GET /api/seasons/:id/games/:gameId/results
Auth     : JWT, participant VALIDATED
Réponse  : GameResultDto[]
```

`GameResultDto` : `{ id, gameId, participantId, rank, championshipPoints, createdAt }`

---

## Nouveaux fichiers backend

```
apps/backend/src/app/game/
├── game-result.entity.ts          // entité GameResult
├── dto/
│   ├── record-result.dto.ts       // { results: RecordResultItemDto[] }
│   └── game-result-response.dto.ts
└── game-result.service.ts         // logique métier (calcul PC, transaction)
```

`GameResultService` est injecté dans `GameModule`. `GameController` reçoit les deux nouvelles routes. `GameResult` est ajouté à la liste `entities` dans `app.module.ts`.

---

## UI Frontend

### Nouveau composant `GameResultForm` (dumb)

**Localisation :** `apps/frontend/src/app/seasons/game-result-form/`

**Inputs :**
| Nom | Type | Description |
|-----|------|-------------|
| `participants` | `SeasonParticipant[]` | Tous les VALIDATED de la saison |
| `saving` | `boolean` | Désactive les boutons |

**Outputs :**
| Nom | Type | Description |
|-----|------|-------------|
| `saved` | `{ results: { participantId: number, rank: number }[] }` | Rangs validés |
| `formCancel` | `void` | Annulation |

**UX (drag-and-drop via Angular CDK `DragDropModule`) :**
1. Liste initiale : toutes les équipes avec checkbox "a participé" décochée
2. L'organisateur coche les équipes présentes → elles rejoignent la zone de classement ordonnée
3. Réordonnancement par glisser-déposer (position dans la liste = rang)
4. Badge "classé" / "non classé" calculé en temps réel (⌈N/2⌉, coloré distinctement)
5. Bouton "Valider" actif seulement si au moins 1 participant coché
6. Bouton "Annuler" → émet `formCancel`

### Modifications `GameList`

- Bouton "🎯 Saisir les rangs" sur les parties `PLANIFIE` (visible uniquement si `canManage`)
- Les parties `JOUE` affichent les PC de chaque équipe (via `GET .../results`, chargé par `SeasonProgram`)

### Modifications `SeasonProgram`

- Nouveau signal `recordingGame: WritableSignal<Game | null>`
- Charge les participants via `SeasonsService.getParticipants(seasonId)` (endpoint existant : `GET /api/seasons/:id/participants`)
- Nouveau signal `participants: WritableSignal<SeasonParticipant[]>`
- Appelle `SeasonsService.recordResult(seasonId, gameId, dto)` → recharge les parties après succès
- `@if (recordingGame())` affiche `GameResultForm` à la place de `GameList`

### Ajout dans `SeasonsService`

```typescript
recordResult(seasonId: number, gameId: number, dto: RecordResultDto): Observable<Game>
getGameResults(seasonId: number, gameId: number): Observable<GameResultDto[]>
```

### Modèles frontend à ajouter dans `game.model.ts`

```typescript
interface GameResult {
  id: number;
  gameId: number;
  participantId: number;
  rank: number;
  championshipPoints: number;
  createdAt: string;
}

interface RecordResultDto {
  results: { participantId: number; rank: number }[];
}
```

---

## Tests

### Backend (Vitest)

**`game-result.service.spec.ts` :**
- Cas nominal EVENEMENT_TELE : PC calculés correctement (table 10/5/2/1, règle ⌈N/2⌉)
- Cas ESCARMOUCHE : tous les PC à 0
- Transaction atomique : si une insertion échoue, aucun `GameResult` créé et la partie reste `PLANIFIE`
- Validation : partie déjà `JOUE` → 400
- Validation : `participantId` inconnu → 400
- Validation : rangs non consécutifs ou en doublon → 400
- Validation : non-organisateur → 404
- Divers cas de ⌈N/2⌉ : 1 participant → 1 classé, 2 → 1, 3 → 2, 4 → 2, 5 → 3, 6 → 3

**`game.controller.spec.ts` :** câblage des deux nouvelles routes.

### Frontend (Vitest + Angular Testing Library)

**`game-result-form.spec.ts` :**
- Affiche tous les participants avec checkbox décochée
- Cocher une équipe l'ajoute à la zone de classement
- Décocher retire de la zone
- Badge "classé"/"non classé" correct selon ⌈N/2⌉
- Bouton "Valider" désactivé si aucune équipe cochée
- `saved` émet les bons rangs après soumission

**`season-program.spec.ts` :** ajout du cas "clic Saisir les rangs → GameResultForm visible".

---

## Vérification end-to-end

1. Démarrer l'environnement : `./dev.sh`
2. Créer une saison avec 3 participants VALIDATED
3. Ajouter une partie EVENEMENT_TELE
4. En tant qu'organisateur : cliquer "🎯 Saisir les rangs"
5. Cocher 2 équipes sur 3, les ordonner par drag-and-drop
6. Valider → vérifier que la partie passe à `JOUE` dans la liste
7. Vérifier les PC affichés : 2 présents → ⌈2/2⌉ = 1 classé → rang 1 = 10 PC, rang 2 = 0 PC
8. Répéter avec une partie ESCARMOUCHE → vérifier 0 PC pour tous
9. Tenter la même action avec un non-organisateur → vérifier refus
10. `npx nx test backend` et `npx nx test frontend` doivent passer
