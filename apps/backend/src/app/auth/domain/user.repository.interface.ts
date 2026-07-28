import type { User } from './user';

/**
 * Contrat de persistance de l'agrégat User (Dependency Inversion) — le domaine
 * définit l'interface, `UserRepository` (infrastructure/) l'implémente avec
 * TypeORM. Le domaine ne connaît jamais l'ORM.
 *
 * Pas de read model léger façon `TeamSummaryDto` ici : contrairement à `Team`
 * (dont le résumé évite de charger tous les véhicules et fait un COUNT SQL),
 * `User` est une seule ligne sans entité enfant — `findAll()` charge donc de
 * vrais agrégats, ce qui garantit que la liste d'administration affiche
 * `callName` par le même chemin que partout ailleurs.
 */
export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;

  /**
   * Le compte administrateur, recherché par son RÔLE et jamais par son email —
   * c'est ce qui garantit l'unicité du compte admin quel que soit le contenu
   * d'ADMIN_EMAIL (cf. spec/AUTH.md § Compte administrateur).
   */
  findAdmin(): Promise<User | null>;

  /** INSERT ou UPDATE selon `user.id`. Lève ConflictException si l'email est déjà pris. */
  save(user: User): Promise<User>;

  remove(id: number): Promise<void>;
}
