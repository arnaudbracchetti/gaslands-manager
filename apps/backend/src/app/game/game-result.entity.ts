import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm';
import { Game } from './game.entity';
import { CampaignParticipant } from '../campaign/campaign-participant.entity';

@Entity('game_results')
@Unique(['gameId', 'participantId'])
@Unique(['gameId', 'rank'])
export class GameResult {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  gameId!: number;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game!: Game;

  @Column()
  participantId!: number;

  @ManyToOne(() => CampaignParticipant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantId' })
  participant!: CampaignParticipant;

  @Column()
  rank!: number;

  @Column({ default: 0 })
  championshipPoints!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
