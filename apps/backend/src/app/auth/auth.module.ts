/**
 * AuthModule — module NestJS du domaine Authentification (architecture DDD,
 * même standard que TeamModule / CampaignModule).
 *
 * Câblage : les interfaces du domaine (`IUserRepository`, `IPasswordHasher`,
 * `ITokenIssuer`) n'existent pas à l'exécution — elles sont fournies via les
 * tokens string d'`auth.tokens.ts`, et les use cases sont construits en
 * `useFactory` pour rester des classes pures, sans décorateur NestJS.
 *
 * JwtModule.registerAsync() est préférable à register() : il permet de lire la
 * config depuis ConfigService (variables d'environnement) plutôt que de coder
 * en dur les valeurs.
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSeedService } from './admin-seed.service';
import { PASSWORD_HASHER, TOKEN_ISSUER, USER_REPOSITORY } from './auth.tokens';
import { ChangePasswordUseCase } from './application/change-password.usecase';
import { ListUsersUseCase } from './application/list-users.usecase';
import { LoginUseCase } from './application/login.usecase';
import { RegisterUseCase } from './application/register.usecase';
import { RemoveUserUseCase } from './application/remove-user.usecase';
import { SetActiveUseCase } from './application/set-active.usecase';
import { UpdateProfileUseCase } from './application/update-profile.usecase';
import { AuthController } from './auth.controller';
import type { IPasswordHasher } from './domain/password-hasher.interface';
import type { ITokenIssuer } from './domain/token-issuer.interface';
import type { IUserRepository } from './domain/user.repository.interface';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { UserOrm } from './infrastructure/entities/user.entity';
import { JwtTokenIssuer } from './infrastructure/jwt-token-issuer';
import { UserRepository } from './infrastructure/user.repository';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { UsersController } from './users.controller';

@Module({
  imports: [
    // Rend Repository<UserOrm> injectable dans UserRepository
    TypeOrmModule.forFeature([UserOrm]),

    // PassportModule enregistre l'infrastructure Passport dans NestJS
    PassportModule,

    JwtModule.registerAsync({
      // ConfigModule doit être importé pour utiliser ConfigService ici
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRATION', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    // ── Adaptateurs des interfaces du domaine ──────────────────────────────
    { provide: USER_REPOSITORY, useClass: UserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    {
      provide: TOKEN_ISSUER,
      useFactory: (jwt: JwtService): JwtTokenIssuer => new JwtTokenIssuer(jwt),
      inject: [JwtService],
    },

    // ── Use cases ──────────────────────────────────────────────────────────
    {
      provide: RegisterUseCase,
      useFactory: (r: IUserRepository, h: IPasswordHasher, t: ITokenIssuer): RegisterUseCase =>
        new RegisterUseCase(r, h, t),
      inject: [USER_REPOSITORY, PASSWORD_HASHER, TOKEN_ISSUER],
    },
    {
      provide: LoginUseCase,
      useFactory: (r: IUserRepository, h: IPasswordHasher, t: ITokenIssuer): LoginUseCase =>
        new LoginUseCase(r, h, t),
      inject: [USER_REPOSITORY, PASSWORD_HASHER, TOKEN_ISSUER],
    },
    {
      provide: UpdateProfileUseCase,
      useFactory: (r: IUserRepository): UpdateProfileUseCase => new UpdateProfileUseCase(r),
      inject: [USER_REPOSITORY],
    },
    {
      provide: ChangePasswordUseCase,
      useFactory: (r: IUserRepository, h: IPasswordHasher): ChangePasswordUseCase =>
        new ChangePasswordUseCase(r, h),
      inject: [USER_REPOSITORY, PASSWORD_HASHER],
    },
    {
      provide: ListUsersUseCase,
      useFactory: (r: IUserRepository): ListUsersUseCase => new ListUsersUseCase(r),
      inject: [USER_REPOSITORY],
    },
    {
      provide: RemoveUserUseCase,
      useFactory: (r: IUserRepository): RemoveUserUseCase => new RemoveUserUseCase(r),
      inject: [USER_REPOSITORY],
    },
    {
      provide: SetActiveUseCase,
      useFactory: (r: IUserRepository): SetActiveUseCase => new SetActiveUseCase(r),
      inject: [USER_REPOSITORY],
    },

    JwtStrategy,      // stratégie Passport pour valider les JWT entrants
    AdminSeedService, // crée/resynchronise le compte admin au démarrage (OnModuleInit)
    RolesGuard,       // garde de rôle pour UsersController (@Roles(UserRole.ADMIN))
  ],
  // USER_REPOSITORY est exporté pour les modules qui doivent résoudre un
  // utilisateur (le mapper ORM→domaine, lui, est une fonction pure importée
  // directement — cf. UserMapper, utilisé par CampaignQueryService).
  exports: [USER_REPOSITORY],
})
export class AuthModule {}
