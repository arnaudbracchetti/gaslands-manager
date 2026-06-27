# Patterns NestJS — câblage DDD dans ce projet

## Structure de dossiers — le modèle à reproduire

```
apps/backend/src/app/<module>/
├── domain/
│   ├── <aggregate>.ts                  ← agrégat racine (0 dépendance NestJS/TypeORM)
│   ├── <entity>.ts                     ← entités enfants
│   ├── value-objects/                  ← Value Objects immuables
│   ├── <module>.repository.interface.ts ← contrat persistence (interface TS)
│   └── catalog.repository.interface.ts  ← contrat catalogue (interface TS)
│
├── application/
│   ├── <command>.usecase.ts            ← un fichier par commande
│   └── get-<list>.usecase.ts           ← requête légère (read model)
│
├── infrastructure/
│   ├── entities/
│   │   └── <name>.entity.ts            ← entités TypeORM (jamais exposées au domaine)
│   ├── <module>.repository.ts          ← implémente IXxxRepository avec TypeORM
│   ├── <module>.mapper.ts              ← ORM ↔ domaine
│   ├── catalog.adapter.ts              ← CatalogService → ICatalogRepository
│   └── <module>-http.mapper.ts         ← agrégat domaine → DTOs HTTP
│
├── <module>.tokens.ts                  ← tokens string d'injection
└── <module>.module.ts                  ← câble tout (providers, exports, controllers)
```

**Référence :** `apps/backend/src/app/vehicle/` — modèle à copier exactement.

---

## Tokens d'injection

Les interfaces TypeScript (`ITeamRepository`) ne sont pas injectables par NestJS —
`emitDecoratorMetadata` émet `Object` pour les types (pas les valeurs).
Solution : tokens **string** (ou `Symbol`).

```typescript
// team.tokens.ts
export const TEAM_REPOSITORY = 'TEAM_REPOSITORY';
export const CATALOG_REPOSITORY = 'CATALOG_REPOSITORY';
```

---

## Câblage du module — `useFactory` obligatoire

Les use cases vivent dans `domain/` ou `application/` — **sans décorateur NestJS**.
Pour les injecter, utiliser `useFactory` :

```typescript
// team.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([TeamOrm, VehicleOrm, WeaponOrm, ImprovementOrm])],
  providers: [
    // Infrastructure — utilise useClass (NestJS gère l'instanciation)
    { provide: TEAM_REPOSITORY, useClass: TeamRepository },
    { provide: CATALOG_REPOSITORY, useClass: CatalogAdapter },

    // Use cases — useFactory car pas de décorateurs dans le domaine
    {
      provide: AddWeaponUseCase,
      useFactory: (teamRepo: ITeamRepository, catalogRepo: ICatalogRepository) =>
        new AddWeaponUseCase(teamRepo, catalogRepo),
      inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY],
    },
    {
      provide: CreateTeamUseCase,
      useFactory: (teamRepo: ITeamRepository) => new CreateTeamUseCase(teamRepo),
      inject: [TEAM_REPOSITORY],
    },
    // ... un provider par use case
  ],
  controllers: [TeamController, VehicleTeamController, VehicleController, WeaponController],
})
export class TeamModule {}
```

**Règle :** jamais `@Injectable()` dans `domain/` ou `application/`. Ces couches
ne connaissent pas NestJS.

---

## `import { X }` vs `import type { X }`

**Règle absolue :** utiliser `import { X }` (jamais `import type`) pour toute classe
instanciée par le conteneur NestJS.

```typescript
// ❌ Provoque UnknownDependenciesException au démarrage
import type { TeamRepository } from './infrastructure/team.repository';

// ✅ Correct — emitDecoratorMetadata émet le bon type
import { TeamRepository } from './infrastructure/team.repository';
```

**Pourquoi ?** `import type` est effacé à la compilation. `emitDecoratorMetadata`
ne voit plus la classe → injecte `Object` → NestJS ne sait pas quoi injecter.

**Seule exception :** les interfaces pures et les DTOs utilisés uniquement comme types.

---

## `DomainException` → `BadRequestException`

Le domaine lève `DomainException` (classe pure, sans dépendance NestJS).
La conversion HTTP se fait **uniquement dans le use case** :

```typescript
// application/add-weapon.usecase.ts
try {
  team.addWeaponToVehicle(vehicleId, weaponType, orientation);
} catch (e) {
  if (e instanceof DomainException) throw new BadRequestException(e.message);
  throw e; // re-lancer les erreurs inattendues
}
```

**Jamais dans :** l'agrégat, le repository, le mapper, ou le controller.
**Une seule responsabilité :** le use case est le seul endroit où NestJS "rencontre" le domaine.

---

## Mapper ORM ↔ domaine

Deux mappers distincts :

### `team.mapper.ts` — ORM ↔ agrégat domaine

```typescript
// infrastructure/team.mapper.ts
export class TeamMapper {
  static toDomain(orm: TeamOrm): Team {
    return new Team(
      orm.id, orm.userId, orm.name, orm.sponsor, orm.cans,
      orm.vehicles.map(VehicleMapper.toDomain),
    );
  }

  static toOrm(team: Team): TeamOrm {
    const orm = new TeamOrm();
    orm.id = team.id;
    // ... préserver les id pour que TypeORM distingue INSERT vs UPDATE
    orm.vehicles = team.vehicles.map(VehicleMapper.toOrm);
    return orm;
  }
}
```

**Point clé :** `toOrm` doit préserver les `id` existants sur les entités enfants.
TypeORM détermine INSERT vs UPDATE à partir de la présence de l'`id`. Un enfant
sans `id` sera inséré même s'il existait déjà → doublon.

### `team-http.mapper.ts` — agrégat domaine → DTOs HTTP

Traduit le résultat des use cases en DTOs sérialisables. Jamais retourner une
entité ORM brute ni un agrégat domaine directement dans les controllers.

---

## `orphanedRowAction: 'delete'` — cascade de suppression

Pour que TypeORM supprime automatiquement les entités enfants retirées de la collection :

```typescript
// infrastructure/entities/team.entity.ts
@OneToMany(() => VehicleOrm, v => v.team, {
  cascade: true,
  orphanedRowAction: 'delete', // supprime les Vehicle retirés du tableau
})
vehicles: VehicleOrm[];
```

Sans cette option, retirer un `Vehicle` de `team.vehicles` et faire `save(team)`
ne supprime pas la ligne en base — elle devient orpheline.

---

## CatalogAdapter — pont entre CatalogService et le domaine

`CatalogService` (module `catalog/`) est un service NestJS. Le domaine ne peut
pas en dépendre directement. L'adapter fait le pont :

```typescript
// infrastructure/catalog.adapter.ts
@Injectable()
export class CatalogAdapter implements ICatalogRepository {
  constructor(private readonly catalogService: CatalogService) {}

  getVehicleType(nomInterne: string): VehicleType {
    const raw = this.catalogService.getVehiculeByNomInterne(nomInterne);
    if (!raw) throw new NotFoundException(`Véhicule inconnu : ${nomInterne}`);
    return new VehicleType(raw); // ← construit le VO depuis la donnée catalogue brute
  }
  // ...
}
```
