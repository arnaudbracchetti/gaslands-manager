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
│   └── backend-e2e/         ← Tests Jest E2E
├── content/                 ← Fichiers Markdown (contenu du jeu)
├── docker-compose.yml       ← Infrastructure locale et production
├── dev.ps1                  ← Script de démarrage dev (Windows)
└── nx.json                  ← Configuration Nx
```

**Principe de séparation** : le frontend et le backend sont deux applications indépendantes dans le même dépôt (monorepo). Ils ne partagent pas de code pour l'instant. Le frontend consomme l'API REST du backend via HTTP.

---

## 2. Frontend — Angular 21

### 2.1 Standalone Components (sans NgModules)

Depuis Angular 17, les modules Angular (`@NgModule`) sont optionnels. Ce projet utilise exclusivement les **standalone components** : chaque composant déclare ses propres imports.

**Pourquoi ?** Moins de boilerplate, meilleur tree-shaking (le bundler n'inclut que ce qui est réellement utilisé), et c'est la direction prise par Angular pour l'avenir.

```typescript
// Chaque composant importe ce dont il a besoin directement
@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],  // pas de NgModule intermédiaire
  ...
})
```

### 2.2 Zoneless + Signals (⚠️ Point critique)

Ce projet utilise le mode **zoneless** d'Angular 21 : `zone.js` n'est pas installé. Cela signifie qu'Angular ne détecte plus automatiquement les changements après une opération asynchrone (requête HTTP, setTimeout…).

**Pour déclencher la mise à jour du template, il faut obligatoirement utiliser des Signals :**

```typescript
// ❌ Ne fonctionne PAS en mode zoneless — le template ne se mettra pas à jour
loading = true;
this.http.get('/api/data').subscribe(data => {
  this.loading = false;  // ignoré par le détecteur de changement
});

// ✅ Correct avec Signals
loading = signal(true);
this.http.get('/api/data').subscribe(data => {
  this.loading.set(false);  // notifie Angular → re-rendu du template
});
```

**Types de signals utilisés :**
- `signal(valeurInitiale)` — état mutable
- `computed(() => ...)` — valeur dérivée (recalculée automatiquement)
- Dans le template, les signals se lisent comme des fonctions : `loading()`

**Déclaré dans `app.config.ts`** :
```typescript
provideZonelessChangeDetection()  // Angular 21 (était "Experimental" en Angular 19)
```

### 2.3 Nouveau Control Flow (Angular 17+)

Angular 17 a introduit une nouvelle syntaxe de contrôle de flux directement dans les templates, remplaçant `*ngIf` et `*ngFor` :

```html
<!-- ❌ Ancienne syntaxe (toujours valide mais déconseillée) -->
<div *ngIf="loading">Chargement...</div>

<!-- ✅ Nouvelle syntaxe (utilisée dans ce projet) -->
@if (loading()) {
  <div>Chargement...</div>
} @else {
  <div [innerHTML]="html()"></div>
}

@for (item of items(); track item.id) {
  <li>{{ item.name }}</li>
}
```

**Pourquoi ?** Meilleure lisibilité, vérifications de type plus strictes par le compilateur, et performances améliorées.

### 2.4 Lazy Routing

Tous les composants sont chargés à la demande :

```typescript
// apps/frontend/src/app/app.routes.ts
{
  path: 'teams',
  loadComponent: () => import('./teams/teams').then(m => m.TeamsComponent),
  canActivate: [authGuard]
}
```

**Pourquoi ?** Le code de chaque page n'est téléchargé que lorsque l'utilisateur y navigue. Améliore le temps de premier chargement.

### 2.5 Sécurité Frontend

**`authInterceptor`** (`apps/frontend/src/app/auth/auth.interceptor.ts`) :
- Intercepte automatiquement toutes les requêtes HTTP sortantes
- Ajoute `Authorization: Bearer <token>` si un token JWT existe dans `localStorage`
- Déclaré dans `app.config.ts` via `withInterceptors([authInterceptor])`

**`authGuard`** (`apps/frontend/src/app/auth/auth.guard.ts`) :
- Protège les routes privées (ex : `/teams`)
- Redirige vers `/login` si l'utilisateur n'est pas connecté
- Vérifie le signal `isLoggedIn` de `AuthService`

### 2.6 Proxy de développement

En développement, le frontend tourne sur le port 4200 et le backend sur le port 3000. Pour éviter les problèmes CORS, un proxy est configuré :

```json
// apps/frontend/proxy.conf.json
{
  "/api": {
    "target": "http://127.0.0.1:3000",
    "secure": false
  }
}
```

⚠️ **`127.0.0.1` et non `localhost`** : sur Windows, `localhost` peut résoudre en IPv6 (`::1`), incompatible avec le backend qui écoute en IPv4.

### 2.7 Fichiers clés

| Fichier | Rôle |
|---------|------|
| `apps/frontend/src/app/app.config.ts` | Configuration Angular (zoneless, router, HttpClient, intercepteur) |
| `apps/frontend/src/app/app.routes.ts` | Définition de toutes les routes lazy |
| `apps/frontend/src/app/auth/auth.service.ts` | Service singleton : state utilisateur (signals), login/logout |
| `apps/frontend/src/app/auth/auth.interceptor.ts` | Injection automatique du token JWT |
| `apps/frontend/src/app/auth/auth.guard.ts` | Protection des routes privées |
| `apps/frontend/proxy.conf.json` | Proxy dev : `/api` → backend |

---

## 3. Backend — NestJS 11

### 3.1 Architecture modulaire

NestJS organise le code en **modules** qui regroupent contrôleurs, services et entités par domaine fonctionnel. Chaque module est indépendant et déclare ce qu'il exporte.

```
apps/backend/src/app/
├── app.module.ts        ← Module racine (importe tous les autres)
├── auth/                ← Authentification (User, JWT, bcrypt)
├── content/             ← Lecture et service des fichiers Markdown
└── team/                ← Entité Team (CRUD à venir)
```

**Injection de dépendance** : NestJS gère automatiquement l'instanciation des services. On déclare ses dépendances dans le constructeur, NestJS les injecte :

```typescript
@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,  // injecté automatiquement
    private jwtService: JwtService,    // injecté automatiquement
  ) {}
}
```

### 3.2 Authentification JWT + Passport

**Flux d'authentification :**

1. Client envoie `POST /api/auth/login` avec `{ email, password }`
2. `AuthService.login()` vérifie le mot de passe avec `bcrypt.compare()`
3. Si valide, signe un token JWT (`JwtService.sign({ sub: userId, email })`)
4. Client stocke le token dans `localStorage`
5. À chaque requête suivante, l'`authInterceptor` ajoute le token dans le header
6. `JwtStrategy` (Passport) valide le token et charge l'utilisateur depuis la base

**`JwtStrategy`** (`apps/backend/src/app/auth/jwt.strategy.ts`) :
- Extends `PassportStrategy(Strategy, 'jwt')`
- Extrait le token depuis le header `Authorization: Bearer <token>`
- Valide la signature avec `JWT_SECRET`
- Retourne l'utilisateur (appelé à chaque requête protégée)

**`@UseGuards(JwtAuthGuard)`** : décorateur NestJS pour protéger un endpoint.

### 3.3 Sécurité des mots de passe

```typescript
// Hash lors de l'inscription (coût 10 = bon équilibre sécurité/performance)
const hash = await bcrypt.hash(password, 10);

// Vérification lors de la connexion
const valid = await bcrypt.compare(plainPassword, hash);
```

- Le mot de passe hashé n'est **jamais retourné** dans les réponses (méthode `sanitize()` dans `UserService`)
- En cas d'échec de connexion, le message d'erreur est générique pour éviter l'énumération des emails

### 3.4 TypeORM + PostgreSQL

**ORM (Object-Relational Mapping)** : TypeORM traduit les classes TypeScript en tables SQL.

```typescript
// Déclaration d'une entité = une table en base
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

**`synchronize: true`** (dans `app.module.ts`) : TypeORM crée/modifie automatiquement les tables selon les entités TypeScript.

⚠️ **Dev uniquement !** En production, utiliser des migrations TypeORM explicites. `synchronize: true` peut provoquer une perte de données si une entité est mal modifiée.

### 3.5 Service de contenu Markdown

`ContentService` (`apps/backend/src/app/content/content.service.ts`) :
- Lit les fichiers `.md` depuis `process.cwd() + CONTENT_DIR`
- `CONTENT_DIR=content` dans `.env` (relatif à la **racine du workspace**, pas à `apps/backend/`)
- Convertit le Markdown en HTML avec la bibliothèque `marked`
- Extrait le titre (premier `# `) pour l'envoyer séparément

### 3.6 Point d'attention Windows — `listen('0.0.0.0')`

```typescript
// apps/backend/src/main.ts
await app.listen(3000, '0.0.0.0');  // ← obligatoire sur Windows
```

Sans `'0.0.0.0'`, Node.js écoute sur `::` (IPv6 uniquement). Les connexions IPv4 depuis le proxy Vite (`127.0.0.1`) sont alors refusées.

### 3.7 Fichiers clés

| Fichier | Rôle |
|---------|------|
| `apps/backend/src/main.ts` | Bootstrap NestJS, CORS, préfixe `/api`, écoute `0.0.0.0:3000` |
| `apps/backend/src/app/app.module.ts` | Module racine : imports TypeORM, ConfigModule, tous les modules |
| `apps/backend/src/app/auth/` | Auth complète : entities, services, controller, strategy, guard |
| `apps/backend/src/app/content/` | Service Markdown → HTML |
| `apps/backend/src/app/team/` | Entité Team (CRUD à implémenter) |
| `apps/backend/.env` | Variables d'environnement (ne pas committer) |

---

## 4. Base de données — PostgreSQL 16

### Configuration

Credentials (définis dans `docker-compose.yml` et `apps/backend/.env`) :
- Hôte : `localhost` (dev) / `postgres` (Docker réseau interne)
- Port : `5432`
- User : `gaslands`
- Password : `gaslands_pass`
- Base : `gaslands`

### TypeORM en développement vs production

| Mode | `synchronize` | Tables |
|------|--------------|--------|
| **Dev** | `true` | Créées/modifiées automatiquement au démarrage |
| **Prod** | `false` | Gérées via migrations TypeORM |

Pour générer des migrations : `npx typeorm migration:generate`, puis `migration:run`.

---

## 5. Infrastructure Docker

### Services `docker-compose.yml`

```yaml
services:
  postgres:   # Port 5432 exposé sur l'hôte
  backend:    # Port 3000, dépend de postgres
  frontend:   # Nginx sur le port 4200, proxy /api → backend:3000
```

**Réseau** : `gaslands_net` (réseau Docker privé). Le frontend nginx accède au backend via `http://backend:3000` (DNS Docker interne).

**Volume** : `postgres_data` pour la persistance des données PostgreSQL.

### Dockerfiles multi-stage

Les images sont construites en deux étapes pour réduire leur taille finale :

1. **Stage builder** : installe toutes les dépendances et compile TypeScript
2. **Stage runner** : copie uniquement le code compilé + `node_modules` de production

### nginx (frontend production)

```nginx
# Proxy /api/* → backend NestJS (DNS Docker)
location /api/ {
  proxy_pass http://backend:3000;
}

# SPA fallback : toutes les URLs inconnues → index.html (Angular Router gère)
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## 6. Sécurité

| Aspect | Implémentation |
|--------|----------------|
| Mots de passe | bcrypt, coût 10 — jamais stockés en clair |
| Tokens JWT | Signés avec `JWT_SECRET` (.env), durée 7 jours |
| Réponses API | `sanitize()` exclut le champ `password` de toutes les réponses |
| CORS | Limité à `http://localhost:4200` en dev |
| Erreurs login | Message générique (évite l'énumération d'emails) |
| `.env` | Non committé (`.gitignore`), exemple fourni dans `.env.example` |

---

## 7. Monorepo Nx 22.7

### Avantages

- **Cache de build** : si le code n'a pas changé, Nx réutilise le résultat du build précédent
- **`nx affected`** : lance uniquement les tests/builds des projets affectés par un changement
- **Générateurs** : scaffolding cohérent pour les modules NestJS et composants Angular
- **Configuration unifiée** : ESLint, TypeScript, formatage partagés

### Commandes Nx utiles

```powershell
# Voir tous les projets
npx nx show projects

# Voir le graphe de dépendances
npx nx graph

# Builder uniquement les projets affectés par les changements git
npx nx affected -t build

# Synchroniser les références TypeScript (si Nx se plaint)
npx nx sync
```

### Contrainte TypeScript (Windows)

`tsconfig.base.json` contient des options (`composite`, `emitDeclarationOnly`) incompatibles avec Angular. Contourner avec :

```powershell
$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
```

Les options problématiques sont surchargées dans `apps/frontend/tsconfig.app.json`.

---

## 8. Environnement Windows — Points critiques

Ces contraintes s'appliquent à cet environnement de développement spécifique.

### SSL non vérifié

Le réseau intercepte les connexions HTTPS (proxy d'entreprise avec certificat auto-signé). Préfixer toutes les commandes `npm`/`npx` avec :

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
```

### IPv4 vs IPv6

Sur Windows, `localhost` peut résoudre en IPv6 (`::1`). Utiliser `127.0.0.1` partout où une adresse IP explicite est nécessaire (proxy Angular, config CORS du backend).

### Variable TypeScript Nx

```powershell
$env:NX_IGNORE_UNSUPPORTED_TS_SETUP = "true"
```

Obligatoire pour que Nx fonctionne sans erreur de configuration TypeScript.

---

## 9. Tests

| Projet | Outil | Commande |
|--------|-------|---------|
| Frontend (unitaires) | Vitest + Angular Testing Library | `npx nx test frontend` |
| Backend (unitaires) | Jest | `npx nx test backend` |
| E2E frontend | Playwright | `npx nx e2e frontend-e2e` |
| E2E backend | Jest | `npx nx e2e backend-e2e` |
