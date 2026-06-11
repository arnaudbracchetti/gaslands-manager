/**
 * Interfaces TypeScript pour la construction de véhicules (frontend).
 *
 * Miroir des entités/DTOs du backend (`vehicle/`, `weapon/`) — exactement la
 * forme des corps de requête et des réponses JSON échangés avec l'API. Comme
 * `catalog.model.ts`, c'est une discipline manuelle (pas de code partagé entre
 * back et front, cf. ARCHITECTURE.md §1) : chaque renommage côté backend doit
 * se répercuter ici.
 *
 * Séparation DTO vs entité — même principe que `team.model.ts` :
 * - `Vehicle`/`VehicleImprovement`/`Weapon` : ce que l'API RETOURNE (avec id, timestamps)
 * - `CreateVehicleDto`/`AddImprovementDto`/`AddWeaponDto` : ce qu'on ENVOIE pour créer
 * - `AvailableImprovementDto`/`AvailableWeaponDto` : catalogue filtré + verdict de pose
 */

/**
 * Orientation directionnelle — miroir de `Orientation` (backend `vehicle-build.ts`).
 * Réutilisée à l'identique pour les améliorations ET les armes (les 4 arcs de
 * tir standard de Gaslands, cf. SPECIFICATION.md §5).
 */
export type Orientation = 'avant' | 'arrière' | 'gauche' | 'droite';

/**
 * Une amélioration installée — miroir de `VehicleImprovementDto` (backend).
 * `orientation` est `null` pour les améliorations non-orientées (convention API
 * identique au backend — pas de conversion `null ↔ undefined` côté frontend :
 * cette nuance de vocabulaire reste interne au backend, cf. `VehicleService.getBuild`).
 *
 * `estDefaut`, `prix`, `emplacement` et `weaponNomInterne` sont des champs ajoutés
 * par le backend (`VehicleService.toVehicleDto`) et portent les règles de gestion
 * déjà résolues — le frontend les consomme sans logique propre.
 */
export interface VehicleImprovement {
  id: number;
  nomInterne: string;
  orientation: Orientation | null;
  vehicleId: number;
  createdAt: string;
  /** `true` si l'amélioration fait partie du profil de base du véhicule (non supprimable). */
  estDefaut: boolean;
  /**
   * Prix effectif en Jerricans — toujours un `number` réel :
   * - `0` pour les défauts (`estDefaut`) ou la Tourelle orpheline.
   * - Pour la Tourelle assignée : 3× le prix catalogue de l'arme (coût TOTAL, arme incluse).
   * - Autres améliorations : prix catalogue direct.
   */
  prix: number;
  /** Emplacements consommés — `0` pour les défauts, valeur catalogue sinon. */
  emplacement: number;
  /**
   * Nom interne de l'arme montée sur cette Tourelle (`nomInterne === 'tourelle'`),
   * ou `null` si aucune arme n'est assignée (état orphelin) ou pour toute autre amélioration.
   * Le frontend l'utilise pour fusionner l'affichage en une seule ligne "Arme (Tourelle)".
   */
  weaponNomInterne: string | null;
}

/**
 * Une arme montée — miroir de `WeaponDto` (backend). Structure quasi identique
 * à `VehicleImprovement` ci-dessus (même nuance `orientation`/`null`), avec `prix`
 * calculé côté backend — symétrie intentionnelle avec les améliorations.
 */
export interface Weapon {
  id: number;
  nomInterne: string;
  orientation: Orientation | null;
  vehicleId: number;
  createdAt: string;
  /** Prix de l'arme en Jerricans, résolu depuis le catalogue côté backend. */
  prix: number;
}

/**
 * Un véhicule d'équipe — miroir de `Vehicle` (backend `vehicle.entity.ts`).
 *
 * ⚠️ C'est l'entité BRUTE retournée par les endpoints d'ajout (`create`,
 * `addImprovement`, `addWeapon`) — PAS un DTO enrichi avec `emplacement` résolu
 * pour chaque ligne. `VehicleBuilder` recoupe `improvements[]`/`weapons[]` avec
 * le catalogue déjà chargé (`Sponsor.armes`/`.ameliorations`) pour calculer les
 * emplacements utilisés (cf. plan d'architecture, "points d'attention").
 */
export interface Vehicle {
  id: number;
  nomInterne: string;
  teamId: number;
  improvements: VehicleImprovement[];
  weapons: Weapon[];
  createdAt: string;
}

/** Corps de `POST /api/teams/:teamId/vehicles` — miroir de `CreateVehicleDto`. */
export interface CreateVehicleDto {
  nomInterne: string;
}

/**
 * Corps de `POST /api/vehicles/:id/improvements` — miroir de `AddImprovementDto`.
 * `orientation` optionnelle : ce n'est pas une contrainte de FORME mais une règle
 * de FOND, propre à chaque comportement (cf. doc backend du DTO miroir).
 */
export interface AddImprovementDto {
  nomInterne: string;
  orientation?: Orientation;
}

/**
 * Ligne de `GET /api/vehicles/:id/available-improvements` — miroir de `AvailableImprovementDto`.
 *
 * `prix: number | string` : `Amelioration.prix` vaut `"x3"` pour la Tourelle dans le
 * catalogue — le backend n'a pas encore de prix résolu pour cet item de liste (le prix
 * réel dépend de l'arme choisie, qui n'est connue qu'au moment de l'assignation).
 * Cf. `VehicleImprovement.prix` pour le prix effectif une fois la Tourelle persistée.
 */
export interface AvailableImprovementDto {
  nom: string;
  nomInterne: string;
  prix: number | string;
  emplacement: number;
  /** Description de l'amélioration, reprise du catalogue (`Amelioration.description`). */
  description: string;
  disponible: boolean;
  raison?: string;
}

/**
 * Corps de `POST /api/vehicles/:id/weapons` — miroir de `AddWeaponDto`.
 * Même nuance `orientation` que `AddImprovementDto` ci-dessus, mais avec une
 * lecture OPPOSÉE selon le `type` de l'arme (cf. `AvailableWeaponDto.type`,
 * et `weapon.entity.ts` côté backend pour le détail complet de cette règle).
 */
export interface AddWeaponDto {
  nomInterne: string;
  orientation?: Orientation;
}

/**
 * Ligne de `GET /api/vehicles/:id/available-weapons` — miroir de `AvailableWeaponDto`.
 *
 * `prix: number` (jamais `string`, contrairement à son homologue amélioration) :
 * `Arme.prix` est TOUJOURS un nombre fixe (cf. `catalog.model.ts`, doc de `Arme`).
 * `type` : seul ajout par rapport à `AvailableImprovementDto` — c'est ce qui
 * permet à `VehicleBuilder`/`equipment-option` de savoir, AVANT de tenter
 * l'ajout, si un sélecteur d'orientation doit être affiché (`type !== 'équipage'`).
 */
export interface AvailableWeaponDto {
  nom: string;
  nomInterne: string;
  prix: number;
  emplacement: number;
  type: 'base' | 'avancée' | 'équipage' | 'largable';
  /** Description de l'arme, reprise du catalogue (`Arme.description`). */
  description: string;
  disponible: boolean;
  raison?: string;
}

/**
 * Forme commune à `AvailableWeaponDto` et `AvailableImprovementDto` — exactement
 * ce dont `EquipmentOption` a besoin pour s'afficher (cf. son en-tête, "réutilisable
 * pour armes ET améliorations"). Les deux DTOs ci-dessus sont structurellement
 * compatibles (TypeScript les accepte tels quels — `number` ⊂ `number | string`,
 * et le champ `type` surnuméraire de `AvailableWeaponDto` n'est simplement pas lu
 * par ce sous-composant). Pas de conversion : `VehicleBuilder` passe directement
 * ses tableaux `AvailableWeaponDto[]`/`AvailableImprovementDto[]` en entrée.
 */
export interface EquipmentOption {
  nom: string;
  nomInterne: string;
  prix: number | string;
  emplacement: number;
  /** Description de l'équipement, reprise du catalogue (cf. `AvailableWeaponDto.description`/`AvailableImprovementDto.description`). */
  description: string;
  disponible: boolean;
  raison?: string;
}

/**
 * Choix émis par `EquipmentOption` — miroir exact de `AddWeaponDto`/`AddImprovementDto`
 * (les deux endpoints d'ajout partagent la même forme de corps de requête).
 * `VehicleBuilder` n'a qu'à transmettre cet objet tel quel au service.
 */
export interface EquipmentChoice {
  nomInterne: string;
  orientation?: Orientation;
}
