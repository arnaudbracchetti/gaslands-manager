import { DomainException } from '../../shared/domain/domain-exception';
import type { CampaignParticipant } from './campaign-participant';
import type { Game } from './games/game';
import type { GameEvent } from './events/game-event';
import { GameStatus } from './enums/game-status.enum';
import { AtelierGame } from './games/atelier-game';

export interface StandingsEntry {
  participantId: number;
  userId: number;
  teamId: number;
  teamName: string;
  championshipPoints: number;
  wallet: number;
  // resistancePoints délibérément absent — secret (cf. D-S4)
}

/**
 * Agrégat racine du domaine campagne — GoF Invoker de haut niveau.
 *
 * Centralise le replay du journal d'événements et les transitions d'état des parties.
 * Toutes les mutations (finalizeGame, closeCampaign) s'opèrent en mémoire ; le repository
 * se charge de persister l'état résultant.
 */
export class Campaign {
  constructor(
    readonly id: number,
    private readonly _participants: CampaignParticipant[],
    private readonly _games: Game[],
  ) {}

  get participants(): readonly CampaignParticipant[] { return this._participants; }
  get games(): readonly Game[] { return this._games; }

  findGame(gameId: number): Game {
    const g = this._games.find((x) => x.id === gameId);
    if (!g) throw new DomainException(`Partie #${gameId} introuvable dans la saison`);
    return g;
  }

  findParticipant(participantId: number): CampaignParticipant {
    const p = this._participants.find((x) => x.id === participantId);
    if (!p) throw new DomainException(`Participant #${participantId} introuvable dans la saison`);
    return p;
  }

  // ── Replay ───────────────────────────────────────────────────────────────────

  /**
   * Rejoue l'intégralité du journal du début à la fin.
   * Remet tous les compteurs et états campagne à zéro avant de commencer.
   */
  replay(): void {
    for (const p of this._participants) {
      p.reset();  // wallet = team.cans, PC = 0, PR = 0 + team.resetCampaignState()
    }
    const sorted = [...this._games].sort((a, b) => a.order - b.order);
    for (const game of sorted) {
      game.apply(this._participants);
    }
  }

  /**
   * Rejoue jusqu'à la partie dont l'ordre est strictement inférieur à celui de `gameId`.
   * Utile pour corriger / annuler un événement en cours de saison.
   */
  replayUpTo(gameId: number): void {
    const target = this.findGame(gameId);
    for (const p of this._participants) {
      p.reset();
    }
    const sorted = [...this._games]
      .filter((g) => g.order < target.order)
      .sort((a, b) => a.order - b.order);
    for (const game of sorted) {
      game.apply(this._participants);
    }
  }

  // ── Classement ───────────────────────────────────────────────────────────────

  /**
   * Classement public trié par Points de Championnat décroissants.
   * `resistancePoints` délibérément exclus (secret — cf. D-S4).
   */
  standings(): StandingsEntry[] {
    return [...this._participants]
      .filter((p) => p.team !== undefined)
      .sort((a, b) => b.championshipPoints - a.championshipPoints)
      .map((p) => ({
        participantId: p.id,
        userId: p.userId,
        teamId: p.teamId,
        teamName: p.team.name,
        championshipPoints: p.championshipPoints,
        wallet: p.wallet,
      }));
  }

  // ── Cycle de vie des parties ─────────────────────────────────────────────────

  /**
   * Finalise une partie (PLANIFIE → JOUE) et ouvre un AtelierGame intercalé.
   *
   * 1. La partie passe à JOUE.
   * 2. L'AtelierGame OUVERT courant (s'il existe) passe à CLOTURE.
   * 3. Un nouvel AtelierGame OUVERT est créé à `game.order + 0.5`.
   *
   * Le nouvel atelier a id=0 (le repository lui assignera un vrai id à la persistance).
   */
  finalizeGame(gameId: number): AtelierGame {
    const game = this.findGame(gameId);
    if (game.status !== GameStatus.PLANIFIE) {
      throw new DomainException('Seule une partie PLANIFIE peut être finalisée');
    }

    // Muter le statut en mémoire (le mapper lit la propriété au save)
    (game as unknown as { status: GameStatus }).status = GameStatus.JOUE;
    (game as unknown as { playedAt: Date }).playedAt = new Date();

    // Clore l'atelier précédent s'il existe
    const openAtelier = this._games.find(
      (g) => g instanceof AtelierGame && g.status === GameStatus.OUVERT,
    );
    if (openAtelier) {
      (openAtelier as unknown as { status: GameStatus }).status = GameStatus.CLOTURE;
    }

    // Ouvrir un nouvel atelier intercalé après la partie finalisée
    const newAtelier = new AtelierGame(0, this.id, GameStatus.OUVERT, game.order + 0.5, []);
    this._games.push(newAtelier);
    return newAtelier;
  }

  /**
   * Clôture de saison (EN_COURS → TERMINEE) : ferme le dernier atelier OUVERT.
   * Appelé par le use case de transition d'état de saison.
   */
  closeCampaign(): void {
    for (const game of this._games) {
      if (game instanceof AtelierGame && game.status === GameStatus.OUVERT) {
        (game as unknown as { status: GameStatus }).status = GameStatus.CLOTURE;
      }
    }
  }

  // ── Ajout d'un événement (write-time) ────────────────────────────────────────

  /**
   * Valide et enregistre un événement dans la partie, puis l'applique immédiatement.
   * Le repository persiste l'événement après cette méthode.
   */
  applyNewEvent(gameId: number, event: GameEvent): void {
    const game = this.findGame(gameId);
    game.addEvent(event);
    event.execute([...this._participants]);
  }
}
