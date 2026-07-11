/**
 * EquipmentManager — composant "smart" PARTAGÉ de gestion de l'équipement d'un véhicule.
 *
 * Extrait de la fusion de `VehicleBuilder` (étape 2) et `VehicleEditor` — qui
 * étaient, par leur propre aveu (commentaires "mirroir EXACT" répétés ~6 fois
 * dans l'ex-`vehicle-editor.ts`), DEUX COPIES de la même logique : chargement
 * des catalogues filtrés, calcul du pool d'emplacements partagé, ajout ET
 * retrait d'armes/améliorations, détection d'orientation requise, résolution
 * des noms affichés. Cette duplication est précisément ce qui a permis au bug
 * de création (cf. `VehicleService.create`, désormais corrigé) de naître sans
 * être détecté côté édition — d'où l'extraction : UNE seule implémentation,
 * testée une fois, valable pour les deux contextes (création ET édition).
 *
 * Le composant est volontairement IGNORANT du contexte qui l'héberge : il reçoit
 * un `Vehicle` déjà obtenu (peu importe qu'il vienne d'être créé ou chargé), un
 * catalogue déjà résolu, et l'équipe propriétaire — et notifie chaque mutation
 * réussie via `vehicleChanged`. C'est `VehicleConfigurator` (le parent) qui
 * décide d'où vient le véhicule et que faire de la version mise à jour — pattern
 * `locked`/flux unidirectionnel déjà documenté (ARCHITECTURE.md §2.5, "le parent
 * seul décide").
 *
 * Retrait TOUJOURS proposé — décision actée avec l'utilisateur (cf. plan,
 * "Pas de paramètre `allowRemoval`") : aucune règle métier ne distingue "retrait
 * permis" et "retrait interdit" selon le contexte. Le backend l'autorise sans
 * AUCUNE condition (`WeaponService.removeWeapon`/`VehicleService.removeImprovement`
 * — "retirer ne peut JAMAIS rendre une chaîne valide invalide"). La seule
 * justification de son absence côté création ("un véhicule fraîchement créé n'a
 * rien à retirer") n'est vraie qu'À L'INSTANT T de l'entrée en étape d'équipement
 * — elle s'effondre dès le premier ajout. Un paramètre de moins, une UX meilleure
 * (corriger une pose erronée sans fermer puis rouvrir la modale).
 */
import {
  Component,
  InputSignal,
  OutputEmitterRef,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Sponsor, Vehicule } from '../../../catalog/catalog.model';
import { EQUIPMENT_DATA_SOURCE, BudgetView, EquipmentDataSource } from '../equipment-data-source';
import {
  AvailableImprovementDto,
  AvailableWeaponDto,
  EquipmentChoice,
  Vehicle,
  VehicleImprovement,
  Weapon,
} from '../vehicle-builder.model';
import { EquipmentOption } from '../equipment-option/equipment-option';
import { TeamBudget } from './team-budget/team-budget';
import { VehicleCostSummary } from './vehicle-cost-summary/vehicle-cost-summary';
import { MountedEquipment } from './mounted-equipment/mounted-equipment';
import { ConfirmModal } from '../../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-equipment-manager',
  standalone: true,
  imports: [EquipmentOption, TeamBudget, VehicleCostSummary, MountedEquipment, ConfirmModal],
  templateUrl: './equipment-manager.html',
  styleUrl: './equipment-manager.scss',
})
export class EquipmentManager {
  /**
   * Source de données INJECTÉE par la route (token, cf. `EquipmentDataSource`) — le
   * composant ignore s'il parle au backend équipe (CRUD) ou atelier (event-sourcing).
   */
  private dataSource: EquipmentDataSource = inject(EQUIPMENT_DATA_SOURCE);

  // ── Inputs / Outputs ────────────────────────────────────────────────────────

  /**
   * Le véhicule à équiper — entité BRUTE (`improvements[]`/`weapons[]` toujours
   * des tableaux, cf. `vehicle-builder.model.ts`, doc de `Vehicle`), déjà
   * créée OU chargée par le parent. Ce composant ne sait pas comment elle a
   * été obtenue — il la reçoit, l'affiche, et notifie les mutations.
   */
  vehicle: InputSignal<Vehicle> = input.required<Vehicle>();

  /** Catalogue déjà chargé par le parent — pas de second chargement ici. */
  sponsorCatalog: InputSignal<Sponsor> = input.required<Sponsor>();

  /**
   * Budget fourni par le parent (cf. `BudgetView`) — `{ total, usedByOthers }`.
   * Remplace l'ancien couplage `team.cans` + `getAllForTeam` (F3) : le composant ne
   * connaît plus la notion d'équipe, juste un budget total et un coût "déjà consommé
   * ailleurs". Le parent choisit la sémantique (équipe : jerricans / atelier : cagnotte).
   */
  budget: InputSignal<BudgetView> = input.required<BudgetView>();

  /**
   * Vrai si le véhicule appartient à une équipe verrouillée (campagne qui n'est
   * plus EN_CONSTRUCTION) — désactive toute mutation (retrait, Tourelle). Défaut
   * `false` : ne change rien pour `AtelierVehiclePage`, qui ne renseigne jamais
   * cet input (le flux atelier doit rester pleinement fonctionnel).
   */
  locked: InputSignal<boolean> = input<boolean>(false);

  /**
   * Émis avec l'entité FRAÎCHE après CHAQUE mutation réussie — TOUTES les opérations
   * de la `EquipmentDataSource` (ajout ET retrait, tourelle incluse) renvoient le
   * véhicule mis à jour. Le parent met à jour son `vehicle` et le re-fournit en input —
   * flux unidirectionnel, ce composant ne mute jamais sa propre entrée.
   */
  vehicleChanged: OutputEmitterRef<Vehicle> = output<Vehicle>();

  // ── Équipement disponible (catalogues filtrés + verdicts) ───────────────────

  availableWeapons: WritableSignal<AvailableWeaponDto[]> = signal<AvailableWeaponDto[]>([]);
  availableImprovements: WritableSignal<AvailableImprovementDto[]> = signal<AvailableImprovementDto[]>([]);
  loadingEquipment: WritableSignal<boolean> = signal(false);
  equipmentError: WritableSignal<string> = signal('');

  // ── Confirmations de retrait ────────────────────────────────────────────────

  /** Arme en attente de confirmation de retrait (null = aucune) */
  pendingRemoveWeapon: WritableSignal<Weapon | null> = signal<Weapon | null>(null);

  /** Amélioration en attente de confirmation de retrait (null = aucune) */
  pendingRemoveImprovement: WritableSignal<VehicleImprovement | null> = signal<VehicleImprovement | null>(null);

  // ── Filtrage des options définitivement indisponibles ───────────────────────

  /**
   * Affiche ou masque les options du catalogue refusées DÉFINITIVEMENT
   * (sponsor incompatible, emplacements insuffisants, règle de pose...).
   * `false` par défaut : la liste se concentre sur ce qui est réellement
   * ajoutable — un bouton ("Afficher les indisponibles (N)") permet de les
   * révéler grisées avec leur raison, comme avant l'introduction du filtre.
   */
  showUnavailable: WritableSignal<boolean> = signal(false);

  /**
   * Armes masquées par le filtre — celles dont le refus est DÉFINITIF
   * (`!disponible` ET pas seulement "orientation manquante", cf.
   * `weaponNeedsOrientation`). Calculé indépendamment de `showUnavailable()`
   * pour que le compteur du bouton reste correct même une fois la liste révélée.
   */
  hiddenWeaponsCount: Signal<number> = computed((): number => {
    return this.availableWeapons().filter(
      (w): boolean => !w.disponible && !this.weaponNeedsOrientation(w),
    ).length;
  });

  /** Mirroir exact de `hiddenWeaponsCount` pour les améliorations. */
  hiddenImprovementsCount: Signal<number> = computed((): number => {
    return this.availableImprovements().filter(
      (i): boolean => !i.disponible && !this.improvementNeedsOrientation(i),
    ).length;
  });

  /** Total toutes catégories confondues — affiché dans le libellé du bouton. */
  hiddenCount: Signal<number> = computed((): number => {
    return this.hiddenWeaponsCount() + this.hiddenImprovementsCount();
  });

  /**
   * Armes effectivement affichées : toujours celles disponibles ou nécessitant
   * juste une orientation (ce n'est pas un refus, cf. doc de
   * `weaponNeedsOrientation`) ; les refus définitifs ne s'ajoutent que si
   * `showUnavailable()` est activé.
   */
  visibleWeapons: Signal<AvailableWeaponDto[]> = computed((): AvailableWeaponDto[] => {
    const all = this.availableWeapons();
    if (this.showUnavailable()) return all;
    return all.filter((w): boolean => w.disponible || this.weaponNeedsOrientation(w));
  });

  /** Mirroir exact de `visibleWeapons` pour les améliorations. */
  visibleImprovements: Signal<AvailableImprovementDto[]> = computed((): AvailableImprovementDto[] => {
    const all = this.availableImprovements();
    if (this.showUnavailable()) return all;
    return all.filter((i): boolean => i.disponible || this.improvementNeedsOrientation(i));
  });

  // ── Emplacements (computed) — fusion à l'identique des deux mirroirs ─────────
  // (cf. en-têtes d'origine pour le raisonnement complet : pool PARTAGÉ entre
  // armes et améliorations, résolution `nomInterne → emplacement` via le
  // catalogue déjà chargé — SPECIFICATION.md §7 et `VehicleService.improvementSlotsOf`/`weaponSlotsOf`).

  /** Le véhicule du CATALOGUE correspondant — résolu via `nomInterne` pour l'affichage (nom, poids...). */
  chosenVehicule: Signal<Vehicule | null> = computed((): Vehicule | null => {
    const catalog = this.sponsorCatalog();
    return catalog.vehicules.find((v): boolean => v.nom_interne === this.vehicle().nomInterne) ?? null;
  });

  /** Capacité totale du véhicule — résolue depuis le catalogue (l'entité brute ne la porte pas). */
  emplacementsTotal: Signal<number> = computed((): number => {
    return this.chosenVehicule()?.emplacements ?? 0;
  });

  /** Emplacements actuellement consommés — somme des deux pools (armes + améliorations), partagés. */
  emplacementsUtilises: Signal<number> = computed((): number => {
    const vehicle = this.vehicle();
    const catalog = this.sponsorCatalog();

    // Armes classiques (entités Weapon) — y compris celles montées sur Tourelle
    // (`orientation: 'tourelle'`), qui consomment le même emplacement catalogue
    // qu'une arme normale (seul le coût est ×3, cf. `Weapon.price` backend).
    // `sold` (atelier uniquement, jamais posé côté construction d'équipe) libère
    // l'emplacement — l'arme reste affichée (barrée) mais n'est physiquement plus
    // sur le véhicule, contrairement au coût qui reste inclus (prix résiduel
    // auto-ajustant côté backend, cf. `Weapon.price`).
    const weaponSlots = vehicle.weapons
      .filter((w): boolean => !w.sold)
      .reduce((sum: number, w): number => {
        const arme = catalog.armes.find((a): boolean => a.nom_interne === w.nomInterne);
        return sum + (arme?.emplacement ?? 0);
      }, 0);

    // `improvement.emplacement` est résolu côté backend (getter de l'entité hydratée) :
    // 0 pour les améliorations par défaut, valeur catalogue pour les autres. Le frontend
    // additionne directement, sans consulter le catalogue ni filtrer les défauts —
    // cohérence garantie avec VehicleService.improvementSlotsOf() (cf. VEHICLE_SYSTEM.md §6).
    // `?? 0` : garde-fou si le champ est absent de la réponse (backend non redémarré
    // après une mise à jour du DTO — évite NaN dans l'affichage).
    const improvementSlots = vehicle.improvements.reduce((sum: number, imp): number => {
      return sum + (imp.emplacement ?? 0);
    }, 0);

    return weaponSlots + improvementSlots;
  });

  // ── Coût (computed) — carte récapitulative (en-tête de `.em-current`) ───────

  /** Prix de base du véhicule (catalogue) — `0` si `chosenVehicule` indisponible. */
  coutBase: Signal<number> = computed((): number => this.chosenVehicule()?.prix ?? 0);

  /**
   * Somme des prix EFFECTIFS des armes et améliorations montées. Les getters
   * backend (`Weapon.prix`, `VehicleImprovement.prix`) gèrent déjà le cas
   * `estDefaut` (0) et la Tourelle assignée (3× le prix de l'arme) — aucune
   * logique dupliquée ici, on additionne directement les `prix` du DTO.
   */
  coutEquipement: Signal<number> = computed((): number => {
    const vehicle = this.vehicle();
    const weaponsCost = vehicle.weapons.reduce((sum: number, w): number => sum + w.prix, 0);
    const improvementsCost = vehicle.improvements.reduce((sum: number, imp): number => sum + imp.prix, 0);
    return weaponsCost + improvementsCost;
  });

  /** Coût total du véhicule — prix de base + équipement monté. */
  coutTotal: Signal<number> = computed((): number => this.coutBase() + this.coutEquipement());

  // ── Budget de l'équipe (computed) — bloc "Budget de l'équipe" en tête de `.em-current__header` ──
  // Mirroir frontend de `VehicleService.getRemainingBudget` (backend) : la VALIDATION
  // (options trop chères marquées `disponible: false`, cf. `availableWeapons`/
  // `availableImprovements` ci-dessus) est déjà assurée par le backend — ce bloc est
  // purement INFORMATIF, pour situer le coût de CE véhicule dans le budget global.

  /** Budget total disponible — `budget().total` (jerricans d'équipe OU cagnotte d'atelier). */
  budgetEquipe: Signal<number> = computed((): number => this.budget().total);

  /**
   * Coût cumulé de TOUS les véhicules du budget, CE véhicule inclus : le coût "déjà
   * consommé ailleurs" (`budget().usedByOthers`, fourni par le parent) plus celui du
   * véhicule courant (`coutTotal`).
   */
  coutEquipeTotal: Signal<number> = computed((): number => this.budget().usedByOthers + this.coutTotal());

  /** Solde restant — peut être négatif (cf. `budgetDepasse`, filet de sécurité d'affichage). */
  budgetRestant: Signal<number> = computed((): number => this.budgetEquipe() - this.coutEquipeTotal());

  /**
   * `true` si le coût cumulé dépasse le budget. En principe jamais atteignable via
   * l'ajout d'équipement — la règle "Budget de l'équipe insuffisant" côté backend
   * marque par avance toute option trop chère `disponible: false`. Le montage sur
   * Tourelle (coût ×3) est validé par `Vehicle.canAddWeapon`/`addWeapon` au moment
   * de l'achat (HTTP 400 si le budget ne suit pas). Ce signal reste un filet de
   * sécurité d'affichage.
   */
  budgetDepasse: Signal<boolean> = computed((): boolean => this.budgetRestant() < 0);

  /** Pourcentage du budget consommé — borné à 100% pour la barre de progression (même en cas de dépassement). */
  budgetPourcentage: Signal<number> = computed((): number => {
    const budget = this.budgetEquipe();
    if (budget <= 0) return 100;
    return Math.min(100, Math.round((this.coutEquipeTotal() / budget) * 100));
  });

  // ── Réaction aux changements de véhicule ────────────────────────────────────

  /**
   * Recharge les verdicts de disponibilité à CHAQUE changement de `vehicle()` —
   * premier rendu, ajout OU retrait : dans tous les cas les emplacements
   * consommés et les règles de pose dépendent de l'état courant du véhicule
   * (cf. `effect()` dans le constructeur, pattern documenté ARCHITECTURE.md §2.5
   * pour réagir à un `input()` Signal).
   */
  constructor() {
    effect((): void => {
      // Lire `vehicle()` à l'intérieur de l'effet l'enregistre comme dépendance —
      // tout changement (premier rendu, ajout, retrait via `vehicleChanged` →
      // parent → nouvel input) redéclenche le chargement.
      this.vehicle();
      this.loadAvailableEquipment();
    });
  }

  // ── Chargement de l'équipement disponible ───────────────────────────────────

  /**
   * Charge les DEUX catalogues d'options (armes + améliorations) en parallèle —
   * `forkJoin` : un seul indicateur, un seul traitement d'erreur, deux requêtes
   * indépendantes (mirroir du choix `Promise.all` côté backend pour `vehicleCount`).
   */
  private loadAvailableEquipment(): void {
    const vehicle = this.vehicle();

    this.loadingEquipment.set(true);
    this.equipmentError.set('');

    forkJoin({
      weapons: this.dataSource.getAvailableWeapons(vehicle.id),
      improvements: this.dataSource.getAvailableImprovements(vehicle.id),
    }).subscribe({
      next: ({ weapons, improvements }): void => {
        this.availableWeapons.set(weapons);
        this.availableImprovements.set(improvements);
        this.loadingEquipment.set(false);
      },
      error: (): void => {
        this.equipmentError.set('Impossible de charger les équipements disponibles. Réessayez.');
        this.loadingEquipment.set(false);
      },
    });
  }

  // ── Ajout d'équipement ───────────────────────────────────────────────────────

  /**
   * Ajoute une arme — "envelopper PUIS valider PUIS persister" (cf. en-tête de
   * l'ex-`VehicleBuilder`) : succès ⇒ notifie le parent avec l'entité rechargée
   * (renvoyée directement par le backend, nouvelle arme incluse). Les verdicts
   * sont rechargés automatiquement par l'`effect()` du constructeur — inutile
   * de le faire ici explicitement (contrairement aux deux mirroirs d'origine).
   */
  addWeapon(choice: EquipmentChoice): void {
    const vehicle = this.vehicle();

    this.equipmentError.set('');

    this.dataSource.addWeapon(vehicle.id, choice).subscribe({
      next: (updated: Vehicle): void => this.vehicleChanged.emit(updated),
      error: (err: HttpErrorResponse): void => {
        this.equipmentError.set(err.error?.message ?? 'Impossible de monter cette arme. Réessayez.');
      },
    });
  }

  /** Ajoute une amélioration — mirroir exact d'`addWeapon` ci-dessus (même contrat, même retour). */
  addImprovement(choice: EquipmentChoice): void {
    const vehicle = this.vehicle();

    this.equipmentError.set('');

    this.dataSource.addImprovement(vehicle.id, choice).subscribe({
      next: (updated: Vehicle): void => this.vehicleChanged.emit(updated),
      error: (err: HttpErrorResponse): void => {
        this.equipmentError.set(err.error?.message ?? 'Impossible de poser cette amélioration. Réessayez.');
      },
    });
  }

  // ── Retrait d'équipement — toujours proposé (cf. en-tête, "Retrait TOUJOURS proposé") ──

  /**
   * Retire une arme — demande confirmation (`window.confirm`, mirroir de
   * `Teams.deleteTeam`), puis appelle l'API. AUCUNE vérification de règle
   * métier au préalable : retirer est TOUJOURS permis côté backend (cf. en-tête
   * de la classe). Succès : la `EquipmentDataSource` renvoie le véhicule mis à jour,
   * émis tel quel via `vehicleChanged`.
   */
  removeWeapon(weapon: Weapon): void {
    if (this.locked()) return;
    this.pendingRemoveWeapon.set(weapon);
  }

  onConfirmRemoveWeapon(): void {
    const weapon = this.pendingRemoveWeapon();
    this.pendingRemoveWeapon.set(null);
    if (!weapon) return;

    this.equipmentError.set('');

    this.dataSource.removeWeapon(this.vehicle().id, weapon.id).subscribe({
      next: (updated: Vehicle): void => this.vehicleChanged.emit(updated),
      error: (err: HttpErrorResponse): void => {
        this.equipmentError.set(err.error?.message ?? 'Impossible de retirer cette arme. Réessayez.');
      },
    });
  }

  /** Retire une amélioration — mirroir exact de `removeWeapon` ci-dessus. */
  removeImprovement(improvement: VehicleImprovement): void {
    if (this.locked()) return;
    this.pendingRemoveImprovement.set(improvement);
  }

  onConfirmRemoveImprovement(): void {
    const improvement = this.pendingRemoveImprovement();
    this.pendingRemoveImprovement.set(null);
    if (!improvement) return;

    const vehicle = this.vehicle();
    this.equipmentError.set('');

    this.dataSource.removeImprovement(vehicle.id, improvement.id).subscribe({
      next: (updated: Vehicle): void => this.vehicleChanged.emit(updated),
      error: (err: HttpErrorResponse): void => {
        this.equipmentError.set(err.error?.message ?? 'Impossible de retirer cette amélioration. Réessayez.');
      },
    });
  }

  // ── Résolution d'affichage (nomInterne → nom) ────────────────────────────────
  // `resolveWeaponSlot` a été déplacée dans `MountedEquipment` (seul composant
  // qui l'utilise désormais, via son input `sponsorCatalog`). `resolveWeaponName`/
  // `resolveImprovementName` restent ICI en plus de leur copie dans
  // `MountedEquipment` : `EquipmentManager` en a besoin pour le texte des
  // confirmations `window.confirm` (`removeWeapon`/`removeImprovement`), une
  // responsabilité que `MountedEquipment` (purement présentationnel) n'a pas.

  /**
   * Résout le nom AFFICHÉ d'une arme montée depuis son `nomInterne` — même
   * technique de recoupement que `buildVehicleSummary` (cf. son en-tête) :
   * l'entité brute ne porte que la clé catalogue stable, c'est le catalogue
   * déjà chargé qui connaît le nom présentable. Repli sur `nomInterne` brut si
   * l'entrée est introuvable (incohérence de données — on dégrade proprement
   * plutôt que de planter).
   */
  resolveWeaponName(nomInterne: string): string {
    return this.sponsorCatalog().armes.find((a): boolean => a.nom_interne === nomInterne)?.nom ?? nomInterne;
  }

  /** Résout le nom affiché d'une amélioration posée — mirroir exact de `resolveWeaponName`. */
  resolveImprovementName(nomInterne: string): string {
    return this.sponsorCatalog().ameliorations.find((a): boolean => a.nom_interne === nomInterne)?.nom ?? nomInterne;
  }

  /**
   * Prévisualisation CLIENT du montant remboursé en cas de revente (moitié prix arrondie
   * inférieur, p.170) — affichée dans le texte de confirmation avant le clic. Le serveur
   * reste seul décisionnaire du montant réel : cette valeur n'est jamais transmise à l'API.
   */
  previewSellAmount(prix: number): number {
    return Math.floor(prix / 2);
  }

  // ── Texte des modales de confirmation de retrait — annulation vs revente ────
  // `purchasedThisSession` (posé uniquement côté atelier, cf. `vehicle-builder.model.ts`)
  // distingue les deux cas ; en construction d'équipe il est toujours `undefined` (falsy),
  // donc le texte "Revendre" ne s'affiche jamais côté équipe puisque `removeWeapon`/
  // `removeImprovement` n'y sont même invoqués que sur des objets jamais "vendables"
  // au sens atelier — la distinction n'a de sens qu'en atelier.

  weaponRemovalMessage(weapon: Weapon): string {
    const nom = this.resolveWeaponName(weapon.nomInterne);
    if (weapon.purchasedThisSession) return `Annuler l'achat de "${nom}" ?`;
    return `Revendre "${nom}" pour ${this.previewSellAmount(weapon.prix)} jerricans (50%) ?`;
  }

  weaponRemovalConfirmLabel(): string {
    return 'Retirer';
  }

  improvementRemovalMessage(improvement: VehicleImprovement): string {
    const nom = this.resolveImprovementName(improvement.nomInterne);
    if (improvement.purchasedThisSession) return `Annuler l'achat de "${nom}" ?`;
    return `Revendre "${nom}" pour ${this.previewSellAmount(improvement.prix)} jerricans (50%) ?`;
  }

  improvementRemovalConfirmLabel(): string {
    return 'Retirer';
  }

  // ── Détection "orientation requise" (cf. doc complète sur `EquipmentOption.requiresOrientation`) ──

  /**
   * Une arme "requiert une orientation" ⟺ le backend l'indique via `raison` —
   * MÊME contrat textuel que `improvementNeedsOrientation` ci-dessous.
   *
   * ⚠️ On NE teste PAS `option.type !== 'équipage'` (ancienne approche). Cette
   * détection par type était TROMPEUSE : une arme non-équipage refusée pour manque
   * d'emplacements recevait `disponible: false` + `raison: "Emplacements insuffisants…"`,
   * mais `type !== 'équipage'` renvoyait quand même `true` → le template la traitait
   * comme "juste besoin d'une orientation" et affichait le bouton "Ajouter" au lieu
   * de la griser. Le contrat textuel est la seule source fiable : `raison` reflète
   * ce que `checkCandidate` a RÉELLEMENT retourné (cf. correctif `weapon.service.ts`,
   * ordre des règles : emplacements vérifiés AVANT l'orientation manquante).
   */
  weaponNeedsOrientation(option: AvailableWeaponDto): boolean {
    return option.raison?.startsWith('Une orientation est requise') ?? false;
  }

  /**
   * Une amélioration requiert une orientation ⟺ le backend l'indique via le
   * SEUL signal qu'expose `AvailableImprovementDto` à ce sujet : le message
   * `raison`, "Une orientation est requise pour…" — un contrat TEXTUEL, documenté
   * explicitement comme tel par `VehicleService.getAvailableImprovements`. Pas
   * de liste dupliquée des comportements orientables ici — ce serait reproduire
   * côté frontend une connaissance qui n'appartient qu'au Décorateur.
   */
  improvementNeedsOrientation(option: AvailableImprovementDto): boolean {
    return option.raison?.startsWith('Une orientation est requise') ?? false;
  }
}
