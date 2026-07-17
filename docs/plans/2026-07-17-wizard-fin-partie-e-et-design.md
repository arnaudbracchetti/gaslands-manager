# Wizard de fin de partie — support Escarmouche + étapes pilotées par le scénario

## Contexte

Le wizard de fin de partie actuel (`GameResultWizard`, 3 écrans : classement → désignation des
épaves → Table des Épaves) n'a été conçu **que pour les Événements Télévisés**. Une Escarmouche
n'a aujourd'hui aucune séquence propre — c'est une limitation explicitement documentée dans
[docs/spec/CAMPAIGN.md](../spec/CAMPAIGN.md). De plus, les portes franchies sont proposées
**quel que soit le scénario**, alors que tous les scénarios n'en comportent pas (ex. « L'Arène »),
et il n'existe **aucune saisie de gains de jerricans** (mécanique des scénarios de pillage).

Objectif : un wizard **à étapes variables**, piloté par le type de partie (E / ET) et par des
métadonnées de scénario, **pensé pour le téléphone** (usage fréquent sur table de jeu sans
ordinateur), avec **retour arrière et annulation possibles tant que la séquence complète n'est
pas validée**.

### Décisions actées avec l'utilisateur

1. **Métadonnées scénario** : deux flags booléens par scénario (`franchissement_portes`,
   `gain_jerricans`), indépendants du type.
2. **Persistance différée** : les étapes pré-épaves sont de l'état **client uniquement** (rien
   en base, retour/annulation libres). La persistance du lot n'a lieu qu'à l'entrée de l'étape
   de résolution des épaves ; « Annuler » avant « Terminer » supprime tous les événements de la
   partie.
3. **Escarmouche = participation seule** : pas de classement, pas de Points de Championnat, pas
   de Points de Résistance (mécaniques réservées à l'Événement Télévisé).
4. **Présence et classement toujours séparés** en deux écrans.
5. **Revenu de base Escarmouche** : chaque Escarmouche crédite à chaque participant présent un
   gain de jerricans = **1 D6 serveur**, **différé en fin de wizard** (résolu à la phase de
   résolution, en même temps que la Table des Épaves — même aléa serveur autoritaire). Il n'y a
   donc **pas d'écran interactif à l'étape 2 pour l'Escarmouche**. Le butin manuel de scénario
   (`gain_jerricans`, étape 4) reste **en plus**, cumulable avec ce revenu de base.

### Règles de visibilité des étapes (dérivées des décisions)

| # | Étape | Composant | Visible si |
|---|-------|-----------|-----------|
| 1 | Présence (cases à cocher) | `PresenceStep` (nouveau) | toujours |
| 2 | Classement (ordre glisser-déposer) | `RankingStep` (réduit à l'ordre) | `type === EVENEMENT_TELE` |
| 3 | Portes franchies | `GatesStep` (nouveau) | `type === ET && scénario.franchissement_portes` |
| 4 | Jerricans gagnés (butin scénario) | `JerricansStep` (nouveau) | `scénario.gain_jerricans` |
| 5 | Désignation des épaves | `WreckDesignationStep` (existant, léger ajustement) | toujours |
| 6 | Résolution (revenu + épaves) | `WreckResolutionStep` (étendu) | toujours |

À l'étape 6, pour une **Escarmouche**, la phase de résolution déclenche d'abord automatiquement
**un tirage de revenu D6 serveur par participant présent** (crédit jerricans), puis les tirages
d'épaves ; pour un **Événement Télévisé**, uniquement les tirages d'épaves. Aucun revenu D6 en ET
(économie en Points de Championnat).

Décisions par défaut (à valider) : la **Faveur du Public** (+5 PC) reste **ET uniquement** (aucun
PC en Escarmouche). Le **picker destructeur** est saisi pour les **deux types** ; en Escarmouche
il crée un `VehicleDestroyedEvent` **à 0 PC** — sans effet sur le classement, mais **présent dans
le journal** de la partie pour tracer la destruction (« X a détruit [véhicule] »). « Portes »
reste conditionné à l'ET (les portes s'accrochent aux entrées de classement).

## Backend — changements

Volontairement **léger** : aucun nouveau type d'événement, aucune nouvelle règle d'agrégat
profonde. On réutilise `WalletMovementEvent` (jerricans) et `deleteEvents` (annulation).

1. **Flags de scénario**
   - [database_init/data/scenarios.yml](../../database_init/data/scenarios.yml) : ajouter
     `franchissement_portes: bool` et `gain_jerricans: bool` à chacun des 10 scénarios (valeurs
     par défaut sensées : portes → `course_de_la_mort` seulement ; jerricans → `pillage_de_convoi`
     — les autres à confirmer selon le livre p.162-170).
   - [scenario.interfaces.ts](../../apps/backend/src/app/campaign/scenario.interfaces.ts) : ajouter
     les deux champs. `ScenarioCatalogService` les charge automatiquement (map d'objets complets,
     cf. [scenario-catalog.service.ts:38](../../apps/backend/src/app/campaign/scenario-catalog.service.ts#L38)).
   - **Game DTO** : enrichir la réponse `Game` avec `franchissementPortes`/`gainJerricans`,
     résolus depuis `ScenarioCatalogService` **exactement comme `scenarioName`** déjà l'est (même
     mapper de réponse). Le wizard lit ces flags sans requête catalogue supplémentaire.

2. **Batch pré-épaves — endpoint `POST .../results` étendu, branché par type**
   - [record-result.dto.ts](../../apps/backend/src/app/campaign/dto/record-result.dto.ts) : ajouter
     `jerricanGains?: { participantId, amount }[]` **et** `destroyedVehicles?: { destroyerId, vehicleId }[]`
     (forme à plat, pour l'Escarmouche). `results` (classement + portes + destroyed nichés) devient
     optionnel.
   - [record-result.usecase.ts](../../apps/backend/src/app/campaign/application/record-result.usecase.ts) :
     - si `results` présent → `game.recordResult(...)` (chemin ET actuel, **inchangé** :
       `RankingAssignedEvent` + Résistance + `GatesCrossedEvent` + `VehicleDestroyedEvent`).
       **Garde** : rejeter `results` (rangs) si `game.type !== EVENEMENT_TELE`.
     - Escarmouche : pour chaque `jerricanGains`, boucle `game.recordWalletMovement(pid, amount,
       WalletReason.RECOMPENSE)` (méthode **existante**,
       [game.ts:380](../../apps/backend/src/app/campaign/domain/games/game.ts#L380)) ; pour chaque
       `destroyedVehicles`, crée un `VehicleDestroyedEvent` **à 0 PC** (poids dérivé serveur pour
       le libellé — réutilise `VehicleDestroyedEvent`, **déjà accepté** par
       `EscarmoucheGame.canAccept`, aucun nouveau type). Ajuster `VehicleDestroyedEvent.describe()`
       pour omettre le suffixe « +X PC » quand PC = 0.
   - Conséquence : une **Escarmouche n'appelle jamais `recordResult`** → pas de validation de
     rangs, pas de Résistance, pas de PC de classement (décision 3, obtenu « gratuitement »).

3. **Revenu de base Escarmouche — tirage serveur différé** (Escarmouche uniquement)
   - `POST /api/campaigns/:id/games/:gameId/events/income` `{ participantId }` (organisateur,
     partie `PLANIFIE`) : nouveau `RollIncomeUseCase` qui tire **1 D6 côté serveur** via
     `IRandomizer` (même port hexagonal que la Table des Épaves,
     [randomizer.interface.ts](../../apps/backend/src/app/campaign/domain/randomizer.interface.ts)),
     crée un `WalletMovementEvent(participantId, d6, WalletReason.RECOMPENSE)` (réutilise
     `Game.recordWalletMovement`), persiste via `appendEvents`, retourne `{ amount, descriptions }`.
     Appelé **une fois par participant présent** pendant la phase de résolution — miroir exact de
     `events/wreck`, appelé une fois par véhicule.
   - Placement du tirage D6 (use case avec `IRandomizer` injecté, vs petite méthode de domaine
     `Game.rollBaseIncome(participantId, randomizer)` cohérente avec le choix fait pour
     `WreckTable`) : **invoquer le skill `ddd`** avant de coder pour trancher où vit la règle
     « revenu = 1 D6 ».

4. **Annulation en cours de résolution — nouveau endpoint de reset**
   - `DELETE /api/campaigns/:id/games/:gameId/results` (organisateur, partie `PLANIFIE`
     uniquement) : nouveau `ResetResultUseCase` qui collecte tous les `event.id` de la partie
     (`campaign.findGame(gameId).events`) et appelle `campaignRepo.deleteEvents(ids)` (méthode
     **existante**, [campaign.repository.interface.ts:33](../../apps/backend/src/app/campaign/domain/campaign.repository.interface.ts#L33)).
     Ramène la partie à un `PLANIFIE` vierge (supprime aussi les revenus D6 et tirages d'épaves
     déjà persistés à l'étape 6). Déclaré dans `campaign.controller.ts` près des routes `.../results`.

5. **`WreckDesignationStep` côté données** : aucun changement de contrat backend
   (`destroyedVehicles`/`events/wreck` inchangés).

> Le brainstorming de la branche ET (`recordResult`) n'introduit pas de nouvelle règle métier
> d'agrégat ; si l'implémentation fait émerger une vraie règle (ex. « Escarmouche interdit tel
> événement »), **invoquer le skill `ddd`** avant de coder, conformément à
> [CLAUDE.md](../../CLAUDE.md).

## Frontend — changements (le gros du travail)

Fichiers sous `apps/frontend/src/app/campaigns/game-result-wizard/`.

1. **`GameResultWizard` (orchestrateur)** — passe d'un flux fixe à **3 écrans** à un flux
   **à étapes variables** :
   - `activeSteps = computed(...)` : tableau ordonné des étapes actives selon `game().type` +
     flags scénario (table ci-dessus). `currentIndex` navigue ce tableau.
   - Navigation **Précédent / Suivant / Annuler** disponible sur **toutes les étapes
     pré-épaves**, **sans persistance** (état accumulé en signals du wizard).
   - Le **dernier écran pré-épaves** (« Suivant/Valider ») émet un unique output `batchReady`
     (généralise l'actuel `rankingSubmitted`) portant `{ results?, jerricanGains?, destroyedVehicles? }`.
     Le parent persiste, puis renvoie `resultRecorded` → l'`effect()` existant fait avancer vers
     l'étape 6 et enchaîne les tirages automatiques (mécanique **inchangée**).
   - Étape 6 : uniquement **Annuler** (→ reset) ou **Terminer** (→ enter-atelier). Plus de retour
     par étape une fois le lot persisté (cohérent avec l'actuel).

2. **`PresenceStep` (nouveau, dumb)** — cases à cocher des participants `VALIDATED`, émet la
   liste des présents (`presentParticipantsChanged` pour recharger `participantVehicles`, comme
   aujourd'hui). Écran 1 des deux types.

3. **`RankingStep` (modifié)** — **retirer** la présence (déplacée dans `PresenceStep`) et les
   portes (déplacées en étape 3). Ne garde que l'**ordonnancement glisser-déposer** des présents
   déjà sélectionnés. Écran 2, ET uniquement.

4. **`GatesStep` et `JerricansStep` (deux nouveaux composants dumb, indépendants)** — un composant
   dédié par étape, **cohérent avec les autres étapes du wizard** (chacune a le sien). Tous deux
   affichent une saisie d'entier par participant présent (grands champs tactiles), mais restent
   **séparés** (sémantiques et libellés distincts, pas de factorisation forcée) : `GatesStep`
   (portes franchies, étape 3, ET — extrait la logique de compteur aujourd'hui embarquée dans
   `RankingStep`) et `JerricansStep` (butin manuel de scénario, étape 4).

5. **`WreckDesignationStep` (ajustement)** — masquer la case « Faveur du Public » quand
   `game.type !== EVENEMENT_TELE` (bonus PC, ET uniquement). Le picker destructeur reste actif
   pour les **deux types** ; `destroyedVehicles` est **envoyé pour les deux** (ET → PC par poids,
   niché sous `results[]` ; Escarmouche → forme à plat `{destroyerId, vehicleId}`, crée un
   `VehicleDestroyedEvent` à 0 PC pour la trace journal).

6. **`WreckResolutionStep` (étendu)** — pour une Escarmouche, déclenche d'abord automatiquement
   les tirages de **revenu** (un par participant présent, `events/income`) puis les tirages
   d'**épaves** (un par véhicule désigné), via le même mécanisme d'`effect()` séquentiel « un
   tirage à la fois » déjà en place pour les épaves. Affiche une section « Revenus » (D6 +
   jerricans crédités par participant) au-dessus de la section « Épaves ». « Terminer » actif
   quand tous les tirages (revenus + épaves) ont un résultat. Garde son nom, ou renommé
   `ResolutionStep` si l'implémenteur juge le contenu trop élargi.

7. **`CampaignProgram` (parent smart)** —
   - `onBatchReady({results?, jerricanGains?, destroyedVehicles?})` : appelle
     `campaignsService.recordResult(...)` (DTO étendu), alimente `resultRecorded`.
   - `onWizardCancel()` en étape 6 : nouvel appel `campaignsService.resetResult(campaignId, gameId)`
     (`DELETE .../results`) puis fermeture. En étapes 1-5, l'annulation reste un simple `formCancel`
     (rien à supprimer).
   - `resolveWreck` / `enterAtelier` : inchangés.

8. **Modèles/service** ([game.model.ts](../../apps/frontend/src/app/campaigns/game.model.ts),
   [campaigns.service.ts](../../apps/frontend/src/app/campaigns/campaigns.service.ts)) :
   - `Scenario` et `Game` gagnent `franchissementPortes`/`gainJerricans`.
   - `RecordResultDto` gagne `jerricanGains?` et `destroyedVehicles?` (forme à plat, Escarmouche).
   - Ajouter `resetResult(campaignId, gameId): Observable<void>` (wrap `DELETE .../results`).
   - Ajouter `resolveIncome(campaignId, gameId, participantId): Observable<{ amount: number; descriptions: string[] }>`
     (wrap `POST .../events/income`) + type miroir dans `game.model.ts`.

**Mobile-first** : layout une seule colonne, cibles tactiles larges, barre d'actions basse
collante (Précédent / Suivant / Annuler). Pas de sur-spécification CSS ici — s'aligner sur les
composants d'étape existants.

## Documentation à mettre à jour (après implémentation)

- [docs/spec/CAMPAIGN.md](../spec/CAMPAIGN.md) : réécrire « Wizard de fin de partie » (étapes
  variables E/ET), retirer la limitation « Escarmouche non couverte », documenter les flags de
  scénario, le reset et la persistance différée.
- [docs/COMPONENTS.md](../COMPONENTS.md) : `PresenceStep`, `GatesStep`, `JerricansStep`,
  `RankingStep` modifié, `WreckResolutionStep` étendu, diagramme de dépendances du wizard.
- [docs/spec/NAVIGATION.md](../spec/NAVIGATION.md) / [docs/SPECIFICATION.md](../SPECIFICATION.md) :
  état « Escarmouche » du wizard.
- [content/docs/programme-tele.md](../../content/docs/programme-tele.md) : documentation
  utilisateur du déroulé de fin de partie selon le type.

## Vérification

- **Backend** : `npx nx test backend` —
  - `record-result.usecase.spec.ts` : branche jerricans (WalletMovementEvent créés), branche
    destroyed Escarmouche (VehicleDestroyedEvent à 0 PC), garde « rangs interdits en Escarmouche ».
  - nouveau `reset-result.usecase.spec.ts` : suppression de tous les événements d'une partie
    PLANIFIE, refus hors PLANIFIE / hors organisateur.
  - nouveau `roll-income.usecase.spec.ts` : D6 serveur (via `FixedRandomizer`), WalletMovementEvent
    crédité au participant.
  - `scenario-catalog.service.spec.ts` : chargement des deux flags.
- **Frontend** : `npx nx test frontend` — nouveaux specs `PresenceStep`, `GatesStep`,
  `JerricansStep`, `RankingStep` (ordre seul), et `GameResultWizard` (calcul de `activeSteps`
  pour ET avec/sans portes, E avec/sans jerricans ; navigation Précédent/Suivant ; émission de
  `batchReady`).
- **Bout en bout manuel** (`./dev.sh`, campagne `EN_COURS`, ≥2 participants avec véhicules) :
  1. **ET avec portes** (`course_de_la_mort`) : présence → classement → portes → désignation →
     résolution. Vérifier PC/Résistance/portes, retour arrière libre avant l'étape 6, Annuler en
     étape 6 remet la partie à zéro.
  2. **Escarmouche avec jerricans** (`pillage_de_convoi`) : présence → jerricans (butin manuel)
     → désignation → résolution. Vérifier **aucun** PC/Résistance ; à la résolution, un **revenu
     D6 serveur** est crédité à chaque participant présent, **cumulé** avec le butin manuel, plus
     la Table des Épaves ; la destruction d'un véhicule ennemi apparaît dans le journal
     (VehicleDestroyedEvent 0 PC) sans changer le classement. Vérifier une Escarmouche **sans**
     `gain_jerricans` (`embuscade`) : seul le revenu D6 est crédité (pas d'étape de butin manuel).
  3. **ET sans portes** (`l_arene`) : l'étape Portes est **absente**.
  - Le classement de `/campaigns/:id` ne se met à jour qu'après la finalisation (étape 6).
- Après implémentation : `npx nx e2e frontend-e2e` (cf. skill `e2e-testing`) si un parcours de
  fin de partie y est couvert.
