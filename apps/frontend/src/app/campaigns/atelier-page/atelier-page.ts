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
 * Vente/annulation de véhicule : chaque carte porte un bouton (libellé/icône
 * adaptés à `purchasedThisSession`) qui ouvre `SellVehicleModal` — synthèse
 * calculée par `buildVehicleSaleSummary`. La confirmation appelle le même
 * endpoint générique `changeEquipment` (SELL/VEHICLE) que le reste de l'atelier :
 * le backend décide seul s'il s'agit d'une annulation cascade (véhicule acheté
 * cette session) ou d'une revente par élément (véhicule pré-existant).
 *
 * Achat de véhicule : bouton "+ Ajouter un véhicule" ouvrant une grille de
 * `VehicleChoiceCard` (réutilisé tel quel, alimenté par `sponsorCatalog().vehicules`
 * déjà chargé) — même pattern que `VehicleConfigurator` en mode création.
 *
 * Occupe toute la largeur de l'écran et utilise le composant `Breadcrumb`
 * partagé, exactement comme `VehicleConfiguratorPage` côté équipe (même gabarit
 * `.atp-page`/`.atp-header` — sticky, max-width 1600px) — plus de lien
 * "← Retour" ad hoc.
 */
import { Component, OnInit, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CampaignsService } from '../campaigns.service';
import { CatalogService } from '../../catalog/catalog.service';
import { Sponsor, Vehicule } from '../../catalog/catalog.model';
import { Vehicle } from '../../teams/vehicle-configurator/vehicle-builder.model';
import { VehicleChoiceCard } from '../../teams/vehicle-configurator/vehicle-choice-card/vehicle-choice-card';
import { buildVehicleSummary, VehicleSummary } from '../../teams/vehicle-summary';
import { VehicleSummaryCard } from '../../teams/vehicle-summary-card/vehicle-summary-card';
import { WorkshopStateDto, WorkshopVehicleDto, mapWorkshopVehicleToVehicle } from '../workshop.model';
import { buildVehicleSaleSummary, VehicleSaleSummary } from './vehicle-sale-summary';
import { SellVehicleModal } from './sell-vehicle-modal/sell-vehicle-modal';
import { Breadcrumb, BreadcrumbItem } from '../../shared/breadcrumb/breadcrumb';

@Component({
  selector: 'app-atelier-page',
  standalone: true,
  imports: [VehicleSummaryCard, VehicleChoiceCard, SellVehicleModal, Breadcrumb],
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

  /** Résumés affichables — mêmes cartes que `TeamEditPage`, avec bouton vente/annulation. */
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

  // ── Vente / annulation d'un véhicule ────────────────────────────────────────

  pendingSaleVehicleId: WritableSignal<number | null> = signal<number | null>(null);
  sellingVehicle: WritableSignal<boolean> = signal(false);

  /** Synthèse affichée par `SellVehicleModal` — `null` tant qu'aucune vente n'est en cours. */
  saleSummary: Signal<VehicleSaleSummary | null> = computed((): VehicleSaleSummary | null => {
    const id = this.pendingSaleVehicleId();
    const catalog = this.sponsorCatalog();
    const wsVehicle = this.workshop()?.vehicles.find((v: WorkshopVehicleDto): boolean => v.id === id);
    if (id === null || !catalog || !wsVehicle) return null;
    return buildVehicleSaleSummary(wsVehicle, catalog);
  });

  // ── Achat d'un véhicule ──────────────────────────────────────────────────────

  showAddVehicle: WritableSignal<boolean> = signal(false);
  addingVehicle: WritableSignal<boolean> = signal(false);

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

  // ── Vente / annulation d'un véhicule ────────────────────────────────────────

  /** Titre du bouton — adapté selon que le véhicule a été acheté cette session ou non. */
  sellTitleFor(vehicleId: number): string {
    return this.isPurchasedThisSession(vehicleId) ? "Annuler l'achat de ce véhicule" : 'Vendre ce véhicule';
  }

  /** Icône du bouton — mirroir de `sellTitleFor`. */
  sellIconFor(vehicleId: number): string {
    return this.isPurchasedThisSession(vehicleId) ? '↩️' : '💰';
  }

  private isPurchasedThisSession(vehicleId: number): boolean {
    return this.workshop()?.vehicles.find((v: WorkshopVehicleDto): boolean => v.id === vehicleId)?.purchasedThisSession ?? false;
  }

  /** Ouvre la modale de synthèse pour ce véhicule. */
  onSellRequested(summary: VehicleSummary): void {
    this.pendingSaleVehicleId.set(summary.id);
  }

  onCancelSale(): void {
    this.pendingSaleVehicleId.set(null);
  }

  onConfirmSale(): void {
    const vehicleId = this.pendingSaleVehicleId();
    if (vehicleId === null) return;

    this.sellingVehicle.set(true);
    this.error.set('');

    this.campaignsService.changeEquipment(this.campaignId, {
      operation: 'SELL', entityType: 'VEHICLE', nomInterne: '', targetEntityId: vehicleId,
    }).subscribe({
      next: (): void => {
        this.pendingSaleVehicleId.set(null);
        this.sellingVehicle.set(false);
        this.loadWorkshop();
      },
      error: (err: HttpErrorResponse): void => {
        this.error.set(err.error?.message ?? 'Impossible de vendre ce véhicule. Réessayez.');
        this.sellingVehicle.set(false);
      },
    });
  }

  // ── Achat d'un véhicule ──────────────────────────────────────────────────────

  toggleAddVehicle(): void {
    this.showAddVehicle.set(!this.showAddVehicle());
  }

  onVehicleChosen(vehicule: Vehicule): void {
    this.addingVehicle.set(true);
    this.error.set('');

    this.campaignsService.changeEquipment(this.campaignId, {
      operation: 'BUY', entityType: 'VEHICLE', nomInterne: vehicule.nom_interne,
    }).subscribe({
      next: (): void => {
        this.addingVehicle.set(false);
        this.showAddVehicle.set(false);
        this.loadWorkshop();
      },
      error: (err: HttpErrorResponse): void => {
        this.error.set(err.error?.message ?? 'Impossible d\'acheter ce véhicule. Réessayez.');
        this.addingVehicle.set(false);
      },
    });
  }
}
