import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { IPasswordHasher } from '../domain/password-hasher.interface';
import type { ITokenIssuer } from '../domain/token-issuer.interface';
import type { IUserRepository } from '../domain/user.repository.interface';
import { User } from '../domain/user';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import type { RegisterDto } from '../dto/register.dto';
import { userDomainToDto } from '../infrastructure/user-http.mapper';

/**
 * Inscription : l'agrégat fabrique et valide, le repository persiste, le port
 * émet le jeton. Aucune règle ici — orchestration pure.
 *
 * Pas de `@LogUseCase()` : ce décorateur sérialise la commande entière dans les
 * logs, ce qui écrirait le mot de passe en clair.
 */
export class RegisterUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokenIssuer: ITokenIssuer,
  ) {}

  async execute(dto: RegisterDto): Promise<AuthResponseDto> {
    let user: User;
    try {
      user = await User.register(dto, this.hasher);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    // L'unicité de l'email est la seule règle hors agrégat : le repository la
    // traduit en ConflictException (409) depuis la contrainte PostgreSQL.
    const saved = await this.userRepo.save(user);

    return { access_token: this.tokenIssuer.issue(saved), user: userDomainToDto(saved) };
  }
}
