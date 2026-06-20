/**
 * AdminSeedService — crée et resynchronise le compte administrateur au démarrage.
 *
 * Lifecycle hook OnModuleInit (même pattern que CatalogService) : exécuté une
 * seule fois, après l'initialisation du module, avant que le serveur n'accepte
 * des requêtes.
 *
 * Règles :
 * - Un seul compte admin peut exister (recherche par `role: ADMIN`, jamais par
 *   email) : s'il en existe déjà un, on ne le duplique jamais.
 * - S'il n'existe pas, on le crée avec ADMIN_EMAIL/ADMIN_PASSWORD (.env).
 * - S'il existe, on resynchronise ADMIN_EMAIL et ADMIN_PASSWORD si l'une ou
 *   l'autre de ces valeurs a changé dans .env depuis le dernier démarrage.
 *   Un warning est loggé dans les deux cas pour signaler la mise à jour en base.
 * - ADMIN_PASSWORD est obligatoire (getOrThrow) : pas de valeur par défaut pour
 *   un secret, même logique que DATABASE_PASSWORD dans app.module.ts.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger: Logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config
      .get<string>('ADMIN_EMAIL', 'admin@gaslands.local')
      .toLowerCase()
      .trim();
    const password = this.config.getOrThrow<string>('ADMIN_PASSWORD');

    const existingAdmin = await this.userRepo.findOne({
      where: { role: UserRole.ADMIN },
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await this.userRepo.save(
        this.userRepo.create({
          firstName: 'Admin',
          lastName: 'Gaslands',
          email,
          password: hashedPassword,
          role: UserRole.ADMIN,
        }),
      );
      this.logger.log(`Compte admin créé (${email})`);
      return;
    }

    if (existingAdmin.email !== email) {
      this.logger.warn(
        `ADMIN_EMAIL (.env) = "${email}" ne correspond pas à l'email admin ` +
          `existant ("${existingAdmin.email}"). Mise à jour en base.`,
      );
      existingAdmin.email = email;
      await this.userRepo.save(existingAdmin);
    }

    const passwordMatches = await bcrypt.compare(password, existingAdmin.password);
    if (!passwordMatches) {
      this.logger.warn('ADMIN_PASSWORD (.env) a changé. Mise à jour du hash en base.');
      existingAdmin.password = await bcrypt.hash(password, 10);
      await this.userRepo.save(existingAdmin);
    }
  }
}
