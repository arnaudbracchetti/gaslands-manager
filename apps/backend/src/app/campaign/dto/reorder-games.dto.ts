/**
 * DTO pour le réordonnancement du Programme Télé (US-A4).
 *
 * `gameIds` doit être exactement l'ensemble des parties encore PLANIFIE de la
 * campagne, dans le nouvel ordre voulu — validé côté agrégat
 * (`Campaign.reorderGames`), pas ici (cf. CreateGameDto).
 */
export class ReorderGamesDto {
  gameIds: number[];
}
