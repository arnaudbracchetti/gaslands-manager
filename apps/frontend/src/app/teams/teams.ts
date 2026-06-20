/**
 * Composant Teams — liste des équipes Gaslands.
 *
 * Responsabilités allégées : afficher les cartes d'équipes + permettre la
 * CRÉATION d'une nouvelle équipe. L'édition, la suppression et la gestion des
 * véhicules ont été déplacées vers `/teams/:id/edit` (TeamEditPage).
 *
 * Un clic sur une carte navigue vers `/teams/:id/edit`.
 */
import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of, map, catchError } from 'rxjs';
import { TeamsService } from './teams.service';
import { Team, CreateTeamDto } from './team.model';
import { TeamCard } from './team-card/team-card';
import { TeamForm } from './team-form/team-form';
import { VehicleService } from './vehicle-configurator/vehicle.service';
import { CatalogService } from '../catalog/catalog.service';
import { Sponsor } from '../catalog/catalog.model';
import { buildVehicleSummary, VehicleSummary } from './vehicle-summary';
import { Vehicle } from './vehicle-configurator/vehicle-builder.model';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [TeamCard, TeamForm],
  templateUrl: './teams.html',
  styleUrl: './teams.scss',
})
export class Teams implements OnInit {
  private teamsService: TeamsService = inject(TeamsService);
  private router: Router = inject(Router);
  private vehicleService: VehicleService = inject(VehicleService);
  private catalogService: CatalogService = inject(CatalogService);

  teams: WritableSignal<Team[]> = signal<Team[]>([]);
  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');

  /** Vrai quand le formulaire de création est visible */
  showForm: WritableSignal<boolean> = signal(false);
  saving: WritableSignal<boolean> = signal(false);

  /**
   * Résumés des véhicules de chaque équipe, indexés par id d'équipe.
   * Alimente l'input `vehicles` de `TeamCard` pour l'affichage en lecture seule.
   */
  vehicleSummaries: WritableSignal<Map<number, VehicleSummary[]>> = signal(new Map<number, VehicleSummary[]>());

  ngOnInit(): void {
    this.loadTeams();
  }

  loadTeams(): void {
    this.loading.set(true);
    this.error.set('');

    this.teamsService.getAll().subscribe({
      next: (teams: Team[]) => {
        this.teams.set(teams);
        this.loading.set(false);
        this.loadVehicleSummaries(teams);
      },
      error: () => {
        this.error.set('Impossible de charger vos équipes. Vérifiez votre connexion.');
        this.loading.set(false);
      },
    });
  }

  private loadVehicleSummaries(teams: Team[]): void {
    const teamsWithVehicles: Team[] = teams.filter((team: Team): boolean => (team.vehicleCount ?? 0) > 0);

    if (teamsWithVehicles.length === 0) {
      this.vehicleSummaries.set(new Map<number, VehicleSummary[]>());
      return;
    }

    const perTeam$ = teamsWithVehicles.map((team: Team) =>
      forkJoin([
        this.vehicleService.getAllForTeam(team.id),
        this.catalogService.getSponsorByName(team.sponsor),
      ]).pipe(
        map(([vehicles, catalog]: [Vehicle[], Sponsor]): [number, VehicleSummary[]] => [
          team.id,
          vehicles.map((vehicle: Vehicle): VehicleSummary => buildVehicleSummary(vehicle, catalog)),
        ]),
        catchError(() => of<[number, VehicleSummary[]]>([team.id, []])),
      ),
    );

    forkJoin(perTeam$).subscribe((entries: [number, VehicleSummary[]][]): void => {
      this.vehicleSummaries.set(new Map<number, VehicleSummary[]>(entries));
    });
  }

  openCreate(): void {
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
  }

  onSaved(dto: CreateTeamDto): void {
    this.saving.set(true);
    this.error.set('');

    this.teamsService.create(dto).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.loadTeams();
      },
      error: () => {
        this.error.set('Une erreur est survenue. Veuillez réessayer.');
        this.saving.set(false);
      },
    });
  }

  navigateToEdit(team: Team): void {
    this.router.navigate(['/teams', team.id, 'edit'], { queryParams: { from: 'teams' } });
  }
}
