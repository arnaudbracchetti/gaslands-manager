/**
 * CampaignsService — service Angular pour les appels HTTP vers /api/campaigns.
 *
 * Même rôle que TeamsService : encapsule la communication réseau, pas de
 * logique métier. authInterceptor ajoute automatiquement le header JWT.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Campaign, CreateCampaignDto, CampaignSummary, JoinCampaignDto, ChangeStateDto, UpdateCampaignDto } from './campaign.model';
import { CampaignParticipant, StandingsEntry, ValidateParticipantDto } from './campaign-participant.model';
import type {
  Game,
  GameType,
  Scenario,
  CreateGameDto,
  UpdateGameDto,
  GameResult,
  RecordResultDto,
  ParticipantVehiclesDto,
  WreckResolveRequestDto,
  WreckResolveResultDto,
  EnterAtelierResultDto,
  GameJournalEntryDto,
  ParticipantJournalEntryDto,
  RollIncomeRequestDto,
  RollIncomeResultDto,
} from './game.model';
import type { WorkshopStateDto, ChangeEquipmentDto, AvailableSequellaDto } from './workshop.model';
import type {
  AvailableWeaponDto,
  AvailableImprovementDto,
  AvailableAdvantageDto,
  AvailableVehicleDto,
} from '../teams/vehicle-configurator/vehicle-builder.model';

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
   * GET /api/campaigns/:id/participants/:pid/journal → historique complet d'un
   * participant à travers toutes les parties de la campagne — accessible à tout
   * participant VALIDATED, y compris pour consulter l'historique d'un tiers.
   * Retourné à plat ; le regroupement par partie est fait côté frontend.
   */
  getParticipantJournal(campaignId: number, pid: number): Observable<ParticipantJournalEntryDto[]> {
    return this.http.get<ParticipantJournalEntryDto[]>(
      `/api/campaigns/${campaignId}/participants/${pid}/journal`,
    );
  }

  /**
   * GET /api/campaigns/:id/participants/:pid/workshop → atelier d'UN AUTRE
   * participant, en lecture seule — même règle de visibilité que
   * `getParticipantJournal` (tout participant VALIDATED, y compris pour
   * consulter l'équipe d'un tiers). Même forme de réponse que `getWorkshop`.
   */
  getParticipantWorkshop(campaignId: number, pid: number): Observable<WorkshopStateDto> {
    return this.http.get<WorkshopStateDto>(`/api/campaigns/${campaignId}/participants/${pid}/workshop`);
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
   * PUT /api/campaigns/:id → modifie nom/budget (organisateur, EN_CONSTRUCTION
   * uniquement). Rejeté (400) si le budget rendrait une équipe déjà engagée
   * illégale au regard de son coût cumulé de véhicules.
   */
  update(campaignId: number, dto: UpdateCampaignDto): Observable<Campaign> {
    return this.http.put<Campaign>(`/api/campaigns/${campaignId}`, dto);
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
   * GET /api/catalog/scenarios/random?type=... → tirage D6 serveur (tableaux
   * officiels Gaslands p.128-129) — le frontend ne connaît jamais la table de
   * probabilités, seulement le résultat.
   */
  drawRandomScenario(type: GameType): Observable<Scenario> {
    return this.http.get<Scenario>(`/api/catalog/scenarios/random?type=${type}`);
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
   * PUT /api/campaigns/:id/games/reorder → réordonne les parties encore
   * PLANIFIE du programme (US-A4, organisateur). `gameIds` doit être
   * exactement l'ensemble de ces parties, dans le nouvel ordre voulu — les
   * parties ATELIER/JOUE gardent leur position, jamais transmises ici.
   */
  reorderGames(campaignId: number, gameIds: number[]): Observable<void> {
    return this.http.put<void>(`/api/campaigns/${campaignId}/games/reorder`, { gameIds });
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
   * DELETE /api/campaigns/:id/games/:gameId/results → annule le wizard de fin de
   * partie en cours de résolution (partie PLANIFIE, organisateur) : supprime tous
   * les événements déjà journalisés (classement, exploits, revenus, épaves).
   */
  resetResult(campaignId: number, gameId: number): Observable<void> {
    return this.http.delete<void>(`/api/campaigns/${campaignId}/games/${gameId}/results`);
  }

  /**
   * POST /api/campaigns/:id/games/:gameId/events/income → revenu de base
   * Escarmouche (1D6 serveur, organisateur), différé en fin de wizard avec les
   * tirages de la Table des Épaves.
   */
  rollIncome(campaignId: number, gameId: number, dto: RollIncomeRequestDto): Observable<RollIncomeResultDto> {
    return this.http.post<RollIncomeResultDto>(
      `/api/campaigns/${campaignId}/games/${gameId}/events/income`,
      dto,
    );
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

  /**
   * GET /api/campaigns/:id/games/:gameId/journal → journal complet d'une
   * partie (tous types d'événements, y compris atelier), accessible à tout
   * participant VALIDATED même absent de la partie. Retourné à plat, non
   * groupé — le regroupement par participant est fait côté frontend.
   */
  getGameJournal(campaignId: number, gameId: number): Observable<GameJournalEntryDto[]> {
    return this.http.get<GameJournalEntryDto[]>(
      `/api/campaigns/${campaignId}/games/${gameId}/journal`,
    );
  }

  // ── Atelier (mode campagne) ─────────────────────────────────────────────────

  /**
   * GET /api/campaigns/:id/workshop → état campagne de l'équipe du participant
   * connecté : cagnotte, véhicules (avec chocs/séquelles/entités transientes),
   * armes et améliorations. Alimente la page Atelier.
   */
  getWorkshop(campaignId: number): Observable<WorkshopStateDto> {
    return this.http.get<WorkshopStateDto>(`/api/campaigns/${campaignId}/workshop`);
  }

  /**
   * GET /api/campaigns/:id/sheet → fiche d'équipe exportable (document HTML complet,
   * imprimable en A4) de l'équipe engagée du participant connecté — chocs/séquelles
   * réels inclus (état après replay complet). `responseType: 'text'` : la réponse
   * est du HTML brut, pas du JSON.
   */
  getTeamSheet(campaignId: number): Observable<string> {
    return this.http.get(`/api/campaigns/${campaignId}/sheet`, { responseType: 'text' });
  }

  /**
   * GET /api/campaigns/:id/participants/:pid/sheet → fiche d'équipe exportable
   * d'UN AUTRE participant, réservée à l'organisateur (contrairement à
   * `getParticipantWorkshop`/`getParticipantJournal`, ouverts à tout participant
   * VALIDATED). `responseType: 'text'` : la réponse est du HTML brut.
   */
  getParticipantTeamSheet(campaignId: number, pid: number): Observable<string> {
    return this.http.get(`/api/campaigns/${campaignId}/participants/${pid}/sheet`, { responseType: 'text' });
  }

  /**
   * GET /api/campaigns/:id/workshop/vehicles/:vId/available-weapons → armes du
   * sponsor avec verdict de disponibilité pour un véhicule d'atelier (budget =
   * cagnotte du participant). Même forme que le verdict "construction d'équipe".
   */
  getWorkshopAvailableWeapons(campaignId: number, vehicleId: number): Observable<AvailableWeaponDto[]> {
    return this.http.get<AvailableWeaponDto[]>(
      `/api/campaigns/${campaignId}/workshop/vehicles/${vehicleId}/available-weapons`,
    );
  }

  /**
   * GET /api/campaigns/:id/workshop/vehicles/:vId/available-improvements →
   * améliorations du sponsor avec verdict (budget = cagnotte).
   */
  getWorkshopAvailableImprovements(campaignId: number, vehicleId: number): Observable<AvailableImprovementDto[]> {
    return this.http.get<AvailableImprovementDto[]>(
      `/api/campaigns/${campaignId}/workshop/vehicles/${vehicleId}/available-improvements`,
    );
  }

  /**
   * GET /api/campaigns/:id/workshop/vehicles/:vId/available-advantages →
   * avantages du sponsor avec verdict (budget = cagnotte, y compris Cascadeur/Sur Deux Roues).
   */
  getWorkshopAvailableAdvantages(campaignId: number, vehicleId: number): Observable<AvailableAdvantageDto[]> {
    return this.http.get<AvailableAdvantageDto[]>(
      `/api/campaigns/${campaignId}/workshop/vehicles/${vehicleId}/available-advantages`,
    );
  }

  /**
   * GET /api/campaigns/:id/workshop/vehicles/:vId/available-sequelles →
   * séquelles ATELIER avec verdict (monnaie Chocs, pas la cagnotte).
   */
  getWorkshopAvailableSequelles(campaignId: number, vehicleId: number): Observable<AvailableSequellaDto[]> {
    return this.http.get<AvailableSequellaDto[]>(
      `/api/campaigns/${campaignId}/workshop/vehicles/${vehicleId}/available-sequelles`,
    );
  }

  /**
   * GET /api/campaigns/:id/workshop/available-vehicles → véhicules du sponsor avec
   * verdict de disponibilité budgétaire pour l'achat d'un nouveau véhicule en atelier
   * (budget = cagnotte du participant). Pas de `vehicleId` : aucun véhicule n'existe
   * encore avant cet achat — mirroir léger (`AvailableVehicleDto`) des 4 verdicts
   * ci-dessus, sans nom/prix/stats (déjà connus via `sponsorCatalog().vehicules`).
   */
  getWorkshopAvailableVehicles(campaignId: number): Observable<AvailableVehicleDto[]> {
    return this.http.get<AvailableVehicleDto[]>(`/api/campaigns/${campaignId}/workshop/available-vehicles`);
  }

  /**
   * POST /api/campaigns/:id/events/equipment → achat/revente d'équipement en
   * atelier (204 No Content). Le use case retrouve lui-même l'unique partie en
   * ATELIER de la campagne. L'appelant relit l'état via `getWorkshop` après coup.
   * Le montage sur Tourelle passe par ce même endpoint (`orientation: 'tourelle'`
   * dans le corps, WEAPON/BUY uniquement) — ce n'est pas une opération séparée.
   */
  changeEquipment(campaignId: number, dto: ChangeEquipmentDto): Observable<void> {
    return this.http.post<void>(`/api/campaigns/${campaignId}/events/equipment`, dto);
  }

  /**
   * POST /api/campaigns/:id/events/vehicle-rename → renomme un véhicule en Atelier
   * (204 No Content) — véhicule pré-existant ou transient de la session en cours,
   * aucune distinction côté appelant. Mirroir de `changeEquipment` ci-dessus.
   */
  renameVehicle(campaignId: number, vehicleId: number, nom: string): Observable<void> {
    return this.http.post<void>(`/api/campaigns/${campaignId}/events/vehicle-rename`, { vehicleId, nom });
  }
}
