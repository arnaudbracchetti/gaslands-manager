import type { SequellaType } from './value-objects/sequella-type';
import { DomainException } from '../../shared/domain/domain-exception';
import { resolveSequellaBehavior } from './behaviors/sequella-behaviors';
import type { VehicleStats } from './behaviors/equipment-behavior';

/**
 * Une séquelle acquise sur un véhicule d'équipe (mode campagne). Entité enfant de
 * Vehicle, lui-même entité enfant de l'agrégat Team. Miroir d'`Advantage` : pas
 * d'orientation, pas d'emplacement, prix jamais réduit à la revente (perte totale) —
 * seule différence, la monnaie est le Choc du véhicule, pas le Jerrican de l'équipe.
 */
export class Sequella {
  private _isSold = false;

  constructor(
    readonly id: number,
    readonly type: SequellaType,
  ) {}

  /**
   * Contrairement à `Weapon`/`Improvement`, ce coût ne baisse JAMAIS avec la revente —
   * même mécanisme "perte totale" qu'`Advantage.price` : revendre une séquelle en
   * atelier ne rembourse rien.
   */
  get price(): number {
    return this.type.chocsCost;
  }

  /** Perte totale — miroir d'`Advantage.resaleRefund`, cf. sa doc. */
  get resaleRefund(): number {
    if (this._isSold) {
      throw new DomainException('Cette séquelle est déjà vendue — son remboursement a déjà été calculé et crédité.');
    }
    return 0;
  }

  get isSold(): boolean {
    return this._isSold;
  }

  /**
   * Effet pur sur le profil accumulé jusque-là (Strategy GoF, cf.
   * `domain/behaviors/sequella-behaviors.ts`) — délègue au comportement résolu depuis
   * `type.nomInterne` (les séquelles n'ont pas de champ `comportement`). Pas de
   * `canPlace` symétrique : une séquelle n'est jamais validée via ce mécanisme
   * (`Vehicle.canAddSequella` reste indépendant, cf. sa doc) — asymétrie volontaire,
   * pas un oubli.
   */
  applyStats(current: VehicleStats): VehicleStats {
    return resolveSequellaBehavior(this.type.nomInterne).applyStats(current);
  }

  /** Idempotent : marquer une séquelle déjà vendue n'a pas d'effet supplémentaire. */
  markSold(): void {
    this._isSold = true;
  }

  clearSold(): void {
    this._isSold = false;
  }
}
