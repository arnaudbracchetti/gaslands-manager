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
import { buildVehicleSummary } from '../vehicle-summary';
import { EQUIPMENT_DATA_SOURCE, BudgetView } from './equipment-data-source';
import { TeamEquipmentDataSource } from './team-equipment.datasource';
import { VehicleChoiceCard } from './vehicle-choice-card/vehicle-choice-card';
import { EquipmentManager } from './equipment-manager/equipment-manager';

@Component({
  selector: 'app-vehicle-configurator',
  standalone: true,
  imports: [VehicleChoiceCard, EquipmentManager],
  // Câblage de l'abstraction pour ce contexte : le configurateur d'équipe fournit
  // l'implémentation "construction d'équipe" de la source de données ; `EquipmentManager`
  // (enfant) la reçoit via le token, sans savoir laquelle (cf. `EquipmentDataSource`).
  providers: [
    TeamEquipmentDataSource,
    { provide: EQUIPMENT_DATA_SOURCE, useExisting: TeamEquipmentDataSource },
  ],
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

  /**
   * Tous les véhicules de l'équipe — chargés une fois pour calculer le budget
   * transmis à `EquipmentManager` (coût des AUTRES véhicules). En mode édition, sert
   * aussi à isoler le véhicule visé (`vehicle`). Échec silencieux en création (le
   * budget est informatif, ne bloque pas la construction).
   */
  allTeamVehicles: WritableSignal<Vehicle[]> = signal<Vehicle[]>([]);

  /**
   * Budget passé à `EquipmentManager` (cf. `BudgetView`) : total = jerricans de
   * l'équipe ; usedByOthers = coût cumulé des autres véhicules (tous sauf celui en
   * cours). Le coût du véhicule courant est ajouté par `EquipmentManager` lui-même
   * (`coutTotal`) — on l'EXCLUT donc ici via `v.id !== currentId`. Calcul repris de
   * l'ancien `EquipmentManager.loadCoutAutresVehicules` (même `buildVehicleSummary`).
   */
  budget: Signal<BudgetView> = computed((): BudgetView => {
    const catalog = this.sponsorCatalog();
    const currentId = this.vehicle()?.id ?? null;
    const usedByOthers = catalog
      ? this.allTeamVehicles()
          .filter((v: Vehicle): boolean => v.id !== currentId)
          .reduce((sum: number, v: Vehicle): number => sum + buildVehicleSummary(v, catalog).cout, 0)
      : 0;
    return { total: this.team().cans, usedByOthers };
  });

  // ── Affichage du véhicule choisi/géré (computed, partagé par les deux modes) ─

  /**
   * Libellé du bouton de fin — "Terminer" en création (fin normale du flux de
   * construction), "Fermer" en édition (on referme simplement la modale de
   * gestion). Seule différence visuelle restante entre les deux modes.
   */
  doneButtonLabel: Signal<string> = computed((): string => {
    return this.vehicleId() === null ? 'Terminer' : 'Fermer';
  });

  /**
   * Vrai si l'équipe participe à une campagne qui n'est plus EN_CONSTRUCTION — le
   * backend refuse alors toute mutation (cf. Team.assertNotLocked()). Bloque la
   * création d'un nouveau véhicule (§ci-dessous) et passe en lecture seule
   * `EquipmentManager` en mode édition.
   */
  locked: Signal<boolean> = computed((): boolean => this.team().isLockedByCampaign ?? false);

  // ── Cycle de vie ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadSponsorCatalog();
    // Toujours charger les véhicules de l'équipe : nécessaires au budget dans les DEUX
    // modes (coût des autres véhicules), et en édition à isoler le véhicule visé.
    this.loadTeamVehicles();
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
    if (this.locked()) return;
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

  // ── Chargement des véhicules de l'équipe (budget + isolation en édition) ──────

  /**
   * Charge TOUS les véhicules bruts de l'équipe (`getAllForTeam` — aucun endpoint
   * ne renvoie un `Vehicle` brut par id ; `GET /api/vehicles/:id` est un DTO "monté").
   * Sert à deux fins :
   *  - calculer le budget transmis à `EquipmentManager` (coût des autres véhicules),
   *    dans les DEUX modes (`allTeamVehicles` → `budget`) ;
   *  - en mode édition, isoler le véhicule visé par `.find()` (`vehicle`).
   *
   * Chargement INDÉPENDANT du catalogue (déjà lancé par `loadSponsorCatalog` en
   * `ngOnInit`, requis aussi pour le mode création).
   */
  private loadTeamVehicles(): void {
    const editId = this.vehicleId();
    if (editId !== null) this.loadingVehicle.set(true);
    this.error.set('');

    this.vehicleService.getAllForTeam(this.team().id).subscribe({
      next: (vehicles: Vehicle[]): void => {
        this.allTeamVehicles.set(vehicles);

        if (editId !== null) {
          const found = vehicles.find((v: Vehicle): boolean => v.id === editId) ?? null;
          this.vehicle.set(found);
          this.loadingVehicle.set(false);
          if (!found) {
            // Incohérence (id obsolète — véhicule supprimé entre-temps par exemple) :
            // on signale plutôt que d'afficher un composant vide et silencieux.
            this.error.set('Ce véhicule est introuvable — il a peut-être été supprimé entre-temps.');
          }
        }
      },
      error: (): void => {
        if (editId !== null) {
          // Mode édition : le chargement du véhicule est bloquant, on signale l'échec.
          this.error.set('Impossible de charger ce véhicule. Réessayez.');
          this.loadingVehicle.set(false);
        }
        // Mode création : échec silencieux — le budget (informatif) restera optimiste
        // (usedByOthers = 0), sans empêcher la construction.
      },
    });
  }

  // ── Fin du flux ──────────────────────────────────────────────────────────────

  /** L'utilisateur a terminé — `Teams` ferme la modale et recharge la liste (`vehicleCount`/coûts). */
  finish(): void {
    this.done.emit();
  }
}
