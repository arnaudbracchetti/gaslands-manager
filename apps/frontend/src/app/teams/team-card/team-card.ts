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
import { Component, InputSignal, OutputEmitterRef, input, output } from '@angular/core';
import { Team } from '../team.model';
import { TeamVehiclePair, VehicleSummary } from '../vehicle-summary';

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
   * InputSignal<T> : type retourné par input.required<T>() (lecture seule).
   */
  team: InputSignal<Team> = input.required<Team>();

  /**
   * Résumés des véhicules de l'équipe — chacun avec son nom (résolu depuis le
   * catalogue) et son coût total en jerricans (cf. `VehicleSummary`, doc complète
   * dans `vehicle-summary.ts`).
   *
   * `input()` simple (PAS `input.required`) avec une valeur par défaut `[]` :
   * contrairement à `team`, cette donnée est secondaire et son absence est un
   * état parfaitement normal — équipe sans véhicule, ou résumé pas encore chargé
   * par `Teams` (cf. doc de `Teams.vehicleSummaries`, "chargement asynchrone").
   * `TeamCard` reste un composant "dumb" : il affiche ce qu'on lui donne, sans
   * savoir POURQUOI la liste est vide ni QUAND elle se peuplera.
   */
  vehicles: InputSignal<VehicleSummary[]> = input<VehicleSummary[]>([]);

  /**
   * Émis quand l'utilisateur clique sur "Modifier".
   * Le parent reçoit l'équipe concernée et ouvre le formulaire d'édition.
   * OutputEmitterRef<T> : type retourné par output<T>().
   */
  editClicked: OutputEmitterRef<Team> = output<Team>();

  /**
   * Émis quand l'utilisateur clique sur "Supprimer".
   * Le parent gère la confirmation et l'appel à l'API.
   */
  deleteClicked: OutputEmitterRef<Team> = output<Team>();

  /**
   * Émis quand l'utilisateur clique sur "Ajouter un véhicule".
   * Le parent (`Teams`) ouvre la modale de construction (`VehicleBuilder`)
   * pour cette équipe — cf. `Teams.openVehicleBuilder`.
   *
   * Toujours visible, sans condition : toute équipe a un sponsor dès sa
   * création (`sponsor` a une valeur par défaut, cf. `Team`/SPECIFICATION.md
   * §5), donc l'ajout de véhicules est toujours possible. `TeamCard` ignore
   * délibérément la mécanique de verrouillage du sponsor (`vehicleCount`,
   * cf. `SponsorCarousel`/`TeamForm`) — ce n'est pas son rôle de "dumb"
   * component d'en connaître la raison, juste de signaler l'intention.
   */
  addVehicleClicked: OutputEmitterRef<Team> = output<Team>();

  /**
   * Émis quand l'utilisateur clique sur "Modifier" pour UN véhicule de la liste.
   * Le parent (`Teams`) ouvre `VehicleEditor` pour cette paire (équipe, véhicule)
   * — cf. `Teams.openVehicleEditor`.
   *
   * Porte une `TeamVehiclePair` plutôt que le seul `VehicleSummary` : `TeamCard`
   * est la SEULE à connaître les deux moitiés à cet instant (elle reçoit `team`
   * en input ET itère sur `vehicles()`) — cf. doc de `TeamVehiclePair` pour le
   * raisonnement complet sur ce choix d'assemblage.
   */
  editVehicleClicked: OutputEmitterRef<TeamVehiclePair> = output<TeamVehiclePair>();

  /**
   * Émis quand l'utilisateur clique sur "Supprimer" pour UN véhicule de la liste.
   * Le parent gère la confirmation (`window.confirm`, mirroir de `deleteClicked`
   * sur l'équipe entière) et l'appel à l'API — cf. `Teams.deleteVehicle`.
   */
  deleteVehicleClicked: OutputEmitterRef<TeamVehiclePair> = output<TeamVehiclePair>();
}
