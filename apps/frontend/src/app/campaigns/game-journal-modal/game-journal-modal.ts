/**
 * GameJournalModal — journal complet d'une partie (ATELIER ou JOUE).
 *
 * Composant **dumb** : reçoit la liste plate des événements (`GameJournalEntryDto`)
 * et les regroupe par participant, dans l'ordre d'apparition (le participant dont
 * le premier événement chronologique vient en premier). Visible par tout
 * participant VALIDATED de la campagne, même absent de la partie — accessible
 * depuis le bouton "📜 Journal" de GameList.
 */
import { Component, InputSignal, OutputEmitterRef, Signal, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { Game, GameJournalEntryDto } from '../game.model';

/** Événements d'un participant, regroupés et gardés dans l'ordre chronologique. */
export interface JournalGroup {
  participantId: number;
  userName: string;
  teamName: string;
  entries: GameJournalEntryDto[];
}

@Component({
  selector: 'app-game-journal-modal',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './game-journal-modal.html',
  styleUrl: './game-journal-modal.scss',
})
export class GameJournalModal {
  game: InputSignal<Game> = input.required<Game>();
  entries: InputSignal<GameJournalEntryDto[]> = input<GameJournalEntryDto[]>([]);
  loading: InputSignal<boolean> = input(false);

  closed: OutputEmitterRef<void> = output<void>();

  /**
   * Regroupe les entrées par participant, en préservant l'ordre d'apparition
   * (le premier événement chronologique d'un participant détermine la position
   * de son groupe) — une `Map` JS préserve l'ordre d'insertion des clés.
   */
  groupedEntries: Signal<JournalGroup[]> = computed(() => {
    const groups = new Map<number, JournalGroup>();
    for (const entry of this.entries()) {
      let group = groups.get(entry.participantId);
      if (!group) {
        group = { participantId: entry.participantId, userName: entry.userName, teamName: entry.teamName, entries: [] };
        groups.set(entry.participantId, group);
      }
      group.entries.push(entry);
    }
    return Array.from(groups.values());
  });

  /** Libellé lisible du statut de la partie, pour le titre de la modale. */
  statusLabel(): string {
    switch (this.game().status) {
      case 'JOUE': return 'Jouée';
      case 'ATELIER': return 'Atelier';
      case 'PLANIFIE': return 'Planifiée';
    }
  }
}
