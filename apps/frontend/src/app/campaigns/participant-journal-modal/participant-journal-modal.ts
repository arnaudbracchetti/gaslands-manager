/**
 * ParticipantJournalModal — historique complet d'un participant, toutes
 * parties de la campagne confondues.
 *
 * Composant **dumb** : reçoit la liste plate des événements
 * (`ParticipantJournalEntryDto`) et les regroupe par partie, dans l'ordre
 * chronologique du Programme (le backend renvoie déjà les parties triées par
 * `order` ASC, donc l'ordre d'insertion de la Map suffit). Visible par tout
 * participant VALIDATED de la campagne, même pour consulter l'historique d'un
 * tiers — accessible depuis le bouton/menu "Voir l'historique" de ParticipantList.
 */
import { Component, InputSignal, OutputEmitterRef, Signal, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { CampaignParticipant } from '../campaign-participant.model';
import type { ParticipantJournalEntryDto } from '../game.model';
import { Icon } from '../../shared/icon/icon';

/** Événements d'une partie, regroupés et gardés dans l'ordre du Programme. */
export interface ParticipantJournalGroup {
  gameId: number;
  gameOrder: number;
  scenarioName: string;
  entries: ParticipantJournalEntryDto[];
}

@Component({
  selector: 'app-participant-journal-modal',
  standalone: true,
  imports: [DatePipe, Icon],
  templateUrl: './participant-journal-modal.html',
  styleUrl: './participant-journal-modal.scss',
})
export class ParticipantJournalModal {
  participant: InputSignal<CampaignParticipant> = input.required<CampaignParticipant>();
  entries: InputSignal<ParticipantJournalEntryDto[]> = input<ParticipantJournalEntryDto[]>([]);
  loading: InputSignal<boolean> = input(false);

  closed: OutputEmitterRef<void> = output<void>();

  /**
   * Regroupe les entrées par partie, en préservant l'ordre d'apparition — le
   * backend renvoie déjà les entrées triées par ordre de partie
   * (`campaign.games`) puis par ordre chronologique des événements dans
   * chaque partie, donc l'ordre d'insertion de la Map reproduit exactement
   * le Programme.
   */
  groupedEntries: Signal<ParticipantJournalGroup[]> = computed(() => {
    const groups = new Map<number, ParticipantJournalGroup>();
    for (const entry of this.entries()) {
      let group = groups.get(entry.gameId);
      if (!group) {
        group = { gameId: entry.gameId, gameOrder: entry.gameOrder, scenarioName: entry.scenarioName, entries: [] };
        groups.set(entry.gameId, group);
      }
      group.entries.push(entry);
    }
    return Array.from(groups.values());
  });
}
