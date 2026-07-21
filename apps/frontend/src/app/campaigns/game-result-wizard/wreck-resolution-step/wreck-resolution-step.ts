/**
 * Composant WreckResolutionStep — dernier écran du wizard de fin de partie :
 * synthèse automatique des revenus (Escarmouche uniquement) et de la Table des
 * Épaves pour chaque véhicule désigné à l'écran précédent.
 *
 * Composant "dumb" : aucun appel HTTP ici (convention du projet, cf. COMPONENTS.md).
 * Les tirages D6 (revenu et épaves) sont entièrement serveur et entièrement
 * automatiques — aucun bouton, aucun sélecteur. `GameResultWizard` (parent)
 * déclenche un tirage à la fois via un `effect()` dès l'arrivée sur cet écran
 * (revenus d'abord si `showIncome`, puis épaves) ; ce composant se contente
 * d'afficher, pour chaque entrée, un indicateur "en cours" tant qu'aucun résultat
 * n'est reçu, puis la synthèse une fois reçue via les inputs `incomeResults`/
 * `outcomes`+`descriptions`, alimentés par le parent en retour de
 * `CampaignsService.rollIncome()`/`resolveWreck()`.
 */
import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../../shared/icon/icon';
import type { CampaignParticipant } from '../../campaign-participant.model';
import type {
  RollIncomeResultDto,
  WreckOutcomeDto,
  WreckResult,
  WreckedVehicleEntry,
} from '../../game.model';

@Component({
  selector: 'app-wreck-resolution-step',
  standalone: true,
  imports: [CommonModule, Icon],
  templateUrl: './wreck-resolution-step.html',
  styleUrl: './wreck-resolution-step.scss',
})
export class WreckResolutionStep {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Véhicules désignés à l'écran 2 — un bloc de synthèse par entrée. */
  wreckedVehicles = input.required<WreckedVehicleEntry[]>();

  /** Libellé affiché par véhicule (nom + équipe), résolu par le parent. */
  vehicleLabels = input<ReadonlyMap<number, string>>(new Map());

  /** Libellé du destructeur par véhicule détruit (si applicable), résolu par le parent. */
  destroyedBy = input<ReadonlyMap<number, string>>(new Map());

  /** Résultats reçus, clé = vehicleId — alimenté par le parent après chaque tirage. */
  outcomes = input<ReadonlyMap<number, WreckOutcomeDto>>(new Map());

  /** Lignes de texte décrivant les événements de chaque tirage, clé = vehicleId. */
  descriptions = input<ReadonlyMap<number, string[]>>(new Map());

  /** Vrai pendant que la finalisation (clic "Terminer") est en cours. */
  finalizing = input<boolean>(false);

  /** Vrai pendant qu'une annulation (clic "Annuler", DELETE .../results) est en cours. */
  resetting = input<boolean>(false);

  /**
   * Affiche la section "Revenus" — Escarmouche uniquement (gate explicite, même
   * principe que `EquipmentManager.showSequellas`, cf. COMPONENTS.md).
   */
  showIncome = input<boolean>(false);

  /** Participants présents — source de la section "Revenus" (Escarmouche uniquement). */
  presentParticipants = input<CampaignParticipant[]>([]);

  /** Résultats de revenu reçus, clé = participantId — alimenté par le parent après chaque tirage. */
  incomeResults = input<ReadonlyMap<number, RollIncomeResultDto>>(new Map());

  // ── Outputs ─────────────────────────────────────────────────────────────────

  completed = output<void>();
  formCancel = output<void>();

  // ── Calculs ──────────────────────────────────────────────────────────────────

  /** Vrai quand tous les revenus (si affichés) et tous les véhicules désignés ont un résultat. */
  allResolved = computed<boolean>(() =>
    (!this.showIncome() || this.presentParticipants().every((p) => this.incomeResults().has(p.id)))
    && this.wreckedVehicles().every((v) => this.outcomes().has(v.vehicleId)),
  );

  // ── Méthodes publiques ───────────────────────────────────────────────────────

  vehicleLabel(vehicleId: number): string {
    return this.vehicleLabels().get(vehicleId) ?? `Véhicule #${vehicleId}`;
  }

  destroyerLabel(vehicleId: number): string | null {
    return this.destroyedBy().get(vehicleId) ?? null;
  }

  outcomeFor(vehicleId: number): WreckOutcomeDto | undefined {
    return this.outcomes().get(vehicleId);
  }

  incomeResultFor(participantId: number): RollIncomeResultDto | undefined {
    return this.incomeResults().get(participantId);
  }

  descriptionsFor(vehicleId: number): string[] {
    return this.descriptions().get(vehicleId) ?? [];
  }

  /** Libellé français d'une ligne de la Table des Épaves. */
  resultLabel(result: WreckResult): string {
    switch (result) {
      case 'DEBOSSELE': return 'Débosselé !';
      case 'INDEMNE': return 'S\'en sort indemne';
      case 'ROUE_CABOSSEE': return 'Passage de roue cabossé';
      case 'ARRACHEE': return 'Arrachée';
      case 'PIGNON_ENDOMMAGE': return 'Pignon endommagé';
      case 'SIEGE_IRRECUPERABLE': return 'Siège irrécupérable';
      case 'CHASSIS_FRAGILISE': return 'Châssis fragilisé';
      case 'FAVORI_DU_PUBLIC': return 'Favori du public';
      case 'VEHICULE_DETRUIT': return 'Véhicule détruit, pilote mort';
    }
  }

  /** Rappel textuel pour les lignes sans effet numérique interprété par le moteur. */
  reminderFor(result: WreckResult): string | null {
    switch (result) {
      case 'CHASSIS_FRAGILISE':
        return '+1 Jeton Danger si ce véhicule est impliqué dans une Collision.';
      case 'FAVORI_DU_PUBLIC':
        return 'Statut accordé — si ce véhicule est mis en épave lors d\'une prochaine partie, la '
          + 'case à cocher proposera automatiquement le bonus (+5 PC contre 3 votes du public).';
      default:
        return null;
    }
  }

  /** Libellé de l'équipement perdu (ligne ARRACHEE ou PIGNON_ENDOMMAGE), s'il y en a un. */
  lostEquipmentLabel(outcome: WreckOutcomeDto): string | null {
    if (!outcome.lostEquipment) return null;
    return outcome.lostEquipment.kind === 'weapon'
      ? `Arme #${outcome.lostEquipment.id} perdue`
      : outcome.lostEquipment.kind === 'improvement'
      ? `Amélioration #${outcome.lostEquipment.id} perdue`
      : `Avantage #${outcome.lostEquipment.id} perdu`;
  }

  onComplete(): void {
    if (!this.allResolved()) return;
    this.completed.emit();
  }

  onCancel(): void {
    this.formCancel.emit();
  }
}
