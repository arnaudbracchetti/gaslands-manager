/**
 * Composant TeamCard — affiche une seule équipe Gaslands en lecture.
 *
 * C'est un composant "dumb" (ou "presentational") : il ne connaît pas
 * le service, ne fait pas de requêtes HTTP, ne gère pas d'état global.
 * Il reçoit des données via input() et signale les actions via output().
 *
 * Ce découpage permet de :
 * - Tester la carte indépendamment du reste de l'écran
 * - Réutiliser la carte dans d'autres contextes (ex: dashboard)
 * - Garder le composant parent Teams concentré sur l'orchestration
 *
 * Pattern Angular 17+ : input() / output() (API Signals)
 */
import { Component, input, output } from '@angular/core';
import { Team } from '../team.model';

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [],
  templateUrl: './team-card.html',
  styleUrl: './team-card.scss',
})
export class TeamCard {
  /**
   * L'équipe à afficher.
   * input.required<T>() garantit que le parent doit toujours fournir
   * cette valeur — Angular lance une erreur si elle est absente.
   */
  team = input.required<Team>();

  /**
   * Émis quand l'utilisateur clique sur "Modifier".
   * Le parent reçoit l'équipe concernée et ouvre le formulaire d'édition.
   */
  editClicked = output<Team>();

  /**
   * Émis quand l'utilisateur clique sur "Supprimer".
   * Le parent gère la confirmation et l'appel à l'API.
   */
  deleteClicked = output<Team>();
}
