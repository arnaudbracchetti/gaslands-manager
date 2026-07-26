/**
 * ParticipantAtelierPage — consultation en LECTURE SEULE de l'atelier d'un
 * AUTRE participant de la campagne (`/campaigns/:id/participants/:pid/atelier`).
 *
 * Vue maître-détail sur une seule page (pas de sous-route par véhicule,
 * contrairement à `AtelierPage`/`AtelierVehiclePage` côté "mon" équipe) :
 * colonne de gauche listant tous les véhicules (façon onglets, `VehicleSummaryCard`
 * dont l'output `manageClicked` est détourné pour SÉLECTIONNER plutôt que
 * naviguer), partie droite affichant la configuration complète du véhicule
 * sélectionné (`VehicleCostSummary [disabled]` + `MountedEquipment [locked]`),
 * plus un bandeau de synthèse d'équipe (`TeamBudget`, budget total/consommé).
 *
 * Ne branche jamais `EquipmentManager` : celui-ci ferait des appels HTTP
 * mutants scopés à "mon" équipe (available-weapons/improvements/advantages/
 * sequelles, achats/reventes via `AtelierEquipmentDataSource`), inutilisables
 * et non autorisés sur le véhicule d'un tiers — le backend les résout par
 * `req.user.id`, jamais par un `vehicleId` de route. `VehicleCostSummary`/
 * `MountedEquipment` sont déjà des composants "dumb" dotés d'un mode verrouillé
 * natif (`disabled`/`locked`), aucune modification n'a été nécessaire dessus.
 */
import { Component, OnInit, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CampaignsService } from '../campaigns.service';
import { CatalogService } from '../../catalog/catalog.service';
import { Sponsor } from '../../catalog/catalog.model';
import { CampaignParticipant } from '../campaign-participant.model';
import { Vehicle } from '../../teams/vehicle-configurator/vehicle-builder.model';
import { buildVehicleSummary, VehicleSummary } from '../../teams/vehicle-summary';
import { VehicleSummaryCard } from '../../teams/vehicle-summary-card/vehicle-summary-card';
import { VehicleCostSummary } from '../../teams/vehicle-configurator/equipment-manager/vehicle-cost-summary/vehicle-cost-summary';
import { MountedEquipment } from '../../teams/vehicle-configurator/equipment-manager/mounted-equipment/mounted-equipment';
import { TeamBudget } from '../../teams/vehicle-configurator/equipment-manager/team-budget/team-budget';
import { WorkshopStateDto, WorkshopVehicleDto, mapWorkshopVehicleToVehicle } from '../workshop.model';
import { Breadcrumb, BreadcrumbItem } from '../../shared/breadcrumb/breadcrumb';

@Component({
  selector: 'app-participant-atelier-page',
  standalone: true,
  imports: [VehicleSummaryCard, VehicleCostSummary, MountedEquipment, TeamBudget, Breadcrumb],
  templateUrl: './participant-atelier-page.html',
  styleUrl: './participant-atelier-page.scss',
})
export class ParticipantAtelierPage implements OnInit {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private campaignsService: CampaignsService = inject(CampaignsService);
  private catalogService: CatalogService = inject(CatalogService);

  readonly campaignId: number = Number(this.route.snapshot.params['id']);
  readonly participantId: number = Number(this.route.snapshot.params['pid']);

  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');
  workshop: WritableSignal<WorkshopStateDto | null> = signal<WorkshopStateDto | null>(null);
  sponsorCatalog: WritableSignal<Sponsor | null> = signal<Sponsor | null>(null);
  campaignName: WritableSignal<string> = signal('');
  participantName: WritableSignal<string> = signal('');
  teamName: WritableSignal<string> = signal('');

  /** "Atelier de [Équipe] ([Joueur])" — retombe sur "Atelier" tant que les noms ne sont pas chargés. */
  headerTitle: Signal<string> = computed((): string => {
    const team = this.teamName();
    const player = this.participantName();
    if (!team || !player) return 'Atelier';
    return `Atelier de ${team} (${player})`;
  });

  /** Véhicule actuellement affiché dans le panneau de droite — sélection locale, pas un paramètre de route. */
  selectedVehicleId: WritableSignal<number | null> = signal<number | null>(null);

  /** Cagnotte du participant consulté — solde restant. */
  wallet: Signal<number> = computed((): number => this.workshop()?.wallet ?? 0);

  /** Véhicules de l'équipe consultée, traduits vers la forme partagée `Vehicle`. */
  vehicles: Signal<Vehicle[]> = computed((): Vehicle[] => {
    return (this.workshop()?.vehicles ?? []).map(mapWorkshopVehicleToVehicle);
  });

  /** Résumés affichables (colonne de gauche) — même fonction pure que `AtelierPage`. */
  vehicleSummaries: Signal<VehicleSummary[]> = computed((): VehicleSummary[] => {
    const catalog = this.sponsorCatalog();
    if (!catalog) return [];
    return this.vehicles().map((v: Vehicle): VehicleSummary => buildVehicleSummary(v, catalog));
  });

  // ── Synthèse d'équipe (bandeau — budget total/consommé à l'instant t) ───────

  /** Coût cumulé de TOUS les véhicules de l'équipe consultée. */
  totalVehiclesCost: Signal<number> = computed((): number =>
    this.vehicleSummaries().reduce((sum: number, s: VehicleSummary): number => sum + s.cout, 0),
  );

  /** Budget total : cagnotte restante + tout ce qui a déjà été dépensé. */
  budgetEquipeTotal: Signal<number> = computed((): number => this.wallet() + this.totalVehiclesCost());

  /** Solde restant — peut être négatif (cf. `budgetDepasse`, filet de sécurité d'affichage). */
  budgetRestant: Signal<number> = computed((): number => this.wallet());

  budgetDepasse: Signal<boolean> = computed((): boolean => this.wallet() < 0);

  budgetPourcentage: Signal<number> = computed((): number => {
    const total = this.budgetEquipeTotal();
    if (total <= 0) return 0;
    return Math.min(100, Math.round((this.totalVehiclesCost() / total) * 100));
  });

  // ── Détail (partie droite) ──────────────────────────────────────────────────

  /** Véhicule sélectionné, sous la forme partagée `Vehicle`. */
  selectedVehicle: Signal<Vehicle | null> = computed((): Vehicle | null => {
    return this.vehicles().find((v: Vehicle): boolean => v.id === this.selectedVehicleId()) ?? null;
  });

  /**
   * Le même véhicule, sous sa forme BRUTE `WorkshopVehicleDto` — seule forme qui
   * porte encore `chocs`/`sequellas` (ignorés par `mapWorkshopVehicleToVehicle`).
   */
  targetWorkshopVehicle: Signal<WorkshopVehicleDto | null> = computed((): WorkshopVehicleDto | null => {
    return (this.workshop()?.vehicles ?? []).find((v: WorkshopVehicleDto): boolean => v.id === this.selectedVehicleId()) ?? null;
  });

  /** Nom du type catalogue du véhicule sélectionné — fallback d'affichage pour `VehicleCostSummary`. */
  typeNom: Signal<string> = computed((): string => {
    const v = this.selectedVehicle();
    const catalog = this.sponsorCatalog();
    if (!v || !catalog) return '';
    return catalog.vehicules.find((x): boolean => x.nom_interne === v.nomInterne)?.nom ?? v.nomInterne;
  });

  /** Emplacements consommés — même calcul que `EquipmentManager.emplacementsUtilises`. */
  emplacementsUtilises: Signal<number> = computed((): number => {
    const v = this.selectedVehicle();
    const catalog = this.sponsorCatalog();
    if (!v || !catalog) return 0;

    const weaponSlots = v.weapons
      .filter((w): boolean => !w.sold)
      .reduce((sum: number, w): number => {
        const arme = catalog.armes.find((a): boolean => a.nom_interne === w.nomInterne);
        return sum + (arme?.emplacement ?? 0);
      }, 0);

    const improvementSlots = v.improvements.reduce((sum: number, imp): number => sum + (imp.emplacement ?? 0), 0);

    return weaponSlots + improvementSlots;
  });

  /** Prix de base du véhicule sélectionné — déjà porté par le DTO atelier (prix catalogue brut). */
  coutBase: Signal<number> = computed((): number => this.targetWorkshopVehicle()?.price ?? 0);

  /** Somme des prix effectifs des armes/améliorations/avantages montés — même calcul qu'`EquipmentManager.coutEquipement`. */
  coutEquipement: Signal<number> = computed((): number => {
    const v = this.selectedVehicle();
    if (!v) return 0;
    const weaponsCost = v.weapons.reduce((sum: number, w): number => sum + w.prix, 0);
    const improvementsCost = v.improvements.reduce((sum: number, imp): number => sum + imp.prix, 0);
    const advantagesCost = v.advantages.reduce((sum: number, a): number => sum + a.prix, 0);
    return weaponsCost + improvementsCost + advantagesCost;
  });

  coutTotal: Signal<number> = computed((): number => this.coutBase() + this.coutEquipement());

  breadcrumbs: Signal<BreadcrumbItem[]> = computed((): BreadcrumbItem[] => [
    { label: 'Mes Campagnes', route: ['/campaigns'] },
    { label: this.campaignName() || '…', route: ['/campaigns', String(this.campaignId)] },
    { label: this.headerTitle() },
  ]);

  ngOnInit(): void {
    this.loadCampaignName();
    this.loadParticipantAndTeamName();
    this.loadWorkshop();
  }

  private loadCampaignName(): void {
    this.campaignsService.getOne(this.campaignId).subscribe({
      next: (campaign): void => this.campaignName.set(campaign.name),
      // Non bloquant : le fil d'Ariane retombe sur "…" si le nom ne charge pas.
      error: (): void => undefined,
    });
  }

  private loadParticipantAndTeamName(): void {
    this.campaignsService.getParticipants(this.campaignId).subscribe({
      next: (participants: CampaignParticipant[]): void => {
        const target = participants.find((p): boolean => p.id === this.participantId);
        if (target) {
          this.participantName.set(target.userName);
          this.teamName.set(target.teamName);
        }
      },
      // Non bloquant : l'en-tête retombe sur "Atelier" si les noms ne chargent pas.
      error: (): void => undefined,
    });
  }

  private loadWorkshop(): void {
    this.loading.set(true);
    this.error.set('');

    this.campaignsService.getParticipantWorkshop(this.campaignId, this.participantId).subscribe({
      next: (state: WorkshopStateDto): void => {
        this.workshop.set(state);
        if (this.selectedVehicleId() === null && state.vehicles.length > 0) {
          this.selectedVehicleId.set(state.vehicles[0].id);
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

  /** Sélectionne le véhicule affiché dans le panneau de droite — jamais de navigation. */
  onSelectVehicle(vehicleId: number): void {
    this.selectedVehicleId.set(vehicleId);
  }
}
