# Identifier et délimiter un agrégat

## Les 3 tests à appliquer

### Test 1 — Cycle de vie indépendant

> "Cet objet peut-il être créé, modifié et supprimé indépendamment ?"

| Objet | Peut exister seul ? | Verdict |
|-------|---------------------|---------|
| `Team` | Oui — créé par l'utilisateur directement | Agrégat racine ✅ |
| `Vehicle` | Non — un véhicule sans équipe n'a aucun sens | Entité enfant ✅ |
| `Weapon` | Non — une arme sans véhicule n'a aucun sens | Entité enfant ✅ |
| `Season` | Oui — créée par l'organisateur directement | Agrégat racine ✅ |
| `Game` | Non — une partie sans saison n'a aucun sens | Entité enfant ✅ |

### Test 2 — Invariantes avec ses propres données

> "Peut-il enforcer ses invariantes en n'utilisant que ses propres données ?"

C'est le test le plus révélateur. Exemple avec l'ancien design :

```
// ❌ Ancien design — Vehicle "agrégat racine"
// L'invariante "coût total ≤ budget" dépend de :
//   - team.cans              → donnée EXTÉRIEURE à Vehicle
//   - coût de TOUS les véhicules de l'équipe → données EXTÉRIEURES à Vehicle
// → Vehicle ÉCHOUE le test d'agrégat racine

// ✅ Nouveau design — Team agrégat racine
// L'invariante "coût total ≤ budget" dépend de :
//   - this.cans              → donnée DE l'agrégat Team
//   - this._vehicles.reduce(...) → données DE l'agrégat Team
// → Team PASSE le test
get remainingBudget(): number {
  return this.cans - this._vehicles.reduce((sum, v) => sum + v.cost, 0);
}
```

### Test 3 — Suppression en cascade

> "Quand le parent est supprimé, l'enfant doit-il l'être aussi ?"

- `Team` supprimé → ses `Vehicle` sont supprimés → entité enfant
- `Vehicle` supprimé → ses `Weapon` et `VehicleImprovement` sont supprimés → entités enfants
- `Season` supprimée → ses `SeasonParticipant` et `Game` sont supprimés → entités enfants

---

## La frontière d'agrégat — questions de granularité

### Trop petit (frontière trop étroite)

**Symptôme :** les règles métier nécessitent des données d'un autre agrégat pour être validées.

**Exemple :** `Vehicle` comme agrégat racine (ancien design).
- `addWeapon` doit vérifier le budget → lit `team.cans` → dépendance inter-agrégats
- Solution : fusionner `Vehicle` dans `Team`

### Trop grand (frontière trop large)

**Symptôme :** l'agrégat charge des centaines d'entités pour une simple mutation.

**Exemple hypothétique :** si `Season` incluait tous les `Vehicle` de tous les participants.
- `addGame` chargerait l'arbre entier → surcoût mémoire/SQL inutile
- Solution : `Season` ne connaît que les `SeasonParticipant` (les véhicules restent dans `Team`)

**Règle pratique pour ce projet :** une équipe a 3–8 véhicules, chacun avec ~5 armes/améliorations.
Charger l'agrégat `Team` complet = ~50 entités max → coût négligeable. Au-delà de ~200 entités
enfants, revoir la frontière.

---

## Anti-patterns courants

### Anti-pattern 1 — La règle métier dans le service

```typescript
// ❌ Règle métier dans le service
class VehicleService {
  async addWeapon(vehicleId, userId, dto) {
    const vehicle = await this.repo.findOne(vehicleId);
    const remainingBudget = await this.getRemainingBudget(vehicle, userId); // ← règle ici
    if (dto.prix > remainingBudget) throw new BadRequestException('Budget dépassé');
    // ...
  }
}

// ✅ Règle métier dans l'agrégat
class Team {
  addWeaponToVehicle(vehicleId, weaponType, orientation) {
    const vehicle = this.findVehicle(vehicleId);
    if (weaponType.prix > this.remainingBudget) // ← règle ici, dans le domaine
      throw new DomainException('Budget insuffisant');
    vehicle.addWeapon(weaponType, orientation);
  }
}
```

### Anti-pattern 2 — Le repository qui calcule des règles métier

```typescript
// ❌ Règle métier dans le repository
class VehicleRepository {
  async getRemainingBudget(vehicle, userId): Promise<number> {
    // calcul SQL qui lit team.cans et somme les coûts → logique métier dans l'infra
  }
}

// ✅ Règle dans l'agrégat, repository ne fait que charger
class TeamRepository {
  async findByIdForUser(teamId, userId): Promise<Team> {
    // charge Team + tous ses Vehicle + leurs Weapon/Improvement
    // Team.remainingBudget calcule lui-même depuis ses données
  }
}
```

### Anti-pattern 3 — Accès direct à une entité enfant depuis l'extérieur

```typescript
// ❌ Accès direct à Vehicle depuis le controller
const vehicle = await vehicleRepo.findOne(vehicleId); // Vehicle est une entité enfant
await weaponRepo.save(new Weapon({ vehicleId, ... })); // bypass l'agrégat

// ✅ Toujours passer par l'agrégat racine
const team = await teamRepo.findByVehicleId(vehicleId, userId);
team.addWeaponToVehicle(vehicleId, weaponType, orientation); // via l'agrégat
await teamRepo.save(team);
```

### Anti-pattern 4 — Getter avec hydratation implicite

```typescript
// ❌ Getter qui dépend d'une donnée transiente non garantie
class VehicleImprovement {
  ameliorationCatalogue?: Amelioration; // peuplé "parfois" par le service

  get prix(): number {
    return (this.ameliorationCatalogue?.prix as number) ?? 0; // retourne 0 si oublié !
  }
}

// ✅ Value Object qui encapsule la donnée catalogue dès la création
class ImprovementType {
  constructor(readonly prix: number, readonly emplacement: number, ...) {}
}
// Le VO est passé en argument, l'agrégat ne dépend pas d'une hydratation extérieure
```

---

## Checklist avant de valider la frontière

- [ ] L'agrégat peut-il enforcer **toutes** ses invariantes sans lire de données extérieures ?
- [ ] Toutes les mutations passent-elles par l'agrégat racine (jamais directement sur les enfants) ?
- [ ] La taille de l'agrégat chargé est-elle raisonnable (< ~200 entités) ?
- [ ] Les entités enfants sont-elles supprimées en cascade avec leur racine ?
- [ ] Aucun service ne contient de règle métier (seulement de l'orchestration) ?
- [ ] Les getters de l'agrégat n'ont pas de dépendances implicites non garanties ?
