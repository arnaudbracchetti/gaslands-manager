import type { VehicleType } from './value-objects/vehicle-type';
import type { WeaponType } from './value-objects/weapon-type';
import type { ImprovementType } from './value-objects/improvement-type';
import { Vehicle, DomainException } from './vehicle';
import { Weapon } from './weapon';
import { Improvement } from './improvement';

// ── Résultat de validation ────────────────────────────────────────────────────

export type RuleResult = { ok: true } | { ok: false; reason: string };

export function ok(): RuleResult {
  return { ok: true };
}

export function fail(reason: string): RuleResult {
  return { ok: false, reason };
}

export type Orientation = 'avant' | 'arrière' | 'gauche' | 'droite';

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
  ) {}

  get name(): string { return this._name; }
  get sponsor(): string { return this._sponsor; }
  get cans(): number { return this._cans; }
  get description(): string | null { return this._description; }
  get vehicles(): readonly Vehicle[] { return this._vehicles; }

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
   * Ajoute un nouveau véhicule "nu" à l'équipe avec ses améliorations par défaut.
   * La validation d'autorisation sponsor (vehicleType ∈ sponsor.vehicules) est faite
   * par le use case avant d'appeler cette méthode.
   */
  addVehicle(vehicleType: VehicleType, defaultImprovements: Improvement[]): Vehicle {
    const vehicle = new Vehicle(0, this.id, vehicleType, [], defaultImprovements);
    this._vehicles.push(vehicle);
    return vehicle;
  }

  removeVehicle(vehicleId: number): void {
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

  // ── Mutations Weapon (déléguées au Vehicle) ───────────────────────────────────

  addWeaponToVehicle(vehicleId: number, weaponType: WeaponType, orientation: Orientation | null): void {
    const vehicle = this.findVehicle(vehicleId);
    vehicle.addWeapon(weaponType, orientation, this.remainingBudget);
  }

  removeWeaponFromVehicle(vehicleId: number, weaponId: number): void {
    const vehicle = this.findVehicle(vehicleId);
    vehicle.removeWeapon(weaponId);
  }

  // ── Mutations Improvement (déléguées au Vehicle) ──────────────────────────────

  addImprovementToVehicle(vehicleId: number, improvementType: ImprovementType, orientation: Orientation | null): void {
    const vehicle = this.findVehicle(vehicleId);
    vehicle.addImprovement(improvementType, orientation, this.remainingBudget);
  }

  removeImprovementFromVehicle(vehicleId: number, improvementId: number): void {
    const vehicle = this.findVehicle(vehicleId);
    vehicle.removeImprovement(improvementId);
  }

  assignWeaponToTourelle(vehicleId: number, improvementId: number, weaponType: WeaponType): void {
    const vehicle = this.findVehicle(vehicleId);
    vehicle.assignWeaponToTourelle(improvementId, weaponType, this.remainingBudget);
  }

  unassignWeaponFromTourelle(vehicleId: number, improvementId: number): void {
    const vehicle = this.findVehicle(vehicleId);
    vehicle.unassignWeaponFromTourelle(improvementId);
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
    orientation: Orientation | null,
    campaignId: number,
  ): Weapon {
    return this.findVehicle(vehicleId).addCampaignWeapon(weaponType, orientation, campaignId);
  }

  /** Retire une arme par son id d'un véhicule spécifique. */
  removeCampaignWeapon(vehicleId: number, weaponId: number): void {
    this.findVehicle(vehicleId).removeWeapon(weaponId);
  }

}

// Ré-export pour que les consumers importent depuis team.ts sans connaître vehicle.ts
export { DomainException } from './vehicle';
