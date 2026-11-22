# Gaslands Manager - Modèle du domaine

> **Propriétaire** : conception du domaine (agrégats, qui porte quelle règle, diagrammes).
> Les règles métier elles-mêmes sont dans `docs/spec/` ; ce document y renvoie au lieu de les
> reformuler. Patterns techniques : [ARCHITECTURE.md](ARCHITECTURE.md). Strategy d'équipement :
> [VEHICLE_SYSTEM.md](VEHICLE_SYSTEM.md).

---

## 1. Agrégat Team

`Team` est la racine ; `Vehicle`, `Weapon`, `Improvement`, `Advantage` et `Sequella` sont des entités
enfants dont la racine contrôle le cycle de vie. Les **Value Objects** (`VehicleType`, `WeaponType`,
`ImprovementType`, `AdvantageType`, `SequellaType`) enveloppent les données catalogue et exposent une
API typée.

```mermaid
classDiagram
    direction TB

    class Team {
        <<Aggregate Root>>
        +id : number
        +userId : number
        -_name : string
        -_sponsor : string
        -_cans : number
        -_description : string | null
        -_vehicles : Vehicle[]
        -_isLocked : boolean
        -_campaignBudget : number | null
        +name : string
        +sponsor : string
        +cans : number
        +description : string | null
        +vehicles : readonly Vehicle[]
        +isLocked : boolean
        +campaignBudget : number | null
        +vehiclesCost : number
        +budget : number
        +remainingBudget : number
        +assertNotLocked() void
        +update(cmd) void
        +addVehicle(type, defaultImprovements, defaultWeapons) Vehicle
        +removeVehicle(vehicleId) void
        +findVehicle(vehicleId) Vehicle
        +renameVehicle(vehicleId, nom) void
        +addWeaponToVehicle(vehicleId, weaponType, orientation) void
        +removeWeaponFromVehicle(vehicleId, weaponId) void
        +addImprovementToVehicle(vehicleId, improvementType, orientation) void
        +removeImprovementFromVehicle(vehicleId, improvementId) void
        +addAdvantageToVehicle(vehicleId, advantageType) void
        +removeAdvantageFromVehicle(vehicleId, advantageId) void
    }

    class Vehicle {
        <<Entity>>
        +id : number
        +teamId : number
        +type : VehicleType
        -_weapons : Weapon[]
        -_improvements : Improvement[]
        -_advantages : Advantage[]
        -_sequellas : Sequella[]
        -_isSold : boolean
        -_hasFavoriDuPublic : boolean
        -_nom : string | null
        +weapons : readonly Weapon[]
        +improvements : readonly Improvement[]
        +advantages : readonly Advantage[]
        +cost : number
        +usedSlots : number
        +isSold : boolean
        +hasFavoriDuPublic : boolean
        +customName : string | null
        +nom : string
        +baseStats : VehicleStats
        +effectiveStats : VehicleStats
        +describe() VehicleStatsSummary[]
        +rename(nom) void
        +canAddWeapon(type, orientation, budget) RuleResult
        +canAddImprovement(type, orientation, budget) RuleResult
        +canAddAdvantage(type, budget) RuleResult
        +addWeapon(type, orientation, budget) void
        +removeWeapon(weaponId) void
        +addImprovement(type, orientation, budget) void
        +removeImprovement(improvementId) void
        +addAdvantage(type, budget) void
        +removeAdvantage(advantageId) void
        +markSold() void
        +clearSold() void
        +markFavoriDuPublic() void
        +clearFavoriDuPublic() void
    }

    class Weapon {
        <<Entity>>
        +id : number
        +type : WeaponType
        +orientation : WeaponOrientation | null
        +estDefaut : boolean
        +price : number
        +slots : number
    }

    class Improvement {
        <<Entity>>
        +id : number
        +type : ImprovementType
        +orientation : Orientation | null
        +estDefaut : boolean
        +price : number
        +slots : number
        +applyStats(current) VehicleStats
    }

    class Advantage {
        <<Entity>>
        +id : number
        +type : AdvantageType
        -_isSold : boolean
        +price : number
        +slots : number
        +isSold : boolean
        +applyStats(current) VehicleStats
        +markSold() void
        +clearSold() void
    }

    class Sequella {
        <<Entity>>
        +id : number
        +type : SequellaType
        -_isSold : boolean
        +price : number
        +resaleRefund : number
        +isSold : boolean
        +applyStats(current) VehicleStats
        +markSold() void
        +clearSold() void
    }

    class VehicleType {
        <<Value Object>>
        -raw : Vehicule
        +nomInterne : string
        +nom : string
        +price : number
        +slots : number
        +carrosserie : number
        +manoeuvrabilite : number
        +vitesseMax : number
        +equipage : number
        +poids : Léger|Moyen|Lourd
        +defaultImprovements : string[]
        +defaultWeaponNomInterne : string | undefined
        +from(raw)$ VehicleType
        +equals(other) boolean
    }

    class WeaponType {
        <<Value Object>>
        -raw : Arme
        +nomInterne : string
        +nom : string
        +price : number
        +slots : number
        +type : base|avancée|équipage|largable
        +requiresOrientation : boolean
        +montableSurTourelle : boolean
        +from(raw)$ WeaponType
        +equals(other) boolean
    }

    class ImprovementType {
        <<Value Object>>
        -raw : Amelioration
        +nomInterne : string
        +nom : string
        +slots : number
        +price : number
        +comportement : string | undefined
        +requiresOrientation : boolean
        +from(raw)$ ImprovementType
        +equals(other) boolean
        +canPlace(ctx, candidate) RuleResult
    }

    class AdvantageType {
        <<Value Object>>
        -raw : Avantage
        +nomInterne : string
        +nom : string
        +categorie : string
        +price : number
        +comportement : string | undefined
        +from(raw)$ AdvantageType
        +equals(other) boolean
        +canPlace(ctx, candidate) RuleResult
    }

    class SequellaType {
        <<Value Object>>
        -raw : Sequelle
        +nomInterne : string
        +nom : string
        +description : string
        +chocsCost : number
        +origine : ATELIER|TABLE_EPAVES
        +from(raw)$ SequellaType
        +equals(other) boolean
    }

    class DomainException {
        <<Exception>>
        +name : "DomainException"
        +message : string
    }

    Team "1" *-- "0..*" Vehicle : possède
    Vehicle "1" *-- "0..*" Weapon : possède
    Vehicle "1" *-- "0..*" Improvement : possède
    Vehicle "1" *-- "0..*" Advantage : possède
    Vehicle "1" *-- "0..*" Sequella : possède
    Vehicle --> VehicleType : type
    Weapon --> WeaponType : type
    Improvement --> ImprovementType : type
    Advantage --> AdvantageType : type
    Sequella --> SequellaType : type
    Team ..> DomainException : lève
    Vehicle ..> DomainException : lève
```

**Principes de l'agrégat** :
- Toute mutation valide d'abord les règles et lève `DomainException` ; le use case la traduit en 400.
- Coûts et budget calculés en mémoire depuis l'agrégat chargé, jamais en SQL. `Team.budget` est le
  **seul** point qui choisit entre budget de campagne (`_campaignBudget`, hydraté par le repository)
  et `cans` - tous les calculs (`remainingBudget`, `canAdd…`) le lisent ([CAMPAIGN.md - Budget](spec/CAMPAIGN.md#budget-de-campagne)).
- **Verrouillage** : `_isLocked` hydraté par `TeamRepository` (jointure participant → état de campagne,
  aucune colonne). `assertNotLocked()` garde toutes les mutations directes, **pas** les méthodes
  « campagne » (`addCampaignVehicle`, `markWeaponSold`, `renameCampaignVehicle`…) utilisées par le
  replay de l'atelier ([TEAMS.md](spec/TEAMS.md#crud-équipes)).
- **Tourelle** : valeur `'tourelle'` du type `WeaponOrientation = Orientation | 'tourelle'` (distinct de
  l'`Orientation` à 3 valeurs des améliorations) - l'état « orientation + tourelle » est impossible à
  représenter. Réassigner une tourelle = revendre l'arme puis en racheter une, sans code dédié
  ([VEHICLES.md](spec/VEHICLES.md#montage-sur-tourelle)).
- **Orientation requise** : lue du champ catalogue `necessite_orientation` par `WeaponType`/
  `ImprovementType.requiresOrientation`, gardée génériquement par `canAddWeapon`/`canAddImprovement`.
- **Stats effectives et validation de pose** : Strategy `EquipmentBehavior` ; `canPlace()` porté par
  le Value Object (un candidat n'a pas d'instance), `applyStats()` par l'entité montée
  ([VEHICLE_SYSTEM.md §4](VEHICLE_SYSTEM.md#4-pattern-strategy---equipmentbehavior)).
- **Revente** : `isSold` sur `Weapon`/`Improvement`/`Advantage`/`Sequella`/`Vehicle`. Le prix résiduel
  est porté par le getter `price` de chaque entité (`ceil(prix/2)` pour arme, amélioration et châssis ;
  `Advantage.price` et `Sequella.price` ne varient jamais, ce qui suffit à porter la perte totale).
  `Vehicle.markSold()` cascade sur l'équipement pas encore vendu et mémorise transitoirement les ids
  cascadés, pour que `clearSold()` (undo) ne dé-marque que ceux-là ([CAMPAIGN.md](spec/CAMPAIGN.md#annulation-dachat-vs-revente)).
- **Séquelles** : miroir d'`Advantage` dont la monnaie est `vehicle.chocs`. Gardes :
  `canAddSequella` (origine, unicité, Chocs), `isSequellaRemovable` (une `TABLE_EPAVES` n'est jamais
  retirable), `canRemoveSequella` (revente fermée sauf `legende_vivante`). Créées uniquement en
  campagne ([CAMPAIGN.md](spec/CAMPAIGN.md#séquelles)).
- **Nom d'instance** : `_nom` nullable ; le getter `nom` résout **et formate** (« Nom (Type) » seulement
  si personnalisé), aucun consommateur ne reformate. `Vehicle.assertValidName` (statique) permet à
  `Game.renameVehicle` de rejeter un nom invalide avant de construire l'événement.

---

## 1 bis. Agrégat User

Agrégat sans entité enfant : sa valeur est de centraliser les règles du compte et le getter `callName`
(seule source du nom affiché, [AUTH.md](spec/AUTH.md#nom-daffichage-callname)).

```mermaid
classDiagram
    direction LR

    class User {
        <<Aggregate Root>>
        +id : number
        -_firstName : string
        -_lastName : string
        -_pseudo : string
        -_email : string
        -_passwordHash : string
        -_role : UserRole
        -_isActive : boolean
        +firstName : string
        +lastName : string
        +pseudo : string
        +email : string
        +role : UserRole
        +isActive : boolean
        +callName : string
        +register(cmd, hasher)$ Promise~User~
        +registerAdmin(cmd, hasher)$ Promise~User~
        +updateProfile(cmd) void
        +changePassword(current, new, hasher) Promise~void~
        +resetPassword(new, hasher) Promise~void~
        +resetPasswordAsAdmin(new, requesterId, hasher) Promise~void~
        +changeEmail(email) void
        +setActive(isActive, requesterId) void
        +assertCanAuthenticate(password, hasher) Promise~void~
        +assertRemovableBy(requesterId) void
    }

    class IPasswordHasher {
        <<Port>>
        +hash(plain) Promise~string~
        +compare(plain, hash) Promise~boolean~
    }

    class ITokenIssuer {
        <<Port>>
        +issue(user) string
    }

    class IUserRepository {
        <<Port>>
        +findById(id) Promise~User~
        +findByEmail(email) Promise~User~
        +findAll() Promise~User[]~
        +findAdmin() Promise~User~
        +save(user) Promise~User~
        +remove(id) Promise~void~
    }

    class DomainException {
        <<Exception>>
    }

    User ..> IPasswordHasher : reçoit en paramètre
    User ..> DomainException : lève
    IUserRepository ..> User : charge / persiste
    ITokenIssuer ..> User : lit id/email/role
```

- `callName` renvoie aujourd'hui `_pseudo` ; le DTO expose aussi le pseudo brut pour le seul
  pré-remplissage du formulaire (même couple que `Vehicle.customName`/`nom`).
- `_role` est `readonly` : seules les fabriques `register()`/`registerAdmin()` le fixent.
- Hachage via le port `IPasswordHasher`, **passé en paramètre** de méthode (jamais stocké) : les règles
  « mot de passe actuel correct », « compte désactivé » vivent dans l'agrégat sans dépendre de bcrypt.
- Seule règle hors agrégat : l'unicité de l'email (exige de connaître les autres utilisateurs),
  portée par la contrainte `unique` PostgreSQL → `ConflictException` dans `UserRepository`.

---

## 2. Catalogue en mémoire

Chargé une fois au démarrage depuis `database_init/data/*.yml` (cf.
[ARCHITECTURE.md §3.3](ARCHITECTURE.md#33-catalogues---singleton-en-mémoire)), aucune entité ORM :
référence immuable enveloppée par les Value Objects (`static from(raw)`).

```mermaid
classDiagram
    direction LR

    class Sponsor {
        <<Catalogue>>
        +nom : string
        +description : string
        +classes_avantage : string[]
        +avantages_sponsorises : string
        +vehicules : Vehicule[]
        +armes : Arme[]
        +ameliorations : Amelioration[]
        +avantages : Avantage[]
    }

    class Vehicule {
        <<Catalogue>>
        +nom : string
        +nom_interne : string
        +poids : Léger|Moyen|Lourd
        +carrosserie : number
        +manoeuvrabilite : number
        +vitesse_max : number
        +equipage : number
        +emplacements : number
        +prix : number
        +description : string
        +regles : string
        +sponsors_autorises : string[]
        +ameliorations_defaut : string[]
        +arme_defaut : string | undefined
    }

    class Arme {
        <<Catalogue>>
        +nom : string
        +nom_interne : string
        +type : base|avancée|équipage|largable
        +prix : number
        +emplacement : number
        +description : string
        +regles : string
        +sponsors_autorises : string[]
        +montable_tourelle : boolean | undefined
        +necessite_orientation : boolean
        +munitions : number | undefined
        +effet_court : string | undefined
    }

    class Amelioration {
        <<Catalogue>>
        +nom : string
        +nom_interne : string
        +prix : number | "x3"
        +emplacement : number
        +description : string
        +regles : string
        +sponsors_autorises : string[]
        +comportement : string
        +necessite_orientation : boolean
        +munitions : number | undefined
        +effet_court : string | undefined
    }

    class Avantage {
        <<Catalogue>>
        +nom : string
        +nom_interne : string
        +categorie : string
        +prix : number
        +description : string
        +regles : string
        +comportement : string | undefined
        +effet_court : string | undefined
    }

    class Scenario {
        <<Catalogue>>
        +nom : string
        +nom_interne : string
        +type : EVENEMENT_TELE|ESCARMOUCHE
        +description : string
        +franchissement_portes : boolean
        +gain_jerricans : boolean
    }

    class Sequelle {
        <<Catalogue>>
        +nom : string
        +nom_interne : string
        +description : string
        +chocs_cost : number
        +origine : ATELIER|TABLE_EPAVES
        +effet_court : string | undefined
    }

    class HouseRuleDefinition {
        <<Catalogue>>
        +nom : string
        +nom_interne : string
        +description_decochee : string
        +description_cochee : string
    }

    Sponsor "1" o-- "0..*" Vehicule : autorise
    Sponsor "1" o-- "0..*" Arme : autorise
    Sponsor "1" o-- "0..*" Amelioration : autorise
    Sponsor "1" o-- "0..*" Avantage : autorise (par categorie)
```

- Résolution par sponsor : véhicules, armes, améliorations via `sponsors_autorises` ; avantages par
  `categorie ∈ Sponsor.classes_avantage` ; séquelles et règles maison sans aucun lien sponsor.
- `munitions`/`effet_court` : champs purement présentationnels (fiche d'équipe), cf.
  [VEHICLES.md](spec/VEHICLES.md#catalogue-en-mémoire-pas-en-base-de-données).
- `Scenario` et `HouseRuleDefinition` sont chargés par leurs propres services (`ScenarioCatalogService`,
  `HouseRuleCatalogService`).

---

## 3. Diagramme entité-relation (base de données)

```mermaid
erDiagram
    USER ||--o{ TEAM : possède
    TEAM ||--o{ VEHICLE : contient
    VEHICLE ||--o{ WEAPON : possède
    VEHICLE ||--o{ VEHICLE_IMPROVEMENT : possède
    VEHICLE ||--o{ VEHICLE_ADVANTAGE : possède

    USER ||--o{ CAMPAIGN_PARTICIPANT : participe_via
    TEAM |o--o{ CAMPAIGN_PARTICIPANT : est_engagée_dans
    CAMPAIGN ||--o{ CAMPAIGN_PARTICIPANT : accueille
    CAMPAIGN ||--o{ GAME : programme
    GAME ||--o{ GAME_EVENT : journalise
    CAMPAIGN_PARTICIPANT ||--o{ GAME_EVENT : affecte

    USER {
        number id PK
        string firstName
        string lastName
        string pseudo "nom d'affichage — source du getter User.callName, NON unique"
        string email UK
        string password "bcrypt hash — champ privé de l'agrégat, jamais exposé"
        enum role "user|admin"
        boolean isActive
        date createdAt
        date updatedAt
    }

    TEAM {
        number id PK
        string name
        string sponsor "défaut: Rutherford"
        number cans "budget jerricans"
        text description
        number userId FK
        date createdAt
        date updatedAt
    }

    VEHICLE {
        number id PK
        string nomInterne "réf. catalogue Vehicule"
        string nom "nullable — nom personnalisé, null tant que jamais renommé"
        number teamId FK
        date createdAt
    }

    WEAPON {
        number id PK
        string nomInterne "réf. catalogue Arme"
        enum orientation "avant|arrière|lateral|tourelle (coût x3), null si équipage"
        boolean estDefaut "intégré au profil de base (ex. Canon de 125mm du Char d'assaut)"
        number vehicleId FK
        date createdAt
    }

    VEHICLE_IMPROVEMENT {
        number id PK
        string nomInterne "réf. catalogue Amelioration"
        enum orientation "avant|arrière|lateral"
        boolean estDefaut "intégré au profil de base"
        number vehicleId FK
        date createdAt
    }

    VEHICLE_ADVANTAGE {
        number id PK
        string nomInterne "réf. catalogue Avantage"
        number vehicleId FK
        date createdAt
    }

    CAMPAIGN {
        number id PK
        string name
        enum state "EN_CONSTRUCTION|EN_COURS|TERMINEE"
        string inviteCode UK
        number budget "défaut 50 - remplace Team.cans pour toute équipe engagée"
        json houseRules "tableau de clés (nom_interne) activées - défaut [] (RM-3)"
        date createdAt
        date updatedAt
    }

    CAMPAIGN_PARTICIPANT {
        number id PK
        number campaignId FK
        number userId FK
        number teamId FK "nullable"
        enum status "PENDING|VALIDATED|REJECTED"
        boolean isOrganizer
        boolean isLocked
        date createdAt
        date updatedAt
    }

    GAME {
        number id PK
        number campaignId FK
        string scenarioId "nullable"
        enum type "EVENEMENT_TELE|ESCARMOUCHE"
        enum status "PLANIFIE|ATELIER|JOUE"
        float displayOrder "double precision"
        date playedAt "horodatage du passage à ATELIER — null si PLANIFIE"
        date createdAt
        date updatedAt
    }

    GAME_EVENT {
        number id PK
        number gameId FK
        number participantId FK
        number eventOrder "position dans le journal de la partie"
        string eventType "discriminant : RANKING_ASSIGNED | WALLET_MOVEMENT | VEHICLE_LOST | WEAPON_LOST | IMPROVEMENT_LOST | ADVANTAGE_LOST | WRECK_RESOLVED | EQUIPMENT_CHANGED | RESISTANCE_CONTACTED | GATES_CROSSED | VEHICLE_DESTROYED | FAVORI_DU_PUBLIC_BONUS | VEHICLE_RENAMED | SABOTAGE_POINTS_SPENT"
        number rank "nullable"
        number championshipPoints "nullable — Ranking, GatesCrossed, VehicleDestroyed, FavoriDuPublicBonus"
        number amount "nullable — WalletMovement"
        string walletReason "nullable — RECOMPENSE|ACHAT|REVENTE"
        number vehicleId "nullable"
        number weaponId "nullable"
        number improvementId "nullable — ImprovementLostEvent"
        number advantageId "nullable — AdvantageLostEvent"
        number gatesCrossed "nullable — GatesCrossedEvent (US-B2)"
        string weightClass "nullable — VehicleDestroyedEvent : LEGER|MOYEN|LOURD|FORTERESSE (US-B2)"
        number diceRoll "nullable — WreckResolved"
        number chocsBefore "nullable"
        string wreckResult "nullable — DEBOSSELE|INDEMNE|ROUE_CABOSSEE|ARRACHEE|PIGNON_ENDOMMAGE|SIEGE_IRRECUPERABLE|CHASSIS_FRAGILISE|FAVORI_DU_PUBLIC|VEHICULE_DETRUIT"
        number chocsGained "nullable — peut être négatif (ligne DEBOSSELE)"
        string operation "nullable — BUY|SELL"
        string entityType "nullable — VEHICLE|WEAPON|IMPROVEMENT|ADVANTAGE|SEQUELLE"
        string nomInterne "nullable — EquipmentChanged ; SEQUELLE : coût en Chocs, pas cagnotte"
        number cost "nullable"
        number targetVehicleId "nullable"
        number targetEntityId "nullable"
        string orientation "nullable — EquipmentChanged ; WEAPON : 4 valeurs dont 'tourelle' (coût x3)"
        string freeAdvantageNomInterne "nullable — BUY SEQUELLE 'dur_a_cuire' uniquement, avantage gratuit accordé"
        string previousVehicleName "nullable — VehicleRenamedEvent, pour undo()"
        string newVehicleName "nullable — VehicleRenamedEvent"
        number sabotagePointsSpent "nullable — SabotagePointsSpentEvent, DÉJÀ clampé au solde disponible à la déclaration"
        string resistanceStrategyKey "nullable — ResistanceContactedEvent, clé de la stratégie automatique (ex. 'defaut', RM-4/RM-5) ; NULL pour un contact manuel"
        date createdAt
    }
```

- **Clés logiques, sans FK SQL** : tout `nomInterne` (et `GAME.scenarioId`, `GAME_EVENT.freeAdvantageNomInterne`)
  pointe vers le catalogue en mémoire.
- **Pas de table de séquelles** : une séquelle n'existe que par `EquipmentChangedEvent` et comme entité
  transiente (§4).
- **Pas de table de résultats** : le classement est reconstruit depuis les `GAME_EVENT` `RANKING_ASSIGNED`.
- **`GAME_EVENT` est une table plate** : colonnes payload toutes nullable, seules celles du type
  d'événement sont renseignées (évite une hiérarchie STI TypeORM).
- Unique `(CAMPAIGN_PARTICIPANT.campaignId, userId)`.

---

## 4. Domaine campagne (event sourcing)

Code : `apps/backend/src/app/campaign/domain/`. L'état n'est jamais persisté : il est **recalculé par
replay** du journal `game_events` à chaque chargement. Ne pas confondre l'agrégat `Campaign` avec
l'entité `CampaignOrm`.

```mermaid
classDiagram
    direction TB

    class Campaign {
        <<Aggregate Root — implements GameRulesContext>>
        +id : number
        +budget : number
        +houseRules : HouseRules
        +strategyFactory : HouseRuleStrategyFactory
        +participants : readonly CampaignParticipant[]
        +games : readonly Game[]
        +replay() void
        +rename(name) void
        +changeBudget(budget) void
        +setHouseRules(keys, validKeys) void
        +enterAtelier(gameId) autoClosedGameId
        +closeAtelier(gameId) void
        +closeCampaign() void
        +standings() StandingsEntry[]
        +findGame(gameId) Game
        +findParticipant(participantId) CampaignParticipant
        +findAtelierGame() Game
        +reorderGames(gameIds) void
        +assertTeamFitsBudget(team, budget?) void
    }

    class CampaignParticipant {
        <<Receiver GoF>>
        +id : number
        +userId : number
        +teamId : number
        +isOrganizer : boolean
        +wallet : number
        +championshipPoints : number
        +resistancePoints : number
        +sabotagePoints : number
        +team : Team
        +attachTeam(team) void
        +reset() void
        +creditWallet(amount) void
        +addPoints(n) void
        +addResistance(n) void
    }

    class Game {
        <<Invoker GoF — abstract>>
        +id : number
        +campaignId : number
        +order : number
        +status : GameStatus
        +events : readonly GameEvent[]
        +canAccept(event) boolean
        +addEvent(event) void
        +apply(participants) void
        +revert(participants) void
        +reorder(newOrder) void
        +recordResult(rankings, participants) GameEvent[]
        +distributeResistance() GameEvent[]
        +attachContext(context) void
        +resolveWreck(participant, vehicleId, wreckTable) WreckTableResult
        +creditFavoriDuPublicBonus(participantId, vehicleId, wasDestroyed) GameEvent?
        +changeEquipment(participant, cmd) GameEvent[]
        +contactResistance(participantId) GameEvent[]
        +recordWalletMovement(participantId, amount, reason) GameEvent[]
        +recordVehicleLost(participantId, vehicleId, weaponIds?) GameEvent[]
        +journal() GameJournalEntry[]
    }

    class GameEvent {
        <<Command GoF — abstract>>
        +id : number
        +gameId : number
        +participantId : number
        +eventOrder : number
        +execute(participants) void
        +undo(participants) void
        +describe() string
    }

    class WreckOutcome {
        <<Value Object>>
        +vehicleId : number
        +diceRoll : number
        +chocsBefore : number
        +wreckResult : WreckResult
        +chocsGained : number
        +lostEquipment : LostEquipment|null
        +vehicleIsLost : boolean
        +weaponLostId : number|null
        +improvementLostId : number|null
        +advantageLostId : number|null
    }

    Campaign "1" *-- "0..*" CampaignParticipant
    Campaign "1" *-- "0..*" Game
    Game "1" *-- "0..*" GameEvent
    GameEvent --> CampaignParticipant : mute via execute()
    CampaignParticipant --> Team : team (état figé)
```

### Répartition des responsabilités Campaign / Game

- `Campaign` ne porte que ce qui dépasse une partie : navigation (`findGame`, `findParticipant`),
  invariant « un seul atelier » (`findAtelierGame`), replay, cycle de vie, CRUD programme/participants.
- **La construction des événements d'une partie vit sur `Game`** (`recordResult`,
  `distributeResistance`, `resolveWreck`, `creditFavoriDuPublicBonus`, `changeEquipment`,
  `contactResistance`, `recordWalletMovement`, `recordVehicleLost`, `journal()`…). Les use cases
  naviguent (`campaign.findGame(id)`) puis appellent la méthode sur la partie.
- Les `CampaignParticipant` sont passés **en paramètre** (donnée variable à chaque appel) ; la
  configuration stable (règles maison) est attachée par la racine (`attachContext`, ci-dessous).

### Hiérarchie Game (Invoker)

Pas de sous-type atelier : `ATELIER` est un statut (`PLANIFIE → ATELIER → JOUE`). `canAccept(event)`
dépend du statut :

| Statut | Événements acceptés (`EvenementTeleGame` et `EscarmoucheGame`, listes volontairement dupliquées) |
|---|---|
| `PLANIFIE` | RankingAssigned, WalletMovement, VehicleLost, WeaponLost, ImprovementLost, WreckResolved, ResistanceContacted, GatesCrossed, VehicleDestroyed, FavoriDuPublicBonus, SabotagePointsSpent, EquipmentChanged **`SEQUELLE` seulement** (séquelle imposée par la Table des Épaves) |
| `ATELIER` | EquipmentChanged (tout `entityType`), VehicleRenamed |
| `JOUE` | aucun |

### Règles maison : Strategy par point de calcul

Une règle maison ne modifie jamais `Game`/`Campaign` : elle remplace la Strategy résolue pour **un**
point de calcul. Effets fonctionnels : [CAMPAIGN.md - Règles maison](spec/CAMPAIGN.md#règles-maison).

```mermaid
classDiagram
    direction TB

    class GameRulesContext {
        <<Interface étroite>>
        +strategyFactory : HouseRuleStrategyFactory
    }

    class Campaign {
        <<Aggregate Root — implements GameRulesContext>>
        +houseRules : HouseRules
        +strategyFactory : HouseRuleStrategyFactory
    }

    class Game {
        <<Invoker GoF — abstract>>
        -_context : GameRulesContext | null
        +attachContext(context) void
        #context : GameRulesContext
        +distributeResistance() GameEvent[]
        +recordResult(rankings, participants) GameEvent[]
        +rollBaseIncome(participantId, randomizer) GameEvent[]
    }

    class HouseRuleStrategyFactory {
        <<Abstract Factory — unique, une méthode par point de calcul>>
        -rules : HouseRules
        +createResistanceDistributionStrategy() ResistanceDistributionStrategy
        +createTvBonusDistributionStrategy() TvBonusDistributionStrategy
        +createBaseIncomeStrategy() BaseIncomeStrategy
        +createJerricanGainsCapStrategy() JerricanGainsCapStrategy
    }

    class ResistanceDistributionStrategy {
        <<Interface>>
        +key : string
        +isEligible(entry, context) boolean
    }

    class DefaultResistanceStrategy {
        +key : "defaut"
        +isEligible(entry, context) boolean
    }

    class NoChampionshipPointsStrategy {
        +key : "distribution_points_resistance"
        +isEligible(entry, context) boolean
    }

    class TvBonusDistributionStrategy {
        <<Interface>>
        +key : string
        +isEligible(entry) boolean
    }

    class NoTvBonusStrategy {
        +key : "defaut"
        +isEligible(entry) boolean
    }

    class CollectiveTvBonusStrategy {
        +key : "cagnotte_collective_evenement_tele"
        +isEligible(entry) boolean
    }

    class BaseIncomeStrategy {
        <<Interface>>
        +key : string
        +roll(randomizer) number | null
    }

    class DefaultBaseIncomeStrategy {
        +key : "defaut"
        +roll(randomizer) number
    }

    class NoBaseIncomeStrategy {
        +key : "escarmouche_bonus_jerricans"
        +roll(randomizer) null
    }

    class JerricanGainsCapStrategy {
        <<Interface>>
        +key : string
        +clamp(requestedAmount, alreadyEarned) number
    }

    class UnlimitedJerricanGainsStrategy {
        +key : "defaut"
        +clamp(requestedAmount, alreadyEarned) number
    }

    class CappedJerricanGainsStrategy {
        +key : "plafond_jerricans_escarmouche"
        +clamp(requestedAmount, alreadyEarned) number
    }

    Campaign ..|> GameRulesContext
    Campaign "1" *-- "0..*" Game : attachContext() à la construction/hydratation
    Game --> GameRulesContext : context (jamais Campaign entière)
    GameRulesContext --> HouseRuleStrategyFactory : strategyFactory
    HouseRuleStrategyFactory --> ResistanceDistributionStrategy : résout (distributeResistance)
    HouseRuleStrategyFactory --> TvBonusDistributionStrategy : résout (recordResult)
    HouseRuleStrategyFactory --> BaseIncomeStrategy : résout (rollBaseIncome)
    HouseRuleStrategyFactory --> JerricanGainsCapStrategy : résout (rollBaseIncome, recordJerricanGains)
    DefaultResistanceStrategy ..|> ResistanceDistributionStrategy
    NoChampionshipPointsStrategy ..|> ResistanceDistributionStrategy
    NoTvBonusStrategy ..|> TvBonusDistributionStrategy
    CollectiveTvBonusStrategy ..|> TvBonusDistributionStrategy
    DefaultBaseIncomeStrategy ..|> BaseIncomeStrategy
    NoBaseIncomeStrategy ..|> BaseIncomeStrategy
    UnlimitedJerricanGainsStrategy ..|> JerricanGainsCapStrategy
    CappedJerricanGainsStrategy ..|> JerricanGainsCapStrategy
```

- **`GameRulesContext`** : interface étroite que `Campaign` attache à chaque `Game` (`attachContext`),
  pour que la partie résolve sa politique sans recevoir l'agrégat entier ni une décision d'un use case.
- **`HouseRuleStrategyFactory`** : Factory **unique**, une méthode `create…Strategy()` par point de
  calcul. Reconstruite à chaque accès à `Campaign.strategyFactory` (pas de cache à invalider après
  `setHouseRules`). Registre pur `HOUSE_RULE_REGISTRY` (union discriminée par `point`, Strategy typée
  sans `any`). Deux règles actives sur le même point → `DomainException`.
- **4 points de calcul** :

| Point | Consommé par | Défaut | Règle maison |
|---|---|---|---|
| Distribution des PR | `EvenementTeleGame.distributeResistance()` (un `isEligible` par participant) | `DefaultResistanceStrategy` | R1 `NoChampionshipPointsStrategy` |
| Cagnotte télé | `Game.recordResult()` | `NoTvBonusStrategy` | R2 `CollectiveTvBonusStrategy` |
| Revenu de base | `Game.rollBaseIncome()` (`roll()` → montant ou `null`) | `DefaultBaseIncomeStrategy` | R3 `NoBaseIncomeStrategy` |
| Plafond de gains | `rollBaseIncome()` **et** `recordJerricanGains()` (`clamp(demandé, déjàGagné)`) | `UnlimitedJerricanGainsStrategy` | R4 `CappedJerricanGainsStrategy` |

- La `key` de la Strategy est stampée sur l'événement (ex. `ResistanceContactedEvent.strategyKey`) :
  le résultat est figé, jamais recalculé au replay.
- Le cumul « déjà gagné » de R4 est recalculé depuis `this.events` via le getter générique
  `GameEvent.recompenseJerricansAwarded` (même idiome que `championshipPointsAwarded`), jamais mémorisé.
- **Qui sélectionne** : toujours `Game` via `this.context.strategyFactory`, jamais un use case
  ([ARCHITECTURE.md §3.4](ARCHITECTURE.md#34-architecture-ddd---standard-du-projet)).

### Hiérarchie GameEvent (Command)

Chaque événement implémente `execute()`/`undo()` et `describe()` (une ligne de texte, utilisée par le
journal et l'écran Résolution du wizard).

| Événement | `execute()` | `undo()` |
|---|---|---|
| `RankingAssignedEvent`, `GatesCrossedEvent` | `addPoints(+PC)` | inverse |
| `VehicleDestroyedEvent` | `addPoints(+PC)` au destructeur, ne touche pas le véhicule | inverse |
| `WalletMovementEvent` | `creditWallet(amount)` | inverse |
| `VehicleLostEvent` / `WeaponLostEvent` / `ImprovementLostEvent` / `AdvantageLostEvent` | `markLost()` | `clearLost()` |
| `WreckResolvedEvent` | `addChocs(n)` (n peut être négatif) ; `markFavoriDuPublic()` si ce résultat | inverse |
| `EquipmentChangedEvent` (hors `SEQUELLE`) | BUY : crée l'entité (`addCampaign…`) ; SELL : `markSold…` | inverse |
| `EquipmentChangedEvent` (`SEQUELLE`) | BUY : `addChocs(-coût)` + séquelle (+ avantage gratuit si Dur à Cuire) ; SELL : séquelle (et avantage lié) vendus | inverse |
| `ResistanceContactedEvent` | `addResistance(+3)` | inverse |
| `FavoriDuPublicBonusEvent` | `addPoints(+5)` + `clearFavoriDuPublic()` | inverse |
| `VehicleRenamedEvent` | `renameCampaignVehicle(newName)` | `renameCampaignVehicle(previousName)` |
| `SabotagePointsSpentEvent` | `addResistance(-3 × pointsSpent)` (montant déjà clampé à la construction) | inverse |

Les montants dérivés d'une règle (PC selon le poids, clamp, éligibilité Favori du Public…) sont
calculés par `Game` **avant** la construction de l'événement, jamais dans `execute()`.

### Entités transientes (D-S11)

Véhicules, armes, améliorations, avantages et séquelles achetés en atelier n'ont **pas de ligne en
base** : identité `id = -event.id`, recréés à chaque replay par `EquipmentChangedEvent.execute()`. Les
ids positifs restent aux entités persistées (aucune table pour `Sequella`).
- Dur à Cuire : séquelle et avantage gratuit partagent `-event.id` sans collision (collections distinctes).
- Équipement intégré d'un véhicule acheté en atelier : le véhicule garde `-event.id` (contrat utilisé
  par `findSameSessionPurchase`/`collectSessionEventsForVehicle`) ; ses entités par défaut reçoivent un
  id décalé d'un offset constant (`Team.DEFAULT_IMPROVEMENT_ID_OFFSET`/`DEFAULT_WEAPON_ID_OFFSET`,
  10/20 milliards), supérieur à la capacité de `GAME_EVENT.id` (`integer`) : collision impossible.

### Séquelles (event sourcing)

- Aucun événement dédié : `EquipmentChangedEvent`, `entityType: SEQUELLE`, seule exception où la
  monnaie est `vehicle.chocs` au lieu de la cagnotte.
- Maintenu par la Rouille / Légende Vivante : pas d'événement, deux modificateurs de `WreckTable` lus
  par présence (`Vehicle.hasActiveSequella`) à chaque tirage.
- `WreckTable` dépend d'`ICatalogRepository` (séquelles imposées) en plus d'`IRandomizer`.
