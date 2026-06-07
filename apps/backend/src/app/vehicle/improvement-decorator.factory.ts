/**
 * ImprovementDecoratorFactory — sélectionne la classe de décorateur à instancier
 * pour une amélioration donnée (Pattern Factory).
 *
 * Le YAML ne porte qu'une clé de "câblage" (`comportement: "<clé>"`) — c'est ce
 * registre, et lui seul, qui relie cette clé à la classe qui IMPLÉMENTE la règle.
 * Ajouter une nouvelle règle métier = une nouvelle classe + une ligne ici ; le
 * reste du système (catalogue, service, contrôleur) n'a rien à connaître de plus.
 *
 * Pourquoi un `@Injectable()` plutôt qu'un objet statique ? Pour rester cohérent
 * avec le style d'injection de dépendances de NestJS — `VehicleService` la reçoit
 * par constructeur comme n'importe quel autre collaborateur, ce qui la rend
 * substituable en test (même si, en pratique, le registre est figé et ne nécessite
 * pas de mock : on teste directement `wrap()` avec de vraies entrées catalogue).
 */

import { Injectable } from '@nestjs/common';
import type { Amelioration } from '../catalog/catalog.interfaces';
import {
  NeutralDecorator,
  type DecoratorCtor,
  type InstalledImprovement,
  type VehicleBuild,
} from './vehicle-build';
import {
  BelierDecorator,
  BelierExplosifDecorator,
  BlindageDecorator,
  ChenillesDecorator,
  EquipementMishkinDecorator,
  MembreEquipageDecorator,
} from './improvement-decorators';

@Injectable()
export class ImprovementDecoratorFactory {
  /**
   * Mapping `comportement` (clé déclarée en YAML) → classe de décorateur à instancier.
   *
   * `static readonly` : ce registre décrit un CÂBLAGE figé entre données et code,
   * identique pour toute instance du service — il n'a aucune raison de varier à
   * l'exécution. `catalog.data.spec.ts` vérifie que toute valeur `comportement`
   * présente dans le YAML possède effectivement une entrée ici (cohérence
   * catalogue ↔ code, détectée au moment des tests plutôt qu'à l'exécution).
   */
  static readonly REGISTRE: Record<string, DecoratorCtor> = {
    chenilles: ChenillesDecorator,
    membre_equipage: MembreEquipageDecorator,
    belier: BelierDecorator,
    belier_explosif: BelierExplosifDecorator,
    blindage: BlindageDecorator,
    mishkin_exclusif: EquipementMishkinDecorator,
    // Une nouvelle règle métier ⇒ une classe (improvement-decorators.ts) + une ligne ici.
  };

  /**
   * Enveloppe `inner` avec le décorateur correspondant au `comportement` déclaré par
   * `amelioration` — ou avec `NeutralDecorator` si aucun n'est déclaré (amélioration
   * sans effet de profil ni règle de pose particulière, ex: Arceaux).
   *
   * Le type de retour est `VehicleBuild` — pas `ImprovementDecorator` — car c'est le
   * seul contrat dont l'appelant a besoin (cf. Pattern Decorator : un appelant qui
   * tient un `VehicleBuild` ne sait jamais combien de couches il manipule).
   */
  wrap(inner: VehicleBuild, amelioration: Amelioration, instance: InstalledImprovement): VehicleBuild {
    const Decorateur: DecoratorCtor =
      ImprovementDecoratorFactory.REGISTRE[amelioration.comportement ?? ''] ?? NeutralDecorator;
    return new Decorateur(inner, amelioration, instance);
  }
}
