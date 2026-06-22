/**
 * Composant GameForm — formulaire d'ajout / d'édition d'une partie au Programme.
 *
 * Composant "dumb" (cf. season-form.ts) : valide localement puis émet un DTO au
 * parent qui appelle l'API. Le `game` en entrée détermine le mode :
 *   - null  → création (émet un CreateGameDto)
 *   - défini → édition (émet un UpdateGameDto, pré-rempli via effect())
 *
 * Le type de la partie est déduit du scénario choisi (chaque scénario porte son
 * type par défaut) ; on n'expose pas de sélecteur de type séparé dans US-A1.
 */
import {
  Component,
  InputSignal,
  OutputEmitterRef,
  WritableSignal,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Game, Scenario, CreateGameDto } from '../game.model';

@Component({
  selector: 'app-game-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './game-form.html',
  styleUrl: './game-form.scss',
})
export class GameForm {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Scénarios disponibles (catalogue) pour le sélecteur. */
  scenarios: InputSignal<Scenario[]> = input<Scenario[]>([]);

  /** Vrai pendant que le parent attend la réponse de l'API. */
  saving: InputSignal<boolean> = input(false);

  /** Partie à éditer (null = mode création). */
  game: InputSignal<Game | null> = input<Game | null>(null);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Émis avec le DTO validé (création ou édition — même forme : { scenarioId }). */
  saved: OutputEmitterRef<CreateGameDto> = output<CreateGameDto>();
  formCancel: OutputEmitterRef<void> = output<void>();

  // ── État interne du formulaire ───────────────────────────────────────────────

  formScenarioId: WritableSignal<string> = signal('');
  formError: WritableSignal<string> = signal('');

  constructor() {
    // Pré-remplissage en mode édition : réagit aux changements de `game`.
    effect((): void => {
      const game = this.game();
      this.formScenarioId.set(game?.scenarioId ?? '');
    });
  }

  /** Vrai en mode édition (pour adapter les libellés du template). */
  isEdit(): boolean {
    return this.game() !== null;
  }

  /** Valide la sélection et émet le DTO. */
  saveForm(): void {
    const scenarioId = this.formScenarioId();

    if (!scenarioId) {
      this.formError.set('Veuillez choisir un scénario.');
      return;
    }

    this.formError.set('');
    this.saved.emit({ scenarioId });
  }

  cancelForm(): void {
    this.formCancel.emit();
  }
}
