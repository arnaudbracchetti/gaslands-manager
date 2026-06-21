# Véhicules, Catalogue & Règles métier Gaslands

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md).
> Mettre à jour après tout changement du catalogue YAML, des modules Vehicle/Weapon, ou des règles de jeu.
> Document de conception système : [`docs/VEHICLE_SYSTEM.md`](../VEHICLE_SYSTEM.md).

---

## Catalogue de jeu (en mémoire)

Au démarrage du serveur, le backend charge un **catalogue complet** depuis des fichiers YAML (`database_init/data/`) et le conserve en mémoire.

Le catalogue contient :
- **13 sponsors** — chacun avec ses classes d'avantage et ses règles spéciales
- **16 véhicules** — répartis en Léger / Moyen / Lourd, avec leurs statistiques complètes
- **41 armes** — de type base, avancée, équipage ou largable
- **11 améliorations** — modifications de véhicule

**Clé du modèle** : chaque sponsor expose directement la liste des véhicules, armes et améliorations qu'il est autorisé à utiliser. Cette relation est calculée au démarrage et stockée dans une `Map` pour un accès instantané.

**Conversion Markdown → HTML au chargement** : les champs `description`/`regles` (`Vehicule`, `Arme`, `Amelioration`) ainsi que `Sponsor.description` contiennent du Markdown dans les fichiers YAML. `CatalogService.onModuleInit()` les convertit une seule fois en HTML via `marked`. Le frontend affiche directement ce HTML via `[innerHTML]`. `Sponsor.avantages_sponsorises` garde sa conversion existante côté client (`sponsor-carousel.ts`, `marked.parse()` + `DomSanitizer`), inchangée.

Les endpoints du catalogue sont **publics** (pas de JWT requis).

---

## Construction d'un véhicule

Le bouton "+ Ajouter un véhicule" d'une carte d'équipe navigue vers `/teams/:teamId/vehicles/new` — `VehicleConfiguratorPage`/`VehicleConfigurator`, qui affiche d'abord le choix du véhicule parmi ceux autorisés par le sponsor, puis bascule vers la section d'équipement dès que le véhicule "nu" est créé.

**Détail d'un équipement** : toute la carte d'une arme ou d'une amélioration (`equipment-option`) est cliquable et ouvre une popup (`EquipmentDetailModal`) — nom, coût, emplacement, description, règles complètes, et raison de refus éventuelle. L'ajout au véhicule reste l'action exclusive du bouton "+" de la carte (`$event.stopPropagation()` empêche son clic d'ouvrir la popup).

**Budget de l'équipe dans le configurateur** : `EquipmentManager` affiche en tête le bloc "Budget de l'équipe" — jerricans utilisés / budget total, barre de progression, solde restant. La validation est assurée par le backend (`VehicleService.getRemainingBudget`), qui marque `disponible: false` toute arme/amélioration dont le prix dépasserait le budget restant — **règle "Budget de l'équipe insuffisant"**, vérifiée **avant** toute autre règle (sponsor exclu). **Cas particulier de la Tourelle** : son prix catalogue est `"x3"` — elle n'est jamais bloquée par cette règle.

---

## Règles métier Gaslands

> Les données complètes sont définies dans les fichiers YAML `database_init/data/` et exposées via l'API `/api/catalog/`. Cette section est un résumé de référence.

### Sponsors (13 au total)

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

**Application** : `VehicleService.getRemainingBudget` calcule le budget restant de l'équipe (tous véhicules confondus). Toute arme/amélioration dont le prix dépasse ce restant est marquée `disponible: false`. **Exception non couverte** : la Tourelle (`prix: "x3"`) n'est jamais bloquée — son coût dépend de l'arme assignée, encore inconnue au moment de l'ajout.

### Véhicules (16 au total)

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

Certains véhicules ont des améliorations **intégrées à leur profil de base** : présentes dès la création, sans coût, et **non retirables**.

| Véhicule | Amélioration intégrée | Raison |
|----------|-----------------------|--------|
| Buggy | Arceaux | Fait partie du profil standard du Buggy |
| Char d'assaut | Tourelle | Canon principal — non détachable |

Modélisées par `VehicleImprovement.estDefaut = true`, insérées automatiquement par `VehicleService.create()` depuis `ameliorations_defaut` du catalogue YAML. Elles n'apparaissent pas dans le calcul du budget ni dans le pool d'emplacements — seul le badge 🔒 *Intégré* les identifie dans l'UI.

---

## Modèles de données

### Catalogue (en mémoire, pas en base de données)

**`Sponsor`** — champs : `nom`, `description`, `classes_avantage[]`, `avantages_sponsorises`, `vehicules[]`, `armes[]`, `ameliorations[]`

**`Vehicule`** — champs : `nom`, `poids` (Léger/Moyen/Lourd), `carrosserie`, `manoeuvrabilite`, `vitesse_max`, `equipage`, `emplacements`, `prix`, `description`, `regles`, `sponsors_autorises[]`, `ameliorations_defaut[]`

**`Arme`** — champs : `nom`, `type` (base/avancée/équipage/largable), `prix`, `emplacement`, `description`, `regles`, `sponsors_autorises[]`

**`Amelioration`** — champs : `nom`, `prix` (number ou `"x3"` pour la Tourelle), `emplacement`, `description`, `regles`, `sponsors_autorises[]`

### `Vehicle` _(entité DB — module Vehicle)_

L'entité `Vehicle` représente un véhicule **appartenant à une équipe** (instance de jeu), distinct du catalogue. Elle référence le type de véhicule par son `nom_interne` — identifiant stable, sans accents ni espaces, qui distingue les variantes sponsor (ex. `"voiture"` vs `"voiture_prison"`, `"belier"` vs `"belier_slime"`).

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `nomInterne` | string | référence vers `Vehicule.nom_interne` du catalogue |
| `teamId` | number | FK → Team (`CASCADE` on delete) |
| `improvements` | `VehicleImprovement[]` | relation `OneToMany`, `cascade: true` |
| `createdAt` | Date | auto |

### `VehicleImprovement` _(entité DB — module Vehicle)_

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `nomInterne` | string | référence vers `Amelioration.nom_interne` du catalogue |
| `orientation` | `'avant' \| 'arrière' \| 'gauche' \| 'droite'` \| `null` | nullable — uniquement pour les améliorations orientées (Bélier...) |
| `estDefaut` | boolean | `false` pour les améliorations achetées ; `true` pour les améliorations intégrées au profil de base |
| `vehicleId` | number | FK → Vehicle (`CASCADE` on delete) |
| `createdAt` | Date | auto |

**Comportement des améliorations par défaut (`estDefaut: true`)** :
- **Coût zéro** — `prix = 0` dans le DTO.
- **Non supprimables** — `DELETE /api/vehicles/:id/improvements/:id` retourne HTTP **403**.
- **Hors pool d'emplacements** — ne consomment pas de slot achetable.
- **Affichage UI** — le badge 🔒 *Intégré* remplace le bouton *Retirer*.

**Champ calculé dans la réponse API** :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `prix` | number | `0` si `estDefaut`, prix catalogue sinon. Calculé via getter sur l'entité hydratée. |

### `Weapon` _(entité DB — module Weapon)_

Contrairement à `VehicleImprovement`, `Weapon` ne porte aucune notion de `comportement` : les armes ne modifient jamais les statistiques du véhicule.

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `nomInterne` | string | référence vers `Arme.nom_interne` du catalogue |
| `orientation` | `'avant' \| 'arrière' \| 'gauche' \| 'droite'` \| `null` | **obligatoire** pour `type !== 'équipage'`, **interdite** pour `type === 'équipage'` |
| `vehicleId` | number | FK → Vehicle (`CASCADE` on delete) |
| `createdAt` | Date | auto |

**Champ calculé dans la réponse API** :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `prix` | number | Prix de l'arme en jerricans, résolu depuis le catalogue via getter. |

---

## API Endpoints — Catalogue & Véhicules

### Catalogue de jeu (public, pas de JWT)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/catalog/sponsors` | Non | Liste tous les sponsors avec leurs véhicules/armes/améliorations autorisés |
| GET | `/api/catalog/sponsors/:nom` | Non | Un sponsor par son nom + son catalogue complet (404 si inconnu) |
| GET | `/api/catalog/vehicules` | Non | Tous les véhicules du catalogue |
| GET | `/api/catalog/armes` | Non | Toutes les armes du catalogue |
| GET | `/api/catalog/ameliorations` | Non | Toutes les améliorations du catalogue |

Note : les noms de sponsor avec espaces/accents doivent être URL-encodés (`La%20Ge%C3%B4li%C3%A8re`).

### Véhicules

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/teams/:id/vehicles` | JWT | Véhicules d'une équipe |
| POST | `/api/teams/:id/vehicles` | JWT | Ajouter un véhicule — crée le véhicule "nu", validé contre le catalogue du sponsor |
| GET | `/api/vehicles/:id` | JWT | Détail "monté" d'un véhicule (stats + récapitulatif, cf. `VehicleBuild`) |
| GET | `/api/vehicles/:id/available-improvements` | JWT | Améliorations du sponsor avec verdict de disponibilité |
| POST | `/api/vehicles/:id/improvements` | JWT | Ajouter une amélioration (validation puis persistance) |
| DELETE | `/api/vehicles/:id/improvements/:improvementId` | JWT | Retirer une amélioration — **HTTP 403** si `estDefaut: true`, **HTTP 204** sinon |
| DELETE | `/api/vehicles/:id` | JWT | Supprimer un véhicule (cascade sur ses armes/améliorations) |

> **`PUT /api/vehicles/:id` — non prévue.** `nomInterne` est immutable une fois le véhicule créé. "Modifier un véhicule" signifie *gérer son équipement* via les routes dédiées ci-dessous.

### Armes

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/vehicles/:id/available-weapons` | JWT | Armes du sponsor avec verdict de disponibilité (sponsor + orientation + emplacements) |
| POST | `/api/vehicles/:id/weapons` | JWT | Ajouter une arme à un véhicule (validation puis persistance) |
| DELETE | `/api/weapons/:id` | JWT | Retirer une arme |

> `AvailableImprovementDto` et `AvailableWeaponDto` incluent `description: string` (affiché dans `equipment-option`) et `regles: string` (affiché dans `EquipmentDetailModal` uniquement).
