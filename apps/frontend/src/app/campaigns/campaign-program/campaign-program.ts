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
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { CampaignsService } from '../campaigns.service';
import { CampaignState } from '../campaign.model';
import type { CampaignParticipant } from '../campaign-participant.model';
import { Game, GameType, Scenario, CreateGameDto } from '../game.model';
import type {
  ParticipantVehiclesDto,
  RecordResultDto,
  RollIncomeResultDto,
  WreckOutcomeDto,
  WreckResolveRequestDto,
  GameJournalEntryDto,
} from '../game.model';
import { GameList } from '../game-list/game-list';
import { GameForm } from '../game-form/game-form';
import { GameResultWizard } from '../game-result-wizard/game-result-wizard';
import { GameJournalModal } from '../game-journal-modal/game-journal-modal';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-campaign-program',
  standalone: true,
  imports: [GameList, GameForm, GameResultWizard, GameJournalModal, ConfirmModal, Icon],
  templateUrl: './campaign-program.html',
  styleUrl: './campaign-program.scss',
})
export class CampaignProgram implements OnInit {
  private campaignsService: CampaignsService = inject(CampaignsService);
  private router: Router = inject(Router);

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

  /**
   * Émis à chaque rechargement du programme — vrai si une partie de la
   * campagne est actuellement en statut ATELIER (un seul possible à la
   * fois). CampaignDetail l'utilise pour piloter le lien "Gérer mon équipe"
   * de ParticipantList, composant frère qui n'a sinon aucun moyen de
   * connaître ce statut.
   */
  atelierStatusChanged: OutputEmitterRef<boolean> = output<boolean>();

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

  /** Vrai pendant l'appel au tirage aléatoire de scénario (D6 serveur). */
  drawingScenario: WritableSignal<boolean> = signal(false);
  /** `nom_interne` du dernier scénario tiré aléatoirement, transmis à GameForm. */
  pickedScenarioId: WritableSignal<string | null> = signal<string | null>(null);

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
  /** Résultats de revenu Escarmouche reçus, clé = participantId. */
  incomeResults: WritableSignal<ReadonlyMap<number, RollIncomeResultDto>> = signal(new Map());
  /** Vrai pendant qu'une requête rollIncome/resolveWreck est en cours (un tirage à la fois). */
  resolving: WritableSignal<boolean> = signal(false);
  /** Vrai pendant que la finalisation (fin du wizard) est en cours. */
  finalizingGame: WritableSignal<boolean> = signal(false);
  /** Vrai pendant qu'une annulation à l'écran Résolution (DELETE .../results) est en cours. */
  resettingResult: WritableSignal<boolean> = signal(false);

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
        this.atelierStatusChanged.emit(games.some((g) => g.status === 'ATELIER'));
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Erreur lors du chargement du programme.';
        console.error(msg);
        this.error.set(msg);
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.editingGame.set(null);
    this.pickedScenarioId.set(null);
    this.showForm.set(true);
  }

  onEdit(game: Game): void {
    this.editingGame.set(game);
    this.pickedScenarioId.set(null);
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingGame.set(null);
    this.pickedScenarioId.set(null);
  }

  /**
   * Tirage aléatoire d'un scénario (Gaslands p.128-129, D6 serveur) — le tableau
   * de probabilités officiel vit entièrement côté backend
   * (`GET /api/catalog/scenarios/random`), ce composant ne fait que relayer le
   * résultat à `GameForm` via `pickedScenarioId`.
   */
  onRandomScenarioRequested(type: GameType): void {
    this.drawingScenario.set(true);
    this.pickedScenarioId.set(null);
    this.campaignsService.drawRandomScenario(type).subscribe({
      next: (scenario: Scenario) => {
        this.drawingScenario.set(false);
        this.pickedScenarioId.set(scenario.nom_interne);
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Erreur lors du tirage aléatoire du scénario.';
        console.error(msg);
        this.error.set(msg);
        this.drawingScenario.set(false);
      },
    });
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
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Erreur lors de l\'enregistrement de la partie.';
        console.error(msg);
        this.saving.set(false);
        this.error.set(msg);
      },
    });
  }

  /**
   * Réordonnancement du Programme (US-A4) — GameList a déjà appliqué le nouvel
   * ordre localement (retour visuel immédiat pendant le drag) ; on persiste
   * puis on recharge dans tous les cas, succès ou échec, pour resynchroniser
   * l'affichage sur l'état serveur (l'`order` réel n'est jamais recalculé
   * côté client).
   */
  onReorder(gameIds: number[]): void {
    this.campaignsService.reorderGames(this.campaignId(), gameIds).subscribe({
      next: () => this.loadGames(),
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Erreur lors du réordonnancement du programme.';
        console.error(msg);
        this.error.set(msg);
        this.loadGames();
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
    this.incomeResults.set(new Map());
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

  /**
   * Appelé quand l'écran Désignation des épaves est soumis — persiste le lot
   * accumulé (classement + exploits pour un Événement Télévisé, ou jerricans/
   * destructions pour une Escarmouche, cf. `GameResultWizard.buildRecordResultDto`).
   */
  onBatchReady(dto: RecordResultDto): void {
    const game = this.recordingGame();
    if (!game) return;
    this.savingResult.set(true);
    this.campaignsService.recordResult(this.campaignId(), game.id, dto).subscribe({
      next: (updatedGame: Game) => {
        this.savingResult.set(false);
        this.wizardResultRecorded.set(updatedGame);
        this.loadGames();
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Erreur lors de l\'enregistrement du résultat.';
        console.error(msg);
        this.savingResult.set(false);
        this.error.set(msg);
      },
    });
  }

  /** Déclenché automatiquement par le wizard (écran Résolution) pour chaque participant présent (Escarmouche). */
  onIncomeRollRequested(participantId: number): void {
    const game = this.recordingGame();
    if (!game) return;
    this.resolving.set(true);
    this.campaignsService.rollIncome(this.campaignId(), game.id, { participantId }).subscribe({
      next: (result) => {
        const map = new Map(this.incomeResults());
        map.set(participantId, result);
        this.incomeResults.set(map);
        this.resolving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Erreur lors du tirage du revenu de base.';
        console.error(msg);
        this.error.set(msg);
        this.resolving.set(false);
      },
    });
  }

  /** Déclenché automatiquement par le wizard (écran Résolution) pour chaque véhicule désigné en épave. */
  onWreckRollRequested(dto: WreckResolveRequestDto): void {
    const game = this.recordingGame();
    if (!game) return;
    this.resolving.set(true);
    this.campaignsService.resolveWreck(this.campaignId(), game.id, dto).subscribe({
      next: (result) => {
        const outcomes = new Map(this.wreckOutcomes());
        outcomes.set(result.outcome.vehicleId, result.outcome);
        this.wreckOutcomes.set(outcomes);
        const descriptions = new Map(this.wreckDescriptions());
        descriptions.set(result.outcome.vehicleId, result.descriptions);
        this.wreckDescriptions.set(descriptions);
        this.resolving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Erreur lors du tirage sur la Table des Épaves.';
        console.error(msg);
        this.error.set(msg);
        this.resolving.set(false);
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
        this.closeWizard();
        this.loadGames();
        this.resultRecorded.emit();
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Erreur lors du passage en atelier de la partie.';
        console.error(msg);
        this.error.set(msg);
        this.finalizingGame.set(false);
      },
    });
  }

  /**
   * Annule le wizard. Avant que le lot (classement/jerricans/destructions) ne
   * soit persisté, il n'y a rien à défaire côté serveur — fermeture immédiate.
   * Une fois persisté (`wizardResultRecorded` non-null, écran Résolution atteint),
   * "Annuler" doit défaire ce qui a déjà été écrit (classement, exploits, revenus,
   * tirages d'épaves) : `ResetResultUseCase` (`DELETE .../results`) supprime tous
   * les événements de la partie en une seule opération, cf. spec/CAMPAIGN.md —
   * Persistance différée.
   */
  onWizardCancelled(): void {
    const game = this.recordingGame();
    const wasPersisted = this.wizardResultRecorded() !== null;
    if (!game || !wasPersisted) {
      this.closeWizard();
      return;
    }
    this.resettingResult.set(true);
    this.campaignsService.resetResult(this.campaignId(), game.id).subscribe({
      next: () => {
        this.resettingResult.set(false);
        this.closeWizard();
        this.loadGames();
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Erreur lors de l\'annulation du résultat.';
        console.error(msg);
        this.error.set(msg);
        this.resettingResult.set(false);
      },
    });
  }

  private closeWizard(): void {
    this.recordingGame.set(null);
    this.participantVehicles.set(new Map());
    this.wizardResultRecorded.set(null);
    this.wreckOutcomes.set(new Map());
    this.wreckDescriptions.set(new Map());
    this.incomeResults.set(new Map());
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
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Erreur lors du chargement du journal de la partie.';
        console.error(msg);
        this.error.set(msg);
        this.loadingJournal.set(false);
      },
    });
  }

  onJournalClosed(): void {
    this.journalGame.set(null);
    this.journalEntries.set([]);
    this.loadingJournal.set(false);
  }

  /**
   * Ouvre l'atelier (phase garage post-partie). L'atelier est au niveau de la
   * campagne (`GetWorkshopUseCase` retrouve l'unique partie en ATELIER et l'équipe
   * du participant connecté) — la navigation ne dépend donc pas du `gameId`.
   */
  onOpenAtelier(): void {
    this.router.navigate(['/campaigns', this.campaignId(), 'atelier']);
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
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? err.message ?? 'Erreur lors de la suppression de la partie.';
        console.error(msg);
        this.error.set(msg);
      },
    });
  }
}
