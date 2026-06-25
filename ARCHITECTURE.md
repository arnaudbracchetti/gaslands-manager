# Gaslands Manager — Architecture technique

> Ce fichier documente les choix techniques, la structure du code et les points d'attention.
> Il doit être mis à jour à chaque changement architectural significatif.

---

## 1. Vue d'ensemble

```
gaslands/                    ← Monorepo Nx 22.7
├── apps/
│   ├── frontend/            ← Angular 21 (port 4200)
│   ├── frontend-e2e/        ← Tests Playwright
│   ├── backend/             ← NestJS 11 (port 3000)
│   └── backend-e2e/         ← Tests Vitest E2E (axios)
├── content/                 ← Fichiers Markdown (contenu du jeu)
├── docker-compose.yml       ← Infrastructure locale et production
├── dev.sh                   ← Script de démarrage dev (WSL/Linux)
└── nx.json                  ← Configuration Nx
```

**Principe** : frontend et backend sont deux applications indépendantes dans le même dépôt. Ils ne partagent pas de code. Le frontend consomme l'API REST du backend via HTTP.

---

## 2. Frontend — Angular 21

### 2.1 Zoneless + Signals (⚠️ Point critique)

Ce projet utilise le mode **zoneless** : `zone.js` n'est pas installé. Angular ne détecte plus automatiquement les changements après une opération asynchrone. **Il faut obligatoirement utiliser des Signals pour mettre à jour le template.**

```typescript
// ❌ Ne fonctionne PAS en mode zoneless — le template ne se met pas à jour
loading = true;
this.http.get('/api/data').subscribe(data => { this.loading = false; });

// ✅ Correct — Signal notifie Angular → re-rendu
loading = signal(true);
this.http.get('/api/data').subscribe(data => { this.loading.set(false); });
```

Types utilisés : `signal()` (état mutable), `computed()` (valeur dérivée), `input()` / `output()` (communication composants).
Déclaré dans `app.config.ts` via `provideZonelessChangeDetection()`.

### 2.2 Lazy Routing

Tous les composants sont chargés à la demande via `loadComponent`. Routes définies dans `apps/frontend/src/app/app.routes.ts`.

### 2.3 Sécurité Frontend

- **`authInterceptor`** — injecte `Authorization: Bearer <token>` sur toutes les requêtes HTTP sortantes.
- **`authGuard`** — protège les routes privées, redirige vers `/login` si non connecté.

### 2.4 Proxy de développement

```json
// apps/frontend/proxy.conf.json
{ "/api": { "target": "http://localhost:3000", "secure": false } }
```

### 2.5 Composants

> Catalogue complet (rôles, inputs/outputs, diagramme de dépendances) : [@docs/COMPONENTS.md](docs/COMPONENTS.md).

### 2.6 Fichiers clés

| Fichier | Rôle |
|---------|------|
| `apps/frontend/src/app/app.config.ts` | Configuration Angular (zoneless, router, HttpClient, intercepteur) |
| `apps/frontend/src/app/app.routes.ts` | Routes lazy |
| `apps/frontend/src/app/auth/auth.service.ts` | State utilisateur (signals), login/logout |
| `apps/frontend/src/app/auth/auth.interceptor.ts` | Injection automatique du token JWT |
| `apps/frontend/src/app/auth/auth.guard.ts` | Protection des routes privées |
| `apps/frontend/proxy.conf.json` | Proxy dev : `/api` → backend |
| `apps/frontend/src/app/catalog/catalog.service.ts` | Données publiques du catalogue (`/api/catalog/sponsors`) |

---

## 3. Backend — NestJS 11

### 3.1 Structure des modules

```
apps/backend/src/app/
├── app.module.ts        ← Module racine
├── auth/                ← Authentification (User, JWT, bcrypt)
├── catalog/             ← Catalogue YAML → Map en mémoire au démarrage
├── content/             ← Lecture des fichiers Markdown → HTML
├── team/                ← Entité Team (CRUD)
├── vehicle/             ← Véhicules d'équipe (DDD — voir §3.4)
│   ├── domain/          ← Agrégat Vehicle, entités Weapon/Improvement, Value Objects, interfaces repo
│   ├── application/     ← 11 Use Cases (un par commande métier)
│   └── infrastructure/  ← VehicleRepository, VehicleMapper, CatalogAdapter, HTTP mapper
├── season/              ← Saisons (ligues) + participants
└── game/                ← Programme Télé (mode campagne) : entité Game + catalogue de scénarios YAML
```

> **`ScenarioCatalogService`** (`game/`) est un **troisième exemple** du pattern
> singleton-en-mémoire (§3.3) après `CatalogService` et `AdminSeedService` : il
> charge `database_init/data/scenarios.yml` au démarrage (`OnModuleInit`, Template
> Method `readFileContent`, conversion Markdown→HTML) et l'indexe par `nom_interne`.
> L'autorisation des endpoints du Programme est déléguée à
> `SeasonService.assertOrganizer` / `assertVisibleParticipant` (helpers publics
> réutilisables, exportés par `SeasonModule`).

Tout nouveau module doit être importé dans `app.module.ts` et ses entités TypeORM ajoutées dans la liste `entities`. Les modules domaine complexes suivent l'architecture DDD décrite en §3.4.

### 3.2 Flux d'authentification JWT

1. Client : `POST /api/auth/login` avec `{ email, password }`
2. `AuthService.login()` vérifie avec `bcrypt.compare()`
3. Si valide : signe un token JWT (`sub: userId, email, role`)
4. Client stocke le token dans `localStorage`
5. `authInterceptor` l'injecte dans le header de chaque requête
6. `JwtStrategy` (Passport) valide le token et charge l'utilisateur

Protéger un endpoint : `@UseGuards(JwtAuthGuard)`.

### 3.3 Catalogue de jeu — Singleton en mémoire

`CatalogService` lit les YAML depuis `database_init/data/*.yml` **une seule fois au démarrage** via `OnModuleInit`, puis conserve une `Map<string, Sponsor>` avec relations pré-résolues (véhicules, armes, améliorations autorisés par sponsor).

**Conversion Markdown → HTML** : avant de construire cette `Map`, `onModuleInit()` convertit aussi les champs `description`/`regles` (Vehicule/Arme/Amelioration) et `Sponsor.description` de Markdown vers HTML via `marked.parse()` (synchrone, méthode privée `toHtml()`) — même principe que `ContentService.getContent()` pour les fichiers `.md`. La mutation se fait en place sur les objets déjà chargés, donc `sponsorMap` référence directement le HTML.

**Pourquoi ?** Les données du catalogue sont statiques. La Map en mémoire donne un accès O(1). Fail-fast : une erreur YAML au démarrage fait crasher le serveur — un catalogue vide silencieux serait pire.

**Pattern Template Method pour les tests** : `CatalogService` expose `protected readFileContent(filename)`. Les specs étendent la classe et surchargent cette méthode avec des YAML fictifs — évite les problèmes de `vi.mock('fs')` avec SWC/Vitest.

```typescript
class TestCatalogService extends CatalogService {
  protected override readFileContent(filename: string): string {
    return MOCK_YAML[filename];
  }
}
// beforeEach : service = new TestCatalogService(); service.onModuleInit();
```

### 3.4 Architecture DDD — standard du projet

Le module `vehicle/` introduit l'architecture **Domain-Driven Design** qui s'applique à tout nouveau module domaine complexe. Quatre couches avec responsabilités strictes :

| Couche | Dossier | Contient | Règle absolue |
|--------|---------|----------|---------------|
| **Domaine** | `domain/` | Agrégat, entités enfants, Value Objects, interfaces `IXxxRepository` | 0 dépendance NestJS/TypeORM |
| **Application** | `application/` | Use Cases (`XxxUseCase`, 1 par commande) | Orchestration uniquement — pas de règle métier |
| **Infrastructure** | `infrastructure/` | Repository TypeORM, Mapper ORM↔domaine, Adapter, HTTP mapper | Implémente les interfaces du domaine |
| **Présentation** | `*.controller.ts` | Controllers NestJS | Traduit HTTP → commande, délègue au use case |

**L'agrégat** porte toutes les règles métier. Les mutations valident en interne et lèvent `DomainException` si une règle est violée. La couche application convertit `DomainException` → `BadRequestException` (seul endroit où NestJS rencontre le domaine).

```typescript
// domain/vehicle.ts — règle métier dans l'agrégat, nulle part ailleurs
addWeapon(type: WeaponType, orientation: Orientation | null, budget: number): void {
  const result = this.canAddWeapon(type, orientation, budget);
  if (!result.ok) throw new DomainException(result.reason!);
  this._weapons.push(new Weapon(0, type, orientation));
}
```

**Value Objects** (`domain/value-objects/`) — wrappent les données catalogue brutes (YAML) et exposent une API métier typée (`price`, `slots`, `isEquipage`, `isTourelle`, `requiresOrientation`…). Éliminent les casts `as number` répandus dans les anciens services.

**Dependency Inversion** — le domaine définit `IVehicleRepository` et `ICatalogRepository` (`domain/`). L'infrastructure les implémente (`VehicleRepository`, `CatalogAdapter`). Le domaine ne connaît jamais TypeORM ni NestJS.

**Pattern Use Case** — chaque commande métier a son propre use case. Flux systématique :
1. Charger l'agrégat (vérifie l'appartenance `userId`)
2. Valider les Value Objects depuis le catalogue
3. Calculer le budget restant si nécessaire
4. Déléguer à l'agrégat → `DomainException` éventuelle
5. Persister via le repository

**Injection NestJS** — les interfaces TypeScript ne sont pas injectables directement. Tokens string dans `vehicle.tokens.ts` (`VEHICLE_REPOSITORY`, `CATALOG_REPOSITORY`). Use cases et mapper fournis en `useFactory` pour garder le domaine sans décorateurs :

```typescript
// vehicle.module.ts — pattern à reproduire pour tout nouveau module domaine
{ provide: VEHICLE_REPOSITORY, useClass: VehicleRepository },
{
  provide: AddWeaponUseCase,
  useFactory: (vr: IVehicleRepository, cr: ICatalogRepository) => new AddWeaponUseCase(vr, cr),
  inject: [VEHICLE_REPOSITORY, CATALOG_REPOSITORY],
}
```

**Réponses HTTP** — jamais retourner une entité ORM brute ni un agrégat domaine directement. `vehicleToDto()` (`infrastructure/vehicle-http.mapper.ts`) traduit l'agrégat en DTO sérialisable. Reproduire ce pattern pour tout nouveau module DDD.

**⚠️ Piège TypeORM — `where` sur une relation de collection chargée.** Quand un repository filtre sur une relation `OneToMany`/`ManyToMany` (`where: { weapons: { id } }`) tout en l'hydratant (`relations: { weapons: true }`), TypeORM réutilise la **même jointure** pour la recherche ET pour l'hydratation : la collection chargée ne contient alors **que les lignes satisfaisant le `where`**, pas l'intégralité de l'agrégat. Symptôme observé : `findByWeaponId(weaponId)` reconstituait un véhicule avec une **seule** arme (celle recherchée) au lieu de toutes ses armes — corrompant le calcul de coût/emplacements à la persistance. Ce comportement n'est pas documenté par TypeORM (sujet d'issues ouvertes).

- **Contournement** (`VehicleRepository.findByWeaponId`) : résoudre d'abord l'`id` du parent (`findOne` avec `select: { id: true }`, sans hydrater les collections), puis recharger l'agrégat complet via `findByIdForUser` — qui filtre par `id` **scalaire**, donc n'altère pas l'hydratation des collections.
- **Règle générale** : tout `findByXxxId` qui localise un agrégat *via un de ses enfants* doit appliquer ce double-find. Filtrer par une colonne scalaire du parent (`id`, `teamId`) est sûr ; filtrer par une collection hydratée ne l'est pas.

### 3.5 Compte administrateur — `AdminSeedService`

`AdminSeedService` (`apps/backend/src/app/auth/admin-seed.service.ts`) garantit qu'un
unique utilisateur `role: UserRole.ADMIN` existe en base, via `OnModuleInit` — même
pattern singleton-en-mémoire que `CatalogService` (§3.3).

Logique exécutée à chaque démarrage :
1. Recherche d'un utilisateur avec `role: 'admin'` (jamais par email — garantit l'unicité
   même si `ADMIN_EMAIL` change dans `.env`).
2. **Absent** → création avec `ADMIN_EMAIL`/`ADMIN_PASSWORD` (`.env`, mot de passe haché
   bcrypt coût 10, même que `UserService.create()`).
3. **Présent** → si `ADMIN_EMAIL` ou `ADMIN_PASSWORD` a changé dans `.env`, la valeur
   correspondante est mise à jour en base (re-hash bcrypt pour le mot de passe). Un
   warning est loggé dans les deux cas pour signaler la modification.

`ADMIN_PASSWORD` est lu via `config.getOrThrow()` (pas de valeur par défaut pour un
secret, même logique que `DATABASE_PASSWORD` dans `app.module.ts`) : absent de `.env`
→ crash explicite au démarrage. `ADMIN_EMAIL` a un défaut (`admin@gaslands.local`).

`role` (enum `UserRole`, `user.entity.ts`) est exclu de `RegisterDto` : `/api/auth/register`
ne peut jamais produire un admin, la colonne prend sa valeur `default: UserRole.USER`.

### 3.6 `TeamWithCount` — type enrichi

```typescript
export type TeamWithCount = Team & { vehicleCount: number };
```

`vehicleCount` est calculé (futur : `COUNT` SQL sur `vehicles`) — jamais stocké en colonne pour éviter la désynchronisation.

### 3.7 Fichiers clés

| Fichier | Rôle |
|---------|------|
| `apps/backend/src/main.ts` | Bootstrap, CORS, préfixe `/api`, écoute `0.0.0.0:3000` |
| `apps/backend/src/app/app.module.ts` | Module racine : TypeORM, ConfigModule, modules domaine |
| `apps/backend/src/app/auth/` | Auth complète (entity, service, controller, strategy, guard) |
| `apps/backend/src/app/catalog/` | Catalogue YAML → Map en mémoire |
| `apps/backend/src/app/content/` | Markdown → HTML via `marked` |
| `apps/backend/src/app/team/` | Team CRUD, `TeamWithCount` |
| `apps/backend/src/app/vehicle/domain/vehicle.ts` | Agrégat racine — toutes les règles métier Gaslands |
| `apps/backend/src/app/vehicle/domain/vehicle.repository.interface.ts` | Contrat persistence (Dependency Inversion) |
| `apps/backend/src/app/vehicle/domain/catalog.repository.interface.ts` | Contrat catalogue (Dependency Inversion) |
| `apps/backend/src/app/vehicle/application/` | 11 use cases — un par commande métier |
| `apps/backend/src/app/vehicle/infrastructure/vehicle.mapper.ts` | Mapping ORM ↔ agrégat domaine |
| `apps/backend/src/app/vehicle/infrastructure/catalog.adapter.ts` | `CatalogService` → `ICatalogRepository` |
| `apps/backend/src/app/vehicle/vehicle.tokens.ts` | Tokens d'injection NestJS pour les interfaces |
| `database_init/data/*.yml` | Données statiques (sponsors, véhicules, armes, améliorations) |

---

## 4. Base de données — PostgreSQL 16

Credentials dans `.env` à la racine (jamais commité, template dans `.env.example`).
Dev local (`nx serve`) : variables depuis `apps/backend/.env` (hôte `localhost`).
Dev Docker : hôte `postgres` (DNS interne Docker).

| Mode | `synchronize` | Tables |
|------|--------------|--------|
| **Dev** | `true` | Créées/modifiées automatiquement au démarrage |
| **Prod** | `false` ⚠️ | Migrations TypeORM explicites (`migration:generate` + `migration:run`) |

---

## 5. Infrastructure Docker

```
postgres   → port 5432 (hôte)
backend    → port 3000, dépend de postgres
frontend   → nginx port 4200, proxy /api → backend:3000
pgadmin    → port 5050 (http://localhost:5050)
```

Réseau privé `gaslands_net`. Images multi-stage (builder + runner). `docker/pgadmin/servers.json` pré-configure la connexion pgAdmin au premier démarrage.

---

## 6. Sécurité

| Aspect | Implémentation |
|--------|----------------|
| Mots de passe | bcrypt coût 10, jamais stockés en clair |
| Tokens JWT | Signés avec `JWT_SECRET` (.env), durée 7 jours |
| Réponses API | `sanitize()` exclut `password` de toutes les réponses |
| CORS | Limité à `http://localhost:4200` en dev |
| Erreurs login | Message générique (évite l'énumération d'emails) |
| `.env` | Non committé (`.gitignore`), exemple dans `.env.example` |

---

## 7. Monorepo Nx

**Dépannage TypeScript Nx** : `tsconfig.base.json` contient des options (`composite`, `emitDeclarationOnly`) incompatibles avec Angular → si Nx affiche une erreur de configuration TypeScript, définir `export NX_IGNORE_UNSUPPORTED_TS_SETUP=true` avant les commandes Nx (cf. [CLAUDE.md](CLAUDE.md)).

---

## 8. Tests

| Projet | Outil | Commande |
|--------|-------|---------|
| Frontend (unitaires) | Vitest + Angular Testing Library | `npx nx test frontend` |
| Backend (unitaires) | Vitest | `npx nx test backend` |
| E2E frontend | Playwright | `npx nx e2e frontend-e2e` |
| E2E backend | Vitest + axios | `npx nx e2e backend-e2e` |

> ⚠️ Installer les navigateurs Playwright avant le premier lancement : `npx playwright install`

### Règle

> **Tout nouveau module NestJS** → tests unitaires service + controller.
> **Tout nouveau service Angular** → tests unitaires.

### 8.1 Backend — Patterns de test

**Service avec TypeORM** : mock du `Repository` via `getRepositoryToken` dans `Test.createTestingModule`.

**Service sans DI** (ex : `CatalogService`) : instanciation directe + Pattern Template Method (voir §3.3). Appeler `service.onModuleInit()` manuellement dans `beforeEach`.

Ce qu'on teste : cas nominaux, `NotFoundException`, isolation par `userId`, câblage controller → service, relations pré-résolues.
Ce qu'on ne teste pas en unitaire : auth JWT (testé via le guard), SQL réel (→ e2e).

### 8.2 Frontend — Patterns de test

**Smart component** : mock du service dans `providers`, sous-composants rendent normalement.

**Dumb component** :

```typescript
// Initialiser un input() Signal
fixture.componentRef.setInput('team', mockTeam);
fixture.detectChanges();  // déclenche effect() si présent

// Observer un output() Signal
import { outputToObservable } from '@angular/core/rxjs-interop';
outputToObservable(component.editClicked).subscribe(t => emitted.push(t));
```

**Outils clés** : `HttpTestingController`, `of(data)` / `throwError(() => ...)`, `vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))`.

| Que tester ? | Fichier spec |
|---|---|
| Orchestration, appels API, visibilité formulaire | `teams.spec.ts` |
| Affichage carte, émission boutons | `team-card.spec.ts` |
| Pré-remplissage, validation, émission DTO | `team-form.spec.ts` |
| Requêtes HTTP (verbe, URL, corps) | `teams.service.spec.ts` |
