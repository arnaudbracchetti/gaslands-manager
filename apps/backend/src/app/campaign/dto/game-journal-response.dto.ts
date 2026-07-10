import type { GameJournalEntry } from '../domain/games/game-commands';

/** Ligne du journal enrichie pour l'affichage — nom/équipe résolus, horodatage joint depuis l'ORM. */
export type GameJournalEntryDto = GameJournalEntry & {
  userName: string;
  teamName: string;
  createdAt: Date;
};
