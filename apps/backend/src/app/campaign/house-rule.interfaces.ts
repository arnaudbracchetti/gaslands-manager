/**
 * Interfaces TypeScript pour le catalogue de règles maison (mode campagne).
 *
 * Miroir fidèle de la structure YAML définie dans
 * database_init/data/regles-maison.yml - même rôle que scenario.interfaces.ts
 * pour le catalogue de scénarios : type partagé entre le service de chargement
 * (HouseRuleCatalogService) et les réponses HTTP.
 */

/** Règle maison telle que définie dans regles-maison.yml. */
export interface HouseRuleDefinition {
  /** Libellé affiché dans l'UI */
  nom: string;
  /** Identifiant technique stable (snake_case, sans accents) - clé du catalogue. */
  nom_interne: string;
  /** Texte affiché sous la case à cocher quand elle est décochée - rappel du
   *  comportement par défaut. Converti de Markdown en HTML au chargement. */
  description_decochee: string;
  /** Texte affiché sous la case à cocher quand elle est cochée - comportement
   *  alternatif appliqué par la règle. Converti de Markdown en HTML au chargement. */
  description_cochee: string;
}
