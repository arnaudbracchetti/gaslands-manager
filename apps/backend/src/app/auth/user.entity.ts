/**
 * Entité TypeORM représentant un utilisateur de l'application.
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

@Entity('users')
export class User {
  // Clé primaire auto-incrémentée (SERIAL en PostgreSQL)
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  // unique: true → contrainte UNIQUE au niveau de la base de données
  // Si on tente d'insérer deux fois le même email, PostgreSQL lèvera
  // une erreur (code 23505) que l'on intercepte dans UserService.
  @Column({ unique: true, length: 200 })
  email: string;

  // On ne stocke JAMAIS le mot de passe en clair.
  // Ce champ contient exclusivement le hash bcrypt (ex: "$2b$10$...")
  @Column()
  password: string;

  // TypeORM remplit automatiquement ces deux champs
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
