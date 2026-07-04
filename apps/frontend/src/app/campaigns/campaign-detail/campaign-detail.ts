/**
 * Composant CampaignDetail — page "/campaigns/:id".
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
 * CA3 : si l'utilisateur n'a pas de CampaignParticipant VALIDATED pour cette saison,
 * le backend renvoie 404 — affiché comme message d'erreur générique.
 */
import { Component, OnInit, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CampaignsService } from '../campaigns.service';
import { Campaign, CampaignState, ChangeStateDto } from '../campaign.model';
import { CampaignParticipant, StandingsEntry } from '../campaign-participant.model';
import { ParticipantList } from '../participant-list/participant-list';
import { CampaignProgram } from '../campaign-program/campaign-program';
import { InviteLink } from '../invite-link/invite-link';
import { AuthService } from '../../auth/auth.service';
import { TeamsService } from '../../teams/teams.service';
import { Team } from '../../teams/team.model';
import { ChangeTeamModal } from '../change-team-modal/change-team-modal';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';
import { Breadcrumb, BreadcrumbItem } from '../../shared/breadcrumb/breadcrumb';

const STATE_LABELS: Record<CampaignState, string> = {
  EN_CONSTRUCTION: 'En construction',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
};

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [ParticipantList, CampaignProgram, InviteLink, ChangeTeamModal, ConfirmModal, Breadcrumb],
  templateUrl: './campaign-detail.html',
  styleUrl: './campaign-detail.scss',
})
export class CampaignDetail implements OnInit {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private campaignsService: CampaignsService = inject(CampaignsService);
  private authService: AuthService = inject(AuthService);
  private teamsService: TeamsService = inject(TeamsService);

  readonly campaignId: WritableSignal<number> = signal(Number(this.route.snapshot.params['id']));

  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');
  campaign: WritableSignal<Campaign | null> = signal<Campaign | null>(null);
  participants: WritableSignal<CampaignParticipant[]> = signal<CampaignParticipant[]>([]);
  standings: WritableSignal<StandingsEntry[]> = signal<StandingsEntry[]>([]);
  myTeams: WritableSignal<Team[]> = signal<Team[]>([]);
  showChangeTeamModal: WritableSignal<boolean> = signal(false);

  // ── Confirmations ──────────────────────────────────────────────────────────

  /** Participant en attente de confirmation de retrait (null = aucun) */
  pendingRemoveParticipant: WritableSignal<CampaignParticipant | null> = signal<CampaignParticipant | null>(null);

  /** Participant en attente de confirmation de promotion (null = aucun) */
  pendingPromote: WritableSignal<CampaignParticipant | null> = signal<CampaignParticipant | null>(null);

  /** Nouvel état en attente de confirmation de transition (null = aucun) */
  pendingState: WritableSignal<CampaignState | null> = signal<CampaignState | null>(null);

  /** Vrai quand la suppression de la saison attend confirmation */
  showDeleteCampaignConfirm: WritableSignal<boolean> = signal(false);

  /** Vrai pendant un appel PUT /state */
  stateTransitioning: WritableSignal<boolean> = signal(false);

  myParticipant: Signal<CampaignParticipant | null> = computed(() => {
    const userId = this.authService.currentUser()?.id;
    return this.participants().find((p) => p.userId === userId) ?? null;
  });

  currentUserId: Signal<number | undefined> = computed(() => this.authService.currentUser()?.id);

  isOrganizer: Signal<boolean> = computed(() => this.campaign()?.myRole === 'organizer');

  /** Vrai quand le choix d'équipe est encore modifiable (saison EN_CONSTRUCTION). */
  canChangeTeam: Signal<boolean> = computed(() => this.campaign()?.state === 'EN_CONSTRUCTION');

  breadcrumbs: Signal<BreadcrumbItem[]> = computed(() => [
    { label: 'Saisons', route: ['/campaigns'] },
    { label: this.campaign()?.name ?? '…' },
  ]);

  /** Message de confirmation pour la transition d'état (utilisé dans le template). */
  pendingStateLabel: Signal<string> = computed(() => STATE_LABELS[this.pendingState() ?? 'EN_CONSTRUCTION']);

  stateLabel: Signal<string> = computed(() => {
    const state = this.campaign()?.state;
    return state ? STATE_LABELS[state] : '';
  });

  validatedCount: Signal<number> = computed(
    () => this.participants().filter((p) => p.status === 'VALIDATED').length,
  );

  pendingCount: Signal<number> = computed(
    () => this.participants().filter((p) => p.status === 'PENDING').length,
  );

  /**
   * PC par participantId — construit depuis les standings (participants
   * VALIDATED avec équipe uniquement). Absence de clé = 0 PC (participant
   * PENDING/REJECTED, ou VALIDATED n'ayant encore joué aucune partie).
   */
  championshipPoints: Signal<ReadonlyMap<number, number>> = computed(
    () => new Map(this.standings().map((s) => [s.participantId, s.championshipPoints])),
  );

  ngOnInit(): void {
    this.loading.set(true);
    this.error.set('');

    this.teamsService.getAll().subscribe({
      next: (teams: Team[]) => this.myTeams.set(teams),
    });

    this.campaignsService.getOne(this.campaignId()).subscribe({
      next: (campaign: Campaign) => {
        this.campaign.set(campaign);
        this.loadParticipants();
      },
      error: () => {
        this.error.set('Cette saison est introuvable ou vous n\'y avez pas accès.');
        this.loading.set(false);
      },
    });
  }

  private loadParticipants(): void {
    this.campaignsService.getParticipants(this.campaignId()).subscribe({
      next: (participants: CampaignParticipant[]) => {
        this.participants.set(participants);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Cette saison est introuvable ou vous n\'y avez pas accès.');
        this.loading.set(false);
      },
    });

    this.loadStandings();
  }

  /**
   * Chargement indépendant des participants : si /standings échoue, la
   * liste s'affiche quand même, simplement sans PC. Rappelé par
   * onResultRecorded() pour rafraîchir le classement après la saisie d'un
   * résultat dans CampaignProgram (composant frère de ParticipantList).
   */
  private loadStandings(): void {
    this.campaignsService.getStandings(this.campaignId()).subscribe({
      next: (standings: StandingsEntry[]) => this.standings.set(standings),
      error: () => {
        // Non bloquant : la liste des participants reste utilisable sans PC.
      },
    });
  }

  /** CampaignProgram émet cet événement après l'enregistrement d'un résultat. */
  onResultRecorded(): void {
    this.loadStandings();
  }

  onValidate(event: { pid: number; accept: boolean }): void {
    this.campaignsService.validateParticipant(this.campaignId(), event.pid, { accept: event.accept }).subscribe({
      next: (updated: CampaignParticipant) => {
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

    this.campaignsService.removeParticipant(this.campaignId(), participant.id).subscribe({
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

    this.campaignsService.promote(this.campaignId(), participant.id).subscribe({
      next: (updated: CampaignParticipant) => {
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
  onChangeState(newState: CampaignState): void {
    const campaign = this.campaign();
    if (!campaign) return;
    this.pendingState.set(newState);
  }

  onConfirmChangeState(): void {
    const newState = this.pendingState();
    this.pendingState.set(null);
    if (!newState) return;

    this.stateTransitioning.set(true);
    this.error.set('');

    const dto: ChangeStateDto = { state: newState };
    this.campaignsService.changeState(this.campaignId(), dto).subscribe({
      next: (updated: Campaign) => {
        this.campaign.set(updated);
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
    this.campaignsService.updateMyTeam(this.campaignId(), { teamId }).subscribe({
      next: (updated: CampaignParticipant) => {
        this.participants.set(
          this.participants().map((p) => (p.id === updated.id ? updated : p)),
        );
      },
      error: () => this.error.set('Erreur lors du changement d\'équipe.'),
    });
  }

  deleteCampaign(): void {
    const campaign = this.campaign();
    if (!campaign) return;
    this.showDeleteCampaignConfirm.set(true);
  }

  onConfirmDeleteCampaign(): void {
    this.showDeleteCampaignConfirm.set(false);

    this.campaignsService.remove(this.campaignId()).subscribe({
      next: () => this.router.navigate(['/campaigns']),
      error: () => this.error.set('Erreur lors de la suppression de la saison.'),
    });
  }
}
