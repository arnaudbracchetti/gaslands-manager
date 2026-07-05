/**
 * CampaignsService — service Angular pour les appels HTTP vers /api/campaigns.
 *
 * Même rôle que TeamsService : encapsule la communication réseau, pas de
 * logique métier. authInterceptor ajoute automatiquement le header JWT.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Campaign, CreateCampaignDto, CampaignSummary, JoinCampaignDto, ChangeStateDto } from './campaign.model';
import { CampaignParticipant, StandingsEntry, ValidateParticipantDto } from './campaign-participant.model';
import type {
  Game,
  Scenario,
  CreateGameDto,
  UpdateGameDto,
  GameResult,
  RecordResultDto,
  ParticipantVehiclesDto,
  WreckResolveRequestDto,
  WreckResolveResultDto,
  EnterAtelierResultDto,
} from './game.model';

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private http: HttpClient = inject(HttpClient);

  /**
   * GET /api/campaigns → saisons où l'utilisateur connecté a un participant.
   */
  getAll(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>('/api/campaigns');
  }

  /**
   * GET /api/campaigns/pending → saisons où l'utilisateur connecté a une
   * demande d'inscription en attente de validation.
   */
  getPending(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>('/api/campaigns/pending');
  }

  /**
   * GET /api/campaigns/organizing/pending-requests → saisons organisées par
   * l'utilisateur connecté ayant au moins une demande d'inscription en attente.
   */
  getOrganizingPendingRequests(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>('/api/campaigns/organizing/pending-requests');
  }

  /**
   * POST /api/campaigns → crée une nouvelle saison.
   * Retourne la saison créée (avec inviteCode généré, participantCount: 1, myRole: 'organizer').
   */
  create(dto: CreateCampaignDto): Observable<Campaign> {
    return this.http.post<Campaign>('/api/campaigns', dto);
  }

  /**
   * GET /api/campaigns/by-code/:code → informations minimales d'une saison
   * (nom, état, organisateur) à partir de son code d'invitation.
   */
  getByCode(code: string): Observable<CampaignSummary> {
    return this.http.get<CampaignSummary>(`/api/campaigns/by-code/${code}`);
  }

  /**
   * POST /api/campaigns/:id/participants → crée une demande d'inscription
   * (status: PENDING) pour l'équipe choisie.
   */
  requestJoin(campaignId: number, dto: JoinCampaignDto): Observable<unknown> {
    return this.http.post(`/api/campaigns/${campaignId}/participants`, dto);
  }

  /**
   * GET /api/campaigns/:id → détail d'une saison (participant VALIDATED uniquement).
   */
  getOne(id: number): Observable<Campaign> {
    return this.http.get<Campaign>(`/api/campaigns/${id}`);
  }

  /**
   * GET /api/campaigns/:id/participants → tous les participants de la saison
   * (tous statuts), avec nom d'utilisateur et d'équipe.
   */
  getParticipants(campaignId: number): Observable<CampaignParticipant[]> {
    return this.http.get<CampaignParticipant[]>(`/api/campaigns/${campaignId}/participants`);
  }

  /**
   * PUT /api/campaigns/:id/participants/:pid/validate → valide ou refuse une
   * demande d'inscription (organisateur uniquement).
   */
  validateParticipant(campaignId: number, pid: number, dto: ValidateParticipantDto): Observable<CampaignParticipant> {
    return this.http.put<CampaignParticipant>(`/api/campaigns/${campaignId}/participants/${pid}/validate`, dto);
  }

  /**
   * DELETE /api/campaigns/:id/participants/:pid → retire un participant
   * (organisateur uniquement, saison EN_CONSTRUCTION uniquement).
   */
  removeParticipant(campaignId: number, pid: number): Observable<void> {
    return this.http.delete<void>(`/api/campaigns/${campaignId}/participants/${pid}`);
  }

  /**
   * PUT /api/campaigns/:id/participants/me → change l'équipe engagée par
   * l'utilisateur connecté (saison EN_CONSTRUCTION uniquement).
   */
  updateMyTeam(campaignId: number, dto: JoinCampaignDto): Observable<CampaignParticipant> {
    return this.http.put<CampaignParticipant>(`/api/campaigns/${campaignId}/participants/me`, dto);
  }

  /**
   * PUT /api/campaigns/:id/state → change l'état de la saison (organisateur uniquement).
   * Transitions bidirectionnelles.
   */
  changeState(campaignId: number, dto: ChangeStateDto): Observable<Campaign> {
    return this.http.put<Campaign>(`/api/campaigns/${campaignId}/state`, dto);
  }

  /**
   * PUT /api/campaigns/:id/participants/:pid/promote → promeut un participant
   * validé au rang de co-organisateur (organisateur uniquement).
   */
  promote(campaignId: number, pid: number): Observable<CampaignParticipant> {
    return this.http.put<CampaignParticipant>(`/api/campaigns/${campaignId}/participants/${pid}/promote`, {});
  }

  /**
   * DELETE /api/campaigns/:id → supprime définitivement la saison
   * (organisateur uniquement). Cascade sur les participants ; les équipes
   * des participants ne sont pas affectées.
   */
  remove(campaignId: number): Observable<void> {
    return this.http.delete<void>(`/api/campaigns/${campaignId}`);
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
   * GET /api/campaigns/:id/games → programme de la saison, trié
   * (tout participant VALIDATED).
   */
  getGames(campaignId: number): Observable<Game[]> {
    return this.http.get<Game[]>(`/api/campaigns/${campaignId}/games`);
  }

  /**
   * POST /api/campaigns/:id/games → ajoute une partie au programme
   * (organisateur, saison EN_COURS).
   */
  createGame(campaignId: number, dto: CreateGameDto): Observable<Game> {
    return this.http.post<Game>(`/api/campaigns/${campaignId}/games`, dto);
  }

  /**
   * PUT /api/campaigns/:id/games/:gameId → modifie une partie PLANIFIE
   * (organisateur, saison EN_COURS).
   */
  updateGame(campaignId: number, gameId: number, dto: UpdateGameDto): Observable<Game> {
    return this.http.put<Game>(`/api/campaigns/${campaignId}/games/${gameId}`, dto);
  }

  /**
   * DELETE /api/campaigns/:id/games/:gameId → supprime une partie PLANIFIE
   * (organisateur, saison EN_COURS).
   */
  deleteGame(campaignId: number, gameId: number): Observable<void> {
    return this.http.delete<void>(`/api/campaigns/${campaignId}/games/${gameId}`);
  }

  /**
   * POST /api/campaigns/:id/games/:gameId/results → enregistre les résultats
   * d'une partie PLANIFIE (classement + exploits, organisateur). Ne fait PAS
   * entrer la partie en atelier — elle reste PLANIFIE jusqu'à l'appel explicite
   * de `enterAtelier()` en fin de wizard (écran 3).
   */
  recordResult(campaignId: number, gameId: number, dto: RecordResultDto): Observable<Game> {
    return this.http.post<Game>(`/api/campaigns/${campaignId}/games/${gameId}/results`, dto);
  }

  /**
   * GET /api/campaigns/:id/games/:gameId/results → récupère tous les résultats
   * enregistrés d'une partie (tout participant VALIDATED).
   */
  getGameResults(campaignId: number, gameId: number): Observable<GameResult[]> {
    return this.http.get<GameResult[]>(`/api/campaigns/${campaignId}/games/${gameId}/results`);
  }

  /**
   * GET /api/campaigns/:id/standings → classement des participants VALIDATED
   * avec équipe, trié par Points de Championnat décroissants.
   */
  getStandings(campaignId: number): Observable<StandingsEntry[]> {
    return this.http.get<StandingsEntry[]>(`/api/campaigns/${campaignId}/standings`);
  }

  /**
   * GET /api/campaigns/:id/games/:gameId/participant-vehicles → véhicules
   * courants (hors perdus) des participants indiqués (organisateur), pour le
   * picker "véhicules ennemis détruits" du formulaire de résultat (exploit, US-B2).
   */
  getParticipantVehicles(
    campaignId: number,
    gameId: number,
    participantIds: number[],
  ): Observable<ParticipantVehiclesDto[]> {
    return this.http.get<ParticipantVehiclesDto[]>(
      `/api/campaigns/${campaignId}/games/${gameId}/participant-vehicles`,
      { params: { participantIds: participantIds.join(',') } },
    );
  }

  /**
   * POST /api/campaigns/:id/games/:gameId/events/wreck → résout la Table des
   * Épaves pour un véhicule (D6 serveur, organisateur). Toute perte d'équipement
   * est tirée au hasard côté serveur — aucun choix à transmettre.
   */
  resolveWreck(
    campaignId: number,
    gameId: number,
    dto: WreckResolveRequestDto,
  ): Observable<WreckResolveResultDto> {
    return this.http.post<WreckResolveResultDto>(
      `/api/campaigns/${campaignId}/games/${gameId}/events/wreck`,
      dto,
    );
  }

  /**
   * POST /api/campaigns/:id/games/:gameId/enter-atelier → fait entrer la partie
   * en atelier (PLANIFIE → ATELIER). Déclenché à la toute fin du wizard de fin
   * de partie (écran 3), pas à la soumission du classement (cf. `recordResult`).
   * `autoClosedGameId` signale qu'une autre partie encore en atelier a été
   * automatiquement clôturée (ATELIER → JOUE) par cet appel.
   */
  enterAtelier(campaignId: number, gameId: number): Observable<EnterAtelierResultDto> {
    return this.http.post<EnterAtelierResultDto>(
      `/api/campaigns/${campaignId}/games/${gameId}/enter-atelier`,
      {},
    );
  }
}
