import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ICampaignRepository } from '../../campaign/domain/campaign.repository.interface';
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
 *
 * La garde "ne laisse jamais une campagne sans organisateur `VALIDATED`" est
 * une orchestration cross-agrégat (`User` ne connaît pas les campagnes,
 * `Campaign` n'est pas chargée ici) — traduite en 400 (règle d'état, pas
 * d'autorisation), même registre que `Campaign.assertNotLastOrganizer`. La
 * résolution passe par l'usurpation d'identité (`ImpersonateUserUseCase`) :
 * l'admin peut promouvoir un autre organisateur en agissant temporairement
 * comme le compte à supprimer, puis retenter la suppression.
 */
export class RemoveUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly campaignRepo: ICampaignRepository,
  ) {}

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

    const orphaned = await this.campaignRepo.findCampaignsWhereSoleValidatedOrganizer(cmd.userId);
    if (orphaned.length > 0) {
      const names = orphaned.map((c) => c.name).join(', ');
      throw new BadRequestException(
        `La suppression de ce compte laisserait les campagnes suivantes sans organisateur : ${names}. ` +
          'Promouvez un autre organisateur (via l\'usurpation d\'identité si nécessaire) avant de supprimer ce compte.',
      );
    }

    await this.userRepo.remove(cmd.userId);
  }
}
