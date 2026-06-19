/**
 * AuthService — service singleton d'authentification (frontend).
 *
 * C'est le cœur réactif du système de login. Il expose :
 * - `currentUser` : un Signal<User | null> accessible depuis toute l'application
 * - `isLoggedIn`  : un computed() Signal<boolean> dérivé de currentUser
 *
 * Pourquoi des Signals ?
 * Ce projet utilise Angular 21 en mode ZONELESS (sans zone.js).
 * En zoneless, les propriétés classiques (this.user = ...) ne déclenchent
 * PAS de mise à jour du template après une opération async.
 * Les Signals sont la solution : ils notifient Angular explicitement
 * quand leur valeur change, même sans zone.js.
 *
 * Signal vs Observable :
 * - Signal : valeur synchrone, lisible à tout moment avec user(), simple
 * - Observable : flux async, utile pour les requêtes HTTP (c'est pourquoi
 *   HttpClient retourne des Observable que l'on subscribe() ici)
 * - On convertit les Observables en Signals dans ce service (subscribe → set)
 *
 * providedIn: 'root' → singleton : une seule instance partagée par toute l'app.
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, ReplaySubject, tap, map } from 'rxjs';
import { AuthResponse, RegisterDto, User } from './auth.model';

// Clé de stockage du JWT dans localStorage
const TOKEN_KEY = 'gaslands_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // inject() : nouvelle syntaxe Angular (alternative au constructeur).
  // Les types membres de classe sont annotés explicitement (règle memberVariableDeclaration).
  private readonly http: HttpClient = inject(HttpClient);
  private readonly router: Router = inject(Router);

  /**
   * Signal principal : null = non connecté, User = connecté.
   * Toutes les autres réactivités dérivent de lui.
   *
   * Lecture dans un template : authService.currentUser()
   * Lecture dans du code TS  : this.currentUser()
   */
  // WritableSignal<T> : type retourné par signal(). Rend le contrat visible à la lecture du code.
  readonly currentUser: WritableSignal<User | null> = signal<User | null>(null);

  /**
   * Signal calculé : se met à jour automatiquement quand currentUser change.
   * computed() crée un Signal en lecture seule dont la valeur est dérivée.
   *
   * Usage dans le template : @if (authService.isLoggedIn()) { ... }
   */
  // Signal<boolean> : type retourné par computed() (lecture seule — pas WritableSignal).
  readonly isLoggedIn: Signal<boolean> = computed(() => this.currentUser() !== null);

  /**
   * Émet une fois (puis se complète) quand la restauration de session
   * (restoreSession()) est terminée — succès, échec ou absence de token.
   *
   * ReplaySubject(1) : tout abonné, même tardif, reçoit immédiatement la
   * valeur si elle a déjà été émise — évite une course entre `authGuard`
   * (exécuté très tôt, avant la réponse de GET /api/auth/me) et la
   * restauration du token depuis localStorage.
   */
  private readonly sessionReady$: ReplaySubject<void> = new ReplaySubject<void>(1);

  constructor() {
    // Au démarrage de l'application (quand ce service est instancié),
    // on vérifie si un token existe en localStorage (session précédente).
    // L'intercepteur ajoutera automatiquement ce token à la requête.
    this.restoreSession();
  }

  /**
   * Résout (émet puis se complète) une fois que la restauration de session
   * est terminée — à utiliser par `authGuard` pour ne pas rediriger vers
   * /login avant que GET /api/auth/me ait répondu (cf. sessionReady$).
   */
  whenSessionReady(): Observable<void> {
    return this.sessionReady$.asObservable();
  }

  /**
   * Restaure la session utilisateur depuis localStorage.
   * Appelé une seule fois au démarrage.
   */
  private restoreSession(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      this.sessionReady$.next();
      this.sessionReady$.complete();
      return;
    }

    // GET /api/auth/me vérifie que le token est encore valide
    // et retourne le profil utilisateur à jour
    this.http.get<User>('/api/auth/me').subscribe({
      // (user: User) : paramètre annoté car la règle `parameter: true` l'exige.
      next: (user: User) => {
        this.currentUser.set(user);
        this.sessionReady$.next();
        this.sessionReady$.complete();
      },
      error: () => {
        // Token expiré ou invalide → nettoyage silencieux
        localStorage.removeItem(TOKEN_KEY);
        this.currentUser.set(null);
        this.sessionReady$.next();
        this.sessionReady$.complete();
      },
    });
  }

  /**
   * Connexion.
   * Retourne un Observable<void> pour que le composant puisse
   * réagir au succès ou à l'erreur via .subscribe().
   */
  login(email: string, password: string): Observable<void> {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password })
      .pipe(
        // tap() exécute un effet de bord sans modifier la valeur
        // (res: AuthResponse) : paramètre annoté pour satisfaire la règle `parameter: true`.
        tap((res: AuthResponse) => {
          localStorage.setItem(TOKEN_KEY, res.access_token);
          this.currentUser.set(res.user);
        }),
        // On transforme AuthResponse en void : le composant n'a pas
        // besoin des détails, juste de savoir si c'est OK ou non
        map(() => undefined),
      );
  }

  /**
   * Inscription.
   */
  register(dto: RegisterDto): Observable<void> {
    return this.http
      .post<AuthResponse>('/api/auth/register', dto)
      .pipe(
        tap((res: AuthResponse) => {
          localStorage.setItem(TOKEN_KEY, res.access_token);
          this.currentUser.set(res.user);
        }),
        map(() => undefined),
      );
  }

  /**
   * Déconnexion.
   * Synchrone : pas de requête serveur nécessaire (JWT stateless).
   * On efface juste le token localement.
   */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    // signal.set(null) déclenche la mise à jour réactive de tous les
    // composants qui lisent currentUser() ou isLoggedIn()
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
