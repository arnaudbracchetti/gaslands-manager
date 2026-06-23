import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Season } from '../season/season.entity';
import { GameStatus, GameType } from './game.enums';

// Une partie au Programme Télé d'une saison (mode campagne).
// Première brique de la Phase 1 : on ne stocke ici que la PLANIFICATION d'une
// partie (scénario, type, ordre, statut) — pas encore ses résultats.
@Entity('games')
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  // CASCADE : supprimer une saison supprime toutes ses parties.
  @ManyToOne(() => Season, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seasonId' })
  season: Season;

  @Column()
  seasonId: number;

  // Référence (clé étrangère logique) vers Scenario.nom_interne du catalogue
  // chargé par ScenarioCatalogService. Même principe que Vehicle.nomInterne.
  @Column()
  scenarioId: string;

  @Column({ type: 'enum', enum: GameType })
  type: GameType;

  @Column({ type: 'enum', enum: GameStatus, default: GameStatus.PLANIFIE })
  status: GameStatus;

  // Position de la partie dans le Programme. Auto-append : MAX(order)+1 à la
  // création (cf. GameService.create). "order" étant un mot réservé SQL, on mappe
  // explicitement la colonne sur un nom entre guillemets.
  @Column({ name: 'displayOrder' })
  order: number;

  // Horodatage du passage à JOUE — null tant que la partie est PLANIFIE.
  @Column({ type: 'timestamp', nullable: true })
  playedAt: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
