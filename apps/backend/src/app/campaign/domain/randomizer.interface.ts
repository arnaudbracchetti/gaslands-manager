export interface IRandomizer {
  /** Retourne un entier ∈ [1, sides]. */
  roll(sides: number): number;
  /** Retourne un élément aléatoire d'une liste non vide. */
  pick<T>(pool: T[]): T;
}
