/**
 * Interfaces TypeScript pour le catalogue de jeu Gaslands (frontend).
 *
 * Miroir fidèle de `apps/backend/src/app/catalog/catalog.interfaces.ts` — la
 * réponse JSON de `GET /api/catalog/sponsors/:nom` (et des routes `/vehicules`,
 * `/armes`, `/ameliorations`) a EXACTEMENT cette forme. Garder les deux fichiers
 * alignés est une discipline manuelle (pas de partage de code entre back et front,
 * cf. ARCHITECTURE.md §1) — mais un bénéfice immédiat : un typage explicite et
 * fiable pour tout composant qui consomme le catalogue complet d'un sponsor
 * (ex: `VehicleBuilder`, qui en a besoin pour les DEUX étapes de configuration).
 *
 * Ne duplique PAS `SponsorInfo` (`teams/team.model.ts`) : cette dernière est une
 * vue ALLÉGÉE du sponsor (sans relations résolues), suffisante pour le carousel
 * de sélection. `Sponsor` ci-dessous est la vue COMPLÈTE — `vehicules`/`armes`/
 * `ameliorations` pré-filtrés — exactement ce dont `VehicleBuilder` a besoin pour
 * peupler ses deux étapes (choix du véhicule, puis de son équipement) sans le
 * moindre filtrage côté client : le backend a déjà fait ce travail au démarrage
 * (cf. ARCHITECTURE.md §3.3, `CatalogService` — Map en mémoire, relations pré-résolues).
 */

/** Véhicule du catalogue — miroir de `Vehicule` (backend `catalog.interfaces.ts`). */
export interface Vehicule {
  nom: string;
  /** Identifiant technique stable (snake_case, sans accents) — clé de référence
   *  pour `Vehicle.nomInterne` (cf. `vehicle-builder.model.ts`). */
  nom_interne: string;
  poids: 'Léger' | 'Moyen' | 'Lourd';
  carrosserie: number;
  manoeuvrabilite: number;
  vitesse_max: number;
  equipage: number;
  /** Nombre d'emplacements pour les armes ET les améliorations — un pool partagé
   *  (cf. SPECIFICATION.md §7 ; le décompte précis se fait côté `VehicleBuilder`). */
  emplacements: number;
  prix: number;
  description: string;
  regles: string;
  sponsors_autorises: string[];
}

/** Arme du catalogue — miroir de `Arme` (backend `catalog.interfaces.ts`). */
export interface Arme {
  nom: string;
  nom_interne: string;
  /** Catégorie — pilote l'affichage du sélecteur d'orientation : les armes
   *  d'`équipage` n'en ont pas (360° automatique, cf. SPECIFICATION.md §5/§7). */
  type: 'base' | 'avancée' | 'équipage' | 'largable';
  /** Coût en Jerricans — toujours un nombre pour les armes (jamais "x3" comme
   *  pour la Tourelle côté améliorations, cf. doc de `Amelioration.prix` ci-dessous). */
  prix: number;
  emplacement: number;
  description: string;
  regles: string;
  sponsors_autorises: string[];
}

/** Amélioration du catalogue — miroir de `Amelioration` (backend `catalog.interfaces.ts`). */
export interface Amelioration {
  nom: string;
  nom_interne: string;
  /** `number | string` : la Tourelle vaut `"x3"` (3× le prix de l'arme associée,
   *  cf. SPECIFICATION.md §4.2/§7 — gestion du budget hors périmètre de ce module). */
  prix: number | string;
  emplacement: number;
  description: string;
  regles: string;
  sponsors_autorises: string[];
  /** Clé du décorateur métier (Pattern Decorator backend) — purement informative
   *  côté frontend : aucun composant n'a besoin d'instancier de décorateur ici. */
  comportement?: string;
}

/**
 * Sponsor avec ses relations résolues — miroir de `Sponsor` (backend, vue
 * "enrichie" exposée par `GET /api/catalog/sponsors/:nom`). Voir la note d'en-tête
 * de ce fichier pour la distinction avec `SponsorInfo` (vue allégée du carousel).
 */
export interface Sponsor {
  nom: string;
  description: string;
  classes_avantage: string[];
  avantages_sponsorises: string;
  /** Véhicules que ce sponsor est autorisé à utiliser — alimente l'étape 1 du builder. */
  vehicules: Vehicule[];
  /** Armes que ce sponsor est autorisé à équiper — alimente l'étape 2 du builder. */
  armes: Arme[];
  /** Améliorations que ce sponsor est autorisé à sélectionner — alimente l'étape 2 du builder. */
  ameliorations: Amelioration[];
}
