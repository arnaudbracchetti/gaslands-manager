/**
 * AtelierPage — page "smart" de l'atelier campagne (`/campaigns/:id/atelier`).
 *
 * Écran LISTE : affiche la cagnotte et un `VehicleSummaryCard` par véhicule de
 * l'équipe engagée (même composant, même fonction pure `buildVehicleSummary`,
 * que `TeamEditPage` côté construction d'équipe). Cliquer sur un véhicule
 * navigue vers `AtelierVehiclePage` (`/campaigns/:id/atelier/vehicles/:vehicleId`),
 * qui porte seule le rendu d'`EquipmentManager` et la source de données
 * `AtelierEquipmentDataSource` — cette page ne fait plus que lister.
 *
 * Occupe toute la largeur de l'écran et utilise le composant `Breadcrumb`
 * partagé, exactement comme `VehicleConfiguratorPage` côté équipe (même gabarit
 * `.atp-page`/`.atp-header` — sticky, max-width 1600px) — plus de lien
 * "← Retour" ad hoc.
 */
import { Component, OnInit, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CampaignsService } from '../campaigns.service';
import { CatalogService } from '../../catalog/catalog.service';
import { Sponsor } from '../../catalog/catalog.model';
import { Vehicle } from '../../teams/vehicle-configurator/vehicle-builder.model';
import { buildVehicleSummary, VehicleSummary } from '../../teams/vehicle-summary';
import { VehicleSummaryCard } from '../../teams/vehicle-summary-card/vehicle-summary-card';
import { WorkshopStateDto, mapWorkshopVehicleToVehicle } from '../workshop.model';
import { Breadcrumb, BreadcrumbItem } from '../../shared/breadcrumb/breadcrumb';

@Component({
  selector: 'app-atelier-page',
  standalone: true,
  imports: [VehicleSummaryCard, Breadcrumb],
  templateUrl: './atelier-page.html',
  styleUrl: './atelier-page.scss',
})
export class AtelierPage implements OnInit {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private campaignsService: CampaignsService = inject(CampaignsService);
  private catalogService: CatalogService = inject(CatalogService);

  readonly campaignId: number = Number(this.route.snapshot.params['id']);

  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');
  workshop: WritableSignal<WorkshopStateDto | null> = signal<WorkshopStateDto | null>(null);
  sponsorCatalog: WritableSignal<Sponsor | null> = signal<Sponsor | null>(null);
  campaignName: WritableSignal<string> = signal('');

  /** Cagnotte courante — solde restant à dépenser en atelier. */
  wallet: Signal<number> = computed((): number => this.workshop()?.wallet ?? 0);

  /** Véhicules de l'équipe engagée, traduits vers la forme attendue par `buildVehicleSummary`. */
  vehicles: Signal<Vehicle[]> = computed((): Vehicle[] => {
    return (this.workshop()?.vehicles ?? []).map(mapWorkshopVehicleToVehicle);
  });

  /** Résumés affichables — mêmes cartes que `TeamEditPage`, sans bouton supprimer. */
  vehicleSummaries: Signal<VehicleSummary[]> = computed((): VehicleSummary[] => {
    const catalog = this.sponsorCatalog();
    if (!catalog) return [];
    return this.vehicles().map((v: Vehicle): VehicleSummary => buildVehicleSummary(v, catalog));
  });

  breadcrumbs: Signal<BreadcrumbItem[]> = computed((): BreadcrumbItem[] => [
    { label: 'Mes Campagnes', route: ['/campaigns'] },
    { label: this.campaignName() || '…', route: ['/campaigns', String(this.campaignId)] },
    { label: 'Atelier' },
  ]);

  ngOnInit(): void {
    this.loadCampaignName();
    this.loadWorkshop();
  }

  private loadCampaignName(): void {
    this.campaignsService.getOne(this.campaignId).subscribe({
      next: (campaign): void => this.campaignName.set(campaign.name),
      // Non bloquant : le fil d'Ariane retombe sur "…" si le nom ne charge pas.
      error: (): void => undefined,
    });
  }

  private loadWorkshop(): void {
    this.loading.set(true);
    this.error.set('');

    this.campaignsService.getWorkshop(this.campaignId).subscribe({
      next: (state: WorkshopStateDto): void => {
        this.workshop.set(state);
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

  /** Navigue vers l'écran de configuration dédié à ce véhicule. */
  onManage(vehicleId: number): void {
    this.router.navigate(['/campaigns', this.campaignId, 'atelier', 'vehicles', vehicleId]);
  }
}
