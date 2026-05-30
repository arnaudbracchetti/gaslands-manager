import { Component } from '@angular/core';

@Component({
  selector: 'app-weapons',
  standalone: true,
  template: `
    <div class="page-placeholder">
      <h1>💣 Armes</h1>
      <p>L'arsenal sera disponible prochainement.</p>
    </div>
  `,
  styles: [`
    .page-placeholder {
      padding: 60px 20px;
      text-align: center;
      color: white;
      h1 { color: #e94560; font-size: 2rem; margin-bottom: 1rem; }
      p { opacity: 0.7; }
    }
  `],
})
export class Weapons {}
