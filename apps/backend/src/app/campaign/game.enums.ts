// Type d'une partie au Programme Télé d'une saison.
// EVENEMENT_TELE : partie majeure du calendrier — seule à rapporter des Points de
//                  Championnat (cf. mode campagne, design doc §3.3). Issue du livre p.162-170.
// ESCARMOUCHE    : partie libre sur les Terres Dévastées, sans Points de Championnat.
export enum GameType {
  EVENEMENT_TELE = 'EVENEMENT_TELE',
  ESCARMOUCHE = 'ESCARMOUCHE',
}

// Statut d'une partie dans son cycle de vie.
// PLANIFIE : inscrite au calendrier, encore modifiable/supprimable par l'organisateur.
// ATELIER  : résultat enregistré — phase garage post-partie (achats/reventes/séquelles
//            de cette partie précise). Accepte EquipmentChanged/SequellaAdded.
// JOUE     : atelier clôturé — figée (non modifiable, non supprimable, plus d'événement).
export enum GameStatus {
  PLANIFIE = 'PLANIFIE',
  ATELIER = 'ATELIER',
  JOUE = 'JOUE',
}
