---
name: ddd
description: "Guide de conception Domain-Driven Design pour Gaslands Manager — théorie DDD + patterns NestJS du projet. Invoquer avant toute nouvelle fonctionnalité backend."
---

# Skill — Domain-Driven Design

## Quand invoquer ce skill

- Avant d'écrire la moindre ligne de code pour un nouveau module backend
- Quand on débat "où mettre cette règle métier ?" (service ? entité ? use case ?)
- Quand on ajoute une nouvelle entité ou relation qui touche un agrégat existant
- Quand on sent qu'un service grossit et devient flou dans ses responsabilités

---

## Les 7 questions à poser avant de coder

Ce sont les questions de conception fondamentales. Ne pas sauter d'étape.

### 1. Qui garantit l'invariante ?

> Une **invariante** est une règle qui doit **toujours** être vraie, quelle que soit
> l'opération effectuée. Exemple : "le coût total des véhicules ne dépasse pas le budget".

- Si la règle peut être vérifiée avec les données de l'objet lui-même → **agrégat** (méthode domaine)
- Si elle nécessite des données extérieures → mauvaise frontière d'agrégat (redesigner)
- Si c'est une règle de coordination entre entités → **use case** (orchestration)

### 2. Peut-il exister sans son parent ?

> Test du cycle de vie indépendant.

- Un `Vehicle` sans `Team` n'a aucun sens métier → **entité enfant** de `Team`
- Une `Season` sans aucun utilisateur peut être créée → **agrégat racine**
- Si la suppression du parent supprime l'enfant en cascade → entité enfant

### 3. Y a-t-il un cycle de vie indépendant ?

> Un agrégat racine se crée, évolue et disparaît selon ses propres règles.

- Peut-il être créé sans l'autre entité ?
- Peut-il persister si l'autre entité est supprimée ?
- A-t-il son propre flux d'états (`EN_CONSTRUCTION → EN_COURS → TERMINEE`) ?

### 4. Suis-je en train de valider dans un service ou dans le domaine ?

> La règle "le sponsor ne peut pas changer si des véhicules existent" appartient à
> l'agrégat `Team`, pas au `TeamService`.

- La logique métier (`canAdd`, `validate`, `throw DomainException`) → **`domain/`**
- L'orchestration (charger, appeler le domaine, sauvegarder) → **`application/`**
- Si un service contient des `if` métier → mauvais signal

### 5. Le repository charge-t-il assez pour que l'agrégat décide seul ?

> L'agrégat doit avoir toutes ses données pour enforcer ses invariantes.

- Pour toute **mutation**, charger l'agrégat **complet** (tous les enfants)
- Un `addWeapon` a besoin de `Team` + `Vehicle[]` + leurs `Weapon[]` pour calculer `remainingBudget`
- Pour une **requête de liste**, pas d'agrégat : requête SQL directe → read model (CQRS léger)

### 6. Est-ce une commande ou une requête ?

> Distinction fondamentale : une commande mute l'état, une requête le lit.

- **Commande** → charge l'agrégat complet → mute → sauvegarde
- **Requête** → SQL direct → DTO → pas d'agrégat domaine impliqué
- `GET /api/teams` est une requête → `findSummariesForUser()` retourne un `TeamSummaryDto[]`, aucun agrégat chargé
- `POST /api/teams/:id/vehicles` est une commande → `findByIdForUser()` → `team.addVehicle(...)` → `save(team)`

### 7. Mon use case orchestre-t-il, ou applique-t-il une règle métier ?

> Un use case ne doit contenir **aucune règle métier**. Il orchestre.

```typescript
// ✅ Use case qui orchestre
async execute(teamId, userId, dto) {
  const team = await this.teamRepo.findByIdForUser(teamId, userId); // charger
  const vehicleType = this.catalogRepo.getVehicleType(dto.nomInterne); // valider les inputs
  team.addVehicle(vehicleType); // ← règle métier dans l'AGRÉGAT, pas ici
  await this.teamRepo.save(team); // persister
}

// ❌ Use case qui porte une règle métier
async execute(teamId, userId, dto) {
  const team = await this.teamRepo.findByIdForUser(teamId, userId);
  if (team.vehicles.length >= MAX_VEHICLES) throw new Error(...); // ← règle ici = mauvais
  // ...
}
```

---

## Workflow de conception en 5 étapes

### Étape 1 — Identifier l'agrégat racine

Appliquer les 3 tests :
- Test cycle de vie : peut-il exister seul ?
- Test invariantes : peut-il les enforcer avec ses propres données ?
- Test cascade : est-il supprimé avec son parent ?

→ Voir [theory/aggregate-design.md](theory/aggregate-design.md) pour les détails et anti-patterns.

### Étape 2 — Lister les invariantes

Écrire en français les règles qui ne doivent jamais être violées :
- "Le coût total des véhicules ne dépasse pas `team.cans`"
- "Le sponsor ne peut pas changer si l'équipe possède des véhicules"
- "Une arme d'équipage n'a pas d'orientation"

Ces invariantes deviendront des méthodes dans `domain/team.ts` levant `DomainException`.

### Étape 3 — Cartographier commandes et requêtes

| Opération | Type | Charge l'agrégat ? |
|-----------|------|--------------------|
| Lister les équipes | Requête | Non — SQL direct |
| Créer une équipe | Commande | Oui |
| Ajouter un véhicule | Commande | Oui |
| Lister les armes disponibles | Requête hybride | Oui (pour les règles) |

### Étape 4 — Définir l'interface de repository

Partir des besoins du domaine (pas de TypeORM dans cette étape) :

```typescript
interface ITeamRepository {
  findSummariesForUser(userId: number): Promise<TeamSummaryDto[]>; // requête légère
  findByIdForUser(teamId: number, userId: number): Promise<Team>;  // commande équipe
  findByVehicleId(vehicleId: number, userId: number): Promise<Team>; // commande véhicule
  save(team: Team): Promise<void>;
  remove(teamId: number, userId: number): Promise<void>;
}
```

→ Voir [theory/concepts.md](theory/concepts.md) pour les règles de design des repositories.

### Étape 5 — Câbler dans NestJS

Suivre le pattern `vehicle.module.ts` exactement :
1. Créer `xxx.tokens.ts` avec les tokens string
2. Déclarer les repositories en `useClass`
3. Déclarer les use cases en `useFactory` (domaine sans décorateurs)

→ Voir [project/nestjs-patterns.md](project/nestjs-patterns.md) pour le code exact.

---

## Références

| Sujet | Fichier |
|-------|---------|
| Concepts DDD (agrégat, entité, VO, use case, repository) | [theory/concepts.md](theory/concepts.md) |
| Comment identifier et délimiter un agrégat | [theory/aggregate-design.md](theory/aggregate-design.md) |
| Patterns NestJS du projet (tokens, useFactory, DomainException) | [project/nestjs-patterns.md](project/nestjs-patterns.md) |
| CQRS léger — commandes vs requêtes, read models | [project/cqrs-light.md](project/cqrs-light.md) |
| Architecture DDD existante (module `vehicle/`) | [ARCHITECTURE.md §3.4](../../../../docs/ARCHITECTURE.md) |
| Modèle de refactoring Team → DDD | [docs/plans/2026-06-27-team-ddd-design.md](../../../../docs/plans/2026-06-27-team-ddd-design.md) |
