import type { StandingsEntry } from '../domain/campaign';

/** Miroir de StandingsEntry — `resistancePoints` exclu délibérément (D-S4). */
export type StandingsResponseDto = StandingsEntry;
