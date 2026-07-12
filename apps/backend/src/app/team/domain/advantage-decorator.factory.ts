import type { Avantage } from '../../catalog/catalog.interfaces';
import type { InstalledImprovement, VehicleBuild } from './vehicle-build';
import {
  AdvantageDecorator,
  NeutralAdvantageDecorator,
  ExpertiseDecorator,
  CascadeurDecorator,
  SurDeuxRouesDecorator,
} from './advantage-decorators';

/**
 * Type-constructeur d'un décorateur d'avantage concret. Distinct de `DecoratorCtor`
 * (`vehicle-build.ts`), qui attend un `Amelioration` en 2ᵉ paramètre — un avantage n'est
 * pas structurellement compatible (pas d'`emplacement`/`sponsors_autorises`/
 * `necessite_orientation` dans `Avantage`).
 */
export type AdvantageDecoratorCtor = new (
  inner: VehicleBuild,
  avantage: Avantage,
  instance: InstalledImprovement,
) => AdvantageDecorator;

/**
 * Fabrique pure (aucune dépendance NestJS) : sélectionne le décorateur concret d'après
 * le `comportement` de l'avantage. Mirroir exact d'`ImprovementDecoratorFactory`.
 */
export class AdvantageDecoratorFactory {
  static readonly REGISTRE: Record<string, AdvantageDecoratorCtor> = {
    expertise: ExpertiseDecorator,
    cascadeur: CascadeurDecorator,
    sur_deux_roues: SurDeuxRouesDecorator,
  };

  static wrap(inner: VehicleBuild, avantage: Avantage, instance: InstalledImprovement): VehicleBuild {
    const Decorateur: AdvantageDecoratorCtor =
      AdvantageDecoratorFactory.REGISTRE[avantage.comportement ?? ''] ?? NeutralAdvantageDecorator;
    return new Decorateur(inner, avantage, instance);
  }
}
