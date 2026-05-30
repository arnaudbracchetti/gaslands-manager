import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// ── Qu'est-ce qu'un Signal ? ────────────────────────────────
// Un signal est un conteneur de valeur réactif : quand sa valeur
// change (via .set() ou .update()), Angular sait exactement quel
// composant doit être re-rendu, sans avoir besoin de zone.js.
//
// Ancien modèle (zone.js) :  propriété classique  →  zone.js détecte le changement
// Nouveau modèle (signals) :  signal()  →  Angular est notifié directement
// ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-rules',
  standalone: true,
  // Avec les signals et la nouvelle syntaxe @if/@for, CommonModule
  // n'est plus nécessaire — tout est intégré dans Angular core.
  imports: [],
  templateUrl: './rules.html',
  styleUrl: './rules.scss',
})
export class Rules implements OnInit {
  private http = inject(HttpClient);

  // signal<T>(valeurInitiale) crée un signal typé.
  // La valeur initiale est celle affichée avant que l'HTTP réponde.
  loading = signal(true);
  html    = signal('');
  title   = signal('');
  error   = signal('');

  ngOnInit() {
    this.http.get<{ html: string; title: string }>('/api/content/regles').subscribe({
      next: (data) => {
        // .set() remplace la valeur du signal et notifie Angular
        // → le template est re-rendu immédiatement
        this.html.set(data.html);
        this.title.set(data.title);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Impossible de charger les règles. Vérifiez que le backend est démarré.');
        this.loading.set(false);
        console.error(err);
      },
    });
  }
}
