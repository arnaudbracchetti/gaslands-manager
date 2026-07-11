import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { VehicleOrm } from './vehicle.entity';
import type { WeaponOrientation } from '../../domain/team';

@Entity('weapons')
export class WeaponOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nomInterne: string;

  /** 5 valeurs possibles, dont `'tourelle'` (montage sur Tourelle — arc à 360°, coût ×3). */
  @Column({ type: 'varchar', length: 10, nullable: true })
  orientation: WeaponOrientation | null;

  @Column({ default: false })
  estDefaut: boolean;

  // Résolveur paresseux pour éviter les cycles de fichiers entre vehicle.entity.ts et weapon.entity.ts
  @ManyToOne(() => VehicleOrm, (vehicle) => vehicle.weapons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: VehicleOrm;

  @Column()
  vehicleId: number;

  @CreateDateColumn()
  createdAt: Date;
}
