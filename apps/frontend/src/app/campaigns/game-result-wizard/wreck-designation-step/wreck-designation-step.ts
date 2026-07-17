/**
 * Composant WreckDesignationStep — écran 2 du wizard de fin de partie : pour
 * chaque véhicule des équipes présentes, désigner s'il a été mis en épave — par
 * un destructeur (véhicules ennemis détruits, exploit US-B2) ou seul (aucun
 * destructeur, foncé dans un mur) — et si un bonus "Favori du public" est en
 * attente d'une partie précédente.
 *
 * Composant "dumb" : ne fait aucun appel HTTP. Produit un `WreckDesignationResult`
 * qui sépare deux usages distincts de la même désignation :
 * - `destroyedVehicles` (seulement les entrées avec un vrai destructeur) →
 *   alimente le `RecordResultDto` (PC d'exploit, US-B2, backend inchangé).
 * - `wreckedVehicles` (toutes les désignations, avec ou sans destructeur) →
 *   pilote l'écran 3 (résolution de la Table des Épaves), état purement client.
 */
import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../../shared/icon/icon';
import type { CampaignParticipant } from '../../campaign-participant.model';
import type {
  DestroyedVehicleDto,
  ParticipantVehicleDto,
  WeightClass,
  WreckDesignationResult,
  WreckedVehicleEntry,
} from '../../game.model';

type VehicleStatus = 'intact' | 'destroyed' | 'alone';

interface VehicleDesignationState {
  status: VehicleStatus;
  destroyerParticipantId: number | null;
  pendingFavoriDuPublic: boolean;
}

const DEFAULT_STATE: VehicleDesignationState = {
  status: 'intact',
  destroyerParticipantId: null,
  pendingFavoriDuPublic: false,
};

interface VehicleRow {
  ownerParticipantId: number;
  ownerTeamName: string;
  vehicle: ParticipantVehicleDto;
}

@Component({
  selector: 'app-wreck-designation-step',
  standalone: true,
  imports: [CommonModule, FormsModule, Icon],
  templateUrl: './wreck-designation-step.html',
  styleUrl: './wreck-designation-step.scss',
})
export class WreckDesignationStep {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Participants classés à l'écran 1 — source des véhicules à désigner. */
  presentParticipants = input.required<CampaignParticipant[]>();

  /** Véhicules courants par participant (clé = participantId), tous présents confondus. */
  participantVehicles = input<ReadonlyMap<number, ParticipantVehicleDto[]>>(new Map());

  /** Vrai pendant que le parent attend la réponse de l'API (classement en cours d'enregistrement). */
  saving = input<boolean>(false);

  /**
   * Affiche la case "Favori du public" — Événement Télévisé uniquement (bonus PC,
   * cf. spec/CAMPAIGN.md). Toujours `false` pour une Escarmouche : le picker
   * destructeur reste actif dans les deux cas, seule cette case est masquée.
   */
  showFavoriDuPublic = input<boolean>(true);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  next = output<WreckDesignationResult>();
  back = output<void>();
  formCancel = output<void>();

  // ── État interne ─────────────────────────────────────────────────────────────

  private vehicleStates = signal<Map<number, VehicleDesignationState>>(new Map());

  /** Tous les véhicules des participants présents, avec leur propriétaire. */
  allVehicles = computed<VehicleRow[]>(() => {
    const rows: VehicleRow[] = [];
    for (const participant of this.presentParticipants()) {
      const vehicles = this.participantVehicles().get(participant.id) ?? [];
      for (const vehicle of vehicles) {
        rows.push({ ownerParticipantId: participant.id, ownerTeamName: participant.teamName, vehicle });
      }
    }
    return rows;
  });

  // ── Méthodes publiques ───────────────────────────────────────────────────────

  stateFor(vehicleId: number): VehicleDesignationState {
    return this.vehicleStates().get(vehicleId) ?? DEFAULT_STATE;
  }

  /** Autres participants présents que le propriétaire — candidats destructeurs. */
  destroyerCandidatesFor(ownerParticipantId: number): CampaignParticipant[] {
    return this.presentParticipants().filter((p) => p.id !== ownerParticipantId);
  }

  setStatus(vehicleId: number, status: VehicleStatus): void {
    const map = new Map(this.vehicleStates());
    const current = this.stateFor(vehicleId);
    map.set(vehicleId, {
      ...current,
      status,
      destroyerParticipantId: status === 'destroyed' ? current.destroyerParticipantId : null,
    });
    this.vehicleStates.set(map);
  }

  setDestroyer(vehicleId: number, destroyerIdStr: string): void {
    const destroyerParticipantId = destroyerIdStr === '' ? null : Number(destroyerIdStr);
    const map = new Map(this.vehicleStates());
    map.set(vehicleId, { ...this.stateFor(vehicleId), destroyerParticipantId });
    this.vehicleStates.set(map);
  }

  togglePendingFavoriDuPublic(vehicleId: number): void {
    const map = new Map(this.vehicleStates());
    const current = this.stateFor(vehicleId);
    map.set(vehicleId, { ...current, pendingFavoriDuPublic: !current.pendingFavoriDuPublic });
    this.vehicleStates.set(map);
  }

  /** Libellé français d'un poids de véhicule. */
  weightLabel(weightClass: WeightClass): string {
    switch (weightClass) {
      case 'LEGER': return 'Léger';
      case 'MOYEN': return 'Moyen';
      case 'LOURD': return 'Lourd';
      case 'FORTERESSE': return 'Forteresse';
    }
  }

  onNext(): void {
    const destroyedVehicles = new Map<number, DestroyedVehicleDto[]>();
    const wreckedVehicles: WreckedVehicleEntry[] = [];

    for (const row of this.allVehicles()) {
      const state = this.stateFor(row.vehicle.vehicleId);
      if (state.status === 'intact') continue;

      wreckedVehicles.push({
        participantId: row.ownerParticipantId,
        vehicleId: row.vehicle.vehicleId,
        pendingFavoriDuPublic: state.pendingFavoriDuPublic,
      });

      if (state.status === 'destroyed' && state.destroyerParticipantId !== null) {
        const existing = destroyedVehicles.get(state.destroyerParticipantId) ?? [];
        destroyedVehicles.set(state.destroyerParticipantId, [
          ...existing,
          { vehicleId: row.vehicle.vehicleId },
        ]);
      }
    }

    this.next.emit({ destroyedVehicles, wreckedVehicles });
  }

  onBack(): void {
    this.back.emit();
  }

  onCancel(): void {
    this.formCancel.emit();
  }
}
