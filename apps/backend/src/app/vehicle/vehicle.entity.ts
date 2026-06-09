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
import { Weapon } from '../weapon/weapon.entity';
import type { Orientation } from './vehicle-build';
import type { Amelioration } from '../catalog/catalog.interfaces';

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

  // Relation One-to-Many vers les armes montées sur ce véhicule — miroir EXACT
  // de `improvements` ci-dessus (même cascade, même raisonnement sur l'ordre :
  // cf. son commentaire). `Weapon` et `VehicleImprovement` sont volontairement
  // deux entités distinctes plutôt qu'une seule "équipement" générique : leurs
  // règles de pose divergent profondément (les armes ne MODIFIENT pas les stats
  // du véhicule — pas de Pattern Decorator nécessaire — mais portent une
  // contrainte d'orientation différente, cf. `weapon.entity.ts`).
  @OneToMany(() => Weapon, (weapon) => weapon.vehicle, { cascade: true })
  weapons: Weapon[];

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

  // `true` pour les améliorations intégrées au profil de base du véhicule (ex : Arceaux
  // sur le Buggy). Ces améliorations ont un coût zéro et ne peuvent pas être retirées.
  // Valeur par défaut `false` : garantit que les lignes existantes conservent le
  // comportement actuel sans migration manuelle (TypeORM ajoute la colonne automatiquement
  // en mode synchronize:true).
  @Column({ default: false })
  estDefaut: boolean;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.improvements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: number;

  @CreateDateColumn()
  createdAt: Date;

  // ── Propriétés transientes — non persistées par TypeORM ────────────────────
  // Hydratées par VehicleService.hydrateImprovements() après chargement depuis la
  // base. TypeORM ignore toute propriété sans décorateur ; elles n'existent sur
  // l'instance que si le service les a explicitement initialisées.

  /** Entrée catalogue résolue — hydratée par le service, jamais persistée. */
  ameliorationCatalogue?: Amelioration;

  /**
   * Prix effectif de cette amélioration pour ce véhicule.
   *
   * Règle de gestion portée par l'entité elle-même : parcourt le graphe d'objet
   * (`ameliorationCatalogue`) pour lire le prix catalogue, et retourne 0 si
   * l'amélioration est intégrée au profil de base (`estDefaut`).
   *
   * ⚠️ Les getters TypeScript vivent sur le PROTOTYPE de la classe et ne sont PAS
   * sérialisés par `JSON.stringify` (qui n'énumère que les propriétés PROPRES d'un
   * objet). Ce getter sert à la logique métier interne ; c'est `VehicleService.
   * toVehicleDto()` qui l'appelle et expose la valeur dans la réponse HTTP.
   */
  get prix(): number {
    if (this.estDefaut) return 0;
    return (this.ameliorationCatalogue?.prix as number) ?? 0;
  }

  /**
   * Nombre d'emplacements consommés par cette amélioration.
   *
   * Même règle que `prix` : une amélioration intégrée au profil de base (`estDefaut`)
   * ne consomme pas d'emplacement achetable — elle fait partie du véhicule, pas de
   * son équipement. Retourne 0 dans ce cas ; valeur catalogue sinon.
   *
   * Cohérence garantie entre backend (`improvementSlotsOf`, chaîne `VehicleBuild`)
   * et frontend (`emplacementsUtilises`) : les deux consomment ce getter via le DTO,
   * sans consulter le catalogue indépendamment.
   */
  get emplacement(): number {
    if (this.estDefaut) return 0;
    return this.ameliorationCatalogue?.emplacement ?? 0;
  }
}
