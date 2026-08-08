import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { IPasswordHasher } from '../domain/password-hasher.interface';
import type { IUserRepository } from '../domain/user.repository.interface';

export interface AdminResetPasswordCommand {
  userId: number;
  requesterId: number;
  newPassword: string;
}

/**
 * Réinitialise le mot de passe d'un compte tiers (administration). Même
 * traduction en 403 que `SetActiveUseCase`/`RemoveUserUseCase` : l'auto-
 * ciblage est un refus d'autorisation, pas une erreur de saisie.
 *
 * Pas de `@LogUseCase()` : il journaliserait le nouveau mot de passe en clair.
 */
export class AdminResetPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly hasher: IPasswordHasher,
  ) {}

  async execute(cmd: AdminResetPasswordCommand): Promise<void> {
    const user = await this.userRepo.findById(cmd.userId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    try {
      await user.resetPasswordAsAdmin(cmd.newPassword, cmd.requesterId, this.hasher);
    } catch (e) {
      if (e instanceof DomainException) throw new ForbiddenException(e.message);
      throw e;
    }

    await this.userRepo.save(user);
  }
}
