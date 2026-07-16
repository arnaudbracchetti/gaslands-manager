import { Controller, Get, Param } from '@nestjs/common';
import { ContentService } from './content.service';
import { DocChapter, DocsService } from './docs.service';

// @Controller('content') définit le préfixe de toutes les routes de ce contrôleur
// Combiné au préfixe global 'api', les routes seront : /api/content/...
@Controller('content')
export class ContentController {
  // Injection de dépendance : NestJS fournit automatiquement une instance de chaque service
  constructor(
    private readonly contentService: ContentService,
    private readonly docsService: DocsService,
  ) {}

  // ⚠️ Les deux routes /docs ci-dessous DOIVENT être déclarées avant la route
  // générique ':slug' plus bas — sinon NestJS matche ':slug' en premier et
  // capture "docs" comme valeur de slug (même piège que documenté pour
  // campaign.controller.ts, cf. docs/spec/CAMPAIGN.md).

  // GET /api/content/docs → sommaire ordonné de la documentation utilisateur
  @Get('docs')
  listDocs(): DocChapter[] {
    return this.docsService.listChapters();
  }

  // GET /api/content/docs/equipes → contenu HTML d'un chapitre de documentation
  @Get('docs/:slug')
  getDoc(@Param('slug') slug: string): Promise<{ html: string; title: string }> {
    return this.docsService.getChapter(slug);
  }

  // GET /api/content → liste tous les slugs disponibles
  // Exemple de réponse : ["vehicules", "armes"]
  @Get()
  // string[] : tableau de noms de fichiers sans l'extension .md
  listContent(): string[] {
    return this.contentService.listContent();
  }

  // GET /api/content/vehicules → retourne le contenu HTML de vehicules.md
  // @Param('slug') extrait la partie dynamique de l'URL
  @Get(':slug')
  // Promise<{html, title}> : async car marked() est une promesse.
  getContent(@Param('slug') slug: string): Promise<{ html: string; title: string }> {
    return this.contentService.getContent(slug);
  }
}
