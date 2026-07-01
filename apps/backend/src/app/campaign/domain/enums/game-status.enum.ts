// Statuts de toutes les parties du Programme (STI partagé).
// PLANIFIE / JOUE : parties normales (EvenementTele, Escarmouche).
// OUVERT / CLOTURE : ateliers intercalés entre deux parties (AtelierGame).
export enum GameStatus {
  PLANIFIE = 'PLANIFIE',
  JOUE = 'JOUE',
  OUVERT = 'OUVERT',
  CLOTURE = 'CLOTURE',
}
