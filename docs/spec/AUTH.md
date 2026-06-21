# Authentification & Rôles

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md).
> Mettre à jour après tout changement du système d'authentification ou des rôles.

---

## Utilisateurs et rôles

| Rôle | Accès |
|------|-------|
| **Visiteur** (non connecté) | Lecture des pages Règles, Véhicules, Armes. Accès à la page d'accueil. |
| **Utilisateur connecté** (`role: "user"`) | Toutes les pages visiteur + gestion complète de ses propres équipes, véhicules et armes. |
| **Administrateur** (`role: "admin"`) | Toutes les pages utilisateur connecté. Compte unique, créé/synchronisé automatiquement au démarrage du serveur (cf. "Compte administrateur" ci-dessous). Aucune fonctionnalité réservée à ce rôle n'est implémentée pour l'instant — `role` est posé en fondation pour un futur `RolesGuard`. |

Chaque utilisateur ne peut voir et modifier que ses propres données.

---

## Authentification

- **Inscription** (`POST /api/auth/register`) : création de compte avec prénom, nom, email, mot de passe
- **Connexion** (`POST /api/auth/login`) : vérification du mot de passe (bcrypt), émission d'un token JWT
- **Session persistante** : token stocké dans `localStorage`, restauré au démarrage de l'app via `GET /api/auth/me`
- **Déconnexion** : suppression du token + redirection vers `/login`
- **Protection des routes** : `authGuard` Angular bloque l'accès à `/teams` si non connecté
- **Injection automatique** : `authInterceptor` ajoute l'en-tête `Authorization: Bearer <token>` à toutes les requêtes HTTP

---

## Compte administrateur

Au démarrage du backend, `AdminSeedService` (`OnModuleInit`, même pattern que `CatalogService`,
cf. ARCHITECTURE.md §3.3) garantit l'existence d'un unique utilisateur `role: "admin"` :

- S'il n'existe aucun utilisateur `role: "admin"` en base, il est créé avec
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` (variables `.env`, mot de passe haché via bcrypt).
- S'il existe déjà, son email et son mot de passe sont **resynchronisés** avec
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` si l'une ou l'autre de ces valeurs a changé dans `.env`
  depuis le dernier démarrage (comparaison bcrypt pour le mot de passe) — un warning est
  loggé dans les deux cas, et le changement ne prend effet qu'au redémarrage du backend.
- **Unicité garantie** : la recherche se fait sur `role: "admin"` (jamais sur l'email) —
  un seul compte admin peut exister, quel que soit le contenu de `.env`.
- `/api/auth/register` ne peut jamais créer de compte admin : le champ `role` n'est pas
  exposé dans `RegisterDto` et vaut `"user"` par défaut au niveau de la base.

---

## Modèle de données — `User`

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | UUID | PK, généré auto |
| `firstName` | string | obligatoire |
| `lastName` | string | obligatoire |
| `email` | string | obligatoire, unique |
| `password` | string | hash bcrypt (jamais retourné en réponse) |
| `role` | `'user' \| 'admin'` | défaut : `'user'`. Non modifiable via `/api/auth/register` (champ absent de `RegisterDto`). Le compte unique `role: 'admin'` est créé/synchronisé au démarrage par `AdminSeedService`. |
| `createdAt` | Date | auto |
| `updatedAt` | Date | auto |

---

## API Endpoints Auth

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/register` | Non | Création de compte |
| POST | `/api/auth/login` | Non | Connexion, retourne JWT |
| GET | `/api/auth/me` | JWT | Retourne l'utilisateur courant |
