# Design — Annulation d'achat vs revente en atelier

> **Implémenté le 2026-07-11**, conformément à ce document. Comportement documenté
> dans [`docs/spec/CAMPAIGN.md` §Annulation d'achat vs revente](../spec/CAMPAIGN.md#annulation-dachat-vs-revente).
> Deux écarts mineurs par rapport au texte ci-dessous, résolus pendant l'implémentation
> (détails dans le commentaire de tête d'`equipment-changed.event.ts` et de
> `Game.changeEquipment`) : `EquipmentChangedEvent.execute()`/`undo()` gardent un
> branchement explicite à 3 voies (VEHICLE reste sur l'ancien modèle addEntity/
> removeEntity, WEAPON/IMPROVEMENT seuls passent par markSoldEntity/clearSoldEntity) ;
> et `Vehicle`/`Team` gagnent les passe-plats `markWeaponSold`/`markImprovementSold`
> tels que suggérés ici (confirmé cohérent avec le code existant, pas de déviation).

## Contexte

L'atelier (mode campagne, phase garage post-partie) permet d'acheter et de retirer des
armes/améliorations sur les véhicules de l'équipe engagée, financé par la cagnotte du
participant. Aujourd'hui, **tout retrait** (`operation: 'SELL'`) se comporte à l'identique,
que l'objet vienne d'être acheté pendant la session en cours ou qu'il soit déjà monté depuis
avant (construction d'équipe ou atelier précédent) : suppression physique, remboursement
plein tarif.

Ceci ne correspond pas aux règles Gaslands ni à l'UX voulue :
- **Annuler un achat de cette session** doit être indolore et invisible : l'objet disparaît
  du véhicule et du journal, remboursement intégral, comme si l'achat n'avait jamais eu lieu.
- **Revendre un objet pré-existant** doit suivre la règle officielle (p.170) : remboursement à
  **moitié prix** (bug actuel : remboursement plein tarif), et l'objet doit **rester visible**
  sur la fiche du véhicule, barré, avec un badge "Vendue" — traçabilité que l'objet a existé.

Ce document capture la conception validée en session de brainstorming (2026-07-11).

**Décisions actées** (Q&A de cadrage) :
- Fusionner cette fonctionnalité avec la correction du bug de revente à moitié prix (une seule
  passe sur le code événementiel).
- Le badge "Vendue" est **permanent** (comme `isLost`), pas limité à la session en cours.
- Il s'affiche **entrelacé** dans la même liste que l'équipement actif (`MountedEquipment`),
  pas dans une section séparée — extension du composant partagé via un flag optionnel, même
  pattern que le `locked` déjà documenté dans COMPONENTS.md.
- Arrondi de la revente : **inférieur** (floor) pour le remboursement, ce qui implique un prix
  résiduel **supérieur** (ceil) pour la part non remboursée — `floor(X/2) + ceil(X/2) = X`.

---

## 1. Mécanisme d'annulation vs revente

La "session d'atelier" correspond exactement à la partie (`Game`) actuellement en statut
`ATELIER` — un `Game` ne peut y entrer qu'une seule fois dans sa vie (`PLANIFIE → ATELIER →
JOUE`, irréversible), donc "acheté cette session" = présent dans `Game.events` de cette partie
précise.

**Annulation** (l'objet ciblé par le retrait a été créé par un `BUY` déjà présent dans
`this.events` de la partie atelier courante) :
- On **supprime physiquement** la ligne `EquipmentChangedEvent` (BUY) de `game_events`.
- Aucun événement de vente n'est créé. Invisible dans le journal (`Game.journal()`) — cohérent
  avec "n'a jamais eu lieu".
- Aucune replay manuelle (undo/redo) n'est nécessaire : le système reconstruit déjà l'état
  entier par replay à **chaque lecture** (`GetWorkshopUseCase`), et le frontend refait un
  `GET /workshop` après chaque mutation. Supprimer la ligne suffit ; le prochain replay
  reconstruit tout correctement.

**Revente** (objet pré-existant — construction d'équipe OU atelier précédent déjà refermé) :
- Événement `EquipmentChangedEvent` (`SELL`) classique, journalisé normalement (visible et
  permanent dans le journal : "Revente : X (2 jerricans)").
- `execute()` ne retire plus l'entité : il la **flague** `isSold = true` (mirroir exact du
  pattern `isLost` déjà en place pour les pertes de la Table des Épaves).

**Invariant critique vérifié dans le code (pas supposé depuis la doc)** — pourquoi la
suppression physique est sûre : pendant `GameStatus.ATELIER`, `canAccept()` n'autorise que
DEUX types d'événements, vérifié identique dans `evenement-tele-game.ts:48-50` et
`escarmouche-game.ts:52-54` :
```ts
if (this.status === GameStatus.ATELIER) {
  return event instanceof EquipmentChangedEvent || event instanceof SequellaAddedEvent;
}
```
Et `SequellaAddedEvent` (`sequella-added.event.ts:16-28`) ne référence qu'un `vehicleId` —
jamais un `weaponId`/`improvementId`. Donc, tant que ce mécanisme reste scopé aux **armes et
améliorations** (pas aux véhicules — non exposé en atelier aujourd'hui de toute façon), rien
dans la fenêtre d'une session ne peut se retrouver à référencer un id supprimé.

**Ancrages pour que cet invariant reste vrai** (documentation + détection automatique, pas
seulement un commentaire isolé) :
1. Commentaire d'alerte sur `canAccept()` (les deux sous-types `Game`) : explique que la
   suppression physique n'est sûre que parce qu'aucun type accepté ici ne porte de
   `weaponId`/`improvementId` à part `EquipmentChangedEvent` — avertit qu'ajouter un nouveau
   type impose de revérifier ce point.
2. Commentaire miroir sur la nouvelle méthode `Game.findSameSessionPurchase`, renvoyant vers
   l'invariant ci-dessus.
3. **Test exhaustif** — étendre `describe('EvenementTeleGame — canAccept en ATELIER', ...)`
   (`game.spec.ts:118-136`, aujourd'hui non-exhaustif : seulement 2 cas acceptés + 2 refusés
   testés) en un test paramétré (`it.each`) couvrant TOUS les types d'événements connus, avec
   un commentaire : *"Si ce test casse après l'ajout d'un type — lire le commentaire sur
   `canAccept()` avant de l'ajouter."* Un test rouge force la relecture de l'invariant, pas
   seulement l'espoir qu'un commentaire ait été lu.

---

## 2. Domaine backend

### `Weapon`/`Improvement` (`team/domain/`) — mirroir de `isLost`, avec prix résiduel

```ts
private _isSold = false;
get isSold(): boolean { return this._isSold; }

/** Prix résiduel une fois vendu : ce qui reste après remboursement à moitié prix (floor).
 *  floor(X/2) remboursé + ceil(X/2) résiduel = X. Jamais 0 (garde l'affichage lisible sur
 *  la carte barrée), jamais le plein prix (le remboursement a bien eu lieu). */
get price(): number { return this._isSold ? Math.ceil(this.type.price / 2) : this.type.price; }

/** Emplacements : 0 si vendu OU perdu — libère le slot, contrairement au prix qui ne
 *  s'annule jamais complètement (résiduel). */
get slots(): number { return (this._isLost || this._isSold) ? 0 : this.type.slots; }

markSold(): void { this._isSold = true; }
clearSold(): void { this._isSold = false; }
```

Pourquoi le prix résiduel (`ceil(X/2)`) plutôt que 0 ou plein tarif — **et pourquoi PAS une
ligne à coût négatif** (option envisagée puis écartée) :
- Coût négatif (écraser le prix par `-floor(X/2)`) : produit un double remboursement pour
  tout objet acheté puis revendu à travers plusieurs sessions d'atelier séparées dans le
  temps — la trace du montant initialement dépensé disparaît, seul le remboursement reste
  visible dans la somme courante. Vérifié par calcul : achat à 4 (session 3), revente à
  `floor(4/2)=2` (session 7, bien plus tard) → avec un coût négatif, la contribution de cet
  objet à l'arbre de coût passe de `+4` à `-2` (delta de -6, alors que le vrai effet net est
  -2). Avec un prix résiduel, elle passe de `+4` à `+2` (delta de -2, correct).
- Prix résiduel (`ceil(X/2)`, cette conception) : la contribution de l'objet est simplement
  RÉDUITE, jamais écrasée par une valeur déconnectée — aucune perte d'historique, et
  **aucun filtre `isSold` n'est nécessaire** dans `Vehicle.cost`/`buildVehicleSummary`/
  `EquipmentManager.coutTotal` : ils font déjà `sum(x.price)` sans condition et obtiennent
  la bonne valeur automatiquement, puisque `price` s'auto-ajuste à la source.

`Vehicle`/`Team` gagnent les passe-plats `markWeaponSold(vehicleId, weaponId)` /
`markImprovementSold(...)` (+ `clear...` pour `undo()`), mirroir de
`addCampaignWeapon`/`removeCampaignWeapon` déjà en place.

### `EquipmentChangedEvent` (`domain/events/`)

`execute()`/`undo()` ne touchent **plus jamais le wallet** (cf. §3) — uniquement l'arbre
d'entités :
```ts
execute(): // SELL ne signifie plus jamais "annulation" (gérée par suppression, cf. §1)
  BUY  → addEntity(p, -this.id)
  SELL → markSoldEntity(p, this.targetEntityId!)

undo():
  BUY  → removeEntity(p, -this.id)
  SELL → clearSoldEntity(p, this.targetEntityId!)
```
`describe()` : `"Revente : X (Y jerricans)"` — toujours une vraie revente désormais, jamais
une annulation (qui n'existe plus comme événement journalisé).

Le champ `cost` stocké sur l'événement (= `floor(price/2)` pour une revente) reste utile pour
`describe()`/le journal, mais n'est plus utilisé opérationnellement par `execute()`/`undo()`.

### `Game.changeEquipment` (`domain/games/game.ts`)

Nouvelle méthode privée, réutilisée en lecture (§4) :
```ts
private findSameSessionPurchase(entityType: EquipmentEntityType, entityId: number): EquipmentChangedEvent | null {
  return this._events.find(
    (e): e is EquipmentChangedEvent =>
      e instanceof EquipmentChangedEvent &&
      e.operation === EquipmentOperation.BUY &&
      e.entityType === entityType &&
      -e.id === entityId,
  ) ?? null;
}

/** Point d'entrée public en lecture (GetWorkshopUseCase, §4). */
wasPurchasedThisSession(entityType: EquipmentEntityType, entityId: number): boolean {
  return this.findSameSessionPurchase(entityType, entityId) !== null;
}
```

Flux `changeEquipment` révisé pour `SELL` (scopé WEAPON/IMPROVEMENT — pas VEHICLE, non exposé
en atelier aujourd'hui) :
1. `resolveSell` (inchangé dans sa logique de recherche/ownership — lève déjà `DomainException`
   si l'objet n'est pas trouvé ou n'appartient pas à ce participant) — coût désormais
   `Math.floor(price / 2)`.
2. Si `findSameSessionPurchase(entityType, targetEntityId)` trouve un match → retourne
   `{ events: [], deleteEventId: buyEvent.id }`. Aucun `assertCanAfford`, aucune construction
   d'événement.
3. Sinon → construit l'événement `SELL`, l'ajoute (`this.addEvent`), retourne
   `{ events: [event], deleteEventId: null }`.

L'ordre (chercher le same-session BUY seulement APRÈS que `resolveSell` a validé la propriété
de l'objet) empêche qu'un id de BUY arbitraire, appartenant à un autre véhicule/participant,
puisse être ciblé pour suppression.

---

## 3. Wallet — suppression du double calcul (Q&A de cadrage, revirement complet)

**Constat de départ** (revu en cours de session) : le wallet (`CampaignParticipant._wallet`)
est aujourd'hui un compteur mutable, crédité/débité par `WalletMovementEvent` (récompenses) ET
par `EquipmentChangedEvent` (achats/reventes). En parallèle, le frontend (`EquipmentManager`,
composant partagé avec la construction d'équipe) recalcule **indépendamment** le coût de
l'équipement depuis l'arbre courant, et `AtelierVehiclePage` doit **calibrer** artificiellement
le budget transmis pour que le résultat affiché coïncide avec le wallet — une troisième
implémentation locale (`AtelierVehiclePage.costOf`) recopiant la logique de coût, distincte de
la fonction déjà partagée `buildVehicleSummary` (`teams/vehicle-summary.ts:97`, déjà utilisée
par `Teams`, `TeamEditPage`, `AtelierPage`, et par `VehicleConfigurator` pour le même besoin de
calibration côté construction d'équipe).

**Preuve que le wallet actuel EST déjà, mathématiquement, `Team.remainingBudget + récompenses`**
(vérifiée algébriquement, condition : le prix résiduel du §2 est en place) :

Notons `C0` le coût de l'équipe juste après construction (au moment de `reset()`), `R` les
récompenses cumulées, `ΔC` le changement de coût dû à l'atelier. Le wallet actuel :
```
wallet = (cans − C0) + R − ΔC
```
Or `ΔC = C_maintenant − C0` par construction du prix résiduel (la baisse de coût à la revente
égale exactement le remboursement qui aurait été crédité). En substituant :
```
wallet = cans − C0 + R − (C_maintenant − C0) = cans + R − C_maintenant
       = Team.remainingBudget(maintenant) + R
```
Le `C0` s'annule complètement — `Team.remainingBudget` (`team.ts:66-68` :
`cans - Σ vehicle.cost`, DÉJÀ existant, déjà testé pour la construction d'équipe) devient la
source unique de vérité, pour les DEUX contextes.

**Décision** : abandonner le wallet comme compteur mutable pour les achats/reventes. Seules
les récompenses restent un compteur accumulé (rien dans l'arbre d'équipement ne peut les
représenter — argent versé au participant, pas lié à une pièce d'équipement).

Vérifié que `creditWallet` n'est appelé que par ces 6 sites — rien d'autre à réconcilier :
`equipment-changed.event.ts` (4×), `wallet-movement.event.ts` (2×).

### Changements (`campaign-participant.ts`)

```ts
private _rewardsEarned = 0;  // remplace _wallet — ne porte plus que les récompenses

get wallet(): number {
  return this.hasTeam ? this.team.remainingBudget + this._rewardsEarned : 0;
}

reset(): void {
  if (this._team === undefined) return;
  this._rewardsEarned = 0;  // ne référence plus team.remainingBudget — automatique via le getter
  this._championshipPoints = 0;
  this._resistancePoints = 0;
  this._team.resetCampaignState();
}

creditWallet(amount: number): void { this._rewardsEarned += amount; }  // renommage possible : creditRewards

assertCanAfford(cost: number): void {
  if (this.wallet < cost) { throw new DomainException(`Cagnotte insuffisante (${this.wallet} jerricans, coût : ${cost}).`); }
}
```

**Zéro impact API/frontend** : `WorkshopStateDto.wallet` garde exactement le même nom et la
même forme — seul son mode de calcul change, côté backend uniquement. `AtelierVehiclePage`
continue de lire `workshop.wallet` sans changement.

**Nettoyage consécutif** : `AtelierVehiclePage.costOf` (lignes 172-177) est supprimé, remplacé
par `buildVehicleSummary(x, catalog).cout` — même fonction déjà utilisée partout ailleurs.
Élimine la dernière duplication de calcul de coût côté frontend.

---

## 4. Infrastructure + Application backend

**`ICampaignRepository`** — nouvelle méthode, aussi simple qu'`appendEvents` :
```ts
deleteEvent(eventId: number): Promise<void>;
```
Implémentation TypeORM (`CampaignRepository`) : un `delete()` direct sur le repository
`GameEventOrm`. Aucune nouvelle colonne, aucun changement de schéma (`isSold` n'est jamais
stocké — recalculé à chaque replay par `execute()`, exactement comme `isLost`).

**`ChangeEquipmentUseCase`** — branchement sur le résultat de `game.changeEquipment` :
```ts
const result = game.changeEquipment(participant, cmd);
if (result.deleteEventId !== null) {
  await this.campaignRepo.deleteEvent(result.deleteEventId);
} else {
  await this.campaignRepo.appendEvents(result.events);
}
```

**`GetWorkshopUseCase`** — pour chaque arme/amélioration active de chaque véhicule :
```ts
isSold: w.isSold,
purchasedThisSession: atelierGame?.wasPurchasedThisSession(EquipmentEntityType.WEAPON, w.id) ?? false,
```
`atelierGame = campaign.findAtelierGame()`, résolu une fois en tête de méthode.
`purchasedThisSession` sert uniquement à l'affichage frontend (libellé du bouton/texte de
confirmation *avant* le clic) — la décision réelle reste prise côté serveur au moment du clic,
sans jamais faire confiance à ce qu'affichait le client.

**DTO** (`workshop-state.dto.ts`) : `WorkshopWeaponDto`/`WorkshopImprovementDto` gagnent
`isSold: boolean` et `purchasedThisSession: boolean`.

---

## 5. Table des Épaves — exclusion des objets vendus

`wreck-table.ts:88-95`, `buildEquipmentPool` — ajout de `!isSold` aux filtres déjà en place
(`!isLost` pour les armes, `!estDefaut && !isLost` pour les améliorations) :
```ts
private buildEquipmentPool(vehicle: Vehicle): NonNullable<LostEquipment>[] {
  return [
    ...vehicle.weapons.filter((w) => !w.isLost && !w.isSold).map((w) => ({ kind: 'weapon' as const, id: w.id })),
    ...vehicle.improvements
      .filter((i) => !i.estDefaut && !i.isLost && !i.isSold)
      .map((i) => ({ kind: 'improvement' as const, id: i.id })),
  ];
}
```
Sans ça, un objet vendu pourrait être tiré au sort et "arraché" une seconde fois lors d'une
future partie — incohérent (l'objet n'est plus physiquement sur le véhicule).

---

## 6. Frontend

**Modèle** (`vehicle-builder.model.ts`) — `Weapon`/`VehicleImprovement` gagnent deux champs
optionnels : `sold?: boolean`, `purchasedThisSession?: boolean`. Jamais posés par
`TeamEquipmentDataSource` (construction d'équipe) — comportement inchangé de ce côté,
confirmé : `!undefined` reste `true`, aucun filtre ne change de résultat.

**`mapWorkshopVehicleToVehicle`** (`workshop.model.ts`) — thread les deux nouveaux champs
depuis `WorkshopWeaponDto`/`WorkshopImprovementDto`.

**Slots des armes — seul point nécessitant encore un filtre explicite côté frontend** :
contrairement aux améliorations (`WorkshopImprovementDto.emplacement` déjà résolu par
instance côté backend, donc déjà auto-ajusté à 0 si `isSold`), les armes n'ont pas de champ
`emplacement` par instance dans le DTO — le frontend résout leur emplacement par recherche
catalogue (`catalog.armes.find(...)`). Deux endroits à filtrer explicitement (`.filter(w =>
!w.sold)` avant la recherche/somme) :
- `EquipmentManager.emplacementsUtilises` (boucle armes, `equipment-manager.ts` ~ligne 253).
- `buildVehicleSummary` (boucle armes, `vehicle-summary.ts:108-115`).

Le coût, lui, n'a besoin d'aucun filtre nulle part (cf. §2 — prix résiduel auto-ajustant).

**`MountedEquipment`** — troisième branche dans le template, mirroir de `estDefaut` :
```html
@if (improvement.estDefaut) { 🔒 Intégré }
@else if (improvement.sold) { <span class="me-name--sold">{{ nom }}</span> <span class="me-badge-sold">Vendue</span> }
@else { [Retirer] }
```
Nouvelle classe `.me-badge-sold`, mirroir de `.me-badge-defaut` existante
(`mounted-equipment.scss:115`), `text-decoration: line-through` sur `.me-name--sold`.

**`EquipmentManager`** — texte de la modale de confirmation (déjà construit inline dans le
template) devient conditionnel sur `purchasedThisSession` : *"Annuler l'achat de X ?"*
(remboursement intégral) vs *"Revendre X pour N jerricans (50%) ?"* — `N` calculé côté client
à titre de **prévisualisation seulement** (`Math.floor(prix/2)`), le serveur reste seul
décisionnaire au moment du clic.

---

## 7. Plan de vérification

**Backend (unitaire)** :
- `weapon.spec.ts`/`improvement.spec.ts` : `markSold`/`clearSold`, `price` résiduel
  (`ceil(X/2)`), `slots = 0` une fois vendu.
- `campaign-participant.spec.ts` : `wallet` (getter) == `team.remainingBudget +
  rewardsEarned` dans plusieurs scénarios enchaînés (achat, revente, récompense, dans
  différents ordres) — matérialise la preuve algébrique du §3.
- `equipment-changed.event.spec.ts` : `execute`/`undo` ne touchent plus le wallet ; SELL
  marque/démarque `isSold` au lieu de retirer/ajouter l'entité.
- `game.spec.ts` : `changeEquipment` — nouveau cas "annulation" (retourne `deleteEventId`,
  pas d'événement ajouté) vs "revente" (événement ajouté, coût = moitié arrondi inférieur) ;
  test exhaustif `canAccept` en ATELIER (`it.each` sur tous les types d'événements connus,
  cf. §1).
- `wreck-table.spec.ts` : un objet `isSold` n'apparaît jamais dans le pool tiré.
- `change-equipment.usecase.spec.ts` : branchement delete vs append.
- `get-workshop.usecase.spec.ts` : `purchasedThisSession` correct selon l'origine de l'objet.

**Frontend (unitaire)** : `vehicle-summary.spec.ts` (existant) étendu pour un véhicule avec
objet `sold` ; `equipment-manager.spec.ts` pour le texte de confirmation conditionnel.

**End-to-end (manuel)** : ouvrir un atelier, acheter une arme puis l'annuler dans la même
session (doit disparaître, aucune trace journal) ; sur une autre session, revendre une arme
pré-existante (doit rester affichée barrée "Vendue", cagnotte créditée de la moitié, journal
montre "Revente") ; vérifier que le budget affiché dans `EquipmentManager` correspond
exactement à la cagnotte affichée sur `AtelierPage`.
