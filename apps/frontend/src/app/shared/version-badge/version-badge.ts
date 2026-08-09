import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface VersionResponse {
  version: string | null;
}

/**
 * Badge affichant la version actuellement déployée (IMAGE_TAG, lu par le
 * backend via process.env — GET /api/version). Composant autonome plutôt
 * qu'intégré à App : isole le fetch et son échec silencieux d'un simple
 * repère cosmétique, sans alourdir le composant racine.
 */
@Component({
  selector: 'app-version-badge',
  templateUrl: './version-badge.html',
  styleUrl: './version-badge.scss',
})
export class VersionBadge implements OnInit {
  private readonly http: HttpClient = inject(HttpClient);

  // null tant que non résolu, si /api/version échoue, ou si IMAGE_TAG
  // n'est pas renseigné côté serveur — dans tous ces cas, rien n'est affiché.
  version: WritableSignal<string | null> = signal(null);

  ngOnInit(): void {
    this.http.get<VersionResponse>('/api/version').subscribe({
      next: (res: VersionResponse): void => this.version.set(res.version),
      error: (): void => {
        // Échec silencieux (API indisponible) — jamais d'erreur visible
        // pour un simple repère cosmétique.
      },
    });
  }
}
