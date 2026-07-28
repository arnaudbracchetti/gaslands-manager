import { BadRequestException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { IPasswordHasher } from '../domain/password-hasher.interface';
import type { IUserRepository } from '../domain/user.repository.interface';
import type { ChangePasswordDto } from '../dto/change-password.dto';

export interface ChangePasswordCommand extends ChangePasswordDto {
  userId: number;
}

/**
 * Changement de mot de passe par l'utilisateur connecté.
 *
 * "Utilisateur introuvable" est un 400 et non un 404 : l'appelant est
 * authentifié, un compte manquant signifie un token émis pour un compte
 * supprimé entre-temps — comportement historique conservé.
 *
 * Pas de `@LogUseCase()` : il journaliserait les deux mots de passe en clair.
 */
export class ChangePasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly hasher: IPasswordHasher,
  ) {}

  async execute(cmd: ChangePasswordCommand): Promise<void> {
    const user = await this.userRepo.findById(cmd.userId);
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    try {
      await user.changePassword(cmd.currentPassword, cmd.newPassword, this.hasher);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    await this.userRepo.save(user);
  }
}
