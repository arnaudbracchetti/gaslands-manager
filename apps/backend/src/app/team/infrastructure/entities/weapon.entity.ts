import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from './vehicle.entity';
import type { Orientation } from '../../vehicle-build';

@Entity('weapons')
export class Weapon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nomInterne: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  orientation: Orientation | null;

  // Résolveur paresseux pour éviter les cycles de fichiers entre vehicle.entity.ts et weapon.entity.ts
  @ManyToOne(() => Vehicle, (vehicle) => vehicle.weapons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: number;

  @CreateDateColumn()
  createdAt: Date;
}
