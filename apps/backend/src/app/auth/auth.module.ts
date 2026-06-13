/**
 * AuthModule — module NestJS qui regroupe tous les providers d'authentification.
 *
 * Un module NestJS est un conteneur qui organise les providers (services, strategies, guards)
 * et déclare ce qui est disponible à l'extérieur via `exports`.
 *
 * Ce module configure :
 * 1. TypeOrmModule.forFeature([User]) → Repository<User> disponible via injection
 * 2. PassportModule → infrastructure Passport (strategies)
 * 3. JwtModule → JwtService configuré avec la clé secrète et l'expiration
 *
 * JwtModule.registerAsync() est préférable à JwtModule.register() car il permet
 * de lire la config depuis ConfigService (variables d'environnement) plutôt
 * que de coder en dur les valeurs.
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSeedService } from './admin-seed.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    // Rend Repository<User> injectable via @InjectRepository(User)
    TypeOrmModule.forFeature([User]),

    // PassportModule enregistre l'infrastructure Passport dans NestJS
    PassportModule,

    // JwtModule.registerAsync() : config asynchrone via ConfigService
    // Cela permet de lire JWT_SECRET depuis le fichier .env
    JwtModule.registerAsync({
      // ConfigModule doit être importé pour utiliser ConfigService ici
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRATION', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,      // logique métier auth (register, login)
    UserService,      // accès base de données utilisateurs
    JwtStrategy,      // stratégie Passport pour valider les JWT entrants
    AdminSeedService, // crée/resynchronise le compte admin au démarrage (OnModuleInit)
    RolesGuard,       // garde de rôle pour UsersController (@Roles(UserRole.ADMIN))
  ],
  // UserService est exporté pour être utilisable dans d'autres modules
  // (ex: futur TeamModule pour vérifier le propriétaire d'une équipe)
  exports: [UserService],
})
export class AuthModule {}
