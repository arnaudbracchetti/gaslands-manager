/**
 * UserService — gestion des utilisateurs en base de données.
 *
 * Ce service est la seule couche qui touche directement au Repository TypeORM
 * de l'entité User. Il encapsule les opérations CRUD de base et la logique
 * de sécurité liée au mot de passe.
 *
 * Principes appliqués :
 * - Le mot de passe ne sort JAMAIS de ce service : la méthode `sanitize()`
 *   l'exclut de tous les objets retournés.
 * - Le hachage bcrypt (coût 10) est fait ici, pas dans AuthService,
 *   pour que UserService soit la seule source de vérité sur le stockage du mdp.
 */

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { RegisterDto } from './dto/register.dto';
import { User } from './user.entity';

// Type utilitaire TypeScript : User sans le champ sensible `password`
export type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UserService {
  // @InjectRepository(User) : NestJS fournit le Repository TypeORM
  // correspondant à l'entité User (configuré dans auth.module.ts)
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Cherche un utilisateur par email (pour la connexion).
   * Retourne l'entité complète (avec password hash) car AuthService
   * en a besoin pour comparer avec bcrypt.compare().
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  /**
   * Cherche un utilisateur par id (pour le JWT strategy / GET /me).
   * Retourne l'objet SANS le champ password.
   */
  async findById(id: number): Promise<SafeUser | null> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    return this.sanitize(user);
  }

  /**
   * Crée un nouvel utilisateur en base.
   *
   * Étapes :
   * 1. Hachage bcrypt du mot de passe (coût 10 = ~100ms, protection contre brute-force)
   * 2. Sauvegarde TypeORM
   * 3. Retour sans mot de passe
   *
   * Gestion des erreurs :
   * - Code PostgreSQL 23505 = violation de contrainte UNIQUE → email déjà pris
   *   On lève ConflictException (HTTP 409) avec un message lisible.
   */
  async create(dto: RegisterDto): Promise<SafeUser> {
    // bcrypt.hash(plainText, saltRounds) : plus saltRounds est élevé,
    // plus le hachage est lent (protection brute-force). 10 est le standard.
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email.toLowerCase().trim(),
      password: hashedPassword,
    });

    try {
      const saved = await this.userRepo.save(user);
      return this.sanitize(saved);
    } catch (err: any) {
      // Code d'erreur PostgreSQL pour violation de contrainte unique
      if (err?.code === '23505') {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      throw new InternalServerErrorException('Erreur lors de la création du compte');
    }
  }

  /**
   * Supprime le champ `password` d'un objet User avant de le retourner.
   * La déstructuration `{ password, ...safe }` crée un nouvel objet sans la clé.
   */
  private sanitize(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user;
    return safe;
  }
}
