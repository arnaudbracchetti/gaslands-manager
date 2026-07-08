/**
 * Opération d'un mouvement d'équipement en atelier campagne (event-sourcing).
 * Valeurs stockées telles quelles dans `game_events.operation` (pas de migration).
 */
export enum EquipmentOperation {
  BUY = 'BUY',
  SELL = 'SELL',
}

/**
 * Type d'entité concernée par un mouvement d'équipement en atelier.
 * Valeurs stockées telles quelles dans `game_events.entity_type`.
 */
export enum EquipmentEntityType {
  VEHICLE = 'VEHICLE',
  WEAPON = 'WEAPON',
  IMPROVEMENT = 'IMPROVEMENT',
}
