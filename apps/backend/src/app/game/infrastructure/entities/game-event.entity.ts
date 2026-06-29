import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Game } from '../../game.entity';
import { CampaignParticipant } from '../../../campaign/campaign-participant.entity';

/**
 * Enregistrement d'un événement dans le journal de campagne.
 *
 * Table STI plate — un seul discriminant `eventType` (string), puis ~14 colonnes
 * nullable. Chaque ligne stocke exactement les champs utiles à son type d'événement.
 * Les colonnes non applicables valent NULL.
 *
 * Stratégie de persistance (D-S3) : seule source de vérité du mode campagne.
 * L'état en mémoire est toujours reconstruit par replay ; cette table n'est jamais
 * modifiée après insertion (`appendEvents`).
 */
@Entity('game_events')
export class GameEventOrm {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game!: Game;

  @Column()
  gameId!: number;

  @ManyToOne(() => CampaignParticipant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantId' })
  participant!: CampaignParticipant;

  @Column()
  participantId!: number;

  /** Ordre du replay au sein de la partie — garantit la stabilité de la séquence. */
  @Column()
  eventOrder!: number;

  /** Discriminant — valeurs : 'RANKING_ASSIGNED' | 'WALLET_MOVEMENT' | 'VEHICLE_LOST' |
   *  'WEAPON_LOST' | 'WRECK_RESOLVED' | 'SEQUELLA_ADDED' | 'EQUIPMENT_CHANGED' | 'RESISTANCE_CONTACTED' */
  @Column()
  eventType!: string;

  // ── Payload : RankingAssignedEvent ─────────────────────────────────────────
  @Column({ nullable: true })
  rank!: number | null;

  @Column({ nullable: true })
  championshipPoints!: number | null;

  // ── Payload : WalletMovementEvent ──────────────────────────────────────────
  @Column({ nullable: true })
  amount!: number | null;

  @Column({ nullable: true })
  walletReason!: string | null;  // WalletReason enum value

  // ── Payload commun : véhicule / arme ciblé ─────────────────────────────────
  @Column({ nullable: true })
  vehicleId!: number | null;

  @Column({ nullable: true })
  weaponId!: number | null;

  // ── Payload : WreckResolvedEvent ───────────────────────────────────────────
  @Column({ nullable: true })
  diceRoll!: number | null;

  @Column({ nullable: true })
  chocsBefore!: number | null;

  @Column({ nullable: true })
  wreckResult!: string | null;  // WreckResult enum value

  @Column({ nullable: true })
  chocsGained!: number | null;

  // ── Payload : SequellaAddedEvent ───────────────────────────────────────────
  @Column({ nullable: true })
  sequellaTypeNom!: string | null;  // nom_interne de la séquelle

  @Column({ nullable: true })
  chocsCost!: number | null;

  // ── Payload : EquipmentChangedEvent ────────────────────────────────────────
  @Column({ nullable: true })
  operation!: string | null;      // 'BUY' | 'SELL'

  @Column({ nullable: true })
  entityType!: string | null;     // 'VEHICLE' | 'WEAPON'

  @Column({ nullable: true })
  nomInterne!: string | null;     // nom_interne du véhicule ou de l'arme

  @Column({ nullable: true })
  cost!: number | null;

  @Column({ nullable: true })
  targetVehicleId!: number | null;

  @Column({ nullable: true })
  targetEntityId!: number | null;

  @Column({ nullable: true })
  orientation!: string | null;    // 'avant' | 'arrière' | 'gauche' | 'droite'

  @CreateDateColumn()
  createdAt!: Date;
}
