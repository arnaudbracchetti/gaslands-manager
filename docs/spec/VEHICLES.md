# Véhicules, Catalogue & Règles métier Gaslands

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md).
> Mettre à jour après tout changement du catalogue YAML, des modules Vehicle/Weapon, ou des règles de jeu.
> Document de conception système : [`docs/VEHICLE_SYSTEM.md`](../VEHICLE_SYSTEM.md).

---

## Catalogue de jeu (en mémoire)

Au démarrage du serveur, le backend charge un **catalogue complet** depuis des fichiers YAML (`database_init/data/`) et le conserve en mémoire.

Le catalogue contient :
- **13 sponsors** — chacun avec ses classes d'avantage et ses règles spéciales
- **22 véhicules** — répartis en Léger / Moyen / Lourd, avec leurs statistiques complètes (dont 6 variantes "(Prison)" exclusives à La Geôlière)
- **38 armes** — de type base, avancée, équipage ou largable
- **19 améliorations** — modifications de véhicule (dont 4 variantes sponsor à comportement identique, prix/emplacement différents)
- **72 avantages** — 12 catégories de style (6 chacune), cf. §Avantages de véhicule ci-dessous

**Clé du modèle** : chaque sponsor expose directement la liste des véhicules, armes et améliorations qu'il est autorisé à utiliser. Cette relation est calculée au démarrage et stockée dans une `Map` pour un accès instantané. **Exception** : la liste des avantages d'un sponsor n'est **pas** résolue via un champ `sponsors_autorises` (les avantages n'en portent pas) mais par correspondance de catégorie — cf. §Avantages de véhicule.

**Conversion Markdown → HTML au chargement** : les champs `description`/`regles` (`Vehicule`, `Arme`, `Amelioration`, `Avantage`) ainsi que `Sponsor.description` contiennent du Markdown dans les fichiers YAML. `CatalogService.onModuleInit()` les convertit une seule fois en HTML via `marked`. Le frontend affiche directement ce HTML via `[innerHTML]`. `Sponsor.avantages_sponsorises` garde sa conversion existante côté client (`sponsor-carousel.ts`, `marked.parse()` + `DomSanitizer`), inchangée.

Les endpoints du catalogue sont **publics** (pas de JWT requis).

---

## Construction d'un véhicule

Le bouton "+ Ajouter un véhicule" d'une carte d'équipe navigue vers `/teams/:teamId/vehicles/new` — `VehicleConfiguratorPage`/`VehicleConfigurator`, qui affiche d'abord le choix du véhicule parmi ceux autorisés par le sponsor, puis bascule vers la section d'équipement dès que le véhicule "nu" est créé.

**Détail d'un équipement** : toute la carte d'une arme ou d'une amélioration (`equipment-option`) est cliquable et ouvre une popup (`EquipmentDetailModal`) — nom, coût, emplacement, description, règles complètes, et raison de refus éventuelle. L'ajout au véhicule reste l'action exclusive du bouton "+" de la carte (`$event.stopPropagation()` empêche son clic d'ouvrir la popup).

**Budget de l'équipe dans le configurateur** : `EquipmentManager` affiche en tête le bloc "Budget de l'équipe" — jerricans utilisés / budget total, barre de progression, solde restant. La validation est assurée par le backend (`Team.remainingBudget`, getter de l'agrégat), qui marque `disponible: false` toute arme/amélioration/avantage dont le prix dépasserait le budget restant — **règle "Budget de l'équipe insuffisant"**, vérifiée **avant** toute autre règle (sponsor exclu). **Cas particulier du montage sur Tourelle** : choisi au moment de l'ajout d'une arme (bouton « Tourelle x3 », visible si `Arme.montable_tourelle`, au même endroit que les 4 arcs de tir), il triple son coût — la garde budget porte alors sur ce coût ×3, cf. §Budget ci-dessous.

**Nom du véhicule (distinct du type)** : un véhicule porte, en plus de son type catalogue immutable (`nomInterne`), un nom propre éditable (`Vehicle.nom`, cf. §Modèles de données ci-dessous) — par défaut égal au nom du type, personnalisable à tout moment via le champ éditable en tête de `VehicleCostSummary` (même écran que la gestion de l'équipement, pas d'étape dédiée au moment du choix du type). Partout où l'application affiche ce nom, le format est `"Nom (Type)"` **uniquement si le nom a été personnalisé** — sinon le nom seul, jamais de parenthèse redondante (ex. "Camion" reste "Camion" tant que non renommé, mais devient "La Teigne (Camion)" une fois renommé). Cette règle de formatage est portée par le getter `Vehicle.nom` lui-même côté backend — aucun consommateur (DTO, journal d'événements, frontend) ne la recalcule.

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
- Exception : une arme **montée sur Tourelle** coûte **3× son prix catalogue** (`Weapon.orientation = 'tourelle'`, choisi à l'achat)
- Le total ne doit pas dépasser le budget

**Application** : `Team.remainingBudget` (getter de l'agrégat) calcule le budget restant de l'équipe (tous véhicules confondus). Toute arme/amélioration/avantage dont le prix dépasse ce restant est marquée `disponible: false`. Le montage sur Tourelle est un choix fait au moment même de l'ajout de l'arme (bouton « Tourelle x3 », visible si `Arme.montable_tourelle`) — l'agrégat `Vehicle.canAddWeapon`/`addWeapon` refuse (`DomainException` → HTTP 400) l'ajout si le coût ×3 dépasse le budget restant. Il n'y a plus d'« assignation » différée : changer l'arme montée sur une Tourelle consiste à revendre l'arme actuelle (cf. §Annulation d'achat vs revente, [CAMPAIGN.md](CAMPAIGN.md#annulation-dachat-vs-revente), pour l'atelier) puis en acheter une nouvelle avec le bouton Tourelle.

### Véhicules (22 au total)

| Catégorie | Nombre | Exemples | Coût |
|-----------|--------|---------|------|
| **Léger** | 4 | Dragster, Moto, Buggy, Moto avec side-car | 5–8 jerricans |
| **Moyen** | 12 | Voiture, Voiture de sport, Camion, Ambulance, Gyrocoptère, Camion à glaces (chacun avec une variante "(Prison)" exclusive à La Geôlière) | 8–20 jerricans |
| **Lourd** | 6 | Monster Truck, Camion Lourd, Bus, Hélicoptère*, Char d'assaut*, Forteresse Mobile | 25–40 jerricans |

*Hélicoptère et Char d'assaut : **Rutherford uniquement**.

### Armes (38 au total)

| Type | Nombre | Exemples |
|------|--------|---------|
| `base` | 3 | Mitrailleuse, Mitrailleuse Lourde, Minigun |
| `avancée` | 18 | BFG, Lance-Flammes, Canon de 125mm, Canon à Arc Électrique* |
| `équipage` | 9 | Grenades, Cocktails Molotov, Fusil à Pompe, Pistolet Mitrailleur |
| `largable` | 8 | Largueur de Mines, Largueur d'Huile, Auto-Tourelle, Bombes Téléguidées |

*Canon à Arc Électrique et 5 autres armes électroniques (Brouilleur Électromagnétique, Canon Gravitationnel, Marteleur, Rayon Désintégrateur, Super Amplificateur Cinétique) : **Mishkin uniquement**.

### Orientation requise (champ catalogue `necessite_orientation`)

Le besoin d'orientation d'une arme ou d'une amélioration est un **champ catalogue
explicite** (`Arme.necessite_orientation`/`Amelioration.necessite_orientation`,
booléen obligatoire) — plutôt qu'une règle dérivée du `type` (armes) ou codée en
dur au cas par cas (améliorations).

- **Armes** : `false` pour toutes les armes d'équipage (arc à 360° automatique)
  ainsi que pour certaines armes de tir à arc non-orienté ou à effet sans
  trajectoire (ex. Boule de démolition, Marteleur, Mur de haut-parleurs,
  Auto-Tourelle, Brouilleur Électromagnétique) ; `true` pour toutes les autres.
  `WeaponType.requiresOrientation` lit directement ce champ.
- **Améliorations** : `true` uniquement pour le Bélier (et sa variante Slime) et
  le Bélier Explosif ; `false` pour toutes les autres. `ImprovementType.requiresOrientation`
  lit directement ce champ — remplace l'ancienne vérification codée en dur dans
  `BelierBehavior`/`BelierExplosifBehavior` (`domain/behaviors/improvement-behaviors.ts`),
  désormais appliquée en amont par `Vehicle.canAddImprovement` (garde générique, symétrique
  à celle déjà en place sur `Vehicle.canAddWeapon`).

Le frontend ne consulte pas ce champ directement pour piloter l'affichage du
sélecteur de direction : il continue de s'appuyer sur le contrat textuel du
message d'erreur backend (`raison` commence par `'Une orientation est requise'`,
cf. `equipment-manager.ts`) — le champ catalogue est mirroré côté frontend
(`catalog.model.ts`) à titre purement informatif.

### Montage sur Tourelle (5ème valeur d'orientation)

La Tourelle **n'est pas une amélioration** — c'est une valeur possible de
l'orientation de l'arme (`Weapon.orientation = 'tourelle'`, choisie au moment de
l'achat via le bouton « Tourelle x3 », au même endroit que les 4 arcs de tir
classiques) : elle triple le coût de l'arme (arc de tir à 360°), exclusive avec
toute autre orientation puisque c'est la même valeur qui les porte toutes.
Seules les armes marquées `montable_tourelle: true` au catalogue (`Arme.montable_tourelle`,
`database_init/data/armes.yml`) peuvent être montées ainsi — tous les sponsors
l'acceptent, seule l'arme elle-même porte la restriction. Pour changer l'arme montée
sur Tourelle : revendre l'arme actuelle puis en acheter une nouvelle avec la case
cochée (cf. `Weapon.price`, `Vehicle.canAddWeapon`/`addWeapon`).

### Améliorations de véhicule (19 au total)

4 des 19 sont des **variantes sponsor** d'une amélioration existante (même `comportement`,
prix et/ou emplacement différents - même principe que les variantes d'armes/véhicules,
cf. §1) : Bélier ↔ Bélier (Slime), Membre d'Équipage Supplémentaire ↔ sa variante Scarlett,
Nitro ↔ sa variante Idris, Blindage ↔ Micro-Blindage (Verney).

| Amélioration | Coût | Emplacement | Note |
|---|---|---|---|
| Arceaux | 4 | 1 | Ignore les dégâts de tonneau |
| Bélier | 4 | 1 | +2 dés en éperonnage, orientation requise |
| Bélier (Slime) | 4 | 0 | Variante Slime du Bélier - même effet, 0 emplacement au lieu de 1 |
| Bélier Explosif | 3 | 0 | Premier éperonnage +6 dés, risque retour, orientation requise |
| Blindage | 4 | 1 | +2 carrosserie, cumulable |
| Catapulte Improvisée | 2 | 1 | Portée étendue pour armes largables |
| Chenilles | 4 | 1 | +1 manoeuvrabilité, tout-terrain |
| Membre d'Équipage Supplémentaire | 4 | 0 | +1 équipier |
| Membre d'Équipage Supplémentaire (Scarlett) | 2 | 0 | Variante demi-prix, exclusif **Scarlett** |
| Nitro | 6 | 0 | Accélération forcée |
| Nitro (Idris) | 3 | 0 | Variante demi-prix, danger plafonné à 3, exclusif **Idris** |
| Réacteur Nucléaire Expérimental | 5 | 0 | **Mishkin uniquement** |
| Téléporteur Expérimental | 7 | 0 | **Mishkin uniquement** |
| Mégaphone | 2 | 0 | Étend la règle Sirène à tout véhicule adverse, exclusif **La Patrouille de l'Autoroute** |
| Micro-Blindage | 6 | 0 | Variante de Blindage (0 emplacement contre prix plus élevé), exclusif **Verney** |
| Remorque de Transport | 0 | 0 | Gratuite pour véhicules à remorque, exclusif **Rusty** |
| Remorque Légère | 4 | 0 | Remorque à accès limité, exclusif **Rusty** |
| Remorque Moyenne | 8 | 0 | +1 emplacement pour le véhicule remorqueur, exclusif **Rusty** |
| Remorque Lourde | 12 | 0 | +3 emplacements, réservée aux véhicules Lourds, exclusif **Rusty** |

**Remorque Moyenne/Lourde — capacité effective, pas fixe** : ces deux améliorations
augmentent réellement la capacité en emplacements du véhicule remorqueur (`+1`/`+3`),
via le même mécanisme Strategy que les autres comportements d'amélioration (`applyStats`
sur `VehicleStats.emplacements`, cf. ARCHITECTURE.md §3.4). La règle « un véhicule ne peut
être équipé que d'une seule remorque » (p.170) est appliquée de façon **croisée** entre
Remorque Moyenne et Remorque Lourde (monter l'une interdit l'autre) — **Remorque Légère**
et **Remorque de Transport** restent hors de ce contrôle (aucun `comportement` déclaré au
catalogue, aucun effet numérique documenté pour elles au-delà du thème), donc les cumuler
avec Remorque Moyenne/Lourde n'est aujourd'hui pas bloqué - limitation connue, pas une
régression (ces deux améliorations n'avaient de toute façon aucune règle appliquée avant).

### Améliorations et armes par défaut

Certains véhicules ont un équipement **intégré à leur profil de base** : présent dès
la création, sans coût, et **non retirable**.

| Véhicule | Équipement intégré | Raison |
|----------|-----------------------|--------|
| Buggy | Arceaux (amélioration) | Fait partie du profil standard du Buggy |
| Char d'assaut | Canon de 125mm monté sur Tourelle (arme) | Canon principal — non détachable, non réassignable |

Modélisées par `VehicleImprovement.estDefaut = true` (Buggy) ou `Weapon.estDefaut = true`
(Char d'assaut, mirroir sur l'arme), lues via les getters `VehicleType.defaultImprovements`/
`defaultWeaponNomInterne` et insérées automatiquement par `AddVehicleUseCase`
depuis `ameliorations_defaut`/`arme_defaut` du catalogue YAML. Elles n'apparaissent pas
dans le calcul du budget ni dans le pool d'emplacements — seul le badge 🔒 *Intégré* les
identifie dans l'UI.

### Avantages de véhicule (72 au total)

Catégorie d'équipement distincte des armes et améliorations — 12 catégories de style
(Agression, Audace, Dur à Cuire, Horreur, Mécanique, Militaire, Optimisation, Poursuite,
Précision, Rapidité, Technologie, Trompe-la-Mort), 6 avantages par catégorie. Un avantage
se comporte comme une amélioration (achat/retrait, même mécanisme de budget), à trois
différences près :

- **Aucun emplacement** : `emplacement` toujours 0, pas de consommation du pool de slots
  du véhicule.
- **Jamais d'orientation**.
- **Unicité** : un même avantage ne peut être acheté qu'une seule fois par véhicule
  (contrainte propre aux avantages, absente des armes/améliorations).

**Lien sponsor → catégories** : chaque sponsor a accès à exactement **2** des 12
catégories, via le champ `Sponsor.classes_avantage: string[2]` déjà présent dans
`sponsors.yml` (utilisé jusqu'ici comme simple badge d'affichage dans le carousel de
sélection sponsor). La résolution du catalogue par sponsor (`CatalogService`) filtre les
avantages sur `avantage.categorie ∈ sponsor.classes_avantage` — **pas** sur un champ
`sponsors_autorises` (les avantages n'en portent pas), contrairement aux véhicules/armes/
améliorations. `avantage.yml` (`database_init/data/`) ne référence donc jamais directement
un sponsor.

**Comportement mécanique réel** : 69 des 72 avantages sont purement descriptifs (texte
affiché, `comportement` absent). 3 exceptions, portées par le même mécanisme Strategy
que les améliorations (`AdvantageType.canPlace`, cf. ARCHITECTURE.md §3.4) :

| Avantage | Catégorie | Effet |
|---|---|---|
| Expertise | Précision | +1 Manœuvrabilité en permanence |
| Cascadeur | Audace | Réservé aux véhicules Poids Léger/Moyen (pas Lourd), Manœuvrabilité **effective** (après bonus d'améliorations/avantages déjà montés — ex. Chenilles, Expertise) ≥ 3 |
| Sur Deux Roues | Optimisation | Manœuvrabilité effective ≥ 3 (pas de restriction de poids) |

**Revente en atelier — perte totale** : contrairement à une arme/amélioration revendue
(moitié prix, arrondi inférieur), un avantage revendu ne rembourse **rien** — cf.
[CAMPAIGN.md — Annulation d'achat vs revente](CAMPAIGN.md#annulation-dachat-vs-revente).
`Advantage.price` retourne toujours le prix catalogue plein, `isSold` ou non ; c'est ce
qui porte entièrement la règle de perte totale (pas un second champ de "prix résiduel").

---

## Modèles de données

### Catalogue (en mémoire, pas en base de données)

**`Sponsor`** — champs : `nom`, `description`, `classes_avantage[]`, `avantages_sponsorises`, `vehicules[]`, `armes[]`, `ameliorations[]`, `avantages[]` (résolus par catégorie, cf. §Avantages de véhicule ci-dessus)

**`Vehicule`** — champs : `nom`, `poids` (Léger/Moyen/Lourd), `carrosserie`, `manoeuvrabilite`, `vitesse_max`, `equipage`, `emplacements`, `prix`, `description`, `regles`, `sponsors_autorises[]`, `ameliorations_defaut[]`, `arme_defaut?` (nom_interne de l'arme intégrée, ex. Char d'assaut → `canon_125mm`)

**`Arme`** — champs : `nom`, `type` (base/avancée/équipage/largable), `prix`, `emplacement`, `description`, `regles`, `sponsors_autorises[]`, `montable_tourelle?` (booléen — autorise le montage sur Tourelle, coût ×3), `necessite_orientation` (booléen obligatoire — cf. §Orientation requise ci-dessus)

**`Amelioration`** — champs : `nom`, `prix` (number), `emplacement`, `description`, `regles`, `sponsors_autorises[]`, `necessite_orientation` (booléen obligatoire — cf. §Orientation requise ci-dessus)

**`Avantage`** — champs : `nom`, `nom_interne`, `categorie` (une des 12 catégories, cf. §Avantages de véhicule ci-dessus), `prix`, `description`, `regles`, `comportement?` (présent seulement pour Expertise/Cascadeur/Sur Deux Roues). Pas d'`emplacement`, de `necessite_orientation`, ni de `sponsors_autorises` — jamais d'orientation, jamais de slot, résolution par `categorie`.

### `Vehicle` _(entité DB — module Vehicle)_

L'entité `Vehicle` représente un véhicule **appartenant à une équipe** (instance de jeu), distinct du catalogue. Elle référence le type de véhicule par son `nom_interne` — identifiant stable, sans accents ni espaces, qui distingue les variantes sponsor (ex. `"voiture"` vs `"voiture_prison"`, `"belier"` vs `"belier_slime"`).

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `nomInterne` | string | référence vers `Vehicule.nom_interne` du catalogue — **immutable** une fois le véhicule créé |
| `nom` | string \| null | nullable — nom personnalisé donné par le joueur (ex. "La Teigne"), `null` tant que jamais renommé. Getter `Vehicle.nom` (agrégat) résout la valeur affichée : nom personnalisé sinon nom du type, formaté `"Nom (Type)"` **seulement si différent du type** — sinon le nom seul. Renommable à tout moment (`PATCH /api/vehicles/:id/name` en construction d'équipe ; en atelier campagne, cf. [CAMPAIGN.md — Renommage d'un véhicule en atelier](CAMPAIGN.md#renommage-dun-véhicule-en-atelier)), y compris quand la campagne verrouille le reste de l'équipe (cf. TEAMS.md) — **sauf** si l'équipe est verrouillée hors phase Atelier (aucune route de renommage n'est acceptée dans cet état). |
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
- **Non supprimables** — `DELETE /api/vehicles/:id/improvements/:id` retourne HTTP **400**.
  La règle vit entièrement dans l'agrégat (`Vehicle.removeImprovement` lève une
  `DomainException` si `estDefaut`), traduite en `BadRequestException` par
  `RemoveImprovementUseCase` - même chemin, uniforme, que pour une arme `estDefaut`
  (`DELETE /api/weapons/:id` ci-dessous). Toute règle de gestion vit dans le domaine :
  aucun contrôle dupliqué ni exception distincte au niveau du use case.
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
| `orientation` | `'avant' \| 'arrière' \| 'gauche' \| 'droite' \| 'tourelle'` \| `null` | **obligatoire** pour `type !== 'équipage'` (5 valeurs, dont `'tourelle'` — montage sur Tourelle, arc à 360°, coût ×3), **interdite** (`null`) pour `type === 'équipage'`. Choisi à l'achat (`AddWeaponDto.orientation`), immuable ensuite — pour en changer, revendre puis racheter |
| `estDefaut` | boolean | `false` pour les armes achetées ; `true` pour une arme intégrée au profil de base du véhicule (ex. Canon de 125mm du Char d'assaut, non retirable) |
| `vehicleId` | number | FK → Vehicle (`CASCADE` on delete) |
| `createdAt` | Date | auto |

**Champ calculé dans la réponse API** :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `prix` | number | `0` si `estDefaut` ; sinon prix catalogue, ×3 si `orientation === 'tourelle'`. Calculé via getter sur l'entité hydratée. |
| `emplacement` | number | Emplacements consommés (résiduel), via getter `Weapon.slots` : `0` si `estDefaut`, perdue (`isLost`) ou vendue (`isSold`) — l'emplacement est alors libéré —, valeur catalogue sinon. Mirroir de `VehicleImprovement.emplacement` : l'IHM (`MountedEquipment`) le lit tel quel, sans reconsulter le catalogue (donc sans reperdre l'état vendu/perdu). |

### `VehicleAdvantage` _(entité DB — module Vehicle)_

Mirroir de `VehicleImprovement`, **sans colonne `orientation`** (jamais d'orientation pour un avantage).

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `nomInterne` | string | référence vers `Avantage.nom_interne` du catalogue |
| `vehicleId` | number | FK → Vehicle (`CASCADE` on delete) |
| `createdAt` | Date | auto |

**Champ calculé dans la réponse API** :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `prix` | number | Toujours le prix catalogue plein (`Advantage.price`) — **jamais réduit**, même une fois revendu en atelier (`isSold: true`). C'est ce champ qui porte entièrement la règle de "perte totale" à la revente (cf. §Avantages de véhicule ci-dessus), pas un calcul séparé. |

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
| GET | `/api/catalog/avantages` | Non | Tous les avantages du catalogue |

Note : les noms de sponsor avec espaces/accents doivent être URL-encodés (`La%20Ge%C3%B4li%C3%A8re`).

### Véhicules

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/teams/:id/vehicles` | JWT | Véhicules d'une équipe |
| POST | `/api/teams/:id/vehicles` | JWT | Ajouter un véhicule — crée le véhicule "nu", validé contre le catalogue du sponsor |
| GET | `/api/vehicles/:id` | JWT | Détail "monté" d'un véhicule (stats + récapitulatif, cf. `VehicleBuild`) |
| GET | `/api/vehicles/:id/available-improvements` | JWT | Améliorations du sponsor avec verdict de disponibilité |
| POST | `/api/vehicles/:id/improvements` | JWT | Ajouter une amélioration (validation puis persistance) |
| DELETE | `/api/vehicles/:id/improvements/:improvementId` | JWT | Retirer une amélioration — **HTTP 400** si `estDefaut: true` (`DomainException` → `BadRequestException`), **HTTP 200** + `VehicleDto` sinon |
| GET | `/api/vehicles/:id/available-advantages` | JWT | Avantages du sponsor avec verdict de disponibilité (budget + unicité, et Cascadeur/Sur Deux Roues via `canAddAdvantage`) |
| POST | `/api/vehicles/:id/advantages` | JWT | Ajouter un avantage (validation puis persistance, jamais d'orientation) |
| DELETE | `/api/vehicles/:id/advantages/:advantageId` | JWT | Retirer un avantage |
| DELETE | `/api/vehicles/:id` | JWT | Supprimer un véhicule (cascade sur ses armes/améliorations/avantages) |
| PATCH | `/api/vehicles/:id/name` | JWT | Renomme le véhicule (`{ nom: string }`) — construction d'équipe uniquement, refusé (`DomainException` → HTTP 400) si l'équipe est verrouillée par une campagne en cours. En atelier campagne, le renommage passe par un endpoint dédié event-sourcé, cf. [CAMPAIGN.md — Renommage d'un véhicule en atelier](CAMPAIGN.md#renommage-dun-véhicule-en-atelier) |

> **`PUT /api/vehicles/:id` — toujours non prévue.** `nomInterne` (le TYPE catalogue) reste immutable une fois le véhicule créé. "Modifier un véhicule" continue de signifier *gérer son équipement* via les routes dédiées ci-dessous — seule exception : le nom d'affichage du véhicule (distinct du type, cf. §Modèles de données ci-dessus), qui a sa propre route dédiée (`PATCH .../name`) plutôt qu'un `PUT` générique.

### Armes

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/vehicles/:id/available-weapons` | JWT | Armes du sponsor avec verdict de disponibilité (sponsor + orientation + emplacements) — inclut `montableSurTourelle: boolean` par arme |
| POST | `/api/vehicles/:id/weapons` | JWT | Ajouter une arme à un véhicule (`AddWeaponDto.orientation?`, 5 valeurs dont `'tourelle'`, validation puis persistance) |
| DELETE | `/api/weapons/:id` | JWT | Retirer une arme — refusée (`DomainException` → HTTP 400) si `estDefaut: true` |

> `AvailableImprovementDto`, `AvailableWeaponDto` et `AvailableAdvantageDto` incluent `description: string` (affiché dans `equipment-option`) et `regles: string` (affiché dans `EquipmentDetailModal` uniquement).
