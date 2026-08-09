import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ITokenIssuer } from '../domain/token-issuer.interface';
import type { IUserRepository } from '../domain/user.repository.interface';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import { userDomainToDto } from '../infrastructure/user-http.mapper';

export interface ImpersonateUserCommand {
  targetUserId: number;
}

/**
 * Émet un JWT valide pour un AUTRE utilisateur, sans connaître son mot de
 * passe ("se connecter en tant que") - réservé aux administrateurs
 * (`@Roles(UserRole.ADMIN)` au niveau du controller). La garde (jamais un
 * autre admin, compte actif) vit dans `User.assertImpersonatableBy`.
 *
 * Retourne la même forme que `LoginUseCase` (`AuthResponseDto`) : le frontend
 * réutilise ainsi exactement le même mécanisme de session pour basculer sur
 * l'identité usurpée. Le token émis ne porte aucune marque particulière -
 * l'état "usurpation en cours" est une notion purement frontend (pas
 * d'audit log ni de restriction serveur associée à ce stade).
 */
export class ImpersonateUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tokenIssuer: ITokenIssuer,
  ) {}

  async execute(cmd: ImpersonateUserCommand): Promise<AuthResponseDto> {
    const target = await this.userRepo.findById(cmd.targetUserId);
    if (!target) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    try {
      target.assertImpersonatableBy();
    } catch (e) {
      if (e instanceof DomainException) throw new ForbiddenException(e.message);
      throw e;
    }

    return { access_token: this.tokenIssuer.issue(target), user: userDomainToDto(target) };
  }
}
