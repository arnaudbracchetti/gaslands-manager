import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SeasonState } from './season.enums';

// @Entity('seasons') crée une table "seasons" dans PostgreSQL
@Entity('seasons')
export class Season {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  // État de la saison — cf. season.enums.ts pour le cycle de vie complet
  @Column({ type: 'enum', enum: SeasonState, default: SeasonState.EN_CONSTRUCTION })
  state: SeasonState;

  // Token partageable hors-app permettant de demander à rejoindre la saison.
  // unique: true → contrainte UNIQUE en base, garantit qu'un code ne désigne
  // jamais deux saisons différentes.
  @Column({ unique: true })
  inviteCode: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
