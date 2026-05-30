import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { marked } from 'marked';

// @Injectable() permet à NestJS d'injecter ce service dans d'autres classes (Dependency Injection)
@Injectable()
export class ContentService {
  private readonly contentDir: string;

  constructor(private config: ConfigService) {
    // Résoudre le chemin absolu vers le dossier content/
    // process.cwd() retourne le répertoire racine du workspace (gaslands/)
    this.contentDir = path.resolve(
      process.cwd(),
      this.config.get('CONTENT_DIR', 'content'),
    );
  }

  // Retourne la liste de tous les slugs disponibles (noms de fichiers sans .md)
  listContent(): string[] {
    if (!fs.existsSync(this.contentDir)) {
      return [];
    }
    return fs
      .readdirSync(this.contentDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace('.md', ''));
  }

  // Lit un fichier .md et retourne son contenu converti en HTML
  async getContent(slug: string): Promise<{ html: string; title: string }> {
    const filePath = path.join(this.contentDir, `${slug}.md`);

    if (!fs.existsSync(filePath)) {
      // NestJS transforme automatiquement cette exception en réponse HTTP 404
      throw new NotFoundException(
        `Le contenu "${slug}" n'existe pas. Vérifiez que le fichier ${slug}.md est dans le dossier content/.`,
      );
    }

    const markdown = fs.readFileSync(filePath, 'utf-8');

    // marked() convertit le Markdown en HTML
    // Exemple : "# Titre" → "<h1>Titre</h1>"
    const html = await marked(markdown);

    // Extraire le titre du premier heading # du document
    const titleMatch = markdown.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1] : slug;

    return { html, title };
  }
}
