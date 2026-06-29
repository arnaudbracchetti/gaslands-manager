// Type d'une partie au Programme Télé d'une saison.
// EVENEMENT_TELE : partie majeure du calendrier — seule à rapporter des Points de
//                  Championnat (cf. mode campagne, design doc §3.3). Issue du livre p.162-170.
// ESCARMOUCHE    : partie libre sur les Terres Dévastées, sans Points de Championnat.
export enum GameType {
  EVENEMENT_TELE = 'EVENEMENT_TELE',
  ESCARMOUCHE = 'ESCARMOUCHE',
  ATELIER = 'ATELIER',       // Période entre deux parties — achats/reventes en campagne
}

// Statut d'une partie dans le cycle de vie du Programme.
// PLANIFIE : inscrite au calendrier, encore modifiable/supprimable par l'organisateur.
// JOUE     : résultat enregistré — figée (non modifiable, non supprimable).
// OUVERT   : AtelierGame actif — accepte les événements d'équipement.
// CLOTURE  : AtelierGame fermé (après la partie suivante ou en fin de saison).
export enum GameStatus {
  PLANIFIE = 'PLANIFIE',
  JOUE = 'JOUE',
  OUVERT = 'OUVERT',
  CLOTURE = 'CLOTURE',
}
