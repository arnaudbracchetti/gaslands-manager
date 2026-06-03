/**
 * CatalogModule — Module NestJS pour le catalogue de jeu Gaslands.
 *
 * Ce module encapsule le CatalogService (chargement des données YAML)
 * et le CatalogController (endpoints HTTP publics).
 *
 * Le CatalogService est exporté afin de pouvoir être injecté dans d'autres
 * modules à l'avenir (ex: TeamModule pour valider qu'un sponsor existe,
 * ou qu'un véhicule est autorisé pour ce sponsor).
 */

import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService],
  // Export du service : il pourra être injecté dans d'autres modules
  // sans avoir à réimporter CatalogModule partout.
  exports: [CatalogService],
})
export class CatalogModule {}
