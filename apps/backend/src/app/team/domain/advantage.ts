import type { AdvantageType } from './value-objects/advantage-type';

/**
 * Un avantage acquis sur un véhicule d'équipe (instance de jeu). Entité enfant de
 * Vehicle, lui-même entité enfant de l'agrégat Team. Miroir d'`Improvement`, en plus
 * simple : pas d'orientation (jamais requise), pas d'`estDefaut` (aucun véhicule du
 * catalogue n'a d'avantage intégré à son profil de base).
 */
export class Advantage {
  private _isSold = false;

  constructor(
    readonly id: number,
    readonly type: AdvantageType,
  ) {}

  /**
   * Contrairement à `Weapon`/`Improvement`, ce prix ne baisse JAMAIS avec la revente :
   * c'est le mécanisme "perte totale" (revendre un avantage en atelier ne rembourse
   * rien). Comme `Vehicle.cost` somme les `price` sans condition, ne jamais réduire ce
   * getter suffit à garantir que le budget/cagnotte ne récupère rien à la vente — aucun
   * calcul de remboursement séparé n'est nécessaire.
   */
  get price(): number {
    return this.type.price;
  }

  /**
   * Perte totale — revendre un avantage ne rembourse jamais rien (contrairement à
   * `Weapon.resaleRefund`/`Improvement.resaleRefund`, moitié prix). Découle directement
   * du fait que `price` ci-dessus ne baisse jamais avec `isSold` : aucun second calcul
   * de remboursement n'est nécessaire, ce getter documente juste la règle explicitement
   * là où `Game.resolveSell` en a besoin.
   */
  get resaleRefund(): number {
    return 0;
  }

  /** Toujours 0 — un avantage n'occupe jamais d'emplacement. */
  get slots(): number {
    return 0;
  }

  get isSold(): boolean {
    return this._isSold;
  }

  /** Idempotent : marquer un avantage déjà vendu n'a pas d'effet supplémentaire. */
  markSold(): void {
    this._isSold = true;
  }

  clearSold(): void {
    this._isSold = false;
  }

  /** Remet l'état campagne à zéro — appelé par Vehicle/Team.clearCampaignState() au début du replay. */
  clearCampaignState(): void {
    this._isSold = false;
  }
}
