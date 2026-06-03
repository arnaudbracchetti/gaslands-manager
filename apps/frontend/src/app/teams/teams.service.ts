/**
 * TeamsService — service Angular pour les appels HTTP vers /api/teams.
 *
 * Ce service encapsule toute la communication réseau liée aux équipes.
 * Les composants ne construisent jamais d'URL ni n'appellent HttpClient directement :
 * ils passent par ce service. Avantages :
 * - Testabilité : on peut mocker ce service dans les tests de composants
 * - DRY : les URLs sont définies en un seul endroit
 * - Séparation : le composant gère l'UI, le service gère le réseau
 *
 * L'intercepteur authInterceptor (configuré dans app.config.ts) ajoute
 * automatiquement le header "Authorization: Bearer <token>" à chaque requête.
 * Ce service n'a donc pas besoin de gérer le JWT lui-même.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Team, CreateTeamDto, UpdateTeamDto } from './team.model';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  // inject() : syntaxe Angular moderne (équivalent au paramètre de constructeur).
  // Type explicite requis sur le membre de classe (règle memberVariableDeclaration).
  private http: HttpClient = inject(HttpClient);

  /**
   * GET /api/teams → liste des équipes de l'utilisateur connecté.
   * Le backend filtre automatiquement par userId grâce au JWT.
   */
  getAll(): Observable<Team[]> {
    return this.http.get<Team[]>('/api/teams');
  }

  /**
   * POST /api/teams → crée une nouvelle équipe.
   * Retourne l'équipe créée avec son id et ses timestamps.
   */
  create(dto: CreateTeamDto): Observable<Team> {
    return this.http.post<Team>('/api/teams', dto);
  }

  /**
   * PUT /api/teams/:id → met à jour une équipe existante.
   * On envoie uniquement les champs modifiés (UpdateTeamDto).
   */
  update(id: number, dto: UpdateTeamDto): Observable<Team> {
    return this.http.put<Team>(`/api/teams/${id}`, dto);
  }

  /**
   * DELETE /api/teams/:id → supprime une équipe.
   * Le backend vérifie que l'équipe appartient à l'utilisateur avant de supprimer.
   */
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/teams/${id}`);
  }
}
