// États possibles d'une saison — cycle de vie séquentiel, pas de retour en arrière.
// EN_CONSTRUCTION : invitations/inscriptions ouvertes, parties modifiables librement.
// EN_COURS        : participants verrouillés, parties toujours modifiables.
// TERMINEE        : saison archivée en lecture seule.
export enum SeasonState {
  EN_CONSTRUCTION = 'EN_CONSTRUCTION',
  EN_COURS = 'EN_COURS',
  TERMINEE = 'TERMINEE',
}

// Statut d'inscription d'un SeasonParticipant à une saison.
export enum ParticipantStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
}
