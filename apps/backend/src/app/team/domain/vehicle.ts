import type { VehicleType } from './value-objects/vehicle-type';
import type { WeaponType } from './value-objects/weapon-type';
import type { ImprovementType } from './value-objects/improvement-type';
import type { Orientation, WeaponOrientation, RuleResult } from './team';
import { ok, fail } from './team';
import { Weapon } from './weapon';
import { Improvement } from './improvement';
import { DomainException } from '../../shared/domain/domain-exception';
import type { SequellaType } from './value-objects/sequella-type';
import { CatalogVehicleBuild } from './vehicle-build';
import type { VehicleBuild, InstalledImprovement } from './vehicle-build';
import { ImprovementDecoratorFactory } from './improvement-decorator.factory';
import type { Amelioration } from '../../catalog/catalog.interfaces';

/** Les 4 arcs sondés par `canAddImprovementInAnyOrientation` pour un verdict de disponibilité. */
const ORIENTATIONS_A_SONDER: readonly Orientation[] = ['avant', 'arrière', 'gauche', 'droite'];

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

  canAddWeapon(type: WeaponType, orientation: WeaponOrientation | null, remainingBudget: number): RuleResult {
    // Garde de domaine : on ne peut pas équiper un véhicule perdu en campagne.
    if (this._isLost) return fail('Ce véhicule est hors combat — équipement impossible');

    const montageTourelle = orientation === 'tourelle';
    if (montageTourelle && !type.montableSurTourelle) {
      return fail('Cette arme ne peut pas être montée sur Tourelle');
    }

    const price = type.price * (montageTourelle ? 3 : 1);
    if (price > remainingBudget) {
      return fail('Budget de l\'équipe insuffisant');
    }
    if (type.slots > this.availableSlots) {
      return fail('Emplacements insuffisants sur ce véhicule');
    }

    if (!montageTourelle) {
      if (type.requiresOrientation && orientation === null) {
        return fail('Une orientation est requise pour cette arme');
      }
      if (!type.requiresOrientation && orientation !== null) {
        return fail('Les armes d\'équipage ne peuvent pas être orientées');
      }
    }
    return ok();
  }

  canAddImprovement(type: ImprovementType, orientation: Orientation | null, remainingBudget: number): RuleResult {
    // Garde de domaine : on ne peut pas équiper un véhicule perdu en campagne.
    if (this._isLost) return fail('Ce véhicule est hors combat — équipement impossible');

    if (type.price > remainingBudget) {
      return fail('Budget de l\'équipe insuffisant');
    }
    // Contrôle d'emplacements *global* (armes + améliorations) — la chaîne de décorateurs
    // ci-dessous ne connaît que les améliorations, donc ce garde reste porté par l'agrégat.
    if (type.slots > this.availableSlots) {
      return fail('Emplacements insuffisants sur ce véhicule');
    }
    if (type.requiresOrientation && orientation === null) {
      return fail('Une orientation est requise pour cette amélioration');
    }
    // Règles de pose spécifiques à l'amélioration (incompatibilités véhicule, unicité,
    // orientation exclusive, équipage max…), portées par la chaîne de décorateurs Gaslands.
    const placement = this.buildChain({ type, orientation }).validate();
    if (!placement.ok) return fail(placement.reason);
    return ok();
  }

  /**
   * Verdict de disponibilité d'une amélioration ORIENTABLE, tolérant à l'arc précis :
   * on tente d'abord sans orientation (`null`), puis — si ça échoue potentiellement à
   * cause du seul "orientation requise" (Bélier…) — chaque arc à tour de rôle.
   *
   * ⚠️ Quand un arc fonctionne, on ne renvoie PAS l'`ok()` de cet arc : l'appelant
   * (listing) n'a fait que sonder, il n'a pas choisi cette orientation pour de vrai.
   * On renvoie `direct` (l'échec initial "orientation requise") — c'est ce signal,
   * pas un `ok()` muet, que le frontend utilise pour savoir qu'il doit encore
   * demander l'arc à l'utilisateur avant tout ajout réel (même contrat que pour
   * les armes, cf. `GetAvailableWeaponsUseCase`/`equipment-manager.ts`). Un `ok()`
   * ici aurait fait sauter cette étape et provoqué un ajout sans orientation,
   * rejeté ensuite par `canAddImprovement` à l'écriture.
   * Disponible (verdict final `ok()`) seulement quand AUCUNE orientation n'est
   * requise ; sinon toujours `fail('Une orientation est requise…')` tant qu'AU
   * MOINS un arc passe, et la dernière raison d'échec si tous les arcs sont pris
   * — les autres règles de pose (incompatibilité véhicule, unicité, équipage
   * max…) grisent bien l'option puisqu'elles échouent quel que soit l'arc testé.
   *
   * Règle de LECTURE (verdict "cette amélioration est-elle proposable ?"), distincte de
   * `canAddImprovement` (règle d'ÉCRITURE pour un arc déjà choisi par l'appelant) — les
   * deux composent, cette méthode ne fait que sonder la première pour construire un
   * verdict agrégé. Utilisée par les use cases de listing (équipe ET atelier) : ne pas
   * dupliquer `ORIENTATIONS_A_SONDER` ni cette boucle côté application.
   */
  canAddImprovementInAnyOrientation(type: ImprovementType, remainingBudget: number): RuleResult {
    const direct = this.canAddImprovement(type, null, remainingBudget);
    if (direct.ok) return direct;

    let last: RuleResult = direct;
    for (const orientation of ORIENTATIONS_A_SONDER) {
      const result = this.canAddImprovement(type, orientation, remainingBudget);
      if (result.ok) return direct;
      last = result;
    }
    return last;
  }

  /**
   * Reconstruit la chaîne de décorateurs "véhicule monté" à partir de l'état de
   * l'agrégat, afin de valider les règles de pose des améliorations. Les améliorations
   * par défaut (`estDefaut`) sont exclues : hors pool d'emplacements (slots = 0 dans
   * l'agrégat) et ne portant aucune de ces règles, les inclure fausserait le contrôle
   * d'emplacements interne de la chaîne (`validateGenerique`, qui lit le prix catalogue brut).
   */
  private buildChain(candidate: { type: ImprovementType; orientation: Orientation | null }): VehicleBuild {
    const installed: ReadonlyArray<{ raw: Amelioration; instance: InstalledImprovement }> = [
      ...this._improvements
        .filter((i) => !i.estDefaut)
        .map((i) => ({
          raw: i.type.toRaw(),
          instance: { nom_interne: i.type.nomInterne, orientation: i.orientation ?? undefined },
        })),
      {
        raw: candidate.type.toRaw(),
        instance: { nom_interne: candidate.type.nomInterne, orientation: candidate.orientation ?? undefined },
      },
    ];

    let build: VehicleBuild = new CatalogVehicleBuild(this.type.toRaw());
    for (const { raw, instance } of installed) {
      build = ImprovementDecoratorFactory.wrap(build, raw, instance);
    }
    return build;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  addWeapon(type: WeaponType, orientation: WeaponOrientation | null, remainingBudget: number): void {
    const result = this.canAddWeapon(type, orientation, remainingBudget);
    if (!result.ok) throw new DomainException(result.reason);
    this._weapons.push(new Weapon(0, type, orientation, false));
  }

  removeWeapon(weaponId: number): void {
    const index = this._weapons.findIndex((w) => w.id === weaponId);
    if (index === -1) throw new DomainException('Arme introuvable sur ce véhicule');
    if (this._weapons[index].estDefaut) {
      throw new DomainException('Les armes intégrées au profil de base ne peuvent pas être retirées');
    }
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

  // ── Mutations campagne ────────────────────────────────────────────────────────

  /** Idempotent : marquer un véhicule déjà perdu n'a pas d'effet supplémentaire. */
  markLost(): void {
    this._isLost = true;
  }

  clearLost(): void {
    this._isLost = false;
  }

  /**
   * Marque une arme "vendue" (flag isSold, remboursement à moitié prix) plutôt que de la
   * retirer du véhicule (distinct de `removeWeapon`) — utilisé pour la revente d'un objet
   * pré-existant en atelier (cf. annulation vs revente, campaign/domain/games/game.ts).
   */
  markWeaponSold(weaponId: number): void {
    this.findWeapon(weaponId).markSold();
  }

  clearWeaponSold(weaponId: number): void {
    this.findWeapon(weaponId).clearSold();
  }

  /** Mirroir de markWeaponSold/clearWeaponSold pour les améliorations. */
  markImprovementSold(improvementId: number): void {
    this.findImprovement(improvementId).markSold();
  }

  clearImprovementSold(improvementId: number): void {
    this.findImprovement(improvementId).clearSold();
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
  addCampaignWeapon(weaponType: WeaponType, orientation: WeaponOrientation | null, campaignId: number): Weapon {
    const weapon = new Weapon(campaignId, weaponType, orientation, false);
    this._weapons.push(weapon);
    return weapon;
  }

  /**
   * Ajoute une amélioration avec un id explicite (D-S11 : id négatif = entité transiente
   * campagne). Miroir d'addCampaignWeapon : ne passe PAS par les règles (canAddImprovement).
   * `estDefaut: false` — une amélioration achetée en atelier n'est jamais intégrée au profil.
   */
  addCampaignImprovement(type: ImprovementType, orientation: Orientation | null, campaignId: number): Improvement {
    const improvement = new Improvement(campaignId, type, orientation, false);
    this._improvements.push(improvement);
    return improvement;
  }

  // ── Helpers privés ────────────────────────────────────────────────────────────

  private findWeapon(id: number): Weapon {
    const weapon = this._weapons.find((w) => w.id === id);
    if (!weapon) throw new DomainException('Arme introuvable sur ce véhicule');
    return weapon;
  }

  private findImprovement(id: number): Improvement {
    const imp = this._improvements.find((i) => i.id === id);
    if (!imp) throw new DomainException('Amélioration introuvable sur ce véhicule');
    return imp;
  }
}

// Ré-export pour rétrocompatibilité : les consumers existants importent DomainException
// depuis team/domain/vehicle ou team/domain/team sans avoir à changer leurs imports.
export { DomainException };
