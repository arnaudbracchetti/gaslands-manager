/**
 * Modèles TypeScript pour l'authentification (frontend).
 *
 * Ces interfaces définissent la "forme" des données échangées avec le backend.
 * Elles servent de contrat entre le frontend et l'API : si le backend change
 * la structure de sa réponse, TypeScript nous avertira ici.
 *
 * Note : les interfaces TypeScript sont effacées à la compilation (elles
 * n'existent pas en JavaScript). Elles n'ont un rôle qu'en développement.
 */

/**
 * Profil utilisateur (tel que renvoyé par /api/auth/me et dans AuthResponse).
 * Ne contient PAS le mot de passe (le backend l'exclut toujours).
 */
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  /**
   * Valeur BRUTE du pseudo. Sert uniquement à pré-remplir le champ éditable du
   * formulaire "Détails du compte" - pour afficher un utilisateur, utiliser
   * `callName` ci-dessous.
   */
  pseudo: string;
  /**
   * Nom d'affichage - À UTILISER PARTOUT où l'on montre "qui" est quelqu'un
   * (navbar, listes, en-têtes…). Champ calculé côté backend par le getter
   * `User.callName` de l'agrégat : la règle "quel nom afficher" n'existe qu'à
   * cet endroit-là, jamais dupliquée côté client.
   */
  callName: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: string; // TypeORM sérialise les dates en string ISO 8601
  updatedAt: string;
}

/**
 * Réponse renvoyée par /api/auth/login et /api/auth/register.
 * Le client stocke access_token dans localStorage et le renvoie
 * dans chaque requête via le header Authorization: Bearer <token>.
 */
export interface AuthResponse {
  access_token: string;
  user: User;
}

/**
 * Données envoyées au backend pour l'inscription.
 *
 * `captchaToken` (P0-6) : jeton résolu par le widget Turnstile - optionnel,
 * absent tant que `environment.turnstileSiteKey` est vide (dev/e2e).
 */
export interface RegisterDto {
  firstName: string;
  lastName: string;
  pseudo: string;
  email: string;
  password: string;
  captchaToken?: string;
}

/**
 * Données envoyées à PATCH /api/auth/me (auto-édition du profil).
 * Le rôle n'est jamais modifiable via ce DTO.
 */
export interface UpdateProfileDto {
  firstName: string;
  lastName: string;
  pseudo: string;
  email: string;
}

/**
 * Données envoyées à PATCH /api/auth/me/password (changement de mot de passe).
 */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
