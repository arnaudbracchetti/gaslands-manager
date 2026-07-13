import type { VehicleType } from './value-objects/vehicle-type';
import type { WeaponType } from './value-objects/weapon-type';
import type { ImprovementType } from './value-objects/improvement-type';
import type { AdvantageType } from './value-objects/advantage-type';
import type { SequellaType } from './value-objects/sequella-type';
import { Vehicle, DomainException } from './vehicle';
import { Weapon } from './weapon';
import { Improvement } from './improvement';
import { Advantage } from './advantage';
import type { Sequella } from './sequella';

// ── Résultat de validation ────────────────────────────────────────────────────

export type RuleResult = { ok: true } | { ok: false; reason: string };

export function ok(): RuleResult {
  return { ok: true };
}

export function fail(reason: string): RuleResult {
  return { ok: false, reason };
}

export type Orientation = 'avant' | 'arrière' | 'gauche' | 'droite';

/**
 * Orientation d'une arme — les 4 arcs de tir plus `'tourelle'` (montage sur Tourelle,
 * arc à 360°, coût ×3). Distinct d'`Orientation` (utilisée par `VehicleImprovement`,
 * qui ne supporte jamais le montage Tourelle) pour rendre cet état impossible par le
 * typage plutôt que de le garder à l'exécution.
 */
export type WeaponOrientation = Orientation | 'tourelle';

// ── Commande de mise à jour ───────────────────────────────────────────────────

export interface UpdateTeamCommand {
  name?: string;
  sponsor?: string;
  cans?: number;
  description?: string | null;
}

// ── Agrégat racine Team ───────────────────────────────────────────────────────

/**
 * Agrégat racine Team.
 *
 * Décision architecturale : Vehicle est une entité enfant de Team, pas un agrégat
 * racine indépendant. L'invariante principale de Vehicle — coût_total ≤ budget_équipe —
 * dépend de team.cans et du coût de TOUS les véhicules. Vehicle ne peut donc pas
 * garantir cet invariant seul.
 *
 * Team porte le budget et calcule lui-même `remainingBudget`. Toutes les mutations
 * sur les véhicules, armes et améliorations transitent par Team, qui dispose du
 * contexte complet (budget réel, sponsor) pour appliquer les règles correctement.
 */
export class Team {
  constructor(
    readonly id: number,
    readonly userId: number,
    private _name: string,
    private _sponsor: string,
    private _cans: number,
    private _description: string | null,
    private readonly _vehicles: Vehicle[],
    private readonly _isLocked: boolean = false,
  ) {}

  get name(): string { return this._name; }
  get sponsor(): string { return this._sponsor; }
  get cans(): number { return this._cans; }
  get description(): string | null { return this._description; }
  get vehicles(): readonly Vehicle[] { return this._vehicles; }
  get isLocked(): boolean { return this._isLocked; }

  /**
   * Une équipe engagée (participant VALIDATED) dans une campagne qui n'est plus
   * EN_CONSTRUCTION est intégralement verrouillée — toute mutation directe passe
   * par ce garde. Les méthodes "campagne" (section D-S5/D-S11 plus bas), utilisées
   * par le flux atelier event-sourcing, n'y sont volontairement pas soumises.
   */
  assertNotLocked(): void {
    if (this._isLocked) {
      throw new DomainException(
        "Cette équipe est verrouillée : elle participe à une campagne qui n'est plus en construction.",
      );
    }
  }

  /**
   * Budget restant = budget total - somme des coûts de tous les véhicules.
   * Calculé en mémoire sur l'agrégat chargé — plus de requête SQL dédiée.
   */
  get remainingBudget(): number {
    return this._cans - this._vehicles.reduce((sum, v) => sum + v.cost, 0);
  }

  // ── Mutations Team ────────────────────────────────────────────────────────────

  /**
   * Met à jour les propriétés de l'équipe.
   * Phase 5 : la règle du verrouillage du sponsor est enforcée côté backend.
   */
  update(dto: UpdateTeamCommand): void {
    this.assertNotLocked();
    if (dto.name !== undefined) this._name = dto.name;
    if (dto.cans !== undefined) this._cans = dto.cans;
    if (dto.description !== undefined) this._description = dto.description;
    if (dto.sponsor !== undefined && dto.sponsor !== this._sponsor) {
      if (this._vehicles.length > 0) {
        throw new DomainException('Le sponsor ne peut plus être modifié car l\'équipe possède des véhicules');
      }
      this._sponsor = dto.sponsor;
    }
  }

  // ── Mutations Vehicle ─────────────────────────────────────────────────────────

  /**
   * Ajoute un nouveau véhicule "nu" à l'équipe avec ses améliorations et son arme par
   * défaut (ex. Char d'assaut + Canon de 125mm monté sur Tourelle). La validation
   * d'autorisation sponsor (vehicleType ∈ sponsor.vehicules) est faite par le use case
   * avant d'appeler cette méthode.
   */
  addVehicle(vehicleType: VehicleType, defaultImprovements: Improvement[], defaultWeapons: Weapon[] = []): Vehicle {
    this.assertNotLocked();
    const vehicle = new Vehicle(0, this.id, vehicleType, defaultWeapons, defaultImprovements);
    this._vehicles.push(vehicle);
    return vehicle;
  }

  removeVehicle(vehicleId: number): void {
    this.assertNotLocked();
    const idx = this._vehicles.findIndex((v) => v.id === vehicleId);
    if (idx === -1) throw new DomainException(`Véhicule #${vehicleId} introuvable dans l'équipe`);
    this._vehicles.splice(idx, 1);
  }

  findVehicle(vehicleId: number): Vehicle {
    const v = this._vehicles.find((v) => v.id === vehicleId);
    if (!v) throw new DomainException(`Véhicule #${vehicleId} introuvable dans l'équipe`);
    return v;
  }

  /**
   * Recherche une arme par son id dans tous les véhicules de l'équipe.
   * Nécessaire aux commandes d'événements campagne qui ciblent une arme directement
   * (ex : WeaponLostEvent) sans connaître le vehicleId.
   */
  findWeapon(weaponId: number): Weapon {
    for (const vehicle of this._vehicles) {
      const weapon = vehicle.weapons.find((w) => w.id === weaponId);
      if (weapon) return weapon;
    }
    throw new DomainException(`Arme #${weaponId} introuvable dans l'équipe`);
  }

  /**
   * Recherche une amélioration par son id dans tous les véhicules de l'équipe.
   * Mirroir de `findWeapon` — nécessaire aux commandes d'événements campagne qui
   * ciblent une amélioration directement (ex : ImprovementLostEvent).
   */
  findImprovement(improvementId: number): Improvement {
    for (const vehicle of this._vehicles) {
      const improvement = vehicle.improvements.find((i) => i.id === improvementId);
      if (improvement) return improvement;
    }
    throw new DomainException(`Amélioration #${improvementId} introuvable dans l'équipe`);
  }

  /**
   * Recherche un avantage par son id dans tous les véhicules de l'équipe. Mirroir de
   * `findImprovement` — pas d'événement campagne dédié aujourd'hui (pas d'équivalent
   * `AdvantageLostEvent`), mais gardée pour la même cohérence de contrat que ses siblings.
   */
  findAdvantage(advantageId: number): Advantage {
    for (const vehicle of this._vehicles) {
      const advantage = vehicle.advantages.find((a) => a.id === advantageId);
      if (advantage) return advantage;
    }
    throw new DomainException(`Avantage #${advantageId} introuvable dans l'équipe`);
  }

  // ── Mutations Weapon (déléguées au Vehicle) ───────────────────────────────────

  addWeaponToVehicle(
    vehicleId: number,
    weaponType: WeaponType,
    orientation: WeaponOrientation | null,
  ): void {
    this.assertNotLocked();
    const vehicle = this.findVehicle(vehicleId);
    vehicle.addWeapon(weaponType, orientation, this.remainingBudget);
  }

  removeWeaponFromVehicle(vehicleId: number, weaponId: number): void {
    this.assertNotLocked();
    const vehicle = this.findVehicle(vehicleId);
    vehicle.removeWeapon(weaponId);
  }

  /**
   * Verdict de disponibilité d'une arme pour ce véhicule (lecture, pas de mutation) —
   * même règle de verrouillage que les mutations, mais renvoyée comme `RuleResult`
   * plutôt que levée : un listing d'équipement disponible doit pouvoir afficher
   * "indisponible" sans faire échouer la requête. Évite de dupliquer ce test dans
   * chaque use case de listing (`GetAvailableWeaponsUseCase`…).
   */
  canAddWeaponToVehicle(vehicleId: number, weaponType: WeaponType, orientation: WeaponOrientation | null): RuleResult {
    if (this._isLocked) return fail('Équipe verrouillée : campagne en cours');
    return this.findVehicle(vehicleId).canAddWeapon(weaponType, orientation, this.remainingBudget);
  }

  // ── Mutations Improvement (déléguées au Vehicle) ──────────────────────────────

  addImprovementToVehicle(vehicleId: number, improvementType: ImprovementType, orientation: Orientation | null): void {
    this.assertNotLocked();
    const vehicle = this.findVehicle(vehicleId);
    vehicle.addImprovement(improvementType, orientation, this.remainingBudget);
  }

  removeImprovementFromVehicle(vehicleId: number, improvementId: number): void {
    this.assertNotLocked();
    const vehicle = this.findVehicle(vehicleId);
    vehicle.removeImprovement(improvementId);
  }

  /** Miroir de `canAddWeaponToVehicle` pour les améliorations — cf. sa doc. */
  canAddImprovementToVehicle(vehicleId: number, improvementType: ImprovementType): RuleResult {
    if (this._isLocked) return fail('Équipe verrouillée : campagne en cours');
    return this.findVehicle(vehicleId).canAddImprovementInAnyOrientation(improvementType, this.remainingBudget);
  }

  // ── Mutations Advantage (déléguées au Vehicle) ────────────────────────────────

  addAdvantageToVehicle(vehicleId: number, advantageType: AdvantageType): void {
    this.assertNotLocked();
    const vehicle = this.findVehicle(vehicleId);
    vehicle.addAdvantage(advantageType, this.remainingBudget);
  }

  removeAdvantageFromVehicle(vehicleId: number, advantageId: number): void {
    this.assertNotLocked();
    const vehicle = this.findVehicle(vehicleId);
    vehicle.removeAdvantage(advantageId);
  }

  /** Miroir de `canAddWeaponToVehicle` pour les avantages — cf. sa doc. */
  canAddAdvantageToVehicle(vehicleId: number, advantageType: AdvantageType): RuleResult {
    if (this._isLocked) return fail('Équipe verrouillée : campagne en cours');
    return this.findVehicle(vehicleId).canAddAdvantage(advantageType, this.remainingBudget);
  }

  // ── Méthodes campagne (D-S5 / D-S11) ────────────────────────────────────────

  /**
   * Remet tous les états transients de campagne à zéro (véhicules + armes).
   * Appelé par CampaignParticipant.reset() avant chaque replay.
   */
  resetCampaignState(): void {
    for (const vehicle of this._vehicles) {
      vehicle.clearCampaignState();
      for (const weapon of vehicle.weapons) {
        weapon.clearCampaignState();
      }
      for (const improvement of vehicle.improvements) {
        improvement.clearCampaignState();
      }
      for (const advantage of vehicle.advantages) {
        advantage.clearCampaignState();
      }
    }
  }

  /**
   * Ajoute un véhicule transient avec un id explicite (D-S11).
   * id négatif = entité campagne identifiée par -eventId (distincte des ids BDD).
   */
  addCampaignVehicle(vehicleType: VehicleType, campaignId: number): Vehicle {
    const vehicle = new Vehicle(campaignId, this.id, vehicleType, [], []);
    this._vehicles.push(vehicle);
    return vehicle;
  }

  /** Retire un véhicule par son id (persisté ou transient campagne). */
  removeCampaignVehicle(vehicleId: number): void {
    const idx = this._vehicles.findIndex((v) => v.id === vehicleId);
    if (idx === -1) throw new DomainException(`Véhicule #${vehicleId} introuvable pour suppression campagne`);
    this._vehicles.splice(idx, 1);
  }

  /** Ajoute une arme transiente sur un véhicule avec un id explicite (D-S11). */
  addCampaignWeapon(
    vehicleId: number,
    weaponType: WeaponType,
    orientation: WeaponOrientation | null,
    campaignId: number,
  ): Weapon {
    return this.findVehicle(vehicleId).addCampaignWeapon(weaponType, orientation, campaignId);
  }

  /** Retire une arme par son id d'un véhicule spécifique. */
  removeCampaignWeapon(vehicleId: number, weaponId: number): void {
    this.findVehicle(vehicleId).removeWeapon(weaponId);
  }

  /** Ajoute une amélioration transiente sur un véhicule avec un id explicite (D-S11). */
  addCampaignImprovement(
    vehicleId: number,
    improvementType: ImprovementType,
    orientation: Orientation | null,
    campaignId: number,
  ): Improvement {
    return this.findVehicle(vehicleId).addCampaignImprovement(improvementType, orientation, campaignId);
  }

  /**
   * Retire une amélioration par son id d'un véhicule spécifique. Réutilise
   * `Vehicle.removeImprovement`, qui refuse les améliorations intégrées (`estDefaut`) —
   * la garde « une amélioration intégrée ne se revend pas » est ainsi héritée.
   */
  removeCampaignImprovement(vehicleId: number, improvementId: number): void {
    this.findVehicle(vehicleId).removeImprovement(improvementId);
  }

  /** Ajoute un avantage transient sur un véhicule avec un id explicite (D-S11). */
  addCampaignAdvantage(
    vehicleId: number,
    advantageType: AdvantageType,
    campaignId: number,
    grantedBySequellaNomInterne: string | null = null,
  ): Advantage {
    return this.findVehicle(vehicleId).addCampaignAdvantage(advantageType, campaignId, grantedBySequellaNomInterne);
  }

  /** Retire un avantage par son id d'un véhicule spécifique (annulation d'achat en session courante). */
  removeCampaignAdvantage(vehicleId: number, advantageId: number): void {
    this.findVehicle(vehicleId).removeAdvantage(advantageId);
  }

  /** Ajoute une séquelle transiente sur un véhicule avec un id explicite (D-S11). */
  addCampaignSequella(vehicleId: number, sequellaType: SequellaType, campaignId: number): Sequella {
    return this.findVehicle(vehicleId).addCampaignSequella(sequellaType, campaignId);
  }

  /** Retire une séquelle par son id d'un véhicule spécifique (annulation d'achat en session courante). */
  removeCampaignSequella(vehicleId: number, sequellaId: number): void {
    this.findVehicle(vehicleId).removeSequella(sequellaId);
  }

  /**
   * Marque un véhicule "vendu" (flag isSold, cascade sur son équipement pas encore
   * vendu) plutôt que de le retirer de l'équipe — mirroir de removeCampaignVehicle,
   * utilisé par la revente d'un véhicule pré-existant en atelier (annulation vs
   * revente). Passe-plat pur : toute la logique (cascade, calcul du résiduel) vit
   * sur `Vehicle.markSold()`.
   */
  markVehicleSold(vehicleId: number): void {
    this.findVehicle(vehicleId).markSold();
  }

  clearVehicleSold(vehicleId: number): void {
    this.findVehicle(vehicleId).clearSold();
  }

  /**
   * Marque une arme d'un véhicule spécifique "vendue" (flag isSold) plutôt que de la
   * retirer — mirroir de removeCampaignWeapon, utilisé par la revente d'un objet
   * pré-existant en atelier (annulation vs revente).
   */
  markWeaponSold(vehicleId: number, weaponId: number): void {
    this.findVehicle(vehicleId).markWeaponSold(weaponId);
  }

  clearWeaponSold(vehicleId: number, weaponId: number): void {
    this.findVehicle(vehicleId).clearWeaponSold(weaponId);
  }

  /** Mirroir de markWeaponSold/clearWeaponSold pour les améliorations. */
  markImprovementSold(vehicleId: number, improvementId: number): void {
    this.findVehicle(vehicleId).markImprovementSold(improvementId);
  }

  clearImprovementSold(vehicleId: number, improvementId: number): void {
    this.findVehicle(vehicleId).clearImprovementSold(improvementId);
  }

  /** Mirroir de markWeaponSold/clearWeaponSold pour les avantages. */
  markAdvantageSold(vehicleId: number, advantageId: number): void {
    this.findVehicle(vehicleId).markAdvantageSold(advantageId);
  }

  clearAdvantageSold(vehicleId: number, advantageId: number): void {
    this.findVehicle(vehicleId).clearAdvantageSold(advantageId);
  }

  /** Mirroir de markWeaponSold/clearWeaponSold pour les séquelles. */
  markSequellaSold(vehicleId: number, sequellaId: number): void {
    this.findVehicle(vehicleId).markSequellaSold(sequellaId);
  }

  clearSequellaSold(vehicleId: number, sequellaId: number): void {
    this.findVehicle(vehicleId).clearSequellaSold(sequellaId);
  }

  /** Marque/démarque vendu l'avantage gratuit accordé par une séquelle (Dur à Cuire). */
  markGrantedAdvantageSold(vehicleId: number, sequellaNomInterne: string): void {
    this.findVehicle(vehicleId).markGrantedAdvantageSold(sequellaNomInterne);
  }

  clearGrantedAdvantageSold(vehicleId: number, sequellaNomInterne: string): void {
    this.findVehicle(vehicleId).clearGrantedAdvantageSold(sequellaNomInterne);
  }

}

// Ré-export pour que les consumers importent depuis team.ts sans connaître vehicle.ts
export { DomainException } from './vehicle';
