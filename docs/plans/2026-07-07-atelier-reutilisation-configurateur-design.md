# Atelier — réutilisation du configurateur d'équipement

> Document de conception (brainstorming du 2026-07-07). Se rapporte à
> [`docs/spec/CAMPAIGN.md`](../spec/CAMPAIGN.md) (mode campagne — Atelier US-D1–D4) et à
> [`docs/spec/VEHICLES.md`](../spec/VEHICLES.md) (construction de véhicule). Prolonge
> [`2026-07-05-atelier-lifecycle-design.md`](2026-07-05-atelier-lifecycle-design.md)
> (cycle de vie `PLANIFIE → ATELIER → JOUE`).
>
> **D4/R4 (annulation d'achat ≠ revente) ont une conception détaillée et affinée dans
> [`2026-07-11-atelier-annulation-revente-design.md`](2026-07-11-atelier-annulation-revente-design.md)**
> (brainstorming du 2026-07-11) — mécanisme de suppression d'événement confirmé, plus deux
> raffinements qui n'étaient pas encore identifiés ici : le **prix résiduel** (`ceil(prix/2)`
> sur l'objet revendu, plutôt qu'une ligne à coût négatif) et la **suppression du wallet
> comme compteur mutable** (remplacé par un getter dérivé de `Team.remainingBudget` +
> récompenses, prouvé mathématiquement équivalent). **Implémenté le 2026-07-11** — cf.
> [spec/CAMPAIGN.md §Annulation d'achat vs revente](../spec/CAMPAIGN.md#annulation-dachat-vs-revente).
> Le reste de cette section D3/D4 (enforcement, gardes sponsor/8, Tourelle) reste Temps 2.

---

## Contexte

L'atelier est la phase garage post-partie du mode campagne : le joueur y dépense sa
cagnotte (`wallet`) pour acheter/revendre de l'équipement sur l'équipe qu'il a engagée
dans la campagne, échange des Chocs contre des séquelles, et gère ses véhicules mis en
épave. L'intention produit est que **l'IHM de l'atelier soit la même que celle de la
construction d'équipe** — mêmes cartes d'équipement, même budget, même gestion de la
Tourelle — avec quelques éléments en plus propres à la campagne.

Le problème : derrière une IHM quasi identique, les deux back sont **radicalement
différents**.

| | Construction d'équipe (`team/`) | Atelier (`campaign/`) |
|---|---|---|
| Nature | CRUD brut : création/suppression d'entités persistées | Event-sourcing : journal d'événements rejoué |
| Budget | `team.cans` moins la somme des coûts véhicules (`remainingBudget`) | `participant.wallet` (accumulé par replay, part de `team.cans`) |
| Entités | `Vehicle`/`Weapon`/`Improvement` persistés (id positif) | mêmes objets domaine, mais entités transientes recréées à chaque replay (`id = -event.id`) |
| État en plus | — | Chocs, séquelles, `isLost` (épaves) |

Objectif de la session : concevoir une solution qui **ne duplique pas** le code, en
particulier (a) le composant front de gestion d'équipement et (b) les règles métier
« tel équipement est-il accessible sur ce véhicule ».

---

## État des lieux (exploration du code)

### Le back : les règles sont déjà réutilisables

Découverte clé : les règles de disponibilité vivent **déjà sur `Vehicle`**, pas sur
`Team`.

- `Vehicle.canAddWeapon(type, orientation, remainingBudget)` /
  `canAddImprovement(...)` / `cost` / `usedSlots`
  ([`team/domain/vehicle.ts`](../../apps/backend/src/app/team/domain/vehicle.ts))
  prennent le budget restant en **paramètre scalaire** — elles ne référencent jamais
  `Team`. C'est la logique « tell, don't ask » documentée dans la classe.
- Elles gèrent déjà l'état campagne : `canAddWeapon`/`canAddImprovement`
  court-circuitent avec `fail('Ce véhicule est hors combat')` quand `isLost`.
- Le replay campagne reconstruit **les mêmes** objets `Vehicle`/`Team` (entités
  transientes incluses), qui portent déjà `isLost`, `chocs`, `sequellas`.

Le calcul des verdicts HTTP côté équipe
([`get-available-weapons.usecase.ts`](../../apps/backend/src/app/team/application/get-available-weapons.usecase.ts)
et son pendant améliorations) n'a que **deux points d'ancrage** au monde équipe, et
aucun dans les règles elles-mêmes :

1. la source de budget (`team.remainingBudget`) ;
2. la liste de candidats scopée sponsor (`getWeaponTypesForSponsor(team.sponsor)`).

Côté campagne, l'équivalent existe déjà : `participant.wallet` pour le budget, et
`team.sponsor` reste intact après `attachTeam`. **La réutilisation est donc à faible
coût.**

### Deux lacunes back de l'atelier actuel

1. **Aucun endpoint de verdict de disponibilité** pour un véhicule de campagne. Le
   contrôleur campagne n'expose que `GET .../workshop` (état brut) et
   `POST .../events/equipment` (achat/revente inconditionnel). L'IHM n'a aucun « est-ce
   achetable » côté serveur.
2. **Le chemin d'écriture ne vérifie que la cagnotte.** `Campaign.changeEquipment`
   ([`campaign/domain/campaign.ts:495`](../../apps/backend/src/app/campaign/domain/campaign.ts))
   calcule un coût, appelle `me.assertCanAfford(cost)` sur un BUY, et rien d'autre : ni
   emplacements, ni orientation, ni sponsor, ni placement. Les règles `canAdd*` ne sont
   jamais invoquées sur le chemin campagne.

Deux limites de modèle à combler pour atteindre la parité IHM :

- `WorkshopVehicleDto`
  ([`workshop-state.dto.ts`](../../apps/backend/src/app/campaign/dto/workshop-state.dto.ts))
  **n'a pas d'`improvements`** — or le builder gère armes *et* améliorations.
- `EquipmentChangedEvent`
  ([`equipment-changed.event.ts`](../../apps/backend/src/app/campaign/domain/events/equipment-changed.event.ts))
  ne connaît que `entityType: 'VEHICLE' | 'WEAPON'` — pas `IMPROVEMENT`.

### Le front : couplage concentré dans `EquipmentManager`

Le composant réutilisable
([`equipment-manager.ts`](../../apps/frontend/src/app/teams/vehicle-configurator/equipment-manager/equipment-manager.ts))
porte trois natures de logique :

- **Vue pure** (agnostique du back) : `emplacementsUtilises`, `coutBase`/`coutEquipement`/
  `coutTotal`, `chosenVehicule` — ne dépendent que de `vehicle()` + `sponsorCatalog()`.
- **Cluster budget** (couplé équipe) : `budgetEquipe = team().cans`,
  `coutAutresVehicules` via `getAllForTeam`, `budgetRestant`, `armesPourTourelle`.
- **Orchestration** (couplée HTTP) : `inject(VehicleService)`, l'`effect()` de
  rechargement des équipements disponibles à chaque changement de `vehicle()`, les
  handlers add/remove/tourelle, le `reloadVehicle()` après un 204.

Les enfants dumb (`EquipmentOption`, `MountedEquipment`, `VehicleCostSummary`,
`TourelleAssignmentModal`, `EquipmentDetailModal`, `ConfirmModal`, `TeamBudget`) ne
portent **aucune** connaissance du back : réutilisables tels quels.

Le contrat de verdict est un point de vigilance : `disponible` (booléen) + `raison`
(texte), et le front distingue « orientation manquante » d'un « refus définitif » par
`raison?.startsWith('Une orientation est requise')`. Ce contrat doit être **préservé
verbatim** côté atelier.

---

## Découpage en deux temps (périmètre)

Le travail est scindé pour livrer d'abord la **réutilisation** (l'objectif de la session)
sans se disperser dans les fonctionnalités atelier nouvelles.

- **Temps 1 — réutilisation + atelier fonctionnel** (le plan associé) : l'abstraction
  front (D1 / F1–F6), les endpoints de verdict read (R1), l'enrichissement du workshop
  DTO (R2), l'**extension du buy/sell à `IMPROVEMENT`** (R3a) pour gérer les améliorations
  comme les armes, et une page atelier qui réutilise `EquipmentManager` en s'appuyant sur
  l'endpoint `POST .../events/equipment`. Résultat : l'atelier ressemble et se comporte
  comme le builder pour l'achat/retrait d'armes, véhicules **et améliorations**.
- **Temps 2 — fonctionnalités atelier** (décisions D2, D3, D4 + tâche R3b ci-dessous,
  **différées, documentées ici pour ne pas les perdre**) : enforcement des règles au
  write (D2), extras revente-moitié / Chocs & séquelles / véhicules perdus / gardes
  sponsor+8 (D3), annulation d'achat ≠ revente (D4).

**Limitations connues et assumées du Temps 1** (toutes levées au Temps 2) :

- Les achats ne sont **pas** gardés (slots/orientation/sponsor/limite 8) au write — le
  verdict read (R1) est affiché mais non enforce (état actuel du domaine, cf. D2). Vaut
  pour armes **et** améliorations.
- Le retrait d'un équipement crédite le **prix plein** via l'endpoint SELL existant
  (bug connu p.170), sans distinction annulation/revente (cf. D4).
- **Tourelle en atelier** : l'amélioration Tourelle (prix variable ×3 + assignation d'une
  arme) n'a pas d'événement dédié côté campagne. Point à trancher (cf. « à trancher à
  l'implémentation ») — vraisemblablement exclue des améliorations achetables au Temps 1.
- Chocs, séquelles et véhicules perdus sont hors périmètre visuel du Temps 1 (cf. D3).

---

## Décisions retenues

### D1 — Front : abstraire la source de données (Dependency Inversion) — **Temps 1**

Trois options ont été comparées.

| Option | Duplication comportement | Composant smart unique | Coût de mise en place |
|---|---|---|---|
| **1. Abstraire la source** (retenue) | ~zéro | Oui — un seul `EquipmentManager` | Concevoir l'interface + budget input |
| 2. Descendre le HTTP dans les parents | Moyenne (orchestration dupliquée dans 2 parents) | Non | Refactor lourd du contrat, contrat input/output bavard |
| 3. Dupliquer l'orchestrateur | Élevée (~200 lignes ×2, dérive possible) | Non | Le plus rapide à écrire |

**Justification.** La demande explicite était « pas de duplication front ». L'option 1
l'optimise directement : `EquipmentManager` reste **un seul** composant smart, mais
injecte une abstraction `EquipmentDataSource` derrière un token DI au lieu de
`VehicleService` en dur. Deux implémentations fournissent le même contrat, l'une parle
aux routes équipe, l'autre aux routes campagne, et **chaque route fournit la bonne** via
`providers`. C'est le miroir front exact du Dependency Inversion déjà en place au back
(`ITeamRepository`/`ICatalogRepository` + tokens string) — cohérent avec l'esprit du
projet. Les options 2 et 3 réintroduisent toutes deux de la duplication (l'orchestration,
qui vit aujourd'hui dans `EquipmentManager`, se retrouve soit remontée dans deux parents,
soit copiée dans un composant frère).

### D2 — Back : appliquer toutes les règles au chemin d'écriture — ⚠️ **Temps 2 (différé)**

`Campaign.changeEquipment` appellera les mêmes `canAddWeapon`/`canAddImprovement` que
l'équipe. **Justification.** Sans cela, le verdict de disponibilité affiché côté front
resterait cosmétique : un achat illégal (emplacements dépassés, mauvaise orientation,
sponsor non autorisé) passerait toujours par appel API direct. Enforcer au write rend le
domaine cohérent avec le back équipe et comble les gardes manquantes signalées dans la
spec.

### D3 — Fonctionnalités atelier spécifiques — 🟡 partiellement implémenté

**Revente à moitié prix** (arrondie inférieur, p.170) est **implémentée** (2026-07-11,
fusionnée avec D4 ci-dessous). Restent Temps 2 : **Chocs & séquelles** (affichage +
échange Chocs→séquelle, endpoint `/events/sequella` déjà existant) · **véhicules
perdus** (affichage/gestion des `isLost`) · **gardes sponsor + limite 8 véhicules**
(absentes aujourd'hui).

### D4 — Annulation d'achat ≠ revente — ✅ implémenté (2026-07-11)

> Conception complète, vérifiée dans le code (pas seulement supposée) et affinée :
> [`2026-07-11-atelier-annulation-revente-design.md`](2026-07-11-atelier-annulation-revente-design.md).
> Le principe ci-dessous (suppression d'événement vs `SELL`) reste correct — le nouveau
> document ajoute l'invariant vérifié qui rend la suppression sûre, le prix résiduel
> (`ceil(prix/2)`) plutôt qu'un coût négatif, et la suppression du wallet comme compteur
> mutable séparé. **Implémenté le 2026-07-11** — cf.
> [spec/CAMPAIGN.md §Annulation d'achat vs revente](../spec/CAMPAIGN.md#annulation-dachat-vs-revente).

Raffinement métier clé, apporté pendant la session. Retirer un équipement, ce sont **deux
opérations distinctes** selon son origine :

- **Acheté dans l'atelier en cours** — son `EquipmentChangedEvent` BUY est dans le journal
  de la partie actuellement en `ATELIER`, entité transiente `id = -event.id`. Retrait →
  **suppression de l'événement d'achat** : remboursement **plein**, aucune trace au
  journal, no-op net.
- **Pré-existant** — véhicule/arme persisté de la construction d'équipe (id positif), *ou*
  acheté lors d'un atelier antérieur déjà figé `JOUE`. Retrait → **événement `SELL`** :
  remboursement **moitié arrondie inférieur**, tracé au journal.

**Justification et élégance.** Le critère de décision est entièrement contenu dans le
journal : *le BUY est-il dans la partie atelier ouverte ?* Oui → annulation ; non (figé,
ou pas de BUY du tout) → revente. La décision est 100 % côté serveur : le front appelle un
simple `removeWeapon(id)`, le contrat `EquipmentDataSource` ne change pas. Cela colle
parfaitement au modèle event-sourcing où la partie atelier ouverte n'est pas encore figée,
donc ses événements peuvent être supprimés sans compensation.

---

## Conception détaillée

### Backend (`apps/backend/src/app/campaign/`)

**R1 — Endpoints de verdict (read).** Deux use cases calqués sur les use cases équipe,
réutilisant `Vehicle.canAddWeapon`/`canAddImprovement` et les DTO
`AvailableWeaponDto`/`AvailableImprovementDto` **verbatim** :
`GetWorkshopAvailableWeaponsUseCase` / `GetWorkshopAvailableImprovementsUseCase`.
Différences : obtenir le véhicule via `loadAndReplay(campaignId)` → `assertParticipant`
→ `me.team.findVehicle(vId)` ; passer `me.wallet` comme budget ; sponsor via
`me.team.sponsor` (inchangé). Préserver le contrat `disponible` + `raison` (préfixe
`"Une orientation est requise"`).
Routes : `GET /api/campaigns/:id/workshop/vehicles/:vId/available-weapons` et
`.../available-improvements`.

**R2 — DTO atelier enrichi.** Ajouter `improvements[]` à `WorkshopVehicleDto` (champs
utiles : `id`, `nomInterne`, `orientation`, `prix`, `estDefaut`, `isLost`) et l'alimenter
dans `GetWorkshopUseCase` depuis `v.improvements`.

**R3a — Write : support des améliorations. ✅ Temps 1.** Dans `Campaign.changeEquipment` :
- étendre `EquipmentEntityType` à `IMPROVEMENT` (+ `execute`/`undo` d'`EquipmentChangedEvent`,
  via de nouvelles méthodes `team.addCampaignImprovement`/`removeCampaignImprovement` sur le
  modèle d'`addCampaignVehicle`/`addCampaignWeapon`) ;
- calcul du coût d'une amélioration depuis le catalogue (`ImprovementType.price`), avec
  gestion du prix variable Tourelle (`"x3"`) — **sauf si la Tourelle est exclue au Temps 1**,
  cf. limitation ci-dessus ;
- **pas d'enforcement** au Temps 1 : comme pour les armes, seule la cagnotte est vérifiée
  (`me.assertCanAfford`). Cohérence armes/améliorations. L'enforcement est R3b (Temps 2).
- Le skill `ddd` doit être invoqué **avant** cette partie (nouvelle capacité de domaine sur
  `changeEquipment` + méthodes d'agrégat), conformément au processus projet.

**R3b — Write : enforcement + gardes + revente. ⚠️ Temps 2 (différé).** Dans
`Campaign.changeEquipment` :
- enforcer les règles avant `game.addEvent` : pour un BUY WEAPON/IMPROVEMENT, résoudre le
  véhicule cible et appeler `canAddWeapon(wt, orientation, me.wallet)` /
  `canAddImprovement(...)` → `DomainException` si `!ok` (couvre emplacements + orientation ;
  mappé en `BadRequestException`) ;
- garde sponsor à l'achat (le `nomInterne` doit être dans le catalogue du sponsor) ;
- limite 8 véhicules (refuser un BUY VEHICLE si `me.team.vehicles.length >= 8`) ;
- revente : `SELL` crédite `Math.floor(price / 2)` — ✅ implémenté (2026-07-11, cf. R4).
  Le reste de R3b (enforcement, garde sponsor, limite 8 véhicules) reste Temps 2.

**R4 — Annulation d'achat (suppression d'événement). ✅ Implémenté (2026-07-11) — conception
détaillée dans [`2026-07-11-atelier-annulation-revente-design.md`](2026-07-11-atelier-annulation-revente-design.md).**
- L'entité transiente a `id = -event.id` ; retrouver l'événement BUY et son `gameId`.
- Si `gameId === partie ATELIER ouverte` → l'agrégat signale une **suppression**
  (résultat discriminé, ex. `{ deleteEventId }`), le use case appelle une **nouvelle
  méthode repo** `CampaignRepository.deleteEvent(eventId)` (aujourd'hui seul
  `appendEvents` existe).
- Sinon (persisté, ou BUY figé) → événement `SELL` moitié prix — voir le nouveau document
  pour le mécanisme de **prix résiduel** (`ceil(prix/2)`, pas une ligne à coût négatif) qui
  rend ce remboursement cohérent avec `Vehicle.cost`/`buildVehicleSummary` sans filtre
  supplémentaire.
- **Caveat cascade (toujours ouvert)** : supprimer un BUY VEHICLE de la session doit aussi
  retirer les BUY WEAPON/IMPROVEMENT de la session pointant sur `targetVehicleId =
  -buyEventId` (sinon événements orphelins). Le document du 2026-07-11 **ne couvre pas ce
  cas** — son mécanisme est volontairement scopé aux armes/améliorations (`VEHICLE` non
  exposé en atelier à ce jour), précisément pour s'appuyer sur un invariant vérifié qui ne
  tiendrait plus si un événement pouvait référencer un véhicule transient. Ce caveat reste
  donc à trancher **si/quand** l'achat de véhicule est un jour exposé en atelier. Option la
  plus simple, toujours valable : refuser le retrait tant que le véhicule transient porte de
  l'équipement acheté cette session, avec message explicite.

### Frontend (`apps/frontend/src/app/teams/vehicle-configurator/`)

**F1 — Interface + token.** Nouveau `equipment-data-source.ts` extrayant de
`VehicleService` les méthodes appelées par `EquipmentManager` :

```ts
export interface EquipmentDataSource {
  getAvailableWeapons(vehicleId): Observable<AvailableWeaponDto[]>;
  getAvailableImprovements(vehicleId): Observable<AvailableImprovementDto[]>;
  addWeapon(vehicleId, choice): Observable<Vehicle>;
  addImprovement(vehicleId, choice): Observable<Vehicle>;
  removeWeapon(weaponId): Observable<Vehicle>;          // ← renvoie Vehicle (F4)
  removeImprovement(vehicleId, improvementId): Observable<Vehicle>;
  assignWeaponToTourelle(...): Observable<Vehicle>;
  unassignWeaponFromTourelle(...): Observable<Vehicle>;
}
export const EQUIPMENT_DATA_SOURCE = new InjectionToken<EquipmentDataSource>('EquipmentDataSource');
```

**F2 — Deux implémentations.** `TeamEquipmentDataSource` enrobe le `VehicleService`
existant (délégation pure) ; `AtelierEquipmentDataSource` cible les routes campagne
(`/workshop/vehicles/:vId/available-*`, `POST /events/equipment` pour BUY/SELL/retrait),
`campaignId` fourni par le contexte de route.

**F3 — Budget en input.** Remplacer le cluster couplé équipe par un `input` :

```ts
budget = input.required<BudgetView>();  // { total: number; usedByOthers: number }
budgetRestant = computed(() => this.budget().total - this.budget().usedByOthers - this.coutTotal());
```

Parent équipe : `{ total: team.cans, usedByOthers: coûtAutresVéhicules }`.
Parent atelier : `{ total: wallet, usedByOthers: coûtAutresVéhiculesCampagne }` (depuis
`GET /workshop`). Les computed slots/coûts restent inchangés.

**F4 — Découpler le reload.** Faire renvoyer le `Vehicle` mis à jour par
`removeWeapon`/`removeImprovement` (aujourd'hui 204 → `reloadVehicle()` via
`getAllForTeam`, couplage équipe). Supprime `getAllForTeam` d'`EquipmentManager`.

**F5 — Injection.** `EquipmentManager` fait `inject(EQUIPMENT_DATA_SOURCE)` au lieu de
`inject(VehicleService)`. Enfants dumb inchangés.

**F6 — Câblage par route + page atelier.** Route équipe : `providers: [{ provide:
EQUIPMENT_DATA_SOURCE, useClass: TeamEquipmentDataSource }]`. Nouvelle route atelier (ex.
`campaigns/:id/atelier`) : `providers: [{ ..., useClass: AtelierEquipmentDataSource }]` +
un smart parent `AtelierPage` qui charge `GET /workshop`, mappe la cagnotte en
`BudgetView`, itère les véhicules et réutilise `EquipmentManager` par véhicule. **Temps 1**
: affichage du solde de cagnotte + achat/retrait d'armes et véhicules via l'endpoint
existant. **Temps 2** : les extras (D3) — Chocs/séquelles par véhicule, véhicules perdus,
action « revente » distincte de l'annulation. Route lazy dans
[`app.routes.ts`](../../apps/frontend/src/app/app.routes.ts) + lien depuis `GameList`
(bouton « Atelier » pour une partie en `ATELIER`).

Le miroir DTO front (`vehicle-builder.model.ts`, modèle workshop) reste tenu à jour
manuellement (discipline existante, pas de code partagé front/back).

---

## Phasage

### Temps 1 — réutilisation + atelier fonctionnel (le plan associé)

1. **Back** (R1, R2, R3a) — verdicts atelier (armes + améliorations) + `improvements` au
   workshop DTO + extension buy/sell à `IMPROVEMENT` (permissif, cagnotte seule).
   ⚠️ Skill `ddd` avant R3a. Testable à l'API sans toucher au front.
2. **Front refactor** (F1–F5) — extraire l'abstraction, brancher l'équipe sur
   `TeamEquipmentDataSource`, budget en input. **Non-régression équipe d'abord.**
3. **Front atelier** (F6) — `AtelierEquipmentDataSource` (sur l'endpoint buy/sell
   existant), `AtelierPage`, route + lien depuis `GameList`. Achat/retrait d'armes,
   véhicules et améliorations ; extras hors périmètre.

### Temps 2 — fonctionnalités atelier (différé, documenté ci-dessus)

4. **Back write** (D2 / R3b) — enforcement des règles dans `changeEquipment` (emplacements/
   orientation/sponsor), gardes sponsor + limite 8. La revente `floor(prix/2)` elle-même
   est faite (point 5).
5. **Annulation d'achat** (D4 / R4) — ✅ **fait (2026-07-11)** : distinction suppression
   d'événement vs revente à moitié prix, cf.
   [spec/CAMPAIGN.md §Annulation d'achat vs revente](../spec/CAMPAIGN.md#annulation-dachat-vs-revente).
6. **Front extras** (D3) — Chocs/séquelles, véhicules perdus. L'action revente/annulation
   elle-même est déjà en place (point 5) — restent les autres extras de cette section.

## Ce qui reste à trancher à l'implémentation

- **Tourelle en atelier (Temps 1)** : l'amélioration Tourelle (prix variable ×3 +
  assignation d'arme, flux `assignWeaponToTourelle`) n'a pas d'événement campagne dédié.
  Option recommandée Temps 1 : l'exclure des améliorations achetables (la garder hors de
  la liste R1 des améliorations disponibles en atelier), la traiter avec les extras Temps 2.
- **Cascade d'annulation** (R4 caveat, Temps 2) : suppression de la grappe vs refus tant
  que le véhicule transient porte de l'équipement acheté cette session.
- **Séquelles dans les règles** (Temps 2) : aucune règle actuelle ne gate un achat sur les
  Chocs — net-neuf sans point d'ancrage existant, hors périmètre sauf décision contraire.
- Invoquer le skill `ddd` **avant R3a (Temps 1)** et **avant le Temps 2** (R3b/R4 :
  enforcement, résultat discriminé annulation-vs-revente), conformément au processus projet.

## Vérification (au moment de l'implémentation)

**Temps 1 :**
- **Back unitaires** (Vitest) : use cases de verdict (dispo/indispo selon wallet, slots,
  orientation, sponsor) ; `GetWorkshopUseCase` expose bien `improvements` ;
  `changeEquipment` BUY/SELL `IMPROVEMENT` mute l'agrégat (`addCampaignImprovement`/
  `removeCampaignImprovement`) et débite/crédite la cagnotte.
- **Front unitaires** (Vitest) : `EquipmentManager` piloté par un `EquipmentDataSource`
  mock + `BudgetView` ; `budgetRestant`, `visibleWeapons`/`visibleImprovements`, flux
  add/remove ; `TeamEquipmentDataSource` délègue au `VehicleService`.
- **E2E / `verify`** : (a) construction d'équipe **inchangée** (non-régression, priorité) ;
  (b) atelier — achat/retrait d'une arme **et d'une amélioration** via l'endpoint existant,
  solde de cagnotte à jour via `GET /workshop`.

**Temps 2** (au moment venu) : `changeEquipment` — BUY illégal rejeté (D2/R3b), SELL =
`floor(prix/2)`, annulation en atelier ouvert supprime l'événement + rembourse plein,
retrait hors-session = SELL moitié (D4).
- Commandes : `npx nx test backend` / `npx nx test frontend` (**npm/npx, jamais pnpm**).
