/**
 * CatalogController — Endpoints HTTP pour le catalogue de jeu Gaslands.
 *
 * Le catalogue est une donnée publique (pas de guard JWT) :
 * tout client peut consulter la liste des sponsors, véhicules, armes et améliorations
 * sans être authentifié. Ces données sont nécessaires pour construire des véhicules.
 *
 * Tous les endpoints sont en lecture seule (GET).
 * Les données viennent du CatalogService (en mémoire, chargé au démarrage).
 *
 * Avec le préfixe global /api, les routes sont :
 *   GET /api/catalog/sponsors
 *   GET /api/catalog/sponsors/:nom
 *   GET /api/catalog/vehicules
 *   GET /api/catalog/armes
 *   GET /api/catalog/ameliorations
 */

import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';
// import type : ces interfaces n'existent qu'à la compilation, pas à l'exécution.
import type { Amelioration, Arme, Sponsor, Vehicule } from './catalog.interfaces';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * GET /api/catalog/sponsors
   *
   * Retourne tous les sponsors avec leurs véhicules, armes et améliorations
   * autorisés (relations pré-calculées par le service).
   */
  @Get('sponsors')
  // Sponsor[] : tableau avec relations pré-résolues (vehicules, armes, ameliorations).
  getAllSponsors(): Sponsor[] {
    return this.catalogService.getAllSponsors();
  }

  /**
   * GET /api/catalog/sponsors/:nom
   *
   * Retourne un sponsor par son nom avec l'ensemble de son catalogue autorisé.
   * Les noms de sponsors contenant des espaces ou accents doivent être
   * URL-encodés par le client (ex: "La Geôlière" → "La%20Ge%C3%B4li%C3%A8re").
   * NestJS décode automatiquement les paramètres percent-encodés via @Param().
   *
   * @throws NotFoundException si le sponsor n'existe pas dans le catalogue
   */
  @Get('sponsors/:nom')
  // Sponsor (non Sponsor | undefined) : le throw garantit qu'on ne retourne jamais undefined.
  getSponsor(@Param('nom') nom: string): Sponsor {
    const sponsor = this.catalogService.getSponsor(nom);
    if (!sponsor) {
      throw new NotFoundException(`Sponsor "${nom}" introuvable dans le catalogue`);
    }
    return sponsor;
  }

  /**
   * GET /api/catalog/vehicules
   *
   * Retourne tous les véhicules du catalogue, toutes configurations confondues
   * (Léger, Moyen, Lourd). Le champ sponsors_autorises[] est inclus dans la réponse.
   */
  @Get('vehicules')
  getAllVehicules(): Vehicule[] {
    return this.catalogService.getAllVehicules();
  }

  /**
   * GET /api/catalog/armes
   *
   * Retourne toutes les armes du catalogue (base, avancée, équipage, largable).
   */
  @Get('armes')
  getAllArmes(): Arme[] {
    return this.catalogService.getAllArmes();
  }

  /**
   * GET /api/catalog/ameliorations
   *
   * Retourne toutes les améliorations de véhicule du catalogue.
   * Note : le champ `prix` peut être un nombre (Jerricans) ou "x3" (Tourelle).
   */
  @Get('ameliorations')
  getAllAmeliorations(): Amelioration[] {
    return this.catalogService.getAllAmeliorations();
  }
}
