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

### 3.3 Catalogue de jeu (en mémoire)

Au démarrage du serveur, le backend charge un **catalogue complet** depuis des fichiers YAML (`database_init/data/`) et le conserve en mémoire.

Le catalogue contient :
- **13 sponsors** — chacun avec ses classes d'avantage et ses règles spéciales
- **16 véhicules** — répartis en Léger / Moyen / Lourd, avec leurs statistiques complètes
- **41 armes** — de type base, avancée, équipage ou largable
- **11 améliorations** — modifications de véhicule

**Clé du modèle** : chaque sponsor expose directement la liste des véhicules, armes et améliorations qu'il est autorisé à utiliser. Cette relation est calculée au démarrage et stockée dans une `Map` pour un accès instantané.

Les endpoints du catalogue sont **publics** (pas de JWT requis) : n'importe quel client peut consulter les données pour construire ses véhicules.

### 3.4 CRUD Équipes

- **Lister** ses équipes (`GET /api/teams`) — filtrées par utilisateur connecté
- **Créer** une équipe (`POST /api/teams`) : nom, sponsor (validé via le catalogue), budget en jerricans (défaut : 50), description optionnelle
- **Modifier** une équipe (`PUT /api/teams/:id`) : tous les champs modifiables
- **Supprimer** une équipe (`DELETE /api/teams/:id`) — avec confirmation utilisateur

**Réponse enrichie** : toutes les réponses de l'API Teams incluent `vehicleCount: number` — le nombre de véhicules appartenant à l'équipe (actuellement toujours `0` en attendant l'implémentation du module Véhicules).

**Carousel de sélection du sponsor** : le formulaire de création/modification charge les 13 sponsors enrichis depuis `/api/catalog/sponsors` et les présente via un carousel interactif (navigation ←/→, indicateurs de position, description + classes + avantages de chaque sponsor).

**Règle de verrouillage du sponsor** : dès qu'un premier véhicule est ajouté à une équipe, le sponsor ne peut plus être modifié. Le carousel affiche un badge 🔒 et bloque la navigation. Cette règle est appliquée côté frontend via le champ `vehicleCount` retourné par l'API.

**Résumé des véhicules sur la carte** : chaque carte d'équipe affiche la liste de ses véhicules — nom (résolu depuis le catalogue via `nomInterne`) et coût total (prix de base du véhicule + somme des prix de ses armes et améliorations montées). Le frontend charge cette liste via `GET /api/teams/:id/vehicles` et résout les prix via le catalogue du sponsor (`GET /api/catalog/sponsors/:nom`, déjà chargé pour le carousel/builder). **Cas particulier de la Tourelle** : son coût réel (3× le prix de l'arme associée) ne peut pas être déterminé — `VehicleImprovement` ne mémorise pas quelle arme une Tourelle équipe. Le frontend l'exclut donc du total et préfixe l'affichage d'un « ≈ » pour signaler un montant minoré (cf. `VehicleSummary.coutApproximatif`, `apps/frontend/src/app/teams/vehicle-summary.ts`).

**Modifier / supprimer un véhicule depuis la liste** : chaque ligne de la liste porte deux actions — ✏️ *Gérer l'équipement* et 🗑 *Supprimer*. "Modifier un véhicule" ne porte PAS sur ses caractéristiques de base (`nomInterne` immutable, cf. note sous le tableau d'API "Véhicules", §6) mais sur son équipement : le bouton ouvre `VehicleEditor` (mirroir de l'étape 2 de `VehicleBuilder`, enrichi du RETRAIT — `apps/frontend/src/app/teams/vehicle-editor/`), qui permet d'ajouter ET de retirer armes/améliorations sur un véhicule existant. La suppression d'un véhicule entier (`DELETE /api/vehicles/:id`, cascade sur son équipement) demande confirmation (`window.confirm`, mirroir de la suppression d'équipe) et **ne procède pas par suppression optimiste** : `vehicleCount` doit être resynchronisé après coup — il peut retomber à 0 et déverrouiller le choix du sponsor (cf. règle de verrouillage ci-dessus) — d'où un rechargement complet (`Teams.loadTeams`) après chaque action destructrice.

Sécurité : un utilisateur ne peut accéder qu'à ses propres équipes (filtre `userId` côté backend). Toute tentative d'accès à une équipe d'un autre utilisateur retourne HTTP 404.

### 3.5 Navigation

- `/home` — Page d'accueil avec présentation et liens vers les sections
- `/rules` — Affichage des règles du jeu (Markdown → HTML)
- `/vehicles` — Page véhicules (placeholder)
- `/weapons` — Page armes (placeholder)
- `/teams` — Gestion des équipes (protégé, **implémenté**)
- `/login`, `/register` — Pages d'authentification

---

## 4. Fonctionnalités à implémenter (backlog)

> **Construction et gestion de véhicules : implémentées.** La sélection du sponsor,
> l'ajout d'un véhicule, son équipement (armes/améliorations dans la limite des
> emplacements), la modification de cet équipement et la suppression d'un véhicule
> sont désormais opérationnels — cf. §3.4 et les composants `vehicle-builder`/
> `vehicle-editor` côté frontend. Cette section du backlog ne porte donc plus que
> sur les fonctionnalités encore à construire.

### 4.1 Gestion du budget

- Afficher le budget restant d'une équipe (budget total − coût des véhicules − coût des armes − coût des améliorations)
- Bloquer l'ajout si le budget est dépassé
- Cas particulier : coût de la **Tourelle** = 3× le prix de l'arme associée

### 4.2 Frontend — Consultation du catalogue

- Remplacer les pages `/vehicles` et `/weapons` (actuellement placeholders Markdown) par une vue dynamique depuis l'API `/api/catalog/`
- Permettre de filtrer par sponsor pour voir uniquement les items autorisés

### 4.3 Tableau de bord

- Vue d'ensemble de toutes les équipes de l'utilisateur
- Accès rapide à chaque équipe et ses véhicules

### 4.4 Export (futur)

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
| `id` | number | PK, auto-incrémenté |
| `name` | string(100) | obligatoire |
| `sponsor` | string(50) | défaut : `"Rutherford"` — immutable dès le 1er véhicule |
| `cans` | number | budget en jerricans, défaut : 50 |
| `description` | text | nullable |
| `userId` | number | FK → User (`CASCADE` on delete) |
| `createdAt` | Date | auto |
| `updatedAt` | Date | auto |

**Champ calculé dans la réponse API** (non stocké en base) :

| Champ | Type | Description |
|-------|------|-------------|
| `vehicleCount` | number | Nombre de véhicules de l'équipe. Toujours `0` jusqu'à l'implémentation du module Véhicules. Utilisé par le frontend pour verrouiller le choix du sponsor. |

### Catalogue de jeu (en mémoire, pas en base de données)

Les données du catalogue ne sont **pas stockées en base de données**. Elles sont chargées depuis les fichiers YAML au démarrage et conservées dans le `CatalogService` (singleton NestJS).

**`Sponsor`** (en mémoire) — champs : `nom`, `description`, `classes_avantage[]`, `avantages_sponsorises`, `vehicules[]`, `armes[]`, `ameliorations[]`

**`Vehicule`** (en mémoire) — champs : `nom`, `poids` (Léger/Moyen/Lourd), `carrosserie`, `manoeuvrabilite`, `vitesse_max`, `equipage`, `emplacements`, `prix`, `description`, `regles`, `sponsors_autorises[]`, `ameliorations_defaut[]` (optionnel — liste des `nom_interne` d'améliorations intégrées au profil de base du véhicule, cf. §7 "Améliorations par défaut")

**`Arme`** (en mémoire) — champs : `nom`, `type` (base/avancée/équipage/largable), `prix`, `emplacement`, `description`, `regles`, `sponsors_autorises[]`

**`Amelioration`** (en mémoire) — champs : `nom`, `prix` (number ou `"x3"` pour la Tourelle), `emplacement`, `description`, `regles`, `sponsors_autorises[]`

### `Vehicle` _(implémentée — module Vehicle)_

L'entité `Vehicle` représente un véhicule **appartenant à une équipe** (instance de jeu), distinct du catalogue. Elle référence le type de véhicule par son `nom_interne` — et non son `nom` affiché : c'est précisément le rôle de cet identifiant catalogue (stable, sans accents ni espaces) que de servir de clé étrangère logique, et lui seul distingue de façon fiable une variante sponsor de l'original (ex. `"voiture"` vs `"voiture_prison"`, `"belier"` vs `"belier_slime"`). *Champ renommé `nomInterne` par rapport à la version initiale de cette fiche, qui mentionnait `nom` — voir `vehicle.entity.ts` pour le détail du raisonnement.*

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `nomInterne` | string | référence vers `Vehicule.nom_interne` du catalogue |
| `teamId` | number | FK → Team (`CASCADE` on delete) |
| `improvements` | `VehicleImprovement[]` | relation `OneToMany`, `cascade: true` |
| `createdAt` | Date | auto |

### `VehicleImprovement` _(implémentée — module Vehicle)_

Une amélioration installée sur un véhicule (instance de jeu). Référence l'amélioration du catalogue par `nom_interne`, pour les mêmes raisons que `Vehicle.nomInterne` ci-dessus — c'est notamment ce qui permet de regrouper "Bélier" et "Bélier (Slime)" sous la même règle métier (même `comportement`, cf. §7) bien qu'ils aient des `nom_interne` distincts.

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `nomInterne` | string | référence vers `Amelioration.nom_interne` du catalogue |
| `orientation` | `'avant' \| 'arrière' \| 'gauche' \| 'droite'` \| `null` | nullable — uniquement pour les améliorations orientées (Bélier...) |
| `estDefaut` | boolean | `false` pour les améliorations achetées par le joueur ; `true` pour les améliorations intégrées au profil de base du véhicule (Arceaux du Buggy, Tourelle du Char d'assaut…) — insérées automatiquement à la création du véhicule |
| `vehicleId` | number | FK → Vehicle (`CASCADE` on delete) |
| `createdAt` | Date | auto |

**Comportement des améliorations par défaut (`estDefaut: true`)** :
- **Coût zéro** — `prix = 0` dans le DTO ; elles ne comptent pas dans le budget de l'équipe.
- **Non supprimables** — `DELETE /api/vehicles/:id/improvements/:id` retourne HTTP **403** si `estDefaut: true`.
- **Hors pool d'emplacements** — elles ne consomment pas de slot achetable (ni côté backend dans `improvementSlotsOf`, ni dans la chaîne `VehicleBuild`).
- **Affichage UI** — le badge 🔒 *Intégré* remplace le bouton *Retirer* dans `EquipmentManager`.

**Champs calculés dans la réponse API** (non stockés en base) — voir `VehicleService.toVehicleDto` :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `prix` | number | Prix effectif en jerricans. `0` si `estDefaut`, prix catalogue sinon. Calculé via getter sur l'entité hydratée. |

### `Weapon` _(implémentée — module Weapon)_

Une arme montée sur un véhicule (instance de jeu). Référence l'arme du catalogue
par `nom_interne`, pour les mêmes raisons que `Vehicle.nomInterne`/`VehicleImprovement.nomInterne`
ci-dessus (clé stable, sans accents ni espaces, distingue les variantes).

Contrairement à `VehicleImprovement`, `Weapon` ne porte aucune notion de
`comportement` : les armes ne modifient jamais les statistiques du véhicule —
pas de Pattern Decorator nécessaire (cf. `weapon.entity.ts`/`weapon.service.ts`,
en-têtes). Seules les règles de pose (sponsor, orientation, emplacements) s'appliquent.

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `nomInterne` | string | référence vers `Arme.nom_interne` du catalogue (même convention que `Vehicle.nomInterne`) |
| `orientation` | `'avant' \| 'arrière' \| 'gauche' \| 'droite'` \| `null` | nullable — **obligatoire** pour toute arme dont `type !== 'équipage'` (montée sur un arc de tir précis), **interdite** pour les armes de type `équipage` (portées par un équipier, tir à 360° automatique) |
| `vehicleId` | number | FK → Vehicle (`CASCADE` on delete) |
| `createdAt` | Date | auto |

**Champ calculé dans la réponse API** (non stocké en base) — voir `VehicleService.toVehicleDto` :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `prix` | number | Prix de l'arme en jerricans, résolu depuis le catalogue via getter sur l'entité hydratée. |

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

### Catalogue de jeu

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/catalog/sponsors` | Non | Liste tous les sponsors avec leurs véhicules/armes/améliorations autorisés |
| GET | `/api/catalog/sponsors/:nom` | Non | Un sponsor par son nom + son catalogue complet (404 si inconnu) |
| GET | `/api/catalog/vehicules` | Non | Tous les véhicules du catalogue |
| GET | `/api/catalog/armes` | Non | Toutes les armes du catalogue |
| GET | `/api/catalog/ameliorations` | Non | Toutes les améliorations du catalogue |

Note : les noms de sponsor avec espaces/accents doivent être URL-encodés par le client (`La%20Ge%C3%B4li%C3%A8re`).

### Équipes

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/teams` | JWT | Liste des équipes de l'utilisateur connecté |
| POST | `/api/teams` | JWT | Créer une équipe |
| PUT | `/api/teams/:id` | JWT | Modifier une équipe |
| DELETE | `/api/teams/:id` | JWT | Supprimer une équipe |

### Véhicules

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/teams/:id/vehicles` | JWT | Véhicules d'une équipe _(implémentée)_ |
| POST | `/api/teams/:id/vehicles` | JWT | Ajouter un véhicule — crée le véhicule "nu", validé contre le catalogue du sponsor _(implémentée)_ |
| GET | `/api/vehicles/:id` | JWT | Détail "monté" d'un véhicule (stats + récapitulatif, cf. `VehicleBuild`) _(implémentée)_ |
| GET | `/api/vehicles/:id/available-improvements` | JWT | Améliorations du sponsor avec verdict de disponibilité _(implémentée)_ |
| POST | `/api/vehicles/:id/improvements` | JWT | Ajouter une amélioration (validation puis persistance) _(implémentée)_ |
| DELETE | `/api/vehicles/:id/improvements/:improvementId` | JWT | Retirer une amélioration — **HTTP 403** si `estDefaut: true` (amélioration intégrée au profil de base), **HTTP 204** sinon _(implémentée)_ |
| DELETE | `/api/vehicles/:id` | JWT | Supprimer un véhicule (cascade sur ses armes/améliorations) _(implémentée)_ |

> **`PUT /api/vehicles/:id` — non prévue.** Aucun champ de `Vehicle` n'est modifiable une fois le véhicule créé : `nomInterne` est la clé catalogue immutable (la changer invaliderait l'équipement déjà posé, validé contre le catalogue DE CE TYPE PRÉCIS), et l'équipement se gère exclusivement via les routes dédiées ci-dessus et celles du module Armes. "Modifier un véhicule" (cf. §3.4, "Résumé des véhicules sur la carte") signifie donc *gérer son équipement*, pas réécrire ses caractéristiques de base.

### Armes _(implémentée — module Weapon)_

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/vehicles/:id/available-weapons` | JWT | Armes du sponsor avec verdict de disponibilité (sponsor + orientation + emplacements) |
| POST | `/api/vehicles/:id/weapons` | JWT | Ajouter une arme à un véhicule (validation puis persistance) |
| DELETE | `/api/weapons/:id` | JWT | Retirer une arme |

---

## 7. Règles métier Gaslands

> Les données complètes sont définies dans les fichiers YAML `database_init/data/` et exposées via l'API `/api/catalog/`. Cette section est un résumé de référence.

### Sponsors (13 au total)

Chaque équipe doit choisir un sponsor. Les véhicules, armes et améliorations disponibles dépendent du sponsor choisi.

| Sponsor | Thème principal | Particularité |
|---------|----------------|---------------|
| Rutherford | Militaire | Seul accès à l'Hélicoptère et au Char d'assaut |
| Miyazaki | Pilotage / Précision | — |
| Mishkin | Technologie électronique | Armes et améliorations électriques exclusives (6 armes, 2 améliorations) |
| Idris | Vitesse / Nitro | Pas d'accès au Gyrocoptère |
| Slime | Éperonnage | — |
| La Geôlière | Prison / Reconversion | — |
| Scarlett | Piraterie | — |
| La Patrouille de l'Autoroute | Poursuite | — |
| Verney | Récupération / Génie | — |
| Maxxine | Drifts / Ballet | — |
| L'Ordre Infernal | Feu / Horreur | — |
| Beverly, le Diable de l'Autoroute | Spectral / Âmes | — |
| Rusty et ses Trafiquants d'Alcool | Remorques / Instabilité | — |

### Sponsor et véhicules

Le sponsor est choisi **une seule fois à la création de l'équipe** et détermine :
- Les types de véhicules disponibles (certains véhicules sont exclusifs à un sponsor)
- Les armes et améliorations achetables pour les véhicules de l'équipe

**Règle d'immutabilité** : dès qu'un premier véhicule est ajouté à l'équipe, le sponsor ne peut plus être modifié. Changer de sponsor après avoir acheté des véhicules changerait rétroactivement leur légalité.

### Budget (Jerricans)

- Budget de départ : **50 jerricans** par équipe (modifiable)
- Chaque véhicule, arme et amélioration a un coût en jerricans
- Exception : l'amélioration **Tourelle** coûte **3× le prix de l'arme** concernée (coût variable)
- Le total ne doit pas dépasser le budget

### Véhicules (16 au total)

Répartis en trois catégories de poids :

| Catégorie | Exemples | Coût |
|-----------|---------|------|
| **Léger** | Dragster, Moto, Buggy, Moto avec side-car | 5–8 jerricans |
| **Moyen** | Voiture, Voiture de sport, Camion, Ambulance, Gyrocoptère, Camion à glaces | 8–20 jerricans |
| **Lourd** | Monster Truck, Camion Lourd, Bus, Hélicoptère*, Char d'assaut*, Forteresse Mobile | 25–40 jerricans |

*Hélicoptère et Char d'assaut : **Rutherford uniquement**.

### Armes (41 au total)

| Type | Nombre | Exemples |
|------|--------|---------|
| `base` | 4 | Pistolet, Mitrailleuse, Mitrailleuse Lourde, Minigun |
| `avancée` | 18 | BFG, Lance-Flammes, Canon de 125mm, Canon à Arc Électrique* |
| `équipage` | 11 | Grenades, Cocktails Molotov, Fusil à Pompe, Pistolet Mitrailleur |
| `largable` | 8 | Largueur de Mines, Largueur d'Huile, Auto-Tourelle, Bombes Téléguidées |

*Canon à Arc Électrique et 5 autres armes électroniques : **Mishkin uniquement**.

### Améliorations de véhicule (11 au total)

| Amélioration | Coût | Emplacement | Note |
|---|---|---|---|
| Arceaux | 4 | 1 | Ignore les dégâts de tonneau |
| Bélier | 4 | 1 | +2 dés en éperonnage |
| Bélier Explosif | 3 | 0 | Premier éperonnage +6 dés, risque retour |
| Blindage | 4 | 1 | +2 carrosserie, cumulable |
| Catapulte Improvisée | 2 | 1 | Portée étendue pour armes largables |
| Chenilles | 4 | 1 | +1 manoeuvrabilité, tout-terrain |
| Membre d'Équipage Supplémentaire | 4 | 0 | +1 équipier |
| Nitro | 6 | 0 | Accélération forcée |
| Réacteur Nucléaire Expérimental | 5 | 0 | **Mishkin uniquement** |
| Téléporteur Expérimental | 7 | 0 | **Mishkin uniquement** |
| Tourelle | **×3** | 0 | Arc 360° pour une arme (coût = 3× le prix de l'arme) |

### Améliorations par défaut

Certains véhicules ont des améliorations **intégrées à leur profil de base** : elles sont
présentes dès la création du véhicule, sans coût, et **ne peuvent pas être retirées**.

| Véhicule | Amélioration intégrée | Raison |
|----------|-----------------------|--------|
| Buggy | Arceaux | Fait partie du profil standard du Buggy |
| Char d'assaut | Tourelle | Canon principal — non détachable |

Ces améliorations sont modélisées par `VehicleImprovement.estDefaut = true` et insérées
automatiquement par `VehicleService.create()` à partir du champ `ameliorations_defaut`
du catalogue YAML. Elles n'apparaissent pas dans le calcul du budget ni dans le pool
d'emplacements — seul le badge 🔒 *Intégré* les identifie dans l'UI.
