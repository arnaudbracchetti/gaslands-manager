/**
 * TeamEditPage — hub complet de gestion d'une équipe.
 *
 * Accessible via `/teams/:id/edit`. Layout deux panneaux côte à côte :
 * - Panneau gauche : identité (nom, description, budget) + sponsor
 * - Panneau droit  : liste des véhicules avec actions + suppression équipe
 *
 * Les signaux de formulaire (formName, formSponsor…) sont gérés directement
 * ici plutôt que via <app-team-form>, car le formulaire et les véhicules
 * occupent maintenant deux panneaux séparés et ne peuvent pas être encapsulés
 * dans un seul composant enfant.
 *
 * ── Auto-save ─────────────────────────────────────────────────────────────────
 * Chaque champ déclenche `saveField()` au blur (perte de focus). Le sponsor
 * déclenche `saveField('sponsor')` directement via l'event `(sponsorChange)`.
 * Il n'y a pas de boutons Annuler / Enregistrer.
 *
 * ── Fil d'Ariane ─────────────────────────────────────────────────────────────
 * Le query param `from` détermine le lien de retour :
 *   - `from=teams`               → /teams (liste des équipes)
 *   - `from=season&seasonId=X`   → /seasons/X (détail d'une saison)
 *   - absent                     → fallback /teams
 */
import {
  Component,
  OnInit,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Breadcrumb, BreadcrumbItem } from '../../shared/breadcrumb/breadcrumb';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, map, catchError } from 'rxjs';
import { Team, CreateTeamDto, SponsorInfo, DEFAULT_CANS } from '../team.model';
import { TeamsService } from '../teams.service';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';
import { VehicleService } from '../vehicle-configurator/vehicle.service';
import { CatalogService } from '../../catalog/catalog.service';
import { Vehicle } from '../vehicle-configurator/vehicle-builder.model';
import { Sponsor } from '../../catalog/catalog.model';
import { buildVehicleSummary, VehicleSummary } from '../vehicle-summary';
import { SponsorCarousel } from '../sponsor-carousel/sponsor-carousel';
import { VehicleSummaryCard } from '../vehicle-summary-card/vehicle-summary-card';

@Component({
  selector: 'app-team-edit-page',
  standalone: true,
  imports: [FormsModule, ConfirmModal, SponsorCarousel, VehicleSummaryCard, Breadcrumb],
  templateUrl: './team-edit-page.html',
  styleUrl: './team-edit-page.scss',
})
export class TeamEditPage implements OnInit {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly teamsService: TeamsService = inject(TeamsService);
  private readonly vehicleService: VehicleService = inject(VehicleService);
  private readonly catalogService: CatalogService = inject(CatalogService);

  // ── État équipe ───────────────────────────────────────────────────────────

  team: WritableSignal<Team | null> = signal<Team | null>(null);
  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');

  vehicles: WritableSignal<VehicleSummary[]> = signal<VehicleSummary[]>([]);

  /** Vrai si l'équipe possède au moins un véhicule (verrouille le carousel sponsor). */
  hasVehicles = computed((): boolean => (this.team()?.vehicleCount ?? 0) > 0);

  // ── État formulaire (migré depuis TeamForm) ────────────────────────────────

  formName: WritableSignal<string>        = signal('');
  formSponsor: WritableSignal<string>     = signal('Rutherford');
  formCans: WritableSignal<number>        = signal(DEFAULT_CANS);
  formDescription: WritableSignal<string> = signal('');
  formError: WritableSignal<string>       = signal('');

  /** Budget utilisé = coût total de tous les véhicules. */
  budgetUtilise = computed((): number =>
    this.vehicles().reduce((sum: number, v: VehicleSummary): number => sum + v.cout, 0),
  );

  /** Pourcentage du budget utilisé, plafonné à 100%. */
  budgetPourcentage = computed((): number =>
    Math.min(100, Math.round((this.budgetUtilise() / (this.formCans() || 1)) * 100)),
  );

  /** Solde restant (peut être négatif si dépassement). */
  budgetRestant = computed((): number => this.formCans() - this.budgetUtilise());

  // ── Catalogue des sponsors ─────────────────────────────────────────────────

  sponsors: WritableSignal<SponsorInfo[]>  = signal<SponsorInfo[]>([]);
  loadingSponsors: WritableSignal<boolean> = signal<boolean>(true);

  // ── Confirmation de suppression ────────────────────────────────────────────

  pendingDeleteTeam: WritableSignal<boolean>     = signal(false);
  pendingDeleteVehicleId: WritableSignal<number | null> = signal<number | null>(null);
  pendingDeleteVehicleName: WritableSignal<string>      = signal('');

  // ── Confirmation ajout premier véhicule ───────────────────────────────────

  /** Vrai quand la ConfirmModal d'avertissement verrouillage sponsor est ouverte. */
  pendingAddVehicle: WritableSignal<boolean> = signal(false);

  // ── Navigation / fil d'Ariane ─────────────────────────────────────────────

  private fromParam: WritableSignal<string>            = signal('teams');
  private seasonIdParam: WritableSignal<string | null> = signal<string | null>(null);

  breadcrumbs = computed((): BreadcrumbItem[] => {
    const isFromSeason = this.fromParam() === 'season' && this.seasonIdParam();
    return [
      isFromSeason
        ? { label: 'Saisons', route: ['/seasons', this.seasonIdParam()!] }
        : { label: 'Mes Équipes', route: ['/teams'] },
      { label: this.team()?.name ?? '…' },
    ];
  });

  constructor() {
    /**
     * Pré-remplit les champs du formulaire quand l'équipe est chargée ou change.
     */
    effect((): void => {
      const t = this.team();
      if (t) {
        this.formName.set(t.name);
        this.formSponsor.set(t.sponsor);
        this.formCans.set(t.cans);
        this.formDescription.set(t.description ?? '');
      }
      this.formError.set('');
    });
  }

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

    this.catalogService.getSponsors().subscribe({
      next: (sponsors: SponsorInfo[]): void => {
        this.sponsors.set(sponsors);
        this.loadingSponsors.set(false);
      },
      error: (): void => {
        this.loadingSponsors.set(false);
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

  // ── Édition de l'équipe (auto-save au blur) ──────────────────────────────

  saveField(fieldName: 'name' | 'description' | 'cans' | 'sponsor'): void {
    if (fieldName === 'name') {
      const name = this.formName().trim();
      if (!name) {
        this.formError.set("Le nom de l'équipe est obligatoire.");
        return;
      }
      this.formError.set('');
    }

    const team = this.team();
    if (!team) return;

    const dto: CreateTeamDto = {
      name:        this.formName().trim() || team.name,
      sponsor:     this.formSponsor(),
      cans:        this.formCans(),
      description: this.formDescription().trim() || undefined,
    };

    this.error.set('');

    this.teamsService.update(team.id, dto).subscribe({
      next: (updated: Team): void => {
        this.team.set({ ...updated, vehicleCount: team.vehicleCount });
      },
      error: (): void => {
        this.error.set('Une erreur est survenue lors de la sauvegarde.');
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
    if (!this.hasVehicles()) {
      this.pendingAddVehicle.set(true);
      return;
    }
    this.navigateToVehicleBuilder();
  }

  confirmAddVehicle(): void {
    this.pendingAddVehicle.set(false);
    this.navigateToVehicleBuilder();
  }

  cancelAddVehicle(): void {
    this.pendingAddVehicle.set(false);
  }

  private navigateToVehicleBuilder(): void {
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
}
