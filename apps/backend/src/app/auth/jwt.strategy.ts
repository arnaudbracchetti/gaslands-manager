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

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from './user.service';

// Le payload est ce qu'on a mis dans jwtService.sign({ sub: userId, email })
interface JwtPayload {
  sub: number;  // "sub" = subject = identifiant de l'utilisateur (convention JWT)
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      // Où chercher le token dans la requête HTTP
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Ne pas ignorer les tokens expirés
      ignoreExpiration: false,
      // Clé secrète pour vérifier la signature (doit correspondre à celle utilisée pour signer)
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Appelée par Passport après vérification réussie du token.
   * Le résultat est attaché à req.user dans le contrôleur.
   *
   * On recharge l'utilisateur depuis la base pour avoir des données fraîches
   * (et pour que req.user soit un objet User complet, pas juste le payload JWT).
   */
  async validate(payload: JwtPayload) {
    // Retourne SafeUser (sans password) ou null si l'utilisateur a été supprimé
    return this.userService.findById(payload.sub);
  }
}
