/**
 * Mapping concept → zone de découpe dans la planche d'icônes peintes (sprite
 * unique `/icons/icon-sheet.png`, 448×557px, 20 icônes sur une grille 5
 * lignes × 4 colonnes — chaque case de la planche contient l'icône ET son nom
 * imprimé en légende dessous).
 *
 * `ICON_GRID` reste la table lisible ligne/colonne (c'est elle qui documente
 * quel concept correspond à quelle icône peinte). Les rectangles de découpe
 * réels (`ICON_CROP_RECTS`, en pixels source) en sont dérivés en excluant la
 * bande de légende texte en bas de chaque case — mesurée une fois par ligne
 * (`ROW_ICON_BOUNDS`, alpha du PNG analysé pixel par pixel) puisque la hauteur
 * du dessin varie légèrement d'une ligne à l'autre (icônes peintes à la main).
 * Centralise ainsi la découpe pour que le composant `Icon` n'ait jamais à
 * manipuler de coordonnées "magiques".
 */
export type IconConcept =
  | 'supprimer'
  | 'modifier'
  | 'ajouter'
  | 'journal'
  | 'points_championnat'
  | 'organisateur'
  | 'favori_public'
  | 'drapeau'
  | 'vitesse'
  | 'carrosserie'
  | 'maniabilite'
  | 'prix'
  | 'avertissement'
  | 'verrouille'
  | 'copier'
  | 'valide'
  | 'argent'
  | 'chocs'
  | 'recherche'
  | 'atelier';

interface IconGridPosition {
  row: number;
  col: number;
}

export interface IconCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ICON_SHEET_IMAGE_WIDTH = 448;
export const ICON_SHEET_IMAGE_HEIGHT = 557;

const ICON_SHEET_COLUMNS = 4;
const COLUMN_WIDTH = ICON_SHEET_IMAGE_WIDTH / ICON_SHEET_COLUMNS; // 112px

/** Bande verticale (haut/bas, en pixels) occupée par le DESSIN de chaque ligne
 *  de la planche — légende texte exclue. Mesurée sur le PNG source. */
const ROW_ICON_BOUNDS: { top: number; bottom: number }[] = [
  { top: 13, bottom: 95 }, // Ligne 0
  { top: 117, bottom: 208 }, // Ligne 1
  { top: 235, bottom: 320 }, // Ligne 2
  { top: 348, bottom: 429 }, // Ligne 3
  { top: 457, bottom: 539 }, // Ligne 4
];

const ICON_GRID: Record<IconConcept, IconGridPosition> = {
  // Ligne 0
  supprimer: { row: 0, col: 0 }, // poubelle rouge
  modifier: { row: 0, col: 1 }, // crayon
  ajouter: { row: 0, col: 2 }, // croix
  journal: { row: 0, col: 3 }, // livre ouvert

  // Ligne 1
  points_championnat: { row: 1, col: 0 }, // coupe + étoile
  organisateur: { row: 1, col: 1 }, // badge presse-papier
  favori_public: { row: 1, col: 2 }, // cœur + étoile
  drapeau: { row: 1, col: 3 }, // damier

  // Ligne 2
  vitesse: { row: 2, col: 0 }, // flèche
  carrosserie: { row: 2, col: 1 }, // buggy
  maniabilite: { row: 2, col: 2 }, // volant
  prix: { row: 2, col: 3 }, // jerrican ("Jerycanne")

  // Ligne 3
  avertissement: { row: 3, col: 0 }, // triangle jaune
  verrouille: { row: 3, col: 1 }, // cadenas
  copier: { row: 3, col: 2 }, // feuilles
  valide: { row: 3, col: 3 }, // coche

  // Ligne 4
  //argent: { row: 4, col: 0 }, // pièces
  argent: { row: 2, col: 3 }, // jerrican ("Jerycanne")
  chocs: { row: 4, col: 1 }, // éclat / impact
  recherche: { row: 4, col: 2 }, // œil
  atelier: { row: 4, col: 3 }, // clé à molette
};

function cropRectFor(position: IconGridPosition): IconCropRect {
  const { top, bottom } = ROW_ICON_BOUNDS[position.row];
  return { x: position.col * COLUMN_WIDTH, y: top, width: COLUMN_WIDTH, height: bottom - top };
}

export const ICON_CROP_RECTS: Record<IconConcept, IconCropRect> = Object.fromEntries(
  (Object.entries(ICON_GRID) as [IconConcept, IconGridPosition][]).map(
    ([concept, position]): [IconConcept, IconCropRect] => [concept, cropRectFor(position)],
  ),
) as Record<IconConcept, IconCropRect>;
