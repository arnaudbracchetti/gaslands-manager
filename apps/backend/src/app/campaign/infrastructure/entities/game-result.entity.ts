import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm';
import { GameOrm } from './game.entity';
import { CampaignParticipantOrm } from './campaign-participant.entity';

@Entity('game_results')
@Unique(['gameId', 'participantId'])
@Unique(['gameId', 'rank'])
export class GameResultOrm {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  gameId!: number;

  @ManyToOne(() => GameOrm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game!: GameOrm;

  @Column()
  participantId!: number;

  @ManyToOne(() => CampaignParticipantOrm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantId' })
  participant!: CampaignParticipantOrm;

  @Column()
  rank!: number;

  @Column({ default: 0 })
  championshipPoints!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
