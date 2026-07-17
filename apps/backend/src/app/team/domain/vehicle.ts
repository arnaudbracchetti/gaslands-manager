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
import { Sequella } from './sequella';
import type {
  PlacementCandidate,
  PlacementContext,
  VehicleStats,
  VehicleStatsSummary,
} from './behaviors/equipment-behavior';

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
   * Séquelles actives sur ce véhicule (mode campagne). Entités enfants (`Sequella`),
   * miroir d'`Advantage` — mêmes mécaniques `isSold`/prix jamais réduit (perte totale).
   * Maintenues en ordre d'application — pliées en premier dans `effectiveStats` via une
   * Strategy `SequellaBehavior` (cf. `domain/behaviors/sequella-behaviors.ts`).
   */
  private readonly _sequellas: Sequella[] = [];

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

  get sequellas(): readonly Sequella[] {
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

  /**
   * Capacité effective moins emplacements consommés. La capacité n'est plus toujours
   * `this.type.slots` brut : certaines améliorations (Remorque Moyenne/Lourde) l'augmentent
   * via `applyStats` (cf. `domain/behaviors/improvement-behaviors.ts`) — `effectiveStats`
   * plie l'état ACTUEL du véhicule (jamais le candidat en cours de test, cf.
   * `canAddImprovement`/`canAddWeapon`, appelés avant tout `push` sur `_improvements`).
   * Pour un véhicule sans amélioration de capacité, égal exactement à `type.slots`.
   */
  private get availableSlots(): number {
    return this.effectiveStats.emplacements - this.usedSlots;
  }

  // ── Stats effectives et récapitulatif (remplace l'ancien Pattern Decorator) ───

  /** Profil catalogue brut — jamais modifié par une séquelle/amélioration/avantage. */
  get baseStats(): VehicleStats {
    return {
      nom_interne: this.type.nomInterne,
      poids: this.type.poids,
      carrosserie: this.type.carrosserie,
      manoeuvrabilite: this.type.manoeuvrabilite,
      vitesse_max: this.type.vitesseMax,
      equipage: this.type.equipage,
      emplacements: this.type.slots,
    };
  }

  /**
   * Profil effectif complet : base → séquelles actives → améliorations actives →
   * avantages actifs. Un seul fold, dans cet ordre précis — les dommages permanents
   * (séquelles) s'appliquent avant les bonus d'équipement, eux-mêmes avant les
   * avantages, pour que Cascadeur/Sur Deux Roues (qui lisent la Manœuvrabilité
   * effective) voient tout ce qui est déjà monté, sans exception de catégorie : aucune
   * règle du jeu ne justifie qu'une catégorie reste invisible à une autre, donc TOUT
   * appelant (validation d'une amélioration, d'un avantage, ou calcul de capacité) lit
   * ce même état complet — jamais un fold partiel.
   *
   * Chaque entité délègue son propre effet à son `applyStats` (Strategy GoF, cf.
   * `domain/behaviors/`) — `Vehicle` ne connaît plus le mécanisme de résolution, il se
   * contente d'appeler `applyStats` sur chaque objet actif.
   *
   * `isDefault` (estDefaut, amélioration intégrée) N'EST PAS filtré : un équipement
   * intégré applique quand même ses stats — seul `Vehicle.availableSlots` l'exclut des
   * emplacements. `isSold`/`isLost` sont filtrés à chaque étape (séquelles : `isSold`
   * uniquement, une séquelle ne se "perd" pas).
   */
  get effectiveStats(): VehicleStats {
    const apresSequellas = this._sequellas
      .filter((s) => !s.isSold)
      .reduce((stats, s) => s.applyStats(stats), this.baseStats);

    const apresAmeliorations = this._improvements
      .filter((i) => !i.isSold && !i.isLost)
      .reduce((stats, i) => i.applyStats(stats), apresSequellas);

    return this._advantages
      .filter((a) => !a.isSold && !a.isLost)
      .reduce((stats, a) => a.applyStats(stats), apresAmeliorations);
  }

  /**
   * Récapitulatif affichable : une ligne par équipement (châssis compris), y compris les
   * objets vendus/perdus — ils restent visibles par leur nom, sans effet sur les stats.
   * Totalement découplé des Strategy (pur mapping de noms, jamais `applyStats`/`canPlace`).
   */
  describe(): VehicleStatsSummary[] {
    return [
      { nom: this.type.nom },
      ...this._sequellas.map((s) => ({ nom: s.type.nom })),
      ...this._improvements.map((i) => ({ nom: i.type.nom })),
      ...this._advantages.map((a) => ({ nom: a.type.nom })),
    ];
  }

  /**
   * Contexte de validation pour un candidat amélioration de `comportement` donné :
   * `installedCount`/`hasOrientation` sont scopés à ce SEUL comportement, calculés ici
   * une fois pour toutes — aucune Strategy n'a besoin de connaître sa propre clé de
   * registre pour se compter elle-même.
   */
  private buildImprovementPlacementContext(comportement: string | undefined): PlacementContext {
    const active = this._improvements.filter((i) => !i.isSold && !i.isLost);
    const same = active.filter((i) => i.type.comportement === comportement);
    return {
      baseStats: this.baseStats,
      currentStats: this.effectiveStats,
      installedCount: same.length,
      hasOrientation: (o) => same.some((i) => i.orientation === o),
      hasComportementAmong: (comportements) =>
        active.some((i) => comportements.includes(i.type.comportement ?? '')),
    };
  }

  /** Mirroir de `buildImprovementPlacementContext` pour les avantages (jamais d'orientation). */
  private buildAdvantagePlacementContext(comportement: string | undefined): PlacementContext {
    const active = this._advantages.filter((a) => !a.isSold && !a.isLost);
    const same = active.filter((a) => a.type.comportement === comportement);
    return {
      baseStats: this.baseStats,
      currentStats: this.effectiveStats,
      installedCount: same.length,
      hasOrientation: () => false,
      hasComportementAmong: (comportements) =>
        active.some((a) => comportements.includes(a.type.comportement ?? '')),
    };
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
    // Règle de pose spécifique à ce SEUL comportement (incompatibilité véhicule, unicité,
    // orientation exclusive, équipage max…) — Strategy GoF, déléguée par `type` lui-même
    // (cf. `ImprovementType.canPlace`) ; invoquée une seule fois pour le candidat, jamais
    // de re-validation des couches déjà montées.
    const candidate: PlacementCandidate = { nomInterne: type.nomInterne, nom: type.nom, orientation };
    const placement = type.canPlace(this.buildImprovementPlacementContext(type.comportement), candidate);
    if (!placement.ok) return fail(placement.reason);
    return ok();
  }

  /**
   * Règle de pose d'un avantage : garde véhicule perdu, budget, puis UNICITÉ (un même
   * avantage ne peut être acquis qu'une fois par véhicule — règle générique, propre aux
   * avantages, vérifiée ici plutôt que dans une Strategy puisqu'elle s'applique à TOUS
   * les avantages, pas à un `comportement` particulier). Pas de check d'emplacements
   * (un avantage n'en occupe jamais), pas de paramètre orientation (jamais requise).
   * Délègue ensuite à la Strategy du candidat pour les 2 restrictions spécifiques
   * (Cascadeur, Sur Deux Roues), qui lisent la Manœuvrabilité EFFECTIVE (améliorations
   * ET avantages déjà montés, cf. `buildAdvantagePlacementContext`/`effectiveStats`).
   */
  canAddAdvantage(type: AdvantageType, remainingBudget: number): RuleResult {
    if (this._isLost) return fail('Ce véhicule est hors combat — équipement impossible');
    // Idem pour un véhicule vendu en atelier — cf. canAddWeapon.
    if (this._isSold) return fail('Ce véhicule est vendu — équipement impossible');

    if (type.price > remainingBudget) {
      return fail('Budget de l\'équipe insuffisant');
    }
    if (this._advantages.some((a) => !a.isSold && !a.isLost && a.type.equals(type))) {
      return fail(`"${type.nom}" est déjà acquis sur ce véhicule`);
    }
    const candidate: PlacementCandidate = { nomInterne: type.nomInterne, nom: type.nom, orientation: null };
    const placement = type.canPlace(this.buildAdvantagePlacementContext(type.comportement), candidate);
    if (!placement.ok) return fail(placement.reason);
    return ok();
  }

  /**
   * Règle d'achat d'une séquelle en atelier (mode campagne) : garde véhicule
   * perdu/vendu, origine (une séquelle `TABLE_EPAVES` ne peut être imposée que par un
   * tirage de la Table des Épaves, jamais achetée directement), unicité (comme
   * `canAddAdvantage`, une même séquelle `ATELIER` ne peut être acquise deux fois),
   * puis Chocs suffisants — monnaie propre au véhicule, distincte du budget Jerricans
   * de l'équipe (`remainingBudget`), donc pas de paramètre budget ici.
   */
  canAddSequella(type: SequellaType): RuleResult {
    if (this._isLost) return fail('Ce véhicule est hors combat — équipement impossible');
    if (this._isSold) return fail('Ce véhicule est vendu — équipement impossible');

    if (type.origine !== 'ATELIER') {
      return fail('Cette séquelle ne peut être imposée que par un tirage de la Table des Épaves');
    }
    if (this._sequellas.some((s) => !s.isSold && s.type.origine === 'ATELIER' && s.type.equals(type))) {
      return fail(`"${type.nom}" est déjà acquise sur ce véhicule`);
    }
    if (type.chocsCost > this._chocs) {
      return fail(`Chocs insuffisants (solde actuel : ${this._chocs}, coût : ${type.chocsCost})`);
    }
    return ok();
  }

  /**
   * Garde d'achat d'une séquelle, version levée - pendant symétrique de
   * `CampaignParticipant.assertCanAfford` (cagnotte) pour la monnaie Chocs : déroule le
   * verdict `canAddSequella` et exige en plus, pour la séquelle "Dur à Cuire", que
   * l'avantage gratuit bundlé ait été choisi (un seul événement porte les deux effets).
   * Cette dernière règle vit ici plutôt que dans le use case - c'est un invariant de
   * l'ajout de cette séquelle, pas de l'orchestration. Lève `DomainException` sinon.
   */
  assertCanAddSequella(type: SequellaType, freeAdvantageType: AdvantageType | null): void {
    const result = this.canAddSequella(type);
    if (!result.ok) throw new DomainException(result.reason);
    if (type.nomInterne === 'dur_a_cuire' && !freeAdvantageType) {
      throw new DomainException('Un avantage gratuit doit être choisi pour "Dur à Cuire".');
    }
  }

  /**
   * Règle de revente d'une séquelle pré-existante (hors session d'atelier en cours,
   * cf. `Game.changeEquipment` pour la distinction annulation/revente). Contrairement
   * à une arme/amélioration/avantage, cette revente est **fermée par défaut** — une
   * séquelle représente un dommage ou trait permanent, pas un objet ordinaire. Elle ne
   * s'ouvre que si ce véhicule porte encore la séquelle "Légende Vivante" active :
   * son détenteur peut alors se défaire de ses anciennes séquelles.
   */
  canRemoveSequella(): RuleResult {
    if (!this.hasActiveSequella('legende_vivante')) {
      return fail(
        'Cette séquelle ne peut pas être revendue : seule la présence de la séquelle ' +
          '"Légende Vivante" sur ce véhicule ouvre la revente des séquelles pré-existantes.',
      );
    }
    return ok();
  }

  /** Une séquelle de ce nom_interne est-elle active (non vendue) sur ce véhicule ? */
  hasActiveSequella(nomInterne: string): boolean {
    return this._sequellas.some((s) => !s.isSold && s.type.nomInterne === nomInterne);
  }

  /**
   * Verdict de disponibilité d'une amélioration ORIENTABLE, tolérant à l'arc précis :
   * on tente d'abord sans orientation (`null`), puis — si ça échoue potentiellement à
   * cause du seul "orientation requise" (Bélier…) — chaque arc à tour de rôle.
   *
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

  /**
   * Retire une séquelle par son id — undo d'un achat (BUY) de cette session, mirroir
   * de `removeAdvantage`. Une revente (SELL) d'une séquelle pré-existante ne passe
   * jamais par ici : elle marque `isSold` (cf. `markSequellaSold`), ne retire rien.
   */
  removeSequella(sequellaId: number): void {
    const index = this._sequellas.findIndex((s) => s.id === sequellaId);
    if (index === -1) throw new DomainException('Séquelle introuvable sur ce véhicule');
    this._sequellas.splice(index, 1);
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

  /** Mirroir de markWeaponSold/clearWeaponSold pour les séquelles — même mécanisme "perte totale" que les avantages. */
  markSequellaSold(sequellaId: number): void {
    this.findSequella(sequellaId).markSold();
  }

  clearSequellaSold(sequellaId: number): void {
    this.findSequella(sequellaId).clearSold();
  }

  /**
   * Marque vendu l'avantage gratuit accordé par la séquelle Dur à Cuire, s'il existe
   * encore et n'est pas déjà vendu — appelé quand cette séquelle elle-même est revendue
   * (cf. `EquipmentChangedEvent`, entityType SEQUELLE). Recherche par tag
   * (`Advantage.grantedBySequellaNomInterne`), pas par id : cet avantage n'a pas
   * d'existence propre côté appelant (créé dans le même événement que la séquelle).
   */
  markGrantedAdvantageSold(sequellaNomInterne: string): void {
    const advantage = this._advantages.find(
      (a) => a.grantedBySequellaNomInterne === sequellaNomInterne && !a.isSold,
    );
    advantage?.markSold();
  }

  /** Undo de markGrantedAdvantageSold. */
  clearGrantedAdvantageSold(sequellaNomInterne: string): void {
    const advantage = this._advantages.find(
      (a) => a.grantedBySequellaNomInterne === sequellaNomInterne && a.isSold,
    );
    advantage?.clearSold();
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
   *
   * `grantedBySequellaNomInterne` : renseigné uniquement pour l'avantage gratuit
   * accordé par la séquelle Dur à Cuire (cf. `EquipmentChangedEvent`) — `null` pour
   * un achat normal.
   */
  addCampaignAdvantage(type: AdvantageType, campaignId: number, grantedBySequellaNomInterne: string | null = null): Advantage {
    const advantage = new Advantage(campaignId, type, grantedBySequellaNomInterne);
    this._advantages.push(advantage);
    return advantage;
  }

  /**
   * Ajoute une séquelle avec un id explicite (D-S11 : id négatif = entité transiente
   * campagne) — mirroir d'addCampaignAdvantage. Ne passe PAS par `canAddSequella` :
   * cette validation vit dans `Game.changeEquipment()`, appelée avant la construction
   * de l'événement, jamais rejouée à l'écriture du replay (D-S11).
   */
  addCampaignSequella(type: SequellaType, campaignId: number): Sequella {
    const sequella = new Sequella(campaignId, type);
    this._sequellas.push(sequella);
    return sequella;
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

  private findSequella(id: number): Sequella {
    const sequella = this._sequellas.find((s) => s.id === id);
    if (!sequella) throw new DomainException('Séquelle introuvable sur ce véhicule');
    return sequella;
  }
}

// Ré-export pour rétrocompatibilité : les consumers existants importent DomainException
// depuis team/domain/vehicle ou team/domain/team sans avoir à changer leurs imports.
export { DomainException };
