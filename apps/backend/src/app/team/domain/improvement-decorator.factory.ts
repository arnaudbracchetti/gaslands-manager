import type { Amelioration } from '../../catalog/catalog.interfaces';
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

/**
 * Fabrique pure (aucune dépendance NestJS) : sélectionne le décorateur concret d'après
 * le `comportement` de l'amélioration. Vit dans `domain/` car l'agrégat `Vehicle`
 * l'utilise pour valider les règles de pose (cf. `Vehicle.canAddImprovement`). Le
 * `@Injectable()` a été retiré au profit d'un `wrap` statique — la fabrique n'a aucun
 * état ni dépendance de constructeur, elle n'a donc pas à passer par le conteneur.
 */
export class ImprovementDecoratorFactory {
  static readonly REGISTRE: Record<string, DecoratorCtor> = {
    chenilles: ChenillesDecorator,
    membre_equipage: MembreEquipageDecorator,
    belier: BelierDecorator,
    belier_explosif: BelierExplosifDecorator,
    blindage: BlindageDecorator,
    mishkin_exclusif: EquipementMishkinDecorator,
  };

  static wrap(inner: VehicleBuild, amelioration: Amelioration, instance: InstalledImprovement): VehicleBuild {
    const Decorateur: DecoratorCtor =
      ImprovementDecoratorFactory.REGISTRE[amelioration.comportement ?? ''] ?? NeutralDecorator;
    return new Decorateur(inner, amelioration, instance);
  }
}
