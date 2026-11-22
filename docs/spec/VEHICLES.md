# Véhicules, catalogue et règles Gaslands

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md) - propriétaire du catalogue, de la
> construction de véhicule et des règles d'équipement. Mécanisme Strategy des comportements :
> [VEHICLE_SYSTEM.md](../VEHICLE_SYSTEM.md).

---

## Catalogue de jeu (en mémoire)

Chargé au démarrage depuis `database_init/data/*.yml` et conservé en mémoire (cf.
[ARCHITECTURE.md §3.3](../ARCHITECTURE.md#33-catalogues---singleton-en-mémoire)) : 13 sponsors,
22 véhicules (dont 6 variantes « (Prison) » de La Geôlière), 38 armes, 19 améliorations, 72 avantages,
12 séquelles ([CAMPAIGN.md](CAMPAIGN.md#séquelles)).

- Chaque sponsor expose la liste des véhicules, armes et améliorations qu'il autorise (`sponsors_autorises`,
  résolu au démarrage). Les **avantages** sont résolus autrement, par catégorie (cf. ci-dessous).
- Les champs Markdown (`description`, `regles`, `Sponsor.description`) sont convertis en HTML au chargement ;
  le frontend les affiche via `[innerHTML]`. `avantages_sponsorises` reste converti côté client.
- Endpoints du catalogue **publics**.

---

## Construction d'un véhicule

« + Ajouter un véhicule » (carte d'équipe) → `/teams/:teamId/vehicles/new` : choix du véhicule parmi
ceux du sponsor, puis gestion de l'équipement une fois le véhicule « nu » créé. Un véhicule existant
s'édite sur `/teams/:teamId/vehicles/:vehicleId`.

- **Détail** : toute la carte d'un équipement ouvre une modale (coût, emplacement, description, règles,
  raison de refus) ; l'ajout reste l'action du bouton « + ».
- **Budget de l'équipe** affiché en tête (utilisé/total, solde). Le backend marque `disponible: false`
  tout élément dont le prix dépasse le budget restant (`Team.remainingBudget`) - règle vérifiée **avant**
  toutes les autres.
- **Nom du véhicule** : distinct du type catalogue (`nomInterne`, immuable), éditable en tête de la
  colonne de gauche. Affiché « Nom (Type) » **uniquement** s'il a été personnalisé, sinon le nom du type
  seul. Règle portée par le getter `Vehicle.nom`, jamais recalculée ailleurs.

---

## Règles Gaslands

### Sponsors (13)

Rutherford (militaire, seul accès à l'Hélicoptère et au Char d'assaut), Miyazaki, Mishkin (6 armes et
2 améliorations électriques exclusives), Idris (nitro, pas de Gyrocoptère), Slime, La Geôlière, Scarlett,
La Patrouille de l'Autoroute, Verney, Maxxine, L'Ordre Infernal, Beverly le Diable de l'Autoroute, Rusty
et ses Trafiquants d'Alcool.

Le sponsor est choisi à la création de l'équipe et détermine véhicules, armes et améliorations
accessibles. **Il devient immuable dès le premier véhicule** (sinon la légalité des achats changerait
rétroactivement).

### Budget (jerricans)

- Budget de départ : 50 jerricans (modifiable ; remplacé par le budget de la campagne si l'équipe est
  engagée, cf. [CAMPAIGN.md](CAMPAIGN.md#budget-de-campagne)).
- Véhicules, armes, améliorations et avantages ont un coût ; le total ne doit pas dépasser le budget.
- Une arme montée sur Tourelle coûte 3× son prix.

### Véhicules (22)

| Poids | Nombre | Exemples | Coût |
|---|---|---|---|
| Léger | 4 | Dragster, Moto, Buggy, Moto avec side-car | 5-8 |
| Moyen | 12 | Voiture, Voiture de sport, Camion, Ambulance, Gyrocoptère, Camion à glaces (+ variantes Prison) | 8-20 |
| Lourd | 6 | Monster Truck, Camion Lourd, Bus, Hélicoptère*, Char d'assaut*, Forteresse Mobile | 25-40 |

\* Rutherford uniquement.

### Armes (38)

| Type | Nombre | Exemples |
|---|---|---|
| `base` | 3 | Mitrailleuse, Mitrailleuse Lourde, Minigun |
| `avancée` | 18 | BFG, Lance-Flammes, Canon de 125mm, Canon à Arc Électrique* |
| `équipage` | 9 | Grenades, Cocktails Molotov, Fusil à Pompe |
| `largable` | 8 | Largueur de Mines, Largueur d'Huile, Auto-Tourelle |

\* Avec Brouilleur Électromagnétique, Canon Gravitationnel, Marteleur, Rayon Désintégrateur et Super
Amplificateur Cinétique : Mishkin uniquement.

### Orientation requise

Champ catalogue obligatoire `necessite_orientation` (`Arme` et `Amelioration`) - jamais dérivé du type.
- Armes : `false` pour les armes d'équipage (arc à 360°) et quelques armes sans trajectoire (Boule de
  démolition, Marteleur, Mur de haut-parleurs, Auto-Tourelle, Brouilleur Électromagnétique) ; `true` sinon.
- Améliorations : `true` seulement pour le Bélier (et sa variante Slime) et le Bélier Explosif.
- Le frontend n'affiche le sélecteur de direction qu'à partir du message d'erreur backend (`raison`
  commençant par `'Une orientation est requise'`) ; le champ est copié côté frontend à titre informatif.

### Montage sur Tourelle

La Tourelle **n'est pas une amélioration** : c'est une 4ᵉ valeur d'orientation de l'arme
(`Weapon.orientation = 'tourelle'`), choisie à l'achat via le bouton « Tourelle x3 », exclusive des 3
arcs classiques. Arc à 360°, coût ×3 (la garde budget porte sur ce coût). Seules les armes
`montable_tourelle: true` sont concernées, pour tous les sponsors. Changer l'arme d'une tourelle =
revendre l'arme puis en racheter une avec « Tourelle x3 ».

### Améliorations de véhicule

19, dont 4 **variantes sponsor** au même comportement mais prix/emplacement différents : Bélier ↔ Bélier
(Slime), Membre d'Équipage Supplémentaire ↔ variante Scarlett, Nitro ↔ variante Idris, Blindage ↔
Micro-Blindage (Verney).

| Amélioration | Coût | Empl. | Note |
|---|---|---|---|
| Arceaux | 4 | 1 | ignore les dégâts de tonneau |
| Bélier | 4 | 1 | +2 dés en éperonnage, orientation requise |
| Bélier (Slime) | 4 | 0 | variante Slime |
| Bélier Explosif | 3 | 0 | premier éperonnage +6 dés, orientation requise |
| Blindage | 4 | 1 | +2 carrosserie, cumulable |
| Catapulte Improvisée | 2 | 1 | portée étendue des armes largables |
| Chenilles | 4 | 1 | +1 manœuvrabilité, tout-terrain |
| Membre d'Équipage Supplémentaire | 4 | 0 | +1 équipier |
| Membre d'Équipage Supplémentaire (Scarlett) | 2 | 0 | Scarlett |
| Nitro | 6 | 0 | accélération forcée |
| Nitro (Idris) | 3 | 0 | Idris, danger plafonné à 3 |
| Réacteur Nucléaire Expérimental | 5 | 0 | Mishkin |
| Téléporteur Expérimental | 7 | 0 | Mishkin |
| Mégaphone | 2 | 0 | La Patrouille de l'Autoroute |
| Micro-Blindage | 6 | 0 | Verney |
| Remorque de Transport | 0 | 0 | Rusty |
| Remorque Légère | 4 | 0 | Rusty |
| Remorque Moyenne | 8 | 0 | Rusty, +1 emplacement |
| Remorque Lourde | 12 | 0 | Rusty, +3 emplacements, véhicules Lourds |

**Remorques** : Moyenne et Lourde augmentent réellement la capacité en emplacements, et sont mutuellement
exclusives (« une seule remorque », p.170). Limitation connue : Légère et de Transport n'ont aucun
comportement déclaré et échappent à ce contrôle.

### Équipement intégré

Présent dès la création, gratuit, **non retirable**, hors budget et hors emplacements, badge « Intégré » :

| Véhicule | Équipement intégré |
|---|---|
| Buggy | Arceaux (amélioration) |
| Char d'assaut | Canon de 125mm sur Tourelle (arme) |

Marqué `estDefaut = true`, inséré par `AddVehicleUseCase` (et à l'achat en atelier) depuis
`ameliorations_defaut`/`arme_defaut` du catalogue. Le retrait est refusé par l'agrégat (400).

### Avantages de véhicule

72 avantages en 12 catégories de 6 (Agression, Audace, Dur à Cuire, Horreur, Mécanique, Militaire,
Optimisation, Poursuite, Précision, Rapidité, Technologie, Trompe-la-Mort). Se comportent comme des
améliorations (achat, retrait, budget), sauf : **aucun emplacement**, **jamais d'orientation**,
**unicité** par véhicule.

- **Accès** : chaque sponsor a exactement 2 catégories (`Sponsor.classes_avantage`) ; un avantage est
  disponible si sa `categorie` en fait partie (aucun `sponsors_autorises` sur les avantages).
- **Comportement mécanique** : 69 sont descriptifs. Exceptions :

| Avantage | Catégorie | Effet |
|---|---|---|
| Expertise | Précision | +1 Manœuvrabilité permanent |
| Cascadeur | Audace | véhicule Léger ou Moyen, Manœuvrabilité **effective** (après bonus déjà montés) ≥ 3 |
| Sur Deux Roues | Optimisation | Manœuvrabilité effective ≥ 3 |

- **Revente en atelier : perte totale** (aucun remboursement), cf. [CAMPAIGN.md](CAMPAIGN.md#annulation-dachat-vs-revente).

---

## Modèles de données

### Catalogue (en mémoire, pas en base de données)

- **`Sponsor`** : `nom`, `description`, `classes_avantage[2]`, `avantages_sponsorises`, `vehicules[]`, `armes[]`, `ameliorations[]`, `avantages[]`.
- **`Vehicule`** : `nom`, `nom_interne`, `poids`, `carrosserie`, `manoeuvrabilite`, `vitesse_max`, `equipage`, `emplacements`, `prix`, `description`, `regles`, `sponsors_autorises[]`, `ameliorations_defaut[]`, `arme_defaut?`.
- **`Arme`** : `nom`, `nom_interne`, `type`, `prix`, `emplacement`, `description`, `regles`, `sponsors_autorises[]`, `montable_tourelle?`, `necessite_orientation`, `munitions?`, `effet_court?`.
- **`Amelioration`** : comme `Arme` sans `type`/`montable_tourelle`, plus `comportement?`.
- **`Avantage`** : `nom`, `nom_interne`, `categorie`, `prix`, `description`, `regles`, `comportement?`, `effet_court?` (ni emplacement, ni orientation, ni munitions, ni sponsors).

`munitions` (armes ; améliorations à usage limité : Bélier Explosif, Nitro et variante) et `effet_court`
(4 catalogues d'équipement, séquelles comprises) n'alimentent que la colonne « Effet » de la fiche
d'équipe ; aucune règle n'en dépend, une entrée sans `effet_court` affiche seulement le renvoi de règle.

### `Vehicle` (table)

| Champ | Type | Contraintes |
|---|---|---|
| `id` | number | PK |
| `nomInterne` | string | réf. `Vehicule.nom_interne`, **immuable** |
| `nom` | string \| null | nom personnalisé, `null` tant que jamais renommé (cf. Construction) |
| `teamId` | number | FK → Team `CASCADE` |
| `createdAt` | Date | auto |

Renommable à tout moment (cf. [CAMPAIGN.md](CAMPAIGN.md#renommage-dun-véhicule-en-atelier) pour
l'atelier), sauf si l'équipe est verrouillée hors phase Atelier.

### `Weapon` (table)

| Champ | Type | Contraintes |
|---|---|---|
| `id` | number | PK |
| `nomInterne` | string | réf. `Arme.nom_interne` |
| `orientation` | `avant \| arrière \| lateral \| tourelle` \| null | obligatoire si `necessite_orientation`, sinon `null` ; choisie à l'achat, immuable |
| `estDefaut` | boolean | arme intégrée (non retirable) |
| `vehicleId` | number | FK `CASCADE` |
| `createdAt` | Date | auto |

### `VehicleImprovement` / `VehicleAdvantage` (tables)

Comme `Weapon` (`nomInterne`, `vehicleId`, `createdAt`). `VehicleImprovement` a `orientation`
(3 valeurs, jamais `tourelle`) et `estDefaut` ; `VehicleAdvantage` n'a ni l'un ni l'autre.

**Champs calculés des DTO** (getters de l'entité) :
- `prix` : `0` si `estDefaut` ; arme ×3 sur tourelle ; prix résiduel une fois vendue (arme/amélioration) ;
  avantage toujours au prix plein.
- `emplacement` : `0` si intégré, perdu ou vendu (emplacement libéré), valeur catalogue sinon - lu tel
  quel par l'IHM.

---

## API Endpoints

### Catalogue (public)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/catalog/sponsors` | sponsors avec leurs véhicules/armes/améliorations/avantages |
| GET | `/api/catalog/sponsors/:nom` | un sponsor (nom URL-encodé, 404 si inconnu) |
| GET | `/api/catalog/vehicules` \| `armes` \| `ameliorations` \| `avantages` | catalogue complet de chaque type |

### Véhicules et équipement (JWT)

| Méthode | Route | Description |
|---|---|---|
| GET / POST | `/api/teams/:id/vehicles` | véhicules d'une équipe / ajouter un véhicule (validé contre le sponsor) |
| GET | `/api/vehicles/:id` | détail monté (stats + récapitulatif) |
| PATCH | `/api/vehicles/:id/name` | renommer (`{ nom }`), 400 si l'équipe est verrouillée |
| DELETE | `/api/vehicles/:id` | supprimer (cascade sur l'équipement) |
| GET | `/api/vehicles/:id/available-{weapons,improvements,advantages}` | disponibilités avec verdict (`description`, `regles`, `montableSurTourelle` pour les armes) |
| POST | `/api/vehicles/:id/weapons` | ajouter une arme (`orientation?`, dont `'tourelle'`) |
| DELETE | `/api/weapons/:id` | retirer une arme (400 si intégrée) |
| POST / DELETE | `/api/vehicles/:id/improvements[/:improvementId]` | ajouter / retirer une amélioration (400 si intégrée) |
| POST / DELETE | `/api/vehicles/:id/advantages[/:advantageId]` | ajouter / retirer un avantage |

Pas de `PUT /api/vehicles/:id` : le type est immuable ; « modifier un véhicule » = gérer son
équipement, plus la route dédiée de renommage.
