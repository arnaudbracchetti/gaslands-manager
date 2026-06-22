/**
 * Composant SeasonDetail — page "/seasons/:id".
 *
 * Composant "smart" : charge le détail de la saison et ses participants, puis
 * délègue l'affichage à ParticipantList (liste unifiée — tous statuts, toutes
 * sections).
 *
 * Structure de la page :
 *  1. Carte d'état (organisateur uniquement) — gestion des transitions EN_CONSTRUCTION
 *     / EN_COURS / TERMINÉE avec code d'invitation et boutons de transition.
 *  2. Section "Participants" unifiée — tous les participants dans une seule liste,
 *     avec actions contextuelles selon statut et rôle.
 *  3. Zone dangereuse — suppression de la saison (organisateur uniquement).
 *
 * CA3 : si l'utilisateur n'a pas de SeasonParticipant VALIDATED pour cette saison,
 * le backend renvoie 404 — affiché comme message d'erreur générique.
 */
import { Component, OnInit, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SeasonsService } from '../seasons.service';
import { Season, SeasonState, ChangeStateDto } from '../season.model';
import { SeasonParticipant } from '../season-participant.model';
import { ParticipantList } from '../participant-list/participant-list';
import { SeasonProgram } from '../season-program/season-program';
import { InviteLink } from '../invite-link/invite-link';
import { AuthService } from '../../auth/auth.service';
import { TeamsService } from '../../teams/teams.service';
import { Team } from '../../teams/team.model';
import { ChangeTeamModal } from '../change-team-modal/change-team-modal';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';
import { Breadcrumb, BreadcrumbItem } from '../../shared/breadcrumb/breadcrumb';

const STATE_LABELS: Record<SeasonState, string> = {
  EN_CONSTRUCTION: 'En construction',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
};

@Component({
  selector: 'app-season-detail',
  standalone: true,
  imports: [ParticipantList, SeasonProgram, InviteLink, ChangeTeamModal, ConfirmModal, Breadcrumb],
  templateUrl: './season-detail.html',
  styleUrl: './season-detail.scss',
})
export class SeasonDetail implements OnInit {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private seasonsService: SeasonsService = inject(SeasonsService);
  private authService: AuthService = inject(AuthService);
  private teamsService: TeamsService = inject(TeamsService);

  readonly seasonId: WritableSignal<number> = signal(Number(this.route.snapshot.params['id']));

  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');
  season: WritableSignal<Season | null> = signal<Season | null>(null);
  participants: WritableSignal<SeasonParticipant[]> = signal<SeasonParticipant[]>([]);
  myTeams: WritableSignal<Team[]> = signal<Team[]>([]);
  showChangeTeamModal: WritableSignal<boolean> = signal(false);

  // ── Confirmations ──────────────────────────────────────────────────────────

  /** Participant en attente de confirmation de retrait (null = aucun) */
  pendingRemoveParticipant: WritableSignal<SeasonParticipant | null> = signal<SeasonParticipant | null>(null);

  /** Participant en attente de confirmation de promotion (null = aucun) */
  pendingPromote: WritableSignal<SeasonParticipant | null> = signal<SeasonParticipant | null>(null);

  /** Nouvel état en attente de confirmation de transition (null = aucun) */
  pendingState: WritableSignal<SeasonState | null> = signal<SeasonState | null>(null);

  /** Vrai quand la suppression de la saison attend confirmation */
  showDeleteSeasonConfirm: WritableSignal<boolean> = signal(false);

  /** Vrai pendant un appel PUT /state */
  stateTransitioning: WritableSignal<boolean> = signal(false);

  myParticipant: Signal<SeasonParticipant | null> = computed(() => {
    const userId = this.authService.currentUser()?.id;
    return this.participants().find((p) => p.userId === userId) ?? null;
  });

  currentUserId: Signal<number | undefined> = computed(() => this.authService.currentUser()?.id);

  isOrganizer: Signal<boolean> = computed(() => this.season()?.myRole === 'organizer');

  /** Vrai quand le choix d'équipe est encore modifiable (saison EN_CONSTRUCTION). */
  canChangeTeam: Signal<boolean> = computed(() => this.season()?.state === 'EN_CONSTRUCTION');

  breadcrumbs: Signal<BreadcrumbItem[]> = computed(() => [
    { label: 'Saisons', route: ['/seasons'] },
    { label: this.season()?.name ?? '…' },
  ]);

  /** Message de confirmation pour la transition d'état (utilisé dans le template). */
  pendingStateLabel: Signal<string> = computed(() => STATE_LABELS[this.pendingState() ?? 'EN_CONSTRUCTION']);

  stateLabel: Signal<string> = computed(() => {
    const state = this.season()?.state;
    return state ? STATE_LABELS[state] : '';
  });

  validatedCount: Signal<number> = computed(
    () => this.participants().filter((p) => p.status === 'VALIDATED').length,
  );

  pendingCount: Signal<number> = computed(
    () => this.participants().filter((p) => p.status === 'PENDING').length,
  );

  ngOnInit(): void {
    this.loading.set(true);
    this.error.set('');

    this.teamsService.getAll().subscribe({
      next: (teams: Team[]) => this.myTeams.set(teams),
    });

    this.seasonsService.getOne(this.seasonId()).subscribe({
      next: (season: Season) => {
        this.season.set(season);
        this.loadParticipants();
      },
      error: () => {
        this.error.set('Cette saison est introuvable ou vous n\'y avez pas accès.');
        this.loading.set(false);
      },
    });
  }

  private loadParticipants(): void {
    this.seasonsService.getParticipants(this.seasonId()).subscribe({
      next: (participants: SeasonParticipant[]) => {
        this.participants.set(participants);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Cette saison est introuvable ou vous n\'y avez pas accès.');
        this.loading.set(false);
      },
    });
  }

  onValidate(event: { pid: number; accept: boolean }): void {
    this.seasonsService.validateParticipant(this.seasonId(), event.pid, { accept: event.accept }).subscribe({
      next: (updated: SeasonParticipant) => {
        this.participants.set(
          this.participants().map((p) => (p.id === updated.id ? updated : p)),
        );
      },
    });
  }

  onRemoveParticipant(pid: number): void {
    const participant = this.participants().find((p) => p.id === pid);
    if (!participant) return;
    this.pendingRemoveParticipant.set(participant);
  }

  onConfirmRemoveParticipant(): void {
    const participant = this.pendingRemoveParticipant();
    this.pendingRemoveParticipant.set(null);
    if (!participant) return;

    this.participants.update((list) => list.filter((p) => p.id !== participant.id));

    this.seasonsService.removeParticipant(this.seasonId(), participant.id).subscribe({
      error: () => {
        this.error.set('Erreur lors du retrait du participant.');
        this.loadParticipants();
      },
    });
  }

  onPromote(pid: number): void {
    const participant = this.participants().find((p) => p.id === pid);
    if (!participant) return;
    this.pendingPromote.set(participant);
  }

  onConfirmPromote(): void {
    const participant = this.pendingPromote();
    this.pendingPromote.set(null);
    if (!participant) return;

    this.seasonsService.promote(this.seasonId(), participant.id).subscribe({
      next: (updated: SeasonParticipant) => {
        this.participants.set(
          this.participants().map((p) => (p.id === updated.id ? updated : p)),
        );
      },
      error: () => this.error.set('Erreur lors de la promotion.'),
    });
  }

  /**
   * Change l'état de la saison — transitions bidirectionnelles.
   * Une confirmation est requise avant chaque transition.
   */
  onChangeState(newState: SeasonState): void {
    const season = this.season();
    if (!season) return;
    this.pendingState.set(newState);
  }

  onConfirmChangeState(): void {
    const newState = this.pendingState();
    this.pendingState.set(null);
    if (!newState) return;

    this.stateTransitioning.set(true);
    this.error.set('');

    const dto: ChangeStateDto = { state: newState };
    this.seasonsService.changeState(this.seasonId(), dto).subscribe({
      next: (updated: Season) => {
        this.season.set(updated);
        this.stateTransitioning.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du changement d\'état.');
        this.stateTransitioning.set(false);
      },
    });
  }

  openChangeTeamModal(): void {
    this.showChangeTeamModal.set(true);
  }

  onConfirmChangeTeam(teamId: number | null): void {
    this.showChangeTeamModal.set(false);
    this.seasonsService.updateMyTeam(this.seasonId(), { teamId }).subscribe({
      next: (updated: SeasonParticipant) => {
        this.participants.set(
          this.participants().map((p) => (p.id === updated.id ? updated : p)),
        );
      },
      error: () => this.error.set('Erreur lors du changement d\'équipe.'),
    });
  }

  deleteSeason(): void {
    const season = this.season();
    if (!season) return;
    this.showDeleteSeasonConfirm.set(true);
  }

  onConfirmDeleteSeason(): void {
    this.showDeleteSeasonConfirm.set(false);

    this.seasonsService.remove(this.seasonId()).subscribe({
      next: () => this.router.navigate(['/seasons']),
      error: () => this.error.set('Erreur lors de la suppression de la saison.'),
    });
  }
}
