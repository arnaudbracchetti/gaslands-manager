/**
 * VehicleBuild — modélisation d'un véhicule "monté" (Pattern Decorator du GoF).
 *
 * Le problème à résoudre : un véhicule Gaslands part d'un profil de base (catalogue)
 * puis accumule des améliorations, chacune pouvant à la fois MODIFIER ce profil
 * (ex: Chenilles change vitesse_max et manœuvrabilité) ET porter sa PROPRE règle de
 * pose (ex: "un seul Bélier par orientation", "Chenilles interdites sur Char d'Assaut").
 * Une approche "liste d'améliorations + grosse fonction qui calcule tout" éclaterait
 * vite : chaque nouvelle règle obligerait à toucher du code partagé par toutes les autres.
 *
 * Le Pattern Decorator répond exactement à ce besoin : on représente le véhicule monté
 * comme une CHAÎNE d'objets imbriqués, du véhicule nu (`CatalogVehicleBuild`) jusqu'à
 * la dernière amélioration posée. Chaque maillon implémente le MÊME contrat
 * (`VehicleBuild`) et délègue vers le maillon du dessous (`inner`) pour tout ce qui ne
 * le concerne pas. Un appelant qui tient un `VehicleBuild` ne sait jamais — et n'a pas
 * besoin de savoir — combien de couches il manipule : un véhicule nu et un véhicule à
 * 5 améliorations se traitent de façon RIGOUREUSEMENT identique.
 *
 * Pourquoi est-ce un bon choix pédagogique ici : chaque décorateur devient une petite
 * classe autonome qui se lit comme l'énoncé d'UNE règle du jeu — exactement la
 * structure qu'on souhaite pour des règles aussi disparates que celles de Gaslands.
 *
 * Voir le plan d'architecture (`ImprovementDecorator`, Template Method sur `validate`)
 * pour le détail du raisonnement et la correction d'un bug structurel de conception.
 */

import type { Amelioration, Vehicule } from '../catalog/catalog.interfaces';

// ── Résultat de validation ────────────────────────────────────────────────────

/**
 * Résultat d'une vérification de règle métier — succès, ou échec accompagné d'une
 * raison lisible. Un simple booléen perdrait le "pourquoi" : `reason` alimente à la
 * fois le message de l'erreur HTTP (`BadRequestException`) ET l'UI (ex: une infobulle
 * "pourquoi cette amélioration est grisée ?" sur la liste des options disponibles).
 *
 * Le type union discriminé (`ok: true` / `ok: false`) garantit, à la compilation,
 * que `reason` n'est accessible QUE dans le cas d'échec — pas besoin de `?` ni de
 * vérification supplémentaire côté appelant une fois `result.ok` testé.
 */
export type RuleResult = { ok: true } | { ok: false; reason: string };

/** Construit un résultat de succès. */
export function ok(): RuleResult {
  return { ok: true };
}

/** Construit un résultat d'échec, avec sa raison. */
export function fail(reason: string): RuleResult {
  return { ok: false, reason };
}

// ── Types de support ──────────────────────────────────────────────────────────

/**
 * Orientation directionnelle d'une amélioration installée sur le véhicule.
 * Les règles du jeu ("définissez l'orientation du Bélier comme pour une arme")
 * réutilisent les 4 arcs de tir standard de Gaslands.
 */
export type Orientation = 'avant' | 'arrière' | 'gauche' | 'droite';

/**
 * Sous-ensemble du profil d'un `Vehicule` (catalogue) réellement manipulé par les
 * décorateurs : ce que les améliorations peuvent MODIFIER (carrosserie, vitesse_max...)
 * et ce que les règles de validation consultent pour se prononcer (`nom_interne` pour
 * les incompatibilités véhicule, `poids` pour les restrictions de poids).
 *
 * On exclut volontairement `prix`/`description`/`regles`/`sponsors_autorises` : ce sont
 * des informations catalogue qui n'évoluent JAMAIS avec les améliorations — ce ne sont
 * pas des "stats" au sens du build (la gestion du budget est un sujet séparé, cf. plan §4).
 */
export interface VehicleStats {
  nom_interne: string;
  poids: 'Léger' | 'Moyen' | 'Lourd';
  carrosserie: number;
  manoeuvrabilite: number;
  vitesse_max: number;
  equipage: number;
  emplacements: number;
}

/** Une ligne du récapitulatif d'un véhicule monté — une par couche de la chaîne,
 *  du véhicule de base (en premier) jusqu'à la dernière amélioration posée. */
export interface VehicleStatsSummary {
  /** Nom affiché de la couche (nom du véhicule pour la base, nom de l'amélioration sinon). */
  nom: string;
}

/**
 * Une amélioration installée sur un véhicule — qu'elle soit déjà persistée
 * (`VehicleImprovement` chargée depuis la base) ou simplement candidate (vérification
 * à blanc, cf. `canAddImprovement`). `orientation` n'a de sens que pour les améliorations
 * qui occupent une position directionnelle exclusive (Bélier, Bélier Explosif...) —
 * elle reste `undefined` pour toutes les autres.
 */
export interface InstalledImprovement {
  nom_interne: string;
  orientation?: Orientation;
}

/** Options fournies lors de l'ajout d'une amélioration, au-delà de son identité catalogue. */
export interface BuildOptions {
  orientation?: Orientation;
}

// ── Le contrat : VehicleBuild ─────────────────────────────────────────────────

/**
 * Contrat commun à TOUS les maillons de la chaîne — le véhicule nu aussi bien que le
 * véhicule entièrement équipé. C'est ce contrat unique qui permet au code appelant de
 * traiter "véhicule + 0 amélioration" et "véhicule + n améliorations" de façon
 * rigoureusement identique : il ne voit jamais qu'un `VehicleBuild`, jamais une chaîne.
 */
export interface VehicleBuild {
  /** Profil actuel — accumulation des effets de toutes les couches de la chaîne. */
  readonly stats: VehicleStats;
  /** Profil d'ORIGINE du véhicule, avant toute amélioration. Sert de référence aux
   *  règles "en fonction de la valeur de départ" (ex: équipage max = 2× équipage initial,
   *  ou "ce véhicule est-il un Char d'Assaut ?" — une amélioration ne change pas l'identité
   *  du véhicule de base, donc cette question se pose toujours sur `baseStats`, pas `stats`). */
  readonly baseStats: VehicleStats;

  /** Récapitulatif affichable : une ligne par couche, du véhicule de base au sommet. */
  describe(): VehicleStatsSummary[];

  /** Combien de couches sont des instances de CE type de décorateur (regroupe automatiquement
   *  les variantes sponsor, qui partagent la même classe — cf. `ImprovementDecoratorFactory`). */
  countByType(type: DecoratorCtor): number;
  /** Une instance de CE type de décorateur occupe-t-elle déjà cette orientation ? */
  hasOrientationFor(type: DecoratorCtor, o: Orientation): boolean;
  /** Emplacements consommés par les améliorations de la chaîne (le véhicule de base en consomme 0). */
  totalEmplacements(): number;

  /**
   * Valide TOUTE la chaîne — chaque maillon vérifie SA propre cohérence, puis délègue
   * vers le dessous. Voir `ImprovementDecorator.validate` pour le détail du mécanisme
   * (Template Method) et le bug structurel qu'il corrige.
   */
  validate(): RuleResult;
}

/**
 * Type-constructeur d'un décorateur concret. Utilisé à deux endroits :
 *  - le regroupement par type (`countByType`/`hasOrientationFor`), qui compare sur
 *    `this.constructor` plutôt que sur l'identité catalogue (`nom_interne`) — ce qui
 *    regroupe naturellement les variantes sponsor sans rien ajouter au YAML ;
 *  - le registre de `ImprovementDecoratorFactory` (`comportement` → classe à instancier).
 */
export type DecoratorCtor = new (
  inner: VehicleBuild,
  amelioration: Amelioration,
  instance: InstalledImprovement,
) => ImprovementDecorator;

// ── Le maillon de base : le véhicule du catalogue, sans amélioration ──────────

/**
 * Premier maillon de toute chaîne — le véhicule "nu", tel que défini dans le catalogue.
 * N'a pas de couche `inner` : c'est le cas de base de la récursion qui structure toutes
 * les méthodes de `VehicleBuild` (chaque décorateur délègue vers `inner`, jusqu'à arriver
 * ici, où la délégation s'arrête).
 */
export class CatalogVehicleBuild implements VehicleBuild {
  constructor(private readonly catalogue: Vehicule) {}

  // `stats` et `baseStats` sont identiques ici : il n'y a encore AUCUNE amélioration
  // qui aurait pu faire diverger le profil actuel de son origine.
  get stats(): VehicleStats {
    return this.toStats();
  }

  get baseStats(): VehicleStats {
    return this.toStats();
  }

  describe(): VehicleStatsSummary[] {
    return [{ nom: this.catalogue.nom }];
  }

  // Aucune couche en dessous : par définition, le véhicule nu ne contient aucun décorateur.
  countByType(): number {
    return 0;
  }

  hasOrientationFor(): boolean {
    return false;
  }

  totalEmplacements(): number {
    return 0;
  }

  validate(): RuleResult {
    // Le véhicule de base ne porte aucune amélioration : il n'y a structurellement
    // rien à valider à ce niveau. La récursion de `ImprovementDecorator.validate`
    // s'arrête ici, toujours avec un succès.
    return ok();
  }

  /** Projette le `Vehicule` du catalogue vers le sous-ensemble `VehicleStats` manipulé par le build. */
  private toStats(): VehicleStats {
    return {
      nom_interne: this.catalogue.nom_interne,
      poids: this.catalogue.poids,
      carrosserie: this.catalogue.carrosserie,
      manoeuvrabilite: this.catalogue.manoeuvrabilite,
      vitesse_max: this.catalogue.vitesse_max,
      equipage: this.catalogue.equipage,
      emplacements: this.catalogue.emplacements,
    };
  }
}

// ── Le maillon générique : ImprovementDecorator (Template Method) ─────────────

/**
 * Classe abstraite commune à TOUTE amélioration installée. C'est le "Decorator"
 * du Pattern GoF : elle enveloppe un `VehicleBuild` existant (`inner`, protégé —
 * accessible aux sous-classes qui ont besoin d'interroger la chaîne du dessous) et
 * expose EXACTEMENT le même contrat `VehicleBuild`, ce qui permet l'empilement à
 * l'infini sans jamais changer le type manipulé par le code appelant.
 *
 * Template Method sur `validate()` : la SÉQUENCE de validation (règle générique
 * d'abord, puis règle spécifique au comportement, puis délégation vers le dessous)
 * est fixée ICI, une fois pour toutes. Chaque sous-classe ne fournit que
 * `validateSelf()` — "suis-je, moi, autorisé à exister à cet endroit de la chaîne ?"
 * — sans jamais avoir à se soucier ni du reste de la chaîne, ni de la question
 * "est-ce que je concerne le candidat qu'on est en train d'ajouter ?" (cette question
 * ne se pose plus : si `validateSelf` s'exécute, c'est que CE maillon EST le candidat,
 * ou un prédécesseur légitime — la présence dans la chaîne validée en tient lieu).
 */
export abstract class ImprovementDecorator implements VehicleBuild {
  constructor(
    protected readonly inner: VehicleBuild,
    protected readonly amelioration: Amelioration,
    protected readonly instance: InstalledImprovement,
  ) {}

  /**
   * Par défaut, je ne change rien au profil : j'accumule simplement ce que la couche
   * du dessous a déjà calculé. Les décorateurs qui MODIFIENT le profil (Chenilles,
   * Blindage, Membre d'Équipage...) overrident cet accesseur — toujours en partant de
   * `this.inner.stats` et en y appliquant LEUR effet, jamais en recalculant depuis zéro :
   * c'est cette discipline d'accumulation qui rend l'empilement cohérent à tout niveau.
   */
  get stats(): VehicleStats {
    return this.inner.stats;
  }

  /** Le profil de départ ne change jamais en cours de chaîne : je délègue simplement. */
  get baseStats(): VehicleStats {
    return this.inner.baseStats;
  }

  /** J'empile ma propre ligne (le nom de MON amélioration) sur le récapitulatif du dessous. */
  describe(): VehicleStatsSummary[] {
    return [...this.inner.describe(), { nom: this.amelioration.nom }];
  }

  /** Combien de couches — moi inclus — sont des instances de `type` ? Comparer sur le
   *  CONSTRUCTEUR (plutôt que `nom_interne`) regroupe automatiquement les variantes
   *  sponsor : la Factory instancie la même classe pour tout `comportement` identique. */
  countByType(type: DecoratorCtor): number {
    const mine = this.constructor === type ? 1 : 0;
    return mine + this.inner.countByType(type);
  }

  /** Moi, ou une couche en dessous de moi du même type, occupons-nous déjà cette orientation ? */
  hasOrientationFor(type: DecoratorCtor, o: Orientation): boolean {
    const mine = this.constructor === type && this.instance.orientation === o;
    return mine || this.inner.hasOrientationFor(type, o);
  }

  /** Mon propre coût en emplacements, plus celui de tout ce qui est en dessous de moi. */
  totalEmplacements(): number {
    return this.amelioration.emplacement + this.inner.totalEmplacements();
  }

  /**
   * Template Method — la séquence est FIXE et vit ici, dans la classe abstraite :
   *   1. règle GÉNÉRIQUE (capacité en emplacements — commune à TOUTE amélioration) ;
   *   2. règle SPÉCIFIQUE (`validateSelf`, propre à ce comportement précis) ;
   *   3. délégation vers le maillon du dessous (qui répète exactement la même séquence).
   *
   * Les étapes 1 et 2 s'exécutent pour CHAQUE maillon de la chaîne — y compris celui
   * qu'on vient d'ajouter pour le test (`canAddImprovement` enveloppe AVANT de valider :
   * le candidat fait donc partie intégrante de ce qu'on examine). Aucune règle ne peut
   * ainsi être contournée par "absence d'instance préalable" : le défaut qui aurait,
   * par exemple, laissé passer la toute première paire de Chenilles sans contrôle de
   * compatibilité véhicule (cf. plan, bug repéré sur la conception initiale).
   */
  validate(): RuleResult {
    const generique = this.validateGenerique();
    if (!generique.ok) return generique;
    const specifique = this.validateSelf();
    if (!specifique.ok) return specifique;
    return this.inner.validate();
  }

  /**
   * Règle commune à TOUTE amélioration, quelle que soit sa nature : la capacité du
   * véhicule en emplacements ne peut pas être dépassée. Vit dans la classe ABSTRAITE
   * (et non dans une sous-classe) précisément pour s'appliquer à chaque maillon sans
   * exception — un contrôle vraiment universel ne doit dépendre d'aucune sous-classe
   * particulière, sous peine de recréer le même trou que le bug structurel mentionné
   * ci-dessus pour une règle qui, elle, concerne TOUTES les améliorations.
   */
  private validateGenerique(): RuleResult {
    if (this.totalEmplacements() > this.baseStats.emplacements) {
      return fail(`Capacité d'emplacements dépassée (max ${this.baseStats.emplacements})`);
    }
    return ok();
  }

  /**
   * Par défaut : aucune règle propre — l'amélioration est toujours acceptée à ce niveau
   * (au-delà du contrôle générique de capacité, qui s'applique de toute façon). Chaque
   * comportement spécifique override cette méthode pour exprimer SA règle de pose,
   * et SA règle uniquement : "suis-je, moi, autorisé à être ici ?"
   */
  protected validateSelf(): RuleResult {
    return ok();
  }
}

// ── Le maillon neutre : amélioration sans effet de profil ni règle de pose ────

/**
 * Décorateur "par défaut" pour toute amélioration dont le catalogue ne déclare AUCUN
 * `comportement` (ex: Arceaux, Catapulte Improvisée, Remorque de Transport — des
 * améliorations purement narratives ou dont l'effet ne touche pas le profil chiffré
 * du véhicule). Elle occupe quand même un emplacement et apparaît dans `describe()`,
 * mais n'altère pas les statistiques et ne porte aucune règle de pose particulière —
 * exactement ce que `ImprovementDecorator` fait déjà par défaut, sans le moindre
 * override. D'où l'absence de corps de classe : ce vide EST le comportement recherché.
 */
export class NeutralDecorator extends ImprovementDecorator {}
