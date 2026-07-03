import { Injectable } from '@nestjs/common';
import { WreckOutcome } from '../domain/wreck/wreck-outcome';
import type { Vehicle } from '../../team/domain/vehicle';

/**
 * Service de résolution de la Table des Épaves (Gaslands, p.168).
 *
 * Responsabilité d'infrastructure réduite au strict aléa : lancer le D6 côté serveur
 * (D-S9 — déterminisme du replay), puis déléguer la RÈGLE de la Table des Épaves au
 * domaine (`WreckOutcome.fromRoll`). Le use case `WreckResolveUseCase` convertit ensuite
 * le `WreckOutcome` en `WreckResolvedEvent` (+ éventuellement `WeaponLostEvent` /
 * `VehicleLostEvent`).
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
    return WreckOutcome.fromRoll(vehicle.id, vehicle.type.poids, vehicle.chocs, diceRoll, weaponIdChoice);
  }

  /** Lancer de dé D6 côté serveur — garantit le déterminisme du replay (D-S9). */
  protected rollD6(): number {
    return Math.floor(Math.random() * 6) + 1;
  }
}
