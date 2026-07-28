/**
 * Rôle d'un utilisateur.
 *
 * Vit dans `domain/` (et non plus sur l'entité TypeORM) parce que l'agrégat
 * `User` s'en sert dans ses propres règles : le domaine ne doit dépendre
 * d'aucun framework, il ne peut donc pas importer un symbole défini dans un
 * fichier décoré `@Entity`.
 *
 * 'admin' est réservé au compte unique créé/resynchronisé au démarrage depuis
 * ADMIN_EMAIL/ADMIN_PASSWORD (.env) — jamais attribuable via l'inscription
 * (`User.register()` force toujours USER).
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}
