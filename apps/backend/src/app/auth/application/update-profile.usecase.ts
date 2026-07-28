import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { IUserRepository } from '../domain/user.repository.interface';
import type { UpdateProfileDto } from '../dto/update-profile.dto';
import type { UserResponseDto } from '../dto/user-response.dto';
import { userDomainToDto } from '../infrastructure/user-http.mapper';

export interface UpdateProfileCommand extends UpdateProfileDto {
  userId: number;
}

/**
 * Auto-édition du profil. Le rôle n'est pas modifiable — garantie structurelle
 * de l'agrégat (`_role` est `readonly`), pas une vérification à répéter ici.
 */
export class UpdateProfileUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(cmd: UpdateProfileCommand): Promise<UserResponseDto> {
    const user = await this.userRepo.findById(cmd.userId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    try {
      user.updateProfile(cmd);
    } catch (e) {
      if (e instanceof DomainException) throw new BadRequestException(e.message);
      throw e;
    }

    return userDomainToDto(await this.userRepo.save(user));
  }
}
