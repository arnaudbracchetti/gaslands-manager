import { WreckResult } from '../enums/wreck-result.enum';

/**
 * Résultat d'un lancer sur la Table des Épaves — Value Object.
 *
 * Produit par `WreckResolver` (infrastructure, Partie 3) au write-time (D-S9).
 * Le use case convertit cet objet en commandes `WreckResolvedEvent` (+ optionnellement
 * `WeaponLostEvent` / `VehicleLostEvent`) qu'il persiste dans `game_events`.
 */
export class WreckOutcome {
  constructor(
    readonly vehicleId: number,
    readonly diceRoll: number,       // 1–6
    readonly chocsBefore: number,
    readonly wreckResult: WreckResult,
    readonly chocsGained: number,
    readonly weaponLostId: number | null, // renseigné si ARME_PERDUE
  ) {}

  get vehicleIsLost(): boolean {
    return this.wreckResult === WreckResult.EPAVE;
  }

  get weaponIsLost(): boolean {
    return this.wreckResult === WreckResult.ARME_PERDUE && this.weaponLostId !== null;
  }
}
