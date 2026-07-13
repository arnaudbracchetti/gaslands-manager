import type { ImprovementType } from './value-objects/improvement-type';
import type { Orientation } from './team';
import { DomainException } from '../../shared/domain/domain-exception';
import { resolveImprovementBehavior } from './behaviors/improvement-behaviors';
import type { VehicleStats } from './behaviors/equipment-behavior';

/**
 * Une amélioration montée sur un véhicule d'équipe (instance de jeu).
 * Entité enfant de Vehicle, lui-même entité enfant de l'agrégat Team.
 */
export class Improvement {
  private _isLost = false;
  private _isSold = false;

  constructor(
    readonly id: number,
    readonly type: ImprovementType,
    readonly orientation: Orientation | null,
    readonly estDefaut: boolean,
  ) {}

  /**
   * Prix résiduel une fois vendue : ce qui reste après remboursement à moitié prix
   * (floor), appliqué au prix de base normalement calculé (estDefaut inchangé).
   * floor(X/2) remboursé + ceil(X/2) résiduel = X.
   */
  get price(): number {
    if (this.estDefaut) return 0;
    return this._isSold ? Math.ceil(this.type.price / 2) : this.type.price;
  }

  /**
   * Montant remboursé si cette amélioration est revendue MAINTENANT (avant tout appel
   * à `markSold()`) — moitié prix arrondie à l'inférieur (p.170), même raisonnement
   * que `Weapon.resaleRefund` (garde `isSold` comprise, cf. sa doc).
   */
  get resaleRefund(): number {
    if (this._isSold) {
      throw new DomainException('Cette amélioration est déjà vendue — son remboursement a déjà été calculé et crédité.');
    }
    return Math.floor(this.price / 2);
  }

  /**
   * Emplacements occupés par cette amélioration.
   * Retourne 0 si l'amélioration est perdue (Table des Épaves, ligne ARRACHEE) OU vendue
   * — même raisonnement que `Weapon.slots` : l'emplacement est libéré, le prix ne
   * s'annule jamais complètement (résiduel pour la vente, inchangé pour la perte).
   */
  get slots(): number {
    if (this.estDefaut || this._isLost || this._isSold) return 0;
    return this.type.slots;
  }

  /**
   * Effet pur sur le profil accumulé jusque-là (Strategy GoF, cf.
   * `domain/behaviors/improvement-behaviors.ts`) — délègue au comportement résolu
   * depuis `type.comportement`. Contrairement à `canPlace` (porté par `ImprovementType`,
   * nécessaire avant même qu'une instance existe), cette méthode vit ici : elle
   * s'applique toujours à une amélioration déjà montée, une instance existe donc
   * systématiquement (cf. `Vehicle.effectiveStats`, qui ne l'invoque que sur les
   * améliorations actives, `!isSold && !isLost`).
   */
  applyStats(current: VehicleStats): VehicleStats {
    return resolveImprovementBehavior(this.type.comportement).applyStats(current);
  }

  get isLost(): boolean {
    return this._isLost;
  }

  get isSold(): boolean {
    return this._isSold;
  }

  /** Idempotent : marquer une amélioration déjà perdue n'a pas d'effet supplémentaire. */
  markLost(): void {
    this._isLost = true;
  }

  clearLost(): void {
    this._isLost = false;
  }

  /** Idempotent : marquer une amélioration déjà vendue n'a pas d'effet supplémentaire. */
  markSold(): void {
    this._isSold = true;
  }

  clearSold(): void {
    this._isSold = false;
  }

  /** Remet l'état campagne à zéro — appelé par Vehicle/Team.clearCampaignState() au début du replay. */
  clearCampaignState(): void {
    this._isLost = false;
    this._isSold = false;
  }
}
