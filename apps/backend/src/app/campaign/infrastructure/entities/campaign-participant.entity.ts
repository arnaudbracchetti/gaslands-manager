import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { CampaignOrm } from './campaign.entity';
import { UserOrm } from '../../../auth/infrastructure/entities/user.entity';
import { TeamOrm } from '../../../team/infrastructure/entities/team.entity';
import { ParticipantStatus } from '../../domain/enums/campaign.enums';

// Une ligne par (utilisateur, équipe choisie) inscrit à une campagne.
// @Unique(['campaignId', 'userId']) : un utilisateur ne peut inscrire qu'UNE
// seule de ses équipes par campagne — même s'il en possède plusieurs au total.
@Entity('campaign_participants')
@Unique(['campaignId', 'userId'])
export class CampaignParticipantOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CampaignOrm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: CampaignOrm;

  @Column()
  campaignId: number;

  @ManyToOne(() => UserOrm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserOrm;

  @Column()
  userId: number;

  // nullable : l'organisateur peut créer une campagne sans engager d'équipe immédiatement
  @ManyToOne(() => TeamOrm, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'teamId' })
  team: TeamOrm;

  @Column({ type: 'int', nullable: true })
  teamId: number | null;

  // PENDING par défaut : passe à VALIDATED dès qu'un organisateur accepte la
  // demande (ou immédiatement pour le créateur de la campagne, cf. CampaignService.create).
  @Column({ type: 'enum', enum: ParticipantStatus, default: ParticipantStatus.PENDING })
  status: ParticipantStatus;

  // true pour le créateur de la campagne, et pour tout participant promu
  // co-organisateur — droits identiques.
  @Column({ default: false })
  isOrganizer: boolean;

  // Posé à true quand la campagne passe en EN_COURS — aucune logique d'application
  // pour l'instant (réservé pour une itération future, cf. doc de conception).
  @Column({ default: false })
  isLocked: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
