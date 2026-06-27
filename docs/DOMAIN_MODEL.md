# Gaslands Manager — Modélisation du domaine

> Diagrammes UML du modèle de domaine.
> Mettre à jour après tout changement d'agrégat, d'entité ou de relation entre modules.
> Architecture et patterns : [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. Agrégat Team (Domain-Driven Design)

Le module `team/` est l'agrégat DDD principal. `Team` est la racine ; `Vehicle`,
`Weapon` et `Improvement` sont des entités enfants dont le cycle de vie est entièrement
contrôlé par la racine. Les **Value Objects** (`VehicleType`, `WeaponType`,
`ImprovementType`) enveloppent les données brutes du catalogue YAML et exposent une API
métier typée.

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
        +name : string
        +sponsor : string
        +cans : number
        +description : string | null
        +vehicles : readonly Vehicle[]
        +remainingBudget : number
        +update(cmd) void
        +addVehicle(type, defaultImprovements) Vehicle
        +removeVehicle(vehicleId) void
        +findVehicle(vehicleId) Vehicle
        +addWeaponToVehicle(vehicleId, weaponType, orientation) void
        +removeWeaponFromVehicle(vehicleId, weaponId) void
        +addImprovementToVehicle(vehicleId, improvementType, orientation) void
        +removeImprovementFromVehicle(vehicleId, improvementId) void
        +assignWeaponToTourelle(vehicleId, improvementId, weaponType) void
        +unassignWeaponFromTourelle(vehicleId, improvementId) void
    }

    class Vehicle {
        <<Entity>>
        +id : number
        +teamId : number
        +type : VehicleType
        -_weapons : Weapon[]
        -_improvements : Improvement[]
        +weapons : readonly Weapon[]
        +improvements : readonly Improvement[]
        +cost : number
        +usedSlots : number
        +canAddWeapon(type, orientation, budget) RuleResult
        +canAddImprovement(type, orientation, budget) RuleResult
        +addWeapon(type, orientation, budget) void
        +removeWeapon(weaponId) void
        +addImprovement(type, orientation, budget) void
        +removeImprovement(improvementId) void
        +assignWeaponToTourelle(improvementId, weaponType, budget) void
        +unassignWeaponFromTourelle(improvementId) void
    }

    class Weapon {
        <<Entity>>
        +id : number
        +type : WeaponType
        +orientation : Orientation | null
        +price : number
        +slots : number
    }

    class Improvement {
        <<Entity>>
        +id : number
        +type : ImprovementType
        +orientation : Orientation | null
        +estDefaut : boolean
        -_weaponAssignee : WeaponType | null
        +weaponAssignee : WeaponType | null
        +price : number
        +slots : number
        +assignWeapon(weaponType) void
        +unassignWeapon() void
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
        +isEquipage : boolean
        +requiresOrientation : boolean
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
        +hasVariablePrice : boolean
        +isTourelle : boolean
        +from(raw)$ ImprovementType
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
    Vehicle --> VehicleType : type
    Weapon --> WeaponType : type
    Improvement --> ImprovementType : type
    Improvement --> WeaponType : weaponAssignee (Tourelle)
    Team ..> DomainException : lève
    Vehicle ..> DomainException : lève
```

**Invariant clé** : `vehicle.cost` est calculé en mémoire depuis l'agrégat chargé —
jamais via une requête SQL. `Team.remainingBudget` agrège le coût de tous ses véhicules.
Toute mutation valide d'abord les règles métier et lève `DomainException` si une règle
est violée. La couche application convertit `DomainException` → `BadRequestException`.

---

## 2. Catalogue en mémoire

Les données de jeu sont chargées **une seule fois au démarrage** depuis les fichiers YAML
(`database_init/data/`) et conservées en mémoire sous forme de `Map`. Aucune entité ORM
n'existe pour ces types — ils servent de **référence immuable** que les Value Objects
enveloppent.

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
    }

    class Scenario {
        <<Catalogue>>
        +nom : string
        +nom_interne : string
        +type : EVENEMENT_TELE|ESCARMOUCHE
        +description : string
    }

    Sponsor "1" o-- "0..*" Vehicule : autorise
    Sponsor "1" o-- "0..*" Arme : autorise
    Sponsor "1" o-- "0..*" Amelioration : autorise
```

Les trois types `VehicleType`, `WeaponType`, `ImprovementType` (§1) enveloppent
respectivement `Vehicule`, `Arme` et `Amelioration` via `static from(raw)`. Le catalogue
`Scenario` est géré par `ScenarioCatalogService` (même singleton pattern que
`CatalogService`).

---

## 3. Diagramme entité-relation (base de données)

Toutes les entités TypeORM persistées dans PostgreSQL.

```mermaid
erDiagram
    USER ||--o{ TEAM : possède
    TEAM ||--o{ VEHICLE : contient
    VEHICLE ||--o{ WEAPON : possède
    VEHICLE ||--o{ VEHICLE_IMPROVEMENT : possède

    USER ||--o{ SEASON_PARTICIPANT : participe_via
    TEAM |o--o{ SEASON_PARTICIPANT : est_engagée_dans
    SEASON ||--o{ SEASON_PARTICIPANT : accueille
    SEASON ||--o{ GAME : programme
    GAME ||--o{ GAME_RESULT : produit
    SEASON_PARTICIPANT ||--o{ GAME_RESULT : obtient

    USER {
        number id PK
        string firstName
        string lastName
        string email UK
        string password "bcrypt hash"
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
        number teamId FK
        date createdAt
    }

    WEAPON {
        number id PK
        string nomInterne "réf. catalogue Arme"
        enum orientation "avant|arrière|gauche|droite"
        number vehicleId FK
        date createdAt
    }

    VEHICLE_IMPROVEMENT {
        number id PK
        string nomInterne "réf. catalogue Amelioration"
        enum orientation "avant|arrière|gauche|droite"
        boolean estDefaut "intégré au profil de base"
        number vehicleId FK
        date createdAt
    }

    SEASON {
        number id PK
        string name
        enum state "EN_CONSTRUCTION|EN_COURS|TERMINEE"
        string inviteCode UK
        date createdAt
        date updatedAt
    }

    SEASON_PARTICIPANT {
        number id PK
        number seasonId FK
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
        number seasonId FK
        string scenarioId "réf. catalogue Scenario"
        enum type "EVENEMENT_TELE|ESCARMOUCHE"
        enum status "PLANIFIE|JOUE"
        number displayOrder "colonne SQL: displayOrder"
        date playedAt "null si PLANIFIE"
        date createdAt
        date updatedAt
    }

    GAME_RESULT {
        number id PK
        number gameId FK
        number participantId FK
        number rank UK "unique par partie"
        number championshipPoints
        date createdAt
    }
```

**Clés logiques (pas de FK SQL)** : `VEHICLE.nomInterne` → `Vehicule.nom_interne`,
`WEAPON.nomInterne` → `Arme.nom_interne`, `VEHICLE_IMPROVEMENT.nomInterne` →
`Amelioration.nom_interne`, `GAME.scenarioId` → `Scenario.nom_interne`. Ces références
pointent vers des données en mémoire, pas des tables SQL.

**Contrainte unique composite** : `(SEASON_PARTICIPANT.seasonId, SEASON_PARTICIPANT.userId)` — un utilisateur ne peut engager qu'une équipe par saison. `(GAME_RESULT.gameId, GAME_RESULT.rank)` — pas deux équipes au même rang pour une même partie.
