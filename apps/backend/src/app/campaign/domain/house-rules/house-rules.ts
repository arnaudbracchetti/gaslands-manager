import { DomainException } from '../../../shared/domain/domain-exception';

/**
 * Réglage des règles maison d'une campagne — ensemble des clés (`nom_interne` du
 * catalogue `regles-maison.yml`) actuellement activées. Value Object immuable :
 * ne contient QUE les clés activées, pas une map complète nom→booléen — une règle
 * absente équivaut au comportement par défaut, donc une règle ajoutée après coup au
 * catalogue est automatiquement "décochée" partout, sans reprise de données.
 *
 * Deux chemins de construction — "lecture tolérante, écriture stricte" (RM-3, cf.
 * docs/plans/2026-09-21-regles-maison-mecanisme-design.md §1) : `fromPersisted()`
 * (hydratation, aucune validation) et `fromUserInput()` (saisie utilisateur, rejette
 * toute clé absente du catalogue courant). Le domaine ne connaît jamais le catalogue
 * lui-même — `validKeys` est un instantané fourni par l'appelant (use case).
 */
export class HouseRules {
  private constructor(private readonly enabled: ReadonlySet<string>) {}

  /** Aucune règle maison active — valeur par défaut d'une `Campaign` fraîchement
   *  construite sans réglage explicite. */
  static none(): HouseRules {
    return new HouseRules(new Set());
  }

  /** Hydratation depuis la base (mapper) — aucune validation : une clé orpheline
   *  (retirée depuis du catalogue) reste présente mais inerte, personne ne la relit. */
  static fromPersisted(keys: readonly string[]): HouseRules {
    return new HouseRules(new Set(keys));
  }

  /**
   * Depuis une saisie utilisateur (création ou modification de campagne) —
   * `validKeys` est le catalogue COURANT (liste de `nom_interne`), fourni par
   * l'appelant. Rejette toute clé absente : jamais ignorée silencieusement.
   */
  static fromUserInput(keys: readonly string[], validKeys: readonly string[]): HouseRules {
    const valid = new Set(validKeys);
    for (const k of keys) {
      if (!valid.has(k)) throw new DomainException(`Règle maison inconnue : "${k}".`);
    }
    return new HouseRules(new Set(keys));
  }

  isEnabled(nomInterne: string): boolean {
    return this.enabled.has(nomInterne);
  }

  toArray(): string[] {
    return [...this.enabled];
  }
}
