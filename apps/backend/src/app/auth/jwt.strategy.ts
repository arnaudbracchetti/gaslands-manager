/**
 * JWT Strategy — valide les tokens JWT dans les requêtes entrantes.
 *
 * Passport est une bibliothèque Node.js de stratégies d'authentification.
 * Une "stratégie" définit COMMENT extraire et valider les credentials.
 *
 * Fonctionnement de JwtStrategy :
 * 1. Le guard JwtAuthGuard (qui hérite de AuthGuard('jwt')) est déclenché
 *    sur les routes protégées.
 * 2. Passport appelle cette stratégie automatiquement.
 * 3. ExtractJwt.fromAuthHeaderAsBearerToken() lit le header :
 *    Authorization: Bearer <token>
 * 4. Le token est vérifié (signature + expiration) avec JWT_SECRET.
 * 5. Si valide, la méthode validate() est appelée avec le payload décodé.
 * 6. La valeur retournée par validate() est attachée à req.user.
 */

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DomainException } from '../shared/domain/domain-exception';
import { USER_REPOSITORY } from './auth.tokens';
import type { User } from './domain/user';
import type { UserRole } from './domain/user-role';
import type { IUserRepository } from './domain/user.repository.interface';

// Le payload est ce qu'on a mis dans JwtTokenIssuer.issue()
interface JwtPayload {
  sub: number;  // "sub" = subject = identifiant de l'utilisateur (convention JWT)
  email: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {
    super({
      // Où chercher le token dans la requête HTTP
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Ne pas ignorer les tokens expirés
      ignoreExpiration: false,
      // JWT_SECRET est déjà garanti présent par EnvVars/validateEnv (config/
      // env.validation.ts), vérifié au tout premier démarrage du module de
      // configuration — getOrThrow() reste une défense en profondeur peu
      // coûteuse plutôt qu'une seconde source de vérité.
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Appelée par Passport après vérification réussie du token.
   *
   * Retourne l'AGRÉGAT de domaine, pas un objet plat : c'est ce qui rend
   * `req.user.callName` disponible dans tous les controllers (y compris ceux
   * de `team/` et `campaign/`, pour le nom du joueur sur la fiche d'équipe).
   * Corollaire : un controller ne renvoie jamais `req.user` tel quel en réponse
   * HTTP — toujours via `userDomainToDto`, sinon le getter est perdu.
   *
   * On recharge depuis la base pour disposer de données fraîches (rôle,
   * activation) plutôt que de faire confiance au payload du token.
   * null = compte supprimé depuis l'émission du token → 401 automatique.
   *
   * `assertCanHoldSession()` (agrégat `User`) coupe l'accès d'un compte
   * désactivé immédiatement, sans attendre l'expiration du JWT (jusqu'à 7
   * jours) — la `DomainException` est traduite ici en `UnauthorizedException`
   * plutôt que laissée remonter à Passport, qui ne ferait pas cette traduction
   * (elle deviendrait un 500 non géré).
   */
  async validate(payload: JwtPayload): Promise<User | null> {
    const user = await this.userRepo.findById(payload.sub);
    if (!user) return null;

    try {
      user.assertCanHoldSession();
    } catch (e) {
      if (e instanceof DomainException) throw new UnauthorizedException(e.message);
      throw e;
    }

    return user;
  }
}
