/**
 * Interfaces TypeScript pour le catalogue de jeu Gaslands.
 *
 * Ces types sont le miroir fidèle des structures YAML définies dans database_init/data/.
 * Ils sont partagés entre le service (chargement) et le contrôleur (réponses HTTP).
 */

// ── Types bruts : miroir des structures YAML ─────────────────────────────────

/**
 * Sponsor brut tel que défini dans sponsors.yml.
 * Les relations (véhicules, armes, améliorations) ne sont pas encore résolues.
 */
export interface RawSponsor {
  nom: string;
  description: string;
  /** Les 2-3 classes d'avantage du sponsor (ex: "Militaire", "Précision") */
  classes_avantage: string[];
  /** Description textuelle des avantages spéciaux du sponsor (bloc YAML |) */
  avantages_sponsorises: string;
}

/** Véhicule tel que défini dans vehicules.yml */
export interface Vehicule {
  nom: string;
  /** Identifiant technique stable (snake_case, sans accents).
   *  Format variante : "<vehicule>_<modificateur>" (ex: "voiture_prison").
   *  Permet de distinguer les variantes sponsor du véhicule de base. */
  nom_interne: string;
  poids: 'Léger' | 'Moyen' | 'Lourd';
  /** Points de carrosserie (résistance aux dégâts) */
  carrosserie: number;
  manoeuvrabilite: number;
  vitesse_max: number;
  equipage: number;
  /** Nombre d'emplacements pour les armes et améliorations */
  emplacements: number;
  /** Coût en Jerricans */
  prix: number;
  description: string;
  /** Règles spéciales du véhicule (bloc YAML |) */
  regles: string;
  /** Noms des sponsors autorisés à sélectionner ce véhicule */
  sponsors_autorises: string[];
}

/** Arme telle que définie dans armes.yml */
export interface Arme {
  nom: string;
  /** Identifiant technique stable (snake_case, sans accents).
   *  Ex: "mitrailleuse", "canon_arc_electrique", "lance_flammes". */
  nom_interne: string;
  /** Catégorie d'arme : montée sur chassis, équipage, ou largable */
  type: 'base' | 'avancée' | 'équipage' | 'largable';
  /** Coût en Jerricans */
  prix: number;
  /** Nombre d'emplacements occupés (0 = gratuit / arme d'équipage) */
  emplacement: number;
  description: string;
  /** Règles spéciales de l'arme (bloc YAML |) */
  regles: string;
  /** Noms des sponsors autorisés à équiper cette arme */
  sponsors_autorises: string[];
}

/** Amélioration de véhicule telle que définie dans amelioration.yml */
export interface Amelioration {
  nom: string;
  /** Identifiant technique stable (snake_case, sans accents).
   *  Format variante sponsor : "<amelioration>_<sponsor>" (ex: "nitro_idris", "belier_slime").
   *  Items exclusifs d'un sponsor : nom descriptif simple (ex: "megaphone", "micro_blindage"). */
  nom_interne: string;
  /**
   * Coût en Jerricans.
   * Cas particulier : la Tourelle utilise "x3" (multiplicateur du coût de l'arme),
   * pas un coût fixe — d'où le type `number | string`.
   */
  prix: number | string;
  /** Nombre d'emplacements occupés */
  emplacement: number;
  description: string;
  /** Règles spéciales de l'amélioration (bloc YAML |) */
  regles: string;
  /** Noms des sponsors autorisés à sélectionner cette amélioration */
  sponsors_autorises: string[];
}

// ── Type enrichi : sponsor avec relations pré-résolues ───────────────────────

/**
 * Sponsor avec ses relations résolues au démarrage.
 *
 * Au lieu de filtrer les items à chaque requête, le CatalogService construit
 * ces objets une seule fois lors de l'initialisation. À partir d'un Sponsor,
 * on accède directement à tous les items qu'il autorise.
 */
export interface Sponsor extends RawSponsor {
  /** Véhicules que ce sponsor est autorisé à utiliser */
  vehicules: Vehicule[];
  /** Armes que ce sponsor est autorisé à équiper */
  armes: Arme[];
  /** Améliorations que ce sponsor est autorisé à sélectionner */
  ameliorations: Amelioration[];
}
