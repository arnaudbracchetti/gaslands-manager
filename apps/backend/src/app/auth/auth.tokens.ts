/**
 * Tokens d'injection NestJS pour les interfaces du domaine.
 *
 * Une interface TypeScript n'existe pas à l'exécution : elle ne peut donc pas
 * servir de clé d'injection. On passe par des tokens string, et les use cases
 * sont fournis en `useFactory` dans `auth.module.ts` - c'est ce qui permet au
 * domaine de rester sans décorateur NestJS (même pattern que `team.tokens.ts`).
 */
export const USER_REPOSITORY = 'USER_REPOSITORY';
export const PASSWORD_HASHER = 'PASSWORD_HASHER';
export const TOKEN_ISSUER = 'TOKEN_ISSUER';
export const CAPTCHA_VERIFIER = 'CAPTCHA_VERIFIER';
