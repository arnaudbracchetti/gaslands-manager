import { Controller, Get, Param } from '@nestjs/common';
import { ContentService } from './content.service';

// @Controller('content') définit le préfixe de toutes les routes de ce contrôleur
// Combiné au préfixe global 'api', les routes seront : /api/content/...
@Controller('content')
export class ContentController {
  // Injection de dépendance : NestJS fournit automatiquement une instance de ContentService
  constructor(private readonly contentService: ContentService) {}

  // GET /api/content → liste tous les slugs disponibles
  // Exemple de réponse : ["regles", "vehicules", "armes"]
  @Get()
  listContent() {
    return this.contentService.listContent();
  }

  // GET /api/content/regles → retourne le contenu HTML de regles.md
  // @Param('slug') extrait la partie dynamique de l'URL
  @Get(':slug')
  getContent(@Param('slug') slug: string) {
    return this.contentService.getContent(slug);
  }
}
