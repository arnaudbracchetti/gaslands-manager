import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { GameOrm } from './game.entity';
import { CampaignParticipantOrm } from './campaign-participant.entity';

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

  @ManyToOne(() => GameOrm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game!: GameOrm;

  @Column()
  gameId!: number;

  @ManyToOne(() => CampaignParticipantOrm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantId' })
  participant!: CampaignParticipantOrm;

  @Column()
  participantId!: number;

  /** Ordre du replay au sein de la partie — garantit la stabilité de la séquence. */
  @Column()
  eventOrder!: number;

  /** Discriminant — miroir de `GameEventType` (domain/enums/game-event-type.enum.ts) :
   *  'RANKING_ASSIGNED' | 'WALLET_MOVEMENT' | 'VEHICLE_LOST' | 'WEAPON_LOST' |
   *  'IMPROVEMENT_LOST' | 'ADVANTAGE_LOST' | 'WRECK_RESOLVED' | 'EQUIPMENT_CHANGED' |
   *  'RESISTANCE_CONTACTED' | 'GATES_CROSSED' | 'VEHICLE_DESTROYED' |
   *  'FAVORI_DU_PUBLIC_BONUS' | 'VEHICLE_RENAMED' */
  @Column()
  eventType!: string;

  // ── Payload : RankingAssignedEvent / GatesCrossedEvent / VehicleDestroyedEvent ──
  @Column({ type: 'int', nullable: true })
  rank!: number | null;

  @Column({ type: 'int', nullable: true })
  championshipPoints!: number | null;

  // ── Payload : GatesCrossedEvent ────────────────────────────────────────────
  @Column({ type: 'int', nullable: true })
  gatesCrossed!: number | null;

  // ── Payload : VehicleDestroyedEvent ────────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  weightClass!: string | null;  // WeightClass enum value

  // ── Payload : WalletMovementEvent ──────────────────────────────────────────
  @Column({ type: 'int', nullable: true })
  amount!: number | null;

  @Column({ type: 'varchar', nullable: true })
  walletReason!: string | null;  // WalletReason enum value

  // ── Payload commun : véhicule / arme ciblé ─────────────────────────────────
  @Column({ type: 'int', nullable: true })
  vehicleId!: number | null;

  @Column({ type: 'int', nullable: true })
  weaponId!: number | null;

  @Column({ type: 'int', nullable: true })
  improvementId!: number | null;

  @Column({ type: 'int', nullable: true })
  advantageId!: number | null;

  // ── Payload : WreckResolvedEvent ───────────────────────────────────────────
  @Column({ type: 'int', nullable: true })
  diceRoll!: number | null;

  @Column({ type: 'int', nullable: true })
  chocsBefore!: number | null;

  @Column({ type: 'varchar', nullable: true })
  wreckResult!: string | null;  // WreckResult enum value

  @Column({ type: 'int', nullable: true })
  chocsGained!: number | null;

  // ── Payload : EquipmentChangedEvent ────────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  operation!: string | null;      // 'BUY' | 'SELL'

  @Column({ type: 'varchar', nullable: true })
  entityType!: string | null;     // 'VEHICLE' | 'WEAPON'

  @Column({ type: 'varchar', nullable: true })
  nomInterne!: string | null;     // nom_interne du véhicule ou de l'arme

  @Column({ type: 'int', nullable: true })
  cost!: number | null;

  @Column({ type: 'int', nullable: true })
  targetVehicleId!: number | null;

  @Column({ type: 'int', nullable: true })
  targetEntityId!: number | null;

  // 'avant' | 'arrière' | 'gauche' | 'droite' | 'tourelle' (WEAPON — montage sur
  // Tourelle, arc à 360°, coût ×3)
  @Column({ type: 'varchar', nullable: true })
  orientation!: string | null;

  /** BUY(SEQUELLE, 'dur_a_cuire') uniquement — nom_interne de l'avantage gratuit accordé. */
  @Column({ type: 'varchar', nullable: true })
  freeAdvantageNomInterne!: string | null;

  // ── Payload : VehicleRenamedEvent ──────────────────────────────────────────
  @Column({ type: 'varchar', length: 100, nullable: true })
  previousVehicleName!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  newVehicleName!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
