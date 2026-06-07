/**
 * Entité TypeORM du module Weapon — une arme montée sur un véhicule d'équipe
 * (instance de jeu), distincte du catalogue en mémoire (cf. SPECIFICATION.md §5).
 *
 * Mirroir quasi exact de `VehicleImprovement` (cf. `vehicle.entity.ts`, dont la
 * note d'en-tête détaille le raisonnement `nom_interne`/`orientation` — on ne le
 * répète pas ici, seules les différences méritent un commentaire) :
 *  - `nomInterne` référence `Arme.nom_interne` du catalogue, pour les mêmes
 *    raisons (clé stable, sans accents ni espaces, distingue les variantes).
 *  - `orientation` réutilise les 4 arcs de tir Gaslands — mais avec une nuance
 *    propre aux ARMES (absente des améliorations) : elle est OBLIGATOIRE pour
 *    toute arme qui n'est pas de type `équipage` (montée sur un arc précis du
 *    véhicule), et interdite/sans objet pour les armes d'équipage (portées par
 *    un équipier, qui peut tirer dans n'importe quelle direction — 360°
 *    automatique). `WeaponService.canAddWeapon` porte cette règle ; la colonne
 *    reste nullable pour représenter fidèlement les deux cas.
 *
 * Cycle d'imports `vehicle.entity.ts ↔ weapon.entity.ts` : `Vehicle` référence
 * `Weapon` (relation `weapons`) et `Weapon` référence `Vehicle` (relation
 * `vehicle`) — un cycle de FICHIERS inévitable pour des entités mutuellement
 * liées. TypeORM résout exactement ce cas avec un résolveur PARESSEUX
 * `() => Vehicle` dans `@ManyToOne` : à la décoration de la classe (chargement
 * du module), cette fonction n'est PAS appelée — seulement mémorisée. TypeORM
 * ne l'invoque que plus tard, à l'initialisation de la `DataSource`, quand les
 * DEUX modules ont fini de se charger et que `Vehicle`/`Weapon` sont pleinement
 * définis. L'import normal (pas `import type`) est donc REQUIS ici : c'est une
 * vraie valeur consultée à l'exécution (au moment de l'appel du résolveur), pas
 * seulement un type — contrairement à `Orientation` ci-dessous, simple alias de
 * type, qui peut rester `import type` sans rien casser.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from '../vehicle/vehicle.entity';
import type { Orientation } from '../vehicle/vehicle-build';

// @Entity('weapons') crée une table "weapons" dans PostgreSQL
@Entity('weapons')
export class Weapon {
  @PrimaryGeneratedColumn()
  id: number;

  // Référence stable vers Arme.nom_interne du catalogue (cf. note d'en-tête).
  @Column({ length: 100 })
  nomInterne: string;

  // Orientation directionnelle — voir la note d'en-tête pour la nuance propre
  // aux armes (obligatoire hors `équipage`, interdite pour `équipage`). `null`
  // en base = "non orientée" (convention TypeORM pour les colonnes nullable,
  // identique à `VehicleImprovement.orientation` — même type, même longueur).
  @Column({ type: 'varchar', length: 10, nullable: true })
  orientation: Orientation | null;

  // () => Vehicle : résolveur paresseux — cf. note d'en-tête sur le cycle de fichiers.
  @ManyToOne(() => Vehicle, (vehicle) => vehicle.weapons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: number;

  @CreateDateColumn()
  createdAt: Date;
}
