import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { validateEnv } from './config/env.validation';
import { ContentModule } from './content/content.module';
import { TeamModule } from './team/team.module';
import { CampaignModule } from './campaign/campaign.module';
import { ALL_ENTITIES } from './entities';
import { ALL_MIGRATIONS } from '../migrations';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/backend/.env',
      // `validate` transforme/valide process.env au démarrage via `EnvVars`
      // (class-validator) — une variable manquante ou invalide fait échouer
      // le démarrage avec un message nommant la variable, plutôt que de
      // laisser `ConfigService.get()` renvoyer silencieusement `undefined`
      // en aval. `cache: true` évite de relire/revalider le fichier .env à
      // chaque `ConfigService.get()`.
      validate: validateEnv,
      cache: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.get('DATABASE_USER', 'gaslands'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.get('DATABASE_NAME', 'gaslands'),
        ssl: config.get<string>('DB_SSL') === 'true',
        entities: [...ALL_ENTITIES],
        migrations: [...ALL_MIGRATIONS],
        // `DB_SYNCHRONIZE` explicite (docker-compose.prod.yml, .env) gagne
        // toujours. Sinon, le défaut dépend de NODE_ENV : `true` en dev/test
        // (comportement historique préservé pour `frontend-e2e`, qui lance
        // `backend:serve --configuration=e2e` sans NODE_ENV=production ni
        // DB_SYNCHRONIZE dans apps/backend/.env — cf. backend-process.ts),
        // `false` en production, où le schéma évolue uniquement par les
        // migrations explicites de ALL_MIGRATIONS (cf. migrationsRun).
        synchronize:
          config.get<string>('DB_SYNCHRONIZE') !== undefined
            ? config.get<string>('DB_SYNCHRONIZE') === 'true'
            : config.get<string>('NODE_ENV') !== 'production',
        migrationsRun: config.get<string>('DB_MIGRATIONS_RUN') === 'true',
        logging: false,
      }),
    }),

    // Deux throttlers nommés : `default` porte la limite globale
    // (THROTTLE_TTL/THROTTLE_LIMIT) et est resserré par route via
    // `@Throttle()` (ex. AuthController). `secondary` partage les mêmes
    // valeurs par défaut — ThrottlerGuard compte par (contrôleur + handler +
    // nom de throttler), donc ce doublon ne collisionne jamais avec les
    // autres routes : il ne devient "actif" que là où une route le resserre
    // explicitement (double fenêtre de /auth/login, cf. spec P0-5). `skipIf`
    // est l'unique interrupteur : hors production, aucune route n'est
    // jamais limitée — `frontend-e2e` crée des dizaines de comptes et se
    // reconnecte en boucle sur 3 navigateurs, ce qui déclencherait des 429
    // dès le second spec sous les limites ci-dessous.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: seconds(config.get<number>('THROTTLE_TTL', 60)),
            limit: config.get<number>('THROTTLE_LIMIT', 300),
          },
          {
            name: 'secondary',
            ttl: seconds(config.get<number>('THROTTLE_TTL', 60)),
            limit: config.get<number>('THROTTLE_LIMIT', 300),
          },
        ],
        skipIf: (): boolean => config.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    ContentModule,
    TeamModule,
    AuthModule,
    CatalogModule,
    CampaignModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // P0-7 : valide/transforme tout @Body() entrant selon les décorateurs
    // class-validator des DTO (27 fichiers, apps/backend/src/app/{auth,team,
    // campaign}/dto/). `enableImplicitConversion: false` délibérément : une
    // conversion implicite transformerait une chaîne invalide en `NaN` sur
    // un `@IsInt()` plutôt que de produire une erreur lisible ; les
    // paramètres de route restent couverts par les `ParseIntPipe` déjà en
    // place. Pas de `disableErrorMessages` : les messages restent affichés
    // à l'utilisateur (UI francophone). `whitelist`/`forbidNonWhitelisted`
    // resserrés après audit des payloads Angular (`.post(`/`.patch(`/`.put(`
    // dans apps/frontend/src/app) confirmant qu'aucun champ non déclaré n'est
    // envoyé par le client.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    },
  ],
})
export class AppModule {}
