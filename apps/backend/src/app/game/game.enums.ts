// Type d'une partie au Programme Télé d'une saison.
// EVENEMENT_TELE : partie majeure du calendrier — seule à rapporter des Points de
//                  Championnat (cf. mode campagne, design doc §3.3). Issue du livre p.162-170.
// ESCARMOUCHE    : partie libre sur les Terres Dévastées, sans Points de Championnat.
export enum GameType {
  EVENEMENT_TELE = 'EVENEMENT_TELE',
  ESCARMOUCHE = 'ESCARMOUCHE',
}

// Statut d'une partie dans le cycle de vie du Programme.
// PLANIFIE : inscrite au calendrier, encore modifiable/supprimable par l'organisateur.
// JOUE     : résultat enregistré — figée (non modifiable, non supprimable).
//            Non atteignable dans US-A1 (l'enregistrement de résultat viendra plus tard),
//            mais la garde "JOUE non modifiable" est posée dès maintenant.
export enum GameStatus {
  PLANIFIE = 'PLANIFIE',
  JOUE = 'JOUE',
}
