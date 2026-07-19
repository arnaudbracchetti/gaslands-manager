// Discriminant explicite de `GameEvent` — une valeur par sous-classe concrète, miroir
// exact de la colonne `game_events.eventType` (table STI plate, cf. GameEventOrm).
// Remplace le dispatch par duck-typing (`'propriété' in e`) de `CampaignRepository.eventToOrm`.
export enum GameEventType {
  RANKING_ASSIGNED = 'RANKING_ASSIGNED',
  WALLET_MOVEMENT = 'WALLET_MOVEMENT',
  VEHICLE_LOST = 'VEHICLE_LOST',
  WEAPON_LOST = 'WEAPON_LOST',
  IMPROVEMENT_LOST = 'IMPROVEMENT_LOST',
  ADVANTAGE_LOST = 'ADVANTAGE_LOST',
  WRECK_RESOLVED = 'WRECK_RESOLVED',
  EQUIPMENT_CHANGED = 'EQUIPMENT_CHANGED',
  RESISTANCE_CONTACTED = 'RESISTANCE_CONTACTED',
  GATES_CROSSED = 'GATES_CROSSED',
  VEHICLE_DESTROYED = 'VEHICLE_DESTROYED',
  FAVORI_DU_PUBLIC_BONUS = 'FAVORI_DU_PUBLIC_BONUS',
  VEHICLE_RENAMED = 'VEHICLE_RENAMED',
}
