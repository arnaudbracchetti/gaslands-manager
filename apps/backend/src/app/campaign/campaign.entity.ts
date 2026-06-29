import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CampaignState } from './campaign.enums';

// @Entity('campaigns') crée une table "campaigns" dans PostgreSQL
@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  // État de la campagne — cf. campaign.enums.ts pour le cycle de vie complet
  @Column({ type: 'enum', enum: CampaignState, default: CampaignState.EN_CONSTRUCTION })
  state: CampaignState;

  // Token partageable hors-app permettant de demander à rejoindre la campagne.
  // unique: true → contrainte UNIQUE en base, garantit qu'un code ne désigne
  // jamais deux campagnes différentes.
  @Column({ unique: true })
  inviteCode: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
