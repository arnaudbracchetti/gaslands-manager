/**
 * Composant SeasonProgram — gère le Programme Télé d'une saison (US-A1).
 *
 * Composant "smart" : charge les parties et le catalogue de scénarios, gère
 * l'ajout, l'édition et la suppression via SeasonsService. Intégré dans
 * SeasonDetail et affiché uniquement quand la saison est EN_COURS.
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
import { SeasonsService } from '../seasons.service';
import { SeasonState } from '../season.model';
import { Game, Scenario, CreateGameDto } from '../game.model';
import { GameList } from '../game-list/game-list';
import { GameForm } from '../game-form/game-form';
import { ConfirmModal } from '../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-season-program',
  standalone: true,
  imports: [GameList, GameForm, ConfirmModal],
  templateUrl: './season-program.html',
  styleUrl: './season-program.scss',
})
export class SeasonProgram implements OnInit {
  private seasonsService: SeasonsService = inject(SeasonsService);

  // ── Inputs ──────────────────────────────────────────────────────────────────

  seasonId: InputSignal<number> = input.required<number>();

  /** Vrai si l'utilisateur est organisateur (peut gérer le programme). */
  isOrganizer: InputSignal<boolean> = input(false);

  /** État courant de la saison — la gestion est interdite en TERMINEE. */
  seasonState: InputSignal<SeasonState> = input.required<SeasonState>();

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

  /**
   * La section Programme est affichée dans tous les états (lecture seule en
   * TERMINEE). La gestion (ajout/édition/suppression) n'est possible que pour
   * l'organisateur et tant que la saison n'est pas terminée.
   */
  canManage: Signal<boolean> = computed(
    () => this.isOrganizer() && this.seasonState() !== 'TERMINEE',
  );

  ngOnInit(): void {
    this.loadGames();
    // Catalogue chargé d'emblée pour que le formulaire soit prêt à l'ouverture.
    this.seasonsService.getScenarios().subscribe({
      next: (scenarios: Scenario[]) => this.scenarios.set(scenarios),
    });
  }

  private loadGames(): void {
    this.loading.set(true);
    this.seasonsService.getGames(this.seasonId()).subscribe({
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
      ? this.seasonsService.updateGame(this.seasonId(), editing.id, dto)
      : this.seasonsService.createGame(this.seasonId(), dto);

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

  onDelete(game: Game): void {
    this.pendingDeleteGame.set(game);
  }

  onConfirmDelete(): void {
    const game = this.pendingDeleteGame();
    this.pendingDeleteGame.set(null);
    if (!game) return;

    this.seasonsService.deleteGame(this.seasonId(), game.id).subscribe({
      next: () => this.loadGames(),
      error: () => this.error.set('Erreur lors de la suppression de la partie.'),
    });
  }
}
