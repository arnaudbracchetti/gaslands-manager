/**
 * TeamEditPage — hub complet de gestion d'une équipe.
 *
 * Accessible via `/teams/:id/edit`. Regroupe :
 * - L'édition des infos de l'équipe (TeamForm)
 * - La liste des véhicules avec actions (ajouter, gérer équipement, supprimer)
 * - La suppression de l'équipe
 *
 * ── Fil d'Ariane ─────────────────────────────────────────────────────────────
 * Le query param `from` détermine le lien de retour :
 *   - `from=teams`               → /teams (liste des équipes)
 *   - `from=season&seasonId=X`   → /seasons/X (détail d'une saison)
 *   - absent                     → fallback /teams
 *
 * ── Résolution de l'équipe ───────────────────────────────────────────────────
 * Même pattern que VehicleConfiguratorPage : getAll().find(...), car il
 * n'existe pas de endpoint GET /api/teams/:id.
 */
import { Component, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, map, catchError } from 'rxjs';
import { Team, CreateTeamDto } from '../team.model';
import { TeamsService } from '../teams.service';
import { TeamForm } from '../team-form/team-form';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';
import { VehicleService } from '../vehicle-configurator/vehicle.service';
import { CatalogService } from '../../catalog/catalog.service';
import { Vehicle } from '../vehicle-configurator/vehicle-builder.model';
import { Sponsor } from '../../catalog/catalog.model';
import { buildVehicleSummary, VehicleSummary } from '../vehicle-summary';
import { SlotGauge } from '../../shared/slot-gauge/slot-gauge';
import { Breadcrumb, BreadcrumbItem } from '../../shared/breadcrumb/breadcrumb';

@Component({
  selector: 'app-team-edit-page',
  standalone: true,
  imports: [TeamForm, ConfirmModal, SlotGauge, Breadcrumb],
  templateUrl: './team-edit-page.html',
  styleUrl: './team-edit-page.scss',
})
export class TeamEditPage implements OnInit {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly teamsService: TeamsService = inject(TeamsService);
  private readonly vehicleService: VehicleService = inject(VehicleService);
  private readonly catalogService: CatalogService = inject(CatalogService);

  // ── État ──────────────────────────────────────────────────────────────────

  team: WritableSignal<Team | null> = signal<Team | null>(null);
  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');
  saving: WritableSignal<boolean> = signal(false);

  vehicles: WritableSignal<VehicleSummary[]> = signal<VehicleSummary[]>([]);

  /** Équipe en attente de confirmation de suppression */
  pendingDeleteTeam: WritableSignal<boolean> = signal(false);
  /** Véhicule en attente de confirmation de suppression */
  pendingDeleteVehicleId: WritableSignal<number | null> = signal<number | null>(null);
  pendingDeleteVehicleName: WritableSignal<string> = signal('');

  // ── Navigation / fil d'Ariane ─────────────────────────────────────────────

  private fromParam: WritableSignal<string> = signal('teams');
  private seasonIdParam: WritableSignal<string | null> = signal<string | null>(null);

  /** Libellé du lien de retour affiché dans le fil d'Ariane */
  backLabel = computed((): string =>
    this.fromParam() === 'season' ? 'Saisons' : 'Mes Équipes',
  );

  /** Route du lien de retour */
  backRoute = computed((): string[] =>
    this.fromParam() === 'season' && this.seasonIdParam()
      ? ['/seasons', this.seasonIdParam()!]
      : ['/teams'],
  );

  breadcrumbs = computed((): BreadcrumbItem[] => [
    { label: this.backLabel(), route: this.backRoute() },
    { label: this.team()?.name ?? '…' },
  ]);

  hasVehicles = computed((): boolean => (this.team()?.vehicleCount ?? 0) > 0);

  // ── Cycle de vie ──────────────────────────────────────────────────────────

  ngOnInit(): void {
    const teamId = Number(this.route.snapshot.paramMap.get('id'));
    this.fromParam.set(this.route.snapshot.queryParamMap.get('from') ?? 'teams');
    this.seasonIdParam.set(this.route.snapshot.queryParamMap.get('seasonId'));

    this.teamsService.getAll().subscribe({
      next: (teams: Team[]): void => {
        const found = teams.find((t: Team): boolean => t.id === teamId) ?? null;
        if (!found) {
          this.error.set('Équipe introuvable.');
          this.loading.set(false);
          return;
        }
        this.team.set(found);
        this.loading.set(false);
        this.loadVehicleSummaries(found);
      },
      error: (): void => {
        this.error.set("Impossible de charger l'équipe.");
        this.loading.set(false);
      },
    });
  }

  private loadVehicleSummaries(team: Team): void {
    if ((team.vehicleCount ?? 0) === 0) {
      this.vehicles.set([]);
      return;
    }

    forkJoin([
      this.vehicleService.getAllForTeam(team.id),
      this.catalogService.getSponsorByName(team.sponsor),
    ])
      .pipe(
        map(([vehicleList, catalog]: [Vehicle[], Sponsor]): VehicleSummary[] =>
          vehicleList.map((v: Vehicle): VehicleSummary => buildVehicleSummary(v, catalog)),
        ),
        catchError(() => of<VehicleSummary[]>([])),
      )
      .subscribe((summaries: VehicleSummary[]): void => {
        this.vehicles.set(summaries);
      });
  }

  // ── Édition de l'équipe ───────────────────────────────────────────────────

  onSaved(dto: CreateTeamDto): void {
    const team = this.team();
    if (!team) return;

    this.saving.set(true);
    this.error.set('');

    this.teamsService.update(team.id, dto).subscribe({
      next: (updated: Team): void => {
        this.team.set({ ...updated, vehicleCount: team.vehicleCount });
        this.saving.set(false);
      },
      error: (): void => {
        this.error.set('Une erreur est survenue. Veuillez réessayer.');
        this.saving.set(false);
      },
    });
  }

  // ── Suppression de l'équipe ───────────────────────────────────────────────

  deleteTeam(): void {
    this.pendingDeleteTeam.set(true);
  }

  onConfirmDeleteTeam(): void {
    const team = this.team();
    this.pendingDeleteTeam.set(false);
    if (!team) return;

    this.teamsService.remove(team.id).subscribe({
      next: (): void => {
        this.router.navigate(['/teams']);
      },
      error: (): void => {
        this.error.set('Erreur lors de la suppression.');
      },
    });
  }

  // ── Navigation véhicules ──────────────────────────────────────────────────

  openVehicleBuilder(): void {
    const team = this.team();
    if (!team) return;
    this.router.navigate(['/teams', team.id, 'vehicles', 'new'], { queryParams: { returnTo: 'edit' } });
  }

  openVehicleEditor(vehicleId: number): void {
    const team = this.team();
    if (!team) return;
    this.router.navigate(['/teams', team.id, 'vehicles', vehicleId], { queryParams: { returnTo: 'edit' } });
  }

  // ── Suppression de véhicule ───────────────────────────────────────────────

  deleteVehicle(vehicle: VehicleSummary): void {
    this.pendingDeleteVehicleId.set(vehicle.id);
    this.pendingDeleteVehicleName.set(vehicle.nom);
  }

  onConfirmDeleteVehicle(): void {
    const vehicleId = this.pendingDeleteVehicleId();
    this.pendingDeleteVehicleId.set(null);
    if (vehicleId === null) return;

    this.vehicleService.remove(vehicleId).subscribe({
      next: (): void => {
        const team = this.team();
        if (team) {
          // Recharge équipe + véhicules pour synchroniser vehicleCount
          this.teamsService.getAll().subscribe({
            next: (teams: Team[]): void => {
              const updated = teams.find((t: Team): boolean => t.id === team.id) ?? null;
              if (updated) {
                this.team.set(updated);
                this.loadVehicleSummaries(updated);
              }
            },
          });
        }
      },
      error: (): void => {
        this.error.set('Erreur lors de la suppression du véhicule.');
      },
    });
  }

  goBack(): void {
    this.router.navigate(this.backRoute());
  }
}
