import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { UserOrm } from '../../../auth/user.entity';
import { VehicleOrm } from './vehicle.entity';

/**
 * Entité ORM de l'agrégat Team.
 *
 * Contrairement à l'ancienne team.entity.ts, Team porte maintenant sa relation
 * `vehicles` avec cascade : sauvegarder Team persiste tout l'agrégat (vehicles,
 * weapons, improvements) en un seul save().
 */
@Entity('teams')
export class TeamOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, default: 'Rutherford' })
  sponsor: string;

  @Column({ default: 50 })
  cans: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => UserOrm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserOrm;

  @Column()
  userId: number;

  // cascade: true + orphanedRowAction: 'delete' → un seul teamRepo.save(teamOrm)
  // propage toutes les mutations (ajouts, suppressions, mises à jour) sur les véhicules.
  @OneToMany(() => VehicleOrm, (v) => v.team, { cascade: true, orphanedRowAction: 'delete' })
  vehicles: VehicleOrm[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
