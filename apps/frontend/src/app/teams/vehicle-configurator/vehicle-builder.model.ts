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
 * Réutilisée à l'identique pour les améliorations ET les armes (les 3 arcs de
 * tir standard de Gaslands, cf. SPECIFICATION.md §5).
 */
export type Orientation = 'avant' | 'arrière' | 'lateral';

/**
 * Orientation d'une arme — les 3 arcs plus `'tourelle'` (montage sur Tourelle, arc à
 * 360°, coût ×3). Distincte d'`Orientation` (utilisée par `VehicleImprovement`, qui
 * ne supporte jamais le montage Tourelle).
 */
export type WeaponOrientation = Orientation | 'tourelle';

/**
 * Une amélioration installée — miroir de `VehicleImprovementDto` (backend).
 * `orientation` est `null` pour les améliorations non-orientées (convention API
 * identique au backend — pas de conversion `null ↔ undefined` côté frontend :
 * cette nuance de vocabulaire reste interne au backend, cf. `VehicleService.getBuild`).
 *
 * `estDefaut`, `prix` et `emplacement` sont des champs ajoutés par le backend
 * (`VehicleService.toVehicleDto`) et portent les règles de gestion déjà résolues —
 * le frontend les consomme sans logique propre.
 */
export interface VehicleImprovement {
  id: number;
  nomInterne: string;
  orientation: Orientation | null;
  vehicleId: number;
  createdAt: string;
  /** `true` si l'amélioration fait partie du profil de base du véhicule (non supprimable). */
  estDefaut: boolean;
  /** Prix effectif en Jerricans — `0` pour les défauts (`estDefaut`), prix catalogue sinon. */
  prix: number;
  /** Emplacements consommés — `0` pour les défauts, valeur catalogue sinon. */
  emplacement: number;
  /**
   * Champs propres à l'atelier campagne (mode campagne, annulation vs revente) — jamais
   * posés par `TeamEquipmentDataSource` (construction d'équipe), toujours `undefined` dans
   * ce contexte (`!undefined === true`, aucune régression). `sold` : revente d'un objet
   * pré-existant (moitié prix, reste visible barré). `purchasedThisSession` : achetée
   * pendant la session d'atelier en cours (retrait = annulation, pas revente).
   */
  sold?: boolean;
  purchasedThisSession?: boolean;
  /** Perdue via la Table des Épaves (atelier uniquement, jamais posé à la construction d'équipe). */
  lost?: boolean;
}

/**
 * Une arme montée — miroir de `WeaponDto` (backend). Structure quasi identique
 * à `VehicleImprovement` ci-dessus (même nuance `orientation`/`null`), avec `prix`
 * calculé côté backend — symétrie intentionnelle avec les améliorations.
 */
export interface Weapon {
  id: number;
  nomInterne: string;
  /**
   * 5 valeurs possibles, dont `'tourelle'` (montage sur Tourelle — arc à 360°, coût
   * ×3, immuable après achat). Pour changer d'arme montée sur Tourelle, on revend
   * celle-ci puis on en achète une nouvelle avec `'tourelle'`.
   */
  orientation: WeaponOrientation | null;
  vehicleId: number;
  createdAt: string;
  /** Prix de l'arme en Jerricans, résolu depuis le catalogue côté backend (×3 si montée sur Tourelle). */
  prix: number;
  /**
   * Emplacements consommés (résiduel), résolu côté backend (`Weapon.slots`) — `0` pour
   * une arme intégrée (`estDefaut`), perdue (`lost`) ou vendue (`sold`), valeur catalogue
   * sinon. Mirroir de `VehicleImprovement.emplacement` : le frontend le lit sans consulter
   * le catalogue (donc sans reperdre l'état vendu/perdu, cf. `MountedEquipment`).
   */
  emplacement: number;
  /** Intégrée au profil de base du véhicule (ex. Canon de 125mm du Char d'assaut). */
  estDefaut: boolean;
  /** Cf. `VehicleImprovement.sold`/`purchasedThisSession`/`lost` — même usage, atelier uniquement. */
  sold?: boolean;
  purchasedThisSession?: boolean;
  lost?: boolean;
}

/**
 * Un avantage acquis — miroir de `VehicleAdvantageDto` (backend). Plus simple que
 * `VehicleImprovement`/`Weapon` : pas d'`orientation` (jamais requise), pas
 * d'`estDefaut`/`emplacement` (un avantage n'occupe jamais de slot).
 */
export interface VehicleAdvantage {
  id: number;
  nomInterne: string;
  vehicleId: number;
  createdAt: string;
  /** Prix en Jerricans — ne baisse JAMAIS avec `sold` (perte totale à la revente,
   *  contrairement à `VehicleImprovement.prix`/`Weapon.prix`). */
  prix: number;
  /** Cf. `VehicleImprovement.sold`/`purchasedThisSession` — même usage, atelier uniquement. */
  sold?: boolean;
  purchasedThisSession?: boolean;
  /** Perdue via la Table des Épaves (atelier uniquement, jamais posé à la construction d'équipe). */
  lost?: boolean;
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
  /** Nom affiché — personnalisé ou nom du type catalogue, formaté "Nom (Type)" si différent. */
  nom: string;
  /** Valeur brute du nom personnalisé, `null` si jamais renommé — pour pré-remplir un champ d'édition. */
  customName: string | null;
  teamId: number;
  improvements: VehicleImprovement[];
  weapons: Weapon[];
  advantages: VehicleAdvantage[];
  createdAt: string;
  /**
   * Capacité totale EFFECTIVE en emplacements — base catalogue + bonus des
   * améliorations montées qui l'augmentent (Remorque Moyenne +1, Remorque Lourde
   * +3, cf. backend `Vehicle.effectiveStats`). Toujours résolue côté backend :
   * ne JAMAIS la recalculer depuis le seul catalogue statique (`Vehicule.emplacements`),
   * qui ignore ce bonus.
   */
  emplacementsTotal: number;
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
 */
export interface AvailableImprovementDto {
  nom: string;
  nomInterne: string;
  prix: number;
  emplacement: number;
  /** Description de l'amélioration, reprise du catalogue (`Amelioration.description`). */
  description: string;
  /** Règles détaillées de l'amélioration, reprises du catalogue (`Amelioration.regles`). */
  regles: string;
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
  /** 5 valeurs possibles, dont `'tourelle'` (montage sur Tourelle — arc à 360°, coût ×3). */
  orientation?: WeaponOrientation;
}

/**
 * Ligne de `GET /api/vehicles/:id/available-weapons` — miroir de `AvailableWeaponDto`.
 *
 * `type` : permet à `VehicleBuilder`/`equipment-option` de savoir, AVANT de tenter
 * l'ajout, si un sélecteur d'orientation doit être affiché (`type !== 'équipage'`).
 * `montableSurTourelle` : attribut catalogue de l'arme — pilote l'affichage de la
 * case à cocher « Monter sur Tourelle » dans `EquipmentOption`.
 */
export interface AvailableWeaponDto {
  nom: string;
  nomInterne: string;
  prix: number;
  emplacement: number;
  type: 'base' | 'avancée' | 'équipage' | 'largable';
  /** Description de l'arme, reprise du catalogue (`Arme.description`). */
  description: string;
  /** Règles détaillées de l'arme, reprises du catalogue (`Arme.regles`). */
  regles: string;
  disponible: boolean;
  raison?: string;
  montableSurTourelle: boolean;
}

/** Corps de `POST /api/vehicles/:id/advantages` — miroir de `AddAdvantageDto`. Pas d'orientation. */
export interface AddAdvantageDto {
  nomInterne: string;
}

/**
 * Ligne de `GET /api/vehicles/:id/available-advantages` — miroir de `AvailableAdvantageDto`.
 * Pas de champ `emplacement` (un avantage n'en occupe jamais) — `EquipmentManager` synthétise
 * `emplacement: 0` en construisant l'`EquipmentOption` passé à `<app-equipment-option>`.
 */
export interface AvailableAdvantageDto {
  nom: string;
  nomInterne: string;
  categorie: string;
  prix: number;
  description: string;
  regles: string;
  disponible: boolean;
  raison?: string;
}

/**
 * Forme commune à `AvailableWeaponDto` et `AvailableImprovementDto` — exactement
 * ce dont `EquipmentOption` a besoin pour s'afficher (cf. son en-tête, "réutilisable
 * pour armes ET améliorations"). Les deux DTOs ci-dessus sont structurellement
 * compatibles — les champs surnuméraires (`type`, `montableSurTourelle` de
 * `AvailableWeaponDto`) ne sont simplement pas lus quand l'option est une
 * amélioration. Pas de conversion : `VehicleBuilder` passe directement ses
 * tableaux `AvailableWeaponDto[]`/`AvailableImprovementDto[]` en entrée.
 */
export interface EquipmentOption {
  nom: string;
  nomInterne: string;
  prix: number;
  emplacement: number;
  /** Description de l'équipement, reprise du catalogue (cf. `AvailableWeaponDto.description`/`AvailableImprovementDto.description`). */
  description: string;
  /** Règles détaillées, reprises du catalogue (cf. `AvailableWeaponDto.regles`/`AvailableImprovementDto.regles`). */
  regles: string;
  disponible: boolean;
  raison?: string;
  /** Armes uniquement — absent pour une amélioration. */
  montableSurTourelle?: boolean;
}

/**
 * Choix émis par `EquipmentOption` — miroir exact de `AddWeaponDto`/`AddImprovementDto`
 * (les deux endpoints d'ajout partagent la même forme de corps de requête).
 * `VehicleBuilder` n'a qu'à transmettre cet objet tel quel au service.
 */
export interface EquipmentChoice {
  nomInterne: string;
  /** Armes : 4 valeurs possibles, dont `'tourelle'` (×3). Améliorations : 3 valeurs. */
  orientation?: WeaponOrientation;
}
