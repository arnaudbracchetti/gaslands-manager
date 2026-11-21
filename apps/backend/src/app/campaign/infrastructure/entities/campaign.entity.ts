import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CampaignState } from '../../domain/enums/campaign.enums';

// @Entity('campaigns') crée une table "campaigns" dans PostgreSQL
@Entity('campaigns')
export class CampaignOrm {
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

  // Budget en jerricans imposé par l'organisateur à toutes les équipes engagées -
  // remplace Team.cans pour tout calcul en contexte campagne (cf. Team.budget).
  @Column({ default: 50 })
  budget: number;

  // Clés (nom_interne) des règles maison activées, cf. regles-maison.yml — HouseRules
  // ne stocke que les clés ACTIVÉES (cf. domain/house-rules/house-rules.ts). Première
  // colonne jsonb du projet.
  @Column({ type: 'jsonb', default: [] })
  houseRules: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
