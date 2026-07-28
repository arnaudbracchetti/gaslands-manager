/**
 * Entité TypeORM représentant un utilisateur de l'application.
 *
 * Structure de persistance PURE : aucune règle métier ici — elles vivent toutes
 * dans l'agrégat `User` (domain/), auquel `UserMapper` traduit cette ligne.
 * C'est aussi pourquoi `UserRole` est importé depuis `domain/` plutôt que
 * déclaré ici : le domaine s'en sert dans ses propres règles et ne peut pas
 * importer un fichier décoré TypeORM.
 *
 * TypeORM utilise les décorateurs pour décrire la structure de la table SQL :
 * - @Entity('users')   → crée (ou mappe) la table "users" dans PostgreSQL
 * - @Column(...)       → mappe chaque propriété à une colonne SQL
 * - @CreateDateColumn  → géré automatiquement par TypeORM (INSERT)
 * - @UpdateDateColumn  → géré automatiquement par TypeORM (UPDATE)
 *
 * Grâce à `synchronize: true` dans app.module.ts (mode dev uniquement),
 * TypeORM crée ou met à jour la table automatiquement au démarrage.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../domain/user-role';

@Entity('users')
export class UserOrm {
  // Clé primaire auto-incrémentée (SERIAL en PostgreSQL)
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  /**
   * Nom d'affichage choisi par le joueur — source du getter `User.callName`.
   * Obligatoire côté applicatif (l'agrégat refuse un pseudo vide), mais déclaré
   * avec `default: ''` : `synchronize: true` ne peut pas ajouter une colonne
   * NOT NULL sans défaut sur une table déjà peuplée. Seuls les comptes créés
   * AVANT cette colonne peuvent donc porter '' — jusqu'à leur prochaine édition
   * de profil. Pas de contrainte d'unicité : deux joueurs peuvent partager un
   * pseudo (ce n'est pas un identifiant, cf. spec/AUTH.md).
   */
  @Column({ length: 100, default: '' })
  pseudo: string;

  // unique: true → contrainte UNIQUE au niveau de la base de données.
  // Seule règle du compte qui NE PEUT PAS vivre dans l'agrégat : elle porte sur
  // les AUTRES utilisateurs, donnée qu'un agrégat n'a structurellement pas.
  // La violation (code 23505) est traduite en ConflictException par UserRepository.
  @Column({ unique: true, length: 200 })
  email: string;

  // On ne stocke JAMAIS le mot de passe en clair.
  // Ce champ contient exclusivement le hash bcrypt (ex: "$2b$10$...")
  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  // Un compte désactivé (isActive: false) conserve toutes ses données (équipes,
  // véhicules…) mais ne peut plus se connecter — cf. User.assertCanAuthenticate().
  @Column({ default: true })
  isActive: boolean;

  // TypeORM remplit automatiquement ces deux champs
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
