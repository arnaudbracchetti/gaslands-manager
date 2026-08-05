import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

/**
 * DTO pour le réordonnancement du Programme Télé (US-A4).
 *
 * `gameIds` doit être exactement l'ensemble des parties encore PLANIFIE de la
 * campagne, dans le nouvel ordre voulu — `class-validator` ne vérifie que la
 * forme (tableau d'entiers positifs, borné en taille) ; cette règle métier
 * elle-même reste validée côté agrégat (`Campaign.reorderGames`), pas ici
 * (cf. CreateGameDto).
 */
export class ReorderGamesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(1, { each: true })
  gameIds!: number[];
}
