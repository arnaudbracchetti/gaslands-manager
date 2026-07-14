/**
 * AtelierVehiclePage — écran de configuration d'équipement d'UN véhicule de
 * l'atelier campagne (`/campaigns/:id/atelier/vehicles/:vehicleId`).
 *
 * Miroir côté atelier de `VehicleConfiguratorPage`/`VehicleConfigurator`
 * (construction d'équipe) — mais sans branche "création" : l'atelier ne permet
 * jamais d'acheter un nouveau véhicule (Temps 1), seulement d'équiper un
 * véhicule déjà existant dans l'équipe engagée. On branche donc directement
 * `EquipmentManager` (le MÊME composant que côté équipe), sans passer par
 * `VehicleConfigurator` dont la logique de création ne s'applique pas ici.
 *
 * Fournit `AtelierEquipmentDataSource` au niveau de CE composant (une instance
 * par visite d'un véhicule), comme `VehicleConfigurator` le fait pour
 * `TeamEquipmentDataSource` — plus au niveau de la page liste (`AtelierPage`).
 *
 * Occupe toute la largeur de l'écran et utilise le composant `Breadcrumb`
 * partagé — même gabarit `.vcp-page`/`.vcp-header` (repris tel quel, cf.
 * `vehicle-configurator-page.scss`) que `VehicleConfiguratorPage` côté équipe.
 */
import { Component, OnInit, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CampaignsService } from '../campaigns.service';
import { CatalogService } from '../../catalog/catalog.service';
import { Sponsor } from '../../catalog/catalog.model';
import { Vehicle } from '../../teams/vehicle-configurator/vehicle-builder.model';
import { BudgetView, EQUIPMENT_DATA_SOURCE } from '../../teams/vehicle-configurator/equipment-data-source';
import { EquipmentManager } from '../../teams/vehicle-configurator/equipment-manager/equipment-manager';
import { WorkshopStateDto, WorkshopVehicleDto, mapWorkshopVehicleToVehicle } from '../workshop.model';
import { AtelierEquipmentDataSource } from './atelier-equipment.datasource';
import { Breadcrumb, BreadcrumbItem } from '../../shared/breadcrumb/breadcrumb';
import { buildVehicleSummary } from '../../teams/vehicle-summary';
import { SequellaManager } from './sequella-manager/sequella-manager';

@Component({
  selector: 'app-atelier-vehicle-page',
  standalone: true,
  imports: [EquipmentManager, Breadcrumb, SequellaManager],
  providers: [
    AtelierEquipmentDataSource,
    { provide: EQUIPMENT_DATA_SOURCE, useExisting: AtelierEquipmentDataSource },
  ],
  templateUrl: './atelier-vehicle-page.html',
  styleUrl: './atelier-vehicle-page.scss',
})
export class AtelierVehiclePage implements OnInit {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private campaignsService: CampaignsService = inject(CampaignsService);
  private catalogService: CatalogService = inject(CatalogService);

  readonly campaignId: number = Number(this.route.snapshot.params['id']);
  readonly vehicleId: number = Number(this.route.snapshot.params['vehicleId']);

  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');
  workshop: WritableSignal<WorkshopStateDto | null> = signal<WorkshopStateDto | null>(null);
  sponsorCatalog: WritableSignal<Sponsor | null> = signal<Sponsor | null>(null);
  campaignName: WritableSignal<string> = signal('');

  /** Cagnotte courante — solde restant à dépenser en atelier. */
  wallet: Signal<number> = computed((): number => this.workshop()?.wallet ?? 0);

  /** Tous les véhicules de l'équipe engagée, traduits vers la forme `EquipmentManager`. */
  private allVehicles: Signal<Vehicle[]> = computed((): Vehicle[] => {
    return (this.workshop()?.vehicles ?? []).map(mapWorkshopVehicleToVehicle);
  });

  /** Le véhicule ciblé par la route, une fois le workshop chargé. */
  vehicle: Signal<Vehicle | null> = computed((): Vehicle | null => {
    return this.allVehicles().find((v: Vehicle): boolean => v.id === this.vehicleId) ?? null;
  });

  /**
   * Le véhicule ciblé, sous sa forme BRUTE `WorkshopVehicleDto` — contrairement à
   * `vehicle` ci-dessus (traduit pour `EquipmentManager`, cf. `mapWorkshopVehicleToVehicle`
   * qui ignore `chocs`/`sequellas`), c'est la forme dont `SequellaManager` a besoin :
   * lui seul porte encore ces deux champs.
   */
  targetWorkshopVehicle: Signal<WorkshopVehicleDto | null> = computed((): WorkshopVehicleDto | null => {
    return (this.workshop()?.vehicles ?? []).find((v: WorkshopVehicleDto): boolean => v.id === this.vehicleId) ?? null;
  });

  /** Nom affiché du véhicule, résolu depuis le catalogue (repli sur `nomInterne`). */
  vehicleName: Signal<string> = computed((): string => {
    const v = this.vehicle();
    const catalog = this.sponsorCatalog();
    if (!v || !catalog) return '';
    return catalog.vehicules.find((c): boolean => c.nom_interne === v.nomInterne)?.nom ?? v.nomInterne;
  });

  /**
   * Budget passé à `EquipmentManager`. Même calcul que l'ancien `AtelierPage.budgetFor` :
   * `EquipmentManager` calcule `budgetRestant = total - usedByOthers - coûtDeCeVéhicule`.
   * On veut que ce reste égale la cagnotte (déjà nette des achats) :
   *   total        = wallet + coût de TOUS les véhicules
   *   usedByOthers = coût de tous les véhicules SAUF celui-ci
   */
  budget: Signal<BudgetView> = computed((): BudgetView => {
    const catalog = this.sponsorCatalog();
    const v = this.vehicle();
    if (!catalog || !v) return { total: 0, usedByOthers: 0 };

    const all = this.allVehicles();
    const totalAllCost = all.reduce((sum: number, x: Vehicle): number => sum + buildVehicleSummary(x, catalog).cout, 0);
    const thisCost = buildVehicleSummary(v, catalog).cout;

    return {
      total: this.wallet() + totalAllCost,
      usedByOthers: totalAllCost - thisCost,
    };
  });

  breadcrumbs: Signal<BreadcrumbItem[]> = computed((): BreadcrumbItem[] => [
    { label: 'Mes Campagnes', route: ['/campaigns'] },
    { label: this.campaignName() || '…', route: ['/campaigns', String(this.campaignId)] },
    { label: 'Atelier', route: ['/campaigns', String(this.campaignId), 'atelier'] },
    { label: this.vehicleName() || '…' },
  ]);

  ngOnInit(): void {
    this.loadCampaignName();
    this.loadWorkshop(true);
  }

  private loadCampaignName(): void {
    this.campaignsService.getOne(this.campaignId).subscribe({
      next: (campaign): void => this.campaignName.set(campaign.name),
      // Non bloquant : le fil d'Ariane retombe sur "…" si le nom ne charge pas.
      error: (): void => undefined,
    });
  }

  /**
   * Charge (ou recharge) l'état d'atelier. Au premier chargement, enchaîne sur
   * le catalogue du sponsor (nécessaire à `EquipmentManager`) et vérifie que le
   * véhicule ciblé existe. Aux rechargements (`initial = false`, après une
   * mutation), le catalogue est déjà connu — pas de nouveau spinner plein écran.
   */
  private loadWorkshop(initial: boolean): void {
    if (initial) this.loading.set(true);
    this.error.set('');

    this.campaignsService.getWorkshop(this.campaignId).subscribe({
      next: (state: WorkshopStateDto): void => {
        this.workshop.set(state);
        if (!initial) return;

        const found = state.vehicles.some((v): boolean => v.id === this.vehicleId);
        if (!found) {
          this.error.set('Véhicule introuvable.');
          this.loading.set(false);
          return;
        }
        this.loadSponsorCatalog(state.sponsor);
      },
      error: (): void => {
        this.error.set("Impossible de charger l'atelier. Réessayez.");
        this.loading.set(false);
      },
    });
  }

  private loadSponsorCatalog(sponsor: string): void {
    this.catalogService.getSponsorByName(sponsor).subscribe({
      next: (catalog: Sponsor): void => {
        this.sponsorCatalog.set(catalog);
        this.loading.set(false);
      },
      error: (): void => {
        this.error.set('Impossible de charger le catalogue du sponsor. Réessayez.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Après chaque mutation d'équipement, on relit l'état complet : la cagnotte
   * a changé, tout comme les autres véhicules (pour le calcul de budget).
   */
  onVehicleChanged(): void {
    this.loadWorkshop(false);
  }

}
