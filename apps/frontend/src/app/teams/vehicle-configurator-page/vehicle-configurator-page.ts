/**
 * VehicleConfiguratorPage — page dédiée à la construction/édition d'un véhicule.
 *
 * ── Routes (cf. `app.routes.ts`) ────────────────────────────────────────────
 *   - `/teams/:teamId/vehicles/new`        → mode CRÉATION (`vehicleId = null`)
 *   - `/teams/:teamId/vehicles/:vehicleId` → mode ÉDITION  (`vehicleId` numérique)
 *
 * ── Retour ───────────────────────────────────────────────────────────────────
 * Le query param `returnTo` détermine la destination du retour :
 *   - absent ou `teams`  → /teams
 *   - `edit`             → /teams/:teamId/edit (TeamEditPage)
 * `TeamEditPage` passe `returnTo=edit` lors de la navigation vers cette page.
 */
import { Component, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Team } from '../team.model';
import { TeamsService } from '../teams.service';
import { VehicleConfigurator } from '../vehicle-configurator/vehicle-configurator';
import { Breadcrumb, BreadcrumbItem } from '../../shared/breadcrumb/breadcrumb';

@Component({
  selector: 'app-vehicle-configurator-page',
  standalone: true,
  imports: [VehicleConfigurator, Breadcrumb],
  templateUrl: './vehicle-configurator-page.html',
  styleUrl: './vehicle-configurator-page.scss',
})
export class VehicleConfiguratorPage implements OnInit {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly teamsService: TeamsService = inject(TeamsService);

  team: WritableSignal<Team | null> = signal<Team | null>(null);
  vehicleId: WritableSignal<number | null> = signal<number | null>(null);
  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');

  private returnTo: WritableSignal<string> = signal('teams');

  /** Route de retour — conservée pour onDone() */
  backRoute = computed((): string[] => {
    const t = this.team();
    return this.returnTo() === 'edit' && t ? ['/teams', String(t.id), 'edit'] : ['/teams'];
  });

  breadcrumbs = computed((): BreadcrumbItem[] => {
    const t = this.team();
    const isEdit = this.returnTo() === 'edit';
    const current = this.vehicleId() === null ? 'Ajouter un véhicule' : "Gérer l'équipement";
    if (isEdit && t) {
      return [
        { label: 'Mes Équipes', route: ['/teams'] },
        { label: t.name, route: ['/teams', String(t.id), 'edit'] },
        { label: current },
      ];
    }
    return [{ label: 'Mes Équipes', route: ['/teams'] }, { label: current }];
  });

  ngOnInit(): void {
    const teamId = Number(this.route.snapshot.paramMap.get('teamId'));
    const rawVehicleId = this.route.snapshot.paramMap.get('vehicleId');
    this.vehicleId.set(rawVehicleId === null || rawVehicleId === 'new' ? null : Number(rawVehicleId));
    this.returnTo.set(this.route.snapshot.queryParamMap.get('returnTo') ?? 'teams');

    this.teamsService.getAll().subscribe({
      next: (teams: Team[]): void => {
        const found = teams.find((t: Team): boolean => t.id === teamId) ?? null;
        if (!found) {
          this.error.set('Équipe introuvable.');
        }
        this.team.set(found);
        this.loading.set(false);
      },
      error: (): void => {
        this.error.set("Impossible de charger l'équipe.");
        this.loading.set(false);
      },
    });
  }

  onDone(): void {
    this.router.navigate(this.backRoute());
  }
}
