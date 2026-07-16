import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Breadcrumb, BreadcrumbItem } from '../../shared/breadcrumb/breadcrumb';
import { Icon } from '../../shared/icon/icon';
import { DocLinksDirective } from '../doc-links.directive';

/**
 * Un chapitre de la documentation utilisateur (/documentation/:slug).
 *
 * S'abonne à route.paramMap (pas route.snapshot.params) : Angular réutilise
 * cette même instance de composant quand on navigue d'un chapitre à un autre
 * (même route paramétrée, cf. DocLinksDirective) — un simple snapshot lu une
 * fois dans ngOnInit ne verrait jamais le changement de :slug.
 */
@Component({
  selector: 'app-documentation-chapter',
  standalone: true,
  imports: [Icon, DocLinksDirective, Breadcrumb],
  templateUrl: './documentation-chapter.html',
  styleUrl: './documentation-chapter.scss',
})
export class DocumentationChapter implements OnInit {
  private http: HttpClient = inject(HttpClient);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private sanitizer: DomSanitizer = inject(DomSanitizer);

  loading: WritableSignal<boolean> = signal(true);
  // SafeHtml (pas string) : Angular sanitise [innerHTML] par défaut et retire
  // silencieusement les attributs id des titres (nécessaires aux ancres, cf.
  // DocsService.withHeadingIds) sans lever d'erreur — bypassSecurityTrustHtml
  // est nécessaire, comme sponsor-carousel.ts pour un contenu interne
  // équivalent (jamais saisi par l'utilisateur, donc sans risque XSS).
  html: WritableSignal<SafeHtml | null> = signal(null);
  title: WritableSignal<string> = signal('');
  error: WritableSignal<string> = signal('');

  // Dépend du titre chargé (contrairement au sommaire de Documentation,
  // statique) : '…' tant qu'il n'est pas encore connu, même convention que
  // AtelierVehiclePage.breadcrumbs pour son dernier maillon.
  breadcrumbs: Signal<BreadcrumbItem[]> = computed((): BreadcrumbItem[] => [
    { label: 'Documentation', route: ['/documentation'] },
    { label: this.title() || '…' },
  ]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params: ParamMap): void => {
      const slug = params.get('slug');
      if (slug) {
        this.loadChapter(slug);
      }
    });
  }

  private loadChapter(slug: string): void {
    this.loading.set(true);
    this.error.set('');

    this.http.get<{ html: string; title: string }>(`/api/content/docs/${slug}`).subscribe({
      next: (data: { html: string; title: string }): void => {
        this.html.set(this.sanitizer.bypassSecurityTrustHtml(data.html));
        this.title.set(data.title);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse): void => {
        this.error.set('Ce chapitre de documentation est introuvable.');
        this.loading.set(false);
        console.error(err);
      },
    });
  }
}
