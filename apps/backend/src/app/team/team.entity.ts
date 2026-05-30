import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../auth/user.entity';

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

  // Le budget en "jerricans" (la monnaie du jeu Gaslands)
  @Column({ default: 50 })
  cans: number;

  // Description libre de l'équipe (nullable = peut être vide)
  @Column({ type: 'text', nullable: true })
  description: string;

  // Relation Many-to-One vers User :
  // - Plusieurs équipes peuvent appartenir au même utilisateur
  // - onDelete: 'CASCADE' → si l'utilisateur est supprimé, ses équipes le sont aussi
  // - @JoinColumn indique que la clé étrangère "userId" se trouve dans cette table
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Colonne explicite pour la clé étrangère (permet de requêter sans charger l'objet User)
  // ex : teamRepo.find({ where: { userId: 3 } }) → toutes les équipes de l'utilisateur 3
  @Column()
  userId: number;

  // Timestamps automatiques (TypeORM les gère tout seul)
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
