# Durcissement sécurité avant mise en ligne sur VPS

> Document de conception — 2026-08-02.
> Portée : authentification, anti-abus (inscription en masse), validation des entrées,
> et déploiement public (Docker Compose + Caddy/TLS).
> Spécification concernée : [docs/spec/AUTH.md](../spec/AUTH.md).

## Contexte

L'application va être exposée publiquement sur un VPS. L'audit de la surface d'authentification
et de déploiement révèle que **rien** n'existe aujourd'hui pour résister à un usage hostile :

- **Aucune limite de débit** sur `POST /api/auth/register` ni `POST /api/auth/login` → création
  de comptes en masse et bourrage d'identifiants, bornés uniquement par le coût CPU de bcrypt.
- **Aucun captcha, aucune vérification d'email, aucun état "compte à activer"**
  (`auth/domain/user.ts:120` — `create()` force toujours `isActive: true`).
- **Aucune validation d'entrée** : les 27 DTO de requête n'ont zéro décorateur `class-validator`
  (choix pédagogique assumé, cf. `auth/dto/register.dto.ts:8-12`), pas de `ValidationPipe` global,
  pas de limite de taille de corps de requête. L'email n'est jamais validé en format, le mot de
  passe n'a pas de longueur maximale (bcrypt tronque silencieusement à 72 **octets** — deux mots de
  passe différents peuvent authentifier le même compte).
- **Bug d'autorisation réel** : `auth/jwt.strategy.ts:66-68` recharge l'utilisateur en base mais ne
  vérifie jamais `isActive` — désactiver un compte est un **no-op pendant 7 jours**.
- **`JWT_SECRET` lu via `config.get()`** (`auth/auth.module.ts:54`), pas `getOrThrow` → démarrage
  silencieux avec un secret `undefined`. Jeton valide 7 jours, sans révocation.
- **Déploiement inopérant et exposé** : `docker-compose.yml` publie Postgres (`:5432`), le backend
  (`:3000`) et pgAdmin (`:5050`) sur l'hôte ; le service backend ne reçoit ni `JWT_SECRET` ni
  `ADMIN_*` (L72-91) alors que `.dockerignore` exclut `apps/backend/.env` → **le conteneur boucle en
  crash aujourd'hui**. `nginx.conf` est en HTTP nu, sans TLS ni en-tête de sécurité. Le Dockerfile
  backend tourne en root et embarque tout `node_modules` de dev.
- **`synchronize: true` inconditionnel** (`app.module.ts:42`) : sur une base de production, la
  moindre modification d'entité peut supprimer des colonnes en silence. Aucune migration n'a jamais
  été jouée dans ce dépôt.

**Décisions prises** : captcha Cloudflare Turnstile · Docker Compose + Caddy (TLS Let's Encrypt
automatique) · durcissement complet avant mise en ligne.

**Résultat visé** : une instance publique où l'inscription est protégée par captcha + limite de
débit, où toute entrée est validée, où les secrets sont obligatoires et vérifiés au démarrage, où
le schéma évolue par migrations, et où seuls les ports 80/443 sont exposés.

---

## Ordre d'exécution (P0 = bloquant pour la mise en ligne)

Chaque étape dépend de la précédente. Point de contrôle e2e vert avant de passer à la suivante.

| # | Item | Pourquoi c'est bloquant |
|---|------|-------------------------|
| P0-1 | Contrat de variables d'environnement + validation, `JWT_SECRET` en `getOrThrow` | Le conteneur backend ne démarre pas aujourd'hui. Rien n'est testable avant. |
| P0-2 | `ALL_ENTITIES`, `synchronize` piloté par config, migration de référence | `synchronize: true` sur une base publique = perte de données silencieuse. À faire **avant** les premières données réelles. |
| P0-3 | Bootstrap `main.ts` : trust proxy, helmet, limites de corps, CORS par env | Prérequis de P0-5 (le throttler doit voir la vraie IP client). |
| P0-4 | Vérification `isActive` à chaque requête JWT | Seul bug d'autorisation franc. |
| P0-5 | Limite de débit (`@nestjs/throttler`) | Sans elle, `/auth/login` et `/auth/register` sont ouverts. |
| P0-6 | Turnstile (port/adaptateur + widget), neutralisé en dev/e2e | Contrôle principal anti-inscription massive. |
| P0-7 | `class-validator` sur les 27 DTO + `ValidationPipe` global | Effort et risque de régression les plus élevés → volontairement en dernier, la suite e2e complète sert de garde-fou. |
| P0-8 | `docker-compose.prod.yml` + `Caddyfile` + corrections Dockerfile | Le déploiement lui-même. |

**P1 (première semaine)** : oracle temporel du login · longueur max du mot de passe · format d'email
dans l'agrégat · TTL du jeton · journal d'audit auth · rédaction des secrets dans `@LogUseCase()` ·
sauvegardes `pg_dump` · resserrage CSP après observation.

**P2 (décisions produit)** : vérification d'email (rend l'énumération de comptes corrigeable
proprement) · réinitialisation de mot de passe · verrouillage de compte · jetons de rafraîchissement.

**Risques acceptés et documentés** (§Décisions assumées ci-dessous) : le 409 à l'inscription
(énumération de comptes) · le JWT en `localStorage` · pgAdmin retiré de la prod.

---

## P0-1 — Contrat de variables d'environnement

**Créer** `apps/backend/src/app/config/env.validation.ts` : une classe `EnvVars` décorée
`class-validator` + une fonction `validateEnv(raw): EnvVars` (`plainToInstance` + `validateSync`),
passée à `ConfigModule.forRoot({ validate: validateEnv, cache: true })` dans
[app.module.ts:26-29](../../apps/backend/src/app/app.module.ts#L26-L29). Pas de `joi` — `class-validator`
est de toute façon installé en P0-7, une seule bibliothèque de validation.

- Toujours requis : `DATABASE_{HOST,PORT,USER,PASSWORD,NAME}`, `JWT_SECRET`, `ADMIN_EMAIL`
  (`@IsEmail()`), `ADMIN_PASSWORD`.
- `NODE_ENV` : `@IsIn(['development','test','production'])`, défaut `development`.
- Requis en production seulement (`@ValidateIf(o => o.NODE_ENV === 'production')`) :
  `TURNSTILE_SECRET_KEY`, `CORS_ORIGIN`, plus `@MinLength(32)` et `@NotEquals('change_me')` sur
  `JWT_SECRET` / `ADMIN_PASSWORD` / `DATABASE_PASSWORD`.
- Optionnels avec défaut : `JWT_EXPIRATION`, `PORT`, `CONTENT_DIR`, `DB_SYNCHRONIZE`,
  `DB_MIGRATIONS_RUN`, `DB_SSL`, `THROTTLE_*`.

**Modifier** [auth.module.ts:54](../../apps/backend/src/app/auth/auth.module.ts#L54) et
[jwt.strategy.ts:49](../../apps/backend/src/app/auth/jwt.strategy.ts#L49) → `config.getOrThrow('JWT_SECRET')`
(supprimer le `!` et le commentaire qui prétend à tort que l'absence fait crasher le démarrage).

**Modifier** `.env.example` (racine) : ajouter `JWT_SECRET`, `JWT_EXPIRATION`, `ADMIN_*`,
`TURNSTILE_SECRET_KEY`, `CORS_ORIGIN`, `PUBLIC_DOMAIN`, `LETSENCRYPT_EMAIL`, `THROTTLE_*`,
`DB_SYNCHRONIZE=false`, `DB_MIGRATIONS_RUN=true`, avec un commentaire distinguant le `.env` racine
(Compose) de `apps/backend/.env` (`nx serve`).

## P0-2 — Entités, `synchronize`, migration de référence

**Créer** `apps/backend/src/app/entities.ts` exportant `ALL_ENTITIES` (les 10 entités ORM) — source
unique consommée par `app.module.ts` **et** par la datasource CLI, sinon les deux dérivent.

**Créer** `apps/backend/src/migrations/index.ts` exportant `ALL_MIGRATIONS` — **un tableau explicite,
pas un glob**. Le backend est empaqueté en un `main.js` unique par `NxAppWebpackPlugin` : un glob
`dist/migrations/*.js` ne résout rien à l'exécution dans le conteneur. C'est le piège non évident de
cette étape.

**Créer** `apps/backend/src/data-source.ts` (export par défaut, lit `process.env` directement — la
CLI TypeORM tourne hors de Nest), `synchronize: false`.

**Modifier** [app.module.ts:31-45](../../apps/backend/src/app/app.module.ts#L31-L45) : `entities:
ALL_ENTITIES`, `migrations: ALL_MIGRATIONS`, `synchronize` défaut `NODE_ENV !== 'production'`,
`migrationsRun` par env, `ssl` par env. **Ce défaut par `NODE_ENV` est ce qui laisse `frontend-e2e`
intact** : `backend-process.ts` lance `nx run backend:serve --configuration=e2e` sans
`NODE_ENV=production`, donc `synchronize` reste `true` et `gaslands_test` continue d'être créée
avant que `db.ts` ne la vide. Ne pas faire dépendre l'e2e des migrations dans cette passe.

**Procédure de la migration de référence** (aucune n'a jamais été jouée) :
1. Base vide dédiée : `docker compose exec postgres createdb -U gaslands gaslands_migbase`.
2. Ajouter les cibles Nx `migration:generate` / `migration:run` / `migration:revert` / `schema:log`
   dans `apps/backend/project.json` (`nx:run-commands` → `typeorm-ts-node-commonjs ... -d
   apps/backend/src/data-source.ts`).
3. Générer contre la base vide → TypeORM émet le `CREATE TABLE` **complet** des 10 entités + index
   + clés étrangères. C'est la référence.
4. Enregistrer la classe générée dans `migrations/index.ts`.
5. **Garde-fou à ne pas sauter** : sur une seconde base vide, `migration:run` puis `schema:log` doit
   afficher *"No changes in database schema were found"*. C'est la preuve que la référence est
   équivalente à ce que `synchronize` produit aujourd'hui.
6. Base de dev existante : marquer la migration comme appliquée
   (`INSERT INTO migrations(timestamp, "name") VALUES (...)`). La base du VPS étant neuve,
   `migrationsRun: true` l'appliquera au premier démarrage.
7. Supprimer `gaslands_migbase`.

## P0-3 — Bootstrap `main.ts`

**Modifier** [main.ts](../../apps/backend/src/main.ts) :
- `NestFactory.create<NestExpressApplication>(AppModule)` puis `app.set('trust proxy', 1)` — exactement
  un saut (Caddy), cf. §P0-5 pour la contrepartie côté Caddy qui rend ça sûr.
- `app.use(helmet({ contentSecurityPolicy: false }))` — **la CSP vit uniquement dans Caddy** (c'est
  Caddy qui sert le HTML ; deux sources de CSP = application cassée sans savoir quel en-tête gagne).
- `app.use(json({ limit: '128kb' }))` + `urlencoded({ limit: '16kb' })`. Le plus gros corps réel est
  `RecordResultDto` — très en dessous.
- CORS depuis `CORS_ORIGIN` (liste séparée par virgules), repli `http://localhost:4200`.
- **Conserver la ligne de log verbatim** `🚀 Backend Gaslands démarré sur http://localhost:${port}/api`
  — `frontend-e2e/src/support/backend-process.ts` la cherche dans stdout. La modifier casse toute la
  suite Playwright.

**Ajouter** `@Get('health')` dans `app.controller.ts` (un `SELECT 1` via `DataSource`), décoré
`@SkipThrottle()` — consommé par le healthcheck Compose.

## P0-4 — `isActive` vérifié à chaque requête

« Un compte désactivé ne peut pas détenir de session » est une **règle métier** : elle va dans
l'agrégat, pas dans la stratégie Passport (règle projet, cf. CLAUDE.md).

**Modifier** [auth/domain/user.ts](../../apps/backend/src/app/auth/domain/user.ts) : ajouter
`assertCanHoldSession()` levant `DomainException`, et refactorer `assertCanAuthenticate` (L200-207)
pour l'appeler après la comparaison du mot de passe — la règle n'existe qu'à un seul endroit, le
commentaire expliquant pourquoi le message de désactivation n'apparaît qu'après un mot de passe
valide reste vrai.

**Modifier** [jwt.strategy.ts:66-68](../../apps/backend/src/app/auth/jwt.strategy.ts#L66-L68) : après
`findById`, appeler `user.assertCanHoldSession()` et traduire `DomainException` → `UnauthorizedException`.

**Tests** : cas dans `user.spec.ts` + nouveau `jwt.strategy.spec.ts` avec un faux `IUserRepository`
(double objet simple, pas de module de test NestJS — style du projet).

## P0-5 — Limite de débit

**Installer** `@nestjs/throttler` (en `dependencies`, pas `devDependencies`).

`ThrottlerModule.forRootAsync` dans `app.module.ts` + `{ provide: APP_GUARD, useClass: ThrottlerGuard }`.

| Route | Limite | Raison |
|---|---|---|
| Global | 300 / 60 s par IP | L'app est bavarde (écrans campagne/atelier), et un foyer derrière un NAT partage le seau. Invisible pour un vrai usage, stoppe le scraping. |
| `POST /auth/login` | 5 / 60 s **et** 20 / 3600 s | La double fenêtre bloque aussi l'attaque lente qui reste sous le plafond par minute. |
| `POST /auth/register` | 3 / 3600 s | Le captcha est le contrôle principal ; ceci est le filet si la clé de site fuite vers une ferme à bots. |
| `PATCH /auth/me/password` | 5 / 300 s | Endpoint qui compare un bcrypt derrière une session — protège le CPU. |
| `GET /api/health` | `@SkipThrottle()` | Sondé par le healthcheck Docker. |

**Interaction e2e — casse `frontend-e2e` si non traitée** : la suite Playwright crée 20+ comptes et
se connecte en boucle depuis `127.0.0.1`, sur 3 navigateurs. Contre 3 inscriptions/heure, tout
échoue en 429 dès le second spec. Correctif dans la factory : `skipIf: () => config.get('NODE_ENV')
!== 'production'`. Un seul interrupteur, aucun contournement par test. Limites elles-mêmes pilotées
par `THROTTLE_*` pour être ajustables sur le VPS sans rebuild.

**Le piège trust-proxy / Caddy.** `ThrottlerGuard` indexe sur `req.ip`. Avec `trust proxy: 1`,
Express prend l'entrée **avant-dernière** de `X-Forwarded-For`, et `reverse_proxy` de Caddy
**ajoute** le pair immédiat à l'en-tête reçu. Un attaquant envoyant `X-Forwarded-For: 1.2.3.4`
obtient `1.2.3.4, <vraieIP>` et Express retient `1.2.3.4` → **toute limite devient contournable avec
un en-tête aléatoire par requête**. Contre-mesure obligatoire dans le Caddyfile — écraser au lieu
d'ajouter :

```
reverse_proxy backend:3000 {
    header_up X-Forwarded-For {http.request.remote.host}
    header_up X-Real-IP      {http.request.remote.host}
}
```

Et router `/api/*` **directement** vers `backend:3000` depuis Caddy, jamais à travers le conteneur
nginx : le bloc `location /api/` actuel ajouterait un second saut non fiable et invaliderait le
compte `trust proxy: 1`.

## P0-6 — Turnstile

### Backend — port/adaptateur, calqué sur `IPasswordHasher`

C'est une préoccupation d'**infrastructure**, pas une règle de domaine : « le demandeur est un
humain » est une propriété de la *requête HTTP*, pas du compte ; elle implique un appel réseau
tiers ; et elle doit être désactivable en dev/e2e. La mettre dans `User.register()` traînerait un
port d'I/O dans une fabrique d'agrégat et forcerait un double captcha dans chaque test de `User`.

- **Créer** `auth/domain/captcha-verifier.interface.ts` : `ICaptchaVerifier.assertHuman(token?,
  remoteIp?): Promise<void>`, **lève** `DomainException` (plutôt que retourner un booléen) — le use
  case réutilise ainsi son `catch (e instanceof DomainException)` existant. En-tête commenté sur le
  modèle de `password-hasher.interface.ts` (port hexagonal, cf. ARCHITECTURE.md §3.8).
- **Créer** `auth/infrastructure/turnstile-verifier.ts` : `POST` vers
  `https://challenges.cloudflare.com/turnstile/v0/siteverify` (`fetch` natif Node 20, corps
  `x-www-form-urlencoded`, `AbortSignal.timeout(5000)`). Le secret est passé **en `string` par la
  factory**, pas via `ConfigService` → classe testable unitairement. **Échec fermé** : jeton absent,
  `success: false`, timeout ou erreur réseau → `DomainException('Vérification anti-robot échouée')`,
  les `error-codes` journalisés en `warn`. Sinon un attaquant contourne le captcha en saturant
  l'accès à Cloudflare.
- **Créer** `auth/infrastructure/noop-captcha-verifier.ts` : résout immédiatement, sélectionné
  uniquement quand `TURNSTILE_SECRET_KEY` est absent.
- **Modifier** `auth.tokens.ts` (+ `CAPTCHA_VERIFIER`) et `auth.module.ts` : `useFactory` choisissant
  l'adaptateur selon la présence du secret (avec un `Logger.warn` explicite si désactivé), et
  `RegisterUseCase` gagne `CAPTCHA_VERIFIER` dans son `inject`. Imports en **valeur**
  (`import { TurnstileVerifier }`) pour les classes instanciées, `import type` pour l'interface.

**Appelé depuis `RegisterUseCase`, pas depuis le contrôleur ni un guard** : le commentaire
d'en-tête de [auth.controller.ts:14-15](../../apps/backend/src/app/auth/auth.controller.ts#L14-L15) pose
que le contrôleur traduit HTTP → commande et rien d'autre ; l'orchestration appartient à la couche
application. Un `TurnstileGuard` fonctionnerait mais logerait une décision de flux métier dans le
transport et casserait la symétrie port/adaptateur du module.

**Ordre dans `register.usecase.ts` : vérifier le captcha AVANT `User.register()`** — bcrypt coût 10
représente ~100 ms de CPU, un flot de bots ne doit pas pouvoir le brûler avant d'être rejeté.
`RegisterDto` gagne `captchaToken?: string` (optionnel : le chemin noop et le `{}` de `backend-e2e`
continuent de compiler) ; le contrôleur passe `{ ...dto, remoteIp: ip }` via `@Ip()` (correct
**uniquement grâce** au `trust proxy` de P0-3). Réécrire au passage le commentaire L8-12 de
`register.dto.ts`, qui devient faux en P0-7.

### Frontend — widget, clé de site, contrainte zoneless

**La clé de site est publique** (seul `TURNSTILE_SECRET_KEY` est secret) : elle peut vivre dans un
fichier d'environnement commité. Aucune configuration à l'exécution, aucun templating Docker.

- **Créer** `apps/frontend/src/environments/environment.ts` (`turnstileSiteKey: ''`) et
  `environment.prod.ts` (vraie clé). Le répertoire `environments/` **n'existe pas** et
  `apps/frontend/project.json` n'a **aucun `fileReplacements`** — le mécanisme est à créer.
- **Modifier** `apps/frontend/project.json` : `fileReplacements` sous `build.configurations.production`
  uniquement. Les configurations `development` et `e2e` résolvent le fichier de base à clé vide —
  **c'est tout le mécanisme de neutralisation e2e côté frontend**.
- **Créer** `apps/frontend/src/app/auth/register/turnstile.ts` : façade typée + injection idempotente
  du script `api.js?render=explicit`. Rendu explicite et injection paresseuse plutôt qu'une balise
  dans `index.html` : sinon Cloudflare est chargé sur chaque route, y compris pour les visiteurs qui
  ne s'inscrivent jamais.
- **Modifier** [register.ts](../../apps/frontend/src/app/auth/register/register.ts) et `register.html` :
  `captchaEnabled = signal(environment.turnstileSiteKey !== '')`, `captchaToken = signal('')`,
  `canSubmit = computed(...)`, hôte via `viewChild`, rendu dans `afterNextRender`.
  **Point critique zoneless** : Cloudflare invoque `callback`/`expired-callback`/`error-callback`
  depuis un événement DOM brut, hors de tout contexte Angular. Sans zone.js, une affectation
  `this.token = t` ne déclencherait **aucun** rendu et le bouton resterait désactivé à vie — c'est
  `signal.set()` qui porte la notification. Sur la branche d'erreur : `window.turnstile?.reset()` +
  vider le jeton, **les jetons Turnstile sont à usage unique** (sans ça, un 409 « email déjà pris »
  rend toute nouvelle tentative impossible). Nettoyage via `DestroyRef.onDestroy`.
  **Conserver verbatim** les `<label for>` et le libellé de bouton « Créer mon compte » —
  `frontend-e2e/src/support/auth.ts:28-37` les localise ainsi.
- **Modifier** `auth.model.ts` → `RegisterDto` gagne `captchaToken?: string`. `auth.service.ts:143`
  poste le DTO tel quel, rien à changer.

### Chaîne de neutralisation dev/e2e (aucune modification des suites de test)

| Couche | Dev / e2e | Production |
|---|---|---|
| Build Angular | `development`/`e2e` → clé vide | `production` → `fileReplacements` → vraie clé |
| Composant | `captchaEnabled()` faux → pas de script, pas de jeton, bouton toujours actif | widget rendu, jeton exigé |
| Factory backend | `TURNSTILE_SECRET_KEY` absent → `NoopCaptchaVerifier` | présent → `TurnstileVerifier` |
| Schéma env | optionnel | requis en production |

`frontend-e2e` lance le backend sans `TURNSTILE_SECRET_KEY` et build en configuration `e2e` ;
`backend-e2e` (`POST /api/auth/register {}` → « pas 404 ») reste vrai. Échappatoire documentée dans
`.env.example` : les clés de test Cloudflare toujours-valides (`1x00000000000000000000AA`).

## P0-7 — `class-validator` + `ValidationPipe` global

**Installer** `class-validator` + `class-transformer` (en `dependencies`).
`apps/backend/tsconfig.app.json` a déjà `emitDecoratorMetadata`, et `vitest.config.ts` utilise
`unplugin-swc` avec `decoratorMetadata: true` → aucun réglage à toucher.

### Le danger d'ordonnancement, précisément

`ValidationPipe({ whitelist: true })` supprime toute propriété **sans** décorateur. Une classe DTO à
zéro décorateur a une liste blanche vide, donc **le corps entier devient `{}`**. Activer `whitelist`
avant d'avoir décoré les 27 DTO ne produirait pas des 400 mais une **perte de données silencieuse**
sur les 45 routes campagne + teams + auth, se manifestant en `DomainException` déroutantes voire en
enregistrements vides persistés. C'est la seule erreur d'ordre à ne pas commettre.

### Séquence sûre — trois commits, e2e vert après chacun

1. **Décorer, pipe encore éteint.** Les 27 DTO liés par `@Body()`. Aucun pipe enregistré → le
   comportement à l'exécution est *prouvablement* inchangé ; seuls `nx build backend` et
   `nx test backend` doivent passer. Les DTO de **réponse** (`*-response.dto.ts`) ne sont pas touchés.
2. **Activer le pipe permissivement** : `{ provide: APP_PIPE, useValue: new ValidationPipe({
   transform: true, whitelist: false, forbidNonWhitelisted: false, transformOptions: {
   enableImplicitConversion: false } }) }` dans `app.module.ts` (cohérent avec l'`APP_GUARD` du
   throttler, et `main.ts` reste centré sur le serveur HTTP). `enableImplicitConversion: false`
   délibérément : la conversion implicite transformerait `"abc"` en `NaN` sur un `@IsInt()` et
   rendrait les erreurs illisibles ; les paramètres de route sont déjà couverts par les
   `ParseIntPipe` existants. Lancer la suite e2e **complète** : tout échec ici est un vrai
   désaccord de type entre le client Angular et le DTO.
3. **Resserrer** : `whitelist: true, forbidNonWhitelisted: true`, re-lancer les deux suites e2e.
   Chaque 400 révèle un client envoyant un champ non déclaré. Auditer au préalable les charges
   utiles des services Angular (`grep` sur `.post(`/`.patch(`) pour les anticiper.

Garder les messages d'erreur activés (pas de `disableErrorMessages`) : ils sont affichés à
l'utilisateur dans cette UI francophone, et restent au niveau de la forme, sans divulgation.

### Frontière DTO / agrégat

**Règle à inscrire en en-tête du dossier `dto/`** : *un décorateur ne peut affirmer que des faits
déductibles de la charge utile seule.* Tout ce qui exige de connaître d'autres entités, le catalogue
ou l'état de l'agrégat reste dans l'agrégat.

- **DTO** (forme et transport) : `@IsString() @IsNotEmpty()`, `@IsInt() @Min(1)` sur les ids,
  `@IsBoolean()`, `@IsOptional()`, `@MaxLength(n)` comme **borne anti-DoS** et non comme règle
  métier, `@IsEnum()` sur les énumérations de transport fermées (`ChangeEquipmentDto.operation`/
  `.entityType`/`.orientation`), et surtout `@ValidateNested({ each: true }) @Type(() => …)
  @ArrayMaxSize(…)` sur les tableaux imbriqués de `record-result.dto.ts` — **obligatoire**, sinon la
  liste blanche vide leur contenu.
- **Agrégat** : légalité sponsor, budget d'emplacements, coût d'orientation, table des épaves →
  `Team`/`Vehicle`/`Campaign` ; `ReorderGamesDto.gameIds` doit être exactement l'ensemble des
  parties `PLANIFIE` → `Campaign.reorderGames` (le commentaire du DTO le dit déjà, l'honorer) ;
  clamp de `SabotageSpentDto.pointsSpent` → `SabotagePointsSpentEvent`.
- **Duplication délibérée, à commenter comme telle** (deux altitudes) : `password` → DTO
  `@IsString() @MaxLength(200)` (empêcher une chaîne de 10 Mo d'atteindre bcrypt), agrégat
  6 ≤ longueur ≤ 72 octets. `email` → DTO `@IsString() @IsNotEmpty() @MaxLength(254)`, **pas
  `@IsEmail()`** : le format est un invariant d'identité de `User`, le dupliquer créerait deux
  messages d'erreur français concurrents pour la même règle.

## P0-8 — Déploiement

### Stratégie : conserver le compose de dev, ajouter un compose de prod

**Ne pas** retirer les ports publiés de `docker-compose.yml` : `dev.sh`, `frontend-e2e/src/support/db.ts`
(qui se connecte à `localhost:5432`) et pgAdmin en dépendent. À la place :

- `docker-compose.yml` reste le fichier **dev**, inchangé sauf ajout des healthchecks et des
  variables backend manquantes (`JWT_SECRET`, `ADMIN_*`, `NODE_ENV=development`) — ce qui corrige
  aussi le crash-loop local.
- **Créer** `docker-compose.prod.yml` : **aucun `ports:`** sur `postgres`, `backend`, `frontend`
  (uniquement Caddy expose 80/443 + 443/udp) ; **pgAdmin entièrement retiré** (utiliser
  `docker compose exec postgres psql`) ; healthchecks (`pg_isready`, `fetch` sur `/api/health`) ;
  `mem_limit`/`cpus` (Compose simple, pas `deploy.resources`) ; `security_opt:
  ["no-new-privileges:true"]` ; `read_only: true` + `tmpfs: [/tmp]` sur le backend ;
  `NODE_ENV=production`, `DB_SYNCHRONIZE=false`, `DB_MIGRATIONS_RUN=true` (une seule réplique, pas
  de course à la migration), `CORS_ORIGIN=https://${PUBLIC_DOMAIN}`.

### **Créer** `docker/caddy/Caddyfile`

TLS Let's Encrypt automatique sur `{$PUBLIC_DOMAIN}`, option globale `{ email {$LETSENCRYPT_EMAIL} }`,
`request_body { max_size 1MB }`, en-têtes de sécurité (HSTS, `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, `-Server`), `handle /api/*` →
`reverse_proxy backend:3000` avec la réécriture `header_up X-Forwarded-For` de P0-5, `handle` →
`reverse_proxy frontend:80`.

**CSP — trois pièges qui coûtent une soirée sinon** :
- `style-src 'self' 'unsafe-inline'` est **obligatoire** : Angular injecte les styles de composants
  en `<style>` inline, et `register.html` utilise des attributs `style=` (L14, 45, 73). Le retirer
  casse toute l'UI. Nettoyer ces attributs est du P2, pas un bloquant.
- Turnstile exige `script-src` **et** `frame-src` **et** `connect-src` vers
  `challenges.cloudflare.com` — `frame-src` manquant = symptôme classique du « widget affiche un
  cadre blanc ».
- Déployer d'abord en `Content-Security-Policy-Report-Only` pendant 24 h si prudence.

**Caddy n'a pas de limitation de débit intégrée** (plugin tiers + image custom) : ne pas compter
dessus, `@nestjs/throttler` est la couche de limite — d'où l'importance de P0-5.

### `apps/backend/Dockerfile`

- Nouvelle étape `deps` : `apk add --no-cache python3 make g++` (compilation de la liaison native de
  `bcrypt` contre musl) + `npm ci --omit=dev`, puis `COPY --from=deps` dans le runner. La ligne
  actuelle `COPY --from=builder /app/node_modules` embarque Nx, webpack, Angular et Playwright dans
  l'image d'exécution.
- `ENV NODE_ENV=production` ; `USER node` (l'utilisateur existe déjà dans `node:20-alpine`) après un
  `chown -R node:node /app` ; `--init` pour que `SIGTERM` atteigne Node (sinon arrêts en SIGKILL à
  10 s). Conserver les copies de `content/` et `assets/`.
- **Vérifier après la scission** que tout ce que le bundle `require()` est en `dependencies` :
  `class-validator`, `class-transformer`, `@nestjs/throttler`, `helmet` **doivent** y être — sinon
  le conteneur démarre en local (node_modules complet) et échoue uniquement sur le VPS.

### `apps/frontend/nginx.conf`

Statique uniquement derrière Caddy : **supprimer le bloc `location /api/`** (second saut non fiable
qui casserait le compte `trust proxy: 1`), ajouter `client_max_body_size 1m`, `server_tokens off`,
cache long sur les assets hachés et `no-cache` sur `index.html`. Les en-têtes de sécurité restent
dans Caddy seul — une seule source de vérité.

---

## Décisions assumées (à documenter dans [docs/spec/AUTH.md](../spec/AUTH.md))

**Le 409 à l'inscription (énumération de comptes) est conservé.** Le correctif « correct » — toujours
répondre 201 et envoyer un email « cette adresse est déjà enregistrée » — exige une chaîne d'envoi de
mails que le projet n'a pas et ne veut pas encore. Toute demi-mesure (400 générique) détruit l'UX
réelle : un utilisateur ayant oublié son compte obtient un échec inexplicable, sans flux de
réinitialisation pour s'en sortir. La menace est l'énumération en masse, et Turnstile + 3
inscriptions/heure/IP la rendent déjà impraticable. À corriger gratuitement le jour où la
vérification d'email existe (P2) — poser un TODO à `user.repository.ts:61`.

**Le JWT reste en `localStorage`.** (1) La surface XSS est réellement faible : Angular échappe
l'interpolation, et les trois `bypassSecurityTrustHtml` (`documentation.ts:54`,
`documentation-chapter.ts:62`, `sponsor-carousel.ts`) ne rendent que du contenu **écrit par le
serveur** et commité (`content/docs/*.md`, `database_init/data/*.yml`) — aucune chaîne saisie par un
utilisateur n'atteint un puits HTML aujourd'hui. (2) La migration en cookie `httpOnly` coûte plusieurs
jours **sur le chemin d'authentification** (stratégie CSRF, extracteur cookie dans `jwt.strategy.ts`,
réécriture de `auth.interceptor.ts` et de 5 points d'appel de `auth.service.ts`, endpoint de logout,
`withCredentials` partout, deux suites e2e à revalider) — exactement le code où un changement
précipité ouvre un trou pire que celui qu'il ferme. (3) Le gain est plus petit qu'il n'y paraît : sous
un XSS réussi, le cookie est envoyé automatiquement par le navigateur ; `httpOnly` n'empêche que
l'exfiltration pour réutilisation hors ligne — atténuée par le passage du TTL à 24 h et la révocation
immédiate via `isActive`. (4) Le levier supérieur est la CSP stricte, qui bloque l'injection plutôt
que sa charge utile. **À revoir immédiatement si** : rendu de markdown/HTML saisi par l'utilisateur,
script tiers au-delà de Turnstile, ou upload de fichier.

**TTL du jeton : 24 h, pas moins.** Il n'y a pas de jeton de rafraîchissement : un TTL court
provoquerait des déconnexions brutales en pleine session (`auth.service.ts` purge le jeton et
redirige sur tout 401). 7 j → 24 h est déjà une réduction de 7× de la fenêtre de vol, et la
vérification `isActive` (P0-4) donne la révocation instantanée pour le cas qui compte vraiment.

**pgAdmin retiré de la production.** Une console d'administration de base de données exposée sur
internet est une surface d'attaque disproportionnée pour un usage occasionnel.

---

## Vérification

| Changement | Comment vérifier |
|---|---|
| Schéma env | `unset JWT_SECRET && npx nx serve backend` → échec au démarrage avec la variable **nommée**, pas une pile d'appels. Idem avec `JWT_SECRET=change_me` en `NODE_ENV=production`. |
| Migration de référence | Le garde-fou `schema:log` (P0-2 étape 5) : « No changes… ». Puis `npx nx e2e frontend-e2e` (toujours en `synchronize`) doit rester vert. |
| `isActive` | `npx nx test backend` (nouveaux `jwt.strategy.spec.ts` + cas dans `user.spec.ts`). Manuel : se connecter, `UPDATE users SET "isActive"=false`, prochain `GET /api/auth/me` → 401 (200 avant). |
| Limite de débit | `npx nx e2e frontend-e2e` **doit toujours passer** (preuve que `skipIf` fonctionne). Puis en `NODE_ENV=production` local : 8 `POST /auth/login` en boucle → `401 ×5` puis `429`. |
| Trust proxy | Derrière Caddy, `curl -H 'X-Forwarded-For: 1.2.3.4'` en boucle doit **quand même** atteindre la limite (preuve que l'en-tête est écrasé). Journaliser temporairement `req.ip` : il doit valoir l'IP publique, pas `172.x` (sinon tous les utilisateurs partagent un seau). |
| Turnstile — neutralisation | Les deux suites e2e inchangées et vertes. Nouveau `register.usecase.spec.ts` avec un faux `ICaptchaVerifier` qui lève → `BadRequestException` **et** assertion que `hasher.hash` n'a jamais été appelé (preuve de l'ordre). |
| Turnstile — chemin réel | Sur le VPS : widget rendu, soumission bloquée avant résolution. Puis `curl -X POST .../auth/register` **sans** `captchaToken` → **400** (le widget seul ne prouve rien). Tester aussi le rejeu : email déjà pris → 409 → widget réinitialisé → nouvelle tentative possible. |
| `ValidationPipe` | Étape 1 : `nx test backend` + `nx build backend`. Étapes 2-3 : `npx nx run-many -t lint test build typecheck` puis **les deux** suites e2e (`quick-e2e.sh` du skill `e2e-testing` permet de lancer la suite frontend sur des ports isolés sans arrêter `dev.sh`). |
| Docker / Caddy | `docker compose -f docker-compose.prod.yml up --build -d` sur un hôte de recette ; `docker compose ps` → tout `healthy` ; `docker compose exec backend id` → `uid=1000(node)` ; `nmap -p 5432,3000,5050 <ip>` depuis l'extérieur → tout fermé ; `curl -I https://domaine` → en-têtes présents ; `curl -I http://domaine` → 308 ; securityheaders.com et SSL Labs en A/A+. |
| CSP | Charger `/register`, `/documentation`, `/teams` et un atelier de campagne, console ouverte → zéro violation. |
| Recette complète avant bascule DNS | `npx nx run-many -t lint test build typecheck` + les deux e2e, puis passe manuelle sur la recette : inscription (avec captcha) → création d'équipe → configuration d'un véhicule → création de campagne → enregistrement d'un résultat → changement de mot de passe → désactivation d'un compte par l'admin → confirmer que ce compte est déconnecté à la requête suivante. |

**Retour arrière** : chaque item P0 est derrière une variable d'environnement (`DB_SYNCHRONIZE`,
`THROTTLE_*`, `TURNSTILE_SECRET_KEY`, `CORS_ORIGIN`) ou un fichier compose séparé. La seule étape
irréversible est la première exécution de migration — d'où le garde-fou `schema:log`.

---

## Prérequis à réunir avant de commencer

1. Un **nom de domaine** pointant (A/AAAA) vers le VPS — Caddy en a besoin pour émettre le
   certificat Let's Encrypt.
2. Un **compte Cloudflare** (gratuit) → un widget Turnstile → clé de site (publique, va dans
   `environment.prod.ts`) + clé secrète (va dans le `.env` du VPS).
3. Une adresse email pour le compte ACME Let's Encrypt.
