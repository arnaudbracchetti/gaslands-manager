/**
 * Formes de données partagées entre les deux points d'entrée de la fiche
 * d'équipe exportable (page Équipe — lecture directe — et page Campagne —
 * lecture après replay) et son renderer HTML. Purement des types, aucune
 * dépendance NestJS/TypeORM/catalogue : produites par `vehicleToSheetDto`/
 * `teamToSheetDto` (team-sheet.mapper.ts), consommées par
 * `renderTeamSheetHtml` (team-sheet.renderer.ts).
 */

export type EquipmentCategory = 'arme' | 'amelioration' | 'avantage' | 'sequelle';

export interface EquipmentRowDto {
  /** Catégorie — pilote le badge de la colonne "Type" et le format de "Facing". */
  category: EquipmentCategory;
  /**
   * Référence catalogue de cet équipement. Combinée à `category` pour la
   * déduplication de l'annexe de règles — `nomInterne` seul n'est unique que
   * PAR fichier catalogue, pas entre les 4.
   */
  nomInterne: string;
  /** Nom affiché — toujours résolu depuis le catalogue, jamais du texte utilisateur. */
  nom: string;
  /**
   * Colonne "Facing", déjà formatée par le mapper (qui seul sait distinguer une
   * arme d'équipage — orientation `null` par construction du domaine — d'une
   * amélioration/avantage/séquelle, qui n'ont jamais cette notion) :
   * "Avant"/"Arrière"/"Latéral"/"Tourelle" (arme ou amélioration orientée),
   * "Équipage" (arme d'équipage), "360°" (arme à arc automatique non-équipage,
   * ex. Boule de démolition), "—" (amélioration/avantage/séquelle non orientée).
   */
  facing: string;
  /** `effet_court` catalogue — `null` si pas encore renseigné (repli sur le renvoi seul). */
  shortLabel: string | null;
  /** `munitions` catalogue (armes et améliorations, ex. Bélier Explosif/Nitro) — `null` sinon (ni cases ni décompte). */
  munitions: number | null;
  /** Règle complète déjà rendue en HTML (`marked`, catalogue) — jamais à échapper. */
  ruleHtml: string;
}

export interface VehicleSheetDto {
  id: number;
  /** `Vehicle.nom` — déjà formaté "Nom (Type)" si personnalisé ; PEUT contenir du texte utilisateur (renommage) → à échapper au rendu. */
  nom: string;
  /** `vehicle.type.nom` — catalogue, fiable, jamais à échapper. */
  typeNom: string;
  poids: 'Léger' | 'Moyen' | 'Lourd';
  /** `vehicle.cost` — prix résiduel déjà pris en compte si le véhicule est vendu. */
  cost: number;
  /** `vehicle.chocs` — structurellement 0 hors contexte campagne. */
  chocs: number;
  /** `vehicle.effectiveStats.carrosserie` — pilote le nombre de cases à cocher. */
  carrosserie: number;
  manoeuvrabilite: number;
  /** `vehicle.effectiveStats.vitesse_max` — imprimé dans le carré à dé ("Max Gear"). */
  gearMax: number;
  equipage: number;
  emplacementsUtilises: number;
  emplacementsTotal: number;
  /** Armes + améliorations + avantages + séquelles actifs (vendus/perdus déjà exclus). */
  equipment: EquipmentRowDto[];
}

export interface TeamSheetDto {
  /** `Team.name` — texte utilisateur → à échapper au rendu. */
  teamName: string;
  /** Valeur fixe du catalogue, jamais à échapper. */
  sponsor: string;
  /** Prénom + nom du joueur connecté — texte utilisateur → à échapper au rendu. */
  playerName: string;
  /** Points de sabotage disponibles (`CampaignParticipant.sabotagePoints`) — `null` hors contexte campagne (construction d'équipe). */
  sabotagePoints: number | null;
  /** Votes du Public gagnés en début de partie (`CampaignParticipant.votesPublicFor`) — `null` hors contexte campagne ; remplace alors le coût total dans le bandeau d'en-tête. */
  votesPublic: number | null;
  vehicles: VehicleSheetDto[];
}
