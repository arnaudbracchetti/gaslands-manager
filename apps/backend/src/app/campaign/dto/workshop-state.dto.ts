import type { WreckResult } from '../domain/enums/wreck-result.enum';

/**
 * État campagne de l'atelier d'un participant — exposé par `GET /campaigns/:id/workshop`.
 *
 * Construit après `loadAndReplay` : contient les entités transientes (achats d'atelier)
 * et les effets accumulés (perte, chocs, séquelles). `resistancePoints` est exclu (D-S4).
 */
export interface WorkshopWeaponDto {
  id: number;
  nomInterne: string;
  orientation: string | null;
  price: number;
  isLost: boolean;
}

export interface WorkshopSequellaDto {
  nomInterne: string;
  nom: string;
  chocsCost: number;
}

export interface WorkshopImprovementDto {
  id: number;
  nomInterne: string;
  orientation: string | null;
  price: number;
  /** Emplacements catalogue de l'amélioration — utilisé par le calcul de slots côté IHM. */
  emplacement: number;
  estDefaut: boolean;
  isLost: boolean;
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
}

export interface WorkshopStateDto {
  participantId: number;
  /** Sponsor de l'équipe engagée — permet au frontend de charger le catalogue filtré. */
  sponsor: string;
  wallet: number;
  championshipPoints: number;
  vehicles: WorkshopVehicleDto[];
}
