# Design - Avantages de véhicule

> Document de conception (brainstorming du 2026-07-12). Se rapporte à
> [`docs/spec/VEHICLES.md`](../spec/VEHICLES.md) (catalogue, construction de véhicule,
> règles métier) et à [`docs/spec/CAMPAIGN.md`](../spec/CAMPAIGN.md) (mode campagne -
> Atelier, annulation d'achat vs revente). Réutilise le pattern Decorator décrit dans
> [`2026-06-27-team-ddd-design.md`](2026-06-27-team-ddd-design.md) et le mécanisme de
> revente/`isSold` de [`2026-07-11-atelier-annulation-revente-design.md`](2026-07-11-atelier-annulation-revente-design.md).
>
> **Non encore implémenté** au moment de la rédaction - ce document capture la conception
> validée en session de brainstorming, à réaliser dans les phases décrites au §8.

---

## Contexte

L'extension de règles Gaslands introduit une nouvelle catégorie d'équipement achetable
par véhicule : les **Avantages**. Ils représentent les compétences et l'expérience des
membres d'équipage. 72 avantages au total, répartis en **12 catégories de style**
(Agression, Audace, Dur à Cuire, Horreur, Mécanique, Militaire, Optimisation, Poursuite,
Précision, Rapidité, Technologie, Trompe-la-Mort - 6 avantages par catégorie).

Règles du livre :
- Un véhicule ne peut acheter des avantages que **dans les catégories définies par son
  sponsor**. Chaque sponsor donne accès à exactement **2 catégories**.
- **Pas de limite** au nombre d'avantages qu'un véhicule peut avoir.
- Chaque avantage ne peut être acheté **qu'une seule fois par véhicule**.
- Les avantages n'occupent aucun emplacement et ne demandent jamais d'orientation.

**Découverte centrale en explorant le code** : le lien sponsor→catégories **existe déjà**
dans [`database_init/data/sponsors.yml`](../../database_init/data/sponsors.yml) via le
champ `classes_avantage: string[2]` de chaque sponsor (ex. Rutherford →
`["Dur à Cuire", "Militaire"]`). Ce champ n'est aujourd'hui utilisé que comme badges
d'affichage dans le carousel de sélection sponsor (`SponsorCarousel`). Les 12 valeurs
distinctes qui y apparaissent correspondent exactement aux 12 catégories du livre. Aucune
modification de `sponsors.yml` n'est donc nécessaire : chaque avantage du catalogue portera
un simple champ `categorie`, et l'éligibilité d'un avantage pour un sponsor sera
**dérivée** (`avantage.categorie ∈ sponsor.classes_avantage`) plutôt que déclarée item par
item. Ce choix élimine le risque de lien mal construit (pas de 13 listes `sponsors_autorises`
à maintenir sur 72 items) : le lien passe par un seul champ texte à faire correspondre à
une liste déjà en place et déjà correcte.

Les avantages doivent être gérables **à la construction initiale d'un véhicule** (module
`team/`) **et dans l'atelier** du mode campagne (module `campaign/`, event-sourcing). Ils se
comportent comme des améliorations (mêmes mécanismes d'achat/retrait), à **une exception
près** : en atelier, revendre un avantage fait **perdre la totalité de son prix** (aucun
remboursement), là où une arme/amélioration revendue rembourse la moitié du prix (arrondi
inférieur, p.170).

---

## Décisions actées (Q&A de cadrage, 2026-07-12)

1. **Emplacements** : un avantage n'occupe jamais de slot (`emplacement` = 0 partout), pas
   de plafond d'emplacements. Seule limite : **unicité** - un même avantage ne peut être
   acheté qu'une fois par véhicule.
2. **Orientation** : jamais requise pour un avantage.
3. **UI de revente** : un avantage revendu reste **visible** sur la fiche du véhicule
   (barré, badge "Vendu"), comme une arme/amélioration - seul le montant récupéré diffère
   (0 au lieu de la moitié).
4. **Portée des règles** : 69 des 72 avantages sont **purement descriptifs** (texte affiché,
   aucune simulation de partie - l'app gère la construction d'équipe, pas le jeu). 3
   exceptions ont un comportement mécanique réel :
   - **Expertise** (Précision, 3 jerricans) : +1 à la Valeur de Manœuvrabilité, en
     permanence.
   - **Cascadeur** (Audace, 7) : réservé aux véhicules de Poids **Léger ou Moyen** (pas
     Lourd) dont la Manœuvrabilité **effective** (après bonus d'autres améliorations/avantages
     déjà montés) est **≥ 3**.
   - **Sur Deux Roues** (Optimisation, 6) : Manœuvrabilité **effective ≥ 3** (pas de
     restriction de poids).
5. **Manœuvrabilité effective** pour Cascadeur/Sur Deux Roues : on teste la valeur **après
   bonus** des éléments déjà montés (ex. Chenilles +1, Expertise +1), pas la valeur
   catalogue brute. Un véhicule à manœuvrabilité 2 + Chenilles (+1) devient donc éligible.
6. **Réutilisation du pattern Decorator existant** (`VehicleBuild`) plutôt qu'une chaîne
   séparée pour les avantages (cf. §2, alternatives écartées).
7. **Portée atelier** : les avantages suivent **le même périmètre que l'existant** - IHM
   grise correctement les options indisponibles (verdict complet via `canAddAdvantage`),
   mais pas de revalidation serveur à l'écriture au-delà du budget (cf. §6).
8. **Routes HTTP** : mirroir des routes **Amélioration** (imbriquées sous `VehicleController`),
   pas des routes Arme (cf. §4, alternatives écartées).

Convention de nommage : catalogue `Avantage` (interface française, miroir d'`Amelioration`) ;
domaine `Advantage`/`AdvantageType` (anglais, miroir de `Improvement`/`ImprovementType`) ;
fichier catalogue `database_init/data/avantage.yml` (miroir de `amelioration.yml`).

Convention `description`/`regles` (confirmée sur l'exemple "Arceaux" d'`amelioration.yml`) :
`description` = courte synthèse d'une phrase (style carte d'équipement) ; `regles` = texte
complet de la règle tel que fourni par le PDF (liste Markdown). Ne pas dupliquer le texte
intégral dans `description`.

---

## 1. Catalogue YAML + résolution sponsor par catégorie

**Nouveau fichier** `database_init/data/avantage.yml`, racine `avantages:`, 72 entrées :

```yaml
avantages:
  - nom: "Expertise"
    nom_interne: "expertise"
    categorie: "Précision"
    prix: 3
    comportement: "expertise"     # seulement pour les 3 avantages à effet mécanique
    description: |
      Le pilote pousse la manœuvrabilité du véhicule au-delà de ses limites.
    regles: |
      - Ce véhicule ajoute 1 à sa Valeur de Manœuvrabilité.

  # 69 autres entrées : pas de champ `comportement`
  - nom: "Abordage"
    nom_interne: "abordage"
    categorie: "Agression"
    prix: 2
    description: |
      ...
    regles: |
      - ...
```

Champs : `nom`, `nom_interne` (snake_case ascii, stable), `categorie` (une des 12 valeurs
déjà présentes dans `sponsors.yml`), `prix`, `description`, `regles`, `comportement?`
(présent uniquement pour `expertise`/`cascadeur`/`sur_deux_roues`). **Pas** de champ
`emplacement`, `necessite_orientation`, ni `sponsors_autorises` (résolution par catégorie,
cf. ci-dessous).

**Interfaces backend** ([catalog.interfaces.ts](../../apps/backend/src/app/catalog/catalog.interfaces.ts)) :

```ts
export interface Avantage {
  nom: string;
  nom_interne: string;
  categorie: string;
  prix: number;
  description: string;
  regles: string;
  comportement?: string; // 'expertise' | 'cascadeur' | 'sur_deux_roues' | undefined
}

export interface Sponsor extends RawSponsor {
  vehicules: Vehicule[];
  armes: Arme[];
  ameliorations: Amelioration[];
  avantages: Avantage[]; // NOUVEAU
}
```

**`CatalogService`** ([catalog.service.ts](../../apps/backend/src/app/catalog/catalog.service.ts)) :
charger `avantage.yml` au démarrage, convertir `description`/`regles` en HTML (même boucle
`toHtml` que les autres catalogues). Résolution sponsor **différente** des autres
catalogues - par catégorie, pas par `sponsors_autorises` :

```ts
avantages: this.allAvantages.filter((a) => raw.classes_avantage.includes(a.categorie)),
```

Nouvelles méthodes : `getAllAvantages()`, `getAvantageByNomInterne(nomInterne)`.
`ICatalogRepository` ([catalog.repository.interface.ts](../../apps/backend/src/app/team/domain/catalog.repository.interface.ts))
gagne `getAdvantageType(nomInterne)` et `getAdvantageTypesForSponsor(sponsorNom)`,
implémentés par `CatalogAdapter` (délégation pure, miroir des méthodes Improvement).

**Endpoint public** : `GET /api/catalog/avantages`
([catalog.controller.ts](../../apps/backend/src/app/catalog/catalog.controller.ts)),
miroir de `getAllAmeliorations()`.

---

## 2. Domaine (Advantage, AdvantageType, décorateurs, buildChain unifiée)

### `AdvantageType` (Value Object)

Miroir d'`ImprovementType` : wrappe le `Avantage` brut, expose `nomInterne`, `nom`,
`categorie`, `description`, `regles`, `comportement`, `price`, `equals()`, `toRaw()`. Pas
de `slots` ni `requiresOrientation` significatifs (un avantage vaut toujours 0 slot et
jamais d'orientation).

### `Advantage` (entité enfant de Vehicle)

```ts
export class Advantage {
  private _isSold = false;
  constructor(readonly id: number, readonly type: AdvantageType) {}

  /** Jamais réduit, même vendu - c'est le mécanisme "perte totale" (cf. §3). */
  get price(): number { return this.type.price; }

  /** Toujours 0 - un avantage n'occupe jamais d'emplacement. */
  get slots(): number { return 0; }

  get isSold(): boolean { return this._isSold; }
  markSold(): void { this._isSold = true; }
  clearSold(): void { this._isSold = false; }
  clearCampaignState(): void { this._isSold = false; }
}
```

Pas de champ `orientation` (jamais orienté), pas de champ `estDefaut` (aucun véhicule du
catalogue n'a d'avantage intégré à son profil de base).

### Décorateurs - réutilisation de `VehicleBuild`

Le pattern Decorator existant (`vehicle-build.ts`, `ImprovementDecorator`) calcule déjà les
stats effectives d'un véhicule couche par couche (Chenilles : +1 manœuvrabilité, -1 vitesse ;
Blindage : +2 carrosserie), via une chaîne pliée par `Vehicle.buildChain()`. Précédent
direct : `sequella-decorators.ts` étend déjà `ImprovementDecorator` en construisant un objet
`Amelioration` **factice** dans son constructeur, pour un concept qui n'existe pas dans
`amelioration.yml` (les séquelles de campagne). Les avantages reprennent exactement ce
schéma.

**Nouveau fichier** `advantage-decorators.ts` (classe abstraite + décorateurs concrets dans
le même fichier, pour éviter tout import circulaire avec la factory) :

```ts
abstract class AdvantageDecorator extends ImprovementDecorator {
  constructor(inner: VehicleBuild, avantage: Avantage, instance: InstalledImprovement) {
    const amelioration: Amelioration = {
      nom: avantage.nom, nom_interne: avantage.nom_interne, prix: avantage.prix,
      emplacement: 0, description: avantage.description, regles: avantage.regles,
      sponsors_autorises: [], necessite_orientation: false,
    };
    super(inner, amelioration, instance);
  }
  // PAS d'override de validate() (contrairement à SequellaDecorator) : le contrôle
  // générique d'emplacements de ImprovementDecorator reste actif, mais toujours
  // trivialement vrai puisque emplacement = 0. On garde donc validateSelf() opérationnel
  // pour Cascadeur/Sur Deux Roues.
}

export class NeutralAdvantageDecorator extends AdvantageDecorator {} // 69 avantages sans effet

export class ExpertiseDecorator extends AdvantageDecorator {
  override get stats(): VehicleStats {
    return { ...this.inner.stats, manoeuvrabilite: this.inner.stats.manoeuvrabilite + 1 };
  }
}

export class CascadeurDecorator extends AdvantageDecorator {
  protected override validateSelf(): RuleResult {
    if (this.baseStats.poids === 'Lourd') {
      return fail('Cascadeur est réservé aux véhicules de Poids Léger ou Moyen');
    }
    if (this.stats.manoeuvrabilite < 3) {
      return fail("Cascadeur nécessite une Manœuvrabilité effective d'au moins 3");
    }
    return ok();
  }
}

export class SurDeuxRouesDecorator extends AdvantageDecorator {
  protected override validateSelf(): RuleResult {
    if (this.stats.manoeuvrabilite < 3) {
      return fail("Sur Deux Roues nécessite une Manœuvrabilité effective d'au moins 3");
    }
    return ok();
  }
}
```

Point clé : `Cascadeur`/`SurDeuxRoues` lisent `this.stats.manoeuvrabilite` (valeur
**effective** accumulée par toute la chaîne du dessous), pas `this.baseStats` - c'est ce qui
fait qu'ils "voient" le bonus d'Expertise ou de Chenilles déjà montés (décision 5).

**Fabrique** `advantage-decorator.factory.ts`, miroir d'`ImprovementDecoratorFactory` :

```ts
export class AdvantageDecoratorFactory {
  static readonly REGISTRE: Record<string, AdvantageDecoratorCtor> = {
    expertise: ExpertiseDecorator,
    cascadeur: CascadeurDecorator,
    sur_deux_roues: SurDeuxRouesDecorator,
  };
  static wrap(inner: VehicleBuild, avantage: Avantage, instance: InstalledImprovement): VehicleBuild {
    const D = AdvantageDecoratorFactory.REGISTRE[avantage.comportement ?? ''] ?? NeutralAdvantageDecorator;
    return new D(inner, avantage, instance);
  }
}
```

`AdvantageDecoratorCtor` est un type constructeur dédié (signature `Avantage`, pas
`Amelioration`), il ne réutilise pas `DecoratorCtor`.

### `Vehicle` - agrégat

- Constructeur : 6ᵉ paramètre `_advantages: Advantage[] = []` (défaut, pour ne pas casser
  les sites d'appel existants), + getter public `advantages`.
- `get cost()` : **inclure** `this._advantages.reduce((s, a) => s + a.price, 0)` - sinon
  les avantages seraient gratuits vis-à-vis du budget/cagnotte.
- `canAddAdvantage(type, remainingBudget): RuleResult` - garde `_isLost`, budget, puis
  **unicité** (`this._advantages.some(a => !a.isSold && a.type.equals(type))` échoue avant
  tout appel à la chaîne), puis délégation à `buildChain({ advantage: { type } }).validate()`
  pour Cascadeur/Sur Deux Roues. Pas de check d'emplacements, pas de paramètre orientation.
- `addAdvantage`/`removeAdvantage`, `markAdvantageSold`/`clearAdvantageSold`,
  `addCampaignAdvantage` (miroir des méthodes Improvement).
- `buildChain()` - **refactor** : plie `_improvements` **puis** `_advantages` dans la même
  chaîne (améliorations d'abord, puis avantages, puis le candidat testé). Cet ordre garantit
  que Cascadeur/Sur Deux Roues voient le cumul de Chenilles ET d'Expertise. La signature
  passe à une union discriminée `{ improvement: {...} } | { advantage: {...} }` ; mettre à
  jour l'appelant existant `canAddImprovement`.

`Team` gagne `addAdvantageToVehicle`, `removeAdvantageFromVehicle`, `addCampaignAdvantage`,
`markAdvantageSold`/`clearAdvantageSold` (miroir des méthodes Improvement, `assertNotLocked()`
sur les mutations directes) ; `resetCampaignState()` réinitialise aussi les avantages.

`VehicleBuildFactory.create()` (`GET /api/vehicles/:id`) gagne un 3ᵉ paramètre `advantages`
et les plie via `AdvantageDecoratorFactory.wrap` ; `GetVehicleDetailUseCase` lui passe
`vehicle.advantages` - sinon le bonus d'Expertise n'apparaîtrait jamais dans les stats
effectives exposées par cet endpoint.

### Alternatives écartées

- **Chaîne de décorateurs séparée pour les avantages** : plus isolée mais duplique toute
  l'infrastructure `VehicleBuild`, et rendrait Cascadeur/Sur Deux Roues incapables de voir
  le bonus de manœuvrabilité d'Expertise (ou de Chenilles) sans code de pontage
  supplémentaire. Écartée au profit de la chaîne unifiée.

---

## 3. Règle "perte totale" - pourquoi Advantage.price ne varie jamais

C'est le seul point où les avantages divergent des améliorations. Il faut distinguer **deux
nombres différents**, souvent confondus :

1. **`Advantage.price` (getter d'entité)** - la contribution de l'avantage au coût du
   véhicule. Pour un avantage, il retourne **toujours** `type.price`, que l'objet soit vendu
   ou non. Comme `Vehicle.cost` somme les `price` sans condition, et que
   `CampaignParticipant.wallet` est un getter dérivé de `Team.remainingBudget` (+ récompenses,
   cf. [2026-07-11-atelier-annulation-revente-design.md §3](2026-07-11-atelier-annulation-revente-design.md)),
   le fait que `price` ne baisse jamais suffit **à lui seul** à garantir que la cagnotte ne
   récupère rien à la revente. Aucun code de remboursement séparé n'est requis.

   Comparaison : `Improvement.price`/`Weapon.price` passent de `prix` à `ceil(prix/2)` quand
   `isSold` devient vrai → le coût du véhicule baisse → la cagnotte remonte de la moitié.
   Pour un avantage, `price` ne bouge pas → la cagnotte ne remonte pas. Le mécanisme est le
   même ; seule la formule diffère (`ceil(prix/2)` vs `prix` inchangé).

2. **`EquipmentChangedEvent.cost` (champ d'affichage du journal)** - purement descriptif,
   sert à écrire une ligne de journal via `describe()`. Pour une vente d'avantage, il vaut
   **`0`** ("cette transaction fait récupérer 0 jerrican", ce qui est vrai). **Ce `0` n'est
   pas le prix de l'avantage** et ne le remet pas à zéro : vérifié dans le code,
   `execute()`/`undo()` ne touchent plus jamais le wallet, seul `markSold()` a un effet réel,
   et cet effet ne change rien puisque `price` est constant. Pour une vente d'arme, ce même
   champ vaut `Math.floor(weapon.price / 2)`, calculé **avant** la vente (`resolveSell()`
   s'exécute avant `execute()`) : c'est un montant "affiché comme récupéré", pas le nouveau
   prix de l'objet.

`Advantage.slots` reste 0 dans tous les cas (un avantage vendu n'a de toute façon jamais
occupé d'emplacement). L'UI affiche l'avantage vendu barré, badge "Vendu" (décision 3), via
le même chemin que les armes/améliorations.

---

## 4. Use cases + controller (construction d'équipe)

Routes **imbriquées sous `VehicleController`** (miroir Amélioration) :

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/vehicles/:id/available-advantages` | Avantages du sponsor + verdict de disponibilité |
| POST | `/api/vehicles/:id/advantages` | Ajouter un avantage (`{ nomInterne }`) |
| DELETE | `/api/vehicles/:id/advantages/:advantageId` | Retirer un avantage |

Nouveaux DTOs (`team/dto/`) : `AddAdvantageDto { nomInterne }`, `AvailableAdvantageDto
{ nom, nomInterne, categorie, prix, description, regles, disponible, raison? }`,
`VehicleAdvantageDto { id, nomInterne, vehicleId, createdAt, prix }`. `VehicleDto` gagne
`advantages: VehicleAdvantageDto[]`.

Nouveaux use cases (`team/application/`), miroir exact des équivalents Improvement, tous via
`teamRepo.findByVehicleId` (pas de nouvelle méthode repository) :
`GetAvailableAdvantagesUseCase` (mappe chaque `AdvantageType` du sponsor vers un
`AvailableAdvantageDto` dont `disponible`/`raison` viennent de `vehicle.canAddAdvantage`),
`AddAdvantageUseCase`, `RemoveAdvantageUseCase`.

`vehicleDomainToDto()` (`team-http.mapper.ts`) mappe aussi les avantages. `team.module.ts`
câble les 3 use cases en `useFactory`.

### Alternatives écartées

- **Route plate `DELETE /api/advantages/:id`** (comme les armes) : imposerait une méthode
  `ITeamRepository.findByAdvantageId` (double-find pour éviter le piège d'hydratation
  partielle TypeORM). Inutile ici : un avantage se gère comme une amélioration, dont la route
  de suppression est déjà imbriquée (`vehicleId` connu depuis l'URL), donc `findByVehicleId`
  suffit. Écartée pour rester cohérent avec l'amélioration et éviter du code de repository
  supplémentaire.

---

## 5. Persistance TypeORM

**Nouvelle entité** `VehicleAdvantageOrm` (table `vehicle_advantages`), miroir de
`VehicleImprovementOrm` **sans colonne `orientation`** : `id`, `nomInterne`, `vehicleId`
(FK CASCADE), `createdAt`. `VehicleOrm` gagne une relation `OneToMany`.

`team.mapper.ts` : `advantageToDomain`/`advantageToOrm`, extension de `vehicleToDomain`/
`vehicleToOrm`. `team.repository.ts` : ajouter `advantages: true` aux `relations` de
`findByIdForUser()` et `findManyByIds()`. `team.module.ts` (`forFeature`) et `app.module.ts`
(liste `entities`) : ajouter `VehicleAdvantageOrm`.

En dev, `synchronize: true` crée la table automatiquement ; en prod, migration TypeORM
explicite (hors périmètre de cette itération).

---

## 6. Event-sourcing atelier

- `EquipmentEntityType` (enum campagne) gagne `ADVANTAGE`.
- `EquipmentChangedEvent` : 4ᵉ champ résolu `resolvedAdvantageType: AdvantageType | null`.
  Un `case ADVANTAGE` dans chaque switch (`createTransientEquipment`/`removeTransientEquipment`
  → `team.addCampaignAdvantage`/`removeAdvantageFromVehicle` ; `markSoldEntity`/`clearSoldEntity` ;
  `describe()`).
- `Game.changeEquipment` ([game.ts](../../apps/backend/src/app/campaign/domain/games/game.ts)) :
  - `resolveBuyCost()` : `case ADVANTAGE` → `cmd.resolvedAdvantageType.price`.
  - `resolveSell()` : `case ADVANTAGE` → `cost: 0` (cf. §3 - champ d'affichage, pas le prix
    de l'entité).
- `ChangeEquipmentUseCase` résout `resolvedAdvantageType`. Le mapper de replay
  (`campaign.mapper.ts`) reconstitue l'événement (4ᵉ branche).
- `WorkshopVehicleDto` gagne `advantages: WorkshopAdvantageDto[]` (`{ id, nomInterne, price,
  isSold, purchasedThisSession }`) ; `GetWorkshopUseCase` mappe. Nouveau
  `GetWorkshopAvailableAdvantagesUseCase` (miroir de la version improvements), nouvelle route
  `GET /api/campaigns/:id/workshop/vehicles/:vId/available-advantages`.

L'annulation d'achat en session courante (suppression du BUY, remboursement intégral) est
générique à tout `entityType` (`wasPurchasedThisSession`) - rien à ajouter.

### Périmètre d'enforcement (décision 7) et alternative écartée

Vérifié dans le code : `Game.changeEquipment()` ne valide aujourd'hui **que le budget**
(`participant.assertCanAfford`) au moment d'un achat, quel que soit le type d'équipement -
il n'appelle jamais `vehicle.canAddWeapon`/`canAddImprovement`. La règle complète n'est
consultée que par les use cases de **listing** (verdict d'IHM). C'est un filet de sécurité
serveur manquant, déjà accepté comme tel pour tout l'équipement ("Temps 2" documenté).

**Décision** : les avantages suivent ce même périmètre. `GetWorkshopAvailableAdvantagesUseCase`
appelle `canAddAdvantage` (donc Cascadeur/Sur Deux Roues correctement grisés dans l'IHM
atelier), mais `changeEquipment()` ne revérifie pas ces règles à l'écriture. **Alternative
écartée** : ajouter un enforcement serveur complet uniquement pour les avantages -
incohérent avec le reste de l'atelier et code de garde supplémentaire non justifié par cette
itération.

---

## 7. Frontend (2 sous-listes par catégorie)

- `catalog.model.ts` : interface `Avantage`, `Sponsor.avantages` (le champ `classes_avantage`
  existe déjà). `vehicle-builder.model.ts` : `VehicleAdvantage`, `AddAdvantageDto`,
  `AvailableAdvantageDto`, `Vehicle.advantages`. `workshop.model.ts` : `WorkshopAdvantageDto`,
  `EquipmentEntityType` gagne `'ADVANTAGE'`, mapping dans `mapWorkshopVehicleToVehicle`.
- `vehicle.service.ts` (routes imbriquées) et `campaigns.service.ts`
  (`getWorkshopAvailableAdvantages`) : nouveaux appels HTTP.
- `EquipmentDataSource` (interface + `TeamEquipmentDataSource` et `AtelierEquipmentDataSource`) :
  3 nouvelles méthodes (`getAvailableAdvantages`/`addAdvantage`/`removeAdvantage`). Le
  composant `EquipmentManager` reste agnostique de l'implémentation, comme aujourd'hui.
- `EquipmentManager` : signal `availableAdvantages` (chargé dans le `forkJoin` existant),
  computed `visibleAdvantages`/`hiddenAdvantagesCount` (pas de notion "orientation"), puis
  **deux computed dérivés** `advantagesCategoryA`/`advantagesCategoryB` filtrant sur
  `sponsorCatalog().classes_avantage[0]`/`[1]`. `coutEquipement` inclut le prix des
  avantages. `addAdvantage`/`removeAdvantage`/`onConfirmRemoveAdvantage` (miroir Improvement),
  `advantageRemovalMessage` dédié ("le prix total est perdu, aucun remboursement" au lieu de
  "moitié prix").
- `equipment-manager.html` : 2 sections titrées par le nom de catégorie, réutilisant
  `<app-equipment-option>` tel quel (`requiresOrientation=false`).
- `mounted-equipment.ts`/`.html` : input `advantages`, section d'affichage + retrait, output
  `advantageRemoved` - seul endroit où les avantages montés sont listés/retirés depuis le
  configurateur.

Tout fonctionne identiquement pour la construction d'équipe (`VehicleConfigurator`) et
l'atelier (`AtelierVehiclePage`), les deux passant par le même `EquipmentManager` via
l'abstraction `EquipmentDataSource` déjà en place - aucune duplication de composant.

---

## 8. Plan de vérification

**Backend (unitaire, Vitest)** :
- `advantage.spec.ts` : `price` toujours `type.price` (même vendu), `slots` toujours 0,
  `markSold`/`clearSold` idempotents.
- `advantage-decorators.spec.ts` : `ExpertiseDecorator.stats` (+1) ;
  `CascadeurDecorator`/`SurDeuxRouesDecorator.validateSelf` avec poids/manœuvrabilité variés ;
  **empilement** Chenilles/Expertise pour vérifier le seuil de manœuvrabilité effective ;
  registre.
- `vehicle.spec.ts`/`team.spec.ts` (extensions) : `canAddAdvantage` (garde `_isLost`,
  budget, unicité, délégation chaîne), `cost` inclut les avantages, délégations `Team`.
- Catalogue : `catalog.service.spec.ts`/`catalog.controller.spec.ts` (résolution par
  `categorie`, route `avantages`), test d'intégrité YAML (72 entrées, `nom_interne` uniques,
  `categorie` ∈ 12 valeurs connues, `comportement` cohérent avec le registre, chaque sponsor
  voit exactement 12 avantages = 2 catégories × 6).
- Use cases + `vehicle.controller.spec.ts` : les 3 nouveaux use cases (mock DI).
- Atelier : `game.spec.ts` (BUY/SELL ADVANTAGE avec `cost: 0`, annulation same-session),
  `get-workshop.usecase.spec.ts`, `get-workshop-available-advantages.usecase.spec.ts`,
  `campaign.controller.spec.ts`.

**Frontend (unitaire)** : `equipment-manager.spec.ts` (chargement, split par catégorie,
message de revente "perte totale"), `mounted-equipment.spec.ts`, `vehicle.service.spec.ts`,
`campaigns.service.spec.ts`, datasources.

**End-to-end (manuel, `./dev.sh`)** :
1. Véhicule Léger (manœuvrabilité 2) : acheter Expertise (+1 → 3), puis Cascadeur → doit
   passer (manœuvrabilité effective 3).
2. Véhicule Lourd : Cascadeur grisé, raison affichée.
3. Racheter deux fois le même avantage → refusé (unicité).
4. Atelier : acheter un avantage puis le revendre → la cagnotte **ne récupère rien**
   (comparer avec une amélioration revendue, moitié prix) ; l'avantage reste affiché barré
   "Vendu".
5. `npx nx run frontend:build` : aucune erreur de typage (DTOs alignés back/front).

---

## Annexe - Les 72 avantages (nom / nom_interne / catégorie / prix)

Le texte complet des règles de chaque avantage provient du PDF fourni et sera porté dans
`regles` (champ Markdown). `comportement` en gras = les 3 avantages à effet mécanique.

| Catégorie | Avantages (nom / nom_interne / prix) |
|---|---|
| Agression | Double Canon / double_canon / 2 · Abordage / abordage / 2 · Marteau de Guerre / marteau_de_guerre / 4 · Psychopathe / psychopathe / 5 · Broyeur / broyeur / 5 · Engin de la Mort / engin_de_la_mort / 5 |
| Audace | Symbiose / symbiose / 2 · Insaisissable / insaisissable / 3 · As du Frein à Main / as_du_frein_a_main / 3 · Feinte / feinte / 5 · Dérapage Contrôlé / derapage_controle / 5 · **Cascadeur / cascadeur / 7** |
| Dur à Cuire | Baril de Poudre / baril_de_poudre / 1 · Sens du Spectacle / sens_du_spectacle / 1 · Guerrier de la Route / guerrier_de_la_route / 2 · Couvrez-moi ! / couvrez_moi / 2 · Fou Furieux / fou_furieux / 3 · Pluie de Balles / pluie_de_balles / 3 |
| Horreur | Flammes Purificatrices / flammes_purificatrices / 1 · Visions Extatiques / visions_extatiques / 1 · Pacte avec le Diable / pacte_avec_le_diable / 1 · Autoroute vers l'Enfer / autoroute_vers_enfer / 2 · Manifestation Diabolique / manifestation_diabolique / 3 · Ange de la Mort / ange_de_la_mort / 4 |
| Mécanique | Poids Mort / poids_mort / 2 · Expert en Tonneaux / expert_en_tonneaux / 2 · Cogneur / cogneur / 4 · Retour de Flamme / retour_de_flamme / 5 · Concasseur / concasseur / 7 · Même pas Mal ! / meme_pas_mal / 8 |
| Militaire | Tireur d'Élite / tireur_elite / 2 · Servant d'Artillerie / servant_artillerie / 2 · Chargé à Bloc / charge_a_bloc / 2 · Tirs Rapides / tirs_rapides / 2 · Tir à la Tête / tir_a_la_tete / 4 · Riposte / riposte / 5 |
| Optimisation | Fenderkiss / fenderkiss / 2 · Propulsion / propulsion / 2 · Doigté / doigte / 3 · Momentum / momentum / 3 · Ronronnement / ronronnement / 6 · **Sur Deux Roues / sur_deux_roues / 6** |
| Poursuite | À tes Trousses / a_tes_trousses / 2 · Le Malheur des Uns... / le_malheur_des_uns / 2 · Provocation / provocation / 2 · Distancer / distancer / 2 · TIP / tip / 4 · Regard Déstabilisant / regard_destabilisant / 5 |
| Précision | Mister Fahrenheit / mister_fahrenheit / 2 · Heure de Gloire / heure_de_gloire / 2 · Prudence / prudence / 2 · **Expertise / expertise / 3** · Art de la Route / art_de_la_route / 3 · Pilote-Né / pilote_ne / 5 |
| Rapidité | Départ Éclair / depart_eclair / 1 · Sillage / sillage / 2 · Surcharge / surcharge / 2 · Rétrograder / retrograder / 3 · Temps Additionnel ! / temps_additionnel / 3 · À Fond la Caisse / a_fond_la_caisse / 5 |
| Technologie | Moteurs-Fusée / moteurs_fusee / 1 · Survolté / survolte / 1 · Gyroscope / gyroscope / 1 · Navigation Satellite / navigation_satellite / 2 · Mécano de Bord / mecano_de_bord / 3 · Eurêka ! / eureka / 4 |
| Trompe-la-Mort | Rage au Volant / rage_au_volant / 1 · Frénésie / frenesie / 2 · Foutu pour Foutu / foutu_pour_foutu / 2 · Intouchable / intouchable / 4 · Plus Balaise que Toi / plus_balaise_que_toi / 4 · Bièreserker / biereserker / 5 |

Mapping sponsor → catégories (déjà dans `sponsors.yml`, non modifié) : Rutherford
(Dur à Cuire, Militaire) · Miyazaki (Audace, Précision) · Mishkin (Militaire, Technologie) ·
Idris (Précision, Rapidité) · Slime (Optimisation, Trompe-la-Mort) · La Geôlière (Agression,
Dur à Cuire) · Scarlett (Optimisation, Agression) · La Patrouille de l'Autoroute (Rapidité,
Poursuite) · Verney (Technologie, Mécanique) · Maxxine (Optimisation, Poursuite) · L'Ordre
Infernal (Horreur, Rapidité) · Beverly (Horreur, Mécanique) · Rusty (Trompe-la-Mort,
Mécanique).
