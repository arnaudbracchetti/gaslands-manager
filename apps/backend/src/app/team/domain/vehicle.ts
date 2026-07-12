import type { VehicleType } from './value-objects/vehicle-type';
import type { WeaponType } from './value-objects/weapon-type';
import type { ImprovementType } from './value-objects/improvement-type';
import type { AdvantageType } from './value-objects/advantage-type';
import type { Orientation, WeaponOrientation, RuleResult } from './team';
import { ok, fail } from './team';
import { Weapon } from './weapon';
import { Improvement } from './improvement';
import { Advantage } from './advantage';
import { DomainException } from '../../shared/domain/domain-exception';
import type { SequellaType } from './value-objects/sequella-type';
import { CatalogVehicleBuild } from './vehicle-build';
import type { VehicleBuild, InstalledImprovement } from './vehicle-build';
import { ImprovementDecoratorFactory } from './improvement-decorator.factory';
import { AdvantageDecoratorFactory } from './advantage-decorator.factory';
import type { Amelioration, Avantage } from '../../catalog/catalog.interfaces';

/** Les 4 arcs sondés par `canAddImprovementInAnyOrientation` pour un verdict de disponibilité. */
const ORIENTATIONS_A_SONDER: readonly Orientation[] = ['avant', 'arrière', 'gauche', 'droite'];

/**
 * Un véhicule appartenant à une équipe — entité enfant de l'agrégat Team.
 *
 * Vehicle ne gère ici que ses propres règles (emplacements, orientation des armes). Les règles
 * qui dépendent de données d'équipe (budget, sponsor) sont gérées par Team qui passe
 * les valeurs nécessaires en paramètre (pattern "tell, don't ask").
 */
export class Vehicle {
  
  private _isLost = false;
  private _isSold = false;
  
  /**
   * Ids des armes/améliorations/avantages marqués vendus PAR la revente de CE
   * véhicule (cascade de `markSold()`) — distincts de ceux déjà vendus
   * individuellement avant. Transient (D-S5), reconstruit à chaque replay
   * complet : `markSold()` recalcule ces listes en filtrant les enfants pas
   * encore vendus au moment de l'appel, ce qui est déterministe puisque le
   * replay rejoue toujours les mêmes événements dans le même ordre depuis un
   * état vierge. Permet à `clearSold()` (undo) de ne dé-marquer QUE ceux-là.
   */
  private _cascadeSoldWeaponIds: number[] = [];
  private _cascadeSoldImprovementIds: number[] = [];
  private _cascadeSoldAdvantageIds: number[] = [];
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
    private readonly _advantages: Advantage[] = [],
  ) {}

  get weapons(): readonly Weapon[] {
    return this._weapons;
  }

  get improvements(): readonly Improvement[] {
    return this._improvements;
  }

  get advantages(): readonly Advantage[] {
    return this._advantages;
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

  get isSold(): boolean {
    return this._isSold;
  }

  // ── Calculs ──────────────────────────────────────────────────────────────────

  /**
   * Coût total : prix du châssis + armes + améliorations achetées.
   *
   * Dans le cas d'un vehicule vendu, le cout calculé ici 
   * est prix résiduel une fois la vente réalisée `_isSold` —
   * même principe que `Weapon.price`/`Improvement.price` 
   */
  get cost(): number {
    const chassisCost = this._isSold ? Math.ceil(this.type.price / 2) : this.type.price;
    const weaponsCost = this._weapons.reduce((sum, w) => sum + w.price, 0);
    const improvementsCost = this._improvements.reduce((sum, i) => sum + i.price, 0);
    const advantagesCost = this._advantages.reduce((sum, a) => sum + a.price, 0);
    return chassisCost + weaponsCost + improvementsCost + advantagesCost;
  }

  /**
   * Montant remboursé si ce véhicule est revendu 
   * 
   * Ne s'applique qu'à la revente d'un véhicule PRÉ-EXISTANT — un
   * véhicule acheté PENDANT la session d'atelier en cours est annulé intégralement
   * (100 %), un cas distinct géré par `Game.changeEquipment` (cf. sa doc), pas ici.
   *
   * Les éléments déjà vendus (`isSold`) sont exclus de la somme : leur remboursement a
   * déjà été crédité au moment de LEUR vente individuelle — les resommer ici via
   * `resaleRefund` (qui recalculerait une fraction de leur prix déjà résiduel)
   * doublerait le remboursement.
   *
   * Précondition : ce véhicule ne doit pas être déjà vendu — `chassisRefund` est
   * calculé sur `this.type.price` (prix catalogue brut), jamais réduit par `_isSold`
   * contrairement à `Weapon`/`Improvement`. Un second appel après `markSold()`
   * calculerait donc un remboursement fantôme non nul plutôt que 0 — la garde
   * ci-dessous transforme ce bug silencieux en échec explicite.
   */
  get resaleRefund(): number {
    if (this._isSold) {
      throw new DomainException('Ce véhicule est déjà vendu — son remboursement a déjà été calculé et crédité.');
    }
    const chassisRefund = Math.floor(this.type.price / 2);
    const weaponsRefund = this._weapons
      .filter((w) => !w.isSold)
      .reduce((sum, w) => sum + w.resaleRefund, 0);
    const improvementsRefund = this._improvements
      .filter((i) => !i.isSold)
      .reduce((sum, i) => sum + i.resaleRefund, 0);
    // Avantages : resaleRefund vaut toujours 0 (perte totale), donc ce filtre ne change
    // jamais la somme — mais il reste nécessaire : un avantage déjà vendu individuellement
    // lève désormais une DomainException si on relit son resaleRefund (cf. Advantage.resaleRefund),
    // même filtrage que weapons/improvements ci-dessus, pour la même raison.
    const advantagesRefund = this._advantages
      .filter((a) => !a.isSold)
      .reduce((sum, a) => sum + a.resaleRefund, 0);
    return chassisRefund + weaponsRefund + improvementsRefund + advantagesRefund;
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
    // Idem pour un véhicule vendu en atelier (cf. markSold) — sans effet observable
    // aujourd'hui (un véhicule vendu est filtré de l'atelier, donc inatteignable
    // depuis l'UI), gardé par cohérence avec la garde _isLost ci-dessus.
    if (this._isSold) return fail('Ce véhicule est vendu — équipement impossible');

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
    // Idem pour un véhicule vendu en atelier — cf. canAddWeapon.
    if (this._isSold) return fail('Ce véhicule est vendu — équipement impossible');

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
    const placement = this.buildChain({ improvement: { type, orientation } }).validate();
    if (!placement.ok) return fail(placement.reason);
    return ok();
  }

  /**
   * Règle de pose d'un avantage : garde véhicule perdu, budget, puis UNICITÉ (un même
   * avantage ne peut être acquis qu'une fois par véhicule — règle générique, propre aux
   * avantages, vérifiée ici plutôt que dans un décorateur puisqu'elle s'applique à TOUS
   * les avantages, pas à un `comportement` particulier). Pas de check d'emplacements
   * (un avantage n'en occupe jamais), pas de paramètre orientation (jamais requise).
   * Délègue ensuite à la chaîne de décorateurs pour les 2 restrictions spécifiques
   * (Cascadeur, Sur Deux Roues) — la chaîne inclut aussi les améliorations déjà montées,
   * pour que ces restrictions lisent la Manœuvrabilité EFFECTIVE (cf. buildChain).
   */
  canAddAdvantage(type: AdvantageType, remainingBudget: number): RuleResult {
    if (this._isLost) return fail('Ce véhicule est hors combat — équipement impossible');
    // Idem pour un véhicule vendu en atelier — cf. canAddWeapon.
    if (this._isSold) return fail('Ce véhicule est vendu — équipement impossible');

    if (type.price > remainingBudget) {
      return fail('Budget de l\'équipe insuffisant');
    }
    if (this._advantages.some((a) => !a.isSold && a.type.equals(type))) {
      return fail(`"${type.nom}" est déjà acquis sur ce véhicule`);
    }
    const placement = this.buildChain({ advantage: { type } }).validate();
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
   * l'agrégat, afin de valider les règles de pose des améliorations ET des avantages.
   * Les améliorations par défaut (`estDefaut`) sont exclues : hors pool d'emplacements
   * (slots = 0 dans l'agrégat) et ne portant aucune de ces règles, les inclure
   * fausserait le contrôle d'emplacements interne de la chaîne (`validateGenerique`,
   * qui lit le prix catalogue brut).
   *
   * Plie `_improvements` PUIS `_advantages`, PUIS le candidat testé (amélioration OU
   * avantage — union discriminée, un seul des deux jamais fourni à la fois). Cet ordre
   * garantit que les restrictions de pose d'un avantage (Cascadeur, Sur Deux Roues —
   * Manœuvrabilité EFFECTIVE ≥ 3) voient le cumul des bonus de stats des couches du
   * dessous, qu'ils viennent d'une amélioration (Chenilles) ou d'un autre avantage déjà
   * acquis (Expertise).
   */
  private buildChain(
    candidate:
      | { improvement: { type: ImprovementType; orientation: Orientation | null } }
      | { advantage: { type: AdvantageType } },
  ): VehicleBuild {
    const installedImprovements: ReadonlyArray<{ raw: Amelioration; instance: InstalledImprovement }> = [
      ...this._improvements
        .filter((i) => !i.estDefaut)
        .map((i) => ({
          raw: i.type.toRaw(),
          instance: { nom_interne: i.type.nomInterne, orientation: i.orientation ?? undefined },
        })),
      ...('improvement' in candidate
        ? [
            {
              raw: candidate.improvement.type.toRaw(),
              instance: {
                nom_interne: candidate.improvement.type.nomInterne,
                orientation: candidate.improvement.orientation ?? undefined,
              },
            },
          ]
        : []),
    ];

    const installedAdvantages: ReadonlyArray<{ raw: Avantage; instance: InstalledImprovement }> = [
      ...this._advantages
        .filter((a) => !a.isSold)
        .map((a) => ({ raw: a.type.toRaw(), instance: { nom_interne: a.type.nomInterne } })),
      ...('advantage' in candidate
        ? [{ raw: candidate.advantage.type.toRaw(), instance: { nom_interne: candidate.advantage.type.nomInterne } }]
        : []),
    ];

    let build: VehicleBuild = new CatalogVehicleBuild(this.type.toRaw());
    for (const { raw, instance } of installedImprovements) {
      build = ImprovementDecoratorFactory.wrap(build, raw, instance);
    }
    for (const { raw, instance } of installedAdvantages) {
      build = AdvantageDecoratorFactory.wrap(build, raw, instance);
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

  addAdvantage(type: AdvantageType, remainingBudget: number): void {
    const result = this.canAddAdvantage(type, remainingBudget);
    if (!result.ok) throw new DomainException(result.reason);
    this._advantages.push(new Advantage(0, type));
  }

  removeAdvantage(advantageId: number): void {
    const index = this._advantages.findIndex((a) => a.id === advantageId);
    if (index === -1) throw new DomainException('Avantage introuvable sur ce véhicule');
    this._advantages.splice(index, 1);
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
   * Marque ce véhicule "vendu" (flag isSold, châssis à prix résiduel `ceil(prix/2)`,
   * cf. `cost`) plutôt que de le retirer de l'équipe — revente d'un véhicule
   * pré-existant en atelier (cf. annulation vs revente, campaign/domain/games/game.ts).
   * Idempotent.
   *
   * Cascade sur toute arme/amélioration/avantage PAS ENCORE vendu(e) : un véhicule
   * vendu doit voir tout son équipement vendu avec lui, par cohérence d'état — même
   * si `Advantage.price` ne varie jamais avec `isSold` (perte totale, cf. sa doc),
   * donc sans le moindre effet sur `cost` pour les avantages ; l'enjeu est
   * l'intégrité de l'état (ex. la garde d'unicité `canAddAdvantage` lit `!isSold`),
   * pas le calcul. Mémorise quels enfants ont été cascadés par CET appel
   * (`_cascadeSoldXxxIds`) pour que `clearSold()` ne dé-marque que ceux-là, pas un
   * enfant déjà vendu individuellement avant cette vente.
   */
  markSold(): void {
    if (this._isSold) return;
    this._isSold = true;
    this._cascadeSoldWeaponIds = this._weapons.filter((w) => !w.isSold).map((w) => w.id);
    this._cascadeSoldImprovementIds = this._improvements.filter((i) => !i.isSold).map((i) => i.id);
    this._cascadeSoldAdvantageIds = this._advantages.filter((a) => !a.isSold).map((a) => a.id);
    for (const id of this._cascadeSoldWeaponIds) this.findWeapon(id).markSold();
    for (const id of this._cascadeSoldImprovementIds) this.findImprovement(id).markSold();
    for (const id of this._cascadeSoldAdvantageIds) this.findAdvantage(id).markSold();
  }

  /** Undo de markSold() — ne dé-marque que les enfants cascadés par CETTE vente. */
  clearSold(): void {
    if (!this._isSold) return;
    this._isSold = false;
    for (const id of this._cascadeSoldWeaponIds) this.findWeapon(id).clearSold();
    for (const id of this._cascadeSoldImprovementIds) this.findImprovement(id).clearSold();
    for (const id of this._cascadeSoldAdvantageIds) this.findAdvantage(id).clearSold();
    this._cascadeSoldWeaponIds = [];
    this._cascadeSoldImprovementIds = [];
    this._cascadeSoldAdvantageIds = [];
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
   * Mirroir de markWeaponSold/clearWeaponSold pour les avantages. Contrairement aux
   * armes/améliorations, marquer un avantage vendu ne réduit jamais son `price` (cf.
   * `Advantage.price`) — le remboursement en atelier est donc toujours nul, sans code
   * de calcul séparé (mécanisme "perte totale").
   */
  markAdvantageSold(advantageId: number): void {
    this.findAdvantage(advantageId).markSold();
  }

  clearAdvantageSold(advantageId: number): void {
    this.findAdvantage(advantageId).clearSold();
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
   * Remet tous les états transients de campagne à zéro (isLost, isSold, chocs,
   * séquelles). Appelé par Team.resetCampaignState() au début de chaque replay.
   */
  clearCampaignState(): void {
    this._isLost = false;
    this._isSold = false;
    this._cascadeSoldWeaponIds = [];
    this._cascadeSoldImprovementIds = [];
    this._cascadeSoldAdvantageIds = [];
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

  /**
   * Ajoute un avantage avec un id explicite (D-S11 : id négatif = entité transiente
   * campagne). Miroir d'addCampaignImprovement : ne passe PAS par les règles
   * (canAddAdvantage) — cohérent avec la limitation "Temps 2" déjà en place pour
   * armes/améliorations en atelier (seule la cagnotte est gardée à l'écriture).
   */
  addCampaignAdvantage(type: AdvantageType, campaignId: number): Advantage {
    const advantage = new Advantage(campaignId, type);
    this._advantages.push(advantage);
    return advantage;
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

  private findAdvantage(id: number): Advantage {
    const advantage = this._advantages.find((a) => a.id === id);
    if (!advantage) throw new DomainException('Avantage introuvable sur ce véhicule');
    return advantage;
  }
}

// Ré-export pour rétrocompatibilité : les consumers existants importent DomainException
// depuis team/domain/vehicle ou team/domain/team sans avoir à changer leurs imports.
export { DomainException };
