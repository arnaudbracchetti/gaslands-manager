/**
 * Composant CampaignProgram — gère le Programme Télé d'une saison (US-A1).
 *
 * Composant "smart" : charge les parties et le catalogue de scénarios, gère
 * l'ajout, l'édition et la suppression via CampaignsService. Intégré dans
 * CampaignDetail et affiché uniquement quand la saison est EN_COURS.
 *
 * Reçoit du parent l'identité de la saison et le rôle (isOrganizer). Les actions
 * de gestion ne sont possibles que pour l'organisateur (canManage) ; tout
 * participant VALIDATED voit le programme en lecture seule.
 */
import {
  Component,
  InputSignal,
  OnInit,
  OutputEmitterRef,
  Signal,
  WritableSignal,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CampaignsService } from '../campaigns.service';
import { CampaignState } from '../campaign.model';
import type { CampaignParticipant } from '../campaign-participant.model';
import { Game, Scenario, CreateGameDto } from '../game.model';
import type {
  ParticipantVehiclesDto,
  RecordResultDto,
  WreckOutcomeDto,
  WreckResolveRequestDto,
  GameJournalEntryDto,
} from '../game.model';
import { GameList } from '../game-list/game-list';
import { GameForm } from '../game-form/game-form';
import { GameResultWizard } from '../game-result-wizard/game-result-wizard';
import { GameJournalModal } from '../game-journal-modal/game-journal-modal';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-campaign-program',
  standalone: true,
  imports: [GameList, GameForm, GameResultWizard, GameJournalModal, ConfirmModal],
  templateUrl: './campaign-program.html',
  styleUrl: './campaign-program.scss',
})
export class CampaignProgram implements OnInit {
  private campaignsService: CampaignsService = inject(CampaignsService);

  // ── Inputs ──────────────────────────────────────────────────────────────────

  campaignId: InputSignal<number> = input.required<number>();

  /** Vrai si l'utilisateur est organisateur (peut gérer le programme). */
  isOrganizer: InputSignal<boolean> = input(false);

  /** État courant de la saison — la gestion est interdite en TERMINEE. */
  campaignState: InputSignal<CampaignState> = input.required<CampaignState>();

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /**
   * Émis après l'enregistrement réussi d'un résultat de partie — les Points
   * de Championnat ont changé. Le parent (CampaignDetail) écoute cet
   * événement pour rafraîchir le classement affiché dans ParticipantList,
   * composant frère qui n'a sinon aucun moyen d'être notifié.
   */
  resultRecorded: OutputEmitterRef<void> = output<void>();

  // ── État ──────────────────────────────────────────────────────────────────────

  games: WritableSignal<Game[]> = signal<Game[]>([]);
  scenarios: WritableSignal<Scenario[]> = signal<Scenario[]>([]);
  loading: WritableSignal<boolean> = signal(true);
  error: WritableSignal<string> = signal('');

  /** Vrai quand le formulaire d'ajout/édition est ouvert. */
  showForm: WritableSignal<boolean> = signal(false);
  /** Partie en cours d'édition (null = mode création). */
  editingGame: WritableSignal<Game | null> = signal<Game | null>(null);
  saving: WritableSignal<boolean> = signal(false);

  /** Partie en attente de confirmation de suppression (null = aucune). */
  pendingDeleteGame: WritableSignal<Game | null> = signal<Game | null>(null);

  /** Partie dont on saisit le résultat (null = wizard fermé). */
  recordingGame: WritableSignal<Game | null> = signal<Game | null>(null);
  /** Participants VALIDATED de la saison — source du wizard de fin de partie. */
  participants: WritableSignal<CampaignParticipant[]> = signal<CampaignParticipant[]>([]);
  /** Vrai pendant que la requête recordResult est en cours. */
  savingResult: WritableSignal<boolean> = signal(false);
  /** Non-null une fois recordResult() résolu — fait avancer le wizard vers l'écran 3. */
  wizardResultRecorded: WritableSignal<Game | null> = signal<Game | null>(null);

  /**
   * Véhicules courants des participants présents à la partie en cours de
   * saisie (exploit "véhicules détruits", US-B2, et désignation des épaves) —
   * clé = participantId. Repeuplé à chaque changement de présence
   * (`onPresentParticipantsChanged`).
   */
  participantVehicles: WritableSignal<ReadonlyMap<number, ParticipantVehiclesDto['vehicles']>> =
    signal(new Map());

  /** Résultats de tirage de la Table des Épaves reçus, clé = vehicleId. */
  wreckOutcomes: WritableSignal<ReadonlyMap<number, WreckOutcomeDto>> = signal(new Map());
  /** Lignes de texte décrivant les événements de chaque tirage, clé = vehicleId. */
  wreckDescriptions: WritableSignal<ReadonlyMap<number, string[]>> = signal(new Map());
  /** Vrai pendant qu'une requête resolveWreck est en cours. */
  rollingWreck: WritableSignal<boolean> = signal(false);
  /** Vrai pendant que la finalisation (fin du wizard) est en cours. */
  finalizingGame: WritableSignal<boolean> = signal(false);

  /** Partie dont le journal est consulté (null = modale fermée). */
  journalGame: WritableSignal<Game | null> = signal<Game | null>(null);
  /** Événements du journal de la partie consultée, à plat. */
  journalEntries: WritableSignal<GameJournalEntryDto[]> = signal<GameJournalEntryDto[]>([]);
  /** Vrai pendant le chargement du journal. */
  loadingJournal: WritableSignal<boolean> = signal(false);

  /**
   * La section Programme est affichée dans tous les états (lecture seule en
   * TERMINEE). La gestion (ajout/édition/suppression) n'est possible que pour
   * l'organisateur et tant que la saison n'est pas terminée.
   */
  canManage: Signal<boolean> = computed(
    () => this.isOrganizer() && this.campaignState() !== 'TERMINEE',
  );

  /**
   * Vrai si une pop-up de gestion (ajout/édition de partie ou saisie de
   * résultat) est ouverte. Sert à désactiver les actions de GameList pendant
   * qu'une pop-up est ouverte : sans ça, la liste reste cliquable derrière
   * l'overlay et on peut par exemple supprimer la partie dont on est en train
   * de saisir le résultat, ou ouvrir une seconde pop-up par-dessus la première.
   */
  anyModalOpen: Signal<boolean> = computed(
    () => this.showForm() || this.recordingGame() !== null,
  );

  ngOnInit(): void {
    this.loadGames();
    // Catalogue chargé d'emblée pour que le formulaire soit prêt à l'ouverture.
    this.campaignsService.getScenarios().subscribe({
      next: (scenarios: Scenario[]) => this.scenarios.set(scenarios),
    });
    // Participants chargés d'emblée pour le formulaire de saisie des résultats.
    this.campaignsService.getParticipants(this.campaignId()).subscribe({
      next: (participants: CampaignParticipant[]) => this.participants.set(participants),
    });
  }

  private loadGames(): void {
    this.loading.set(true);
    this.campaignsService.getGames(this.campaignId()).subscribe({
      next: (games: Game[]) => {
        this.games.set(games);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du chargement du programme.');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.editingGame.set(null);
    this.showForm.set(true);
  }

  onEdit(game: Game): void {
    this.editingGame.set(game);
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingGame.set(null);
  }

  /** Soumission du formulaire — crée ou met à jour selon editingGame. */
  onSaved(dto: CreateGameDto): void {
    this.saving.set(true);
    this.error.set('');
    const editing = this.editingGame();

    const request$ = editing
      ? this.campaignsService.updateGame(this.campaignId(), editing.id, dto)
      : this.campaignsService.createGame(this.campaignId(), dto);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingGame.set(null);
        this.loadGames();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Erreur lors de l\'enregistrement de la partie.');
      },
    });
  }

  /** Ouvre le wizard de fin de partie pour la partie donnée. */
  onRecordGame(game: Game): void {
    this.recordingGame.set(game);
    this.participantVehicles.set(new Map());
    this.wizardResultRecorded.set(null);
    this.wreckOutcomes.set(new Map());
    this.wreckDescriptions.set(new Map());
  }

  /**
   * La liste des présents a changé dans le wizard (écran 1) — recharge leurs
   * véhicules courants pour alimenter l'écran 2 (désignation des épaves, US-B2).
   */
  onPresentParticipantsChanged(participantIds: number[]): void {
    const game = this.recordingGame();
    if (!game || participantIds.length === 0) {
      this.participantVehicles.set(new Map());
      return;
    }
    this.campaignsService.getParticipantVehicles(this.campaignId(), game.id, participantIds).subscribe({
      next: (result: ParticipantVehiclesDto[]) => {
        this.participantVehicles.set(new Map(result.map((r) => [r.participantId, r.vehicles])));
      },
      error: () => {
        // L'écran 2 reste vide/désactivé — pas bloquant pour la saisie du
        // classement, mais on log pour ne pas échouer en silence.
        console.error('Impossible de charger les véhicules des participants pour la désignation des épaves.');
      },
    });
  }

  /** Appelé quand l'écran 2 (désignation des épaves) est soumis — enregistre le classement. */
  onRankingSubmitted(dto: RecordResultDto): void {
    const game = this.recordingGame();
    if (!game) return;
    this.savingResult.set(true);
    this.campaignsService.recordResult(this.campaignId(), game.id, dto).subscribe({
      next: (updatedGame: Game) => {
        this.savingResult.set(false);
        this.wizardResultRecorded.set(updatedGame);
        this.loadGames();
      },
      error: () => {
        this.savingResult.set(false);
      },
    });
  }

  /** Déclenché automatiquement par le wizard (écran 3) pour chaque véhicule désigné en épave. */
  onWreckRollRequested(dto: WreckResolveRequestDto): void {
    const game = this.recordingGame();
    if (!game) return;
    this.rollingWreck.set(true);
    this.campaignsService.resolveWreck(this.campaignId(), game.id, dto).subscribe({
      next: (result) => {
        const outcomes = new Map(this.wreckOutcomes());
        outcomes.set(result.outcome.vehicleId, result.outcome);
        this.wreckOutcomes.set(outcomes);
        const descriptions = new Map(this.wreckDescriptions());
        descriptions.set(result.outcome.vehicleId, result.descriptions);
        this.wreckDescriptions.set(descriptions);
        this.rollingWreck.set(false);
      },
      error: () => {
        console.error('Échec du tirage sur la Table des Épaves.');
        this.error.set('Erreur lors du tirage sur la Table des Épaves.');
        this.rollingWreck.set(false);
      },
    });
  }

  /**
   * Le wizard est entièrement terminé (écran 3, "Terminer") — fait entrer la
   * partie en atelier (PLANIFIE → ATELIER) avant de fermer la pop-up. En cas
   * d'échec, le wizard reste ouvert : tous les tirages sont déjà persistés, seule
   * la transition de statut doit être refaite (l'utilisateur peut recliquer
   * "Terminer").
   */
  onWizardCompleted(): void {
    const game = this.recordingGame();
    if (!game) return;
    this.finalizingGame.set(true);
    this.campaignsService.enterAtelier(this.campaignId(), game.id).subscribe({
      next: () => {
        this.finalizingGame.set(false);
        this.recordingGame.set(null);
        this.participantVehicles.set(new Map());
        this.wizardResultRecorded.set(null);
        this.wreckOutcomes.set(new Map());
        this.wreckDescriptions.set(new Map());
        this.loadGames();
        this.resultRecorded.emit();
      },
      error: () => {
        console.error('Échec de l\'entrée en atelier de la partie.');
        this.error.set('Erreur lors du passage en atelier de la partie.');
        this.finalizingGame.set(false);
      },
    });
  }

  /** Ferme le wizard sans enregistrer (uniquement possible avant la soumission du classement). */
  onWizardCancelled(): void {
    this.recordingGame.set(null);
    this.participantVehicles.set(new Map());
  }

  /** Ouvre le journal d'une partie (ATELIER ou JOUE) — accessible à tout participant. */
  onOpenJournal(game: Game): void {
    this.journalGame.set(game);
    this.journalEntries.set([]);
    this.loadingJournal.set(true);
    this.campaignsService.getGameJournal(this.campaignId(), game.id).subscribe({
      next: (entries: GameJournalEntryDto[]) => {
        this.journalEntries.set(entries);
        this.loadingJournal.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du chargement du journal de la partie.');
        this.loadingJournal.set(false);
      },
    });
  }

  onJournalClosed(): void {
    this.journalGame.set(null);
    this.journalEntries.set([]);
    this.loadingJournal.set(false);
  }

  onDelete(game: Game): void {
    this.pendingDeleteGame.set(game);
  }

  onConfirmDelete(): void {
    const game = this.pendingDeleteGame();
    this.pendingDeleteGame.set(null);
    if (!game) return;

    this.campaignsService.deleteGame(this.campaignId(), game.id).subscribe({
      next: () => this.loadGames(),
      error: () => this.error.set('Erreur lors de la suppression de la partie.'),
    });
  }
}
