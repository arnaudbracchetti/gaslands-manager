import { Injectable } from '@nestjs/common';
import { WreckOutcome, type LostEquipment } from '../domain/wreck/wreck-outcome';
import type { Vehicle } from '../../team/domain/vehicle';

/**
 * Service de résolution de la Table des Épaves (Gaslands, p.168).
 *
 * Responsabilité d'infrastructure réduite au strict aléa : lancer le D6 côté serveur
 * (D-S9 — déterminisme du replay) et, si la ligne obtenue l'exige, tirer au hasard
 * l'équipement perdu — puis déléguer la RÈGLE de la Table des Épaves au domaine
 * (`WreckOutcome.fromRoll`). Le use case convertit ensuite le `WreckOutcome` en
 * `WreckResolvedEvent` (+ éventuellement `WeaponLostEvent`/`ImprovementLostEvent`/
 * `SequellaAddedEvent`/`VehicleLostEvent`/`FavoriDuPublicBonusEvent`).
 *
 * Toute perte d'équipement est un tirage aléatoire serveur — jamais un choix de
 * l'organisateur (correction actée : la perte d'arme comme d'amélioration est aléatoire).
 */
@Injectable()
export class WreckResolverService {
  /**
   * Résout la Table des Épaves pour un véhicule.
   *
   * @param vehicle - Véhicule épave (poids, chocs, armes et améliorations lus depuis
   *                  l'agrégat).
   * @returns WreckOutcome — Value Object consommé par le use case pour créer les événements.
   */
  resolve(vehicle: Vehicle): WreckOutcome {
    const diceRoll = this.rollD6();
    const pool: NonNullable<LostEquipment>[] = [
      ...vehicle.weapons.filter((w) => !w.isLost).map((w) => ({ kind: 'weapon' as const, id: w.id })),
      ...vehicle.improvements
        .filter((i) => !i.estDefaut && !i.isLost)
        .map((i) => ({ kind: 'improvement' as const, id: i.id })),
    ];
    const lostEquipment = pool.length > 0 ? this.pickRandom(pool) : null;
    return WreckOutcome.fromRoll(vehicle.id, vehicle.type.poids, vehicle.chocs, diceRoll, lostEquipment);
  }

  /** Lancer de dé D6 côté serveur — garantit le déterminisme du replay (D-S9). */
  protected rollD6(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  /** Tirage aléatoire dans le pool armes+améliorations — même besoin de déterminisme en test que `rollD6()`. */
  protected pickRandom<T>(pool: T[]): T {
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }
}
