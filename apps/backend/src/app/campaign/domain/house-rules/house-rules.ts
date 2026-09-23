/**
 * Réglage des règles maison d'une campagne — ensemble des clés (`nom_interne` du
 * catalogue `regles-maison.yml`) actuellement activées. Value Object immuable :
 * ne contient QUE les clés activées, pas une map complète nom→booléen — une règle
 * absente équivaut au comportement par défaut, donc une règle ajoutée après coup au
 * catalogue est automatiquement "décochée" partout, sans reprise de données.
 *
 * Version minimale (anticipée avant RM-3, cf.
 * docs/plans/2026-09-21-regles-maison-mecanisme-design.md §2) : seules `none()` et
 * `fromPersisted()` existent — `fromUserInput()` (validation contre le catalogue
 * courant, HTTP 400 sur clé inconnue) et la persistance elle-même restent portées
 * par RM-3.
 */
export class HouseRules {
  private constructor(private readonly enabled: ReadonlySet<string>) {}

  /** Aucune règle maison active — valeur par défaut tant que RM-3 n'a pas encore
   *  câblé la persistance sur `Campaign` (cf. `Campaign.houseRules`). */
  static none(): HouseRules {
    return new HouseRules(new Set());
  }

  /** Hydratation depuis la base (mapper) — aucune validation : une clé orpheline
   *  (retirée depuis du catalogue) reste présente mais inerte, personne ne la relit. */
  static fromPersisted(keys: readonly string[]): HouseRules {
    return new HouseRules(new Set(keys));
  }

  isEnabled(nomInterne: string): boolean {
    return this.enabled.has(nomInterne);
  }

  toArray(): string[] {
    return [...this.enabled];
  }
}
