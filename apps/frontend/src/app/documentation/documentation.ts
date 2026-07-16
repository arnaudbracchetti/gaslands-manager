import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Breadcrumb, BreadcrumbItem } from '../shared/breadcrumb/breadcrumb';
import { Icon } from '../shared/icon/icon';
import { DocLinksDirective } from './doc-links.directive';

// Miroir du DocChapter backend (docs.service.ts) — pas de modèle partagé
// entre front et back dans ce monorepo, cf. ARCHITECTURE.md §1.
interface DocChapter {
  slug: string;
  title: string;
}

/**
 * Sommaire de la documentation utilisateur (/documentation).
 *
 * Affiche l'intro (content/docs/index.md, HTML brut) puis la liste des
 * chapitres — cette liste est rendue PROGRAMMATIQUEMENT depuis le manifest
 * (GET /api/content/docs), jamais codée en dur dans index.md : une seule
 * source de vérité pour l'ordre et les titres, qui ne peut pas dériver d'un
 * texte maintenu séparément à la main.
 */
@Component({
  selector: 'app-documentation',
  standalone: true,
  imports: [RouterLink, Icon, DocLinksDirective, Breadcrumb],
  templateUrl: './documentation.html',
  styleUrl: './documentation.scss',
})
export class Documentation implements OnInit {
  private http: HttpClient = inject(HttpClient);
  private sanitizer: DomSanitizer = inject(DomSanitizer);

  loading: WritableSignal<boolean> = signal(true);
  // SafeHtml (pas string) : Angular sanitise [innerHTML] par défaut et retire
  // silencieusement les attributs id des titres (nécessaires aux ancres, cf.
  // DocsService.withHeadingIds) sans lever d'erreur — bypassSecurityTrustHtml
  // est nécessaire, comme sponsor-carousel.ts pour un contenu interne
  // équivalent (jamais saisi par l'utilisateur, donc sans risque XSS).
  html: WritableSignal<SafeHtml | null> = signal(null);
  chapters: WritableSignal<DocChapter[]> = signal([]);
  error: WritableSignal<string> = signal('');

  // Sommaire = racine de la section documentation, jamais dynamique — pas
  // besoin de computed() ici, contrairement à DocumentationChapter dont le
  // dernier maillon dépend du titre chargé.
  breadcrumbs: BreadcrumbItem[] = [{ label: 'Documentation' }];

  ngOnInit(): void {
    this.http.get<{ html: string; title: string }>('/api/content/docs/index').subscribe({
      next: (data: { html: string; title: string }): void => {
        this.html.set(this.sanitizer.bypassSecurityTrustHtml(data.html));
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse): void => {
        this.error.set('Impossible de charger la documentation. Vérifiez que le backend est démarré.');
        this.loading.set(false);
        console.error(err);
      },
    });

    // Chargement indépendant et non bloquant : si /docs échoue, l'intro
    // reste affichée sans la liste des chapitres (même pattern que
    // CampaignDetail.standings, cf. docs/COMPONENTS.md).
    this.http.get<DocChapter[]>('/api/content/docs').subscribe({
      next: (data: DocChapter[]): void => this.chapters.set(data),
      error: (err: HttpErrorResponse): void => console.error(err),
    });
  }
}
