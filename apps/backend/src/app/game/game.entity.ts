import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Campaign } from '../campaign/campaign.entity';
import { GameStatus, GameType } from './game.enums';

// Une partie au Programme Télé d'une saison (mode campagne).
// Première brique de la Phase 1 : on ne stocke ici que la PLANIFICATION d'une
// partie (scénario, type, ordre, statut) — pas encore ses résultats.
@Entity('games')
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  // CASCADE : supprimer une saison supprime toutes ses parties.
  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @Column()
  campaignId: number;

  // Référence (clé étrangère logique) vers Scenario.nom_interne du catalogue.
  // nullable : null pour AtelierGame (pas de scénario associé).
  @Column({ nullable: true })
  scenarioId: string | null;

  @Column({ type: 'enum', enum: GameType })
  type: GameType;

  @Column({ type: 'enum', enum: GameStatus, default: GameStatus.PLANIFIE })
  status: GameStatus;

  // Position de la partie dans le Programme. double precision pour permettre
  // l'insertion fractionnaire d'un AtelierGame intercalé (order = n + 0.5, D-S7).
  @Column({ name: 'displayOrder', type: 'double precision' })
  order: number;

  // Horodatage du passage à JOUE — null tant que la partie est PLANIFIE.
  @Column({ type: 'timestamp', nullable: true })
  playedAt: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
