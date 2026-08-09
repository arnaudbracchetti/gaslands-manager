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
import { AuthResponse, ChangePasswordDto, RegisterDto, UpdateProfileDto, User } from './auth.model';

// Clé de stockage du JWT dans localStorage
const TOKEN_KEY = 'gaslands_token';

// Clé de sauvegarde du token admin pendant une usurpation d'identité
// ("se connecter en tant que") - sa seule PRÉSENCE indique qu'une usurpation
// est en cours (cf. impersonationActive ci-dessous).
const ADMIN_BACKUP_TOKEN_KEY = 'gaslands_admin_backup_token';

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
   * Vrai pendant une usurpation d'identité admin ("se connecter en tant
   * que") — piloté explicitement par startImpersonation()/stopImpersonation()
   * ci-dessous, jamais recalculé depuis le contenu du token (aucune marque
   * n'y est ajoutée côté serveur, cf. ImpersonateUserUseCase). Initialisé à
   * la présence de la clé de sauvegarde, pour survivre à un rechargement de
   * page pendant l'usurpation.
   */
  readonly impersonationActive: WritableSignal<boolean> = signal<boolean>(
    localStorage.getItem(ADMIN_BACKUP_TOKEN_KEY) !== null,
  );

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
   * Auto-édition du profil (prénom/nom/email). Met à jour `currentUser`
   * avec la réponse serveur — la navbar (et le reste de l'app) reflète
   * immédiatement le changement, sans requête supplémentaire.
   */
  updateProfile(dto: UpdateProfileDto): Observable<void> {
    return this.http.patch<User>('/api/auth/me', dto).pipe(
      tap((user: User) => this.currentUser.set(user)),
      map(() => undefined),
    );
  }

  /**
   * Changement de mot de passe. 204 sans corps — aucune mise à jour de
   * `currentUser` nécessaire.
   */
  changePassword(dto: ChangePasswordDto): Observable<void> {
    return this.http.patch<void>('/api/auth/me/password', dto).pipe(map(() => undefined));
  }

  /**
   * Déconnexion.
   * Synchrone : pas de requête serveur nécessaire (JWT stateless).
   * On efface juste le token localement.
   */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    // Nettoyage défensif, même hors usurpation active : évite qu'une clé de
    // sauvegarde orpheline (ex. mot de passe changé pendant une usurpation,
    // qui force ce logout — cf. AUTH.md) fausse impersonationActive à la
    // prochaine connexion sur ce navigateur.
    localStorage.removeItem(ADMIN_BACKUP_TOKEN_KEY);
    this.impersonationActive.set(false);
    // signal.set(null) déclenche la mise à jour réactive de tous les
    // composants qui lisent currentUser() ou isLoggedIn()
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  /**
   * Bascule sur l'identité usurpée ("se connecter en tant que X") - réservé à
   * un administrateur, `res` provient de `UsersService.impersonate()`. Le
   * token admin courant est sauvegardé pour permettre stopImpersonation()
   * sans ré-authentification.
   */
  startImpersonation(res: AuthResponse): void {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (currentToken) {
      localStorage.setItem(ADMIN_BACKUP_TOKEN_KEY, currentToken);
    }
    localStorage.setItem(TOKEN_KEY, res.access_token);
    this.currentUser.set(res.user);
    this.impersonationActive.set(true);
    this.router.navigate(['/home']);
  }

  /**
   * Revient à la session admin d'origine. Navigue vers /admin/users plutôt
   * que de rester sur l'écran courant : celui-ci appartient très probablement
   * aux données de l'utilisateur usurpé, inaccessibles à l'admin réel.
   */
  stopImpersonation(): void {
    const adminToken = localStorage.getItem(ADMIN_BACKUP_TOKEN_KEY);
    if (!adminToken) {
      this.impersonationActive.set(false);
      return;
    }

    localStorage.setItem(TOKEN_KEY, adminToken);
    localStorage.removeItem(ADMIN_BACKUP_TOKEN_KEY);
    this.impersonationActive.set(false);

    this.http.get<User>('/api/auth/me').subscribe({
      next: (user: User) => {
        this.currentUser.set(user);
        this.router.navigate(['/admin/users']);
      },
      error: () => {
        // Le token admin sauvegardé n'est plus valide (ex. expiré) - repli
        // sur une déconnexion complète plutôt que de laisser une session
        // incohérente.
        this.logout();
      },
    });
  }
}
