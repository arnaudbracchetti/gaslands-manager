# Gaslands Manager — Conception technique : système Véhicules / Armes / Améliorations

> **À qui s'adresse ce document ?**
> À tout intervenant (humain ou agent IA) qui doit modifier les modules `vehicle`, `weapon`,
> ou les composants Angular `vehicle-builder` / `vehicle-editor`. Il décrit les flux complets,
> les règles de validation et les patterns d'architecture, en s'appuyant sur des diagrammes
> pour réduire le temps de compréhension.
>
> Il ne remplace pas les commentaires dans le code — il les complète par une vue d'ensemble.

---

## 1. Deux mondes distincts : catalogue vs instances de jeu

Le projet manipule deux natures de données très différentes. Ne pas les confondre est fondamental.

| | **Catalogue** | **Instances de jeu** |
|---|---|---|
| Source | Fichiers YAML dans `database_init/data/` | Base de données PostgreSQL |
| Chargement | Une seule fois au démarrage (`OnModuleInit`) | À chaque requête (TypeORM) |
| Mutabilité | **Jamais modifié** à l'exécution | Créé / supprimé par les utilisateurs |
| Représentation | `Map<string, Sponsor>` dans `CatalogService` | Entités `Vehicle`, `Weapon`, `VehicleImprovement` |
| Identifiant stable | `nom_interne` (snake_case, sans accents) | `id` auto-incrémenté |
| Exemples | `Vehicule`, `Arme`, `Amelioration`, `Sponsor` | `Vehicle`, `Weapon`, `VehicleImprovement` |

Les entités persistées référencent le catalogue **uniquement via `nomInterne`** — une clé logique
stable. Ce choix permet d'avoir plusieurs variantes d'un même véhicule/arme
(ex. `belier` vs `belier_slime`) avec des prix différents mais **le même comportement de validation**.

---

## 2. Architecture des entités TypeORM

```mermaid
erDiagram
    User {
        uuid id PK
        string firstName
        string lastName
        string email
        string password
    }

    Team {
        number id PK
        string name
        string sponsor
        number cans
        uuid userId FK
    }

    Vehicle {
        number id PK
        string nomInterne
        number teamId FK
    }

    VehicleImprovement {
        number id PK
        string nomInterne
        string orientation "avant|arrière|gauche|droite|null"
        boolean estDefaut "false = achetée, true = profil de base"
        number vehicleId FK
    }

    Weapon {
        number id PK
        string nomInterne
        string orientation "avant|arrière|gauche|droite|null"
        number vehicleId FK
    }

    CATALOGUE_Vehicule {
        string nom_interne PK
        string nom
        string poids "Léger|Moyen|Lourd"
        number emplacements
        number equipage
        number prix
        string[] ameliorations_defaut "optionnel"
    }

    CATALOGUE_Amelioration {
        string nom_interne PK
        string nom
        string comportement
        number emplacement
        number prix
    }

    CATALOGUE_Arme {
        string nom_interne PK
        string nom
        string type "base|avancée|équipage|largable"
        number emplacement
        number prix
    }

    User ||--o{ Team : "possède"
    Team ||--o{ Vehicle : "contient"
    Vehicle ||--o{ VehicleImprovement : "porte"
    Vehicle ||--o{ Weapon : "monte"

    Vehicle }o..|| CATALOGUE_Vehicule : "nomInterne (logique)"
    VehicleImprovement }o..|| CATALOGUE_Amelioration : "nomInterne (logique)"
    Weapon }o..|| CATALOGUE_Arme : "nomInterne (logique)"
```

> **Cascade** : supprimer un `Team` supprime ses `Vehicle`, qui suppriment leurs `VehicleImprovement`
> et `Weapon` — via `onDelete: 'CASCADE'` TypeORM à chaque niveau.

---

## 3. Flux de création d'un véhicule

Un véhicule est d'abord créé « nu » (sans équipement), puis équipé séparément.

```mermaid
sequenceDiagram
    actor User
    participant VC as VehicleConfigurator<br/>(Angular Smart)
    participant VS as VehicleService<br/>(Angular)
    participant API as POST /api/teams/:teamId/vehicles<br/>(NestJS Controller)
    participant BVSS as VehicleService<br/>(NestJS)
    participant Cat as CatalogService<br/>(NestJS, mémoire)
    participant DB as PostgreSQL

    User->>VC: choisit un véhicule dans la grille
    VC->>VS: create(teamId, { nomInterne })
    VS->>API: POST { nomInterne: "voiture" }

    API->>BVSS: create(teamId, userId, dto)
    BVSS->>DB: findOne(Team, { id: teamId, userId })
    alt Équipe introuvable ou autre propriétaire
        DB-->>BVSS: null
        BVSS-->>API: NotFoundException (404)
        API-->>VS: HTTP 404
        VS-->>VC: erreur
    end
    DB-->>BVSS: Team (avec sponsor)

    BVSS->>Cat: getVehiculeByNomInterne(nomInterne)
    alt Véhicule inconnu du catalogue
        Cat-->>BVSS: null
        BVSS-->>API: BadRequestException
    end
    Cat-->>BVSS: Vehicule (données catalogue)

    BVSS->>Cat: getSponsorByName(team.sponsor)
    Cat-->>BVSS: Sponsor (avec vehicules[])
    alt Véhicule non autorisé par ce sponsor
        BVSS-->>API: BadRequestException
    end

    BVSS->>DB: save(Vehicle { teamId, nomInterne })
    DB-->>BVSS: Vehicle { id: 42 }

    Note over BVSS: Si vehicule.ameliorations_defaut non vide :
    loop Pour chaque amélioration par défaut
        BVSS->>DB: save(VehicleImprovement { nomInterne, estDefaut: true, vehicleId: 42 })
    end

    BVSS->>DB: findOneForUser (recharge complète avec relations)
    DB-->>BVSS: Vehicle { id: 42, improvements: [Arceaux (défaut)], weapons: [] }
    BVSS-->>API: VehicleDto (avec prix=0 sur les défauts)
    API-->>VS: HTTP 201 + VehicleDto
    VS-->>VC: Vehicle créé

    VC->>VC: vehicle.set(created)<br/>→ affiche EquipmentManager
```

---

## 4. Pattern Décorateur — `VehicleBuild`

C'est le cœur du système de validation. Chaque amélioration installée **enveloppe** la chaîne
courante et peut modifier les statistiques et les règles de validation.

### 4.1 Hiérarchie de classes

```mermaid
classDiagram
    class VehicleBuild {
        <<interface>>
        +baseStats VehicleStats
        +stats VehicleStats
        +validate() RuleResult
        +totalEmplacements() number
        +countByType(cls) number
        +hasOrientationFor(cls, orientation) boolean
    }

    class CatalogVehicleBuild {
        -catalogVehicule Vehicule
        +baseStats VehicleStats
        +stats VehicleStats
        +validate() RuleResult  "retourne toujours ok()"
        +totalEmplacements() number
    }

    class ImprovementDecorator {
        <<abstract>>
        #inner VehicleBuild
        #amelioration Amelioration
        #instance InstalledImprovement
        +baseStats VehicleStats   "délègue à inner"
        +stats VehicleStats       "peut surcharger"
        +validate() RuleResult    "Template Method"
        #validateSelf() RuleResult  "à surcharger"
        +totalEmplacements() number "inner + this.emplacement"
    }

    class ChenillesDecorator {
        +stats VehicleStats  "vitesse-1, manoeuvrabilité+1"
        #validateSelf()      "unique, incompatible avec char/hélico"
    }

    class BelierDecorator {
        #validateSelf()      "orientation requise, unique par orientation"
    }

    class BelierExplosifDecorator {
        #validateSelf()      "orientation requise, unique par orientation"
    }

    class MembreEquipageDecorator {
        +stats VehicleStats  "equipage+1"
        #validateSelf()      "max = 2× equipage initial"
    }

    class BlindageDecorator {
        +stats VehicleStats  "carrosserie+2"
        #validateSelf()      "toujours ok — cumulable sans limite"
    }

    class EquipementMishkinDecorator {
        #validateSelf()      "unique par véhicule"
    }

    class NeutralDecorator {
        #validateSelf()      "toujours ok — comportements sans règle"
    }

    class VehicleBuildFactory {
        +create(vehicule, improvements[]) VehicleBuild
        +wrap(inner, amelioration, instance) VehicleBuild
        -selectDecorator(comportement) class
    }

    VehicleBuild <|.. CatalogVehicleBuild
    VehicleBuild <|.. ImprovementDecorator
    ImprovementDecorator <|-- ChenillesDecorator
    ImprovementDecorator <|-- BelierDecorator
    ImprovementDecorator <|-- BelierExplosifDecorator
    ImprovementDecorator <|-- MembreEquipageDecorator
    ImprovementDecorator <|-- BlindageDecorator
    ImprovementDecorator <|-- EquipementMishkinDecorator
    ImprovementDecorator <|-- NeutralDecorator
    VehicleBuildFactory --> VehicleBuild : crée
```

### 4.2 Construction de la chaîne

La factory parcourt les améliorations installées et les enfile les unes dans les autres :

```
CatalogVehicleBuild("voiture")
  ↑ enveloppé par
BelierDecorator(orientation="avant")
  ↑ enveloppé par
BlindageDecorator
  ↑ enveloppé par
MembreEquipageDecorator
```

Appeler `build.stats` retourne les statistiques **cumulées** depuis le bas de la chaîne.
Appeler `build.validate()` déclenche le **Template Method** à chaque niveau :

```
MembreEquipageDecorator.validate()
  1. validateSelf()  → equipage ≤ max ?
  2. inner.validate() →
    BlindageDecorator.validate()
      1. validateSelf()  → ok (pas de règle)
      2. inner.validate() →
        BelierDecorator.validate()
          1. validateSelf()  → orientation fournie ? doublon ?
          2. inner.validate() →
            CatalogVehicleBuild.validate()
              → ok()
```

### 4.3 `baseStats` vs `stats` — différence critique

| Propriété | Valeur | Usage |
|-----------|--------|-------|
| `baseStats` | Profil d'origine du catalogue | "quel type de véhicule ?" (`nom_interne === 'char_assaut'`) |
| `stats` | Profil après accumulation des décorateurs | Affichage, validation "équipage max = 2× initial" |

Tous les décorateurs **délèguent** `baseStats` vers `inner` sans le modifier — seul
`CatalogVehicleBuild` le détient.

### 4.4 Sélection du décorateur — clé `comportement` YAML

Le champ `comportement` dans le YAML d'amélioration détermine quelle classe instancier,
**indépendamment du `nom_interne`**. C'est ce qui permet aux variantes sponsor d'avoir
le même comportement de validation à prix différent :

```yaml
# Deux entrées YAML, une seule classe de décorateur
- nom: "Bélier"
  nom_interne: belier
  comportement: belier    # → BelierDecorator
  prix: 4

- nom: "Bélier (Slime)"
  nom_interne: belier_slime
  comportement: belier    # → BelierDecorator identique
  prix: 2
```

---

## 5. Flux d'ajout d'un équipement

### 5.1 Chargement du catalogue disponible (GET)

Avant d'afficher les options, `EquipmentManager` charge les listes filtrées via `forkJoin` :

```mermaid
sequenceDiagram
    participant EM as EquipmentManager<br/>(Angular Smart)
    participant API_W as GET /vehicles/:id/available-weapons
    participant API_I as GET /vehicles/:id/available-improvements
    participant BVSS as VehicleService / WeaponService<br/>(NestJS)
    participant Cat as CatalogService

    EM->>API_W: GET (en parallèle)
    EM->>API_I: GET (en parallèle)

    Note over BVSS: Pour chaque endpoint :
    API_W->>BVSS: getAvailableWeapons(vehicleId, userId)
    BVSS->>BVSS: findOneForUser → charge Vehicle + relations
    BVSS->>BVSS: buildChain(vehicle.improvements) → VehicleBuild actuel

    loop Pour chaque arme du catalogue sponsor
        BVSS->>BVSS: checkCandidate(vehicle, arme, orientation=undefined)
        Note right of BVSS: Résultat : { disponible, raison? }
    end

    BVSS-->>API_W: AvailableWeaponDto[]
    API_W-->>EM: [{ nom, nomInterne, prix, type, disponible, raison? }, ...]

    Note over EM: Même logique pour available-improvements
    API_I-->>EM: AvailableImprovementDto[]

    EM->>EM: Affiche catalogue<br/>✅ disponible → bouton Ajouter<br/>⚠️ raison "orientation requise" → sélecteur<br/>❌ autre raison → grisé + message
```

### 5.2 Ordre des vérifications dans `checkCandidate` (CRITIQUE)

L'ordre est intentionnel et garantit des messages d'erreur cohérents :

```
1. Sponsor            : l'item appartient-il au catalogue du sponsor ?
                        → fail si non (pas d'accès à cet item)

2. Orientation invalide : arme d'équipage + orientation fournie ?
                        → fail si oui (incohérence de la requête)

3. Emplacements       : total (pool améliorations + armes + candidat) ≤ capacité ?
                        → fail si dépassement (vrai blocage physique)

4. Orientation manquante : arme non-équipage sans orientation ?
                        → fail si oui (info manquante)
```

> **Pourquoi 3 avant 4 ?** Si on inversait, une arme sans emplacement disponible
> afficherait « orientation requise » au lieu de « emplacements insuffisants » — message
> trompeur puisque le vrai problème est le manque d'emplacements.

### 5.3 Ajout effectif (POST)

```mermaid
sequenceDiagram
    actor User
    participant EO as EquipmentOption<br/>(Angular Dumb)
    participant EM as EquipmentManager<br/>(Angular Smart)
    participant VS as VehicleService<br/>(Angular)
    participant API as POST /vehicles/:id/weapons<br/>ou /improvements
    participant BVSS as NestJS Service
    participant DB as PostgreSQL

    User->>EO: clique "Ajouter"
    alt Équipement orientable (non équipage / Bélier)
        EO->>EO: choosingOrientation.set(true)<br/>affiche sélecteur 4 directions
        User->>EO: choisit "avant"
        EO->>EM: chosen.emit({ nomInterne, orientation: "avant" })
    else Équipement non orientable
        EO->>EM: chosen.emit({ nomInterne })
    end

    EM->>VS: addWeapon / addImprovement (vehicleId, choice)
    VS->>API: POST { nomInterne, orientation? }

    API->>BVSS: canAdd*(vehicleId, userId, dto)
    BVSS->>BVSS: Vérifications (cf. §5.2)
    alt Validation échouée
        BVSS-->>API: BadRequestException (400)
        API-->>VS: HTTP 400
        VS-->>EM: erreur
        EM->>EM: equipmentError.set(message)
    end

    BVSS->>DB: save(Weapon | VehicleImprovement)
    DB-->>BVSS: entité persistée
    BVSS->>DB: findOneForUser (recharge complète)
    DB-->>BVSS: Vehicle avec toutes relations
    BVSS-->>API: Vehicle rechargé
    API-->>VS: HTTP 201 + Vehicle
    VS-->>EM: Vehicle mis à jour
    EM->>EM: vehicleChanged.emit(updated)
    EM->>EM: loadAvailableEquipment() via effect()
```

---

## 6. Pool d'emplacements partagé

**Règle Gaslands** : un véhicule dispose de N emplacements **totaux**, partagés entre
armes **et** améliorations. Ce n'est pas deux pools séparés.

### Calcul backend (dans `checkCandidate` pour les améliorations)

```
totalDemande = candidateBuild.totalEmplacements()   ← amélio ACHETÉES + candidat
             + weaponSlotsOf(vehicle)               ← armes déjà montées

si totalDemande > candidateBuild.baseStats.emplacements → BLOQUÉ
```

**Les améliorations par défaut (`estDefaut: true`) sont exclues du calcul** — elles
font partie du profil du véhicule, pas de ses achats. `VehicleService.improvementSlotsOf()`
les filtre avant de traverser la chaîne, et `getBuild()` ne les enfile pas dans les
décorateurs (elles n'ont aucun `comportement` à appliquer).

`candidateBuild.totalEmplacements()` traverse la chaîne complète via délégation :
chaque décorateur retourne `this.amelioration.emplacement + this.inner.totalEmplacements()`.

### Reflet côté frontend

`EquipmentManager` recalcule un signal `emplacementsUtilises` en miroir :

```typescript
emplacementsUtilises = computed(() => {
  const vehicle = this.vehicle();
  const catalog = this.sponsorCatalog();

  const weaponSlots = vehicle.weapons.reduce((sum, w) => {
    const arme = catalog.armes.find(a => a.nom_interne === w.nomInterne);
    return sum + (arme?.emplacement ?? 0);
  }, 0);

  // Les améliorations par défaut (estDefaut: true) sont filtrées —
  // cohérence avec le backend qui les exclut de improvementSlotsOf().
  const improvementSlots = vehicle.improvements
    .filter(imp => !imp.estDefaut)
    .reduce((sum, imp) => {
      const amelioration = catalog.ameliorations.find(a => a.nom_interne === imp.nomInterne);
      return sum + (amelioration?.emplacement ?? 0);
    }, 0);

  return weaponSlots + improvementSlots;
});
```

Ce signal alimente la barre de progression « Emplacements » dans l'UI — la source
de vérité reste le backend, mais le frontend donne un retour visuel immédiat.

---

## 7. Flux de retrait

Le retrait est **permis pour les améliorations achetées** — aucune règle métier
n'est vérifiée (retirer un équipement ne peut jamais rendre une configuration valide
invalide). **Exception : les améliorations par défaut (`estDefaut: true`)** — elles
font partie du profil du véhicule et ne peuvent pas être retirées ; toute tentative
retourne HTTP **403 ForbiddenException** (la ressource existe mais est protégée —
pas un 404 d'appartenance).

```mermaid
sequenceDiagram
    actor User
    participant EM as EquipmentManager
    participant VS as VehicleService<br/>(Angular)
    participant API as DELETE /weapons/:id<br/>ou /vehicles/:id/improvements/:impId
    participant BVSS as NestJS Service
    participant DB as PostgreSQL

    User->>EM: clique 🗑 sur un équipement
    EM->>EM: window.confirm("Retirer X ?")
    alt Annulé
        EM->>EM: abandon
    end

    EM->>VS: removeWeapon(id) / removeImprovement(vehicleId, impId)
    VS->>API: DELETE
    API->>BVSS: remove*(id, userId)
    Note right of BVSS: Vérifications :<br/>1. appartient à cet utilisateur ? (404 sinon)<br/>2. estDefaut === true ? (403 ForbiddenException)
    BVSS->>DB: DELETE
    DB-->>BVSS: ok
    BVSS-->>API: 204 No Content
    API-->>VS: HTTP 204 (pas de corps)

    VS-->>EM: (observable complète sans valeur)
    EM->>EM: reloadVehicle()<br/>→ GET /api/teams/:teamId/vehicles<br/>→ .find(id === vehicleId)
    EM->>EM: vehicleChanged.emit(reloaded)<br/>→ effect() relance loadAvailableEquipment()
```

> **Pourquoi recharger via `getAllForTeam` et non `GET /vehicles/:id` ?**
> Il n'existe pas de route `GET /vehicles/:id` retournant l'entité brute
> (il y a `GET /vehicles/:id` mais il retourne un `VehicleDetailDto` calculé, non
> directement réinjectables dans les composants). Le rechargement de liste est la
> seule voie pour obtenir l'entité brute avec ses relations fraîches.

---

## 8. Pattern hydratation + DTO — calcul du prix

### 8.1 Pourquoi une hydratation manuelle ?

Le catalogue (véhicules, armes, améliorations avec leurs prix) est en **mémoire dans
`CatalogService`**, pas en base. TypeORM ne peut pas résoudre cette relation automatiquement.
C'est le service qui **hydrate** les entités après chaque chargement depuis la DB — il
attache les objets catalogue comme propriétés transientes (non mappées) :

```typescript
// VehicleService.hydrateVehicle() — appelé après chaque findOne / findAll
private hydrateVehicle(vehicle: Vehicle): void {
  for (const imp of vehicle.improvements) {
    // Propriété transiente — pas de @Column, pas persistée
    imp.ameliorationCatalogue = this.catalogService.getAmeliorationByNomInterne(imp.nomInterne);
  }
  for (const weapon of vehicle.weapons) {
    weapon.armeCatalogue = this.catalogService.getArmeByNomInterne(weapon.nomInterne);
  }
}
```

### 8.2 Getters sur les entités — règle de gestion portée par l'objet

Une fois hydratées, les entités exposent un getter `prix` qui **encapsule la règle
de gestion** : l'objet sait lui-même combien il coûte.

```typescript
// VehicleImprovement.prix — règle : 0 si défaut, prix catalogue sinon
get prix(): number {
  if (this.estDefaut) return 0;
  return (this.ameliorationCatalogue?.prix as number) ?? 0;
}

// Weapon.prix — règle simple : prix catalogue
get prix(): number {
  return (this.armeCatalogue?.prix as number) ?? 0;
}
```

### 8.3 DTOs — sérialisation explicite via `toVehicleDto`

Les getters TypeScript **ne sont pas sérialisés** par `JSON.stringify` (ils vivent sur
le prototype, pas sur l'instance). Le contrôleur HTTP ne doit donc jamais retourner
une entité brute — il appelle `VehicleService.toVehicleDto(vehicle)` qui lit les
getters explicitement et construit un objet plain sérialisable :

```typescript
toVehicleDto(vehicle: Vehicle): VehicleDto {
  const improvements = vehicle.improvements.map((imp) => ({
    ...fields,
    estDefaut: imp.estDefaut,
    prix: imp.prix,  // ← appel du getter
  }));
  const weapons = vehicle.weapons.map((w) => ({
    ...fields,
    prix: w.prix,  // ← appel du getter
  }));
  return { id, nomInterne, teamId, createdAt, improvements, weapons };
}
```

Ce DTO est ce que tous les endpoints d'écriture (`POST /improvements`, `POST /weapons`,
`POST /vehicles`) retournent — le frontend reçoit directement `prix` sans calcul propre.

---

## 9. Règles métier par comportement

| Comportement YAML | Décorateur | Modificateur de stats | Règles de validation |
|---|---|---|---|
| `chenilles` | `ChenillesDecorator` | `vitesse_max−1`, `manoeuvrabilite+1` | Unique par véhicule ; interdit sur `char_assaut`, `helicoptere`, `gyrocoptere` |
| `belier` | `BelierDecorator` | — | Orientation **obligatoire** ; un seul Bélier par orientation |
| `belier_explosif` | `BelierExplosifDecorator` | — | Orientation **obligatoire** ; un seul Bélier Explosif par orientation |
| `membre_equipage` | `MembreEquipageDecorator` | `equipage+1` | Max = 2× équipage initial (ex : Voiture équipage 1 → max 2) |
| `blindage` | `BlindageDecorator` | `carrosserie+2` | Cumulable sans limite — aucune règle spécifique |
| `mishkin` | `EquipementMishkinDecorator` | — | Un seul équipement Mishkin par véhicule |
| `neutre` *(autres)* | `NeutralDecorator` | — | Aucune règle — pose libre dans la limite des emplacements |

### Orientation des armes

| Type d'arme | Orientation |
|---|---|
| `base`, `avancée`, `largable` | **Obligatoire** — définit l'arc de tir |
| `équipage` | **Interdite** — portée par un équipier, tir à 360° automatique |

---

## 10. Sécurité et vérification de propriété

**Principe** : tout accès à une ressource inexistante **ou** appartenant à un autre
utilisateur retourne HTTP 404 — jamais 403. Cela évite de divulguer l'existence
d'une ressource qu'on ne possède pas.

### Chaîne de propriété

```
Weapon → vehicle.team.userId === userId (requis)
VehicleImprovement → vehicle.team.userId === userId
Vehicle → team.userId === userId
Team → userId === userId
```

NestJS implémente cette vérification via une jointure TypeORM implicite :

```typescript
// WeaponService — suppression d'une arme
const weapon = await weaponRepo.findOne({
  where: { id: weaponId, vehicle: { team: { userId } } }
  //        ↑ si l'une de ces conditions échoue → null → NotFoundException
});
if (!weapon) throw new NotFoundException(`Arme #${weaponId} introuvable`);
```

La requête SQL générée effectue des `JOIN` successifs et ne retourne de ligne
que si l'ensemble de la chaîne correspond — une seule requête suffit.

---

## 11. Cycle complet illustré (vue macro)

```mermaid
sequenceDiagram
    actor User
    participant FE as Angular (Frontend)
    participant BE as NestJS (Backend)

    User->>FE: ouvre le builder (création)
    FE->>BE: GET /api/catalog/sponsors/:nom
    BE-->>FE: Sponsor (véhicules[], armes[], ameliorations[])

    User->>FE: choisit "Voiture"
    FE->>BE: POST /api/teams/5/vehicles { nomInterne: "voiture" }
    BE-->>FE: Vehicle { id: 42, improvements: [], weapons: [] }

    FE->>BE: GET /api/vehicles/42/available-weapons (en parallèle)
    FE->>BE: GET /api/vehicles/42/available-improvements (en parallèle)
    BE-->>FE: AvailableWeaponDto[] (avec disponible + raison)
    BE-->>FE: AvailableImprovementDto[] (avec disponible + raison)

    User->>FE: clique "Bélier" → choisit orientation "avant"
    FE->>BE: POST /api/vehicles/42/improvements { nomInterne:"belier", orientation:"avant" }
    BE-->>FE: Vehicle rechargé (improvements: [Bélier avant])

    FE->>BE: GET /api/vehicles/42/available-weapons (rechargement)
    FE->>BE: GET /api/vehicles/42/available-improvements (rechargement)
    BE-->>FE: listes mises à jour (ex : "Bélier avant" désormais grisé)

    User->>FE: clique "Mitrailleuse" → choisit orientation "arrière"
    FE->>BE: POST /api/vehicles/42/weapons { nomInterne:"mitrailleuse", orientation:"arrière" }
    BE-->>FE: Vehicle rechargé (weapons: [Mitrailleuse arrière])

    User->>FE: clique "Terminer"
    FE->>FE: done.emit()
    FE->>BE: GET /api/teams/5/vehicles (rechargement liste équipe)
    BE-->>FE: Vehicle[] (vehicleCount mis à jour → sponsor verrouillé)
```

---

## 12. Fichiers clés de référence

### Backend

| Fichier | Rôle |
|---------|------|
| `apps/backend/src/app/vehicle/vehicle.entity.ts` | Entité `Vehicle` + relation vers `Team`, `VehicleImprovement`, `Weapon` |
| `apps/backend/src/app/vehicle/vehicle-improvement.entity.ts` | Entité `VehicleImprovement` |
| `apps/backend/src/app/vehicle/vehicle-build.ts` | Interface `VehicleBuild` + `CatalogVehicleBuild` |
| `apps/backend/src/app/vehicle/improvement-decorators/` | Tous les décorateurs concrets + Factory |
| `apps/backend/src/app/vehicle/vehicle.service.ts` | CRUD + `canAddImprovement` + `getAvailableImprovements` |
| `apps/backend/src/app/vehicle/vehicle.controller.ts` | Routes véhicule et améliorations |
| `apps/backend/src/app/weapon/weapon.entity.ts` | Entité `Weapon` |
| `apps/backend/src/app/weapon/weapon.service.ts` | `canAddWeapon` + `getAvailableWeapons` + `addWeapon` |
| `apps/backend/src/app/weapon/weapon.controller.ts` | Routes armes |
| `apps/backend/src/app/catalog/catalog.service.ts` | Catalogue en mémoire — `getVehiculeByNomInterne`, `getSponsorByName`, etc. |

### Frontend

| Fichier | Rôle |
|---------|------|
| `apps/frontend/src/app/teams/vehicle-builder/` | `VehicleConfigurator` (Smart) — orchestrateur création + édition |
| `apps/frontend/src/app/teams/vehicle-builder/equipment-manager/` | `EquipmentManager` (Smart) — ajout/retrait équipement |
| `apps/frontend/src/app/teams/vehicle-builder/equipment-option/` | `EquipmentOption` (Dumb) — UX sélection + orientation |
| `apps/frontend/src/app/teams/vehicle-summary.ts` | Type `VehicleSummary` — résumé pour la carte équipe |
| `apps/frontend/src/app/vehicles/vehicle.service.ts` | Tous les appels HTTP véhicule/arme/amélioration |
