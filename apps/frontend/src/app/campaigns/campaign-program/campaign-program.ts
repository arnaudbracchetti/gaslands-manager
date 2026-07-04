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
  Signal,
  WritableSignal,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CampaignsService } from '../campaigns.service';
import { CampaignState } from '../campaign.model';
import type { CampaignParticipant } from '../campaign-participant.model';
import { Game, Scenario, CreateGameDto } from '../game.model';
import type { RecordResultDto } from '../game.model';
import { GameList } from '../game-list/game-list';
import { GameForm } from '../game-form/game-form';
import { GameResultForm } from '../game-result-form/game-result-form';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-campaign-program',
  standalone: true,
  imports: [GameList, GameForm, GameResultForm, ConfirmModal],
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

  /** Partie dont on saisit le résultat (null = formulaire de résultat fermé). */
  recordingGame: WritableSignal<Game | null> = signal<Game | null>(null);
  /** Participants VALIDATED de la saison — source du formulaire de résultat. */
  participants: WritableSignal<CampaignParticipant[]> = signal<CampaignParticipant[]>([]);
  /** Vrai pendant que la requête recordResult est en cours. */
  savingResult: WritableSignal<boolean> = signal(false);

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

  /** Ouvre le formulaire de saisie des résultats pour la partie donnée. */
  onRecordGame(game: Game): void {
    this.recordingGame.set(game);
  }

  /** Appelé quand le formulaire de résultat est soumis. */
  onResultSaved(dto: RecordResultDto): void {
    const game = this.recordingGame();
    if (!game) return;
    this.savingResult.set(true);
    this.campaignsService.recordResult(this.campaignId(), game.id, dto).subscribe({
      next: () => {
        this.recordingGame.set(null);
        this.savingResult.set(false);
        this.loadGames();
      },
      error: () => {
        this.savingResult.set(false);
      },
    });
  }

  /** Ferme le formulaire de résultat sans enregistrer. */
  onResultCancelled(): void {
    this.recordingGame.set(null);
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
