import type { VehicleType } from './value-objects/vehicle-type';
import type { WeaponType } from './value-objects/weapon-type';
import type { ImprovementType } from './value-objects/improvement-type';
import type { Orientation, RuleResult } from '../vehicle-build';
import { ok, fail } from '../vehicle-build';
import { Weapon } from './weapon';
import { Improvement } from './improvement';

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

/**
 * Agrégat racine du domaine véhicule.
 *
 * Centralise toutes les règles métier Gaslands relatives à un véhicule :
 * - Pool d'emplacements partagé (armes + améliorations)
 * - Contrôle du budget (passé en paramètre — l'agrégat ne connaît pas la Team)
 * - Orientation des armes (obligatoire hors équipage, interdite pour équipage)
 * - Améliorations par défaut non supprimables
 * - Tourelle : prix variable, arme assignée/désassignée
 *
 * Les mutations sont en place (pas d'immutabilité) : une seule référence à l'agrégat
 * vit par requête HTTP, ce qui rend le clonage inutile et coûteux.
 */
export class Vehicle {
  constructor(
    readonly id: number,
    readonly teamId: number,
    readonly sponsorNom: string,
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
   * Emplacements utilisés : somme des armes + améliorations ACHETÉES.
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

  canAddWeapon(type: WeaponType, orientation: Orientation | null, budget: number): RuleResult {
    if (!type.hasVariablePrice && type.price > budget) {
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

  canAddImprovement(type: ImprovementType, orientation: Orientation | null, budget: number): RuleResult {
    if (!type.hasVariablePrice && type.price > budget) {
      return fail('Budget de l\'équipe insuffisant');
    }
    if (type.slots > this.availableSlots) {
      return fail('Emplacements insuffisants sur ce véhicule');
    }
    return ok();
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  addWeapon(type: WeaponType, orientation: Orientation | null, budget: number): void {
    const result = this.canAddWeapon(type, orientation, budget);
    if (!result.ok) throw new DomainException(result.reason);
    this._weapons.push(new Weapon(0, type, orientation));
  }

  removeWeapon(weaponId: number): void {
    const index = this._weapons.findIndex((w) => w.id === weaponId);
    if (index === -1) throw new DomainException('Arme introuvable sur ce véhicule');
    this._weapons.splice(index, 1);
  }

  addImprovement(type: ImprovementType, orientation: Orientation | null, budget: number): void {
    const result = this.canAddImprovement(type, orientation, budget);
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
   * Le coût d'une Tourelle = 3× le prix de l'arme montée. Ce multiplicateur n'est
   * écrit qu'à UN seul endroit : le getter `Improvement.price`. Pour ne pas le
   * dupliquer ici, on procède par « assigner → mesurer → rollback » : on assigne
   * la nouvelle arme, on lit le coût via le getter, et si le budget est dépassé on
   * restaure l'état précédent avant de lever l'exception.
   *
   * `budget` est le solde restant de l'équipe AVANT cette assignation. En
   * ré-assignation, le coût de l'arme actuellement montée est déjà décompté de ce
   * solde — on le « rend » donc (`budget + ancienCout`) pour comparer correctement.
   */
  assignWeaponToTourelle(improvementId: number, weaponType: WeaponType, budget: number): void {
    const tourelle = this.findImprovement(improvementId);
    if (!tourelle.type.isTourelle) {
      throw new DomainException('Cette amélioration n\'est pas une Tourelle');
    }

    const ancienneArme = tourelle.weaponAssignee;
    const ancienCout = tourelle.price;

    tourelle.assignWeapon(weaponType);
    const nouveauCout = tourelle.price;

    if (nouveauCout > budget + ancienCout) {
      // Rollback : restaurer l'arme précédente (ou l'état orphelin).
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
