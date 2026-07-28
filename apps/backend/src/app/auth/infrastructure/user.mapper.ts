import { User } from '../domain/user';
import { UserOrm } from './entities/user.entity';

/**
 * Traduit une ligne `users` en agrégat `User` et retour — fonctions pures, sans
 * état ni injection (même statut que `team-sheet.mapper.ts`, cf. ARCHITECTURE.md
 * §3.4, qui est lui aussi importé par un autre module).
 *
 * `toDomain` est exporté hors du module `auth/` : `CampaignQueryService` charge
 * des `UserOrm` par relation TypeORM et doit pouvoir en lire le `callName` sans
 * jamais réimplémenter la règle du nom d'affichage.
 */
export const UserMapper = {
  toDomain(orm: UserOrm): User {
    return new User(
      orm.id,
      orm.firstName,
      orm.lastName,
      orm.pseudo,
      orm.email,
      orm.password,
      orm.role,
      orm.isActive,
      orm.createdAt,
      orm.updatedAt,
    );
  },

  /**
   * Reporte l'état de l'agrégat sur une ligne ORM. `createdAt`/`updatedAt` sont
   * gérés par TypeORM (@CreateDateColumn/@UpdateDateColumn) et volontairement
   * omis. `id: 0` (agrégat tout juste fabriqué) reste absent pour laisser
   * PostgreSQL générer la clé.
   */
  toOrm(user: User, target: UserOrm = new UserOrm()): UserOrm {
    if (user.id !== 0) {
      target.id = user.id;
    }
    target.firstName = user.firstName;
    target.lastName = user.lastName;
    target.pseudo = user.pseudo;
    target.email = user.email;
    target.password = user.passwordHash;
    target.role = user.role;
    target.isActive = user.isActive;
    return target;
  },
};
