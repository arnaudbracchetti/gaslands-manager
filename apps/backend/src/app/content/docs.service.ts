import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parse } from 'yaml';
import { marked } from 'marked';
import * as fs from 'fs';
import * as path from 'path';

// Une entrée du sommaire — ordre canonique lu depuis manifest.yml.
export interface DocChapter {
  slug: string;
  title: string;
}

/**
 * DocsService — documentation utilisateur (content/docs/*.md).
 *
 * Même famille que CatalogService/ContentService (cf. ARCHITECTURE.md §3.3) :
 * l'ORDRE des chapitres (manifest.yml) est chargé une seule fois au démarrage
 * (OnModuleInit) et gardé en mémoire — c'est une donnée structurelle, stable.
 * Le CONTENU de chaque chapitre, lui, est relu et reconverti à chaque requête
 * (comme ContentService.getContent) : on veut pouvoir corriger une phrase de
 * documentation sans redémarrer le backend.
 */
@Injectable()
export class DocsService implements OnModuleInit {
  private readonly logger: Logger = new Logger(DocsService.name);
  private readonly docsDir: string;

  // Assigné une seule fois par onModuleInit, puis seulement lu.
  private chapters: DocChapter[] = [];

  constructor(private config: ConfigService) {
    // Même racine que ContentService (CONTENT_DIR, défaut "content"),
    // sous-dossier docs/ dédié à cette documentation.
    this.docsDir = path.resolve(
      process.cwd(),
      this.config.get('CONTENT_DIR', 'content'),
      'docs',
    );
  }

  onModuleInit(): void {
    this.logger.log('Chargement du sommaire de la documentation utilisateur...');
    const raw = this.readFileContent('manifest.yml');
    this.chapters = parse(raw) as DocChapter[];
    this.logger.log(`Documentation utilisateur chargée : ${this.chapters.length} chapitres.`);
  }

  // Sommaire ordonné — pour /documentation (liste des chapitres).
  listChapters(): DocChapter[] {
    return this.chapters;
  }

  // Un chapitre (ou l'intro "index") — relu à chaque appel, cf. commentaire de classe.
  async getChapter(slug: string): Promise<{ html: string; title: string }> {
    let markdown: string;
    try {
      // Passe par readFileContent (pas fs directement) pour rester substituable
      // en test, comme le chargement du manifest dans onModuleInit.
      markdown = this.readFileContent(`${slug}.md`);
    } catch {
      throw new NotFoundException(
        `Le chapitre de documentation "${slug}" n'existe pas.`,
      );
    }

    const html = await marked(markdown);
    const titleMatch = markdown.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1] : slug;

    return { html: this.withHeadingIds(html), title };
  }

  /**
   * Ajoute un id slugifié à chaque titre du HTML rendu — nécessaire pour les
   * ancres internes (#section) : `marked` (v18) ne génère plus d'id sur les
   * titres depuis sa v5 (option `headerIds` retirée du cœur). Post-traitement
   * du HTML plutôt qu'un renderer `marked` personnalisé : plus simple, et
   * strictement local à cette classe (n'affecte pas ContentService/CatalogService,
   * qui utilisent la même fonction `marked` globale sans ce post-traitement).
   */
  private withHeadingIds(html: string): string {
    return html.replace(
      /<(h[1-6])>(.*?)<\/\1>/g,
      (match: string, tag: string, innerHtml: string): string =>
        `<${tag} id="${this.slugify(innerHtml)}">${innerHtml}</${tag}>`,
    );
  }

  // Retire les balises HTML éventuelles (ex. <strong>) puis les accents, pour un id lisible.
  private slugify(headingHtml: string): string {
    return headingHtml
      .replace(/<[^>]+>/g, '')
      .normalize('NFD')
      // Les accents français (é, è, à...) se décomposent en lettre nue +
      // diacritique combinant après normalize('NFD') — \p{Diacritic} (propriété
      // Unicode, flag /u) les retire proprement, sans lister de plage de codes
      // points à la main.
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Lit le contenu brut d'un fichier de content/docs/.
   *
   * Protected : surcharger cette méthode dans les sous-classes de test permet
   * de fournir des données fictives sans toucher au système de fichiers — même
   * pattern Template Method que CatalogService.readFileContent.
   */
  protected readFileContent(filename: string): string {
    const filePath = path.join(this.docsDir, filename);
    return fs.readFileSync(filePath, 'utf-8');
  }
}
