import { UnauthorizedException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { IPasswordHasher } from '../domain/password-hasher.interface';
import type { ITokenIssuer } from '../domain/token-issuer.interface';
import type { IUserRepository } from '../domain/user.repository.interface';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import type { LoginDto } from '../dto/login.dto';
import { userDomainToDto } from '../infrastructure/user-http.mapper';

/**
 * Connexion. Les règles (mot de passe correct, compte actif) vivent dans
 * `User.assertCanAuthenticate` — ici, seulement l'orchestration et la
 * traduction HTTP.
 *
 * Traduit `DomainException` en **401** et non en 400 comme les autres use
 * cases : un échec d'authentification n'est pas une commande malformée, et
 * c'est le code que l'intercepteur/le frontend attendent déjà. Le refus lui-même
 * n'est pas réimplémenté ici — seul son transport diffère.
 *
 * Email inconnu et mot de passe faux produisent le MÊME message générique :
 * un attaquant ne peut pas déduire quels emails sont enregistrés.
 *
 * Pas de `@LogUseCase()` : il journaliserait le mot de passe en clair.
 */
export class LoginUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokenIssuer: ITokenIssuer,
  ) {}

  async execute(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    try {
      await user.assertCanAuthenticate(dto.password, this.hasher);
    } catch (e) {
      if (e instanceof DomainException) throw new UnauthorizedException(e.message);
      throw e;
    }

    return { access_token: this.tokenIssuer.issue(user), user: userDomainToDto(user) };
  }
}
