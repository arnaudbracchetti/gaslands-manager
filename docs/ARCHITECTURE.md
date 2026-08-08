# Gaslands Manager — Architecture technique

> Ce fichier documente les choix techniques, la structure du code et les points d'attention.
> Il doit être mis à jour à chaque changement architectural significatif.
> Modèle de domaine UML (agrégats, ERD) : [DOMAIN_MODEL.md](DOMAIN_MODEL.md).

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

```js
// apps/frontend/proxy.conf.cjs - module CommonJS (pas du JSON statique) pour lire
// BACKEND_PORT au démarrage du dev-server (défaut 3000, cf. skill e2e-testing
// - lancer frontend-e2e sur un backend de test isolé sans arrêter dev.sh).
const backendPort = process.env.BACKEND_PORT || '3000';
module.exports = { '/api': { target: `http://localhost:${backendPort}`, secure: false } };
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
| `apps/frontend/proxy.conf.cjs` | Proxy dev : `/api` → backend, port configurable via `BACKEND_PORT` |
| `apps/frontend/src/app/catalog/catalog.service.ts` | Données publiques du catalogue (`/api/catalog/sponsors`) |

---

## 3. Backend — NestJS 11

### 3.1 Structure des modules

```
apps/backend/src/app/
├── app.module.ts        ← Module racine
├── auth/                ← Agrégat User (DDD — voir §3.4) : authentification, profil, administration des comptes
│   ├── domain/          ← Agrégat User (règles + getter `callName`), UserRole, IUserRepository, IPasswordHasher, ITokenIssuer
│   ├── application/     ← 7 Use Cases (Register, Login, UpdateProfile, ChangePassword, ListUsers, RemoveUser, SetActive)
│   └── infrastructure/  ← UserRepository, UserMapper, user-http.mapper, BcryptPasswordHasher, JwtTokenIssuer, entité ORM
├── catalog/             ← Catalogue YAML → Map en mémoire au démarrage
├── content/             ← Lecture des fichiers Markdown → HTML
├── shared/domain/       ← DomainException partagée entre team/ et campaign/
├── team/                ← Agrégat Team (DDD — voir §3.4) : Team + Vehicle + Weapon + Improvement + Advantage
│   ├── domain/          ← Agrégat Team (racine), entités Vehicle/Weapon/Improvement/Advantage, Value Objects, ITeamRepository, ICatalogRepository
│   ├── application/     ← 16 Use Cases (4 équipe + 3 véhicule + 3 arme + 3 amélioration + 3 avantage)
│   └── infrastructure/  ← TeamRepository, TeamMapper, CatalogAdapter, team-http.mapper, entités ORM
└── campaign/            ← Module campagne unifié (DDD event-sourcing — voir §3.8), ex-`season/` + ex-`game/`
    ├── campaign.controller.ts       ← Controller HTTP unique (39 routes : CRUD ligue/participants + Programme + atelier + event-sourcing)
    ├── campaign-query.service.ts     ← Côté lecture (CQRS) : read models, `/results` dérivé du journal
    ├── scenario-catalog.service.ts   ← Catalogue de scénarios (singleton en mémoire, §3.3)
    ├── domain/          ← Campaign (agrégat, ex-Season), CampaignParticipant, GameEvent hierarchy, Game hierarchy, WreckOutcome, WreckTable, IRandomizer
    │   ├── events/      ← 8 événements concrets (GoF Command)
    │   ├── games/       ← EvenementTeleGame, EscarmoucheGame (GoF Invoker)
    │   ├── enums/       ← GameStatus, WalletReason, WreckResult
    │   └── wreck/       ← WreckTable (domain service, 9 lignes + événements), WreckOutcome (Value Object), IRandomizer (port hexagonal)
    ├── application/     ← 29 Use Cases (CRUD + GetWorkshop + 2 verdicts d'équipement atelier + event-sourcing)
    └── infrastructure/  ← CampaignRepository, CampaignMapper, CampaignReplayService, RandomProvider, entités ORM
```

> ⚠️ **Collision de nom `Campaign`** — deux classes distinctes portent ce nom dans le
> module `campaign/` : `infrastructure/entities/campaign.entity.ts` (**`CampaignOrm`** —
> entité TypeORM : nom, état, code d'invitation) et `domain/campaign.ts` (**`Campaign`** —
> agrégat racine DDD event-sourcing, §3.8). Le suffixe `Orm` lève l'ambiguïté ; vérifier
> néanmoins les imports (`./infrastructure/entities/campaign.entity` vs `./domain/campaign`).

> **`ScenarioCatalogService`** (`campaign/`) est un **troisième exemple** du pattern
> singleton-en-mémoire (§3.3) après `CatalogService` et `AdminSeedService` : il
> charge `database_init/data/scenarios.yml` au démarrage (`OnModuleInit`, Template
> Method `readFileContent`, conversion Markdown→HTML) et l'indexe par `nom_interne`.
> L'autorisation des endpoints en **écriture** est assurée directement par les use cases via
> `assertOrganizer` / `assertParticipant` (`application/authorization.helpers.ts`) — helpers
> qui opèrent sur `campaign.participants` après replay, sans accès à la base. Les endpoints
> en **lecture** délèguent à `CampaignQueryService` (accès ORM direct, CQRS).

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

> Pour le **processus de conception** (théorie DDD, brainstorming, anti-patterns,
> génériques et agnostiques de toute stack) : skill [`ddd`](../.claude/skills/ddd/SKILL.md).
> Cette section-ci documente le **pattern concret déjà en place** dans ce repo — le
> résultat d'une conception passée, pas la méthode pour y arriver.

Le module `team/` implémente l'architecture **Domain-Driven Design** — `Team` est l'agrégat racine qui englobe `Vehicle`, `Weapon` et `VehicleImprovement` comme entités enfants. Ce pattern s'applique à tout nouveau module domaine complexe. `campaign/` et `auth/` le suivent également : ce dernier a été refondu depuis un modèle anémique (ex-`UserService`/`AuthService`, supprimés) vers l'agrégat `User` — cf. §3.5 et [spec/AUTH.md](spec/AUTH.md#nom-daffichage-callname). Quatre couches avec responsabilités strictes :

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

**Value Objects** (`domain/value-objects/`) — wrappent les données catalogue brutes (YAML) et exposent une API métier typée (`price`, `slots`, `isEquipage`, `montableSurTourelle`, `requiresOrientation`…). Éliminent les casts `as number` répandus dans les anciens services.

**Pattern Strategy pour les stats effectives** — `Vehicle.effectiveStats` (`domain/vehicle.ts`) calcule les stats **effectives** du véhicule (après bonus des séquelles/améliorations/avantages déjà montés) en un seul `reduce()` par famille, dans l'ordre séquelles → améliorations → avantages. Chaque comportement de jeu (Chenilles, Bélier, Cascadeur, Remorque Moyenne…) est une petite classe Strategy stateless (`EquipmentBehavior`, `domain/behaviors/*.ts`), invoquée directement sur l'état fourni — remplace un ancien Pattern Decorator (chaîne d'objets qui s'enveloppent) courant juillet 2026, pour permettre à la capacité en emplacements de devenir extensible (Remorque Moyenne +1, Remorque Lourde +3, cf. [spec/VEHICLES.md](spec/VEHICLES.md#améliorations-de-véhicule-19-au-total)) et éliminer une re-validation redondante des couches déjà montées. `canPlace(ctx, candidate)` est porté par `ImprovementType`/`AdvantageType` (le Value Object — un candidat n'a pas encore d'instance) ; `applyStats(current)` par `Improvement`/`Advantage`/`Sequella` (l'entité — un équipement déjà monté a toujours une instance), chacun délégant à la Strategy résolue depuis son propre `comportement` (`resolveImprovementBehavior`/`resolveAdvantageBehavior`/`resolveSequellaBehavior`) — `Vehicle` ne connaît jamais ces fonctions de résolution directement. `IMPROVEMENT_BEHAVIORS`/`ADVANTAGE_BEHAVIORS` (Record `comportement` → instance singleton) couvrent respectivement 8 et 3 comportements ; `SEQUELLA_BEHAVIORS` (Map, clé `nom_interne` — les séquelles n'ont pas de champ `comportement`) couvre les 4 séquelles à effet chiffré. Une méthode générique `PlacementContext.hasComportementAmong(comportements)` porte les règles d'unicité transversales à plusieurs `comportement` (ex. Remorque Moyenne/Lourde mutuellement exclusives). Détail complet (diagramme de classes, flux, tables comportement→Strategy) : [VEHICLE_SYSTEM.md §4](VEHICLE_SYSTEM.md#4-pattern-strategy---equipmentbehavior).

**Dependency Inversion** — le domaine définit `ITeamRepository` et `ICatalogRepository` (`domain/`). L'infrastructure les implémente (`TeamRepository`, `CatalogAdapter`). Le domaine ne connaît jamais TypeORM ni NestJS.

**Pattern Use Case** — chaque commande métier a son propre use case. Flux systématique pour les mutations :
1. Charger l'agrégat Team via `teamRepo.findByVehicleId(vehicleId, userId)` (vérifie l'appartenance `userId`)
2. Accéder au budget restant via `team.remainingBudget` (in-aggregate, pas de requête SQL)
3. Valider les Value Objects depuis le catalogue via `catalogRepo`
4. Déléguer à l'agrégat → `DomainException` éventuelle
5. Persister via `teamRepo.save(team)` (cascade TypeORM sur toutes les entités enfants)

**Injection NestJS** — les interfaces TypeScript ne sont pas injectables directement. Tokens string dans `team.tokens.ts` (`TEAM_REPOSITORY`, `CATALOG_REPOSITORY`). Use cases et mapper fournis en `useFactory` pour garder le domaine sans décorateurs :

```typescript
// team.module.ts — pattern de référence
{ provide: TEAM_REPOSITORY, useClass: TeamRepository },
{
  provide: AddWeaponUseCase,
  useFactory: (tr: ITeamRepository, cr: ICatalogRepository) => new AddWeaponUseCase(tr, cr),
  inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY],
}
```

**Réponses HTTP** — jamais retourner une entité ORM brute ni un agrégat domaine directement. `vehicleDomainToDto()` (`infrastructure/team-http.mapper.ts`) traduit un Vehicle domaine en DTO sérialisable. Reproduire ce pattern pour tout nouveau module DDD.

> ⚠️ Ce n'est pas une préférence stylistique : `JSON.stringify()` **ne sérialise pas**
> les accesseurs `get` d'un prototype de classe. Un agrégat renvoyé tel quel perd
> silencieusement tous ses champs calculés, sans la moindre erreur. Cas le plus
> exposé : `User.callName` (`auth/`), le nom d'affichage de l'utilisateur — d'où
> `userDomainToDto()`, second exemple du même pattern. Corollaire : un controller ne
> renvoie jamais `req.user` directement (c'est l'agrégat `User` déposé par
> `JwtStrategy.validate()`), toujours via ce mapper.

**Read-model présentationnel partagé entre deux modules — fiche d'équipe exportable.**
`team/infrastructure/team-sheet.mapper.ts`/`team-sheet.renderer.ts` traduisent un
`Vehicle`/`Team` déjà chargé en document HTML imprimable, consommés à la fois par
`GetTeamSheetUseCase` (`team/`, lecture directe) et `GetCampaignTeamSheetUseCase`
(`campaign/`, après replay). Logés sous `team/` plutôt que dans un module neutre
séparé (décision prise via le skill `ddd`) : `campaign/` dépend déjà de `team/` dans ce
sens (jamais l'inverse, `TEAM_REPOSITORY` exporté par `TeamModule`), et ce sont des
fonctions pures sans état — pas de justification à un 3ᵉ module NestJS pour deux
fichiers sans injection. Fonctionnent sans aucune dépendance `ICatalogRepository` :
`Weapon.type`/`Improvement.type`/`Advantage.type`/`Sequella.type` sont toujours des
Value Objects déjà résolus au moment où le mapper les reçoit, que le `Vehicle` vienne
d'un chargement ORM (`TeamMapper.weaponToDomain`) ou d'un replay campagne
(`EquipmentChangedEvent` résout `resolvedWeaponType` etc. en amont) — cf.
[spec/TEAMS.md — Fiche d'équipe exportable](spec/TEAMS.md#fiche-déquipe-exportable).

**⚠️ Piège TypeORM — `where` sur une relation de collection chargée.** Quand un repository filtre sur une relation `OneToMany`/`ManyToMany` (`where: { weapons: { id } }`) tout en l'hydratant (`relations: { weapons: true }`), TypeORM réutilise la **même jointure** pour la recherche ET pour l'hydratation : la collection chargée ne contient alors **que les lignes satisfaisant le `where`**, pas l'intégralité de l'agrégat. Symptôme observé : `findByWeaponId(weaponId)` reconstituait un véhicule avec une **seule** arme (celle recherchée) au lieu de toutes ses armes — corrompant le calcul de coût/emplacements à la persistance. Ce comportement n'est pas documenté par TypeORM (sujet d'issues ouvertes).

- **Contournement** (`TeamRepository.findByWeaponId`) : résoudre d'abord le `teamId` parent (`findOne` sur `VehicleOrm` avec `select: { teamId: true }`, sans hydrater les collections), puis recharger l'agrégat complet via `findByIdForUser` — qui filtre par `id` **scalaire**, donc n'altère pas l'hydratation des collections.
- **Règle générale** : tout `findByXxxId` qui localise un agrégat *via un de ses enfants* doit appliquer ce double-find. Filtrer par une colonne scalaire du parent (`id`, `teamId`) est sûr ; filtrer par une collection hydratée ne l'est pas.

### 3.5 Compte administrateur — `AdminSeedService`

`AdminSeedService` (`apps/backend/src/app/auth/admin-seed.service.ts`) garantit qu'un
unique utilisateur `role: UserRole.ADMIN` existe en base, via `OnModuleInit` — même
pattern singleton-en-mémoire que `CatalogService` (§3.3). Comportement fonctionnel
(création, resynchronisation, garantie d'unicité) : voir
[spec/AUTH.md — Compte administrateur](spec/AUTH.md#compte-administrateur).

Reste un service NestJS plutôt qu'un use case : il n'est déclenché par aucune requête
HTTP, seulement par le cycle de vie du module. Il passe néanmoins par `IUserRepository`
et l'agrégat comme tout le reste — aucune écriture ORM directe, aucun appel à bcrypt
(le hachage transite par `IPasswordHasher`), ce qui permet à son spec de se passer de
`vi.mock('bcrypt')` et d'un faux Repository TypeORM.

Détails d'implémentation absents de la spec : `ADMIN_PASSWORD` est lu via
`config.getOrThrow()` (pas de valeur par défaut pour un secret, même logique que
`DATABASE_PASSWORD` dans `app.module.ts`) : absent de `.env` → crash explicite au
démarrage. `ADMIN_EMAIL` a un défaut (`admin@gaslands.local`). Le mot de passe est
haché bcrypt coût 10 (constante de `BcryptPasswordHasher`, seul endroit du code qui
importe bcrypt). `role` (enum `UserRole`, `auth/domain/user-role.ts`) est exclu de
`RegisterDto` et forcé par la fabrique `User.register()`, colonne à
`default: UserRole.USER`.

### 3.6 `TeamSummaryDto` — read model léger

```typescript
export interface TeamSummaryDto {
  id: number; name: string; sponsor: string; cans: number; description: string | null;
  vehicleCount: number; vehiclesCost: number; budget: number; campaignBudget: number | null;
  isEngaged: boolean; isLockedByCampaign: boolean; createdAt: Date; updatedAt: Date;
}
```

`vehicleCount`/`vehiclesCost`/`budget`/`campaignBudget` sont calculés en mémoire depuis l'agrégat
`Team` chargé (relations véhicules/armes/améliorations/avantages hydratées) dans `TeamRepository.toSummaryDto()`
- jamais stockés en colonne. `budget`/`campaignBudget` reflètent l'hydratation du budget de campagne
(`TeamRepository.resolveCampaignBudgets`, miroir batché d'`isLockedByCampaign` mais sans filtre sur
`Campaign.state` - le budget s'applique dès `EN_CONSTRUCTION`), cf. [spec/CAMPAIGN.md - Budget de
campagne](spec/CAMPAIGN.md#budget-de-campagne).
`isEngaged` indique si l'équipe est déjà engagée dans une campagne (via `CampaignParticipant`).
Ce type remplace l'ancien `TeamWithCount = Team & { vehicleCount }`.

### 3.7 Fichiers clés

| Fichier | Rôle |
|---------|------|
| `apps/backend/src/main.ts` | Bootstrap, CORS, préfixe `/api`, écoute `0.0.0.0:3000` |
| `apps/backend/src/app/app.module.ts` | Module racine : TypeORM, ConfigModule, modules domaine |
| `apps/backend/src/app/auth/domain/user.ts` | Agrégat racine User — toutes les règles du compte, et le getter `callName` : **unique** point de vérité du nom d'affichage d'un utilisateur (cf. [spec/AUTH.md](spec/AUTH.md#nom-daffichage-callname)) |
| `apps/backend/src/app/auth/domain/password-hasher.interface.ts` | Port hexagonal du hachage (`IPasswordHasher`) — permet à la règle « le mot de passe actuel doit correspondre » de vivre dans l'agrégat sans qu'il importe bcrypt. Même intention qu'`IRandomizer` (§3.8) |
| `apps/backend/src/app/auth/domain/token-issuer.interface.ts` | Port hexagonal d'émission du JWT (`ITokenIssuer`) — évite que `application/` importe `@nestjs/jwt` |
| `apps/backend/src/app/auth/application/` | 7 use cases. **Aucun ne porte `@LogUseCase()`** : ce décorateur sérialise la commande entière dans les logs, ce qui écrirait les mots de passe en clair |
| `apps/backend/src/app/auth/infrastructure/user.mapper.ts` | Mapping ORM ↔ agrégat. Fonction pure exportée hors du module : `CampaignQueryService` s'en sert pour lire `callName` sur un `UserOrm` chargé par relation |
| `apps/backend/src/app/auth/infrastructure/user-http.mapper.ts` | Agrégat → DTO HTTP. Matérialise `callName` (getter non sérialisable) et n'expose jamais le hash — remplace l'ancien `UserService.sanitize()` |
| `apps/backend/src/app/catalog/` | Catalogue YAML → Map en mémoire |
| `apps/backend/src/app/content/` | Markdown → HTML via `marked` |
| `apps/backend/src/app/team/domain/team.ts` | Agrégat racine — toutes les règles métier (budget, sponsor lock, mutations) |
| `apps/backend/src/app/team/domain/team.repository.interface.ts` | Contrat persistence `ITeamRepository` (Dependency Inversion) |
| `apps/backend/src/app/team/domain/catalog.repository.interface.ts` | Contrat catalogue `ICatalogRepository` (Dependency Inversion) |
| `apps/backend/src/app/team/application/` | 16 use cases — un par commande métier |
| `apps/backend/src/app/team/infrastructure/team.mapper.ts` | Mapping ORM ↔ agrégat domaine |
| `apps/backend/src/app/team/infrastructure/catalog.adapter.ts` | `CatalogService` → `ICatalogRepository` |
| `apps/backend/src/app/team/infrastructure/team-sheet.mapper.ts` | Fonction pure `Vehicle`/`Team` → DTOs de fiche exportable — zéro dépendance catalogue (`.type` déjà résolu), partagée entre le point d'entrée équipe directe et le point d'entrée campagne (replay), cf. §3.4 |
| `apps/backend/src/app/team/infrastructure/team-sheet.renderer.ts` | Assemble le HTML imprimable (A4) depuis ces DTOs — templates littéraux TypeScript, dédup des renvois de règles, échappement XSS du texte utilisateur (nom d'équipe, renommage de véhicule) |
| `apps/backend/src/app/team/team.tokens.ts` | Tokens d'injection NestJS pour les interfaces |
| `apps/backend/src/app/campaign/campaign.controller.ts` | Controller HTTP unique (39 routes) — délègue aux use cases (écritures) et à `CampaignQueryService` (lectures) |
| `apps/backend/src/app/campaign/campaign-query.service.ts` | Côté lecture (CQRS) — read models ; `/results` dérivé du journal `game_events` |
| `apps/backend/src/app/campaign/domain/campaign.ts` | Agrégat racine campagne — commandes CRUD + `replay`, `enterAtelier`, `closeAtelier`, `closeCampaign`, `standings`, navigation (`findGame`/`findParticipant`/`findAtelierGame`). La construction des événements d'une partie (`recordResult`, `changeEquipment`…) vit sur `Game`, cf. §3.8 |
| `apps/backend/src/app/campaign/domain/games/game.ts` | Entité enfant — Invoker GoF (`canAccept`/`addEvent`) **et** propriétaire de la construction des événements d'une partie (`recordResult`, `resolveWreck`, `changeEquipment` — achat/revente d'équipement **et** de séquelles, cf. §Séquelles ci-dessous —, `contactResistance`, `recordWalletMovement`, `recordVehicleLost`, `journal`) |
| `apps/backend/src/app/campaign/domain/campaign-participant.ts` | Entité enfant — Receiver GoF, compteurs transients (wallet, PC, points résistance) |
| `apps/backend/src/app/campaign/domain/campaign.repository.interface.ts` | Contrat persistence campagne `ICampaignRepository` |
| `apps/backend/src/app/campaign/infrastructure/campaign.repository.ts` | Implémentation TypeORM d'`ICampaignRepository` |
| `apps/backend/src/app/campaign/infrastructure/campaign-replay.service.ts` | `loadAndReplay` — unique point d'entrée des use cases (charge et rejoue systématiquement ; un ancien `.load()` sans replay a été supprimé après avoir causé deux bugs de résolution d'entités transientes) |
| `apps/backend/src/app/campaign/infrastructure/random-provider.ts` | Adaptateur `IRandomizer` (port hexagonal) → `Math.random()` — remplace l'ex-`WreckResolverService` |
| `apps/backend/src/app/campaign/domain/wreck/wreck-table.ts` | Domain service : 9 lignes de la Table des Épaves, tirage D6 + pool d'équipements + création des événements domaine. Dépend d'`ICatalogRepository` (résout les séquelles imposées automatiquement, `siege_irrecuperable`/`chassis_fragilise`) en plus d'`IRandomizer` — deux modificateurs permanents (`legende_vivante` force le D6 à 1, `maintenu_par_la_rouille` chaîne un second tirage), cf. §Séquelles ci-dessous |
| `apps/backend/src/app/campaign/application/` | 30 use cases (CRUD + GetWorkshop + 2 verdicts d'équipement atelier + event-sourcing) |
| `database_init/data/*.yml` | Données statiques (sponsors, véhicules, armes, améliorations, scénarios) |

### 3.8 Mode Campagne — Event Sourcing (`campaign/`)

Le module `campaign/` (fusion des ex-modules `season/` et `game/`) implémente une architecture **event sourcing** stricte pour le mode campagne : aucun état transient n'est jamais stocké en base — seul le **journal des événements** (`game_events`) est persisté. L'état courant est **recalculé à chaque lecture** par replay du journal.

**Basculement DDD (Phase 2)** : les services anémiques (`CampaignService`, `CampaignParticipantService`, `GameService`, `GameResultService`) et le second controller (`game.controller.ts`) ont été supprimés. Les 38 endpoints passent par un **`CampaignController` unique** délégant aux **use cases** (écritures, via l'agrégat) et au **`CampaignQueryService`** (lectures, CQRS). Les résultats de partie **convergent vers l'event-sourcing** : `POST .../results` crée des `RankingAssignedEvent` via `Game.recordResult` (finalisation JOUE + atelier), et `GET .../results` est **dérivé du journal** (`game_events`, `eventType = RANKING_ASSIGNED`) — la table `game_results` / entité `GameResultOrm` n'existent plus.

**Construction des événements — Campaign vs Game** : la construction d'un `GameEvent` (calcul des PC, du coût, résolution du véhicule ciblé…) vit sur `Game`, pas sur `Campaign` — cf. [DOMAIN_MODEL.md §4 — Répartition des responsabilités](DOMAIN_MODEL.md#répartition-des-responsabilités-campaign--game). `Campaign` se limite à la navigation (`findGame`, `findParticipant`, `findAtelierGame`) et aux invariants qui dépassent une seule partie. Les use cases naviguent explicitement (`campaign.findGame(gameId)` ou `campaign.findAtelierGame()`) puis appellent la méthode sur l'objet `Game` obtenu.

#### Trois patterns GoF imbriqués

| Pattern | Rôle | Classes |
|---------|------|---------|
| **Command** | `GameEvent` — encapsule une mutation avec `execute()` / `undo()` | `RankingAssignedEvent`, `WalletMovementEvent`, `VehicleLostEvent`, `WeaponLostEvent`, `WreckResolvedEvent`, `EquipmentChangedEvent` (`entityType` : `VEHICLE`/`WEAPON`/`IMPROVEMENT`/`ADVANTAGE`/`SEQUELLE`), `ResistanceContactedEvent` |
| **Invoker** | `Game` — valide et journalise les événements via `canAccept` / `addEvent`, sensible à son statut courant (`PLANIFIE` vs `ATELIER`) | `EvenementTeleGame`, `EscarmoucheGame` |
| **Receiver** | `CampaignParticipant` — porte les compteurs transients modifiés par chaque événement | `wallet`, `championshipPoints`, `resistancePoints`, état des véhicules/armes |

#### Flux d'une écriture

```
Controller → UseCase
  1. loadAndReplay(campaignId)     → Campaign reconstituée depuis le journal
  2. assertOrganizer(campaign, userId)
  3. game = campaign.findGame(gameId) / campaign.findAtelierGame()
  4. events = game.xxx(...)        → construit le(s) événement(s) (id=0), les valide et
                                      les journalise via this.addEvent() (canAccept)
  5. campaignRepo.appendEvents()   → INSERT dans game_events (id assigné par DB)
```

Aucune étape n'appelle `event.execute()` : les compteurs en mémoire (wallet, PC,
chocs…) ne sont recalculés qu'au prochain `replay()` complet, jamais dans le
use case lui-même (cf. D-S11 ci-dessous pour la raison précise dans le cas de
`changeEquipment`).

#### Entités transientes et D-S11

Mécanisme complet (pourquoi `id = -event.id`, recréation à chaque replay) :
[DOMAIN_MODEL.md §4 — Entités transientes](DOMAIN_MODEL.md#entités-transientes-d-s11).
Piège d'implémentation propre à ce cas, non documenté ailleurs :
`Game.changeEquipment()` **ne doit pas appeler `event.execute()`** avant la
persistance, car `id=0` donnerait `-0 = 0`, qui ne constitue pas un id négatif
valide. Le use case persiste d'abord, le client rafraîchit ensuite via
`GET /campaigns/:id/workshop`.

#### Cycle de vie Atelier (D-S7, refonte)

Statuts, règles d'acceptation des événements par statut et logique de
clôture automatique : voir
[DOMAIN_MODEL.md §4 — Hiérarchie Game](DOMAIN_MODEL.md#hiérarchie-game-invoker)
et le [design doc](plans/2026-07-05-atelier-lifecycle-design.md). Flux
d'orchestration des use cases (absent de DOMAIN_MODEL.md) :

```
EnterAtelierUseCase (partie PLANIFIE → ATELIER)
  └─ campaign.enterAtelier(gameId)
       ├─ clôt automatiquement une autre partie encore en ATELIER, s'il y en a une
       │   (ATELIER → JOUE, id retourné via autoClosedGameId pour avertissement)
       └─ game.enterAtelier() — statut ATELIER, playedAt horodaté
           └─ persisté via saveCampaign(campaign)

CloseAtelierUseCase (partie ATELIER → JOUE, organisateur, manuel)
  └─ campaign.closeAtelier(gameId)
       └─ persisté via saveCampaign(campaign)
```

Pourquoi le replay reconstitue les événements d'atelier dans le bon ordre
sans mécanisme supplémentaire (`order` fractionnaire) : voir
[spec/CAMPAIGN.md — Cycle de vie d'une partie et phase Atelier](spec/CAMPAIGN.md#cycle-de-vie-dune-partie-et-phase-atelier).

#### Points d'attention

- **`resistancePoints` secret** — le total brut n'est jamais exposé, ni dans `StandingsEntry` ni dans `GET /workshop` (seul l'organisateur peut appeler `POST .../events/resistance`). Un dérivé (`CampaignParticipant.sabotagePoints`, `floor(resistancePoints / 3)`) EST exposé dans `WorkshopStateDto`, mais uniquement au propriétaire consultant son propre atelier — `null` sur `GET .../participants/:pid/workshop` (lecture d'un tiers), pour préserver le secret vis-à-vis des autres joueurs. Cf. [spec/CAMPAIGN.md — Points de sabotage](spec/CAMPAIGN.md#points-de-sabotage).
- **D6 serveur** — l'aléatoire est isolé derrière l'interface `IRandomizer` (port hexagonal, `domain/randomizer.interface.ts`). L'adaptateur production est `RandomProvider` (`infrastructure/`). Dans les tests, on passe un `FixedRandomizer implements IRandomizer` directement au constructeur de `WreckTable` — aucun `protected`/sous-classe requis. `WreckTable` prend aussi un second paramètre `ICatalogRepository` (résolution des séquelles `siege_irrecuperable`/`chassis_fragilise`, cf. §Séquelles ci-dessous) : un test double minimal suffit, seul `getSequellaType` est appelé.
- **Autorisation sans base de données** — les use cases campagne vérifient le rôle via `campaign.participants` (liste en mémoire après replay). Aucun accès SQL supplémentaire pour l'autorisation.
- **`TEAM_REPOSITORY` exporté par `TeamModule`** — requis par `CampaignRepository` (infrastructure) pour charger l'état figé des équipes au moment du replay.

#### Séquelles

Catalogue unifié `database_init/data/sequelle.yml` (12 entrées), chargé par
`CatalogService` comme tout autre catalogue d'équipement — champ `origine`
(`ATELIER` | `TABLE_EPAVES`) distinguant achat volontaire et imposition
automatique. `Sequella` (`team/domain/sequella.ts`) est une entité enfant de
`Vehicle`, miroir exact d'`Advantage` (`id`, `type`, `isSold`, prix jamais
réduit à la revente).

Unifiée dans `EquipmentChangedEvent` (`entityType: SEQUELLE`) plutôt qu'un
événement dédié — seules différences avec les 4 autres types : la monnaie
débitée/créditée est `vehicle.chocs` (pas la cagnotte du participant, cf.
`EquipmentChangedEvent.applyChocsDelta`), et le retrait est gardé par
`Vehicle.isSequellaRemovable()`/`canRemoveSequella()` — une séquelle
`TABLE_EPAVES` (dommage permanent) est **toujours** rejetée, annulation
même-session comprise (garde consultée par `Game.changeEquipment()` avant son
court-circuit d'annulation habituel, sinon contourné) ; une séquelle
`ATELIER` suit la règle historique (revente cross-session fermée par défaut,
ouverte par la présence de la séquelle `legende_vivante`). `Vehicle.canAddSequella()`
garde origine/unicité/Chocs suffisants — appelée par `Game.changeEquipment()`,
jamais par le use case (`ChangeEquipmentUseCase` reste une orchestration pure).

Dur à Cuire est le seul cas à bundler deux effets dans un seul événement
(séquelle + avantage gratuit taggé `Advantage.grantedBySequellaNomInterne`) —
cf. [spec/CAMPAIGN.md — Séquelles](spec/CAMPAIGN.md#séquelles) pour le détail
complet des 3 cas particuliers (Dur à Cuire, Maintenu par la Rouille, Légende
Vivante) et [docs/plans/2026-07-13-sequelles-design.md](plans/2026-07-13-sequelles-design.md)
pour la conception. `SequellaAddedEvent`/`AddSequellaUseCase`/`SEQUELLA_REGISTRY`
(anciens mécanismes dédiés) sont retirés.

---

## 4. Base de données — PostgreSQL 16

Credentials dans `.env` à la racine (jamais commité, template dans `.env.example`).
Dev local (`nx serve`) : variables depuis `apps/backend/.env` (hôte `localhost`).
Dev Docker : hôte `postgres` (DNS interne Docker).

**`ALL_ENTITIES`/`ALL_MIGRATIONS`** (`apps/backend/src/app/entities.ts` /
`apps/backend/src/migrations/index.ts`) — sources uniques consommées à la fois par
`app.module.ts` (`TypeOrmModule.forRootAsync`) et par `apps/backend/src/data-source.ts`
(DataSource CLI, hors Nest). `ALL_MIGRATIONS` est un **tableau explicite**, jamais un
glob : le backend est empaqueté en un `main.js` unique par `NxAppWebpackPlugin`, un glob
`dist/migrations/*.js` ne résoudrait rien à l'exécution dans le conteneur — l'import
statique dans `migrations/index.ts` est ce qui fait entrer les classes de migration dans
le graphe de dépendances de `main.ts`, donc dans le bundle webpack.

| Mode | `synchronize` | `migrationsRun` | Tables |
|------|--------------|-----------------|--------|
| **Dev/test/e2e** (`NODE_ENV` ≠ `production`) | `true` (défaut) | `false` (défaut) | Créées/modifiées automatiquement au démarrage |
| **Prod** (`NODE_ENV=production`, ou `DB_SYNCHRONIZE=false` explicite) | `false` | piloté par `DB_MIGRATIONS_RUN` | Migrations explicites, appliquées au démarrage de l'app si `DB_MIGRATIONS_RUN=true` |

`synchronize` (factory `app.module.ts`) : si `DB_SYNCHRONIZE` est explicitement fixé dans
l'environnement, sa valeur gagne toujours ; sinon le défaut dépend de `NODE_ENV`. Ce
fallback ne casse pas `frontend-e2e` : `backend-process.ts` lance `nx run backend:serve
--configuration=e2e`, et l'exécuteur `@nx/js:node` fixe lui-même `NODE_ENV` à sa
`configurationName` (`'e2e'`) si absent — valeur ajoutée à l'union acceptée par
`EnvVars`/`@IsIn` (`config/env.validation.ts`), au même titre que `development`/`test`/
`production`, puisque tout le code ne teste jamais que `=== 'production'`.

**Cibles Nx CLI** (`apps/backend/project.json`) : `migration:generate` / `migration:run` /
`migration:revert` / `schema:log`, toutes `nx:run-commands` invoquant
`typeorm-ts-node-commonjs ... -d src/data-source.ts` (`cwd: apps/backend`). Deux pièges
non documentés par TypeORM, résolus par `apps/backend/tsconfig.datasource.json`
(`TS_NODE_PROJECT`, injecté via l'option `env` de la cible) :
- `tsconfig.base.json` porte `composite: true`/`emitDeclarationOnly: true` (nécessaires
  aux project references Nx) — `emitDeclarationOnly` empêche ts-node d'émettre le moindre
  JS exécutable. Surchargés à `false` dans ce tsconfig dédié.
- ts-node type-check par défaut, alors que le build réel (`ts-loader` via
  `NxAppWebpackPlugin`, `transpileOnly: !hasPlugin` → `true` ici) ne l'a **jamais** fait —
  la CLI échouerait sinon sur des violations `strictPropertyInitialization` déjà présentes
  (et tolérées) dans les entités TypeORM (`id: number;` sans `!`/initialiseur). D'où
  `"ts-node": { "transpileOnly": true }` dans `tsconfig.datasource.json`.

Procédure de génération d'une migration de référence et garde-fou de non-régression
(comparaison contre `synchronize`) : cf. `docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-2--entités-synchronize-migration-de-référence`.

---

## 5. Infrastructure Docker

### 5.1 Développement (`docker-compose.yml`)

```
postgres   → port 5432 (hôte)
backend    → port 3000, dépend de postgres (healthcheck)
frontend   → nginx port 4200, sert les fichiers statiques uniquement
pgadmin    → port 5050 (http://localhost:5050)
```

Réseau privé `gaslands_net`. Images multi-stage (builder + runner). `docker/pgadmin/servers.json` pré-configure la connexion pgAdmin au premier démarrage. `./dev.sh` ne démarre que `postgres`/`pgadmin` via ce fichier - `backend`/`frontend` tournent en local via `nx serve` (hot reload), ce qui rend les healthchecks/variables `JWT_SECRET`/`ADMIN_*` de `docker-compose.yml` pertinents uniquement pour qui lance la stack complète en Docker (`docker compose up --build`), un chemin distinct du workflow de dev quotidien.

### 5.2 Production (`docker-compose.prod.yml`, P0-8)

> Cette section explique les choix d'architecture. Pour le mode d'emploi
> opérationnel (provisionner un VPS, déployer/mettre à jour une application,
> ajouter une 2ᵉ application, pièges connus rencontrés en conditions réelles) :
> [`docs/VPS_DEPLOYMENT.md`](VPS_DEPLOYMENT.md).

Le reverse proxy Caddy **n'appartient pas** à ce fichier : il vit dans un
stack séparé et partagé, `docker/edge/` (voir §5.3), réutilisable par
d'autres applications hébergées sur le même VPS sans jamais republier les
ports 80/443. `docker-compose.prod.yml` ne fait jamais de build sur le
serveur non plus : `backend`/`frontend` portent un champ `image:` (résolu via
`docker compose pull`) pointant vers des images construites par CI, cf. §5.4.

```
                        internet
                           │ 80/443 (+ 443/udp) - SEUL point d'entrée publié
                           ▼
                caddy (stack docker/edge/, TLS Let's Encrypt automatique)
                    ┌──────┴──────┐
              /api/*│             │reste
                     ▼             ▼
     gaslands-backend:3000   gaslands-frontend:80 (nginx, fichiers statiques)
       (alias sur edge_net)     (alias sur edge_net, nginx sert du statique)
                     │
                     ▼ réseau gaslands_db_net (internal: true)
                 postgres:5432
```

Aucun `ports:` sur `postgres`/`backend`/`frontend` - seul le stack `docker/edge/`
publie 80/443/443·udp, pour l'ensemble du VPS. pgAdmin est entièrement absent
(accès base via `docker compose -f docker-compose.prod.yml exec postgres
psql`). Deux réseaux : `edge_net` (bridge normal, **externe** - créé par
`docker/edge/`, jamais par ce fichier - point de rencontre avec Caddy ;
fournit aussi la sortie internet nécessaire à l'appel Turnstile du backend)
et `gaslands_db_net` (bridge `internal: true` - backend/postgres uniquement,
aucune route depuis caddy/frontend même en cas de compromission). `backend`
et `frontend` déclarent sur `edge_net` des **alias explicites**
(`gaslands-backend`/`gaslands-frontend`) plutôt que les noms de service nus,
pour ne jamais entrer en collision DNS avec une future 2e application
partageant ce même réseau. `backend` tourne `read_only: true` (+ `tmpfs:
[/tmp]`), `USER node`, `init: true` (relai `SIGTERM`/reap des zombies via
tini). Détail complet du routage/CSP/en-têtes : `docker/caddy/gaslands.caddy`
et §6 ci-dessous.

### 5.3 Stack partagé `docker/edge/` — reverse proxy multi-applications

Stack Compose indépendant (`name: edge`), déployé **une seule fois** sur le
VPS, avant toute application : c'est lui, et lui seul, qui possède les ports
80/443/443·udp de la machine. Il ne connaît aucune application par son nom -
son `Caddyfile` se limite au bloc global (`email {$LETSENCRYPT_EMAIL}`) suivi
d'un `import sites/*.caddy`. Chaque application dépose son propre fichier
`*.caddy` (un bloc de site = un domaine) dans `./sites/` - pour Gaslands,
`docker/caddy/gaslands.caddy` - puis un `caddy reload` fait relire la
configuration sans redémarrer le conteneur :

```bash
docker compose -f docker/edge/docker-compose.yml exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```

**Nom de domaine — substitution texte, pas variable d'environnement Caddy.**
Chaque fichier `.caddy` doit contenir un **vrai** nom de domaine littéral en
tête de bloc (`votredomaine.com {`), jamais un placeholder `{$VAR}` : cette
syntaxe Caddy lit une variable de l'environnement du conteneur qui INTERPRÈTE
le fichier - ici le conteneur `caddy` du stack `edge`, qui ne connaît que
`LETSENCRYPT_EMAIL` (cf. `docker/edge/docker-compose.yml`) et jamais le
domaine d'une application particulière (piège vécu : `{$PUBLIC_DOMAIN}` non
défini y résout en chaîne vide, produisant un bloc de site sans clé - Caddy le
prend alors pour un 2ᵉ bloc de configuration globale et refuse de démarrer,
*"server block without any key ... must be first"*). Le fichier source du
dépôt (`docker/caddy/gaslands.caddy`) garde donc un placeholder **textuel**
(`__PUBLIC_DOMAIN__`, jamais interprété par Caddy) substitué par `sed` au
moment du déploiement, avant même que Caddy ne lise le fichier :

```bash
sed "s/__PUBLIC_DOMAIN__/<votre domaine>/" docker/caddy/gaslands.caddy \
  | ssh deploy@vps "cat > /opt/edge/sites/gaslands.caddy"
```

Ajouter une 2ᵉ application ne modifie jamais ce stack lui-même : elle crée
son propre stack Compose (jamais de `ports:` publiés), rejoint `edge_net` en
`external: true` avec un alias unique, dépose son fichier `.caddy`, puis
déclenche le `reload` ci-dessus - aucune coupure pour les applications déjà
en ligne. Limite connue et acceptée : les conteneurs d'`edge_net` peuvent se
joindre directement entre eux (un bridge Docker ne cloisonne pas ses pairs
par défaut) - viable sur un VPS à propriétaire unique, sans application
tierce non maîtrisée ; le pare-feu de l'hôte, lui, continue de ne rien
exposer d'autre que Caddy vers l'extérieur.

### 5.4 Images construites par CI, jamais sur le VPS

`.github/workflows/docker-publish.yml` construit `apps/backend/Dockerfile` et
`apps/frontend/Dockerfile` sur un runner GitHub Actions (`ubuntu-latest`,
amd64 natif - même architecture que le VPS, donc aucune cross-compilation),
et les pousse vers GitHub Container Registry (`ghcr.io/arnaudbracchetti/
gaslands-manager-{backend,frontend}`), taguées à la fois `${{ github.ref_name
}}` (le tag Git, ex. `v1.0.0`) et `latest`. Déclenché uniquement sur un tag de
version (`v*.*.*`), pas à chaque push sur `main` : chaque publication d'image
correspond à une release explicite. Packages rendus publics (aucun secret
n'est jamais intégré à l'image - `JWT_SECRET`/`ADMIN_PASSWORD`/etc. sont
injectés au démarrage via `.env`, jamais au moment du build), donc le VPS n'a
besoin d'aucun `docker login` pour `pull`.

Le VPS ne construit donc jamais rien : `docker-compose.prod.yml` référence
ces images via `image: ghcr.io/.../gaslands-manager-<service>:${IMAGE_TAG:-latest}`
(`build:` y reste présent pour un usage local ponctuel, jamais utilisé en
production). Mise à jour : `git tag vX.Y.Z && git push origin vX.Y.Z` (déclenche
le workflow) puis, sur le VPS, `docker compose -f docker-compose.prod.yml pull
&& up -d`.

---

## 6. Sécurité

| Aspect | Implémentation |
|--------|----------------|
| Mots de passe | bcrypt coût 10, jamais stockés en clair |
| Tokens JWT | Signés avec `JWT_SECRET` (.env), durée 7 jours |
| Réponses API | `sanitize()` exclut `password` de toutes les réponses |
| Proxy de confiance | `app.set('trust proxy', 1)` (`main.ts`) - exactement un saut, celui du reverse proxy public (Caddy) |
| En-têtes HTTP | `helmet()` (`main.ts`) - CSP désactivée volontairement, elle vit uniquement dans Caddy (jamais deux sources) |
| Taille de corps | `json` 128kb / `urlencoded` 16kb (`main.ts`) - largement au-dessus du plus gros DTO réel (`RecordResultDto`) |
| CORS | `CORS_ORIGIN` (liste séparée par virgules, obligatoire en production), repli `http://localhost:4200` hors production |
| Erreurs login | Message générique (évite l'énumération d'emails) |
| `.env` | Non committé (`.gitignore`), exemple dans `.env.example` |
| Limite de débit | `@nestjs/throttler` (`ThrottlerModule.forRootAsync` + `APP_GUARD` dans `app.module.ts`) - 300 req/60s par IP par défaut (`THROTTLE_TTL`/`THROTTLE_LIMIT`), resserré par route via `@Throttle()` : `/auth/login` 5/60s **et** 20/3600s (double fenêtre, throttler nommé `secondary`), `/auth/register` 3/3600s, `/auth/me/password` 5/300s. Désactivé hors production (`skipIf`) - `frontend-e2e` ne serait sinon jamais vert. |

`GET /api/health` (`app.controller.ts`) exécute un `SELECT 1` via `DataSource` et n'attrape jamais l'exception TypeORM (une base indisponible doit produire un 500, le signal qu'un healthcheck Docker cherche - sondé par les `healthcheck:` des services `backend` de `docker-compose.yml`/`docker-compose.prod.yml`, cf. P0-8 ci-dessous) - décorée `@SkipThrottle({ default: true, secondary: true })` (P0-5) : un `@SkipThrottle()` sans argument ne saute que le throttler nommé `default`, `secondary` resterait sinon actif.

**Contre-mesure Caddy (P0-8)** : `ThrottlerGuard` indexe sur `req.ip`, résolu via `trust proxy: 1` + le premier hop `X-Forwarded-For`. Un reverse proxy qui *ajoute* au lieu d'*écraser* cet en-tête rendrait la limite contournable avec une valeur arbitraire par requête - `docker/caddy/gaslands.caddy` (importé par le Caddyfile du stack partagé `docker/edge/`, cf. §5.3) force donc `header_up X-Forwarded-For {http.request.remote.host}` + `header_up X-Real-IP {http.request.remote.host}` (écrasement, pas ajout) sur son bloc `handle /api/*`, qui route directement vers `gaslands-backend:3000` - jamais via le conteneur nginx (`frontend`), qui ne sert plus que les fichiers statiques en production (cf. §5 ci-dessous).

**CSP stricte vs CSS critique inliné (`apps/frontend/project.json`)** : le builder Angular (`@angular/build:application`) inline par défaut, en configuration `production`, le CSS "critique" dans le `<head>` et charge le reste via `<link media="print" onload="this.media='all'">` - un attribut `onload` **inline**, bloqué par notre CSP (`script-src` sans `'unsafe-inline'`, cf. §5.2/§5.3). Symptôme observé en bascule VPS réelle : page sans aucun style (seul le CSS critique inliné s'appliquait), avec en console `Executing inline event handler violates ... 'script-src'`. Corrigé en désactivant explicitement cette optimisation (`optimization.styles.inlineCritical: false` dans la configuration `production`) plutôt qu'en autorisant l'attribut via un hash CSP (`'unsafe-hashes'` + hash de `this.media='all'`) : plus simple, aucune dépendance à un détail d'implémentation interne du builder Angular susceptible de changer à la prochaine version.

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

> ⚠️ Installer les navigateurs Playwright avant le premier lancement : `npx playwright
> install` — sur une distro non officiellement supportée ou pour le détail des
> bibliothèques système requises (WebKit notamment), voir le skill `e2e-testing`
> (`.claude/skills/e2e-testing/SKILL.md`).

### Règle

> **Tout nouveau module NestJS** → tests unitaires service + controller.
> **Tout nouveau service Angular** → tests unitaires.

Patterns de test **unitaires** backend/frontend : [TESTING.md](TESTING.md). Tout ce
qui est **e2e** (infrastructure, base `gaslands_test` dédiée, backend isolé,
couverture actuelle, commandes, prérequis d'environnement, pièges,
troubleshooting) : skill `e2e-testing` (`.claude/skills/e2e-testing/SKILL.md`).
