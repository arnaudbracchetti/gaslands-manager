import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// standalone: true = ce composant n'appartient à aucun NgModule
// C'est la nouvelle approche recommandée depuis Angular 14
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {}
