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
  /**
   * Améliorations intégrées au profil de base du véhicule (coût zéro, non supprimables).
   * Liste de `nom_interne` d'améliorations du catalogue.
   * Optionnel : absent ou vide pour la majorité des véhicules.
   */
  ameliorations_defaut?: string[];
  /**
   * Arme intégrée au profil de base du véhicule, montée sur Tourelle, coût zéro et non
   * retirable (`nom_interne` d'une arme du catalogue). Cas unique aujourd'hui : le Char
   * d'assaut et son Canon de 125mm — entorse actée à la règle générale (la Tourelle
   * gratuite d'un Char d'assaut est toujours ce canon précis, jamais réassignable).
   */
  arme_defaut?: string;
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
  /**
   * Cette arme peut-elle être montée sur Tourelle (arc de tir à 360°, coût ×3) ?
   * Attribut explicite par arme plutôt que dérivé du `type` — seules les armes de tir
   * (base/avancée) le sont en pratique, jamais les armes d'équipage ni largables, mais
   * la donnée reste posée arme par arme pour laisser la main au catalogue en cas
   * d'exception. Absent ⇒ `false`.
   */
  montable_tourelle?: boolean;
  /**
   * Cette arme nécessite-t-elle une orientation à l'achat ? Attribut explicite par
   * arme plutôt que dérivé du `type` — les armes d'équipage n'en ont jamais besoin,
   * mais certaines armes de tir à arc 360° (Boule de démolition, Marteleur…) non plus,
   * d'où un champ posé arme par arme plutôt qu'une règle générique sur `type`.
   */
  necessite_orientation: boolean;
}

/** Amélioration de véhicule telle que définie dans amelioration.yml */
export interface Amelioration {
  nom: string;
  /** Identifiant technique stable (snake_case, sans accents).
   *  Format variante sponsor : "<amelioration>_<sponsor>" (ex: "nitro_idris", "belier_slime").
   *  Items exclusifs d'un sponsor : nom descriptif simple (ex: "megaphone", "micro_blindage"). */
  nom_interne: string;
  /** Coût en Jerricans. */
  prix: number;
  /** Nombre d'emplacements occupés */
  emplacement: number;
  description: string;
  /** Règles spéciales de l'amélioration (bloc YAML |) */
  regles: string;
  /** Noms des sponsors autorisés à sélectionner cette amélioration */
  sponsors_autorises: string[];
  /**
   * Clé du décorateur métier à instancier pour cette amélioration (Pattern Decorator,
   * voir vehicle/improvement-decorator.factory.ts). Plusieurs entrées peuvent partager
   * la même valeur — c'est le cas des variantes sponsor qui n'altèrent que prix/emplacement
   * (ex: "Bélier" et "Bélier (Slime)" partagent `comportement: "belier"` : même règle de
   * pose, seul le coût change). Absente ⇒ amélioration neutre (aucun effet sur les stats,
   * aucune règle de pose particulière — juste un emplacement consommé et une ligne dans le
   * récapitulatif).
   */
  comportement?: string;
  /**
   * Cette amélioration nécessite-t-elle une orientation à l'achat ? Aujourd'hui
   * uniquement le Bélier et ses variantes (`comportement: "belier"`) et le Bélier
   * Explosif — posé comme champ catalogue explicite plutôt que codé en dur dans le
   * décorateur, pour que la donnée seule pilote la règle de pose et l'affichage
   * du sélecteur de direction côté frontend.
   */
  necessite_orientation: boolean;
}

/** Avantage de véhicule tel que défini dans avantage.yml */
export interface Avantage {
  nom: string;
  /** Identifiant technique stable (snake_case, sans accents), ex: "expertise", "cascadeur". */
  nom_interne: string;
  /**
   * Catégorie de style (une des 12 étiquettes déjà utilisées dans `RawSponsor.classes_avantage`
   * : Agression, Audace, Dur à Cuire, Horreur, Mécanique, Militaire, Optimisation,
   * Poursuite, Précision, Rapidité, Technologie, Trompe-la-Mort). L'éligibilité sponsor↔avantage
   * est DÉRIVÉE de ce champ (`categorie ∈ sponsor.classes_avantage`) — pas de
   * `sponsors_autorises` déclaré item par item, contrairement aux armes/améliorations.
   */
  categorie: string;
  /** Coût en Jerricans. */
  prix: number;
  description: string;
  /** Règles spéciales de l'avantage (bloc YAML |) */
  regles: string;
  /**
   * Clé du décorateur métier à instancier (Pattern Decorator, voir
   * team/domain/advantage-decorator.factory.ts). Présente uniquement pour les 3 avantages
   * à effet mécanique réel ("expertise", "cascadeur", "sur_deux_roues") ; absente ⇒
   * avantage neutre (purement descriptif, aucun effet sur les stats ni règle de pose).
   */
  comportement?: string;
  // Pas de `emplacement` (toujours 0, aucun avantage n'occupe de slot) ni
  // `necessite_orientation` (jamais requise) — contrairement à Amelioration/Arme.
}

/**
 * Séquelle de véhicule telle que définie dans sequelle.yml (mode campagne — atelier).
 * Contrairement aux 3 autres catalogues d'équipement, une séquelle n'est pas liée à un
 * sponsor (aucun champ `sponsors_autorises`, aucune `categorie` — applicable à tout
 * véhicule, quel que soit le sponsor de l'équipe).
 */
export interface Sequelle {
  nom: string;
  /** Identifiant technique stable (snake_case, sans accents), ex: "suicidaire", "dur_a_cuire". */
  nom_interne: string;
  /** Phrase d'ambiance courte, affichée sur la carte catalogue. */
  description: string;
  /** Effet mécanique précis (Markdown) — affiché uniquement dans la modale de détail. */
  regles: string;
  /** Coût en Chocs (monnaie du véhicule, distincte des Jerricans de l'équipe). */
  chocs_cost: number;
  /**
   * Distingue un achat volontaire en atelier (`ATELIER`) d'une imposition automatique
   * par un tirage de la Table des Épaves (`TABLE_EPAVES`, coût toujours 0) — une
   * séquelle `TABLE_EPAVES` ne peut jamais être achetée directement en atelier.
   */
  origine: 'ATELIER' | 'TABLE_EPAVES';
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
  /** Avantages dont la catégorie figure dans `classes_avantage` de ce sponsor. */
  avantages: Avantage[];
}
