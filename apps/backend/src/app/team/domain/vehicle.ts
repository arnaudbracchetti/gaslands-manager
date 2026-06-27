import type { VehicleType } from './value-objects/vehicle-type';
import type { WeaponType } from './value-objects/weapon-type';
import type { ImprovementType } from './value-objects/improvement-type';
import type { Orientation, RuleResult } from './team';
import { ok, fail } from './team';
import { Weapon } from './weapon';
import { Improvement } from './improvement';

/**
 * Un véhicule appartenant à une équipe — entité enfant de l'agrégat Team.
 *
 * Contrairement à l'ancienne architecture où Vehicle était l'agrégat racine, Vehicle
 * ne gère ici que ses propres règles (emplacements, orientation des armes). Les règles
 * qui dépendent de données d'équipe (budget, sponsor) sont gérées par Team qui passe
 * les valeurs nécessaires en paramètre (pattern "tell, don't ask").
 *
 * sponsorNom n'est plus porté par Vehicle : il est porté par Team et passé par les
 * use cases au moment de la validation d'autorisation catalogue.
 */
export class Vehicle {
  constructor(
    readonly id: number,
    readonly teamId: number,
    readonly type: VehicleType,
    private readonly _weapons: Weapon[],
    private readonly _improvements: Improvement[],
  ) {}

  get weapons(): readonly Weapon[] {
    return this._weapons;
  }

  get improvements(): readonly Improvement[] {
    return this._improvements;
  }

  // ── Calculs ──────────────────────────────────────────────────────────────────

  /** Coût total : prix du châssis + armes + améliorations achetées. */
  get cost(): number {
    const weaponsCost = this._weapons.reduce((sum, w) => sum + w.price, 0);
    const improvementsCost = this._improvements.reduce((sum, i) => sum + i.price, 0);
    return this.type.price + weaponsCost + improvementsCost;
  }

  /**
   * Emplacements utilisés.
   * Les améliorations par défaut (estDefaut) retournent slots = 0.
   */
  get usedSlots(): number {
    const weaponSlots = this._weapons.reduce((sum, w) => sum + w.slots, 0);
    const improvementSlots = this._improvements.reduce((sum, i) => sum + i.slots, 0);
    return weaponSlots + improvementSlots;
  }

  private get availableSlots(): number {
    return this.type.slots - this.usedSlots;
  }

  // ── Règles publiques (pour GET /available-weapons et /available-improvements) ──

  canAddWeapon(type: WeaponType, orientation: Orientation | null, remainingBudget: number): RuleResult {
    if (!type.hasVariablePrice && type.price > remainingBudget) {
      return fail('Budget de l\'équipe insuffisant');
    }
    if (type.slots > this.availableSlots) {
      return fail('Emplacements insuffisants sur ce véhicule');
    }
    if (type.requiresOrientation && orientation === null) {
      return fail('Une orientation est requise pour cette arme');
    }
    if (!type.requiresOrientation && orientation !== null) {
      return fail('Les armes d\'équipage ne peuvent pas être orientées');
    }
    return ok();
  }

  canAddImprovement(type: ImprovementType, orientation: Orientation | null, remainingBudget: number): RuleResult {
    if (!type.hasVariablePrice && type.price > remainingBudget) {
      return fail('Budget de l\'équipe insuffisant');
    }
    if (type.slots > this.availableSlots) {
      return fail('Emplacements insuffisants sur ce véhicule');
    }
    return ok();
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  addWeapon(type: WeaponType, orientation: Orientation | null, remainingBudget: number): void {
    const result = this.canAddWeapon(type, orientation, remainingBudget);
    if (!result.ok) throw new DomainException(result.reason);
    this._weapons.push(new Weapon(0, type, orientation));
  }

  removeWeapon(weaponId: number): void {
    const index = this._weapons.findIndex((w) => w.id === weaponId);
    if (index === -1) throw new DomainException('Arme introuvable sur ce véhicule');
    this._weapons.splice(index, 1);
  }

  addImprovement(type: ImprovementType, orientation: Orientation | null, remainingBudget: number): void {
    const result = this.canAddImprovement(type, orientation, remainingBudget);
    if (!result.ok) throw new DomainException(result.reason);
    this._improvements.push(new Improvement(0, type, orientation, false));
  }

  removeImprovement(improvementId: number): void {
    const index = this._improvements.findIndex((i) => i.id === improvementId);
    if (index === -1) throw new DomainException('Amélioration introuvable sur ce véhicule');
    if (this._improvements[index].estDefaut) {
      throw new DomainException('Les améliorations intégrées au profil de base ne peuvent pas être retirées');
    }
    this._improvements.splice(index, 1);
  }

  /**
   * Assigne une arme à une Tourelle, en validant le budget.
   *
   * remainingBudget est le solde de l'équipe AVANT cette assignation. En
   * ré-assignation, le coût de l'arme actuellement montée est déjà décompté du
   * budget de l'équipe — on le « rend » donc (budget + ancienCout) pour comparer
   * correctement.
   */
  assignWeaponToTourelle(improvementId: number, weaponType: WeaponType, remainingBudget: number): void {
    const tourelle = this.findImprovement(improvementId);
    if (!tourelle.type.isTourelle) {
      throw new DomainException('Cette amélioration n\'est pas une Tourelle');
    }

    const ancienneArme = tourelle.weaponAssignee;
    const ancienCout = tourelle.price;

    tourelle.assignWeapon(weaponType);
    const nouveauCout = tourelle.price;

    if (nouveauCout > remainingBudget + ancienCout) {
      if (ancienneArme) tourelle.assignWeapon(ancienneArme);
      else tourelle.unassignWeapon();
      throw new DomainException('Budget de l\'équipe insuffisant');
    }
  }

  unassignWeaponFromTourelle(improvementId: number): void {
    const tourelle = this.findImprovement(improvementId);
    if (!tourelle.type.isTourelle) {
      throw new DomainException('Cette amélioration n\'est pas une Tourelle');
    }
    tourelle.unassignWeapon();
  }

  // ── Helpers privés ────────────────────────────────────────────────────────────

  private findImprovement(id: number): Improvement {
    const imp = this._improvements.find((i) => i.id === id);
    if (!imp) throw new DomainException('Amélioration introuvable sur ce véhicule');
    return imp;
  }
}

/**
 * DomainException — erreur métier levée par l'agrégat quand une règle est violée.
 * Distincte de HttpException (NestJS) : le domaine ne connaît pas HTTP.
 * La couche application la capture et la convertit en BadRequestException/ForbiddenException.
 */
export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainException';
  }
}
