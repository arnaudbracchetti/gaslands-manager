import type { VehicleType } from './value-objects/vehicle-type';
import type { WeaponType } from './value-objects/weapon-type';
import type { ImprovementType } from './value-objects/improvement-type';
import type { Orientation, RuleResult } from './team';
import { ok, fail } from './team';
import { Weapon } from './weapon';
import { Improvement } from './improvement';
import { DomainException } from '../../shared/domain/domain-exception';
import type { SequellaType } from './value-objects/sequella-type';

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
  // ── Champs transients de campagne (D-S5) ─────────────────────────────────────
  // Non persistés en base — reconstruits au replay de la séquence d'événements.

  private _isLost = false;
  private _chocs = 0;
  /**
   * Séquelles actives sur ce véhicule, stockées comme Value Objects `SequellaType`.
   * Même modèle que `WeaponType` / `ImprovementType` : les données métier de chaque
   * séquelle sont portées par l'objet, pas par une clé string opaque.
   * Maintenues en ordre d'application — instanciées en décorateurs par VehicleBuildFactory
   * lors du calcul des stats (atelier).
   */
  private readonly _sequellas: SequellaType[] = [];

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

  // ── Getters campagne ──────────────────────────────────────────────────────────

  get isLost(): boolean {
    return this._isLost;
  }

  get chocs(): number {
    return this._chocs;
  }

  get sequellas(): readonly SequellaType[] {
    return this._sequellas;
  }

  // ── Calculs ──────────────────────────────────────────────────────────────────

  /**
   * Coût total : prix du châssis + armes + améliorations achetées.
   * Inchangé si le véhicule est perdu : la perte n'est pas un remboursement
   * (le coût a été payé lors de l'achat et compte toujours dans le budget équipe).
   */
  get cost(): number {
    const weaponsCost = this._weapons.reduce((sum, w) => sum + w.price, 0);
    const improvementsCost = this._improvements.reduce((sum, i) => sum + i.price, 0);
    return this.type.price + weaponsCost + improvementsCost;
  }

  /**
   * Emplacements utilisés.
   * Les améliorations par défaut (estDefaut) retournent slots = 0.
   * Les armes perdues (_isLost) retournent slots = 0 — emplacement libéré.
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
    // Garde de domaine : on ne peut pas équiper un véhicule perdu en campagne.
    if (this._isLost) return fail('Ce véhicule est hors combat — équipement impossible');

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
    // Garde de domaine : on ne peut pas équiper un véhicule perdu en campagne.
    if (this._isLost) return fail('Ce véhicule est hors combat — équipement impossible');

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

  // ── Mutations campagne ────────────────────────────────────────────────────────

  /** Idempotent : marquer un véhicule déjà perdu n'a pas d'effet supplémentaire. */
  markLost(): void {
    this._isLost = true;
  }

  clearLost(): void {
    this._isLost = false;
  }

  /**
   * Ajoute (ou retire si n < 0) des chocs sur ce véhicule.
   * Les chocs ne peuvent pas être négatifs : lève DomainException si le résultat
   * serait inférieur à 0 (tentative de consommer plus de chocs qu'on n'en possède).
   */
  addChocs(n: number): void {
    if (this._chocs + n < 0) {
      throw new DomainException(`Chocs insuffisants (solde actuel : ${this._chocs}, demandé : ${Math.abs(n)})`);
    }
    this._chocs += n;
  }

  /**
   * Enregistre une séquelle sur ce véhicule (mode campagne).
   * Le Value Object `SequellaType` porte toutes les données métier (nom, coût en Chocs…).
   * `VehicleBuildFactory` (Partie 5) utilise `sequellaType.nomInterne` pour instancier
   * le décorateur correspondant via `SEQUELLA_REGISTRY`.
   */
  addSequella(sequellaType: SequellaType): void {
    this._sequellas.push(sequellaType);
  }

  /**
   * Annule la dernière séquelle ajoutée (undo d'événement campagne).
   * Le replay étant ordonné, le dernier push est toujours la séquelle à défaire.
   */
  removeLastSequella(): void {
    this._sequellas.pop();
  }

  // ── Méthodes campagne (D-S5 / D-S11) ────────────────────────────────────────

  /**
   * Remet tous les états transients de campagne à zéro (isLost, chocs, séquelles).
   * Appelé par Team.resetCampaignState() au début de chaque replay.
   */
  clearCampaignState(): void {
    this._isLost = false;
    this._chocs = 0;
    this._sequellas.length = 0;
  }

  /**
   * Ajoute une arme avec un id explicite (D-S11 : id négatif = entité transiente campagne).
   * Distinct de addWeapon() qui passe par les règles de budget/emplacements.
   */
  addCampaignWeapon(weaponType: WeaponType, orientation: Orientation | null, campaignId: number): Weapon {
    const weapon = new Weapon(campaignId, weaponType, orientation);
    this._weapons.push(weapon);
    return weapon;
  }

  // ── Helpers privés ────────────────────────────────────────────────────────────

  private findImprovement(id: number): Improvement {
    const imp = this._improvements.find((i) => i.id === id);
    if (!imp) throw new DomainException('Amélioration introuvable sur ce véhicule');
    return imp;
  }
}

// Ré-export pour rétrocompatibilité : les consumers existants importent DomainException
// depuis team/domain/vehicle ou team/domain/team sans avoir à changer leurs imports.
export { DomainException };
