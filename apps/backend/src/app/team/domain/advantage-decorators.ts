/**
 * Décorateurs d'avantages de véhicule (Pattern Decorator du GoF).
 *
 * Réutilise l'infrastructure `ImprovementDecorator`/`VehicleBuild` déjà en place pour
 * les améliorations (`vehicle-build.ts`, `improvement-decorators.ts`) plutôt qu'une
 * chaîne séparée — précédent direct : `sequella-decorators.ts` (séquelles de campagne)
 * étend déjà `ImprovementDecorator` en construisant un objet `Amelioration` FACTICE dans
 * son constructeur, pour un concept hors catalogue `amelioration.yml`. Les avantages
 * reprennent exactement ce schéma.
 *
 * Différence avec `SequellaDecorator` : PAS d'override de `validate()`. Le contrôle
 * générique d'emplacements (`ImprovementDecorator.validateGenerique`) reste actif — il
 * est simplement toujours trivialement vrai puisque `emplacement: 0` — afin de garder
 * `validateSelf()` opérationnel pour Cascadeur/Sur Deux Roues (règles de pose réelles,
 * contrairement aux séquelles qui sont validées ailleurs, au write-time).
 *
 * Réutiliser la même chaîne que les améliorations (plutôt qu'une chaîne séparée) est ce
 * qui permet à Cascadeur/Sur Deux Roues de lire la Manœuvrabilité EFFECTIVE du véhicule
 * (`this.stats.manoeuvrabilite`, qui inclut déjà les bonus de Chenilles ou d'un autre
 * avantage comme Expertise, déjà montés plus bas dans la chaîne).
 */

import {
  ImprovementDecorator,
  ok,
  fail,
  type RuleResult,
  type VehicleStats,
  type VehicleBuild,
  type InstalledImprovement,
} from './vehicle-build';
import type { Amelioration, Avantage } from '../../catalog/catalog.interfaces';

// ── Base commune ──────────────────────────────────────────────────────────────

/**
 * Classe de base pour tous les décorateurs d'avantage.
 * Construit un objet `Amelioration` factice depuis l'`Avantage` réel (emplacement = 0,
 * pas de sponsors_autorises ni d'orientation) pour satisfaire l'interface de
 * `ImprovementDecorator` — les avantages ne font pas partie du catalogue `amelioration.yml`.
 */
export abstract class AdvantageDecorator extends ImprovementDecorator {
  constructor(inner: VehicleBuild, avantage: Avantage, instance: InstalledImprovement) {
    const amelioration: Amelioration = {
      nom: avantage.nom,
      nom_interne: avantage.nom_interne,
      prix: avantage.prix,
      emplacement: 0,
      description: avantage.description,
      regles: avantage.regles,
      sponsors_autorises: [],
      necessite_orientation: false,
    };
    super(inner, amelioration, instance);
  }
}

// ── Décorateur neutre : avantage sans effet de profil ni règle de pose ────────

/**
 * Décorateur "par défaut" pour tout avantage dont le catalogue ne déclare AUCUN
 * `comportement` (69 des 72 avantages — purement descriptifs, aucun effet sur le
 * profil chiffré du véhicule ni règle de pose particulière). Mirroir de
 * `NeutralDecorator` — corps vide intentionnel.
 */
export class NeutralAdvantageDecorator extends AdvantageDecorator {}

// ── Décorateurs concrets (3 avantages à effet mécanique réel) ──────────────────

/** Expertise (Précision) : +1 à la Manœuvrabilité, en permanence. */
export class ExpertiseDecorator extends AdvantageDecorator {
  override get stats(): VehicleStats {
    const s = this.inner.stats;
    return { ...s, manoeuvrabilite: s.manoeuvrabilite + 1 };
  }
}

/**
 * Cascadeur (Audace) : réservé aux véhicules de Poids Léger ou Moyen avec une
 * Manœuvrabilité EFFECTIVE (après bonus des couches du dessous) d'au moins 3.
 */
export class CascadeurDecorator extends AdvantageDecorator {
  protected override validateSelf(): RuleResult {
    if (this.baseStats.poids === 'Lourd') {
      return fail('Cascadeur est réservé aux véhicules de Poids Léger ou Moyen');
    }
    if (this.stats.manoeuvrabilite < 3) {
      return fail("Cascadeur nécessite une Manœuvrabilité effective d'au moins 3");
    }
    return ok();
  }
}

/** Sur Deux Roues (Optimisation) : Manœuvrabilité EFFECTIVE d'au moins 3, aucune restriction de poids. */
export class SurDeuxRouesDecorator extends AdvantageDecorator {
  protected override validateSelf(): RuleResult {
    if (this.stats.manoeuvrabilite < 3) {
      return fail("Sur Deux Roues nécessite une Manœuvrabilité effective d'au moins 3");
    }
    return ok();
  }
}
