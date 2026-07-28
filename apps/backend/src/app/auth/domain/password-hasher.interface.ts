/**
 * Port hexagonal du hachage de mot de passe — même rôle qu'`IRandomizer` pour
 * la Table des Épaves (cf. ARCHITECTURE.md §3.8) : isoler une dépendance
 * technique (bcrypt) derrière une interface définie PAR le domaine, pour que
 * les règles qui en dépendent ("le mot de passe actuel doit correspondre")
 * puissent vivre dans l'agrégat sans que celui-ci importe bcrypt.
 *
 * Implémenté par `BcryptPasswordHasher` (infrastructure/). Dans les tests, un
 * double minimal suffit — aucun mock NestJS.
 */
export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}
