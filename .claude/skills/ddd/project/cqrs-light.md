# CQRS léger — commandes vs requêtes dans ce projet

## Le principe

**CQRS** (Command Query Responsibility Segregation) sépare les opérations en deux catégories
aux chemins d'exécution complètement différents.

Dans ce projet, on applique une version **légère** : pas d'event sourcing, pas de bus de
messages — juste une distinction claire entre les deux chemins dans le même processus.

```
Commande  →  charger l'agrégat  →  muter  →  persister  →  DTO de retour
Requête   →  SQL direct         →  DTO    →  (pas d'agrégat)
```

---

## Identifier une commande vs une requête

| Opération HTTP | Type | Pourquoi |
|----------------|------|---------|
| `GET /api/teams` | Requête | Lecture seule, pas de mutation |
| `POST /api/teams` | Commande | Crée une équipe |
| `GET /api/teams/:id` | Requête | Lecture seule |
| `PUT /api/teams/:id` | Commande | Mute l'équipe |
| `DELETE /api/teams/:id` | Commande | Supprime l'équipe |
| `GET /api/vehicles/:id/available-weapons` | Requête hybride | Lit le catalogue + règles, mais ne mute pas |
| `POST /api/teams/:id/vehicles` | Commande | Ajoute un véhicule |

**Règle simple :** si l'opération modifie l'état persisté → commande. Sinon → requête.

---

## Le chemin d'une commande

```typescript
// application/add-vehicle.usecase.ts
async execute(teamId: number, userId: number, dto: AddVehicleDto): Promise<VehicleDto> {
  // 1. Valider les inputs via le catalogue (Value Object)
  const vehicleType = this.catalogRepo.getVehicleType(dto.nomInterne);
  // NotFoundException si inconnu

  // 2. Charger l'agrégat COMPLET (avec tous ses enfants)
  const team = await this.teamRepo.findByIdForUser(teamId, userId);
  // NotFoundException si l'équipe n'appartient pas à cet utilisateur

  // 3. Déléguer la règle métier à l'agrégat
  try {
    team.addVehicle(vehicleType); // DomainException si sponsor ne l'autorise pas
  } catch (e) {
    if (e instanceof DomainException) throw new BadRequestException(e.message);
    throw e;
  }

  // 4. Persister l'agrégat entier
  await this.teamRepo.save(team);

  // 5. Retourner un DTO (jamais l'agrégat directement)
  const newVehicle = team.vehicles[team.vehicles.length - 1];
  return toVehicleDto(newVehicle);
}
```

**Invariant du chemin commande :** l'agrégat est toujours chargé **avant** la mutation,
jamais après. La cohérence est garantie dans la même transaction.

---

## Le chemin d'une requête légère

```typescript
// application/get-team-summaries.usecase.ts
async execute(userId: number): Promise<TeamSummaryDto[]> {
  // SQL direct via le repository — AUCUN agrégat domaine chargé
  return this.teamRepo.findSummariesForUser(userId);
}

// infrastructure/team.repository.ts
async findSummariesForUser(userId: number): Promise<TeamSummaryDto[]> {
  return this.teamOrmRepo
    .createQueryBuilder('team')
    .select(['team.id', 'team.name', 'team.sponsor', 'team.cans', 'team.description',
             'COUNT(vehicle.id) AS "vehicleCount"',
             'COUNT(participant.id) > 0 AS "isEngaged"'])
    .leftJoin('team.vehicles', 'vehicle')
    .leftJoin('season_participants', 'participant', 'participant.teamId = team.id')
    .where('team.userId = :userId', { userId })
    .groupBy('team.id')
    .getRawMany();
}
```

**Pourquoi ne pas charger l'agrégat pour une liste ?**
- Performance : charger `Team` + `Vehicle[]` + `Weapon[]` pour afficher juste le nom et le compte de véhicules serait un surcoût énorme
- Séparation : la liste d'équipes est une **vue**, pas une donnée sur laquelle on prend des décisions

---

## Read Model — `TeamSummaryDto`

Le read model est un DTO "plat" produit directement par SQL. Il ne passe pas par l'agrégat.

```typescript
// Pas d'entité domaine — juste un DTO de vue
type TeamSummaryDto = {
  id: number;
  name: string;
  sponsor: string;
  cans: number;
  description: string | null;
  vehicleCount: number;  // COUNT SQL
  isEngaged: boolean;    // COUNT SQL sur season_participants
  createdAt: Date;
  updatedAt: Date;
};
```

**Différence avec `Team` (agrégat) :**
- `Team` agrégat → chargé pour les mutations, contient les règles métier
- `TeamSummaryDto` → chargé pour l'affichage, calculé en SQL, sans logique métier

---

## Requête hybride — lister les armes disponibles

Certaines requêtes ont besoin de l'agrégat pour calculer un verdict de disponibilité,
mais ne le mutent pas.

```typescript
// application/get-available-weapons.usecase.ts
async execute(vehicleId: number, userId: number): Promise<AvailableWeaponDto[]> {
  // Charger l'agrégat pour accéder au budget et aux slots actuels
  const team = await this.teamRepo.findByVehicleId(vehicleId, userId);

  // Le catalogue du sponsor détermine les armes candidates
  const sponsorCatalog = this.catalogRepo.getSponsor(team.sponsor);

  // Pour chaque arme, demander à l'agrégat si elle peut être ajoutée
  return sponsorCatalog.armes.map(arme => {
    const result = team.canAddWeaponToVehicle(vehicleId, new WeaponType(arme));
    return {
      ...arme,
      disponible: result.ok,
      raison: result.ok ? undefined : result.reason,
    };
  });
}
```

**C'est une requête** (pas de mutation, pas de `save`), mais elle charge l'agrégat
parce qu'elle a besoin de son état pour calculer les verdicts.

---

## Résumé — règles de décision

| Situation | Action |
|-----------|--------|
| Lire une liste pour affichage | SQL direct → DTO. Pas d'agrégat. |
| Muter quoi que ce soit | Charger l'agrégat complet → muter → save |
| Calculer un verdict de disponibilité | Charger l'agrégat → appeler `canAdd...` → pas de save |
| Retourner l'état d'un agrégat (détail) | Charger l'agrégat → mapper en DTO |
| Compter ou agréger | COUNT SQL directement dans le repository |
