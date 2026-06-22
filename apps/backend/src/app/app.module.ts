import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/user.entity';
import { CatalogModule } from './catalog/catalog.module';
import { ContentModule } from './content/content.module';
import { TeamModule } from './team/team.module';
import { Team } from './team/team.entity';
import { SeasonModule } from './season/season.module';
import { Season } from './season/season.entity';
import { SeasonParticipant } from './season/season-participant.entity';
import { GameModule } from './game/game.module';
import { Game } from './game/game.entity';
import { VehicleModule } from './vehicle/vehicle.module';
import { Vehicle, VehicleImprovement } from './vehicle/vehicle.entity';
import { WeaponModule } from './weapon/weapon.module';
import { Weapon } from './weapon/weapon.entity';

@Module({
  imports: [
    // ConfigModule lit le fichier .env et rend les variables accessibles partout
    // isGlobal: true = pas besoin de l'importer dans chaque module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/backend/.env',
    }),

    // TypeOrmModule se connecte à PostgreSQL en lisant les variables du ConfigModule
    // forRootAsync = attend que ConfigModule soit chargé avant de se connecter
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.get('DATABASE_USER', 'gaslands'),
        // getOrThrow : refuse de démarrer si DATABASE_PASSWORD est absente du .env.
        // Pas de valeur par défaut pour un secret — mieux vaut un crash explicite
        // qu'une app qui tourne silencieusement avec un mot de passe connu de tous.
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.get('DATABASE_NAME', 'gaslands'),
        // Toutes les entités TypeORM doivent être listées ici
        // TypeORM crée ou met à jour les tables correspondantes (synchronize: true)
        entities: [Team, User, Vehicle, VehicleImprovement, Weapon, Season, SeasonParticipant, Game],
        // synchronize: true = TypeORM crée/modifie les tables automatiquement
        // ⚠️ À désactiver en production ! En prod, on utilise des migrations.
        synchronize: true,
        logging: false,
      }),
    }),

    // Nos modules métier
    ContentModule, // Lecture des fichiers Markdown
    TeamModule,    // Gestion des équipes Gaslands
    VehicleModule, // Véhicules d'équipe + améliorations (Pattern Decorator)
    WeaponModule,  // Armes montées sur les véhicules d'équipe
    AuthModule,    // Inscription, connexion, JWT
    CatalogModule, // Catalogue de jeu chargé au démarrage (sponsors, véhicules, armes, améliorations)
    SeasonModule,  // Saisons (ligues) regroupant plusieurs équipes et organisateurs
    GameModule,    // Programme Télé (parties planifiées) du mode campagne
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
