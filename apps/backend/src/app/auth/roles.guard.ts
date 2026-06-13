/**
 * RolesGuard — vérifie que l'utilisateur connecté possède l'un des rôles
 * exigés par @Roles(...) sur le handler ou le controller.
 *
 * Doit être placé APRÈS JwtAuthGuard dans @UseGuards(...) : il dépend de
 * req.user, peuplé par JwtStrategy.validate() (qui retourne un SafeUser,
 * incluant `role`).
 *
 * Si aucune métadonnée @Roles n'est présente, l'accès est autorisé par
 * défaut — ce guard ne restreint que les routes qui l'exigent explicitement.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { UserRole } from './user.entity';

interface RequestWithUser {
  user: { role: UserRole };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    return true;
  }
}
