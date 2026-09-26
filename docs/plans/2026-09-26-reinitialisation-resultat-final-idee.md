# Réinitialisation du résultat final d'une partie — IDÉE DE FONCTIONNALITÉ

> ⚠️ **Statut : idée discutée et cadrée, non planifiée, non implémentée.**
> Ce document capture le résultat d'une session de cadrage (grilling) tenue le
> 2026-09-26. Il ne fait partie d'aucune spécification active — volontairement
> non référencé depuis `SPECIFICATION.md`, `CLAUDE.md` ou tout autre document de
> référence — et ne doit pas être traité comme une source de vérité sur le
> comportement actuel de l'application. À relire et valider à nouveau avant
> toute mise en chantier (l'implémentation réelle du module `campaign/` a pu
> évoluer entre-temps).

---

## Problème adressé

Une fois qu'une partie (`Game`) a traversé tout le cycle `PLANIFIE → ATELIER →
JOUE`, elle est **définitivement figée** : `Game.addEvent()` refuse tout
nouvel événement, quel qu'il soit (cf.
[CAMPAIGN.md — Cycle de vie d'une partie et phase Atelier](../spec/CAMPAIGN.md#cycle-de-vie-dune-partie-et-phase-atelier)).
Si une erreur est constatée après coup dans le résultat enregistré (mauvais
véhicule désigné en épave, mauvais classement, oubli d'une exploit...),
l'organisateur n'a aujourd'hui **aucun moyen de corriger** — contrairement au
mécanisme de reset déjà existant (`DELETE /api/campaigns/:id/games/:gameId/results`,
`ResetResultUseCase`), qui ne fonctionne que **pendant** la saisie du wizard,
avant que l'organisateur ait cliqué sur "Terminer" (partie encore `PLANIFIE`).

L'idée : permettre à l'organisateur de rouvrir la **dernière partie jouée** de
la campagne pour rejouer entièrement sa séquence de fin de partie — tous les
tirages aléatoires (Table des Épaves, revenu de base Escarmouche, Points de
Résistance automatiques) étant intégralement refaits, pas simplement corrigés
à la main.

---

## Décisions de conception

### 1. Éligibilité — quelle partie peut être réinitialisée

Le replay de la campagne (`Campaign.replay()`) parcourt les parties triées par
`Game.order`, puis par ordre d'événement interne à chaque partie — **pas** par
date réelle de jeu (`playedAt`). La garde de sécurité doit donc porter sur
l'ordre de rejeu, pas sur la chronologie réelle :

> Seule la partie dont l'`order` est **strictement supérieur à celui de toute
> autre partie ayant déjà atteint `ATELIER` ou `JOUE`** est éligible. Les
> parties encore `PLANIFIE` avec un `order` plus élevé n'ont aucun événement et
> ne posent donc aucun problème.

Sans cette garde, réinitialiser une partie plus ancienne dans l'ordre de rejeu
pourrait invalider un atelier déjà ouvert/clos sur une partie plus récente
(cagnotte/Chocs dérivés des récompenses de la partie qu'on voudrait annuler).

Fait technique constaté lors de l'étude : `Campaign` n'a aujourd'hui aucun
helper "dernière partie non-PLANIFIE" — à ajouter (`Campaign.order` getter
existe déjà, `game.ts` ligne ~95).

### 2. Garde — atelier déjà utilisé

Rejeté (HTTP 400) si l'atelier de la partie contient déjà une vraie
transaction :
- un `EquipmentChangedEvent` dont `entityType !== SEQUELLE` (achat/revente
  d'équipement en atelier), ou
- un `VehicleRenamedEvent` (renommage en atelier).

**Nuance technique importante** : `EquipmentChangedEvent(entityType: SEQUELLE)`
peut aussi apparaître pendant que la partie est encore `PLANIFIE` (séquelle
`TABLE_EPAVES` imposée automatiquement par le tirage — `siege_irrecuperable`/
`chassis_fragilise`, coût 0). Ce cas-là fait partie de la séquence de fin de
partie elle-même et **ne doit pas** bloquer la réinitialisation — seul un
`EquipmentChangedEvent` de type autre que `SEQUELLE`, ou un
`VehicleRenamedEvent`, signale une vraie activité d'atelier (les deux ne sont
acceptés par `canAccept()` qu'en statut `ATELIER`, jamais en `PLANIFIE`).

Si la garde échoue, l'organisateur doit d'abord vider l'atelier via les outils
existants (vente/annulation d'équipement, déjà en place) avant de pouvoir
déclencher la réinitialisation.

### 3. Contrainte d'état de la campagne

Réservé aux campagnes `EN_COURS`. Comme les transitions d'état sont
bidirectionnelles (`Campaign.changeState()`), cette restriction n'est jamais
une impasse : l'organisateur peut toujours repasser une campagne `TERMINEE` en
`EN_COURS` avant d'utiliser cette fonctionnalité. Pas de cas particulier à
gérer pour `TERMINEE`.

### 4. Effet de la réinitialisation

Suppression **totale et silencieuse** de tous les événements journalisés pour
cette partie (classement, exploits, sabotage, épaves, revenu, contact
Résistance...) — pas de reset partiel granulaire (on ne garde pas le
classement en ne rejouant que les dés, par exemple : trop complexe à justifier
pour le gain). Le statut de la partie repasse à `PLANIFIE`, `playedAt` est
remis à `null`.

**Absence totale de trace d'audit** (décision revue en cours de session,
volontairement plus simple qu'une première intention) : aucun événement
d'audit, aucune ligne de journal ne signale qu'une correction a eu lieu — même
comportement invisible que le mécanisme de reset déjà existant en cours de
wizard. Ce choix pourra être reconsidéré plus tard si le besoin de
transparence vis-à-vis des autres participants se fait sentir, mais volontairement écarté ici pour ne pas alourdir une première version.

### 5. Autorisation

N'importe quel organisateur de la campagne, sans double validation entre
co-organisateurs — cohérent avec le reste du module (`assertOrganizer`, aucune
action de ce module n'exige de consensus entre organisateurs).

### 6. Mécanique technique — un seul endpoint, deux méthodes de domaine

Décision finale (après discussion) : **ne pas créer de deuxième endpoint**.
`DELETE /api/campaigns/:id/games/:gameId/results` (`ResetResultUseCase`)
reste le point d'entrée unique, mais dispatch en interne selon le statut
constaté de la partie vers **deux méthodes de domaine clairement séparées et
documentées** sur `Game` :

- **Cas `PLANIFIE`** (inchangé) : `resultEventIdsForReset()` — retourne
  `this._events.map(e => e.id)`, ne touche ni `status` ni `playedAt` (déjà à
  leur valeur de repos).
- **Cas `JOUE`** (nouveau) : une méthode dédiée (nom provisoire
  `reopenClosedResult()`) qui porte elle-même la garde d'éligibilité (§1), la
  garde "atelier vide" (§2), la suppression de tous les événements, **et** la
  transition d'état `JOUE → PLANIFIE` + remise à `null` de `playedAt` — une
  transition qui n'existe **nulle part ailleurs** dans le code actuellement
  (confirmé lors de l'étude : aucune méthode ne fait jamais `JOUE → PLANIFIE`
  ou `ATELIER → PLANIFIE`, `enterAtelier()`/`closeAtelier()`, `game.ts` lignes
  ~141-155, sont de simples affectations de champ, jamais l'inverse).

Pourquoi ne pas fusionner complètement en une seule méthode : la garde
d'entrée diffère structurellement (`status === PLANIFIE` vs `status === JOUE`
+ deux vérifications supplémentaires), et le cas `JOUE` introduit une vraie
nouvelle capacité du domaine (transition arrière) que le cas `PLANIFIE` n'a
jamais eu besoin de porter. Garder deux méthodes nommées et documentées
séparément, même derrière un seul endpoint, évite qu'un futur lecteur
confonde les deux politiques ou pense que l'une est un simple alias de
l'autre.

Le statut `ATELIER` reste, comme aujourd'hui, **toujours rejeté** par ce
endpoint (aucun changement de comportement pour ce cas).

### 7. Parcours utilisateur après réinitialisation

Aucune UI spéciale : une fois repassée en `PLANIFIE`, la partie redevient une
ligne `PLANIFIE` ordinaire dans `GameList`. L'organisateur reclique sur
"Enregistrer résultat" comme pour n'importe quelle nouvelle partie — le
wizard (`GameResultWizard`) repart entièrement de zéro, écran Présence
compris.

### 8. UI

Nouveau bouton sur les lignes `JOUE` de `GameList` (aujourd'hui, aucune action
de reset n'existe sur cette liste — confirmé lors de l'étude,
`game-list.ts`/`game-list.html`, le seul mécanisme de reset actuel vit
entièrement à l'intérieur du wizard, câblé dans
`campaign-program.ts` — `onWizardCancelled`, lignes ~417-430) :

- **Actif** uniquement sur la partie éligible (§1) et dont l'atelier est vide
  (§2).
- **Visible mais désactivé**, avec une info-bulle explicative ("seule la
  dernière partie jouée, sans transaction d'atelier, peut être réinitialisée"),
  sur les autres lignes `JOUE` — plutôt que complètement absent du DOM, pour
  que l'organisateur comprenne pourquoi l'action n'est pas disponible sur une
  ancienne partie.

### 9. Confirmation

Dialog de confirmation simple (`ConfirmModal` existant), sans motif à saisir —
pas de champ "raison de la correction" obligatoire ni optionnel : une
confirmation suffit, cohérent avec l'absence de trace d'audit (§4).

---

## Explicitement écarté (pour ne pas être redemandé plus tard sans raison)

- Trace d'audit visible dans le journal de la partie (event dédié type
  `ResultResetEvent`) — envisagé puis abandonné en cours de session comme
  complexité disproportionnée pour un besoin non avéré.
- Motif de correction obligatoire ou optionnel.
- Cascade automatique de suppression des transactions d'atelier déjà
  passées — préféré bloquer plutôt qu'annuler en cascade (l'organisateur doit
  vider l'atelier lui-même via les outils existants).
- Autoriser la réinitialisation quand la campagne est `TERMINEE`.
- Deuxième endpoint HTTP dédié — tranché en faveur d'un endpoint unique avec
  deux méthodes de domaine séparées.
- Reset partiel (garder certaines saisies manuelles, ne rejouer que les dés).
- Réouverture automatique du wizard juste après le clic sur "Réinitialiser".

---

## Repères techniques pour une future implémentation

Fichiers identifiés lors de l'étude préalable (chemins relatifs à la racine du
dépôt, à revérifier au moment de l'implémentation réelle — le code a pu
évoluer) :

- `apps/backend/src/app/campaign/domain/games/game.ts` — `resultEventIdsForReset()`
  (~ligne 653), `canAccept()` (abstrait, ~ligne 120), `addEvent()` (~lignes
  127-136), `enterAtelier()`/`closeAtelier()` (~lignes 141-155), `order`
  getter (~ligne 95), `reorder()` (~lignes 163-165).
- `apps/backend/src/app/campaign/domain/games/evenement-tele-game.ts` —
  `canAccept()` par statut (~lignes 36-72), garde d'idempotence de
  `distributeResistance()` (~lignes 94-97 : vérifie la présence d'un
  `ResistanceContactedEvent` dans le journal en mémoire, donc se comporte
  correctement après une suppression+rejeu complet).
- `apps/backend/src/app/campaign/domain/games/escarmouche-game.ts` —
  `canAccept()` miroir (~lignes 39-60).
- `apps/backend/src/app/campaign/domain/campaign.ts` — `findGame()` (~lignes
  114-118), `findAtelierGame()` (~lignes 131-135), `replay()` trie par `order`
  (~ligne 147), `reorderGames()` (~lignes 374-391), `nextOrder()` (~ligne 466)
  — aucun helper "dernière partie non-PLANIFIE" n'existe, à ajouter.
- `apps/backend/src/app/campaign/application/reset-result.usecase.ts` (nom
  approximatif — use case existant à faire évoluer pour dispatcher selon le
  statut).
- `apps/backend/src/app/campaign/infrastructure/entities/game-event.entity.ts`
  (~lignes 24-33) — colonne `gameId` unique partagée par tous les types
  d'événement (STI), confirme qu'un filtre "cette partie a-t-elle un événement
  d'atelier" est un simple filtre sur `game.events`.
- `apps/backend/src/app/campaign/domain/events/game-event-type.enum.ts`
  (~lignes 4-19) — liste des discriminants `eventType`.
- `apps/frontend/src/app/campaigns/game-list/game-list.ts` — aucune action de
  reset aujourd'hui (~lignes 6-13, 86 : actions limitées aux parties
  `PLANIFIE`) — nouveau bouton à ajouter sur les lignes `JOUE`.
- `apps/frontend/src/app/campaigns/campaign-program/campaign-program.ts` —
  `onWizardCancelled()` (~lignes 417-430), mécanisme de reset actuel, à ne pas
  confondre avec la nouvelle action.
- `apps/frontend/src/app/campaigns/campaigns.service.ts` — `resetResult()`
  (~lignes 292-293), `DELETE /api/campaigns/:id/games/:gameId/results` déjà
  câblé côté frontend, réutilisable tel quel côté appelant (même route, même
  verbe HTTP).

---

## Prochaines étapes si cette idée est retenue

1. Invoquer le skill `ddd` avant toute écriture de code (règle du projet pour
   toute nouvelle règle métier).
2. Concevoir précisément la nouvelle méthode `Game.reopenClosedResult()` (ou
   nom définitif) et le helper d'éligibilité sur `Campaign`.
3. Mettre à jour `docs/spec/CAMPAIGN.md` (nouvelle capacité, endpoint
   inchangé mais comportement étendu) et `docs/ARCHITECTURE.md`/`DOMAIN_MODEL.md`
   si une nouvelle méthode de domaine notable est ajoutée.
4. Ajouter la couverture de tests (backend unitaire + e2e) pour les deux
   branches du use case et les deux gardes (§1 et §2).
