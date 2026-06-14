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
import { Season } from './season.entity';
import { User } from '../auth/user.entity';
import { Team } from '../team/team.entity';
import { ParticipantStatus } from './season.enums';

// Une ligne par (utilisateur, équipe choisie) inscrit à une saison.
// @Unique(['seasonId', 'userId']) : un utilisateur ne peut inscrire qu'UNE
// seule de ses équipes par saison — même s'il en possède plusieurs au total.
@Entity('season_participants')
@Unique(['seasonId', 'userId'])
export class SeasonParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Season, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seasonId' })
  season: Season;

  @Column()
  seasonId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column()
  teamId: number;

  // PENDING par défaut : passe à VALIDATED dès qu'un organisateur accepte la
  // demande (ou immédiatement pour le créateur de la saison, cf. SeasonService.create).
  @Column({ type: 'enum', enum: ParticipantStatus, default: ParticipantStatus.PENDING })
  status: ParticipantStatus;

  // true pour le créateur de la saison, et pour tout participant promu
  // co-organisateur — droits identiques.
  @Column({ default: false })
  isOrganizer: boolean;

  // Posé à true quand la saison passe en EN_COURS — aucune logique d'application
  // pour l'instant (réservé pour une itération future, cf. doc de conception).
  @Column({ default: false })
  isLocked: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
