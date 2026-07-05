/**
 * Composant GameResultWizard — orchestrateur du wizard de fin de partie.
 *
 * Remplace l'ancienne modale unique `GameResultForm` : 3 écrans séquentiels
 * (classement → désignation des épaves → résolution de la Table des Épaves),
 * chacun porté par un sous-composant "dumb" dédié (`RankingStep`,
 * `WreckDesignationStep`, `WreckResolutionStep`).
 *
 * Reste lui-même "dumb" (convention du projet, cf. COMPONENTS.md) : aucun appel
 * HTTP ici. `CampaignProgram` (smart, parent) porte les deux requêtes réseau —
 * `recordResult()` à la transition écran 2→3, `resolveWreck()` par véhicule à
 * l'écran 3 — et repasse les résultats via les inputs `resultRecorded` /
 * `wreckOutcomes`. Même pattern que `participantVehicles` déjà en place.
 */
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CampaignParticipant } from '../campaign-participant.model';
import type {
  DestroyedVehicleDto,
  Game,
  ParticipantVehicleDto,
  RankingEntry,
  RecordResultDto,
  WreckDesignationResult,
  WreckOutcomeDto,
  WreckResolveRequestDto,
  WreckedVehicleEntry,
} from '../game.model';
import { RankingStep } from './ranking-step/ranking-step';
import { WreckDesignationStep } from './wreck-designation-step/wreck-designation-step';
import { WreckResolutionStep } from './wreck-resolution-step/wreck-resolution-step';

type WizardStep = 1 | 2 | 3;

@Component({
  selector: 'app-game-result-wizard',
  standalone: true,
  imports: [CommonModule, RankingStep, WreckDesignationStep, WreckResolutionStep],
  templateUrl: './game-result-wizard.html',
  styleUrl: './game-result-wizard.scss',
})
export class GameResultWizard {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  game = input.required<Game>();
  participants = input.required<CampaignParticipant[]>();

  /** Vrai pendant que le parent attend la réponse de `recordResult()`. */
  saving = input<boolean>(false);

  /** Véhicules courants par participant — alimenté par le parent après chaque changement de présence. */
  participantVehicles = input<ReadonlyMap<number, ParticipantVehicleDto[]>>(new Map());

  /**
   * Non-null une fois `recordResult()` résolu avec succès — fait avancer le
   * wizard de l'écran 2 vers l'écran 3 (via `effect()` ci-dessous).
   */
  resultRecorded = input<Game | null>(null);

  /** Résultats de tirage reçus, clé = vehicleId — alimenté par le parent après chaque tirage. */
  wreckOutcomes = input<ReadonlyMap<number, WreckOutcomeDto>>(new Map());

  /** Lignes de texte décrivant les événements générés par chaque tirage, clé = vehicleId. */
  wreckDescriptions = input<ReadonlyMap<number, string[]>>(new Map());

  /** Vrai pendant qu'un tirage de la Table des Épaves est en cours. */
  rollingWreck = input<boolean>(false);

  /** Vrai pendant que la finalisation de la partie (clic "Terminer") est en cours. */
  finalizingGame = input<boolean>(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  presentParticipantsChanged = output<number[]>();
  rankingSubmitted = output<RecordResultDto>();
  wreckRollRequested = output<WreckResolveRequestDto>();
  wizardCompleted = output<void>();
  formCancel = output<void>();

  // ── État interne ─────────────────────────────────────────────────────────────

  currentStep = signal<WizardStep>(1);
  private rankingResult = signal<RankingEntry[]>([]);
  /** Véhicules désignés à l'écran 2 — pilote l'écran 3. */
  wreckedVehicles = signal<WreckedVehicleEntry[]>([]);

  /** Participants retenus à l'écran 1, ré-résolus en objets complets pour l'écran 2. */
  presentParticipantsForDesignation = computed<CampaignParticipant[]>(() => {
    const rankedIds = new Set(this.rankingResult().map((r) => r.participantId));
    return this.participants().filter((p) => rankedIds.has(p.id));
  });

  /** Libellé "nom (équipe)" par véhicule, pour l'affichage à l'écran 3. */
  vehicleLabels = computed<ReadonlyMap<number, string>>(() => {
    const map = new Map<number, string>();
    for (const [participantId, vehicles] of this.participantVehicles()) {
      const owner = this.participants().find((p) => p.id === participantId);
      for (const vehicle of vehicles) {
        map.set(vehicle.vehicleId, owner ? `${vehicle.nom} (${owner.teamName})` : vehicle.nom);
      }
    }
    return map;
  });

  /** Véhicules ennemis détruits capturés à l'écran 2 — clé = participantId destructeur. */
  private rawDestroyedVehicles = signal<ReadonlyMap<number, DestroyedVehicleDto[]>>(new Map());

  /** Libellé du destructeur par véhicule détruit, pour l'affichage à l'écran 3. */
  destroyedBy = computed<ReadonlyMap<number, string>>(() => {
    const map = new Map<number, string>();
    for (const [destroyerId, destroyed] of this.rawDestroyedVehicles()) {
      const destroyer = this.participants().find((p) => p.id === destroyerId);
      for (const d of destroyed) {
        map.set(d.vehicleId, destroyer?.teamName ?? `participant #${destroyerId}`);
      }
    }
    return map;
  });

  constructor() {
    // Une fois le classement enregistré côté serveur (écran 2 soumis avec succès),
    // avancer vers l'écran 3 — jamais de retour en arrière possible après ce point.
    effect(() => {
      if (this.resultRecorded() && this.currentStep() === 2) {
        this.currentStep.set(3);
      }
    });

    // Écran 3 : plus de bouton "Tirer" — chaque véhicule désigné à l'écran 2 est
    // résolu automatiquement, un par un. `rollingWreck()` sert de verrou (une seule
    // requête à la fois) ; cet effect se ré-exécute à chaque mise à jour de
    // `wreckOutcomes()`/`rollingWreck()` par le parent et enchaîne naturellement sur
    // le prochain véhicule non résolu, jusqu'à ce qu'il n'y en ait plus.
    effect(() => {
      if (this.currentStep() !== 3 || this.rollingWreck()) return;
      const outcomes = this.wreckOutcomes();
      const next = this.wreckedVehicles().find((v) => !outcomes.has(v.vehicleId));
      if (next) {
        this.wreckRollRequested.emit({
          participantId: next.participantId,
          vehicleId: next.vehicleId,
          pendingFavoriDuPublic: next.pendingFavoriDuPublic,
        });
      }
    });
  }

  // ── Écran 1 : classement ─────────────────────────────────────────────────────

  onRankingNext(entries: RankingEntry[]): void {
    this.rankingResult.set(entries);
    this.currentStep.set(2);
  }

  onPresentParticipantsChanged(ids: number[]): void {
    this.presentParticipantsChanged.emit(ids);
  }

  // ── Écran 2 : désignation des épaves ─────────────────────────────────────────

  onDesignationNext(result: WreckDesignationResult): void {
    const results = this.rankingResult().map((r) => ({
      participantId: r.participantId,
      rank: r.rank,
      gatesCrossed: r.gatesCrossed,
      destroyedVehicles: result.destroyedVehicles.get(r.participantId),
    }));
    this.wreckedVehicles.set(result.wreckedVehicles);
    this.rawDestroyedVehicles.set(result.destroyedVehicles);
    this.rankingSubmitted.emit({ results });
  }

  onDesignationBack(): void {
    this.currentStep.set(1);
  }

  // ── Écran 3 : résolution de la Table des Épaves (automatique, cf. effect ci-dessus) ──

  onWreckCompleted(): void {
    this.wizardCompleted.emit();
  }

  // ── Commun ────────────────────────────────────────────────────────────────────

  onCancel(): void {
    this.formCancel.emit();
  }
}
