/**
 * VehicleConfigurator — composant "smart" UNIQUE de configuration d'un véhicule.
 *
 * Fusion de `VehicleBuilder` et `VehicleEditor` (cf. plan, partie "Et en creusant
 * encore — la duplication ne s'arrête pas à l'équipement") : une fois la gestion
 * d'équipement extraite dans `EquipmentManager`, il ne restait dans ces deux
 * composants que (1) la façon d'OBTENIR le `Vehicle` de départ — le créer, ou
 * charger un véhicule existant — et (2) une coquille de modale quasi identique
 * (un bouton de fin, un `output<void>()`, traités EXACTEMENT pareil par `Teams`).
 * Avoir deux composants — et deux signaux, deux paires open/close, deux blocs de
 * template — pour cette seule différence n'était pas justifié : ce n'est pas une
 * différence de NATURE, c'est une différence de SOURCE pour la même donnée.
 *
 * Vit dans une `Modal` (projeté via `<ng-content>`, cf. `Teams.html`). Reçoit
 * l'équipe (`team`, toujours nécessaire) et un `vehicleId` OPTIONNEL :
 *   - `vehicleId` ABSENT/`null` ⇒ MODE CRÉATION : affiche le choix du véhicule
 *     parmi ceux autorisés par le sponsor ; persistance IMMÉDIATE dès le choix
 *     (`vehicleService.create` — un véhicule "nu" reste un véhicule valide en
 *     Gaslands), puis bascule naturellement vers la gestion d'équipement.
 *   - `vehicleId` RENSEIGNÉ ⇒ MODE ÉDITION : charge directement ce véhicule
 *     existant (mirroir de l'ex-`VehicleEditor.loadVehicleAndCatalog` —
 *     `getAllForTeam` + `.find()`, seule façon d'obtenir l'entité BRUTE par id,
 *     `GET /api/vehicles/:id` renvoyant un DTO "monté" sans tableaux bruts).
 *
 * Dans les DEUX cas, dès que `vehicle()` devient non-nul, la SEULE ET MÊME
 * section d'équipement (`<app-equipment-manager>`) s'affiche — code rigoureusement
 * identique, donc plus aucune divergence possible entre création et édition.
 * Le bouton de fin change seulement de LIBELLÉ ("Terminer"/"Fermer") selon le
 * mode — `done` est émis dans les deux cas avec le même sens : "j'ai terminé,
 * ferme et recharge" (`Teams.closeVehicleModal` recharge systématiquement,
 * cf. son en-tête : coûts/équipement ont pu changer dans tous les cas).
 *
 * Fermeture à mi-parcours ACCEPTÉE (héritage du builder, cf. ex-en-tête,
 * "Décisions actées" §3) : `Teams` recharge la liste dans tous les cas
 * (`closeRequested` ET `done`) pour rafraîchir `vehicleCount`.
 */
import {
  Component,
  InputSignal,
  OnInit,
  OutputEmitterRef,
  Signal,
  WritableSignal,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
// HttpErrorResponse : type Angular pour les erreurs HTTP — `err.error?.message`
// extrait le corps JSON de la réponse d'erreur (cf. `register.ts`/`login.ts`,
// même convention pour lire le message porté par une `BadRequestException`).
import { HttpErrorResponse } from '@angular/common/http';
import { Team } from '../team.model';
import { CatalogService } from '../../catalog/catalog.service';
import { Sponsor, Vehicule } from '../../catalog/catalog.model';
import { VehicleService } from './vehicle.service';
import { Vehicle } from './vehicle-builder.model';
import { VehicleChoiceCard } from './vehicle-choice-card/vehicle-choice-card';
import { EquipmentManager } from './equipment-manager/equipment-manager';

@Component({
  selector: 'app-vehicle-configurator',
  standalone: true,
  imports: [VehicleChoiceCard, EquipmentManager],
  templateUrl: './vehicle-configurator.html',
  styleUrl: './vehicle-configurator.scss',
})
export class VehicleConfigurator implements OnInit {
  private catalogService: CatalogService = inject(CatalogService);
  private vehicleService: VehicleService = inject(VehicleService);

  // ── Inputs / Outputs ────────────────────────────────────────────────────────

  /** L'équipe concernée — fournit le sponsor (filtre catalogue) et l'id (création/rechargement). */
  team: InputSignal<Team> = input.required<Team>();

  /**
   * `null`/absent ⇒ mode CRÉATION (choisir puis créer un nouveau véhicule) ;
   * renseigné ⇒ mode ÉDITION (charger directement ce véhicule existant, sans
   * étape de choix — "revenir choisir un autre véhicule" n'aurait aucun sens
   * une fois le véhicule persisté). C'est ce SEUL paramètre qui distingue
   * désormais les deux anciens composants — cf. en-tête, raisonnement complet.
   */
  vehicleId: InputSignal<number | null> = input<number | null>(null);

  /**
   * Émis quand l'utilisateur a terminé (bouton "Terminer"/"Fermer" — fusion de
   * `finished`/`closed`, déjà traités identiquement par `Teams` : `set(null)` +
   * `loadTeams()`). `void` : seule l'intention de fermer compte.
   */
  done: OutputEmitterRef<void> = output<void>();

  // ── Catalogue du sponsor (chargé une fois, sert aux deux modes) ─────────────

  /**
   * Catalogue complet et déjà filtré du sponsor de l'équipe (`vehicules`/`armes`/
   * `ameliorations` autorisés — cf. `CatalogService.getSponsorByName`, doc).
   * `null` tant qu'il n'est pas chargé — toute la suite attend cette valeur.
   */
  sponsorCatalog: WritableSignal<Sponsor | null> = signal<Sponsor | null>(null);
  loadingCatalog: WritableSignal<boolean> = signal(true);
  catalogError: WritableSignal<string> = signal('');

  // ── Le véhicule géré — créé (mode création) OU chargé (mode édition) ────────

  /**
   * Le véhicule à équiper (entité BRUTE — `improvements`/`weapons` toujours des
   * tableaux, cf. `vehicle-builder.model.ts`, doc de `Vehicle`). `null` :
   *   - en mode création, tant que l'utilisateur n'a pas encore choisi (le
   *     template affiche alors la grille de choix) ;
   *   - en mode édition, tant que le chargement n'est pas terminé, OU si l'id
   *     reçu ne correspond à aucun véhicule de l'équipe (incohérence — cf. `error`).
   * C'est la présence/absence de cette valeur qui pilote tout l'affichage —
   * pas besoin d'un `step`/stepper séparé (cf. en-tête, "la coquille disparaît").
   */
  vehicle: WritableSignal<Vehicle | null> = signal<Vehicle | null>(null);

  loadingVehicle: WritableSignal<boolean> = signal(false);
  creatingVehicle: WritableSignal<boolean> = signal(false);
  error: WritableSignal<string> = signal('');

  // ── Affichage du véhicule choisi/géré (computed, partagé par les deux modes) ─

  /**
   * Libellé du bouton de fin — "Terminer" en création (fin normale du flux de
   * construction), "Fermer" en édition (on referme simplement la modale de
   * gestion). Seule différence visuelle restante entre les deux modes.
   */
  doneButtonLabel: Signal<string> = computed((): string => {
    return this.vehicleId() === null ? 'Terminer' : 'Fermer';
  });

  // ── Cycle de vie ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadSponsorCatalog();

    const id = this.vehicleId();
    if (id !== null) {
      // Mode édition : on charge directement le véhicule visé — `vehicle` reste
      // `null` jusque-là (template : indicateur de chargement dédié, cf. `loadingVehicle`).
      this.loadExistingVehicle(id);
    }
    // Sinon (mode création) : `vehicle` reste `null`, le template affiche la
    // grille de choix dès que le catalogue est prêt.
  }

  // ── Chargement du catalogue (sert aux deux modes) ───────────────────────────

  /**
   * Charge le catalogue COMPLET du sponsor de l'équipe. Une seule requête pour
   * tout le composant : le choix a besoin de `vehicules`, l'équipement de
   * `armes`/`ameliorations` (transmis tel quel à `EquipmentManager`).
   */
  private loadSponsorCatalog(): void {
    this.loadingCatalog.set(true);
    this.catalogError.set('');

    this.catalogService.getSponsorByName(this.team().sponsor).subscribe({
      next: (sponsor: Sponsor): void => {
        this.sponsorCatalog.set(sponsor);
        this.loadingCatalog.set(false);
      },
      error: (): void => {
        this.catalogError.set('Impossible de charger le catalogue du sponsor. Réessayez.');
        this.loadingCatalog.set(false);
      },
    });
  }

  // ── Mode création : choix et persistance immédiate du véhicule ───────────────

  /**
   * L'utilisateur a choisi un véhicule — persistance IMMÉDIATE (cf. en-tête,
   * "Décisions actées" héritées du builder) : on crée l'entité en base dès ce
   * choix, ce qui bascule naturellement vers la section équipement dès que
   * `vehicle()` devient non-nul (cf. template).
   */
  selectVehicle(vehicule: Vehicule): void {
    this.creatingVehicle.set(true);
    this.error.set('');

    this.vehicleService.create(this.team().id, { nomInterne: vehicule.nom_interne }).subscribe({
      next: (created: Vehicle): void => {
        this.vehicle.set(created);
        this.creatingVehicle.set(false);
      },
      error: (err: HttpErrorResponse): void => {
        this.error.set(err.error?.message ?? 'Impossible de créer ce véhicule. Réessayez.');
        this.creatingVehicle.set(false);
      },
    });
  }

  // ── Mode édition : chargement direct d'un véhicule existant ──────────────────

  /**
   * Charge les véhicules bruts de l'équipe et isole celui visé par `id` —
   * mirroir de l'ex-`VehicleEditor.loadVehicleAndCatalog` (cf. son en-tête,
   * "Différence structurelle" : aucun endpoint ne renvoie directement un
   * `Vehicle` brut par id, `GET /api/vehicles/:id` renvoyant un DTO "monté" sans
   * `improvements[]`/`weapons[]` bruts — on réutilise donc `getAllForTeam` +
   * `.find()`, exactement comme `Teams.loadVehicleSummaries`).
   *
   * Chargement INDÉPENDANT du catalogue (contrairement à l'ex-éditeur qui les
   * combinait via `forkJoin`) : ce composant a de toute façon besoin du
   * catalogue pour le MODE CRÉATION aussi — `loadSponsorCatalog` est donc déjà
   * lancé inconditionnellement par `ngOnInit`, pas la peine de le dupliquer ici.
   */
  private loadExistingVehicle(id: number): void {
    this.loadingVehicle.set(true);
    this.error.set('');

    this.vehicleService.getAllForTeam(this.team().id).subscribe({
      next: (vehicles: Vehicle[]): void => {
        const found = vehicles.find((v: Vehicle): boolean => v.id === id) ?? null;
        this.vehicle.set(found);
        this.loadingVehicle.set(false);

        if (!found) {
          // Incohérence (id obsolète — véhicule supprimé entre-temps par exemple) :
          // on signale plutôt que d'afficher un composant vide et silencieux.
          this.error.set('Ce véhicule est introuvable — il a peut-être été supprimé entre-temps.');
        }
      },
      error: (): void => {
        this.error.set('Impossible de charger ce véhicule. Réessayez.');
        this.loadingVehicle.set(false);
      },
    });
  }

  // ── Fin du flux ──────────────────────────────────────────────────────────────

  /** L'utilisateur a terminé — `Teams` ferme la modale et recharge la liste (`vehicleCount`/coûts). */
  finish(): void {
    this.done.emit();
  }
}
