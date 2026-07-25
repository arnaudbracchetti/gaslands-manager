/**
 * Ligne de l'historique complet d'un participant, toutes parties confondues —
 * un seul participant par réponse (pas de userName/teamName, contrairement à
 * GameJournalEntryDto qui mixe plusieurs participants d'une même partie).
 */
export interface ParticipantJournalEntryDto {
  eventId: number;
  gameId: number;
  /** Position de la partie dans le Programme — mirroir de GameOrm.order. */
  gameOrder: number;
  /** Libellé du scénario résolu (ScenarioCatalogService). */
  scenarioName: string;
  description: string;
  createdAt: Date;
}
