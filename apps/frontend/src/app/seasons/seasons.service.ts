/**
 * SeasonsService — service Angular pour les appels HTTP vers /api/seasons.
 *
 * Même rôle que TeamsService : encapsule la communication réseau, pas de
 * logique métier. authInterceptor ajoute automatiquement le header JWT.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Season, CreateSeasonDto, SeasonSummary, JoinSeasonDto } from './season.model';

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
}
