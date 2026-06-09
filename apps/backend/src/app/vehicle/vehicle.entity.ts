/**
 * Entités TypeORM du module Vehicle — un véhicule appartenant à une équipe (instance
 * de jeu), distinct du catalogue en mémoire (cf. SPECIFICATION.md §5, ARCHITECTURE.md §3.3).
 *
 * `Vehicle`/`VehicleImprovement` référencent leurs items catalogue par `nom_interne`
 * plutôt que par `nom` affiché : identifiant stable, sans accents ni espaces, capable
 * de distinguer une variante sponsor de l'original (ex: "Voiture" vs "Voiture (Prison)")
 * tout en permettant de relier deux noms différents à la même règle métier
 * (ex: "Bélier" / "Bélier (Slime)" — cf. `catalog.interfaces.ts`, doc de `nom_interne`).
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
import type { Amelioration, Arme } from '../catalog/catalog.interfaces';

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

  // `Weapon` et `VehicleImprovement` sont deux entités distinctes plutôt qu'une seule
  // "équipement" générique : leurs règles de pose divergent (les armes ne modifient pas
  // les stats du véhicule — pas de Pattern Decorator — mais portent une contrainte
  // d'orientation différente, cf. `weapon.entity.ts`).
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

  // Nom interne de l'arme choisie pour cette Tourelle — référence catalogue (string stable,
  // sans accents). `null` quand aucune arme n'est assignée (état "orphelin").
  //
  // L'arme sur Tourelle n'existe PAS comme entité `Weapon` séparée : la Tourelle porte
  // le coût TOTAL (3× le prix de l'arme). Une entité Weapon séparée aurait son propre
  // `prix` qui s'additionnerait, donnant 4× au lieu de 3× — sémantique incorrecte.
  // Conséquence : pas de FK, pas de cascade, pas de modification de `weapon.entity.ts`.
  //
  // ⚠️ `type: 'varchar'` obligatoire : `emitDecoratorMetadata` émet `Object` pour les
  // types union TypeScript (`string | null`), ce qui fait planter TypeORM au démarrage
  // ("Data type Object not supported"). Même contrainte que `orientation` (cf. ligne 88).
  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  weaponNomInterne: string | null;

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
   * Entrée catalogue de l'arme montée sur cette Tourelle — hydratée par le service
   * via `catalogService.getArmeByNomInterne(weaponNomInterne)`, jamais persistée.
   * Undefined si aucune arme n'est assignée (`weaponNomInterne === null`).
   */
  weaponCatalogueMonte?: Arme;

  /**
   * Prix effectif en Jerricans :
   * - `0` pour les améliorations intégrées au profil de base (`estDefaut`).
   * - Pour la Tourelle (`nomInterne === 'tourelle'`) : 3× le prix catalogue de l'arme
   *   assignée, ou `0` si aucune arme n'est encore assignée (état orphelin).
   *   ⚠️ Corrige l'ancien bug "x3" : `("x3" as number)` retournait la chaîne "x3"
   *   à l'exécution (TypeScript cast inopérant au runtime) — désormais toujours number.
   * - Pour les autres améliorations : prix catalogue direct.
   *
   * ⚠️ Getter non sérialisé par JSON.stringify — appelé explicitement par
   * `VehicleService.toVehicleDto()` (mécanique détaillée là-bas).
   */
  get prix(): number {
    // Les améliorations par défaut (Tourelle du Char d'assaut, Arceaux du Buggy…)
    // sont gratuites — coût zéro sans calcul supplémentaire.
    if (this.estDefaut) return 0;

    if (this.nomInterne === 'tourelle') {
      // Tourelle orpheline (aucune arme assignée) : coût 0 en attendant l'assignation.
      // Tourelle assignée : 3 × prix catalogue de l'arme choisie — COÛT TOTAL inclus
      // (pas "arme séparée + Tourelle"), l'arme n'existe pas comme entité Weapon.
      if (!this.weaponNomInterne || !this.weaponCatalogueMonte) return 0;
      return (this.weaponCatalogueMonte.prix as number) * 3;
    }

    // Toutes les autres améliorations : prix catalogue direct.
    return (this.ameliorationCatalogue?.prix as number) ?? 0;
  }

  /**
   * Emplacements consommés : 0 si amélioration intégrée au profil de base (`estDefaut`)
   * — elle fait partie du véhicule, pas de son équipement achetable — valeur catalogue sinon.
   */
  get emplacement(): number {
    if (this.estDefaut) return 0;
    return this.ameliorationCatalogue?.emplacement ?? 0;
  }
}
