import { ImprovementDecorator, ok, fail, type RuleResult, type VehicleStats } from './vehicle-build';

export class ChenillesDecorator extends ImprovementDecorator {
  private static readonly VEHICULES_INCOMPATIBLES: readonly string[] = [
    'char_assaut',
    'helicoptere',
    'gyrocoptere',
  ];

  override get stats(): VehicleStats {
    const s = this.inner.stats;
    return { ...s, vitesse_max: s.vitesse_max - 1, manoeuvrabilite: s.manoeuvrabilite + 1 };
  }

  protected override validateSelf(): RuleResult {
    if (ChenillesDecorator.VEHICULES_INCOMPATIBLES.includes(this.baseStats.nom_interne)) {
      return fail('Chenilles incompatibles avec ce véhicule');
    }
    if (this.inner.countByType(ChenillesDecorator) >= 1) {
      return fail('Une seule paire de Chenilles par véhicule');
    }
    return ok();
  }
}

export class MembreEquipageDecorator extends ImprovementDecorator {
  private static readonly MULTIPLICATEUR_MAX: number = 2;

  override get stats(): VehicleStats {
    return { ...this.inner.stats, equipage: this.inner.stats.equipage + 1 };
  }

  protected override validateSelf(): RuleResult {
    const seuil = this.baseStats.equipage * MembreEquipageDecorator.MULTIPLICATEUR_MAX;
    if (this.stats.equipage > seuil) {
      return fail(`Maximum d'équipage atteint (${seuil})`);
    }
    return ok();
  }
}

export class BelierDecorator extends ImprovementDecorator {
  protected override validateSelf(): RuleResult {
    if (!this.instance.orientation) {
      return fail('Une orientation est requise pour le Bélier');
    }
    if (this.inner.hasOrientationFor(BelierDecorator, this.instance.orientation)) {
      return fail(`Un Bélier occupe déjà la position "${this.instance.orientation}"`);
    }
    return ok();
  }
}

export class BelierExplosifDecorator extends ImprovementDecorator {
  protected override validateSelf(): RuleResult {
    if (this.baseStats.poids === 'Léger') {
      return fail('Le Bélier Explosif est interdit sur les véhicules de Poids Léger');
    }
    if (this.inner.countByType(BelierExplosifDecorator) >= 1) {
      return fail('Un seul Bélier Explosif par véhicule');
    }
    if (!this.instance.orientation) {
      return fail('Une orientation est requise pour le Bélier Explosif');
    }
    return ok();
  }
}

export class BlindageDecorator extends ImprovementDecorator {
  override get stats(): VehicleStats {
    return { ...this.inner.stats, carrosserie: this.inner.stats.carrosserie + 2 };
  }
}

export class EquipementMishkinDecorator extends ImprovementDecorator {
  protected override validateSelf(): RuleResult {
    if (this.inner.countByType(EquipementMishkinDecorator) >= 1) {
      return fail(`Un seul exemplaire de "${this.amelioration.nom}" par véhicule`);
    }
    return ok();
  }
}
