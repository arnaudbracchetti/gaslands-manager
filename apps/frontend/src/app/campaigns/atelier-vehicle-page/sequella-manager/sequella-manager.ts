/**
 * SequellaManager — gestion des séquelles (afflictions, p.170) d'un véhicule d'atelier.
 *
 * Composant "smart" ATELIER-ONLY, rendu à côté d'`EquipmentManager` sur
 * `AtelierVehiclePage` — pas une section de celui-ci. Une séquelle a une monnaie
 * (`vehicle.chocs`, compteur par véhicule gagné via la Table des Épaves) et des
 * règles (achat/annulation/revente) totalement distinctes du budget Jerricans que
 * gère `EquipmentManager` — l'y intégrer aurait pollué un composant partagé avec la
 * construction d'équipe, qui ne connaît pas les séquelles.
 *
 * Contrairement à `EquipmentManager`, ce composant parle DIRECTEMENT à
 * `CampaignsService`/`CatalogService` : il n'y a pas de second contexte
 * ("construction d'équipe") pour les séquelles qui justifierait l'abstraction
 * `EquipmentDataSource` — celle-ci existe uniquement pour partager
 * `EquipmentManager` entre deux backends différents (CRUD équipe / event-sourcing
 * atelier), ce qui ne s'applique pas ici.
 *
 * Cas particuliers des séquelles à comportement (cf. spec/CAMPAIGN.md §Séquelles) :
 *  - **Dur à Cuire** : achat déclenche `SequellaAdvantagePicker` (choix d'un avantage
 *    gratuit parmi les 6 de catégorie "Dur à Cuire", TOUS sponsors confondus — la
 *    règle l'accorde "même si ce pilote ne peut normalement pas y avoir accès").
 *  - **Légende Vivante** : aucun choix à l'achat ; sa présence active débloque le
 *    bouton de revente des AUTRES séquelles pré-existantes du véhicule (cf.
 *    `resaleUnlocked`, mirroir de `Vehicle.canRemoveSequella` côté backend).
 *  - **Maintenu par la Rouille** : aucun choix, effet purement narratif ici (double
 *    tirage à la Table des Épaves, hors écran).
 */
import {
  Component,
  InputSignal,
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
import { HttpErrorResponse } from '@angular/common/http';
import { CampaignsService } from '../../campaigns.service';
import { CatalogService } from '../../../catalog/catalog.service';
import type { Avantage } from '../../../catalog/catalog.model';
import type { AvailableSequellaDto, WorkshopSequellaDto, WorkshopVehicleDto } from '../../workshop.model';
import { ConfirmModal } from '../../../shared/confirm-modal/confirm-modal';
import { SequellaAdvantagePicker } from './sequella-advantage-picker/sequella-advantage-picker';

const DUR_A_CUIRE = 'dur_a_cuire';
const LEGENDE_VIVANTE = 'legende_vivante';
const DUR_A_CUIRE_CATEGORIE = 'Dur à Cuire';

@Component({
  selector: 'app-sequella-manager',
  standalone: true,
  imports: [ConfirmModal, SequellaAdvantagePicker],
  templateUrl: './sequella-manager.html',
  styleUrl: './sequella-manager.scss',
})
export class SequellaManager {
  private campaignsService: CampaignsService = inject(CampaignsService);
  private catalogService: CatalogService = inject(CatalogService);

  /** Campagne courante — nécessaire pour les routes `/api/campaigns/:id/...`. */
  campaignId: InputSignal<number> = input.required<number>();

  /**
   * Le véhicule d'atelier COURANT — reçu tel quel depuis `GET .../workshop`
   * (`WorkshopVehicleDto`, pas l'entité `Vehicle` d'`EquipmentManager`) : c'est le
   * seul endroit qui porte déjà `chocs` et `sequellas`, pas besoin de les faire
   * transiter par `mapWorkshopVehicleToVehicle` (qui les ignore, cf. son en-tête).
   */
  vehicle: InputSignal<WorkshopVehicleDto> = input.required<WorkshopVehicleDto>();

  /** Émis après CHAQUE mutation réussie (achat, annulation, revente) — le parent recharge le workshop. */
  changed: OutputEmitterRef<void> = output<void>();

  availableSequelles: WritableSignal<AvailableSequellaDto[]> = signal<AvailableSequellaDto[]>([]);
  loading: WritableSignal<boolean> = signal(false);
  error: WritableSignal<string> = signal('');

  /** Avantages de catégorie "Dur à Cuire" (6, tous sponsors confondus) — chargés une fois, indépendamment du véhicule. */
  durACuireAdvantages: WritableSignal<Avantage[]> = signal<Avantage[]>([]);

  /** Séquelle en attente de choix d'avantage gratuit — non-null ⇒ le picker est ouvert. */
  pendingDurACuireNomInterne: WritableSignal<string | null> = signal<string | null>(null);

  /** Séquelle en attente de confirmation de retrait (annulation ou revente). */
  pendingRemove: WritableSignal<WorkshopSequellaDto | null> = signal<WorkshopSequellaDto | null>(null);

  /**
   * Revente cross-session ouverte ⟺ le véhicule porte encore une "Légende Vivante"
   * active (non vendue) — mirroir exact de `Vehicle.canRemoveSequella()` côté
   * backend (qui ne distingue pas non plus la séquelle Légende Vivante elle-même
   * des autres : tant qu'elle est active, sa propre revente est aussi débloquée).
   */
  resaleUnlocked: Signal<boolean> = computed((): boolean => {
    return this.vehicle().sequellas.some((s): boolean => !s.isSold && s.nomInterne === LEGENDE_VIVANTE);
  });

  constructor() {
    this.catalogService.getAllAvantages().subscribe({
      next: (all: Avantage[]): void => {
        this.durACuireAdvantages.set(all.filter((a): boolean => a.categorie === DUR_A_CUIRE_CATEGORIE));
      },
      // Non bloquant : si le catalogue d'avantages échoue à charger, le picker
      // Dur à Cuire affichera une liste vide plutôt que de bloquer tout l'atelier.
      error: (): void => undefined,
    });

    // Recharge les verdicts de disponibilité à CHAQUE changement du véhicule
    // (premier rendu, achat, annulation, revente) — mêmes pattern qu'`EquipmentManager`.
    effect((): void => {
      this.vehicle();
      this.loadAvailableSequelles();
    });
  }

  private loadAvailableSequelles(): void {
    const vehicleId = this.vehicle().id;
    this.loading.set(true);
    this.error.set('');

    this.campaignsService.getWorkshopAvailableSequelles(this.campaignId(), vehicleId).subscribe({
      next: (list: AvailableSequellaDto[]): void => {
        this.availableSequelles.set(list);
        this.loading.set(false);
      },
      error: (): void => {
        this.error.set('Impossible de charger les séquelles disponibles. Réessayez.');
        this.loading.set(false);
      },
    });
  }

  // ── Achat ────────────────────────────────────────────────────────────────────

  /** Clic sur "Acquérir" — Dur à Cuire ouvre d'abord le picker, les autres achètent directement. */
  onAcquireClicked(sequella: AvailableSequellaDto): void {
    if (sequella.nomInterne === DUR_A_CUIRE) {
      this.pendingDurACuireNomInterne.set(DUR_A_CUIRE);
      return;
    }
    this.buySequella(sequella.nomInterne, null);
  }

  /** Le picker a confirmé un choix — achète Dur à Cuire avec l'avantage gratuit bundlé. */
  onAdvantagePicked(freeAdvantageNomInterne: string): void {
    this.pendingDurACuireNomInterne.set(null);
    this.buySequella(DUR_A_CUIRE, freeAdvantageNomInterne);
  }

  onAdvantagePickerCancelled(): void {
    this.pendingDurACuireNomInterne.set(null);
  }

  private buySequella(nomInterne: string, freeAdvantageNomInterne: string | null): void {
    this.error.set('');

    this.campaignsService.changeEquipment(this.campaignId(), {
      operation: 'BUY',
      entityType: 'SEQUELLE',
      nomInterne,
      targetVehicleId: this.vehicle().id,
      targetEntityId: null,
      orientation: null,
      freeAdvantageNomInterne,
    }).subscribe({
      next: (): void => this.changed.emit(),
      error: (err: HttpErrorResponse): void => {
        this.error.set(err.error?.message ?? 'Impossible d\'acquérir cette séquelle. Réessayez.');
      },
    });
  }

  // ── Retrait — annulation (même session) ou revente (verrouillée par défaut) ──

  removeSequella(sequella: WorkshopSequellaDto): void {
    this.pendingRemove.set(sequella);
  }

  onConfirmRemove(): void {
    const sequella = this.pendingRemove();
    this.pendingRemove.set(null);
    if (!sequella) return;

    this.error.set('');

    this.campaignsService.changeEquipment(this.campaignId(), {
      operation: 'SELL',
      entityType: 'SEQUELLE',
      nomInterne: '',
      targetVehicleId: this.vehicle().id,
      targetEntityId: sequella.id,
      orientation: null,
    }).subscribe({
      next: (): void => this.changed.emit(),
      error: (err: HttpErrorResponse): void => {
        this.error.set(err.error?.message ?? 'Impossible de retirer cette séquelle. Réessayez.');
      },
    });
  }

  /** Texte de confirmation — annulation (session en cours) vs revente (perte totale, comme un avantage). */
  removalMessage(sequella: WorkshopSequellaDto): string {
    if (sequella.purchasedThisSession) return `Annuler l'achat de "${sequella.nom}" ?`;
    return `Revendre "${sequella.nom}" ? Aucun remboursement (perte totale de Chocs).`;
  }

  /** Un même retrait peut être proposé même si la revente cross-session est fermée : l'annulation même-session reste toujours possible. */
  canRemove(sequella: WorkshopSequellaDto): boolean {
    return sequella.purchasedThisSession || this.resaleUnlocked();
  }
}
