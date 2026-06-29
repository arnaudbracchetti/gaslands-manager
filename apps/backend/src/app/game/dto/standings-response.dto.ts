import type { StandingsEntry } from '../domain/season';

/** Miroir de StandingsEntry — `resistancePoints` exclu délibérément (D-S4). */
export type StandingsResponseDto = StandingsEntry;
