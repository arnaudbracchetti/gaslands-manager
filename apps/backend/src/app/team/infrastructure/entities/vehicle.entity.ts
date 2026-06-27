import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Team } from './team.entity';
import { Weapon as WeaponOrm } from './weapon.entity';
import type { Orientation } from '../../vehicle-build';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nomInterne: string;

  @ManyToOne(() => Team, (team) => team.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column()
  teamId: number;

  @OneToMany(() => VehicleImprovement, (improvement) => improvement.vehicle, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  improvements: VehicleImprovement[];

  @OneToMany(() => WeaponOrm, (weapon) => weapon.vehicle, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  weapons: WeaponOrm[];

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('vehicle_improvements')
export class VehicleImprovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nomInterne: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  orientation: Orientation | null;

  @Column({ default: false })
  estDefaut: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  weaponNomInterne: string | null;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.improvements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: number;

  @CreateDateColumn()
  createdAt: Date;
}
