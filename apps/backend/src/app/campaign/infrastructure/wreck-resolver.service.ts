import { Injectable } from '@nestjs/common';
import { WreckOutcome } from '../domain/wreck/wreck-outcome';
import { WreckResult } from '../domain/enums/wreck-result.enum';
import type { Vehicle } from '../../team/domain/vehicle';

/**
 * Service de résolution de la Table des Épaves (Gaslands, p.168).
 *
 * Lance le D6 côté serveur (D-S9 — déterminisme du replay) et consulte la table
 * pour produire un `WreckOutcome`. Le use case `WreckResolveUseCase` convertit ce
 * résultat en `WreckResolvedEvent` + éventuellement `WeaponLostEvent`/`VehicleLostEvent`.
 *
 * Table des Épaves :
 *   Tirage modifié = D6 + Chocs actuels + modificateur de poids (Léger +1, Lourd -1)
 *
 *   ≤ 3 : Épargné       — CHOCS_GAGNE(0)
 *   4–5  : +1 Choc       — CHOCS_GAGNE(1)
 *   6–7  : +2 Chocs      — CHOCS_GAGNE(2)
 *   8–9  : Arme arrachée — ARME_PERDUE
 *   10+  : Épave         — EPAVE (véhicule perdu)
 */
@Injectable()
export class WreckResolverService {
  /**
   * Résout la Table des Épaves pour un véhicule.
   *
   * @param vehicle - Véhicule épave (le poids et les chocs sont lus depuis l'agrégat).
   * @param weaponIdChoice - Arme choisie par le joueur si le résultat est ARME_PERDUE.
   *                         Null si le joueur n'a pas encore choisi (pas encore demandé).
   * @returns WreckOutcome — Value Object consommé par le use case pour créer les événements.
   */
  resolve(vehicle: Vehicle, weaponIdChoice: number | null = null): WreckOutcome {
    const diceRoll = this.rollD6();
    const weightModifier = this.weightModifier(vehicle.type.poids);
    const modifiedRoll = diceRoll + vehicle.chocs + weightModifier;

    const { result, chocsGained } = this.lookupTable(modifiedRoll);

    const weaponLostId = result === WreckResult.ARME_PERDUE ? weaponIdChoice : null;

    return new WreckOutcome(vehicle.id, diceRoll, vehicle.chocs, result, chocsGained, weaponLostId);
  }

  // ── Table et helpers ──────────────────────────────────────────────────────────

  private lookupTable(modifiedRoll: number): { result: WreckResult; chocsGained: number } {
    if (modifiedRoll <= 3) return { result: WreckResult.CHOCS_GAGNE, chocsGained: 0 };
    if (modifiedRoll <= 5) return { result: WreckResult.CHOCS_GAGNE, chocsGained: 1 };
    if (modifiedRoll <= 7) return { result: WreckResult.CHOCS_GAGNE, chocsGained: 2 };
    if (modifiedRoll <= 9) return { result: WreckResult.ARME_PERDUE, chocsGained: 0 };
    return { result: WreckResult.EPAVE, chocsGained: 0 };
  }

  private weightModifier(poids: string): number {
    if (poids === 'Léger') return 1;
    if (poids === 'Lourd') return -1;
    return 0; // Moyen
  }

  /** Lancer de dé D6 côté serveur — garantit le déterminisme du replay (D-S9). */
  protected rollD6(): number {
    return Math.floor(Math.random() * 6) + 1;
  }
}
