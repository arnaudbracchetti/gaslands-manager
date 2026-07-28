import type { IUserRepository } from '../domain/user.repository.interface';
import type { UserResponseDto } from '../dto/user-response.dto';
import { userDomainToDto } from '../infrastructure/user-http.mapper';

/** Liste tous les comptes (administration). Aucune règle : lecture pure. */
export class ListUsersUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(): Promise<UserResponseDto[]> {
    const users = await this.userRepo.findAll();
    return users.map(userDomainToDto);
  }
}
