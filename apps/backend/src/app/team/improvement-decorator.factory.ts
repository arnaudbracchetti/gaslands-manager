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
  static readonly REGISTRE: Record<string, DecoratorCtor> = {
    chenilles: ChenillesDecorator,
    membre_equipage: MembreEquipageDecorator,
    belier: BelierDecorator,
    belier_explosif: BelierExplosifDecorator,
    blindage: BlindageDecorator,
    mishkin_exclusif: EquipementMishkinDecorator,
  };

  wrap(inner: VehicleBuild, amelioration: Amelioration, instance: InstalledImprovement): VehicleBuild {
    const Decorateur: DecoratorCtor =
      ImprovementDecoratorFactory.REGISTRE[amelioration.comportement ?? ''] ?? NeutralDecorator;
    return new Decorateur(inner, amelioration, instance);
  }
}
