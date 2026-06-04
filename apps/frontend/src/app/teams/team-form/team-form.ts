/**
 * Composant TeamForm — formulaire de création ou de modification d'une équipe.
 *
 * C'est un composant "dumb" : il ne contacte pas l'API des équipes directement.
 * Il valide les données localement puis émet un DTO vers le parent
 * qui se charge de l'appel HTTP.
 *
 * En revanche, il charge le catalogue des sponsors via CatalogService (données
 * publiques) pour alimenter le SponsorCarousel.
 *
 * Modes de fonctionnement :
 * - team = null  → mode création (champs vides, titre "Nouvelle équipe")
 * - team = Team  → mode édition  (champs pré-remplis, titre "Modifier l'équipe")
 *
 * L'effect() surveille le changement de l'input `team` pour mettre à jour
 * les champs automatiquement sans que le parent ait à le faire.
 *
 * Logique de verrouillage du sponsor :
 * L'input `hasVehicles` est true si l'équipe possède au moins un véhicule.
 * Dans ce cas, le SponsorCarousel passe en mode locked : la navigation est
 * désactivée et le sponsor ne peut plus être modifié.
 *
 * Flow de sauvegarde :
 * 1. L'utilisateur clique sur "Enregistrer"
 * 2. Ce composant valide les champs (nom obligatoire)
 * 3. Si valide → émet saved(dto) vers le parent
 * 4. Le parent appelle l'API et passe saving=true pendant l'attente
 * 5. Le parent ferme le formulaire quand l'API répond
 */
import {
  Component,
  InputSignal,
  OnInit,
  OutputEmitterRef,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Team, CreateTeamDto, SponsorInfo, DEFAULT_CANS } from '../team.model';
import { SponsorCarousel } from '../sponsor-carousel/sponsor-carousel';
import { CatalogService } from '../../catalog/catalog.service';

@Component({
  selector: 'app-team-form',
  standalone: true,
  // FormsModule : pour [ngModel] sur les champs nom, cans et description.
  // SponsorCarousel : carousel de sélection du sponsor (remplace le <select>).
  imports: [FormsModule, SponsorCarousel],
  templateUrl: './team-form.html',
  styleUrl: './team-form.scss',
})
export class TeamForm implements OnInit {
  private catalogService: CatalogService = inject(CatalogService);

  // ── Inputs ──────────────────────────────────────────────────────────────────

  /**
   * Équipe à éditer (null = mode création).
   * Un effect() surveille ce signal pour pré-remplir les champs.
   */
  team: InputSignal<Team | null> = input<Team | null>(null);

  /**
   * Vrai pendant que le parent attend la réponse de l'API.
   * Désactive les boutons pour éviter les soumissions multiples.
   */
  saving: InputSignal<boolean> = input(false);

  /**
   * Vrai si l'équipe possède au moins un véhicule.
   * Dans ce cas, le sponsor ne peut plus être modifié (règle métier Gaslands).
   * Le SponsorCarousel affiche un badge de verrouillage et bloque la navigation.
   */
  hasVehicles: InputSignal<boolean> = input<boolean>(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /**
   * Émis avec le DTO validé quand l'utilisateur clique sur "Enregistrer".
   * Le parent décidera si c'est un create() ou un update() selon editingTeam.
   */
  saved: OutputEmitterRef<CreateTeamDto> = output<CreateTeamDto>();

  // Renommé `formCancel` (et non `cancel`) car `cancel` est un événement DOM natif.
  formCancel: OutputEmitterRef<void> = output<void>();

  // ── État interne du formulaire ───────────────────────────────────────────────

  formName: WritableSignal<string>        = signal('');
  formSponsor: WritableSignal<string>     = signal('Rutherford');
  formCans: WritableSignal<number>        = signal(DEFAULT_CANS);
  formDescription: WritableSignal<string> = signal('');

  /** Message d'erreur de validation locale */
  formError: WritableSignal<string> = signal('');

  /** Titre calculé selon le mode : création ou édition */
  formTitle: Signal<string> = computed((): string =>
    this.team() ? '✏️ Modifier l\'équipe' : '➕ Nouvelle équipe',
  );

  // ── État du catalogue ────────────────────────────────────────────────────────

  /**
   * Liste des sponsors chargée depuis l'API /api/catalog/sponsors.
   * Alimentée par ngOnInit() via CatalogService.
   */
  sponsors: WritableSignal<SponsorInfo[]> = signal<SponsorInfo[]>([]);

  /**
   * Vrai pendant le chargement initial du catalogue.
   * Affiche un indicateur de chargement à la place du carousel.
   */
  loadingSponsors: WritableSignal<boolean> = signal<boolean>(true);

  constructor() {
    /**
     * effect() : réagit automatiquement quand l'input `team` change.
     *
     * Si team est fourni → on pré-remplit les champs (mode édition).
     * Si team est null   → on remet les valeurs par défaut (mode création).
     */
    effect((): void => {
      const t = this.team();
      if (t) {
        this.formName.set(t.name);
        this.formSponsor.set(t.sponsor);
        this.formCans.set(t.cans);
        this.formDescription.set(t.description ?? '');
      } else {
        this.formName.set('');
        // Valeur par défaut en mode création : 'Rutherford'.
        // ngOnInit() la remplacera par sponsors[0].nom dès que le catalogue sera chargé.
        this.formSponsor.set('Rutherford');
        this.formCans.set(DEFAULT_CANS);
        this.formDescription.set('');
      }
      this.formError.set('');
    });
  }

  ngOnInit(): void {
    /**
     * Charge les sponsors enrichis depuis le catalogue.
     * Ces données alimentent le SponsorCarousel (description, classes, avantages).
     *
     * Le chargement est déclenché une seule fois à l'initialisation.
     * Si le sponsor de l'équipe est Rutherford mais les sponsors ne sont pas encore
     * chargés, le carousel affiche un placeholder jusqu'à la fin du chargement.
     */
    this.catalogService.getSponsors().subscribe({
      next: (sponsors: SponsorInfo[]): void => {
        this.sponsors.set(sponsors);
        this.loadingSponsors.set(false);
        // Si on est en mode création et qu'aucun sponsor n'a encore été sélectionné,
        // on initialise formSponsor avec le 1er sponsor du catalogue.
        if (!this.team() && sponsors.length > 0) {
          this.formSponsor.set(sponsors[0].nom);
        }
      },
      error: (): void => {
        // En cas d'erreur de chargement, on garde formSponsor à 'Rutherford' (valeur par défaut)
        // et on masque le spinner. Le formulaire reste utilisable mais sans carousel.
        this.loadingSponsors.set(false);
      },
    });
  }

  // ── Méthodes ────────────────────────────────────────────────────────────────

  /** Valide les champs et émet le DTO si tout est correct. */
  saveForm(): void {
    const name = this.formName().trim();

    if (!name) {
      this.formError.set('Le nom de l\'équipe est obligatoire.');
      return;
    }

    this.formError.set('');

    const dto: CreateTeamDto = {
      name,
      sponsor:     this.formSponsor(),
      cans:        this.formCans(),
      description: this.formDescription().trim() || undefined,
    };

    this.saved.emit(dto);
  }

  /** Ferme le formulaire sans sauvegarder. */
  cancelForm(): void {
    this.formCancel.emit();
  }
}
