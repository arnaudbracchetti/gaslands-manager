/**
 * Composant QuickTeamCreate — création rapide d'une équipe "pour l'occasion".
 *
 * Composant "dumb" (cf. ARCHITECTURE.md §2.5) : affiche un bouton qui révèle
 * un champ "nom" minimal, puis émet un CreateTeamDto vers le parent. Le
 * parent appelle TeamsService.create(), met à jour sa liste d'équipes et
 * sélectionne la nouvelle équipe — ce composant ne connaît pas TeamsService.
 *
 * Utilisé dans SeasonJoin (rejoindre une saison via code) et SeasonForm
 * (création d'une saison par l'organisateur) : dans les deux cas, l'équipe
 * créée n'a besoin que d'un nom pour être identifiable dans la liste des
 * équipes de l'utilisateur — sponsor et budget par défaut, modifiables
 * ensuite depuis /teams.
 */
import {
  Component,
  InputSignal,
  OutputEmitterRef,
  WritableSignal,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateTeamDto, DEFAULT_CANS, SPONSORS } from '../team.model';

@Component({
  selector: 'app-quick-team-create',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './quick-team-create.html',
  styleUrl: './quick-team-create.scss',
})
export class QuickTeamCreate {
  /** Vrai pendant que le parent attend la réponse de l'API de création. */
  saving: InputSignal<boolean> = input(false);

  /** DTO minimal (nom + sponsor/budget par défaut), émis quand l'utilisateur valide. */
  created: OutputEmitterRef<CreateTeamDto> = output<CreateTeamDto>();

  /** Vrai quand le champ de saisie est affiché. */
  expanded: WritableSignal<boolean> = signal(false);

  /** Nom saisi pour la nouvelle équipe. */
  name: WritableSignal<string> = signal('');

  /** Message d'erreur de validation locale. */
  error: WritableSignal<string> = signal('');

  /** Révèle le champ de saisie. */
  expand(): void {
    this.expanded.set(true);
  }

  /** Annule la création — masque le champ et réinitialise la saisie. */
  cancel(): void {
    this.expanded.set(false);
    this.name.set('');
    this.error.set('');
  }

  /**
   * Valide le nom et émet le DTO de création (sponsor/budget par défaut).
   * Réinitialise immédiatement le champ — en cas d'erreur API, le parent
   * affiche son propre message (cf. SeasonJoin/SeasonForm).
   */
  confirm(): void {
    const name = this.name().trim();
    if (!name) {
      this.error.set('Le nom de l\'équipe est obligatoire.');
      return;
    }

    this.error.set('');
    this.expanded.set(false);
    this.name.set('');
    this.created.emit({ name, sponsor: SPONSORS[0], cans: DEFAULT_CANS });
  }
}
