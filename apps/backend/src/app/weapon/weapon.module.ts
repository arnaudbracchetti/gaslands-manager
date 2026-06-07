/**
 * WeaponModule — Module NestJS pour la gestion des armes montées sur les véhicules.
 *
 * Mirroir de `VehicleModule` côté structure (cf. son en-tête) :
 *  - `TypeOrmModule.forFeature([Weapon])` enregistre l'entité du module — c'est ce
 *    qui permet à `WeaponService` d'injecter `Repository<Weapon>` via `@InjectRepository`.
 *  - `CatalogModule` apporte `CatalogService` : `WeaponService.canAddWeapon` en a
 *    besoin pour résoudre les armes du catalogue par `nom_interne` et le sponsor
 *    de l'équipe (même usage que dans `VehicleModule`).
 *  - `VehicleModule` apporte `VehicleService` (déjà exporté, cf. son en-tête) :
 *    `WeaponService` s'appuie dessus pour `findOneForUser` (sécurité + chargement
 *    des relations) ET pour les helpers PARTAGÉS `improvementSlotsOf`/`weaponSlotsOf`
 *    (pool d'emplacements commun aux armes et aux améliorations — cf. en-tête de
 *    `WeaponService` pour le raisonnement complet sur ce choix de dépendance).
 *    Pas de cycle : `VehicleModule` n'a besoin de rien venant de `WeaponModule`
 *    (il connaît déjà `Weapon` via `forFeature([Vehicle, VehicleImprovement])`
 *    et la relation `Vehicle.weapons` — l'entité, pas le module).
 *  - `WeaponController` expose l'API REST décrite dans son en-tête (`/api/vehicles/
 *    :id/available-weapons`, `/api/vehicles/:id/weapons`, `/api/weapons/:id`).
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Weapon } from './weapon.entity';
import { WeaponController } from './weapon.controller';
import { WeaponService } from './weapon.service';
import { CatalogModule } from '../catalog/catalog.module';
import { VehicleModule } from '../vehicle/vehicle.module';

@Module({
  imports: [TypeOrmModule.forFeature([Weapon]), VehicleModule, CatalogModule],
  controllers: [WeaponController],
  providers: [WeaponService],
  exports: [TypeOrmModule, WeaponService],
})
export class WeaponModule {}
