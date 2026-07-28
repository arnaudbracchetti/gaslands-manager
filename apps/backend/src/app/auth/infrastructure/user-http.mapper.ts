import type { UserResponseDto } from '../dto/user-response.dto';
import type { User } from '../domain/user';

/**
 * Traduit l'agrégat `User` en DTO HTTP sérialisable.
 *
 * Indispensable, pas cosmétique : `JSON.stringify()` ne sérialise PAS les
 * accesseurs `get` d'un prototype de classe. Renvoyer un `User` de domaine tel
 * quel ferait disparaître `callName` de la réponse sans la moindre erreur —
 * même piège que celui documenté pour `vehicleDomainToDto` (ARCHITECTURE.md §3.4).
 * Ce mapper matérialise le getter en champ plat.
 *
 * Le hash de mot de passe n'est jamais recopié : c'est ce qui remplace l'ancien
 * `UserService.sanitize()`.
 */
export function userDomainToDto(user: User): UserResponseDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    pseudo: user.pseudo,
    callName: user.callName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
