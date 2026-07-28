import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IUserRepository } from '../domain/user.repository.interface';
import { UserRole } from '../domain/user-role';
import { User } from '../domain/user';
import { UserMapper } from './user.mapper';
import { UserOrm } from './entities/user.entity';

/** Violation de contrainte UNIQUE en PostgreSQL — ici, l'email déjà pris. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Implémentation TypeORM d'`IUserRepository`.
 *
 * Porte la seule règle du compte que l'agrégat ne peut pas garantir seul :
 * l'unicité de l'email, déléguée à la contrainte `unique` de PostgreSQL et
 * traduite ici en `ConflictException` (HTTP 409). L'agrégat n'a
 * structurellement pas la donnée nécessaire (les autres utilisateurs) — c'est
 * l'exception légitime à "toute règle vit dans le domaine".
 */
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserOrm)
    private readonly userRepo: Repository<UserOrm>,
  ) {}

  async findById(id: number): Promise<User | null> {
    const orm = await this.userRepo.findOne({ where: { id } });
    return orm ? UserMapper.toDomain(orm) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const orm = await this.userRepo.findOne({ where: { email } });
    return orm ? UserMapper.toDomain(orm) : null;
  }

  async findAll(): Promise<User[]> {
    const rows = await this.userRepo.find();
    return rows.map((orm) => UserMapper.toDomain(orm));
  }

  /** Recherche par RÔLE, jamais par email — c'est ce qui garantit l'unicité du compte admin. */
  async findAdmin(): Promise<User | null> {
    const orm = await this.userRepo.findOne({ where: { role: UserRole.ADMIN } });
    return orm ? UserMapper.toDomain(orm) : null;
  }

  async save(user: User): Promise<User> {
    // Recharger la ligne existante avant d'y reporter l'agrégat : `save()` sur
    // une entité partielle écraserait les colonnes non renseignées.
    const existing = user.id !== 0 ? await this.userRepo.findOne({ where: { id: user.id } }) : null;
    const orm = UserMapper.toOrm(user, existing ?? new UserOrm());

    try {
      return UserMapper.toDomain(await this.userRepo.save(orm));
    } catch (err: unknown) {
      // `unknown` est plus sûr que `any` : TypeScript force le narrowing avant l'accès.
      const pgError = err as { code?: string };
      if (pgError?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      throw new InternalServerErrorException("Erreur lors de l'enregistrement du compte");
    }
  }

  async remove(id: number): Promise<void> {
    const result = await this.userRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Utilisateur introuvable');
    }
  }
}
