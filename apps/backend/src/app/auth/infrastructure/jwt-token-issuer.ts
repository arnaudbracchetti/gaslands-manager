import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ITokenIssuer } from '../domain/token-issuer.interface';
import type { User } from '../domain/user';

/**
 * Adaptateur du port `ITokenIssuer` vers `@nestjs/jwt`.
 *
 * Le payload est encodé (base64) mais PAS chiffré → aucune donnée sensible ne
 * doit y figurer. La sécurité repose sur la SIGNATURE, qui garantit
 * l'intégrité. `role` y est inclus pour que `RolesGuard` puisse trancher sans
 * requête supplémentaire.
 */
@Injectable()
export class JwtTokenIssuer implements ITokenIssuer {
  constructor(private readonly jwtService: JwtService) {}

  issue(user: User): string {
    return this.jwtService.sign({
      sub: user.id, // "sub" = subject, convention JWT RFC 7519
      email: user.email,
      role: user.role,
    });
  }
}
