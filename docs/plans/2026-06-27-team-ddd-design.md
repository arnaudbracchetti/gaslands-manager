# Refactoring Team en DDD — Conception

> Document de conception validé lors du brainstorming du 2026-06-27.
> Décrit l'architecture cible après fusion de `TeamModule` et `VehicleModule` en un seul agrégat DDD.

---

## 1. Contexte et motivation

Le module `Vehicle` a été migré vers une architecture DDD (agrégat racine, use cases, interfaces de repository). Pour des raisons de cohérence architecturale et de clarté pédagogique, `Team` doit suivre le même pattern.

Ce refactoring révèle également un problème de frontière d'agrégat : la règle *"budget restant = team.cans - Σ vehicle.cost"* est aujourd'hui calculée dans `IVehicleRepository.getRemainingBudget`, qui lit `team.cans` directement en SQL. Cette dépendance croisée signale que la frontière entre `Team` et `Vehicle` est mal placée.

---

## 2. Décision architecturale — Un seul agrégat `Team`

**Vehicle est une entité enfant de Team, pas un agrégat racine.**

Justification : un agrégat doit pouvoir enforcer ses invariantes avec ses propres données. L'invariante principale de `Vehicle` (`coût_total ≤ budget_restant_équipe`) dépend de `team.cans` et du coût de *tous* les véhicules de l'équipe — données extérieures à Vehicle. Vehicle échoue donc au test d'agrégat racine.

De plus, Vehicle n'a pas de cycle de vie indépendant : un Vehicle sans Team n'a aucun sens métier et est supprimé en cascade avec son équipe.

`Team` devient l'agrégat racine. `Vehicle`, `Weapon` et `VehicleImprovement` deviennent des entités enfants.

**Conséquence directe :**

```
Team (aggregate root)
├── id, userId, name, sponsor, cans, description
└── vehicles: Vehicle[]
      ├── id, nomInterne, type: VehicleType
      ├── weapons: Weapon[]
      └── improvements: VehicleImprovement[]
```

`budget` n'est plus passé en paramètre aux méthodes de mutation — Team le calcule lui-même :

```typescript
get remainingBudget(): number {
  return this.cans - this._vehicles.reduce((sum, v) => sum + v.cost, 0);
}
```

La règle du verrouillage du sponsor est enfin **enforcée côté backend** (et pas seulement côté frontend) :

```typescript
// domain/team.ts
update(dto: UpdateTeamCommand): void {
  if (dto.sponsor !== undefined && dto.sponsor !== this._sponsor) {
    if (this._vehicles.length > 0)
      throw new DomainException('Le sponsor ne peut plus être modifié car l\'équipe possède des véhicules');
    this._sponsor = dto.sponsor;
  }
  // ...
}
```

---

## 3. Interface `ITeamRepository`

```typescript
interface ITeamRepository {
  // ── Requêtes légères (sans domaine) ──────────────────────────────────────
  /** Retourne la liste des équipes avec vehicleCount et isEngaged — calcul SQL, pas d'agrégat. */
  findSummariesForUser(userId: number): Promise<TeamSummaryDto[]>;
  /** Retourne un TeamSummaryDto à jour après mutation. */
  findSummaryById(teamId: number): Promise<TeamSummaryDto>;

  // ── Chargement complet de l'agrégat (pour les mutations) ─────────────────
  /** Charge Team + tous ses Vehicles + Weapons + Improvements. */
  findByIdForUser(teamId: number, userId: number): Promise<Team>;
  /** Point d'entrée par vehicleId — navigue jusqu'au Team racine. */
  findByVehicleId(vehicleId: number, userId: number): Promise<Team>;
  /** Point d'entrée par weaponId — pour DELETE /api/weapons/:id. */
  findByWeaponId(weaponId: number, userId: number): Promise<Team>;

  // ── Persistance ───────────────────────────────────────────────────────────
  /** Sauvegarde Team complet (cascade sur Vehicle, Weapon, VehicleImprovement). */
  save(team: Team): Promise<Team>;
  /** Supprime l'équipe et tout son contenu (cascade). */
  remove(teamId: number, userId: number): Promise<void>;
}
```

`findByVehicleId` et `findByWeaponId` chargent toujours l'agrégat **complet** (Team + tous ses vehicles) — c'est le trade-off de l'approche un-seul-agrégat. Pour Gaslands (3–5 véhicules par équipe), ce surcoût est négligeable.

---

## 4. Distinction requêtes / commandes (CQRS léger)

`GET /api/teams` ne charge pas d'agrégat domaine — c'est une **requête de liste** :

```typescript
// application/get-team-summaries.usecase.ts
async execute(userId: number): Promise<TeamSummaryDto[]> {
  return this.teamRepo.findSummariesForUser(userId);
  // SQL unique avec COUNT imbriqués — vehicleCount + isEngaged calculés en base
}
```

`TeamSummaryDto` est un **read model** (pas un agrégat domain) :

```typescript
type TeamSummaryDto = {
  id: number; name: string; sponsor: string; cans: number; description: string | null;
  vehicleCount: number; isEngaged: boolean; createdAt: Date; updatedAt: Date;
};
```

Toutes les **mutations** (create, update, addVehicle, addWeapon…) chargent l'agrégat complet via `findByIdForUser` / `findByVehicleId` / `findByWeaponId`.

---

## 5. Structure des modules

```
apps/backend/src/app/team/
├── domain/
│   ├── team.ts                          ← agrégat racine (NOUVEAU)
│   ├── vehicle.ts                       ← entité enfant (ex-vehicle/domain/vehicle.ts, simplifié)
│   ├── weapon.ts                        ← entité enfant (ex-vehicle/domain/weapon.ts)
│   ├── improvement.ts                   ← entité enfant (ex-vehicle/domain/improvement.ts)
│   ├── value-objects/                   ← déménagent de vehicle/domain/value-objects/
│   │   ├── vehicle-type.ts
│   │   ├── weapon-type.ts
│   │   └── improvement-type.ts
│   ├── team.repository.interface.ts     ← NOUVEAU (remplace IVehicleRepository)
│   └── catalog.repository.interface.ts  ← déménage de vehicle/domain/
│
├── application/
│   ├── get-team-summaries.usecase.ts    ← read model (pas d'agrégat)
│   ├── create-team.usecase.ts
│   ├── update-team.usecase.ts           ← enforce sponsor lock via domaine
│   ├── remove-team.usecase.ts
│   ├── add-vehicle.usecase.ts           ← ex-create-vehicle.usecase.ts
│   ├── remove-vehicle.usecase.ts
│   ├── get-vehicle-detail.usecase.ts
│   ├── get-available-weapons.usecase.ts
│   ├── add-weapon.usecase.ts
│   ├── remove-weapon.usecase.ts
│   ├── get-available-improvements.usecase.ts
│   ├── add-improvement.usecase.ts
│   ├── remove-improvement.usecase.ts
│   ├── assign-weapon-to-tourelle.usecase.ts
│   └── unassign-weapon-from-tourelle.usecase.ts
│
├── infrastructure/
│   ├── entities/
│   │   ├── team.entity.ts               ← (était team/team.entity.ts)
│   │   ├── vehicle.entity.ts            ← déménage de vehicle/vehicle.entity.ts
│   │   └── weapon.entity.ts             ← déménage de weapon/weapon.entity.ts
│   ├── team.repository.ts               ← implémentation TypeORM (remplace VehicleRepository)
│   ├── team.mapper.ts                   ← ORM ↔ agrégat Team complet (ex-vehicle.mapper.ts)
│   ├── catalog.adapter.ts               ← déménage de vehicle/infrastructure/
│   └── team-http.mapper.ts             ← agrégat → DTOs HTTP (ex-vehicle-http.mapper.ts)
│
├── dto/                                 ← tous les DTOs regroupés ici
│   ├── team-summary.dto.ts              ← NOUVEAU : read model
│   ├── create-team.dto.ts
│   ├── update-team.dto.ts
│   └── ... (DTOs véhicules, armes, améliorations)
│
├── team.controller.ts                   ← routes /api/teams (inchangées en surface)
├── vehicle-team.controller.ts           ← déménage de vehicle/
├── vehicle.controller.ts                ← déménage de vehicle/
├── weapon.controller.ts                 ← déménage de vehicle/ et weapon/
├── team.module.ts                       ← câble tout (use cases useFactory, tous les controllers)
└── team.tokens.ts                       ← TEAM_REPOSITORY, CATALOG_REPOSITORY
```

**Ce qui disparaît :** `apps/backend/src/app/vehicle/` et `apps/backend/src/app/weapon/` (entièrement dissouts).

**Ce qui ne change pas :** `SeasonModule`, `CatalogModule`, `AuthModule`, `ContentModule`, `GameModule` — non touchés.

---

## 6. Use cases clés

### `UpdateTeamUseCase` — sponsor lock côté backend

```typescript
async execute(teamId: number, userId: number, dto: UpdateTeamDto): Promise<TeamSummaryDto> {
  const team = await this.teamRepo.findByIdForUser(teamId, userId);
  // team._vehicles chargés → team.update() peut enforcer le sponsor lock
  team.update(dto);  // DomainException si sponsor change avec véhicules présents
  await this.teamRepo.save(team);
  return this.teamRepo.findSummaryById(teamId);
}
```

### `AddWeaponUseCase` — budget sans paramètre externe

```typescript
async execute(vehicleId: number, userId: number, dto: AddWeaponDto): Promise<void> {
  const weaponType = this.catalogRepo.getWeaponType(dto.nomInterne);
  const team = await this.teamRepo.findByVehicleId(vehicleId, userId);
  // team.addWeaponToVehicle calcule this.remainingBudget = this.cans - Σ vehicles.cost
  team.addWeaponToVehicle(vehicleId, weaponType, dto.orientation ?? null);
  await this.teamRepo.save(team);
}
```

Tous les use cases de mutation sur Weapon/Improvement suivent le même pattern : `findByVehicleId` ou `findByWeaponId` → muter l'agrégat → sauvegarder.

### `GetTeamSummariesUseCase` — read model pur

```typescript
async execute(userId: number): Promise<TeamSummaryDto[]> {
  return this.teamRepo.findSummariesForUser(userId);
}
```

Aucun agrégat chargé. `TeamRepository.findSummariesForUser` fait une seule requête SQL avec `COUNT` imbriqués.

---

## 7. Cascade TypeORM et mapper

Les entités ORM utilisent `cascade: true` + `orphanedRowAction: 'delete'` sur chaque niveau de la hiérarchie :

```typescript
// infrastructure/entities/team.entity.ts
@OneToMany(() => VehicleOrm, v => v.team, { cascade: true, orphanedRowAction: 'delete' })
vehicles: VehicleOrm[];

// infrastructure/entities/vehicle.entity.ts
@OneToMany(() => WeaponOrm, w => w.vehicle, { cascade: true, orphanedRowAction: 'delete' })
weapons: WeaponOrm[];
@OneToMany(() => VehicleImprovementOrm, i => i.vehicle, { cascade: true, orphanedRowAction: 'delete' })
improvements: VehicleImprovementOrm[];
```

`TeamMapper.toOrm(team)` reconstruit la hiérarchie ORM complète en préservant les `id` existants (TypeORM distingue INSERT vs UPDATE par l'id). Un seul `teamOrmRepo.save(teamOrm)` suffit pour propager toutes les mutations.

---

## 8. Stratégie de migration

> Migration en 5 phases sur une branche dédiée.
> Les tests E2E (`npx nx e2e backend-e2e`) doivent passer à la fin de chaque phase.

**Phase 1 — Skeleton Team DDD** (sans toucher VehicleModule)
Créer `team/domain/team.ts`, `team/domain/team.repository.interface.ts`, `team/infrastructure/team.repository.ts`, `team/infrastructure/team.mapper.ts`. Aucune suppression de code existant.

**Phase 2 — Migrer les use cases Vehicle → Team**
Recréer chaque use case dans `team/application/` en utilisant `ITeamRepository`. Tests unitaires écrits pour chaque use case.

**Phase 3 — Câbler TeamModule (DDD) et basculer les controllers**
Mettre à jour `team/team.module.ts` : use cases en `useFactory`, tous les controllers (team, vehicle, weapon) déclarés dans ce module.

**Phase 4 — Supprimer VehicleModule**
Supprimer `apps/backend/src/app/vehicle/` et `apps/backend/src/app/weapon/`. Retirer les imports de `app.module.ts`. Valider : tous les E2E passent.

**Phase 5 — Enforcer le sponsor lock**
`team.update(dto)` lève `DomainException` si sponsor change et `vehicles.length > 0`. Ajouter le test E2E correspondant. Cette règle est désormais garantie côté backend.

---

## 9. Ce qui ne change pas

- **Routes HTTP** — aucun changement côté API (`/api/teams`, `/api/vehicles/:id`, `/api/weapons/:id`, etc.)
- **Frontend** — aucun changement (l'API surface est identique)
- **Modules non touchés** — `SeasonModule`, `GameModule`, `CatalogModule`, `AuthModule`, `ContentModule`
- **Value Objects** — `VehicleType`, `WeaponType`, `ImprovementType` déménagent dans `team/domain/value-objects/` mais leur code est inchangé
