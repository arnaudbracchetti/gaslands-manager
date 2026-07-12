/**
 * Modèles de l'atelier campagne (frontend) — miroir manuel des DTOs backend
 * (`campaign/dto/workshop-state.dto.ts`, `campaign/dto/change-equipment.dto.ts`).
 *
 * L'atelier réutilise le composant partagé `EquipmentManager`, qui parle en termes
 * de `Vehicle`/`Weapon`/`VehicleImprovement` (modèle "construction d'équipe"). La
 * source atelier expose un état DIFFÉRENT (`WorkshopStateDto` : cagnotte, chocs,
 * séquelles, entités transientes) — `mapWorkshopVehicleToVehicle` traduit un
 * véhicule d'atelier vers la forme attendue par `EquipmentManager`.
 */
import {
  Orientation,
  WeaponOrientation,
  Vehicle,
  VehicleImprovement,
  Weapon,
  VehicleAdvantage,
} from '../teams/vehicle-configurator/vehicle-builder.model';

export interface WorkshopWeaponDto {
  id: number;
  nomInterne: string;
  /** 5 valeurs possibles, dont `'tourelle'` (montage sur Tourelle — arc à 360°, coût
   *  ×3, immuable après achat). */
  orientation: string | null;
  price: number;
  /** Intégrée au profil de base du véhicule (ex. Canon de 125mm du Char d'assaut). */
  estDefaut: boolean;
  isLost: boolean;
  /** Vendue (revente pré-existante, moitié prix) — reste visible, barrée, côté IHM. */
  isSold: boolean;
  /** Achetée pendant la session d'atelier en cours — retrait = annulation, pas revente. */
  purchasedThisSession: boolean;
}

export interface WorkshopImprovementDto {
  id: number;
  nomInterne: string;
  orientation: string | null;
  price: number;
  /** Emplacements catalogue — utilisé par le calcul de slots d'`EquipmentManager`. */
  emplacement: number;
  estDefaut: boolean;
  isLost: boolean;
  /** Vendue (revente pré-existante, moitié prix) — reste visible, barrée, côté IHM. */
  isSold: boolean;
  /** Achetée pendant la session d'atelier en cours — retrait = annulation, pas revente. */
  purchasedThisSession: boolean;
}

export interface WorkshopSequellaDto {
  nomInterne: string;
  nom: string;
  chocsCost: number;
}

export interface WorkshopAdvantageDto {
  id: number;
  nomInterne: string;
  /** Ne baisse jamais avec `isSold` (perte totale à la revente, cf. `Advantage.price`). */
  price: number;
  isSold: boolean;
  purchasedThisSession: boolean;
}

export interface WorkshopVehicleDto {
  id: number;
  nomInterne: string;
  price: number;
  isLost: boolean;
  chocs: number;
  sequellas: WorkshopSequellaDto[];
  weapons: WorkshopWeaponDto[];
  improvements: WorkshopImprovementDto[];
  advantages: WorkshopAdvantageDto[];
  /** Montant qui serait remboursé à la revente (règle par élément) — non pertinent si
   *  `purchasedThisSession=true` (retrait = annulation intégrale, pas revente). */
  resaleRefund: number;
  /** Acheté pendant la session d'atelier en cours — retrait = annulation, pas revente. */
  purchasedThisSession: boolean;
}

export interface WorkshopStateDto {
  participantId: number;
  /** Sponsor de l'équipe engagée — sert à charger le catalogue filtré côté page. */
  sponsor: string;
  wallet: number;
  championshipPoints: number;
  vehicles: WorkshopVehicleDto[];
}

// ── Achat / revente (POST /api/campaigns/:id/events/equipment) ────────────────

export type EquipmentOperation = 'BUY' | 'SELL';
export type EquipmentEntityType = 'VEHICLE' | 'WEAPON' | 'IMPROVEMENT' | 'ADVANTAGE';

/** Corps de `POST /api/campaigns/:id/events/equipment` — miroir de `ChangeEquipmentDto`. */
export interface ChangeEquipmentDto {
  operation: EquipmentOperation;
  entityType: EquipmentEntityType;
  /** Nom interne du catalogue — requis pour BUY, ignoré (chaîne vide) pour SELL. */
  nomInterne: string;
  targetVehicleId?: number | null;
  targetEntityId?: number | null;
  /** WEAPON : 5 valeurs possibles (dont `'tourelle'` — arc à 360°, coût ×3). */
  orientation?: WeaponOrientation | null;
}

/**
 * Traduit un véhicule d'atelier (`WorkshopVehicleDto`) vers l'entité `Vehicle`
 * attendue par `EquipmentManager`. Champs absents de l'atelier synthétisés :
 * `teamId`/`createdAt` (non pertinents ici, `EquipmentManager` ne les lit pas).
 * `price` (atelier) → `prix` (modèle équipe).
 */
export function mapWorkshopVehicleToVehicle(w: WorkshopVehicleDto): Vehicle {
  return {
    id: w.id,
    nomInterne: w.nomInterne,
    teamId: 0,
    createdAt: '',
    weapons: w.weapons.map(
      (x: WorkshopWeaponDto): Weapon => ({
        id: x.id,
        nomInterne: x.nomInterne,
        orientation: x.orientation as WeaponOrientation | null,
        vehicleId: w.id,
        createdAt: '',
        prix: x.price,
        estDefaut: x.estDefaut,
        sold: x.isSold,
        purchasedThisSession: x.purchasedThisSession,
        lost: x.isLost,
      }),
    ),
    improvements: w.improvements.map(
      (x: WorkshopImprovementDto): VehicleImprovement => ({
        id: x.id,
        nomInterne: x.nomInterne,
        orientation: x.orientation as Orientation | null,
        vehicleId: w.id,
        createdAt: '',
        estDefaut: x.estDefaut,
        prix: x.price,
        emplacement: x.emplacement,
        sold: x.isSold,
        purchasedThisSession: x.purchasedThisSession,
        lost: x.isLost,
      }),
    ),
    advantages: w.advantages.map(
      (x: WorkshopAdvantageDto): VehicleAdvantage => ({
        id: x.id,
        nomInterne: x.nomInterne,
        vehicleId: w.id,
        createdAt: '',
        prix: x.price,
        sold: x.isSold,
        purchasedThisSession: x.purchasedThisSession,
      }),
    ),
  };
}
