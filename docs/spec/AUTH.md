# Authentification & Rôles

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md).
> Mettre à jour après tout changement du système d'authentification ou des rôles.

---

## Nom d'affichage (`callName`)

Un utilisateur porte, en plus de son prénom et de son nom, un **pseudo**
obligatoire — c'est ce pseudo, et lui seul, qui identifie le joueur partout où
l'application montre "qui" est quelqu'un : navbar, liste des participants d'une
campagne, journal de partie, organisateur d'une campagne, ligne "Joueur" de la
fiche d'équipe exportable. Prénom et nom restent saisis et modifiables, mais ne
sont plus jamais affichés hors des écrans de compte (inscription, "Détails du
compte", administration).

Le pseudo **n'est pas unique** : ce n'est pas un identifiant (l'email joue ce
rôle), deux joueurs peuvent choisir le même.

La règle "quel nom afficher" est portée par un **unique** getter de l'agrégat de
domaine, `User.callName` (`auth/domain/user.ts`) — aujourd'hui le pseudo tel
quel. Aucun appelant (use case, controller, read model, frontend) ne lit
`pseudo` pour de l'affichage : faire évoluer la règle (repli sur prénom/nom si
le pseudo est vide, format `"Pseudo (Prénom)"`…) ne demandera de modifier que ce
getter.

Conséquence sur le contrat HTTP : toute réponse exposant un utilisateur porte
**deux** champs distincts — `pseudo` (valeur brute, dont le seul usage est de
pré-remplir le champ éditable du formulaire) et `callName` (valeur calculée, à
utiliser pour tout affichage). Même couple que `Vehicle.customName` (brut) /
`Vehicle.nom` (résolu), cf. [VEHICLES.md](VEHICLES.md#construction-dun-véhicule).
`callName` **doit** être matérialisé par le mapper HTTP
(`infrastructure/user-http.mapper.ts`) : `JSON.stringify` ne sérialise pas les
accesseurs `get` d'un prototype, un agrégat renvoyé tel quel perdrait
silencieusement ce champ.

---

## Utilisateurs et rôles

| Rôle | Accès |
|------|-------|
| **Visiteur** (non connecté) | Lecture des pages Règles, Véhicules, Armes. Accès à la page d'accueil. |
| **Utilisateur connecté** (`role: "user"`) | Toutes les pages visiteur + gestion complète de ses propres équipes, véhicules et armes. |
| **Administrateur** (`role: "admin"`) | Toutes les pages utilisateur connecté, plus la gestion des comptes (`/admin/users`, cf. "Administration des comptes" ci-dessous). Compte unique, créé/synchronisé automatiquement au démarrage du serveur (cf. "Compte administrateur" ci-dessous). |

Chaque utilisateur ne peut voir et modifier que ses propres données.

---

## Authentification

- **Inscription** (`POST /api/auth/register`) : création de compte avec prénom, nom, pseudo, email, mot de passe
- **Connexion** (`POST /api/auth/login`) : vérification du mot de passe (bcrypt), émission d'un token JWT
- **Session persistante** : token stocké dans `localStorage`, restauré au démarrage de l'app via `GET /api/auth/me`
- **Déconnexion** : suppression du token + redirection vers `/login`
- **Protection des routes** : `authGuard` Angular bloque l'accès à `/teams` si non connecté
- **Injection automatique** : `authInterceptor` ajoute l'en-tête `Authorization: Bearer <token>` à toutes les requêtes HTTP

---

## Auto-édition du profil

Un utilisateur connecté peut consulter et modifier ses propres informations
depuis le menu ouvert au clic sur son prénom, tout en haut de la navbar
(`App`) — deux entrées indépendantes, chacune ouvrant sa propre modale avec
son propre état de sauvegarde/erreur possédé par `App` :

- **"Détails du compte"** ouvre `UserDetailsModal` (cf.
  [COMPONENTS.md](../COMPONENTS.md#userdetailsmodal--authuser-details-modal)) :
  formulaire Informations (`PATCH /api/auth/me`) — prénom, nom, pseudo, email.
  Le champ édité est le pseudo **brut**, pas le `callName` qui en dérive (cf.
  §Nom d'affichage ci-dessus). Le rôle n'est pas affiché sur ce dialog (seul
  `AdminUsers` croise pseudo et identité légale, cf. "Administration des
  comptes" ci-dessous) — il reste de toute façon non modifiable par ce
  endpoint ni par l'utilisateur lui-même (garantie structurelle : `User._role`
  est `readonly`, `updateProfile()` ne peut pas y toucher ; seul
  `AdminSeedService`, cf. ci-dessous, ou un futur écran admin dédié, peut
  changer un rôle). L'email est revérifié unique en base au même titre qu'à
  l'inscription (contrainte `unique` PostgreSQL, capturée comme à
  l'inscription — HTTP 409 si déjà pris par un autre compte). En cas de
  succès, la réponse (profil à jour) remplace directement le `currentUser` du
  frontend : la navbar reflète le changement sans requête supplémentaire.
- **"Changer le mot de passe"** ouvre `ChangePasswordModal` (cf.
  [COMPONENTS.md](../COMPONENTS.md#changepasswordmodal--authchange-password-modal)) :
  `PATCH /api/auth/me/password`, exige le mot de passe actuel (vérifié par
  `bcrypt.compare`, même principe que la connexion) en plus du nouveau mot de
  passe (même règle de longueur minimale — 6 caractères — qu'à l'inscription).
  **Après un changement réussi, l'utilisateur est automatiquement
  déconnecté** (`authService.logout()`, redirection vers `/login`) : ce
  projet n'a pas de mécanisme de révocation JWT (token stateless), la
  reconnexion avec le nouveau mot de passe est donc le seul moyen de
  garantir qu'aucune session active ne continue de tourner avec l'ancien mot
  de passe implicitement validé.

---

## Compte administrateur

Au démarrage du backend, `AdminSeedService` (`OnModuleInit`, même pattern que `CatalogService`,
cf. ARCHITECTURE.md §3.3) garantit l'existence d'un unique utilisateur `role: "admin"` :

- S'il n'existe aucun utilisateur `role: "admin"` en base, il est créé avec
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` (variables `.env`, mot de passe haché via bcrypt)
  et le pseudo fixe `"Admin"` (pas de variable `.env` dédiée : le seed ne
  resynchronise que l'email et le mot de passe).
- S'il existe déjà, son email et son mot de passe sont **resynchronisés** avec
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` si l'une ou l'autre de ces valeurs a changé dans `.env`
  depuis le dernier démarrage (comparaison bcrypt pour le mot de passe) — un warning est
  loggé dans les deux cas, et le changement ne prend effet qu'au redémarrage du backend.
- **Unicité garantie** : la recherche se fait sur `role: "admin"` (jamais sur l'email) —
  un seul compte admin peut exister, quel que soit le contenu de `.env`.
- `/api/auth/register` ne peut jamais créer de compte admin : le champ `role` n'est pas
  exposé dans `RegisterDto` et vaut `"user"` par défaut au niveau de la base.

---

## Administration des comptes

Réservée au rôle `admin`, via un contrôle de rôle réel (pas un simple masquage de lien) :

- **Backend** : `UsersController` (`GET /api/users`, `DELETE /api/users/:id`,
  `PATCH /api/users/:id/active`, `PATCH /api/users/:id/password`) porte
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)` au niveau du
  controller. `RolesGuard` lit les rôles requis via `Reflector` et lève
  `ForbiddenException` (403) si `request.user.role` n'y figure pas — générique
  (`@Roles(...)` accepte plusieurs rôles), pas spécifique à l'admin.
  L'agrégat interdit en plus qu'un admin s'auto-supprime, se désactive lui-même
  ou réinitialise le mot de passe de son propre compte par cette action
  (`User.assertRemovableBy` / `User.setActive` / `User.resetPasswordAsAdmin`,
  traduits en 403 par les use cases) — l'admin dispose déjà de "Changer le mot
  de passe" (auto-édition, cf. ci-dessus) pour son propre compte.
- **Frontend** : la route `/admin/users` (`AdminUsers`, cf.
  [COMPONENTS.md](../COMPONENTS.md#adminusers--adminusers-)) déclare
  `canActivate: [authGuard, adminGuard]` — `adminGuard` vérifie explicitement
  `authService.currentUser()?.role === 'admin'` et redirige vers `/home` sinon
  (`authGuard` ne vérifie que la connexion, pas le rôle).

---

## Modèle de données — `User`

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | UUID | PK, généré auto |
| `firstName` | string | obligatoire |
| `lastName` | string | obligatoire |
| `pseudo` | string(100) | obligatoire, **non unique** — nom d'affichage, source de `callName` (cf. §Nom d'affichage ci-dessus). Colonne déclarée `default: ''` : `synchronize: true` ne peut pas ajouter une colonne NOT NULL sans défaut sur une table peuplée — seuls les comptes antérieurs à cette colonne peuvent donc valoir `''`, jusqu'à leur prochaine édition de profil |
| `email` | string | obligatoire, unique |
| `password` | string | hash bcrypt. Champ **privé** de l'agrégat (`User._passwordHash`), jamais recopié par le mapper HTTP — n'existe donc dans aucune réponse par construction, plus par omission |
| `role` | `'user' \| 'admin'` | défaut : `'user'`. Non modifiable via `/api/auth/register` (champ absent de `RegisterDto`) ni via `PATCH /api/auth/me` (auto-édition du profil, cf. ci-dessus — affiché en lecture seule). Le compte unique `role: 'admin'` est créé/synchronisé au démarrage par `AdminSeedService`. |
| `createdAt` | Date | auto |
| `updatedAt` | Date | auto |

**Champ calculé dans la réponse API** (non stocké en base) :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `callName` | string | Nom d'affichage résolu par le getter `User.callName` de l'agrégat — cf. §Nom d'affichage ci-dessus. Matérialisé par `userDomainToDto()`, jamais recalculé par un consommateur. |

---

## API Endpoints Auth

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/register` | Non | Création de compte (prénom, nom, pseudo, email, mot de passe) — 400 si un champ manque ou si le mot de passe fait moins de 6 caractères |
| POST | `/api/auth/login` | Non | Connexion, retourne JWT |
| GET | `/api/auth/me` | JWT | Retourne l'utilisateur courant |
| PATCH | `/api/auth/me` | JWT | Auto-édition du profil (prénom/nom/pseudo/email) — 409 si email déjà pris |
| PATCH | `/api/auth/me/password` | JWT | Changement de mot de passe (mot de passe actuel requis) — déconnecte l'utilisateur au succès |
| GET | `/api/users` | JWT + admin | Liste tous les comptes (`RolesGuard`) |
| DELETE | `/api/users/:id` | JWT + admin | Supprime un compte — 403 si auto-suppression (`User.assertRemovableBy`) |
| PATCH | `/api/users/:id/active` | JWT + admin | Active/désactive un compte — 403 si auto-désactivation (`User.setActive`) |
| PATCH | `/api/users/:id/password` | JWT + admin | Réinitialise le mot de passe d'un compte, sans connaître l'ancien — 403 si l'admin cible son propre compte (`User.resetPasswordAsAdmin`) |
