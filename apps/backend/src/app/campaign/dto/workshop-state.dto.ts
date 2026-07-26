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
  /** Emplacements consommés (résiduel) — `0` si estDefaut/isLost/isSold, valeur catalogue
   *  sinon. Résolu côté backend (`Weapon.slots`), mirroir de `WorkshopImprovementDto.emplacement`. */
  emplacement: number;
  /** Intégrée au profil de base du véhicule (ex. Canon de 125mm du Char d'assaut). */
  estDefaut: boolean;
  isLost: boolean;
  /** Vendue (revente pré-existante, moitié prix) — reste visible, barrée, côté IHM. */
  isSold: boolean;
  /** Achetée pendant la session d'atelier en cours — retrait = annulation, pas revente. */
  purchasedThisSession: boolean;
  /** Montant recrédité si cette arme est revendue MAINTENANT (moitié prix arrondi à
   *  l'inférieur) — `0` si déjà vendue/perdue/estDefaut (non pertinent dans ces cas :
   *  ces lignes n'apparaissent jamais dans `SellVehicleModal`). Non pertinent non plus
   *  si `purchasedThisSession=true` (annulation intégrale, pas revente par élément). */
  resaleRefund: number;
}

export interface WorkshopSequellaDto {
  id: number;
  nomInterne: string;
  nom: string;
  /** Coût en Chocs (monnaie du véhicule, distincte de la cagnotte) — jamais réduit à la revente. */
  chocsCost: number;
  /** ATELIER (achat volontaire) ou TABLE_EPAVES (imposée par un tirage, jamais achetable). */
  origine: 'ATELIER' | 'TABLE_EPAVES';
  /** Vendue (revente, toujours 0 remboursement) — reste visible, barrée, côté IHM. */
  isSold: boolean;
  /** Achetée pendant la session d'atelier en cours — retrait = annulation, pas revente. */
  purchasedThisSession: boolean;
  /** Phrase d'ambiance courte — cf. `SequellaType.description`. Contrairement aux armes/
   *  améliorations/avantages, une séquelle n'a pas de catalogue résolu par sponsor côté
   *  frontend (`Sequelle` n'a aucune relation avec `Sponsor`) : ce texte doit être porté
   *  ici pour que le détail d'une séquelle déjà montée (y compris `TABLE_EPAVES`, jamais
   *  exposée par le catalogue d'achat atelier) reste consultable côté IHM. */
  description: string;
  /** Effet mécanique précis (Markdown→HTML) — cf. `SequellaType.regles`, même raison que `description`. */
  regles: string;
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
  /** Montant recrédité si cette amélioration est revendue MAINTENANT — même règle et
   *  mêmes cas à `0` que `WorkshopWeaponDto.resaleRefund`. */
  resaleRefund: number;
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
  /** Toujours `0` (perte totale à la revente, cf. `Advantage.resaleRefund`) — exposé par
   *  cohérence avec `WorkshopWeaponDto`/`WorkshopImprovementDto.resaleRefund` plutôt que
   *  supposé implicitement côté frontend. */
  resaleRefund: number;
}

export interface WorkshopVehicleDto {
  id: number;
  nomInterne: string;
  /** Nom affiché — personnalisé ou nom du type catalogue, formaté "Nom (Type)" si différent (cf. `Vehicle.nom`). */
  nom: string;
  /** Valeur brute du nom personnalisé, `null` si jamais renommé — pour pré-remplir un champ d'édition. */
  customName: string | null;
  price: number;
  isLost: boolean;
  chocs: number;
  sequellas: WorkshopSequellaDto[];
  weapons: WorkshopWeaponDto[];
  improvements: WorkshopImprovementDto[];
  advantages: WorkshopAdvantageDto[];
  /** Montant qui serait remboursé à la revente (règle par élément — cf. `Vehicle.resaleRefund`).
   *  Non pertinent si `purchasedThisSession=true` : dans ce cas, le retrait est une
   *  annulation intégrale (100 %), pas une revente à moitié prix. */
  resaleRefund: number;
  /** Montant recrédité pour le seul châssis si ce véhicule est revendu — cf.
   *  `Vehicle.chassisResaleRefund`. Même non-pertinence que `resaleRefund` si
   *  `purchasedThisSession=true`. */
  chassisResaleRefund: number;
  /** Acheté pendant la session d'atelier en cours — retrait = annulation intégrale, pas revente. */
  purchasedThisSession: boolean;
  /**
   * Capacité totale EFFECTIVE en emplacements — base catalogue + bonus des améliorations
   * montées qui l'augmentent (Remorque Moyenne +1, Remorque Lourde +3, cf.
   * `Vehicle.effectiveStats`). Mirroir de `VehicleDto.emplacementsTotal` (module `team`).
   */
  emplacementsTotal: number;
}

export interface WorkshopStateDto {
  participantId: number;
  /** Sponsor de l'équipe engagée — permet au frontend de charger le catalogue filtré. */
  sponsor: string;
  wallet: number;
  championshipPoints: number;
  vehicles: WorkshopVehicleDto[];
}
