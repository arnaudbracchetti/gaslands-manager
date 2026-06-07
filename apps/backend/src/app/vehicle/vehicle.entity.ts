/**
 * Entités TypeORM du module Vehicle — un véhicule appartenant à une équipe (instance
 * de jeu), distinct du catalogue en mémoire (cf. SPECIFICATION.md §5, ARCHITECTURE.md §3.3).
 *
 * Comme `Team.sponsor` référence un sponsor du catalogue par son nom (chaîne, pas de
 * FK SQL — le catalogue n'est pas en base), `Vehicle`/`VehicleImprovement` référencent
 * leurs items catalogue par `nom_interne` plutôt que par `nom` affiché : c'est
 * précisément le rôle de cet identifiant — stable, sans accents ni espaces, et SEUL
 * capable de distinguer une variante sponsor de l'original (ex: "Voiture" vs
 * "Voiture (Prison)" partagent un `nom` proche mais ont des `nom_interne` distincts ;
 * inversement "Bélier" et "Bélier (Slime)" doivent rester ASSOCIABLES à la même règle
 * malgré des noms différents — cf. `catalog.interfaces.ts`, doc de `nom_interne`).
 * Note : SPECIFICATION.md nommait initialement ce champ `nom` ; corrigé ici en
 * `nomInterne` pour refléter fidèlement la clé catalogue qu'il référence réellement —
 * documentation mise à jour en conséquence.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Team } from '../team/team.entity';
import type { Orientation } from './vehicle-build';

// @Entity('vehicles') crée une table "vehicles" dans PostgreSQL
@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  // Référence stable vers Vehicule.nom_interne du catalogue (cf. note d'en-tête).
  // 100 caractères : largement suffisant pour les nom_interne les plus longs du YAML.
  @Column({ length: 100 })
  nomInterne: string;

  // Relation Many-to-One vers Team — même schéma que Team → User :
  // - Plusieurs véhicules peuvent appartenir à la même équipe
  // - onDelete: 'CASCADE' → si l'équipe est supprimée, ses véhicules le sont aussi
  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team: Team;

  // Colonne explicite pour la clé étrangère (cf. Team.userId : permet de requêter
  // sans charger l'objet Team — ex: vehicleRepo.find({ where: { teamId: 3 } }))
  @Column()
  teamId: number;

  // Relation One-to-Many vers les améliorations installées sur ce véhicule.
  // cascade: true → sauvegarder un Vehicle avec ses `improvements` persiste aussi
  // les lignes liées en une seule opération (pratique pour `addImprovement`).
  // L'ordre d'achat est significatif pour `describe()` (cf. VehicleBuildFactory) ;
  // TypeORM restitue les lignes dans l'ordre de leur clé primaire par défaut, ce
  // qui correspond justement à l'ordre d'insertion (auto-incrément).
  @OneToMany(() => VehicleImprovement, (improvement) => improvement.vehicle, {
    cascade: true,
  })
  improvements: VehicleImprovement[];

  @CreateDateColumn()
  createdAt: Date;
}

// @Entity('vehicle_improvements') crée une table "vehicle_improvements" dans PostgreSQL
@Entity('vehicle_improvements')
export class VehicleImprovement {
  @PrimaryGeneratedColumn()
  id: number;

  // Référence stable vers Amelioration.nom_interne du catalogue (même logique que
  // Vehicle.nomInterne ci-dessus — voir la note d'en-tête de ce fichier).
  @Column({ length: 100 })
  nomInterne: string;

  // Orientation directionnelle — uniquement pertinente pour certaines améliorations
  // (Bélier, Bélier Explosif...). `null` en base pour "non orientée" : c'est la
  // convention TypeORM pour les colonnes nullable (≠ `undefined`, qui n'existe pas
  // en SQL). `VehicleService` se charge de la conversion vers `InstalledImprovement`
  // (`orientation?: Orientation`, convention du module `vehicle-build`) au moment
  // de reconstituer la chaîne — chaque couche garde le vocabulaire qui lui est propre.
  @Column({ type: 'varchar', length: 10, nullable: true })
  orientation: Orientation | null;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.improvements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: number;

  @CreateDateColumn()
  createdAt: Date;
}
