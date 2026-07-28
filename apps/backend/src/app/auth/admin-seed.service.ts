/**
 * AdminSeedService — crée et resynchronise le compte administrateur au démarrage.
 *
 * Lifecycle hook OnModuleInit (même pattern que CatalogService) : exécuté une
 * seule fois, après l'initialisation du module, avant que le serveur n'accepte
 * des requêtes.
 *
 * Règles :
 * - Un seul compte admin peut exister (recherche par RÔLE, jamais par email) :
 *   s'il en existe déjà un, on ne le duplique jamais.
 * - S'il n'existe pas, on le crée avec ADMIN_EMAIL/ADMIN_PASSWORD (.env).
 * - S'il existe, on resynchronise ADMIN_EMAIL et ADMIN_PASSWORD si l'une ou
 *   l'autre de ces valeurs a changé dans .env depuis le dernier démarrage.
 *   Un warning est loggé dans les deux cas pour signaler la mise à jour en base.
 * - ADMIN_PASSWORD est obligatoire (getOrThrow) : pas de valeur par défaut pour
 *   un secret, même logique que DATABASE_PASSWORD dans app.module.ts.
 *
 * Ce service reste un service NestJS (et non un use case) : il n'est déclenché
 * par aucune requête HTTP, seulement par le cycle de vie du module. Il passe en
 * revanche par le repository et l'agrégat comme tout le reste — aucune écriture
 * directe, aucun appel à bcrypt.
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PASSWORD_HASHER, USER_REPOSITORY } from './auth.tokens';
import type { IPasswordHasher } from './domain/password-hasher.interface';
import { User } from './domain/user';
import type { IUserRepository } from './domain/user.repository.interface';

@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger: Logger = new Logger(AdminSeedService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly hasher: IPasswordHasher,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config
      .get<string>('ADMIN_EMAIL', 'admin@gaslands.local')
      .toLowerCase()
      .trim();
    const password = this.config.getOrThrow<string>('ADMIN_PASSWORD');

    const existingAdmin = await this.userRepo.findAdmin();

    if (!existingAdmin) {
      const admin = await User.registerAdmin(
        { firstName: 'Admin', lastName: 'Gaslands', pseudo: 'Admin', email, password },
        this.hasher,
      );
      await this.userRepo.save(admin);
      this.logger.log(`Compte admin créé (${email})`);
      return;
    }

    if (existingAdmin.email !== email) {
      this.logger.warn(
        `ADMIN_EMAIL (.env) = "${email}" ne correspond pas à l'email admin ` +
          `existant ("${existingAdmin.email}"). Mise à jour en base.`,
      );
      existingAdmin.changeEmail(email);
      await this.userRepo.save(existingAdmin);
    }

    const passwordMatches = await this.hasher.compare(password, existingAdmin.passwordHash);
    if (!passwordMatches) {
      this.logger.warn('ADMIN_PASSWORD (.env) a changé. Mise à jour du hash en base.');
      await existingAdmin.resetPassword(password, this.hasher);
      await this.userRepo.save(existingAdmin);
    }
  }
}
