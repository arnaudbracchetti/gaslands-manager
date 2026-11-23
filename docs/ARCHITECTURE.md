# Gaslands Manager - Architecture technique

> **Propriétaire** : stack, couches, patterns techniques, infrastructure. Les règles métier
> sont dans `docs/spec/`, la conception du domaine dans [DOMAIN_MODEL.md](DOMAIN_MODEL.md),
> le Strategy d'équipement dans [VEHICLE_SYSTEM.md](VEHICLE_SYSTEM.md), les composants dans
> [COMPONENTS.md](COMPONENTS.md), le déploiement opérationnel dans [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md).

---

## 1. Vue d'ensemble

```
gaslands/                    ← Monorepo Nx 22.7
├── apps/
│   ├── frontend/            ← Angular 21 (port 4200)
│   ├── frontend-e2e/        ← Playwright
│   ├── backend/             ← NestJS 11 (port 3000)
│   └── backend-e2e/         ← Vitest + axios
├── content/                 ← Markdown (documentation utilisateur, pages de référence)
├── database_init/data/      ← YAML du catalogue de jeu
├── docker/                  ← Caddy, stack edge, pgAdmin
├── docker-compose.yml       ← infra locale ; docker-compose.prod.yml ← production
└── dev.sh                   ← démarrage dev (WSL/Linux)
```

Frontend et backend sont indépendants, ne partagent aucun code ; le frontend consomme l'API REST.

---

## 2. Frontend (Angular 21)

### 2.1 Zoneless + Signals

`zone.js` absent (`provideZonelessChangeDetection()` dans `app.config.ts`) : après une opération
asynchrone, seul un Signal déclenche le re-rendu.

```typescript
// ❌ ne re-rend pas
this.http.get('/api/data').subscribe(() => {
  this.loading = false;
});
// ✅
loading = signal(true);
this.http.get('/api/data').subscribe(() => this.loading.set(false));
```

Outils : `signal()`, `computed()`, `input()`/`output()`, `effect()`.

### 2.2 Routing, sécurité, proxy

- Toutes les routes en `loadComponent` (lazy), dans `app.routes.ts` ; `data.docSlug` alimente le lien d'aide contextuelle.
- `authInterceptor` ajoute `Authorization: Bearer <token>` ; `authGuard` protège les routes privées ; `adminGuard` vérifie le rôle.
- `proxy.conf.cjs` (CommonJS pour lire `BACKEND_PORT`, défaut 3000) redirige `/api` vers le backend - permet de lancer `frontend-e2e` sur un backend de test isolé.

### 2.3 Fichiers clés

| Fichier                                            | Rôle                                                    |
| -------------------------------------------------- | ------------------------------------------------------- |
| `apps/frontend/src/app/app.config.ts`              | zoneless, router, HttpClient, intercepteur              |
| `apps/frontend/src/app/app.routes.ts`              | routes lazy                                             |
| `apps/frontend/src/app/auth/auth.service.ts`       | utilisateur courant (signals), login/logout, usurpation |
| `apps/frontend/src/app/catalog/catalog.service.ts` | catalogue public                                        |
| `apps/frontend/src/styles.scss`                    | tokens CSS (couleurs, tints, tailles de police)         |

---

## 3. Backend (NestJS 11)

### 3.1 Structure des modules

```
apps/backend/src/app/
├── app.module.ts      ← module racine
├── entities.ts        ← ALL_ENTITIES (source unique, cf. §4)
├── auth/              ← agrégat User (DDD) : authentification, profil, administration
├── catalog/           ← catalogue YAML → Map en mémoire (§3.3)
├── content/           ← Markdown → HTML (documentation utilisateur, pages)
├── shared/domain/     ← DomainException
├── team/              ← agrégat Team (DDD) : Team, Vehicle, Weapon, Improvement, Advantage, Sequella
└── campaign/          ← mode campagne (DDD + event sourcing, §3.8)
    ├── campaign.controller.ts        ← controller HTTP unique
    ├── campaign-query.service.ts     ← lectures (CQRS)
    ├── scenario-catalog.service.ts   ← catalogue de scénarios (§3.3)
    ├── house-rule-catalog.service.ts ← catalogue de règles maison (§3.3)
    ├── domain/        ← Campaign, CampaignParticipant, events/, games/, house-rules/, wreck/, enums/
    ├── application/   ← use cases
    └── infrastructure/← repository, mapper, replay, RandomProvider, entités ORM
```

Chaque module DDD suit `domain/` / `application/` / `infrastructure/` (§3.4). Nouveau module :
l'importer dans `app.module.ts`, ajouter ses entités à `ALL_ENTITIES`.

> ⚠️ **Deux classes `Campaign`** : `infrastructure/entities/campaign.entity.ts` (**`CampaignOrm`**,
> entité TypeORM) et `domain/campaign.ts` (**`Campaign`**, agrégat). Vérifier les imports.

### 3.2 Authentification JWT

1. `POST /api/auth/login` → `LoginUseCase` : `User.assertCanAuthenticate()` (comparaison via le port `IPasswordHasher`).
2. Token signé par `ITokenIssuer` (`sub`, `email`, `role`, 7 jours, `JWT_SECRET`), stocké par le client dans `localStorage`.
3. `JwtStrategy` (Passport) valide le token et dépose l'agrégat `User` dans `req.user`.

Protéger un endpoint : `@UseGuards(JwtAuthGuard)` ; par rôle : `RolesGuard` + `@Roles(...)`.
Ne **jamais** renvoyer `req.user` tel quel (cf. §3.4, réponses HTTP).

### 3.3 Catalogues - singleton en mémoire

`CatalogService` lit `database_init/data/*.yml` **une fois** au démarrage (`OnModuleInit`), convertit
les champs Markdown (`description`, `regles`, `Sponsor.description`) en HTML via `marked`, puis
indexe une `Map<string, Sponsor>` aux relations pré-résolues (accès O(1)). Fail-fast : un YAML
invalide fait crasher le démarrage plutôt que de servir un catalogue vide.

Même pattern : `ScenarioCatalogService`, `HouseRuleCatalogService` (`validKeys()` sert à valider le
réglage des règles maison), `DocsService` (manifeste de la documentation utilisateur), `AdminSeedService` (§3.5).

**Tests - Template Method** : le service expose `protected readFileContent(filename)` ; le spec
étend la classe et surcharge cette méthode avec des YAML fictifs (évite `vi.mock('fs')` sous SWC/Vitest).

```typescript
class TestCatalogService extends CatalogService {
  protected override readFileContent(filename: string): string {
    return MOCK_YAML[filename];
  }
}
```

### 3.4 Architecture DDD - standard du projet

> Méthode de conception (générique) : skill [`ddd`](../.claude/skills/ddd/SKILL.md). Ici, le pattern
> concret en place. `team/`, `campaign/` et `auth/` le suivent.

| Couche         | Dossier           | Contient                                                             | Règle absolue                        |
| -------------- | ----------------- | -------------------------------------------------------------------- | ------------------------------------ |
| Domaine        | `domain/`         | agrégat, entités enfants, Value Objects, interfaces `IXxxRepository` | 0 dépendance NestJS/TypeORM          |
| Application    | `application/`    | un use case par commande                                             | orchestration uniquement             |
| Infrastructure | `infrastructure/` | repository TypeORM, mappers, adapters                                | implémente les interfaces du domaine |
| Présentation   | `*.controller.ts` | controllers                                                          | HTTP → commande → use case           |

**L'agrégat porte toutes les règles** et lève `DomainException` ; le use case la traduit en
`BadRequestException` (seul point de contact NestJS/domaine).

```typescript
// domain/vehicle.ts
addWeapon(type: WeaponType, orientation: WeaponOrientation | null, budget: number): void {
  const result = this.canAddWeapon(type, orientation, budget);
  if (!result.ok) throw new DomainException(result.reason!);
  this._weapons.push(new Weapon(0, type, orientation));
}
```

**Value Objects** (`domain/value-objects/`) : enveloppent les données catalogue et exposent une API
typée (`price`, `slots`, `requiresOrientation`…).

**Strategy d'équipement** (stats effectives, validation de pose) : [VEHICLE_SYSTEM.md §4](VEHICLE_SYSTEM.md#4-pattern-strategy---equipmentbehavior).

**Convention - qui sélectionne une Strategy** : jamais l'appelant (use case, controller). Le domaine
la résout via une Factory pure dès que la variante dépend d'un état ou d'une configuration du
domaine (principe : [skill `ddd`, aggregate-design.md](../.claude/skills/ddd/theory/aggregate-design.md#qui-sélectionne-une-strategy-)).
Exemples : `resolveImprovementBehavior` (équipement), `HouseRuleStrategyFactory` (règles maison, §3.8).

**Dependency Inversion et injection** : le domaine définit `ITeamRepository`/`ICatalogRepository`,
l'infrastructure les implémente. Les interfaces n'étant pas injectables, tokens string
(`team.tokens.ts`) et use cases fournis en `useFactory` pour garder le domaine sans décorateurs :

```typescript
// team.module.ts
{ provide: TEAM_REPOSITORY, useClass: TeamRepository },
{
  provide: AddWeaponUseCase,
  useFactory: (tr: ITeamRepository, cr: ICatalogRepository) => new AddWeaponUseCase(tr, cr),
  inject: [TEAM_REPOSITORY, CATALOG_REPOSITORY],
}
```

**Flux d'une mutation** : charger l'agrégat (le repository vérifie `userId`) → résoudre les Value
Objects via `catalogRepo` → déléguer à l'agrégat → `teamRepo.save(team)` (cascade TypeORM).

**Réponses HTTP** : jamais une entité ORM ni un agrégat brut, toujours un mapper
(`vehicleDomainToDto()`, `userDomainToDto()`). Pas une préférence : `JSON.stringify()` **ne sérialise
pas** les accesseurs `get`, un agrégat renvoyé tel quel perd silencieusement ses champs calculés
(ex. `User.callName`).

**Read model partagé - fiche d'équipe** : `team/infrastructure/team-sheet.mapper.ts` et
`team-sheet.renderer.ts` (fonctions pures, sans dépendance catalogue car `.type` est toujours déjà
résolu) servent à la fois `GetTeamSheetUseCase` (`team/`) et `GetCampaignTeamSheetUseCase`
(`campaign/`, après replay). Logés dans `team/` car `campaign/` dépend déjà de `team/`, jamais l'inverse.

**⚠️ Piège TypeORM - `where` sur une collection hydratée** : un `where` sur une relation
`OneToMany`/`ManyToMany` également chargée via `relations` réutilise la même jointure, donc **filtre
la collection chargée** (non documenté par TypeORM). Symptôme vécu : `findByWeaponId` reconstituait
un véhicule avec une seule arme, corrompant coût et emplacements. Règle : tout `findByXxxId` qui
trouve un agrégat via un enfant résout d'abord l'id du parent (`select: { teamId: true }`), puis
recharge par id scalaire (`TeamRepository.findByWeaponId` → `findByIdForUser`).

### 3.5 Compte administrateur - `AdminSeedService`

Garantit au démarrage (`OnModuleInit`) un unique utilisateur admin - comportement :
[AUTH.md](spec/AUTH.md#compte-administrateur). Reste un service (déclenché par le cycle de vie, pas
par HTTP) mais passe par `IUserRepository` et l'agrégat, sans ORM ni bcrypt direct.
`ADMIN_PASSWORD` lu par `config.getOrThrow()` (pas de défaut pour un secret) ; `ADMIN_EMAIL` a un défaut.

### 3.6 `TeamSummaryDto` - read model léger

Réponse de `GET /api/teams` (`team.repository.interface.ts`) : champs calculés en mémoire depuis
l'agrégat chargé (`vehicleCount`, `vehiclesCost`, `budget`, `campaignBudget`, `isEngaged`,
`isLockedByCampaign`), jamais stockés. Sémantique : [TEAMS.md](spec/TEAMS.md#modèle-de-données---team).

### 3.7 Fichiers clés (backend)

| Fichier                                                                     | Rôle                                                                                      |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `main.ts`                                                                   | bootstrap, préfixe `/api`, helmet, CORS, trust proxy                                      |
| `app/app.module.ts`                                                         | TypeORM, ConfigModule, throttler, modules                                                 |
| `app/auth/domain/user.ts`                                                   | agrégat User, getter `callName` (unique source du nom affiché)                            |
| `app/auth/domain/password-hasher.interface.ts`, `token-issuer.interface.ts` | ports hexagonaux (bcrypt, JWT hors domaine)                                               |
| `app/auth/application/`                                                     | use cases ; **aucun** ne porte `@LogUseCase()` (il journaliserait les mots de passe)      |
| `app/auth/infrastructure/user.mapper.ts`                                    | ORM ↔ agrégat (aussi utilisé par `CampaignQueryService` pour `callName`)                  |
| `app/auth/infrastructure/user-http.mapper.ts`                               | agrégat → DTO (matérialise `callName`, n'expose jamais le hash)                           |
| `app/team/domain/team.ts`                                                   | agrégat Team                                                                              |
| `app/team/infrastructure/team.mapper.ts`, `catalog.adapter.ts`              | mapping ORM, `CatalogService` → `ICatalogRepository`                                      |
| `app/team/team.tokens.ts`, `team.module.ts`                                 | tokens d'injection, modèle de câblage                                                     |
| `app/campaign/domain/campaign.ts`                                           | agrégat Campaign (navigation, cycle de vie, replay, `strategyFactory`)                    |
| `app/campaign/domain/games/game.ts`                                         | construction des événements d'une partie (Invoker)                                        |
| `app/campaign/domain/games/game-context.ts`                                 | `GameRulesContext`, interface étroite exposée par `Campaign` à `Game`                     |
| `app/campaign/domain/house-rules/`                                          | `HouseRules` (Value Object), `HouseRuleStrategyFactory`, une Strategy par point de calcul |
| `app/campaign/domain/wreck/wreck-table.ts`                                  | Table des Épaves (domain service, `IRandomizer` + `ICatalogRepository`)                   |
| `app/campaign/infrastructure/campaign-replay.service.ts`                    | `loadAndReplay`, unique point d'entrée des use cases                                      |
| `app/campaign/infrastructure/random-provider.ts`                            | adaptateur `IRandomizer` → `Math.random()`                                                |
| `app/campaign/campaign-query.service.ts`                                    | read models (CQRS)                                                                        |

### 3.8 Mode campagne - event sourcing

Seul le **journal** (`game_events`) est persisté ; l'état courant (cagnottes, PC, chocs, équipement
acheté en atelier…) est **recalculé par replay** à chaque chargement. Écritures : use cases via
l'agrégat ; lectures : `CampaignQueryService` (accès ORM direct). Conception détaillée (patterns,
répartition `Campaign`/`Game`, entités transientes, règles maison) :
[DOMAIN_MODEL.md §4](DOMAIN_MODEL.md#4-domaine-campagne-event-sourcing).

| Pattern GoF                 | Classes                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| Command                     | `GameEvent` et ses sous-classes (`execute()`/`undo()`/`describe()`)                      |
| Invoker                     | `Game` (`EvenementTeleGame`, `EscarmoucheGame`) : `canAccept`/`addEvent` selon le statut |
| Receiver                    | `CampaignParticipant` (compteurs transients)                                             |
| Strategy + Abstract Factory | règles maison (`HouseRuleStrategyFactory`)                                               |

**Flux d'une écriture** :

```
Controller → UseCase
  1. campaign = loadAndReplay(campaignId)
  2. assertOrganizer / assertParticipant (sur campaign.participants, sans SQL)
  3. game = campaign.findGame(gameId) | campaign.findAtelierGame()
  4. events = game.xxx(...)        → construits (id=0), validés, journalisés via addEvent()
  5. campaignRepo.appendEvents()   → INSERT, id attribué par la base
```

Aucune étape n'appelle `event.execute()` : les compteurs ne sont recalculés qu'au prochain replay.
Piège : `Game.changeEquipment()` ne doit surtout pas l'appeler avant persistance - une entité
transiente prend l'id `-event.id`, et `id=0` donnerait `-0 = 0` ; le client relit ensuite `GET .../workshop`.

**Entrée en atelier** (`EnterAtelierUseCase`) : `game.distributeResistance()` (résout sa Strategy
lui-même, idempotent) puis `appendEvents` ; ensuite `campaign.enterAtelier(gameId)` (clôt l'autre
atelier éventuel) puis `saveCampaign`.

**Points d'attention** :

- **Valeurs nouvelles du journal** : le replay n'a pas de repli pour une valeur inconnue → à déclarer dans [`valeurs-nouvelles.txt`](../apps/backend/src/migrations/valeurs-nouvelles.txt).
- **`resistancePoints` secret** : jamais exposé ; seul le dérivé `sabotagePoints` l'est, au propriétaire (cf. [CAMPAIGN.md](spec/CAMPAIGN.md#points-de-sabotage)).
- **Aléatoire** derrière le port `IRandomizer` ; en test, `FixedRandomizer` passé au constructeur de `WreckTable` (avec un double minimal d'`ICatalogRepository` : seul `getSequellaType` est appelé).
- **Dépendances entre modules** : `TeamModule` exporte `TEAM_REPOSITORY` (consommé par `CampaignRepository`) ; `CampaignModule` exporte `CAMPAIGN_REPOSITORY` (consommé par `RemoveUserUseCase`). Pas de cycle : `CampaignModule` n'importe jamais `AuthModule` (noms via la fonction pure `UserMapper`).

---

## 4. Base de données (PostgreSQL 16)

Credentials dans `.env` (jamais commité, modèle `.env.example`) ; dev local : `apps/backend/.env`
(hôte `localhost`), Docker : hôte `postgres`.

**Sources uniques** : `ALL_ENTITIES` (`app/entities.ts`) et `ALL_MIGRATIONS` (`migrations/index.ts`),
consommées par `app.module.ts` et `data-source.ts` (CLI). `ALL_MIGRATIONS` est un **tableau explicite,
jamais un glob** : le backend est empaqueté en un seul `main.js` par webpack, seul l'import statique
fait entrer les migrations dans le bundle.

| Mode                                         | `synchronize` | `migrationsRun`     |
| -------------------------------------------- | ------------- | ------------------- |
| dev / test / e2e (`NODE_ENV` ≠ `production`) | `true`        | `false`             |
| production                                   | `false`       | `DB_MIGRATIONS_RUN` |

`DB_SYNCHRONIZE`, s'il est défini, l'emporte toujours. `NODE_ENV=e2e` est accepté (l'exécuteur
`@nx/js:node` le fixe à sa `configurationName`).

**Cibles Nx** (`apps/backend/project.json`) : `migration:generate`/`run`/`revert`, `schema:log`, via
`typeorm-ts-node-commonjs -d src/data-source.ts` avec `tsconfig.datasource.json` (surcharge
`emitDeclarationOnly: false`, sinon ts-node n'émet rien, et `transpileOnly: true` comme le build réel).

**Concordance entités/migrations** (`backend:migration:check`, CI) : joue toutes les migrations sur
une base **vide** puis `migration:generate --check` (une migration oubliée dans l'index apparaît
comme un écart). En local, sur une base jetable :

```bash
docker run -d --rm --name gaslands-migcheck -p 5499:5432 \
  -e POSTGRES_USER=gaslands -e POSTGRES_PASSWORD=gaslands postgres:16-alpine
DATABASE_PORT=5499 DATABASE_PASSWORD=gaslands npx nx run backend:migration:check
docker stop gaslands-migcheck
```

**Migrations additives** : le retour arrière relance l'image N-1 **sans restaurer la base**
([ADR 0001](adr/0001-retour-arriere-par-l-image-precedente-sans-restauration.md)), ce qui n'est sûr
que si N-1 tourne sur le schéma laissé par N.

- Une migration ajoute (table, colonne nullable ou avec `DEFAULT`, index, contrainte). Un changement destructif s'étale sur deux versions (ajout en N, suppression en N+1).
- Sinon, marqueur exact `// incompatible : <raison>` (minuscules, `//`, raison non vide - le script de retour arrière le cherche avec la même regex) ; le retour arrière passe alors par la restauration du dump.
- Enum : `ALTER TYPE "…" ADD VALUE '…'`, jamais la séquence TypeORM (renommage, `DROP TYPE`), et ne pas utiliser la nouvelle valeur dans le même lot (tout le lot tourne dans une transaction).
- `CONCURRENTLY` interdit (échoue en transaction).

`backend:migration:lint` ([lint-migrations.ts](../apps/backend/scripts/lint-migrations.ts), CI, sans
base) analyse le `up()` des migrations postérieures à `REFERENCE_MIGRATION` (dernière déployée,
aujourd'hui `AddCampaignBudget1786182754067` - à avancer après chaque release) et refuse sans marqueur
`DROP TABLE/COLUMN/TYPE/DEFAULT`, `RENAME`, `SET NOT NULL`, `ALTER COLUMN … TYPE`, `ADD … NOT NULL` sans
`DEFAULT`, `TRUNCATE`, `DELETE FROM` et les `queryRunner.drop*/rename*/changeColumn*`. C'est un filet,
pas une preuve : `DROP CONSTRAINT`, `DROP INDEX` ou le SQL dynamique ne sont pas contrôlés.

---

## 5. Infrastructure Docker

Procédures (provisionner, déployer, ajouter une application, pièges vécus) : [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md).

**Développement** (`docker-compose.yml`) : `postgres` (5432), `pgadmin` (5050), et `backend`/`frontend`
pour qui lance la stack complète. `./dev.sh` ne démarre que postgres et pgAdmin ; backend et frontend
tournent en `nx serve` (hot reload).

**Production** (`docker-compose.prod.yml`) :

- Le reverse proxy Caddy vit dans un stack séparé et partagé, `docker/edge/`, seul à publier 80/443 pour tout le VPS ; chaque application y dépose un fichier `sites/*.caddy` (Gaslands : `docker/caddy/gaslands.caddy`, domaine substitué par `sed` au déploiement) puis `caddy reload`.
- Aucun `ports:` sur postgres/backend/frontend, pas de pgAdmin. Réseaux : `edge_net` (externe, partagé avec Caddy, alias `gaslands-backend`/`gaslands-frontend` pour éviter les collisions DNS) et `gaslands_db_net` (`internal: true`, backend + postgres seulement).
- `backend` en `read_only` (+ `tmpfs /tmp`), `USER node`, `init: true`. Le frontend (nginx) ne sert que du statique ; `/api/*` va directement du proxy au backend.

**Images** : construites par la CI (`.github/workflows/ci.yml`), jamais sur le VPS. Job `verify`
(format, lint, tests, build, `migration:check` sur postgres:16) puis job `image` uniquement sur un tag
`v*` posé sur `main` : publication sur GHCR (`gaslands-manager-{backend,frontend}`), taguées par version
uniquement (jamais `latest`), packages publics (aucun secret dans l'image). `IMAGE_TAG` est **exigé** par
`docker-compose.prod.yml`. Mise à jour : `git tag vX.Y.Z && git push origin vX.Y.Z`, puis sur le VPS
`pull && up -d` (ou `deploy-gaslands.sh`). L'image backend embarque `/app/migrations/` (migrations +
`valeurs-nouvelles.txt`), lu par l'option retour arrière de `deploy-gaslands.sh` (absent jusqu'à v1.0.0).

---

## 6. Sécurité

| Aspect             | Implémentation                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mots de passe      | bcrypt coût 10, uniquement dans `BcryptPasswordHasher`                                                                                                                                                                                                                     |
| JWT                | `JWT_SECRET`, 7 jours, pas de révocation (d'où la déconnexion après changement de mot de passe)                                                                                                                                                                            |
| Réponses API       | le hash n'existe dans aucun DTO (mapper `userDomainToDto`)                                                                                                                                                                                                                 |
| Proxy de confiance | `trust proxy: 1` (un saut : Caddy)                                                                                                                                                                                                                                         |
| En-têtes           | `helmet()` ; CSP désactivée côté Nest, elle vit uniquement dans Caddy                                                                                                                                                                                                      |
| Taille de corps    | `json` 128kb, `urlencoded` 16kb                                                                                                                                                                                                                                            |
| CORS               | `CORS_ORIGIN` (obligatoire en production), repli `http://localhost:4200`                                                                                                                                                                                                   |
| Erreur de login    | message générique (pas d'énumération d'emails)                                                                                                                                                                                                                             |
| Limite de débit    | `@nestjs/throttler` global 300 req/60s/IP (`THROTTLE_TTL`/`THROTTLE_LIMIT`), resserré par route : login 5/60s **et** 20/3600s (throttler nommé `secondary`), register 3/3600s, changement de mot de passe 5/300s ; désactivé hors production (sinon `frontend-e2e` échoue) |

- **Caddy écrase** `X-Forwarded-For`/`X-Real-IP` avec l'IP réelle (`header_up … {http.request.remote.host}`) : un proxy qui _ajouterait_ à l'en-tête rendrait la limite de débit contournable.
- `GET /api/health` : `SELECT 1`, l'exception n'est pas attrapée (base indisponible → 500, signal du healthcheck Docker) ; `@SkipThrottle({ default: true, secondary: true })` - sans argument, seul `default` serait ignoré.
- `GET /api/version` : renvoie `IMAGE_TAG`, ou `null` (jamais de repli comme `"latest"`).
- **CSP stricte et CSS critique** : le builder Angular inline par défaut le CSS critique avec un `onload` inline, bloqué par la CSP (`script-src` sans `unsafe-inline`) → page sans style. Désactivé : `optimization.styles.inlineCritical: false` (configuration `production` de `apps/frontend/project.json`).

---

## 7. Tests

| Projet               | Outil                            | Commande                  |
| -------------------- | -------------------------------- | ------------------------- |
| Frontend (unitaires) | Vitest + Angular Testing Library | `npx nx test frontend`    |
| Backend (unitaires)  | Vitest                           | `npx nx test backend`     |
| E2E frontend         | Playwright                       | `npx nx e2e frontend-e2e` |
| E2E backend          | Vitest + axios                   | `npx nx e2e backend-e2e`  |

Règle : tout nouveau module NestJS → tests unitaires service + controller ; tout nouveau service
Angular → tests unitaires. Patterns unitaires : [TESTING.md](TESTING.md). Tout l'e2e : skill `e2e-testing`.
