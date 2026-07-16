/**
 * Tests unitaires pour DocsService.
 *
 * Stratégie de mock (Pattern Template Method, cf. catalog.service.spec.ts) :
 * TestDocsService surcharge readFileContent() pour retourner des fichiers
 * fictifs au lieu de lire content/docs/ sur le disque — un seul point de
 * substitution couvre à la fois le chargement du manifest (onModuleInit) et
 * la lecture d'un chapitre (getChapter), puisque les deux passent par cette
 * même méthode.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocsService } from './docs.service';

const MOCK_FILES: Record<string, string> = {
  'manifest.yml': `
- slug: equipes
  title: Équipes
- slug: campagnes
  title: Campagnes
`,
  'equipes.md': `# Équipes

## Avantages

Texte de test avec un [lien](/documentation/campagnes).
`,
  'index.md': `# Documentation

Texte d'intro.
`,
};

class TestDocsService extends DocsService {
  protected override readFileContent(filename: string): string {
    const content = MOCK_FILES[filename];
    if (content === undefined) {
      // Simule fs.readFileSync qui lève quand le fichier n'existe pas —
      // getChapter() attrape cette erreur et la traduit en NotFoundException.
      throw new Error(`ENOENT (fixture de test) : ${filename}`);
    }
    return content;
  }
}

describe('DocsService', () => {
  let service: TestDocsService;

  beforeEach(() => {
    const mockConfig = { get: vi.fn().mockReturnValue('content') };
    service = new TestDocsService(mockConfig as never);
    service.onModuleInit();
  });

  it('charge le sommaire depuis manifest.yml, dans son ordre', () => {
    expect(service.listChapters()).toEqual([
      { slug: 'equipes', title: 'Équipes' },
      { slug: 'campagnes', title: 'Campagnes' },
    ]);
  });

  it("retourne le HTML et le titre d'un chapitre", async () => {
    const { html, title } = await service.getChapter('equipes');

    expect(title).toBe('Équipes');
    expect(html).toContain('<p>Texte de test');
  });

  it('ajoute un id slugifié (accents retirés) sur chaque titre, pour les ancres internes', async () => {
    const { html } = await service.getChapter('equipes');

    expect(html).toContain('<h1 id="equipes">Équipes</h1>');
    expect(html).toContain('<h2 id="avantages">Avantages</h2>');
  });

  it("lève une NotFoundException si le chapitre n'existe pas", async () => {
    await expect(service.getChapter('inconnu')).rejects.toThrow(
      /n'existe pas/,
    );
  });

  it("lit l'intro (index) comme un chapitre normal, hors sommaire", async () => {
    const { title } = await service.getChapter('index');

    expect(title).toBe('Documentation');
    expect(service.listChapters().some((c) => c.slug === 'index')).toBe(false);
  });
});
