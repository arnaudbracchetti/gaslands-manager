/**
 * Décorateur @Roles(...) — attache la liste des rôles autorisés à un handler
 * ou un controller, sous forme de métadonnées lues ensuite par RolesGuard.
 *
 * SetMetadata(clé, valeur) est la primitive NestJS pour attacher des données
 * arbitraires à une classe/méthode, récupérables via Reflector.
 *
 * Utilisation :
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.ADMIN)
 *   @Controller('users')
 *   export class UsersController { ... }
 */
import { SetMetadata } from '@nestjs/common';
import { UserRole } from './user.entity';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]): ReturnType<typeof SetMetadata> => SetMetadata(ROLES_KEY, roles);
