/**
 * SequellaAdvantagePicker — modale de choix de l'avantage gratuit accordé par la
 * séquelle "Dur à Cuire" (p.170 : "choisissez gratuitement un avantage de catégorie
 * Dur à Cuire, même si ce pilote ne peut normalement pas y avoir accès").
 *
 * Composant **dumb** : reçoit la liste déjà filtrée (catégorie "Dur à Cuire", 6
 * avantages, TOUS sponsors confondus — cf. `SequellaManager`, qui charge le
 * catalogue complet via `CatalogService.getAllAvantages()` plutôt que le sous-
 * ensemble du sponsor). Émet le `nomInterne` choisi, ou `cancelled` — même pattern
 * que `ChangeTeamModal` (sélection locale, visibilité contrôlée par le parent via `@if`).
 */
import { Component, InputSignal, OutputEmitterRef, WritableSignal, input, output, signal } from '@angular/core';
import type { Avantage } from '../../../../catalog/catalog.model';

@Component({
  selector: 'app-sequella-advantage-picker',
  standalone: true,
  imports: [],
  templateUrl: './sequella-advantage-picker.html',
  styleUrl: './sequella-advantage-picker.scss',
})
export class SequellaAdvantagePicker {
  /** Les 6 avantages de catégorie "Dur à Cuire" — déjà filtrés par le parent. */
  advantages: InputSignal<Avantage[]> = input.required<Avantage[]>();

  /** Émis avec le `nom_interne` de l'avantage choisi. */
  confirmed: OutputEmitterRef<string> = output<string>();

  /** Émis quand l'utilisateur ferme sans choisir. */
  cancelled: OutputEmitterRef<void> = output<void>();

  /** Sélection locale — aucun choix par défaut : le backend exige un choix explicite. */
  selectedNomInterne: WritableSignal<string | null> = signal<string | null>(null);

  select(nomInterne: string): void {
    this.selectedNomInterne.set(nomInterne);
  }

  onConfirm(): void {
    const chosen = this.selectedNomInterne();
    if (!chosen) return;
    this.confirmed.emit(chosen);
  }
}
