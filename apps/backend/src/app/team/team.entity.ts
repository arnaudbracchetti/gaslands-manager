import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// @Entity('teams') crée une table "teams" dans PostgreSQL
@Entity('teams')
export class Team {
  // Clé primaire auto-incrémentée (id = 1, 2, 3...)
  @PrimaryGeneratedColumn()
  id: number;

  // VARCHAR(100) NOT NULL
  @Column({ length: 100 })
  name: string;

  // Le sponsor détermine les armes disponibles dans Gaslands (Rutherford, Miyazaki...)
  @Column({ length: 50, default: 'Rutherford' })
  sponsor: string;

  // Le budget en "canettes" (la monnaie du jeu Gaslands)
  @Column({ default: 50 })
  cans: number;

  // Description libre de l'équipe (nullable = peut être vide)
  @Column({ type: 'text', nullable: true })
  description: string;

  // Timestamps automatiques (TypeORM les gère tout seul)
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
