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
  /** Vendue (revente pré-existante, moitié prix) — reste visible, barrée, côté IHM. */
  isSold: boolean;
  /** Achetée pendant la session d'atelier en cours — retrait = annulation, pas revente. */
  purchasedThisSession: boolean;
}

export interface WorkshopAdvantageDto {
  id: number;
  nomInterne: string;
  price: number;
  /** Vendu (revente pré-existante) — reste visible, barré, côté IHM. Contrairement à
   *  une arme/amélioration, `price` ne baisse jamais (perte totale, cf. `Advantage.price`). */
  isSold: boolean;
  /** Acheté pendant la session d'atelier en cours — retrait = annulation, pas revente. */
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
}

export interface WorkshopStateDto {
  participantId: number;
  /** Sponsor de l'équipe engagée — permet au frontend de charger le catalogue filtré. */
  sponsor: string;
  wallet: number;
  championshipPoints: number;
  vehicles: WorkshopVehicleDto[];
}
