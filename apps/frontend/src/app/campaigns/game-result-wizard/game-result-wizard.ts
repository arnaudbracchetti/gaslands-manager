/**
 * Composant GameResultWizard — orchestrateur du wizard de fin de partie.
 *
 * Wizard à ÉTAPES VARIABLES, pilotées par le type de partie (Événement Télévisé
 * vs Escarmouche) et par les métadonnées du scénario (`franchissementPortes`/
 * `gainJerricans`, cf. `Game`/`Scenario`) — cf. le design doc
 * `docs/plans/2026-07-17-wizard-fin-partie-e-et-design.md`. Six écrans possibles,
 * chacun porté par un sous-composant "dumb" dédié :
 *
 *   1. Présence     (`PresenceStep`)              — toujours
 *   2. Classement    (`RankingStep`)               — Événement Télévisé uniquement
 *   3. Portes        (`GatesStep`)                 — ET + scénario.franchissementPortes
 *   4. Jerricans     (`JerricansStep`)              — scénario.gainJerricans (butin manuel)
 *   5. Désignation   (`WreckDesignationStep`)       — toujours
 *   6. Résolution    (`WreckResolutionStep`)        — toujours (revenu D6 Escarmouche + épaves)
 *
 * PERSISTANCE DIFFÉRÉE : les écrans 1 à 5 sont de l'état purement client — rien
 * n'est envoyé au serveur avant l'arrivée sur l'écran 6. "Précédent"/"Annuler"
 * restent donc libres jusque-là. Le lot accumulé (classement OU jerricans/
 * destructions selon le type) est envoyé en un seul `batchReady` à la transition
 * 5 → 6 ; "Annuler" à l'écran 6 signale au parent qu'un reset serveur est
 * nécessaire (`CampaignProgram` décide, selon qu'un batch a déjà été persisté).
 *
 * Reste lui-même "dumb" (convention du projet, cf. COMPONENTS.md) : aucun appel
 * HTTP ici. `CampaignProgram` (smart, parent) porte toutes les requêtes réseau
 * et repasse les résultats via les inputs `resultRecorded`/`wreckOutcomes`/
 * `incomeResults`.
 */
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CampaignParticipant } from '../campaign-participant.model';
import type {
  DestroyedVehicleDto,
  EscarmoucheDestroyedVehicleDto,
  Game,
  GatesEntry,
  JerricanGainDto,
  ParticipantVehicleDto,
  RankingEntry,
  RecordResultDto,
  RollIncomeResultDto,
  WreckDesignationResult,
  WreckOutcomeDto,
  WreckResolveRequestDto,
  WreckedVehicleEntry,
} from '../game.model';
import { PresenceStep } from './presence-step/presence-step';
import { RankingStep } from './ranking-step/ranking-step';
import { GatesStep } from './gates-step/gates-step';
import { JerricansStep } from './jerricans-step/jerricans-step';
import { WreckDesignationStep } from './wreck-designation-step/wreck-designation-step';
import { WreckResolutionStep } from './wreck-resolution-step/wreck-resolution-step';

type WizardStepId = 'presence' | 'ranking' | 'gates' | 'jerricans' | 'designation' | 'resolution';

const STEP_LABELS: Record<WizardStepId, string> = {
  presence: 'Présence',
  ranking: 'Classement',
  gates: 'Portes',
  jerricans: 'Jerricans',
  designation: 'Épaves infligées',
  resolution: 'Résolution',
};

@Component({
  selector: 'app-game-result-wizard',
  standalone: true,
  imports: [CommonModule, PresenceStep, RankingStep, GatesStep, JerricansStep, WreckDesignationStep, WreckResolutionStep],
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
   * wizard de l'écran Désignation vers l'écran Résolution (via `effect()` ci-dessous).
   */
  resultRecorded = input<Game | null>(null);

  /** Résultats de tirage d'épave reçus, clé = vehicleId — alimenté par le parent après chaque tirage. */
  wreckOutcomes = input<ReadonlyMap<number, WreckOutcomeDto>>(new Map());

  /** Lignes de texte décrivant les événements générés par chaque tirage d'épave, clé = vehicleId. */
  wreckDescriptions = input<ReadonlyMap<number, string[]>>(new Map());

  /** Résultats de revenu Escarmouche reçus, clé = participantId. */
  incomeResults = input<ReadonlyMap<number, RollIncomeResultDto>>(new Map());

  /** Vrai pendant qu'un tirage (revenu ou épave) est en cours — un seul à la fois. */
  resolving = input<boolean>(false);

  /** Vrai pendant que la finalisation de la partie (clic "Terminer") est en cours. */
  finalizingGame = input<boolean>(false);

  /** Vrai pendant qu'une annulation à l'écran Résolution (DELETE .../results) est en cours. */
  resetting = input<boolean>(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  presentParticipantsChanged = output<number[]>();
  /** Lot accumulé (classement OU jerricans/destructions) — émis à la transition Désignation → Résolution. */
  batchReady = output<RecordResultDto>();
  incomeRollRequested = output<number>();
  wreckRollRequested = output<WreckResolveRequestDto>();
  wizardCompleted = output<void>();
  formCancel = output<void>();

  // ── État interne ─────────────────────────────────────────────────────────────

  /** Ids présents, dans l'ordre de coche (écran Présence). */
  private presentParticipantIds = signal<number[]>([]);
  private rankingResult = signal<RankingEntry[]>([]);
  private gatesEntries = signal<GatesEntry[]>([]);
  private jerricanGainEntries = signal<JerricanGainDto[]>([]);
  /** Véhicules désignés à l'écran Désignation — pilote l'écran Résolution. */
  wreckedVehicles = signal<WreckedVehicleEntry[]>([]);
  /** Véhicules ennemis détruits capturés à l'écran Désignation — clé = destructeur (participantId). */
  private rawDestroyedVehicles = signal<ReadonlyMap<number, DestroyedVehicleDto[]>>(new Map());

  currentStepIndex = signal(0);

  /**
   * Étapes actives, dans l'ordre — dépend du type de partie et des métadonnées
   * du scénario (cf. en-tête de fichier).
   */
  activeSteps = computed<WizardStepId[]>(() => {
    const isEvenementTele = this.game().type === 'EVENEMENT_TELE';
    const steps: WizardStepId[] = ['presence'];
    if (isEvenementTele) steps.push('ranking');
    if (isEvenementTele && this.game().franchissementPortes) steps.push('gates');
    if (this.game().gainJerricans) steps.push('jerricans');
    steps.push('designation', 'resolution');
    return steps;
  });

  currentStepId = computed<WizardStepId>(() => this.activeSteps()[this.currentStepIndex()]);

  /** Participants présents (écran Présence), résolus en objets complets. */
  presentParticipants = computed<CampaignParticipant[]>(() => {
    const ids = new Set(this.presentParticipantIds());
    return this.participants().filter((p) => ids.has(p.id));
  });

  /** Participants classés (écran Classement), dans l'ordre du rang — alimente l'écran Portes. */
  rankedParticipants = computed<CampaignParticipant[]>(() => {
    const byId = new Map(this.participants().map((p) => [p.id, p]));
    return this.rankingResult()
      .map((r) => byId.get(r.participantId))
      .filter((p): p is CampaignParticipant => p !== undefined);
  });

  /** Libellé "nom (équipe)" par véhicule, pour l'affichage à l'écran Résolution. */
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

  /** Libellé du destructeur par véhicule détruit, pour l'affichage à l'écran Résolution. */
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
    // Une fois le lot enregistré côté serveur (écran Désignation soumis avec
    // succès), avancer vers l'écran Résolution — jamais de retour en arrière
    // possible après ce point.
    effect(() => {
      if (this.resultRecorded() && this.currentStepId() === 'designation') {
        this.currentStepIndex.update((i) => i + 1);
      }
    });

    // Écran Résolution : plus de bouton "Tirer" — chaque tirage (revenu Escarmouche
    // d'abord, puis épaves) est résolu automatiquement, un par un. `resolving()`
    // sert de verrou (une seule requête à la fois) ; cet effect se ré-exécute à
    // chaque mise à jour de `incomeResults()`/`wreckOutcomes()`/`resolving()` par
    // le parent et enchaîne naturellement sur le prochain tirage non résolu.
    effect(() => {
      if (this.currentStepId() !== 'resolution' || this.resolving()) return;

      if (this.game().type !== 'EVENEMENT_TELE') {
        const nextIncome = this.presentParticipants().find((p) => !this.incomeResults().has(p.id));
        if (nextIncome) {
          this.incomeRollRequested.emit(nextIncome.id);
          return;
        }
      }

      const nextWreck = this.wreckedVehicles().find((v) => !this.wreckOutcomes().has(v.vehicleId));
      if (nextWreck) {
        this.wreckRollRequested.emit({
          participantId: nextWreck.participantId,
          vehicleId: nextWreck.vehicleId,
          pendingFavoriDuPublic: nextWreck.pendingFavoriDuPublic,
        });
      }
    });
  }

  // ── Libellés d'étapes (gabarit) ─────────────────────────────────────────────

  stepLabel(id: WizardStepId): string {
    return STEP_LABELS[id];
  }

  // ── Écran Présence ────────────────────────────────────────────────────────────

  onPresenceNext(ids: number[]): void {
    this.presentParticipantIds.set(ids);
    this.advance();
  }

  onPresentParticipantsChanged(ids: number[]): void {
    this.presentParticipantsChanged.emit(ids);
  }

  // ── Écran Classement (Événement Télévisé) ────────────────────────────────────

  onRankingNext(entries: RankingEntry[]): void {
    this.rankingResult.set(entries);
    this.advance();
  }

  // ── Écran Portes (Événement Télévisé, si scénario.franchissementPortes) ─────

  onGatesNext(entries: GatesEntry[]): void {
    this.gatesEntries.set(entries);
    this.advance();
  }

  // ── Écran Jerricans (si scénario.gainJerricans) ──────────────────────────────

  onJerricansNext(entries: JerricanGainDto[]): void {
    this.jerricanGainEntries.set(entries);
    this.advance();
  }

  // ── Écran Désignation des épaves ─────────────────────────────────────────────

  onDesignationNext(result: WreckDesignationResult): void {
    this.wreckedVehicles.set(result.wreckedVehicles);
    this.rawDestroyedVehicles.set(result.destroyedVehicles);
    this.batchReady.emit(this.buildRecordResultDto(result.destroyedVehicles));
    // N'avance PAS ici : l'effect() ci-dessus fait avancer vers 'resolution'
    // une fois `resultRecorded` reçu du parent (persistance confirmée).
  }

  /** Construit le lot à persister — forme dépend du type de partie (cf. en-tête de fichier). */
  private buildRecordResultDto(destroyedVehiclesMap: ReadonlyMap<number, DestroyedVehicleDto[]>): RecordResultDto {
    if (this.game().type === 'EVENEMENT_TELE') {
      const gatesMap = new Map(this.gatesEntries().map((g) => [g.participantId, g.gatesCrossed]));
      return {
        results: this.rankingResult().map((r) => ({
          participantId: r.participantId,
          rank: r.rank,
          gatesCrossed: gatesMap.get(r.participantId) || undefined,
          destroyedVehicles: destroyedVehiclesMap.get(r.participantId),
        })),
      };
    }

    const destroyedVehicles: EscarmoucheDestroyedVehicleDto[] = Array.from(destroyedVehiclesMap.entries())
      .flatMap(([destroyerId, list]) => list.map((d) => ({ destroyerId, vehicleId: d.vehicleId })));

    return {
      jerricanGains: this.jerricanGainEntries().length > 0 ? this.jerricanGainEntries() : undefined,
      destroyedVehicles: destroyedVehicles.length > 0 ? destroyedVehicles : undefined,
    };
  }

  // ── Écran Résolution (automatique, cf. effect ci-dessus) ─────────────────────

  onWreckCompleted(): void {
    this.wizardCompleted.emit();
  }

  // ── Navigation commune ────────────────────────────────────────────────────────

  private advance(): void {
    this.currentStepIndex.update((i) => Math.min(i + 1, this.activeSteps().length - 1));
  }

  goBack(): void {
    this.currentStepIndex.update((i) => Math.max(0, i - 1));
  }

  onCancel(): void {
    this.formCancel.emit();
  }
}
