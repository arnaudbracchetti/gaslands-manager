/**
 * Échelle de tailles standard pour `<app-icon>` — centralise la correspondance
 * nom → pixels pour que changer la taille de toutes les icônes d'un même
 * contexte (badges, boutons, titres...) se fasse en un seul endroit, plutôt
 * que de chasser des valeurs numériques dispersées dans chaque template.
 */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export const ICON_SIZE_PX: Record<IconSize, number> = {
  xs: 25, // badges compacts (prix, emplacement, chocs en ligne)
  sm: 29, // texte de bouton/lien, lignes de liste
  md: 35, // boutons plus proéminents, stats de carte
  lg: 45, // titres de section, en-têtes de modale
  xl: 57, // titres de page
  xxl: 77, // icônes d'état vide / confirmation plein écran
};
