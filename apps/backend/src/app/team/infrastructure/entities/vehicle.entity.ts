import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { TeamOrm } from './team.entity';
import { WeaponOrm } from './weapon.entity';
import type { Orientation } from '../../domain/team';

@Entity('vehicles')
export class VehicleOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nomInterne: string;

  @ManyToOne(() => TeamOrm, (team) => team.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team: TeamOrm;

  @Column()
  teamId: number;

  @OneToMany(() => VehicleImprovementOrm, (improvement) => improvement.vehicle, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  improvements: VehicleImprovementOrm[];

  @OneToMany(() => WeaponOrm, (weapon) => weapon.vehicle, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  weapons: WeaponOrm[];

  @OneToMany(() => VehicleAdvantageOrm, (advantage) => advantage.vehicle, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  advantages: VehicleAdvantageOrm[];

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('vehicle_improvements')
export class VehicleImprovementOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nomInterne: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  orientation: Orientation | null;

  @Column({ default: false })
  estDefaut: boolean;

  @ManyToOne(() => VehicleOrm, (vehicle) => vehicle.improvements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: VehicleOrm;

  @Column()
  vehicleId: number;

  @CreateDateColumn()
  createdAt: Date;
}

/**
 * Un avantage acquis sur un véhicule. Mirroir de `VehicleImprovementOrm`, SANS colonne
 * `orientation` (un avantage n'en demande jamais) ni `estDefaut` (aucun véhicule du
 * catalogue n'a d'avantage intégré à son profil de base).
 */
@Entity('vehicle_advantages')
export class VehicleAdvantageOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nomInterne: string;

  @ManyToOne(() => VehicleOrm, (vehicle) => vehicle.advantages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: VehicleOrm;

  @Column()
  vehicleId: number;

  @CreateDateColumn()
  createdAt: Date;
}
