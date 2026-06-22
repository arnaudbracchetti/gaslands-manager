/**
 * SeasonsService — service Angular pour les appels HTTP vers /api/seasons.
 *
 * Même rôle que TeamsService : encapsule la communication réseau, pas de
 * logique métier. authInterceptor ajoute automatiquement le header JWT.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Season, CreateSeasonDto, SeasonSummary, JoinSeasonDto, ChangeStateDto } from './season.model';
import { SeasonParticipant, ValidateParticipantDto } from './season-participant.model';
import { Game, Scenario, CreateGameDto, UpdateGameDto } from './game.model';

@Injectable({ providedIn: 'root' })
export class SeasonsService {
  private http: HttpClient = inject(HttpClient);

  /**
   * GET /api/seasons → saisons où l'utilisateur connecté a un participant.
   */
  getAll(): Observable<Season[]> {
    return this.http.get<Season[]>('/api/seasons');
  }

  /**
   * GET /api/seasons/pending → saisons où l'utilisateur connecté a une
   * demande d'inscription en attente de validation.
   */
  getPending(): Observable<Season[]> {
    return this.http.get<Season[]>('/api/seasons/pending');
  }

  /**
   * GET /api/seasons/organizing/pending-requests → saisons organisées par
   * l'utilisateur connecté ayant au moins une demande d'inscription en attente.
   */
  getOrganizingPendingRequests(): Observable<Season[]> {
    return this.http.get<Season[]>('/api/seasons/organizing/pending-requests');
  }

  /**
   * POST /api/seasons → crée une nouvelle saison.
   * Retourne la saison créée (avec inviteCode généré, participantCount: 1, myRole: 'organizer').
   */
  create(dto: CreateSeasonDto): Observable<Season> {
    return this.http.post<Season>('/api/seasons', dto);
  }

  /**
   * GET /api/seasons/by-code/:code → informations minimales d'une saison
   * (nom, état, organisateur) à partir de son code d'invitation.
   */
  getByCode(code: string): Observable<SeasonSummary> {
    return this.http.get<SeasonSummary>(`/api/seasons/by-code/${code}`);
  }

  /**
   * POST /api/seasons/:id/participants → crée une demande d'inscription
   * (status: PENDING) pour l'équipe choisie.
   */
  requestJoin(seasonId: number, dto: JoinSeasonDto): Observable<unknown> {
    return this.http.post(`/api/seasons/${seasonId}/participants`, dto);
  }

  /**
   * GET /api/seasons/:id → détail d'une saison (participant VALIDATED uniquement).
   */
  getOne(id: number): Observable<Season> {
    return this.http.get<Season>(`/api/seasons/${id}`);
  }

  /**
   * GET /api/seasons/:id/participants → tous les participants de la saison
   * (tous statuts), avec nom d'utilisateur et d'équipe.
   */
  getParticipants(seasonId: number): Observable<SeasonParticipant[]> {
    return this.http.get<SeasonParticipant[]>(`/api/seasons/${seasonId}/participants`);
  }

  /**
   * PUT /api/seasons/:id/participants/:pid/validate → valide ou refuse une
   * demande d'inscription (organisateur uniquement).
   */
  validateParticipant(seasonId: number, pid: number, dto: ValidateParticipantDto): Observable<SeasonParticipant> {
    return this.http.put<SeasonParticipant>(`/api/seasons/${seasonId}/participants/${pid}/validate`, dto);
  }

  /**
   * DELETE /api/seasons/:id/participants/:pid → retire un participant
   * (organisateur uniquement, saison EN_CONSTRUCTION uniquement).
   */
  removeParticipant(seasonId: number, pid: number): Observable<void> {
    return this.http.delete<void>(`/api/seasons/${seasonId}/participants/${pid}`);
  }

  /**
   * PUT /api/seasons/:id/participants/me → change l'équipe engagée par
   * l'utilisateur connecté (saison EN_CONSTRUCTION uniquement).
   */
  updateMyTeam(seasonId: number, dto: JoinSeasonDto): Observable<SeasonParticipant> {
    return this.http.put<SeasonParticipant>(`/api/seasons/${seasonId}/participants/me`, dto);
  }

  /**
   * PUT /api/seasons/:id/state → change l'état de la saison (organisateur uniquement).
   * Transitions bidirectionnelles.
   */
  changeState(seasonId: number, dto: ChangeStateDto): Observable<Season> {
    return this.http.put<Season>(`/api/seasons/${seasonId}/state`, dto);
  }

  /**
   * PUT /api/seasons/:id/participants/:pid/promote → promeut un participant
   * validé au rang de co-organisateur (organisateur uniquement).
   */
  promote(seasonId: number, pid: number): Observable<SeasonParticipant> {
    return this.http.put<SeasonParticipant>(`/api/seasons/${seasonId}/participants/${pid}/promote`, {});
  }

  /**
   * DELETE /api/seasons/:id → supprime définitivement la saison
   * (organisateur uniquement). Cascade sur les participants ; les équipes
   * des participants ne sont pas affectées.
   */
  remove(seasonId: number): Observable<void> {
    return this.http.delete<void>(`/api/seasons/${seasonId}`);
  }

  // ── Programme Télé (mode campagne) ──────────────────────────────────────────

  /**
   * GET /api/catalog/scenarios → liste publique des scénarios du catalogue
   * (pour le formulaire d'ajout de partie).
   */
  getScenarios(): Observable<Scenario[]> {
    return this.http.get<Scenario[]>('/api/catalog/scenarios');
  }

  /**
   * GET /api/seasons/:id/games → programme de la saison, trié
   * (tout participant VALIDATED).
   */
  getGames(seasonId: number): Observable<Game[]> {
    return this.http.get<Game[]>(`/api/seasons/${seasonId}/games`);
  }

  /**
   * POST /api/seasons/:id/games → ajoute une partie au programme
   * (organisateur, saison EN_COURS).
   */
  createGame(seasonId: number, dto: CreateGameDto): Observable<Game> {
    return this.http.post<Game>(`/api/seasons/${seasonId}/games`, dto);
  }

  /**
   * PUT /api/seasons/:id/games/:gameId → modifie une partie PLANIFIE
   * (organisateur, saison EN_COURS).
   */
  updateGame(seasonId: number, gameId: number, dto: UpdateGameDto): Observable<Game> {
    return this.http.put<Game>(`/api/seasons/${seasonId}/games/${gameId}`, dto);
  }

  /**
   * DELETE /api/seasons/:id/games/:gameId → supprime une partie PLANIFIE
   * (organisateur, saison EN_COURS).
   */
  deleteGame(seasonId: number, gameId: number): Observable<void> {
    return this.http.delete<void>(`/api/seasons/${seasonId}/games/${gameId}`);
  }
}
