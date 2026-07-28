import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { IUserRepository } from '../domain/user.repository.interface';
import type { UserResponseDto } from '../dto/user-response.dto';
import { userDomainToDto } from '../infrastructure/user-http.mapper';

export interface SetActiveCommand {
  userId: number;
  requesterId: number;
  isActive: boolean;
}

/**
 * Active ou désactive un compte (administration). Un compte désactivé conserve
 * toutes ses données mais ne peut plus se connecter.
 *
 * Même traduction en 403 que `RemoveUserUseCase` : l'auto-désactivation est un
 * refus d'autorisation, et les deux refus sont conceptuellement identiques —
 * ils doivent donc rendre le même code HTTP.
 */
export class SetActiveUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(cmd: SetActiveCommand): Promise<UserResponseDto> {
    const user = await this.userRepo.findById(cmd.userId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    try {
      user.setActive(cmd.isActive, cmd.requesterId);
    } catch (e) {
      if (e instanceof DomainException) throw new ForbiddenException(e.message);
      throw e;
    }

    return userDomainToDto(await this.userRepo.save(user));
  }
}
