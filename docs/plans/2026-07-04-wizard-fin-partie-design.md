# Wizard de fin de partie (classement → épaves → table des épaves)

## Contexte

Aujourd'hui, `GameResultForm` (`apps/frontend/src/app/campaigns/game-result-form/`) est une
modale unique qui enregistre en un seul `POST .../results` : classement, portes franchies et
véhicules ennemis détruits (US-B2). C'est le seul écran de fin de partie qui existe côté
frontend — la Table des Épaves (D6 serveur, `POST .../events/wreck`) est **entièrement
backend, sans aucune UI** (confirmé — zéro référence "wreck" dans `apps/frontend`), et sa
table de résultats est aujourd'hui réduite à 3 issues génériques (`CHOCS_GAGNE`/`ARME_PERDUE`/`EPAVE`),
documentées comme limitation connue dans `docs/spec/CAMPAIGN.md`.

L'utilisateur veut remplacer la modale unique par un **wizard à 3 écrans séquentiels**
(classement → désignation des épaves → résolution de la Table des Épaves), et en profiter
pour implémenter la **vraie Table des Épaves à 9 lignes** (fournie par l'utilisateur,
ci-dessous), au lieu du modèle simplifié à 3 issues. Un document de conception antérieur
(`docs/plans/2026-06-21-mode-campagne-design.md` §4-5) avait déjà anticipé ce besoin et
posé le bon pattern d'extension (Décorateur de séquelle, déjà implémenté et actif pour
d'autres usages) — ce design le réutilise directement plutôt que d'inventer un nouveau
mécanisme.

### Décisions actées avec l'utilisateur

- Le wizard couvre exactement 3 écrans. Les **Points de Résistance** sont crédités
  **automatiquement** en fin d'écran 1 (aucun écran dédié — cohérent avec leur secret) :
  tout participant hors du top `ceil(n/2)` (calcul `classified` déjà présent dans
  `Campaign.recordResult`) reçoit +3 PR, même s'il a marqué des PC d'exploit. Referme la
  lacune US-F1 documentée dans `CAMPAIGN.md`.
- Écran 2 liste **tous** les véhicules des participants présents (pas de présélection) et
  **remplace** l'actuel picker "véhicules détruits" de l'ancien écran classement.
- **Toutes les pertes d'équipement sont des tirages aléatoires serveur, jamais un choix de
  l'organisateur** — ni pour l'arme perdue (correction actée : "la perte des armes ou des
  améliorations est aléatoire"), ni pour quoi que ce soit d'autre dans la table. **Écran 3
  n'a donc aucun sélecteur** : un bouton "Tirer" par véhicule, le serveur fait tout.
- La perte d'**amélioration** (ligne 6) n'est **pas implémentée** dans ce chantier — les
  améliorations campagne n'ont pas encore de mécanisme de perte côté event-sourcing. Ligne 6
  n'a donc aucun effet de perte pour l'instant (uniquement le gain de Chocs), avec un
  commentaire de code explicite pour la suite.
- Ligne 9 ("Favori du public") : pas de nouvelle ressource "Votes du Public" (hors périmètre).
  L'effet différé (+5 PC "si ce véhicule devient une Épave" plus tard) est géré par
  **attestation manuelle de l'organisateur** : une case à cocher à l'écran 2
  ("a déjà reçu Favori du Public lors d'une partie précédente") sur chaque véhicule désigné
  pour la Table des Épaves. Si cochée et que le tirage de l'écran 3 donne *Véhicule détruit*,
  l'app crédite +5 PC au propriétaire. Aucun état n'est mémorisé automatiquement d'une partie
  à l'autre — c'est un rappel textuel à l'écran 3 qui alerte l'organisateur pour la fois
  suivante.
- Ligne 8 ("Châssis fragilisé", Jeton Danger) : pure règle de plateau physique, aucun état
  numérique — affichée comme texte de rappel après le tirage, jamais interprétée par le
  moteur (même famille que documentée dans le design antérieur §4).

## Table des Épaves (fournie par l'utilisateur — à coder telle quelle)

D6 modifié = `diceRoll + chocsBefore + modificateurPoids` (Léger +1, Lourd −1, Moyen 0,
mécanique déjà en place, inchangée) :

| D6+Chocs | `WreckResult` | Effet |
|---|---|---|
| 0-1 | `DEBOSSELE` | `-1` Choc (minimum 0) |
| 2-3 | `INDEMNE` | Aucun effet |
| 4 | `ROUE_CABOSSEE` | `+1` Choc |
| 5 | `ARRACHEE` | Perd définitivement une **arme ou amélioration** tirée au hasard dans le pool combiné (armes + améliorations montées, hors améliorations `estDefaut`), `+1` Choc |
| 6 | `PIGNON_ENDOMMAGE` | `+1` Choc — perd définitivement un **avantage** tiré au hasard dans le pool monté (`AdvantageLostEvent`, implémenté depuis — cf. `docs/spec/CAMPAIGN.md`) |
| 7 | `SIEGE_IRRECUPERABLE` | Équipage réduit de 1 (min 1), **permanent** — `+2` Chocs |
| 8 | `CHASSIS_FRAGILISE` | `+2` Chocs — rappel textuel "Jeton Danger si collision" (pas d'état) |
| 9 | `FAVORI_DU_PUBLIC` | `+3` Chocs — rappel textuel ; si la case "Favori du Public" est cochée **et** qu'un futur tirage donne `VEHICULE_DETRUIT`, +5 PC au propriétaire |
| 10+ | `VEHICULE_DETRUIT` | Véhicule détruit, pilote mort (remplace l'actuel `EPAVE`) |

## Changements backend

### 1. `WreckResult` enum + `WreckOutcome` / `WreckResolverService`

`apps/backend/src/app/campaign/domain/enums/wreck-result.enum.ts` : remplacer les 3 valeurs
par les 9 ci-dessus.

`apps/backend/src/app/campaign/domain/wreck/wreck-outcome.ts` — `lookupTable()` étendue aux
9 tranches. `fromRoll()` perd le paramètre `weaponIdChoice` (n'est plus fourni par
l'appelant) et prend à la place le pool combiné (armes + améliorations montées, hors
`estDefaut`) du véhicule pour tirer aléatoirement en cas de `ARRACHEE`. `chocsGained` pour
`DEBOSSELE` = `-Math.min(1, chocsBefore)` (jamais négatif, `Vehicle.addChocs` refuse un
total < 0).

`apps/backend/src/app/campaign/infrastructure/wreck-resolver.service.ts` — `resolve(vehicle)`
(signature simplifiée, sans `weaponIdChoice`) fait le tirage D6 (`rollD6()`, déjà `protected`
pour les tests) **et**, si le résultat est `ARRACHEE`, tire au hasard dans le pool combiné
`[...vehicle.weapons, ...vehicle.improvements.filter(i => !i.estDefaut)]` via une nouvelle
méthode `protected pickRandomLoss(pool)` — même pattern d'injection que `rollD6()` pour les
tests (`TestWreckResolver extends WreckResolverService`). Le résultat distingue le type tiré
(arme vs amélioration) pour que le use case sache quel événement émettre. Si le véhicule n'a
ni arme ni amélioration éligible, pas de perte (cas limite à tester explicitement).

### 2. Nouveau `ImprovementLostEvent` — mirroir de `WeaponLostEvent`

Aujourd'hui seul `WeaponLostEvent` existe (`Weapon` a déjà `isLost`/`markLost()`/
`clearLost()`/`clearCampaignState()`, `Team.findWeapon(id)` public). `Improvement`
(`apps/backend/src/app/team/domain/improvement.ts`) n'a **aucun** de ces membres — à ajouter
par analogie exacte avec `weapon.ts` : `private _isLost`, `get isLost()`, `markLost()`,
`clearLost()`, `clearCampaignState()`, et `slots`/`price` retournant 0 si perdu (même logique
que `estDefaut`). Ajouter `Team.findImprovement(id): Improvement` (public, scanne
`vehicle.improvements` sur tous les véhicules — mirroir exact de `Team.findWeapon`, à
distinguer du `Vehicle.findImprovement` déjà existant mais `private`, utilisé en interne par
l'assignation de Tourelle). Wirer `improvement.clearCampaignState()` dans la boucle de
`Team.resetCampaignState()` (qui traite déjà les armes, jamais les améliorations aujourd'hui).

Nouvel événement `apps/backend/src/app/campaign/domain/events/improvement-lost.event.ts`,
copie conforme de `WeaponLostEvent` (`execute` → `p.team.findImprovement(id).markLost()`,
`undo` → `clearLost()`). Enregistré dans `canAccept()` de `EvenementTeleGame`/
`EscarmoucheGame` (même liste que `WeaponLostEvent`) et dans le discriminant `eventType` de
`GAME_EVENT`. Referme une partie de la limitation US-E documentée dans `CAMPAIGN.md`
("seules les armes peuvent être perdues, jamais les améliorations").

> Note : les améliorations perdues restent hors du calcul de budget/emplacements (même
> traitement que les armes perdues aujourd'hui) ; extension optionnelle mais cohérente :
> exposer `isLost` sur les améliorations dans `WorkshopVehicleDto`/`get-workshop.usecase.ts`
> (actuellement seul `WorkshopWeaponDto.isLost` existe, pas d'équivalent amélioration) —
> à faire dans ce chantier pour rester cohérent avec l'existant côté armes.

### 3. Nouvelle séquelle "Siège irrécupérable" — réutilise le Decorator existant

`apps/backend/src/app/team/domain/sequella-decorators.ts` : ajouter `SEQUELLA_SIEGE_IRRECUPERABLE`
(`SequellaType.from(...)`) + `SiegeIrrecuperableDecorator` (`equipage: Math.max(1, s.equipage - 1)`)
+ entrée dans `SEQUELLA_REGISTRY` — exactement le pattern "1 classe + 1 ligne au registre" déjà
documenté (§3.4 `ARCHITECTURE.md` pour les améliorations, même principe ici pour les séquelles).

### 4. `WreckResolveUseCase` — orchestration étendue

`apps/backend/src/app/campaign/application/wreck-resolve.usecase.ts` :
- Retire `weaponIdChoice` de `WreckResolveCommand` ; ajoute `pendingFavoriDuPublic?: boolean`
  (coché à l'écran 2, transmis tel quel par le use case).
- `outcome.wreckResult === 'ARRACHEE'` → selon le type tiré par `pickRandomLoss` : `WeaponLostEvent`
  (arme) ou `ImprovementLostEvent` (amélioration) — un seul des deux, jamais les deux.
- `outcome.wreckResult === 'SIEGE_IRRECUPERABLE'` → émet en plus
  `new SequellaAddedEvent(0, gameId, participantId, 0, vehicleId, 'siege_irrecuperable', 0)`
  (coût `0` passé explicitement — c'est la Table des Épaves qui l'impose, pas un achat
  Atelier ; réutilise `SequellaAddedEvent` tel quel, aucun nouvel événement nécessaire).
- `outcome.wreckResult === 'VEHICULE_DETRUIT'` → `VehicleLostEvent` (renommage de la branche
  `EPAVE` existante) ; si en plus `cmd.pendingFavoriDuPublic` est vrai → émet un nouvel
  événement `FavoriDuPublicBonusEvent(0, gameId, participantId, 0, vehicleId, 5)` (nouveau
  Command GoF, même forme que `GatesCrossedEvent`/`VehicleDestroyedEvent` :
  `execute()` → `participant.addPoints(+5)`, `undo()` → `addPoints(-5)`). Ajouter cette classe
  dans `domain/events/`, l'enregistrer dans `canAccept()` de `EvenementTeleGame` et
  `EscarmoucheGame` (même liste que `WreckResolvedEvent`), et dans le discriminant
  `eventType` de `GAME_EVENT` (doc `DOMAIN_MODEL.md` à mettre à jour).

### 5. Contrôleur / DTO

`WreckResolveDto` (`apps/backend/src/app/campaign/dto/`) : retirer `weaponIdChoice`, ajouter
`pendingFavoriDuPublic?: boolean`. Endpoint `POST .../events/wreck` inchangé par ailleurs
(retourne déjà `{ outcome: WreckOutcome }` en JSON 200 — confirmé, pas de `@HttpCode(204)`).

### 6. `Campaign.recordResult()` — Points de Résistance automatiques

`apps/backend/src/app/campaign/domain/campaign.ts:297` : après le calcul existant de
`classified = Math.ceil(rankings.length / 2)`, pour chaque `r` avec `r.rank > classified`,
ajouter `new ResistanceContactedEvent(0, game.id, r.participantId, 0)` via `game.addEvent(...)`,
au même titre que `RankingAssignedEvent`. Aucun nouvel endpoint : comportement englobé dans
l'appel existant `POST .../results`.

**Pas de changement** sur `ParticipantVehicleDto`/`GetParticipantVehiclesUseCase` : comme la
perte d'arme est désormais aléatoire côté serveur (pas de sélecteur), l'écran 3 n'a besoin
d'aucune donnée d'armement — la liste actuelle (`vehicleId`, `nom`, `weightClass`) suffit
pour écran 2 comme aujourd'hui.

## Modèle des 3 écrans (frontend)

**Écran 1 — Classement** : identique au mécanisme actuel de `GameResultForm` (drag-and-drop
CDK, portes franchies), extrait dans un sous-composant dédié `RankingStep`.

**Écran 2 — Désignation des véhicules mis en épave** (`WreckDesignationStep`, nouveau) :
liste tous les véhicules de tous les participants présents (réutilise `participantVehicles`,
inchangé). Pour chaque véhicule, **toujours visibles** (plus simple qu'un affichage
conditionnel) : le choix *Intact* (défaut) / *Détruit par [participant, poids déduit]* /
*Mis en épave seul*, **et** une case à cocher "Favori du Public (partie précédente)" — cette
dernière ne compte que si le véhicule n'est pas resté "Intact" au moment de la validation.
Produit :
- `destroyedVehicles` (forme `DestroyedVehicleDto` **inchangée**, seulement les entrées avec
  un vrai destructeur) → toujours envoyé dans `RecordResultDto` comme aujourd'hui, seule
  source de PC d'exploit.
- `wreckedVehicles: { participantId; vehicleId; pendingFavoriDuPublic }[]` — **état client
  uniquement**, toutes les désignations (avec ou sans destructeur), pilote l'écran 3.

**Écran 3 — Résolution de la Table des Épaves** (`WreckResolutionStep`, nouveau) : un bloc par
véhicule de `wreckedVehicles`, un bouton "Tirer" (aucun sélecteur — tout est aléatoire
serveur), affichage du résultat reçu (nom de la ligne, Chocs gagnés/perdus, arme perdue le
cas échéant, texte de rappel pour Châssis fragilisé/Favori du Public, bannière "Véhicule
détruit" + éventuel "+5 PC (Favori du Public)"). "Terminer" activé quand tous les véhicules
ont un résultat.

### Composants et flux (convention dumb/smart respectée)

`GameResultWizard` (dumb, remplace `GameResultForm`) orchestre les 3 sous-écrans, garde les
inputs/outputs existants (`game`, `participants`, `saving`, `participantVehicles`,
`presentParticipantsChanged`, `formCancel`), et ajoute :
- `rankingSubmitted` (output, transition écran 2→3) : porte le `RecordResultDto` complet.
- `resultRecorded` (input) : renvoyé par le parent une fois `recordResult()` résolu ; un
  `effect()` fait avancer le wizard vers l'écran 3.
- `wreckRollRequested` (output) : `{ participantId, vehicleId, pendingFavoriDuPublic }` par
  clic sur "Tirer".
- `wreckOutcomes` (input) : `ReadonlyMap<number, WreckOutcomeDto>` clé = `vehicleId`, mis à
  jour par le parent après chaque `resolveWreck()` résolu.
- `wizardCompleted` (output, remplace `saved`) : au clic "Terminer" de l'écran 3.

`CampaignProgram` (smart, inchangé dans son rôle) : ajoute `onRankingSubmitted` (appelle
`recordResult`, alimente `resultRecorded`) et `onWreckRollRequested` (appelle
`campaignsService.resolveWreck`, alimente `wreckOutcomes`). Le rechargement de `games` +
l'émission de `resultRecorded` (vers `CampaignDetail`/`ParticipantList`) n'a lieu qu'à la
fin **complète** du wizard (écran 3), pas à la soumission du classement seul.

`apps/frontend/src/app/campaigns/campaigns.service.ts` : ajouter `resolveWreck(campaignId,
gameId, dto): Observable<WreckResolveResultDto>` (wrap `POST .../events/wreck`, sans
`weaponIdChoice`, avec `pendingFavoriDuPublic`). Ajouter les interfaces miroir dans
`game.model.ts` (`WreckResult` union à 9 valeurs, `WreckOutcomeDto`). `vehicleIsLost` /
`weaponIsLost` ne sont pas sérialisés par le backend (getters de prototype) — le frontend
les dérive lui-même (`wreckResult === 'VEHICULE_DETRUIT'`, etc.), pas de fix backend
nécessaire.

## Vérification

- Backend : `wreck-outcome.spec.ts` / `wreck-resolver.service.spec.ts` — une assertion par
  ligne de la table (9 lignes), y compris les bornes (0-1, 10+), le clamp de `DEBOSSELE` à 0
  Choc, le tirage aléatoire dans le pool combiné armes+améliorations (via l'injection de
  test), le cas "aucun équipement éligible". `wreck-resolve.usecase.spec.ts` — vérifie
  l'émission de `WeaponLostEvent` **ou** `ImprovementLostEvent` selon le type tiré sur
  `ARRACHEE`, de `SequellaAddedEvent` (coût 0) sur `SIEGE_IRRECUPERABLE`, de
  `FavoriDuPublicBonusEvent` uniquement si `pendingFavoriDuPublic` **et** `VEHICULE_DETRUIT`.
  `improvement.spec.ts`/`improvement-lost.event.spec.ts` — `isLost`/`markLost`/`clearLost`/
  `clearCampaignState`, mirroir des tests déjà existants sur `Weapon`. `campaign.spec.ts` —
  PR automatiques sur les participants non classés après `recordResult`.
- Frontend : `npx nx test frontend` sur les nouveaux specs des 3 sous-écrans + wizard
  orchestrateur.
- Bout en bout manuel : `./dev.sh`, campagne `EN_COURS` avec ≥2 participants et véhicules
  armés, `/campaigns/:id`, enregistrer un résultat via les 3 écrans en forçant (via le dé de
  test si besoin) chacune des 9 lignes, vérifier PC/Chocs/séquelle/perte d'arme cohérents et
  que le classement ne se met à jour qu'après l'écran 3.
- Mettre à jour `docs/spec/CAMPAIGN.md` (US-B2/E1-E4/F1 — la table à 9 lignes n'est plus une
  limitation), `docs/DOMAIN_MODEL.md` (nouvel événement, discriminant `eventType`) et
  `docs/COMPONENTS.md` après implémentation.
