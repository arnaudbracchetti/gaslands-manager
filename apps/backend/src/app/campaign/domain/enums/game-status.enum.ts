// Statuts d'une partie dans son cycle de vie.
// PLANIFIE : inscrite au calendrier, encore modifiable/supprimable.
// ATELIER  : résultat enregistré — phase garage post-partie (achats/reventes/séquelles).
// JOUE     : atelier clôturé — figée, non modifiable.
export enum GameStatus {
  PLANIFIE = 'PLANIFIE',
  ATELIER = 'ATELIER',
  JOUE = 'JOUE',
}
