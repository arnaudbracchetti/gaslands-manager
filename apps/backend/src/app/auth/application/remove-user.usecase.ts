import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { IUserRepository } from '../domain/user.repository.interface';

export interface RemoveUserCommand {
  userId: number;
  requesterId: number;
}

/**
 * Supprime un compte (cascade sur ses équipes/véhicules via les relations
 * TypeORM `onDelete: 'CASCADE'`).
 *
 * L'interdiction de s'auto-supprimer vit dans l'agrégat
 * (`User.assertRemovableBy`) et est traduite en 403 — un refus d'autorisation,
 * pas une commande malformée ; c'est le code déjà rendu avant la refonte.
 */
export class RemoveUserUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(cmd: RemoveUserCommand): Promise<void> {
    const user = await this.userRepo.findById(cmd.userId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    try {
      user.assertRemovableBy(cmd.requesterId);
    } catch (e) {
      if (e instanceof DomainException) throw new ForbiddenException(e.message);
      throw e;
    }

    await this.userRepo.remove(cmd.userId);
  }
}
