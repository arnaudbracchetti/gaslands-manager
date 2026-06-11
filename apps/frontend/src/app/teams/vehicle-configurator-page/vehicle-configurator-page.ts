/**
 * VehicleConfiguratorPage — page dédiée à la construction/édition d'un véhicule.
 *
 * Avant cette page, `VehicleConfigurator` vivait dans `<app-modal size="wide">`
 * (cf. `Teams`, ex-bloc `vehicleModal`). Le contenu — équipement actuel (sidebar)
 * + catalogue d'armes/améliorations en grille — était déjà volumineux ; la modale
 * (max-width `min(1300px, 95vw)`, scroll interne) réduisait l'espace disponible.
 *
 * Cette page ne fait QUE le travail qu'accomplissait `Teams` pour ouvrir la
 * modale : résoudre l'équipe et le mode (création/édition) à partir de l'URL,
 * puis déléguer entièrement à `VehicleConfigurator` (réutilisé sans modification
 * — mêmes inputs `team`/`vehicleId`, même output `done`).
 *
 * ── Routes (cf. `app.routes.ts`) ────────────────────────────────────────────
 *   - `/teams/:teamId/vehicles/new`        → mode CRÉATION (`vehicleId = null`)
 *   - `/teams/:teamId/vehicles/:vehicleId` → mode ÉDITION  (`vehicleId` numérique)
 *
 * ── Résolution de `team` ─────────────────────────────────────────────────────
 * La route ne porte que `teamId` (un nombre), pas l'objet `Team` complet dont
 * `VehicleConfigurator` a besoin (`input.required<Team>()` — sponsor pour le
 * catalogue, id pour la création/le rechargement). Aucun endpoint
 * `GET /api/teams/:id` n'existe (cf. SPECIFICATION.md §6, seul `GET /api/teams`
 * liste) : on réutilise donc le même pattern que
 * `VehicleConfigurator.loadExistingVehicle` — `getAll().find(...)` — déjà
 * éprouvé pour le même problème côté véhicules (`getAllForTeam(...).find(...)`).
 *
 * ── Retour à la liste ────────────────────────────────────────────────────────
 * `(done)` et le lien "← Retour aux équipes" naviguent tous deux vers `/teams`.
 * Pas de rechargement explicite à orchestrer ici : revenir sur `/teams` détruit
 * et recrée le composant `Teams` (route lazy standalone), dont `ngOnInit`
 * rappelle `loadTeams()` — même garantie de rafraîchissement que l'ancien
 * `Teams.closeVehicleModal()` (`vehicleCount`/coûts à jour).
 */
import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Team } from '../team.model';
import { TeamsService } from '../teams.service';
import { VehicleConfigurator } from '../vehicle-configurator/vehicle-configurator';

@Component({
  selector: 'app-vehicle-configurator-page',
  standalone: true,
  imports: [VehicleConfigurator, RouterLink],
  templateUrl: './vehicle-configurator-page.html',
  styleUrl: './vehicle-configurator-page.scss',
})
export class VehicleConfiguratorPage implements OnInit {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly teamsService: TeamsService = inject(TeamsService);

  /** Équipe résolue depuis `:teamId` — `null` tant que non chargée (ou introuvable). */
  team: WritableSignal<Team | null> = signal<Team | null>(null);

  /**
   * `null` ⇒ mode CRÉATION (`/vehicles/new`) ; sinon id numérique du véhicule à
   * éditer (`/vehicles/:vehicleId`) — transmis tel quel à `VehicleConfigurator`.
   */
  vehicleId: WritableSignal<number | null> = signal<number | null>(null);

  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');

  ngOnInit(): void {
    const teamId = Number(this.route.snapshot.paramMap.get('teamId'));

    // Segment littéral 'new' (route .../vehicles/new) ⇒ mode création (`null`).
    // Sinon, le paramètre est l'id numérique du véhicule à éditer.
    const rawVehicleId = this.route.snapshot.paramMap.get('vehicleId');
    this.vehicleId.set(rawVehicleId === null || rawVehicleId === 'new' ? null : Number(rawVehicleId));

    this.teamsService.getAll().subscribe({
      next: (teams: Team[]): void => {
        const found = teams.find((t: Team): boolean => t.id === teamId) ?? null;
        if (!found) {
          // Équipe introuvable (id invalide, ou appartenant à un autre utilisateur
          // — le backend filtre déjà par userId, cf. GET /api/teams) : on signale
          // plutôt que d'afficher un configurateur sans équipe.
          this.error.set('Équipe introuvable.');
        }
        this.team.set(found);
        this.loading.set(false);
      },
      error: (): void => {
        this.error.set('Impossible de charger l\'équipe.');
        this.loading.set(false);
      },
    });
  }

  /** Reçu de `(done)` — retour à la liste des équipes (rafraîchie via ngOnInit de Teams). */
  onDone(): void {
    this.router.navigate(['/teams']);
  }
}
