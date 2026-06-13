/**
 * UsersService — appels HTTP vers /api/users (administration des comptes).
 *
 * Réservé aux admins côté backend (RolesGuard) — ce service n'ajoute aucune
 * vérification de rôle, il fait confiance au backend pour renvoyer 403 si
 * l'utilisateur n'est pas admin (l'UI ne propose ces routes qu'aux admins,
 * cf. adminGuard et le lien navbar conditionnel).
 *
 * Mirroir de teams.service.ts.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../../auth/auth.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private http: HttpClient = inject(HttpClient);

  /**
   * GET /api/users → liste de tous les comptes enregistrés.
   */
  getAll(): Observable<User[]> {
    return this.http.get<User[]>('/api/users');
  }

  /**
   * DELETE /api/users/:id → supprime un compte (cascade équipes/véhicules).
   */
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/users/${id}`);
  }

  /**
   * PATCH /api/users/:id/active → active ou désactive un compte.
   */
  setActive(id: number, isActive: boolean): Observable<User> {
    return this.http.patch<User>(`/api/users/${id}/active`, { isActive });
  }
}
