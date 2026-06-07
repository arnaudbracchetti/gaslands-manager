/**
 * VehicleBuilder — composant "smart" de construction de véhicule en 2 étapes.
 *
 * Vit dans une `Modal` (projeté via `<ng-content>`, cf. `Teams.html`). Reçoit
 * l'équipe concernée en `input.required<Team>()`, orchestre tout le flux décrit
 * dans le plan d'architecture ("Décisions actées") :
 *
 *   Étape 1 — Choisir le véhicule parmi ceux autorisés par le sponsor
 *             → persistance IMMÉDIATE (`vehicleService.create`) dès le choix :
 *               un véhicule "nu" reste un véhicule valide en Gaslands.
 *   Étape 2 — Équiper ce véhicule d'armes et d'améliorations, chacune
 *             "enveloppée PUIS validée PUIS persistée" individuellement
 *             (le backend ne persiste que si `RuleResult.ok`, sinon 400).
 *
 * Ce découpage Smart/Dumb (cf. ARCHITECTURE.md §2.5) délègue tout l'affichage :
 *   - `VehicleChoiceCard`  : une carte de véhicule du catalogue (étape 1)
 *   - `EquipmentOption`    : une ligne d'arme OU d'amélioration (étape 2,
 *                            réutilisé pour les deux catalogues)
 *
 * Fermeture à mi-parcours ACCEPTÉE (cf. plan, "Décisions actées" §3) : `Teams`
 * recharge la liste dans tous les cas (`closeRequested` ET `finished`) pour
 * rafraîchir `vehicleCount` — peu importe l'étape où l'utilisateur s'arrête.
 */
import {
  Component,
  InputSignal,
  OnInit,
  OutputEmitterRef,
  Signal,
  WritableSignal,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
// HttpErrorResponse : type Angular pour les erreurs HTTP — `err.error?.message`
// extrait le corps JSON de la réponse d'erreur (cf. `register.ts`/`login.ts`,
// même convention pour lire le message porté par une `BadRequestException`).
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Team } from '../team.model';
import { CatalogService } from '../../catalog/catalog.service';
import { Sponsor, Vehicule } from '../../catalog/catalog.model';
import { VehicleService } from './vehicle.service';
import {
  AvailableImprovementDto,
  AvailableWeaponDto,
  EquipmentChoice,
  Vehicle,
} from './vehicle-builder.model';
import { VehicleChoiceCard } from './vehicle-choice-card/vehicle-choice-card';
import { EquipmentOption } from './equipment-option/equipment-option';

@Component({
  selector: 'app-vehicle-builder',
  standalone: true,
  imports: [VehicleChoiceCard, EquipmentOption],
  templateUrl: './vehicle-builder.html',
  styleUrl: './vehicle-builder.scss',
})
export class VehicleBuilder implements OnInit {
  private catalogService: CatalogService = inject(CatalogService);
  private vehicleService: VehicleService = inject(VehicleService);

  // ── Inputs / Outputs ────────────────────────────────────────────────────────

  /** L'équipe à laquelle on ajoute un véhicule — fournit le sponsor (filtre catalogue) et l'id (création). */
  team: InputSignal<Team> = input.required<Team>();

  /**
   * Émis quand l'utilisateur a terminé (bouton "Terminer" en étape 2).
   * `void` : seule l'intention de fermer compte — `Teams` recharge la liste
   * dans tous les cas (cf. en-tête, "Fermeture à mi-parcours acceptée").
   */
  finished: OutputEmitterRef<void> = output<void>();

  // ── Étape courante ──────────────────────────────────────────────────────────

  /** 1 = choix du véhicule, 2 = équipement. Type union littérale : aucune autre valeur n'a de sens. */
  step: WritableSignal<1 | 2> = signal<1 | 2>(1);

  // ── Catalogue du sponsor (chargé une fois, sert aux DEUX étapes) ────────────

  /**
   * Catalogue complet et déjà filtré du sponsor de l'équipe (`vehicules`/`armes`/
   * `ameliorations` autorisés — cf. `CatalogService.getSponsorByName`, doc).
   * `null` tant qu'il n'est pas chargé — toutes les sections de template attendent
   * cette valeur avant de s'afficher (`@if (sponsorCatalog(); as catalog)`).
   */
  sponsorCatalog: WritableSignal<Sponsor | null> = signal<Sponsor | null>(null);
  loadingCatalog: WritableSignal<boolean> = signal(true);
  catalogError: WritableSignal<string> = signal('');

  // ── Étape 1 : choix + création du véhicule ──────────────────────────────────

  /**
   * Le véhicule créé (entité BRUTE — `improvements`/`weapons` non enrichis,
   * cf. `vehicle-builder.model.ts`, doc de `Vehicle`). `null` tant que l'étape 1
   * n'est pas terminée ; mis à jour à chaque ajout d'arme/amélioration (le
   * backend retourne le véhicule rechargé — cf. `VehicleService.addWeapon` et
   * son mirroir `addImprovement`).
   */
  createdVehicle: WritableSignal<Vehicle | null> = signal<Vehicle | null>(null);
  creatingVehicle: WritableSignal<boolean> = signal(false);
  step1Error: WritableSignal<string> = signal('');

  // ── Étape 2 : équipement ─────────────────────────────────────────────────────

  availableWeapons: WritableSignal<AvailableWeaponDto[]> = signal<AvailableWeaponDto[]>([]);
  availableImprovements: WritableSignal<AvailableImprovementDto[]> = signal<AvailableImprovementDto[]>([]);
  loadingStep2: WritableSignal<boolean> = signal(false);
  step2Error: WritableSignal<string> = signal('');

  // ── Emplacements (computed) ──────────────────────────────────────────────────

  /**
   * Le véhicule du CATALOGUE correspondant au véhicule créé — résolu via
   * `nomInterne` pour l'affichage de l'étape 2 (nom, poids...). L'entité brute
   * `createdVehicle` ne porte que l'identifiant catalogue (cf. `Vehicle`, doc) :
   * c'est le catalogue déjà chargé qui connaît le nom affiché et les stats.
   * `null` tant que l'étape 1 n'est pas terminée ou si le catalogue n'a pas
   * encore répondu — gardes redondantes avec `emplacementsTotal` ci-dessous,
   * mais chacune sert un usage distinct (affichage vs calcul de capacité).
   */
  chosenVehicule: Signal<Vehicule | null> = computed((): Vehicule | null => {
    const vehicle = this.createdVehicle();
    const catalog = this.sponsorCatalog();
    if (!vehicle || !catalog) return null;

    return catalog.vehicules.find((v): boolean => v.nom_interne === vehicle.nomInterne) ?? null;
  });

  /**
   * Capacité totale du véhicule — résolue depuis le catalogue via `nomInterne`
   * (cf. `vehicle-builder.model.ts`, doc de `Vehicle` : l'entité brute ne porte
   * PAS cette information, seul le catalogue la connaît). Réutilise
   * `chosenVehicule` ci-dessus : même résolution, juste la lecture du champ change.
   */
  emplacementsTotal: Signal<number> = computed((): number => {
    return this.chosenVehicule()?.emplacements ?? 0;
  });

  /**
   * Emplacements actuellement consommés — pool PARTAGÉ entre armes et
   * améliorations (cf. SPECIFICATION.md §7 et le raisonnement du backend,
   * `VehicleService.improvementSlotsOf`/`weaponSlotsOf`). On reproduit ICI le
   * même calcul côté frontend, en recoupant chaque ligne installée
   * (`nomInterne`) avec le catalogue déjà chargé pour résoudre son `emplacement`
   * — exactement la "résolution `nomInterne → emplacement`" anticipée par le
   * plan d'architecture (cf. doc de `Vehicle`).
   */
  emplacementsUtilises: Signal<number> = computed((): number => {
    const vehicle = this.createdVehicle();
    const catalog = this.sponsorCatalog();
    if (!vehicle || !catalog) return 0;

    const weaponSlots = vehicle.weapons.reduce((sum: number, w): number => {
      const arme = catalog.armes.find((a): boolean => a.nom_interne === w.nomInterne);
      return sum + (arme?.emplacement ?? 0);
    }, 0);

    const improvementSlots = vehicle.improvements.reduce((sum: number, imp): number => {
      const amelioration = catalog.ameliorations.find((a): boolean => a.nom_interne === imp.nomInterne);
      return sum + (amelioration?.emplacement ?? 0);
    }, 0);

    return weaponSlots + improvementSlots;
  });

  // ── Cycle de vie ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadSponsorCatalog();
  }

  // ── Chargement du catalogue (sert aux deux étapes) ──────────────────────────

  /**
   * Charge le catalogue COMPLET du sponsor de l'équipe. Une seule requête pour
   * tout le builder : l'étape 1 a besoin de `vehicules`, l'étape 2 de `armes`/
   * `ameliorations` — et la résolution `nomInterne → emplacement` ci-dessus en
   * a besoin tout du long (cf. doc de `emplacementsUtilises`).
   */
  private loadSponsorCatalog(): void {
    this.loadingCatalog.set(true);
    this.catalogError.set('');

    this.catalogService.getSponsorByName(this.team().sponsor).subscribe({
      next: (sponsor: Sponsor): void => {
        this.sponsorCatalog.set(sponsor);
        this.loadingCatalog.set(false);
      },
      error: (): void => {
        this.catalogError.set('Impossible de charger le catalogue du sponsor. Réessayez.');
        this.loadingCatalog.set(false);
      },
    });
  }

  // ── Étape 1 : choix et création du véhicule ──────────────────────────────────

  /**
   * L'utilisateur a choisi un véhicule — persistance IMMÉDIATE (cf. en-tête,
   * "Décisions actées") : on crée l'entité en base dès ce choix, puis on bascule
   * vers l'étape 2 et on charge ses options d'équipement.
   */
  selectVehicle(vehicule: Vehicule): void {
    this.creatingVehicle.set(true);
    this.step1Error.set('');

    this.vehicleService.create(this.team().id, { nomInterne: vehicule.nom_interne }).subscribe({
      next: (vehicle: Vehicle): void => {
        this.createdVehicle.set(vehicle);
        this.creatingVehicle.set(false);
        this.step.set(2);
        this.loadStep2Data();
      },
      error: (err: HttpErrorResponse): void => {
        this.step1Error.set(err.error?.message ?? 'Impossible de créer ce véhicule. Réessayez.');
        this.creatingVehicle.set(false);
      },
    });
  }

  // ── Étape 2 : chargement et ajout d'équipement ───────────────────────────────

  /**
   * Charge les DEUX catalogues d'options (armes + améliorations) en parallèle —
   * `forkJoin` : un seul indicateur de chargement, un seul traitement d'erreur,
   * pour deux requêtes indépendantes qui n'ont aucune raison d'attendre l'une
   * l'autre (mirroir du choix `Promise.all` côté backend pour `vehicleCount`,
   * même raisonnement : indépendance ⇒ parallélisme).
   *
   * Rappelée après CHAQUE ajout réussi (cf. `addWeapon`/`addImprovement`) : les
   * verdicts de disponibilité dépendent de l'état du véhicule (emplacements
   * consommés, règles de pose) — ils doivent être recalculés à chaque changement.
   */
  private loadStep2Data(): void {
    const vehicle = this.createdVehicle();
    if (!vehicle) return;

    this.loadingStep2.set(true);
    this.step2Error.set('');

    forkJoin({
      weapons: this.vehicleService.getAvailableWeapons(vehicle.id),
      improvements: this.vehicleService.getAvailableImprovements(vehicle.id),
    }).subscribe({
      next: ({ weapons, improvements }): void => {
        this.availableWeapons.set(weapons);
        this.availableImprovements.set(improvements);
        this.loadingStep2.set(false);
      },
      error: (): void => {
        this.step2Error.set('Impossible de charger les équipements disponibles. Réessayez.');
        this.loadingStep2.set(false);
      },
    });
  }

  /**
   * Ajoute une arme — "envelopper PUIS valider PUIS persister" (cf. en-tête) :
   * le backend valide AVANT de persister, répond 400 avec `RuleResult.reason`
   * sinon. Succès : remplace `createdVehicle` par l'entité rechargée (nouvelle
   * arme incluse) et recharge les verdicts (les emplacements ont changé).
   */
  addWeapon(choice: EquipmentChoice): void {
    const vehicle = this.createdVehicle();
    if (!vehicle) return;

    this.step2Error.set('');

    this.vehicleService.addWeapon(vehicle.id, choice).subscribe({
      next: (updated: Vehicle): void => {
        this.createdVehicle.set(updated);
        this.loadStep2Data();
      },
      error: (err: HttpErrorResponse): void => {
        this.step2Error.set(err.error?.message ?? 'Impossible de monter cette arme. Réessayez.');
      },
    });
  }

  /** Ajoute une amélioration — mirroir exact de `addWeapon` ci-dessus (même contrat, même retour). */
  addImprovement(choice: EquipmentChoice): void {
    const vehicle = this.createdVehicle();
    if (!vehicle) return;

    this.step2Error.set('');

    this.vehicleService.addImprovement(vehicle.id, choice).subscribe({
      next: (updated: Vehicle): void => {
        this.createdVehicle.set(updated);
        this.loadStep2Data();
      },
      error: (err: HttpErrorResponse): void => {
        this.step2Error.set(err.error?.message ?? 'Impossible de poser cette amélioration. Réessayez.');
      },
    });
  }

  // ── Détection "orientation requise" (cf. doc complète sur `EquipmentOption.requiresOrientation`) ──

  /**
   * Une arme requiert une orientation ⟺ elle n'est pas de type `équipage`
   * (signal TYPÉ et fiable, directement lu sur `AvailableWeaponDto.type` —
   * cf. SPECIFICATION.md §5/§7, "360° automatique pour les armes d'équipage").
   */
  weaponNeedsOrientation(option: AvailableWeaponDto): boolean {
    return option.type !== 'équipage';
  }

  /**
   * Une amélioration requiert une orientation ⟺ le backend l'indique via le
   * SEUL signal qu'expose `AvailableImprovementDto` à ce sujet : le message
   * `raison`, "Une orientation est requise pour…" — un contrat TEXTUEL, documenté
   * explicitement comme tel par `VehicleService.getAvailableImprovements`
   * ("Note de conception" : `RuleResult` ne distingue pas "il manque une info"
   * de "c'est interdit", donc le message EST le signal). Pas de liste dupliquée
   * des comportements orientables (Bélier, Bélier Explosif...) ici — ce serait
   * reproduire côté frontend une connaissance qui n'appartient qu'au Décorateur.
   */
  improvementNeedsOrientation(option: AvailableImprovementDto): boolean {
    return option.raison?.startsWith('Une orientation est requise') ?? false;
  }

  // ── Fin du flux ──────────────────────────────────────────────────────────────

  /** L'utilisateur a terminé — `Teams` ferme la modale et recharge la liste (`vehicleCount`). */
  finish(): void {
    this.finished.emit();
  }
}
