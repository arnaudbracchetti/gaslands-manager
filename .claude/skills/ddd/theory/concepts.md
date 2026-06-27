# Concepts DDD — référence

## Les 6 blocs de construction

### 1. Agrégat racine (Aggregate Root)

L'unité de cohérence transactionnelle. Toutes les mutations passent par lui.

**Règles :**
- Seul l'agrégat racine est accessible depuis l'extérieur (pas d'accès direct aux enfants)
- Les invariantes de l'agrégat sont **toujours vraies**, avant et après chaque mutation
- Le repository ne persiste que des agrégats racines (jamais une entité enfant isolément)
- Une transaction = une mutation sur un seul agrégat

**Dans ce projet :**
- `Team` est l'agrégat racine (contient `Vehicle[]`, qui contient `Weapon[]` et `VehicleImprovement[]`)
- `Season` est un agrégat racine (contient `SeasonParticipant[]` et `Game[]`)
- `Vehicle` était traité comme agrégat racine mais ne l'est pas — c'est le bug d'architecture corrigé par le refactoring

---

### 2. Entité enfant (Entity)

Un objet avec une identité (`id`) mais dont le cycle de vie est gouverné par son agrégat racine.

**Caractéristiques :**
- A un `id` qui le distingue des autres entités du même type
- Ne peut pas être créé ou supprimé sans passer par l'agrégat racine
- Ses mutations passent par des méthodes de l'agrégat (jamais directement)

**Dans ce projet :**
- `Vehicle` est une entité enfant de `Team`
- `Weapon` est une entité enfant de `Vehicle` (donc petite-fille de `Team`)
- `VehicleImprovement` est une entité enfant de `Vehicle`
- `SeasonParticipant` est une entité enfant de `Season`
- `Game` est une entité enfant de `Season`

**Test :** "Puis-je supprimer cette entité sans supprimer son parent ?" — Si non → entité enfant.

---

### 3. Value Object (VO)

Un objet défini par sa **valeur**, pas par son identité. Immuable.

**Caractéristiques :**
- Pas d'`id` — deux VO avec les mêmes données sont identiques
- Immuable : on ne modifie pas un VO, on en crée un nouveau
- Encapsule une règle de validation (ex : une orientation ne peut être que `avant/arrière/gauche/droite`)
- Expose une API métier typée plutôt que des données brutes

**Dans ce projet :**
```typescript
// apps/backend/src/app/vehicle/domain/value-objects/
class WeaponType {
  readonly nom: string;
  readonly prix: number;
  readonly emplacement: number;
  readonly isEquipage: boolean;
  readonly requiresOrientation: boolean;
  readonly isTourelle: boolean; // faux — Tourelle est une amélioration, pas une arme
}
```

**VO vs Entité :**
| | Value Object | Entité |
|---|---|---|
| Identité | Non (défini par valeur) | Oui (défini par `id`) |
| Mutabilité | Immuable | Mutable (via l'agrégat) |
| Égalité | Structurelle | Par `id` |
| Exemple projet | `WeaponType`, `Orientation` | `Vehicle`, `Weapon` |

**Quand créer un VO :** dès qu'une donnée a des règles de validation ou encapsule un calcul
(ex : `Budget` avec `remaining`, `isExceeded`).

---

### 4. Use Case (Application Service)

Orchestre une commande métier. Ne contient **aucune règle métier**.

**Flux systématique :**
```
1. Charger l'agrégat (vérifie l'appartenance userId)
2. Valider les Value Objects depuis le catalogue
3. Déléguer à l'agrégat → DomainException éventuelle
4. Persister via le repository
```

**Ce qu'un use case NE fait PAS :**
- Calculer un budget
- Vérifier une règle de disponibilité d'équipement
- Décider si une opération est autorisée

**Ce qu'un use case fait :**
- Charger les données nécessaires (agrégat + catalogue)
- Appeler la bonne méthode de domaine
- Convertir `DomainException` → `BadRequestException` (seul endroit de ce mapping)
- Persister et retourner le DTO

```typescript
// ✅ Use case bien formé
class AddWeaponUseCase {
  async execute(vehicleId: number, userId: number, dto: AddWeaponDto): Promise<void> {
    const weaponType = this.catalogRepo.getWeaponType(dto.nomInterne); // VO depuis catalogue
    const team = await this.teamRepo.findByVehicleId(vehicleId, userId); // charger l'agrégat
    try {
      team.addWeaponToVehicle(vehicleId, weaponType, dto.orientation ?? null); // déléguer
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message); // mapper
      throw e;
    }
    await this.teamRepo.save(team); // persister
  }
}
```

---

### 5. Domain Service

Logique métier qui implique plusieurs agrégats, mais qui ne "appartient" naturellement à aucun.

**Rare** — à n'utiliser que si la logique ne peut pas vivre dans un agrégat.

**Dans ce projet :** aucun domain service explicite pour l'instant. La règle budget vit
dans `Team` (l'agrégat qui possède `cans` et tous les `vehicles`). Si deux agrégats devaient
collaborer, un domain service serait approprié.

---

### 6. Repository (interface)

Contrat de persistence défini **par le domaine**, implémenté par l'infrastructure.

**Règles :**
- L'interface vit dans `domain/` (pas de dépendance TypeORM)
- L'implémentation vit dans `infrastructure/`
- Le domaine ne sait pas que TypeORM existe
- Un repository charge et sauvegarde des **agrégats complets** (pas des entités enfants isolément)
- Les requêtes légères (listes, comptages) peuvent retourner des DTOs directement — pas d'agrégat

**Pattern de l'interface dans ce projet :**
```typescript
// domain/team.repository.interface.ts
export interface ITeamRepository {
  // Requêtes légères (lecture seule, pas d'agrégat)
  findSummariesForUser(userId: number): Promise<TeamSummaryDto[]>;

  // Chargement d'agrégat (pour toute mutation)
  findByIdForUser(teamId: number, userId: number): Promise<Team>;
  findByVehicleId(vehicleId: number, userId: number): Promise<Team>;
  findByWeaponId(weaponId: number, userId: number): Promise<Team>;

  // Persistance
  save(team: Team): Promise<void>;
  remove(teamId: number, userId: number): Promise<void>;
}
```

**Pourquoi séparer les entrées par `vehicleId`/`weaponId` ?**
Les routes HTTP exposent `/api/vehicles/:id` et `/api/weapons/:id`. Le repository
navigue jusqu'à l'agrégat `Team` depuis ces IDs enfants — le contrôleur ne sait
pas à quel `teamId` ils appartiennent.

---

## Résumé visuel — qui fait quoi

```
Controller        → HTTP uniquement (extraire params, renvoyer DTO)
     ↓
Use Case          → orchestration (charger, déléguer, persister)
     ↓
Aggregate Root    → invariantes, règles métier (lève DomainException)
  └─ Entity       → données avec identité, muté via l'agrégat
  └─ Value Object → données immuables, typées, validées
     ↓
Repository (IF)   → contrat de persistence (domain/)
     ↓
Repository (IMPL) → TypeORM (infrastructure/)
     ↓
Catalog Adapter   → CatalogService → ICatalogRepository (infrastructure/)
```
