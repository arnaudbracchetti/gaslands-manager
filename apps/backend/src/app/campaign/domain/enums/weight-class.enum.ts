// Catégorie de poids d'un véhicule détruit — utilisée pour les PC d'exploit
// (Course à la Mort, p.167). Déduite du catalogue (VehicleType.poids) au moment
// de la sélection. FORTERESSE n'existe pas encore dans le catalogue (aucun
// véhicule n'y est classé), mais la valeur et son barème sont posés dès
// maintenant pour que le code n'ait rien à changer le jour où le catalogue
// gagnera des véhicules réellement classés Forteresse.
export enum WeightClass {
  LEGER = 'LEGER',
  MOYEN = 'MOYEN',
  LOURD = 'LOURD',
  FORTERESSE = 'FORTERESSE',
}

// PC attribués au destructeur selon le poids du véhicule ennemi détruit (p.167).
export const EXPLOIT_POINTS_BY_WEIGHT: Record<WeightClass, number> = {
  [WeightClass.LEGER]: 1,
  [WeightClass.MOYEN]: 2,
  [WeightClass.LOURD]: 3,
  [WeightClass.FORTERESSE]: 5,
};

/**
 * Traduit la valeur catalogue `VehicleType.poids` ('Léger'|'Moyen'|'Lourd', et
 * 'Forteresse' si le catalogue en gagne un jour) vers `WeightClass`.
 */
export function weightClassFromPoids(poids: string): WeightClass {
  switch (poids) {
    case 'Léger': return WeightClass.LEGER;
    case 'Moyen': return WeightClass.MOYEN;
    case 'Lourd': return WeightClass.LOURD;
    case 'Forteresse': return WeightClass.FORTERESSE;
    default:
      throw new Error(`Poids de véhicule inconnu : "${poids}"`);
  }
}
