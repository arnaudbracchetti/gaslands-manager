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
 */
export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}
