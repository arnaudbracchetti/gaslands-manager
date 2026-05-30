# Gaslands Manager — Spécifications fonctionnelles

> Ce fichier décrit les fonctionnalités, les modèles de données et les règles métier de l'application.
> Il doit être mis à jour à chaque ajout ou modification de fonctionnalité.

---

## 1. Présentation du projet

**Gaslands Manager** est une application web permettant aux joueurs de gérer leurs équipes pour le jeu de plateau **Gaslands** — un jeu de course automobile post-apocalyptique avec des véhicules armés et des sponsors aux règles spécifiques.

**Objectif pédagogique** : ce projet sert de support d'apprentissage. Chaque composant est commenté pour expliquer les choix techniques (Angular Signals, NestJS modules, TypeORM, JWT…).

---

## 2. Utilisateurs et rôles

| Rôle | Accès |
|------|-------|
| **Visiteur** (non connecté) | Lecture des pages Règles, Véhicules, Armes. Accès à la page d'accueil. |
| **Utilisateur connecté** | Toutes les pages visiteur + gestion complète de ses propres équipes, véhicules et armes. |

Il n'y a pas de rôle administrateur pour l'instant. Chaque utilisateur ne peut voir et modifier que ses propres données.

---

## 3. Fonctionnalités implémentées

### 3.1 Authentification

- **Inscription** (`POST /api/auth/register`) : création de compte avec prénom, nom, email, mot de passe
- **Connexion** (`POST /api/auth/login`) : vérification du mot de passe (bcrypt), émission d'un token JWT
- **Session persistante** : token stocké dans `localStorage`, restauré au démarrage de l'app via `GET /api/auth/me`
- **Déconnexion** : suppression du token + redirection vers `/login`
- **Protection des routes** : `authGuard` Angular bloque l'accès à `/teams` si non connecté
- **Injection automatique** : `authInterceptor` ajoute l'en-tête `Authorization: Bearer <token>` à toutes les requêtes HTTP

### 3.2 Contenu Markdown

Les pages informatives sont servies depuis des fichiers `.md` du dossier `content/` :

| Slug | Fichier | Contenu |
|------|---------|---------|
| `regles` | `content/regles.md` | Règles générales du jeu, notion de sponsor et de budget |
| `vehicules` | `content/vehicules.md` | Types de véhicules disponibles et leurs caractéristiques |
| `armes` | `content/armes.md` | Armes disponibles et leurs statistiques |

Le backend convertit le Markdown en HTML (`marked`) et l'expose via `GET /api/content/:slug`. Le frontend affiche ce HTML brut via `[innerHTML]` dans le composant `Rules`.

Pour ajouter du contenu : créer `content/<slug>.md` → disponible immédiatement sans redémarrer le backend.

### 3.3 Navigation

- `/home` — Page d'accueil avec présentation et liens vers les sections
- `/rules` — Affichage des règles du jeu (Markdown → HTML)
- `/vehicles` — Page véhicules (placeholder)
- `/weapons` — Page armes (placeholder)
- `/teams` — Gestion des équipes (protégé, placeholder)
- `/login`, `/register` — Pages d'authentification

---

## 4. Fonctionnalités à implémenter (backlog)

### 4.1 CRUD Équipes

- Créer une équipe : nom, sponsor (liste prédéfinie), budget en cans (défaut : 50)
- Modifier une équipe (nom, sponsor, description)
- Supprimer une équipe (et ses véhicules/armes associés)
- Lister ses équipes sur le tableau de bord

### 4.2 CRUD Véhicules

- Ajouter un véhicule à une équipe : nom, type (liste prédéfinie), statistiques (handling, weight, hull)
- Modifier / supprimer un véhicule
- Calcul du coût d'un véhicule selon son type

### 4.3 CRUD Armes

- Équiper un véhicule avec une arme : type (liste prédéfinie), emplacement, coût en cans
- Retirer une arme d'un véhicule

### 4.4 Gestion du budget

- Afficher le budget restant d'une équipe (budget total − coût des véhicules − coût des armes)
- Bloquer l'ajout d'armes/véhicules si le budget est dépassé

### 4.5 Tableau de bord

- Vue d'ensemble de toutes les équipes de l'utilisateur
- Accès rapide à chaque équipe et ses véhicules

### 4.6 Export (futur)

- Fiche récapitulative d'une équipe au format imprimable (HTML/PDF)

---

## 5. Modèles de données

### `User`

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | UUID | PK, généré auto |
| `firstName` | string | obligatoire |
| `lastName` | string | obligatoire |
| `email` | string | obligatoire, unique |
| `password` | string | hash bcrypt (jamais retourné en réponse) |
| `createdAt` | Date | auto |
| `updatedAt` | Date | auto |

### `Team`

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | UUID | PK, généré auto |
| `name` | string | obligatoire |
| `sponsor` | string | défaut : `"Rutherford"` |
| `cans` | number | budget en cans, défaut : 50 |
| `description` | string | nullable |
| `userId` | UUID | FK → User (à ajouter) |
| `createdAt` | Date | auto |
| `updatedAt` | Date | auto |

> ⚠️ La relation `userId` (Team → User) n'est pas encore implémentée dans l'entité TypeORM.

### `Vehicle` _(à créer)_

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | UUID | PK |
| `name` | string | obligatoire |
| `type` | enum | `Buggy`, `PerformanceCar`, `Van`, `Truck` |
| `handling` | number | selon le type |
| `maxGear` | number | selon le type |
| `hull` | number | points de coque |
| `crew` | number | nombre d'équipiers |
| `cost` | number | coût en cans |
| `teamId` | UUID | FK → Team |

### `Weapon` _(à créer)_

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | UUID | PK |
| `type` | enum | voir liste §7 |
| `attack` | number | dés d'attaque |
| `range` | string | courte / longue |
| `slots` | number | emplacements requis |
| `cost` | number | coût en cans |
| `vehicleId` | UUID | FK → Vehicle |

---

## 6. API Endpoints

### Auth

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/register` | Non | Création de compte |
| POST | `/api/auth/login` | Non | Connexion, retourne JWT |
| GET | `/api/auth/me` | JWT | Retourne l'utilisateur courant |

### Contenu

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/content` | Non | Liste des slugs disponibles |
| GET | `/api/content/:slug` | Non | Contenu HTML + titre |

### Équipes _(à implémenter)_

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/teams` | JWT | Liste des équipes de l'utilisateur |
| POST | `/api/teams` | JWT | Créer une équipe |
| GET | `/api/teams/:id` | JWT | Détail d'une équipe |
| PUT | `/api/teams/:id` | JWT | Modifier une équipe |
| DELETE | `/api/teams/:id` | JWT | Supprimer une équipe |

### Véhicules _(à implémenter)_

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/teams/:id/vehicles` | JWT | Véhicules d'une équipe |
| POST | `/api/teams/:id/vehicles` | JWT | Ajouter un véhicule |
| PUT | `/api/vehicles/:id` | JWT | Modifier un véhicule |
| DELETE | `/api/vehicles/:id` | JWT | Supprimer un véhicule |

### Armes _(à implémenter)_

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/vehicles/:id/weapons` | JWT | Ajouter une arme à un véhicule |
| DELETE | `/api/weapons/:id` | JWT | Retirer une arme |

---

## 7. Règles métier Gaslands

### Sponsors

Chaque équipe doit choisir un sponsor qui peut donner des avantages spéciaux (non encore implémentés dans l'app) :

| Sponsor | Thème |
|---------|-------|
| Rutherford | Armes classiques |
| Miyazaki | Vitesse |
| Mishkin | Défense |
| Verney | Explosifs |
| Idris | Équipement spécial |
| Warden | Forces de l'ordre |

### Budget (Cans)

- Budget de départ : **50 cans** par équipe (peut être modifié)
- Chaque véhicule et chaque arme a un coût en cans
- Le total (véhicules + armes) ne doit pas dépasser le budget

### Types de véhicules

| Type | Handling | Max Gear | Hull | Crew | Coût |
|------|----------|----------|------|------|------|
| Buggy | 5 | 6 | 6 | 2 | 6 cans |
| Performance Car | 4 | 6 | 8 | 2 | 12 cans |
| Van | 3 | 5 | 10 | 3 | 10 cans |
| Truck | 2 | 4 | 14 | 3 | 20 cans |

### Armes disponibles

| Arme | Attaque | Portée | Coût |
|------|---------|--------|------|
| Machine Gun | 3 dés | Longue | 3 cans |
| Pistol | 1 dé | Courte | 1 can |
| Rocket Launcher | 6 dés | Longue | 6 cans |
| Flamethrower | 4 dés | Courte | 5 cans |
| Mines | 4 dés | Arrière | 4 cans |
| Oil Slick | — | Arrière | 2 cans |
