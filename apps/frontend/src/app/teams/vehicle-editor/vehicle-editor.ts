/**
 * VehicleEditor — composant "smart" de gestion de l'équipement d'un véhicule EXISTANT.
 *
 * Vit dans une `Modal` (projeté via `<ng-content>`, cf. `Teams.html`), au même
 * titre que `VehicleBuilder`. Reçoit l'équipe ET l'identifiant du véhicule visé
 * (`team`/`vehicleId`, tous deux `input.required`), ouvert depuis la liste de
 * véhicules d'une carte d'équipe (cf. `TeamCard.editVehicleClicked` → `Teams.
 * openVehicleEditor`).
 *
 * Mirroir DÉLIBÉRÉ de l'ÉTAPE 2 de `VehicleBuilder` (cf. son en-tête) : "modifier
 * un véhicule" (clarifié avec l'utilisateur, cf. plan — option choisie "Gérer
 * l'équipement") signifie ICI gérer ses armes et améliorations, PAS changer son
 * `nomInterne` — qui reste la clé catalogue immutable du véhicule (cf. SPECIFICATION.md
 * §5, "Vehicle" : la changer invaliderait tout l'équipement déjà posé, vérifié
 * contre le catalogue DE CE TYPE PRÉCIS). Toute la mécanique d'AJOUT (catalogues
 * disponibles, verdicts, sélecteur d'orientation, calcul des emplacements partagés)
 * est donc reprise À L'IDENTIQUE — ce composant y ajoute la capacité symétrique
 * de RETRAIT, qui n'existait nulle part côté frontend.
 *
 * Différence structurelle avec `VehicleBuilder` — chargement initial : le builder
 * CRÉE son véhicule (étape 1) et détient donc déjà l'entité ; cet éditeur reçoit
 * un `vehicleId` existant et doit la RECHARGER. Aucun endpoint ne renvoie
 * directement un `Vehicle` brut par id (`GET /api/vehicles/:id` renvoie un
 * `VehicleDetailDto` "monté", sans `improvements[]`/`weapons[]` bruts) — on
 * réutilise donc `vehicleService.getAllForTeam` + `.find()`, exactement comme
 * `Teams.loadVehicleSummaries` (cf. son en-tête) : même duo de requêtes en
 * parallèle (`forkJoin`), pour la même raison — véhicules bruts ET catalogue du
 * sponsor sont les deux ingrédients nécessaires pour résoudre `nomInterne → {nom, prix, emplacement}`.
 *
 * Retrait d'équipement — TOUJOURS permis côté backend (aucune "vérification à
 * blanc", cf. `WeaponService.removeWeapon`/`VehicleService.removeImprovement` :
 * retirer ne peut jamais rendre une chaîne valide invalide). Côté UI, chaque
 * retrait demande confirmation (`window.confirm`, mirroir de `Teams.deleteTeam`)
 * — cohérence : toute action destructrice nouvellement introduite par cette
 * fonctionnalité est confirmée, qu'elle porte sur un véhicule entier ou une
 * seule pièce d'équipement.
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
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Team } from '../team.model';
import { CatalogService } from '../../catalog/catalog.service';
import { Sponsor, Vehicule } from '../../catalog/catalog.model';
import { VehicleService } from '../vehicle-builder/vehicle.service';
import {
  AvailableImprovementDto,
  AvailableWeaponDto,
  EquipmentChoice,
  Vehicle,
  VehicleImprovement,
  Weapon,
} from '../vehicle-builder/vehicle-builder.model';
import { EquipmentOption } from '../vehicle-builder/equipment-option/equipment-option';

@Component({
  selector: 'app-vehicle-editor',
  standalone: true,
  imports: [EquipmentOption],
  templateUrl: './vehicle-editor.html',
  styleUrl: './vehicle-editor.scss',
})
export class VehicleEditor implements OnInit {
  private catalogService: CatalogService = inject(CatalogService);
  private vehicleService: VehicleService = inject(VehicleService);

  // ── Inputs / Outputs ────────────────────────────────────────────────────────

  /** L'équipe propriétaire — fournit le sponsor (filtre catalogue) et l'id (rechargement). */
  team: InputSignal<Team> = input.required<Team>();

  /** Le véhicule à équiper — identifie l'entrée à isoler dans `getAllForTeam`. */
  vehicleId: InputSignal<number> = input.required<number>();

  /**
   * Émis quand l'utilisateur ferme l'éditeur (bouton "Fermer").
   * `void` : seule l'intention de fermer compte — `Teams` recharge la liste
   * dans tous les cas (cf. `Teams.closeVehicleEditor` : coûts/équipement modifiés
   * doivent être resynchronisés sur la carte, même raisonnement que `VehicleBuilder.finished`).
   */
  closed: OutputEmitterRef<void> = output<void>();

  // ── Chargement initial : véhicule + catalogue du sponsor ────────────────────

  /**
   * Le véhicule édité (entité BRUTE, avec `improvements[]`/`weapons[]` —
   * cf. `vehicle-builder.model.ts`, doc de `Vehicle`). `null` tant que non chargé
   * OU si l'id reçu ne correspond à aucun véhicule de l'équipe (incohérence —
   * cf. `error`).
   */
  vehicle: WritableSignal<Vehicle | null> = signal<Vehicle | null>(null);

  /** Catalogue complet et déjà filtré du sponsor — mêmes besoins qu'au builder (étape 2). */
  sponsorCatalog: WritableSignal<Sponsor | null> = signal<Sponsor | null>(null);

  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');

  // ── Équipement disponible (catalogues filtrés + verdicts) ───────────────────

  availableWeapons: WritableSignal<AvailableWeaponDto[]> = signal<AvailableWeaponDto[]>([]);
  availableImprovements: WritableSignal<AvailableImprovementDto[]> = signal<AvailableImprovementDto[]>([]);
  loadingEquipment: WritableSignal<boolean> = signal(false);
  equipmentError: WritableSignal<string> = signal('');

  // ── Emplacements (computed) — mirroir EXACT de VehicleBuilder ────────────────
  // (cf. son en-tête détaillé : pool PARTAGÉ entre armes et améliorations,
  // résolution `nomInterne → emplacement` via le catalogue déjà chargé). Seule
  // différence : on lit `vehicle` (chargé) plutôt que `createdVehicle` (créé).

  /**
   * Le véhicule du CATALOGUE correspondant — résolu via `nomInterne` pour
   * l'affichage (nom, poids...). Cf. `VehicleBuilder.chosenVehicule`, doc complète.
   */
  chosenVehicule: Signal<Vehicule | null> = computed((): Vehicule | null => {
    const vehicle = this.vehicle();
    const catalog = this.sponsorCatalog();
    if (!vehicle || !catalog) return null;

    return catalog.vehicules.find((v): boolean => v.nom_interne === vehicle.nomInterne) ?? null;
  });

  /** Capacité totale du véhicule — cf. `VehicleBuilder.emplacementsTotal`, doc complète. */
  emplacementsTotal: Signal<number> = computed((): number => {
    return this.chosenVehicule()?.emplacements ?? 0;
  });

  /** Emplacements actuellement consommés — cf. `VehicleBuilder.emplacementsUtilises`, doc complète. */
  emplacementsUtilises: Signal<number> = computed((): number => {
    const vehicle = this.vehicle();
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
    this.loadVehicleAndCatalog();
  }

  // ── Chargement initial ───────────────────────────────────────────────────────

  /**
   * Charge EN PARALLÈLE (`forkJoin`) les véhicules bruts de l'équipe et le
   * catalogue de son sponsor — mirroir exact de `Teams.loadVehicleSummaries`
   * (cf. son en-tête : "les deux ingrédients dont [la résolution] a besoin").
   * Isole ensuite, dans la liste reçue, le véhicule visé par `vehicleId` —
   * seule façon d'obtenir l'entité BRUTE par id (cf. en-tête de la classe).
   */
  private loadVehicleAndCatalog(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin([
      this.vehicleService.getAllForTeam(this.team().id),
      this.catalogService.getSponsorByName(this.team().sponsor),
    ]).subscribe({
      next: ([vehicles, catalog]: [Vehicle[], Sponsor]): void => {
        this.sponsorCatalog.set(catalog);

        const found = vehicles.find((v: Vehicle): boolean => v.id === this.vehicleId()) ?? null;
        this.vehicle.set(found);
        this.loading.set(false);

        if (found) {
          this.loadAvailableEquipment();
        } else {
          // Incohérence (id obsolète — véhicule supprimé entre-temps par exemple) :
          // on signale plutôt que d'afficher un éditeur vide et silencieux.
          this.error.set('Ce véhicule est introuvable — il a peut-être été supprimé entre-temps.');
        }
      },
      error: (): void => {
        this.error.set('Impossible de charger ce véhicule. Réessayez.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Recharge le véhicule (et les verdicts d'équipement) après un RETRAIT —
   * `removeWeapon`/`removeImprovement` répondent `204 No Content` (cf.
   * `VehicleService.removeWeapon`/`removeImprovement`, frontend : `Observable<void>`)
   * — contrairement à `addWeapon`/`addImprovement`, qui renvoient directement le
   * véhicule rechargé (cf. `addWeapon`/`addImprovement` ci-dessous, mirroir du
   * builder). Aucune entité à exploiter ⇒ on revient à la même technique que le
   * chargement initial : relister les véhicules de l'équipe et isoler le bon.
   */
  private reloadVehicle(): void {
    this.vehicleService.getAllForTeam(this.team().id).subscribe({
      next: (vehicles: Vehicle[]): void => {
        this.vehicle.set(vehicles.find((v: Vehicle): boolean => v.id === this.vehicleId()) ?? null);
        this.loadAvailableEquipment();
      },
      error: (): void => {
        this.equipmentError.set('Impossible de rafraîchir ce véhicule. Réessayez.');
      },
    });
  }

  /**
   * Charge les DEUX catalogues d'options (armes + améliorations) en parallèle —
   * mirroir exact de `VehicleBuilder.loadStep2Data` (cf. son en-tête : `forkJoin`,
   * un seul indicateur, rappelée après CHAQUE changement d'équipement — ajout
   * COMME retrait : les verdicts dépendent de l'état courant du véhicule).
   */
  private loadAvailableEquipment(): void {
    const vehicle = this.vehicle();
    if (!vehicle) return;

    this.loadingEquipment.set(true);
    this.equipmentError.set('');

    forkJoin({
      weapons: this.vehicleService.getAvailableWeapons(vehicle.id),
      improvements: this.vehicleService.getAvailableImprovements(vehicle.id),
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

  // ── Ajout d'équipement — mirroir EXACT de VehicleBuilder.addWeapon/addImprovement ──

  /**
   * Ajoute une arme — "envelopper PUIS valider PUIS persister" (cf. en-tête de
   * `VehicleBuilder`) : succès ⇒ remplace `vehicle` par l'entité rechargée
   * (renvoyée directement par le backend, nouvelle arme incluse) et recharge
   * les verdicts (les emplacements ont changé).
   */
  addWeapon(choice: EquipmentChoice): void {
    const vehicle = this.vehicle();
    if (!vehicle) return;

    this.equipmentError.set('');

    this.vehicleService.addWeapon(vehicle.id, choice).subscribe({
      next: (updated: Vehicle): void => {
        this.vehicle.set(updated);
        this.loadAvailableEquipment();
      },
      error: (err: HttpErrorResponse): void => {
        this.equipmentError.set(err.error?.message ?? 'Impossible de monter cette arme. Réessayez.');
      },
    });
  }

  /** Ajoute une amélioration — mirroir exact d'`addWeapon` ci-dessus (même contrat, même retour). */
  addImprovement(choice: EquipmentChoice): void {
    const vehicle = this.vehicle();
    if (!vehicle) return;

    this.equipmentError.set('');

    this.vehicleService.addImprovement(vehicle.id, choice).subscribe({
      next: (updated: Vehicle): void => {
        this.vehicle.set(updated);
        this.loadAvailableEquipment();
      },
      error: (err: HttpErrorResponse): void => {
        this.equipmentError.set(err.error?.message ?? 'Impossible de poser cette amélioration. Réessayez.');
      },
    });
  }

  // ── Retrait d'équipement — NOUVEAU, symétrique des méthodes ci-dessus ────────

  /**
   * Retire une arme — demande confirmation (mirroir de `Teams.deleteTeam`,
   * `window.confirm`), puis appelle l'API. AUCUNE vérification de règle métier
   * au préalable : retirer est TOUJOURS permis côté backend (cf. en-tête de la
   * classe — `WeaponService.removeWeapon`). Succès : `reloadVehicle` (le backend
   * renvoie `204`, pas d'entité à exploiter directement — cf. sa doc).
   */
  removeWeapon(weapon: Weapon): void {
    const nom = this.resolveWeaponName(weapon.nomInterne);
    if (!window.confirm(`Retirer "${nom}" de ce véhicule ?`)) {
      return;
    }

    this.equipmentError.set('');

    this.vehicleService.removeWeapon(weapon.id).subscribe({
      next: (): void => this.reloadVehicle(),
      error: (err: HttpErrorResponse): void => {
        this.equipmentError.set(err.error?.message ?? 'Impossible de retirer cette arme. Réessayez.');
      },
    });
  }

  /** Retire une amélioration — mirroir exact de `removeWeapon` ci-dessus. */
  removeImprovement(improvement: VehicleImprovement): void {
    const vehicle = this.vehicle();
    if (!vehicle) return;

    const nom = this.resolveImprovementName(improvement.nomInterne);
    if (!window.confirm(`Retirer "${nom}" de ce véhicule ?`)) {
      return;
    }

    this.equipmentError.set('');

    this.vehicleService.removeImprovement(vehicle.id, improvement.id).subscribe({
      next: (): void => this.reloadVehicle(),
      error: (err: HttpErrorResponse): void => {
        this.equipmentError.set(err.error?.message ?? 'Impossible de retirer cette amélioration. Réessayez.');
      },
    });
  }

  // ── Résolution d'affichage (nomInterne → nom) ────────────────────────────────

  /**
   * Résout le nom AFFICHÉ d'une arme montée depuis son `nomInterne` — même
   * technique de recoupement que `buildVehicleSummary` (cf. son en-tête) :
   * l'entité brute ne porte que la clé catalogue stable, c'est le catalogue
   * déjà chargé qui connaît le nom présentable. Repli sur `nomInterne` brut si
   * l'entrée est introuvable (incohérence de données — ne devrait jamais arriver,
   * cf. `buildVehicleSummary` : on dégrade proprement plutôt que de planter).
   */
  resolveWeaponName(nomInterne: string): string {
    return this.sponsorCatalog()?.armes.find((a): boolean => a.nom_interne === nomInterne)?.nom ?? nomInterne;
  }

  /** Résout le nom affiché d'une amélioration posée — mirroir exact de `resolveWeaponName`. */
  resolveImprovementName(nomInterne: string): string {
    return this.sponsorCatalog()?.ameliorations.find((a): boolean => a.nom_interne === nomInterne)?.nom ?? nomInterne;
  }

  // ── Détection "orientation requise" — mirroir EXACT de VehicleBuilder ────────
  // (cf. sa doc complète : signal typé pour les armes, contrat textuel `raison`
  // pour les améliorations — connaissance qui n'appartient qu'au backend/Décorateur).

  weaponNeedsOrientation(option: AvailableWeaponDto): boolean {
    return option.type !== 'équipage';
  }

  improvementNeedsOrientation(option: AvailableImprovementDto): boolean {
    return option.raison?.startsWith('Une orientation est requise') ?? false;
  }

  // ── Fermeture ────────────────────────────────────────────────────────────────

  /** L'utilisateur ferme l'éditeur — `Teams` ferme la modale et recharge la liste. */
  close(): void {
    this.closed.emit();
  }
}
