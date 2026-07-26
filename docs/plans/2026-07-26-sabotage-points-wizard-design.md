# Déclaration des points de sabotage dépensés en fin de partie

## Contexte

Les **Points de sabotage** (`CampaignParticipant.sabotagePoints`, cf.
[docs/spec/CAMPAIGN.md — Points de sabotage](../spec/CAMPAIGN.md#points-de-sabotage))
sont aujourd'hui un compteur **dérivé et purement en lecture** :
`Math.floor(resistancePoints / 3)`, affiché uniquement au propriétaire dans son
Atelier. Aucune mécanique de dépense n'existe — l'usage réel des Jetons de
Sabotage pendant une partie physique est documenté comme une "règle de table"
volontairement hors périmètre (décision D2,
[`docs/plans/2026-06-21-mode-campagne-design.md`](2026-06-21-mode-campagne-design.md)).

L'utilisateur souhaite désormais pouvoir **enregistrer, après coup, quelle
équipe a dépensé combien de points de sabotage pendant la partie qui vient de
se jouer** — dans la séquence du wizard de fin de partie, sans l'alourdir. Il
ne s'agit pas de suivi en direct (l'app reste un "journal de bord
post-partie", cohérent avec l'esprit de D2) mais d'une déclaration
rétroactive, comme le sont déjà les portes franchies ou les jerricans gagnés.

Décisions validées avec l'utilisateur au cours du brainstorming :

1. **La dépense débite réellement les Points de Résistance** (pas un simple
   journal sans effet) — le solde de sabotage doit rester juste dans la durée.
2. **L'organisateur saisit la donnée pour tout le monde**, comme les écrans
   Portes/Jerricans existants — déclaration orale à table, aucune valeur
   affichée à l'écran (le solde reste invisible, y compris à l'organisateur).
3. **Nouvel écran dédié**, toujours affiché (pas de gate scénario, contrairement
   à Portes/Jerricans), placé juste après Présence — gabarit identique à
   `GatesStep`/`JerricansStep` (0 par défaut, "Suivant" ne coûte qu'un clic si
   rien ne s'est passé).
4. **Pas de rejet serveur en cas de sur-dépense** — le serveur **clampe
   silencieusement** la valeur déclarée au solde réellement disponible, ce qui
   garantit mathématiquement que `resistancePoints` ne descend jamais sous 0
   (`3 × sabotagePoints ≤ resistancePoints` par construction du `floor`).

**Effet de bord accepté** : le journal de partie affichera le montant
**réellement appliqué** (clampé), pas la valeur brute tapée par l'organisateur
— si une équipe n'avait que 3 points et que l'organisateur en déclare 10, le
journal affichera "3 dépensés". C'est une fuite d'information mineure et
volontaire (tout participant lisant le journal peut déduire un plafond), du
même ordre que ce que `ResistanceContactedEvent` révèle déjà (un delta, jamais
le total cumulé).

---

## Backend — event-sourcing

### Nouvel événement `SabotagePointsSpentEvent`

Ajouté dans `apps/backend/src/app/campaign/domain/events/sabotage-points-spent.event.ts`
(même dossier que les 13 événements existants, notamment `ResistanceContactedEvent` — le
précédent le plus proche : action ponctuelle par participant, sans montant variable
côté existant, mais ici avec un montant).

**Découverte en cours d'implémentation, qui a changé le design initial** : le clamp
(`min(déclaré, solde disponible)`) ne peut PAS être recalculé dans `execute()`/`describe()`
à partir de l'état courant du participant. Deux raisons :

1. **`undo()` casserait la propriété `execute()` puis `undo()` → état identique** — après
   `execute()`, le solde du participant a déjà baissé ; relire `participant.sabotagePoints`
   dans `undo()` donnerait une valeur plus petite que celle réellement appliquée par
   `execute()`, donc un remboursement partiel.
2. **`describe()` (lecture du journal) tourne sur une campagne chargée SANS replay** —
   `CampaignQueryService.getJournal`/`getParticipantJournal` appellent
   `CampaignReplayService.load()` (pas `loadAndReplay()`), qui NE rejoue AUCUN événement.
   `CampaignParticipant.sabotagePoints` y vaudrait donc systématiquement 0 (jamais
   d'`attachTeam()`/replay), et `describe()` afficherait toujours "0 dépensé(s)".

**Solution retenue** : le clamp est calculé UNE SEULE FOIS, dans `Game.recordSabotageSpent`,
AVANT de construire l'événement — jamais recalculé ensuite. `SabotagePointsSpentEvent`
reste un event Command minimal (constructeur + `execute`/`undo`/`describe`, aucune
factory) : `pointsSpent` est toujours la valeur déjà résolue, comme pour tous les autres
événements du module (ex. `GatesCrossedEvent.championshipPoints`, déjà calculé par
`Game.recordResult` avant construction). Une factory statique de type `declare()`
avait été envisagée un temps pour porter ce clamp sur la classe événement elle-même,
mais écartée : un constructeur ne peut pas exprimer "rien à construire" (retourner
`null`), et l'événement est aussi reconstruit tel quel depuis une ligne déjà persistée
par `CampaignMapper.toEvent` (replay) — deux raisons de garder le clamp hors de la
classe événement, dans l'orchestration qui décide de construire ou non.

```ts
class SabotagePointsSpentEvent extends GameEvent {
  readonly eventType = GameEventType.SABOTAGE_POINTS_SPENT;

  constructor(id, gameId, participantId, eventOrder, readonly pointsSpent: number) { … }

  execute(participants) { this.findParticipant(participants).addResistance(-this.pointsSpent * 3); }
  undo(participants) { this.findParticipant(participants).addResistance(this.pointsSpent * 3); }
  describe() { return `Sabotage : ${this.pointsSpent} point(s) de sabotage dépensé(s)`; }
}
```

1 point de sabotage = 3 Points de Résistance bruts débités — inverse exact de la
dérivation `floor(resistancePoints / 3)` (`campaign-participant.ts`, `sabotagePoints`
getter). Le reliquat (reste de la division) n'est jamais perdu.

**`CampaignParticipant`** n'a besoin d'aucune nouvelle méthode : `addResistance(n)`
(déjà utilisée avec un signe positif par `ResistanceContactedEvent`) accepte déjà un
entier signé — l'appeler avec un `n` négatif suffit.

### `Game.recordSabotageSpent(entries, participants)`

Méthode sur `apps/backend/src/app/campaign/domain/games/game.ts` (à côté de
`recordJerricanGains`, dont elle reprend la forme `{ participantId, amount }[]` → ici
`{ participantId, pointsSpent }[]`) :

```
pour chaque entrée :
  participant = participants.find(p => p.id === entry.participantId)
  si participant introuvable : lever DomainException (ne devrait jamais arriver — le
    wizard ne propose que des participants réels de la campagne, contrairement au solde
    insuffisant ci-dessous qui est un cas normal)
  actualSpent = Math.min(entry.pointsSpent, participant.sabotagePoints)
  si actualSpent > 0 :
    créer SabotagePointsSpentEvent(..., pointsSpent: actualSpent)
    this.addEvent(event)  // valide via canAccept()
retourner les événements créés
```

Aucune `DomainException` levée pour un sur-dépensement (clamp silencieux, pas
un rejet) — comportement délibérément différent des autres gardes de
l'agrégat (ex. budget véhicule), documenté comme tel dans le commentaire de
la méthode pour éviter qu'un futur lecteur "corrige" ce qui ressemble à une
garde manquante. Le cas participant introuvable, lui, EST une garde classique
(`DomainException`) : contrairement au solde insuffisant, il ne devrait jamais se
produire en usage normal.

**Applicable aux deux types de partie**, contrairement à `recordResult`/
`recordJerricanGains` qui sont respectivement ET/Escarmouche-only : méthode
partagée sur la classe `Game` de base (pas de surcharge par sous-type), et
`SabotagePointsSpentEvent` a été ajouté à la liste des événements acceptés
en `PLANIFIE` dans les deux `canAccept()` (`EvenementTeleGame` et
`EscarmoucheGame`).

### DTO et use case

- `RecordResultDto` (DTO consommé par `POST .../games/:gameId/results`, déjà
  optionnel sur `results`/`jerricanGains`/`destroyedVehicles` selon le type de
  partie, cf. [docs/spec/CAMPAIGN.md](../spec/CAMPAIGN.md) — tableau "Gestion
  du Programme") : ajouter un champ optionnel
  `sabotageSpent?: { participantId: number; pointsSpent: number }[]`.
- `RecordResultUseCase` : appeler
  `game.recordSabotageSpent(dto.sabotageSpent, campaign.participants)` si le
  champ est présent, inconditionnellement du type de partie (contrairement au
  branchement ET/Escarmouche existant pour `results` vs `jerricanGains`).

### Persistance

`GameEventOrm` (entité TypeORM plate mappant `GAME_EVENT`, cf.
[DOMAIN_MODEL.md §3](../DOMAIN_MODEL.md)) : ajouter une colonne nullable
`sabotagePointsSpent: number` — même pattern que `gatesCrossed`. Mettre à jour
le mapping ORM ↔ événement dans `infrastructure/` pour ce nouveau `eventType`.

---

## Frontend — wizard de fin de partie

### `SabotageStep` (nouveau composant)

`apps/frontend/src/app/campaigns/game-result-wizard/sabotage-step/` — calqué
sur `GatesStep`/`JerricansStep` (mêmes fichiers de référence : structure
`.ts`/`.html`/`.scss`, `Map<participantId, number>` interne, un `<li>` par
participant avec `type="number" min="0"`, valeur par défaut 0).

- **Inputs** : `participants: CampaignParticipant[]` (présents, transmis par
  `PresenceStep`), `saving: boolean`.
- **Outputs** : `next: SabotageSpentEntry[]` (`{ participantId, pointsSpent }[]`,
  uniquement les entrées `pointsSpent > 0` — même convention que
  `GatesEntry`/`JerricanGainDto`), `back: void`, `formCancel: void`.
- **Aucun solde affiché** — rien à valider côté client, le clamp est
  entièrement côté serveur et silencieux.

### `GameResultWizard` (`apps/frontend/src/app/campaigns/game-result-wizard/game-result-wizard.ts`)

- `activeSteps` (computed, lignes 136-144) : insérer `sabotage`
  **inconditionnellement**, juste après `presence` et avant `ranking`/
  `designation` — nouvel ordre : Présence → **Sabotage** → (Classement → Portes,
  ET uniquement) → (Jerricans, si `gainJerricans`) → Désignation → Résolution.
- `buildRecordResultDto()` : ajouter le champ `sabotageSpent` accumulé,
  envoyé dans le même lot différé à la transition Désignation → Résolution
  (aucun nouvel appel réseau, aucun nouveau "tirage" à l'écran Résolution —
  pas d'aléatoire serveur impliqué ici, contrairement aux revenus/épaves).
- Template : ajouter `<app-sabotage-step>` au même niveau que les autres
  étapes, gated par `currentStepId() === 'sabotage'`.

### Documentation à mettre à jour après implémentation

Conformément à CLAUDE.md (mettre à jour la doc après tout changement de
comportement) :
- [docs/spec/CAMPAIGN.md](../spec/CAMPAIGN.md) — tableau "Wizard de fin de
  partie" (nouvel écran #2, renumérotation des suivants) + nouvelle
  sous-section décrivant la règle de clamp silencieux et son effet de bord
  sur le journal.
- [docs/spec/CAMPAIGN.md](../spec/CAMPAIGN.md) — section "Points de sabotage" :
  lever la mention "purement un compteur de lecture — aucune mécanique de
  dépense n'est implémentée".
- [docs/DOMAIN_MODEL.md](../DOMAIN_MODEL.md) — tableau `GameEvent` (Command) :
  nouvelle ligne `SabotagePointsSpentEvent` ; ERD `GAME_EVENT` : nouvelle
  colonne `sabotagePointsSpent`.
- [docs/COMPONENTS.md](../COMPONENTS.md) — nouvelle entrée `SabotageStep`,
  mise à jour de `GameResultWizard` (liste des étapes composées).
- `content/docs/campagnes.md` ou `atelier.md` (doc utilisateur) si ce
  changement de comportement est visible joueur — à vérifier lequel des deux
  chapitres couvre le wizard de fin de partie.

---

## Vérification

- **Backend** : tests unitaires sur `Game.recordSabotageSpent` — cas nominal
  (dépense ≤ solde), cas de clamp (dépense > solde → événement créé avec la
  valeur clampée, pas de `DomainException`), cas `pointsSpent: 0` ou solde nul
  (aucun événement créé), cas `participantId` inconnu (`DomainException`, cf.
  ci-dessus), et un test de replay vérifiant que `resistancePoints` ne descend
  jamais sous 0 après plusieurs dépenses successives. Suivre les patterns déjà
  en place pour `recordJerricanGains`/`contactResistance` (mêmes fichiers de
  test que `game.ts`).
- **Frontend** : test unitaire `SabotageStep` (rendu, valeurs par défaut à 0,
  émission `next` avec uniquement les entrées non-nulles) sur le modèle de
  `gates-step.spec.ts`/`jerricans-step.spec.ts`. Test de `GameResultWizard`
  vérifiant l'ordre des étapes (`activeSteps`) et l'inclusion de
  `sabotageSpent` dans `buildRecordResultDto()`.
- **Bout en bout** : lancer `./dev.sh`, dérouler le wizard de fin de partie sur
  une campagne de test où un participant a déjà des Points de Résistance
  accumulés (nécessite plusieurs parties jouées au préalable pour créditer des
  PR, cf. crédit automatique en cas de non-classement), déclarer une dépense
  de sabotage, vérifier au tour suivant que le compteur `sabotagePoints`
  affiché en Atelier a bien diminué, et que le journal de partie affiche la
  ligne "Sabotage : N point(s) dépensé(s)" avec le bon montant (clampé le cas
  échéant).
