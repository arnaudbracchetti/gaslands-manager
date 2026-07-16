import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../shared/icon/icon';

// standalone: true = ce composant n'appartient à aucun NgModule
// C'est la nouvelle approche recommandée depuis Angular 14
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {}
