import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ContentModule } from './content/content.module';
import { TeamModule } from './team/team.module';
import { Team } from './team/team.entity';

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
        password: config.get('DATABASE_PASSWORD', 'gaslands_pass'),
        database: config.get('DATABASE_NAME', 'gaslands'),
        entities: [Team],
        // synchronize: true = TypeORM crée/modifie les tables automatiquement
        // ⚠️ À désactiver en production ! En prod, on utilise des migrations.
        synchronize: true,
        logging: false,
      }),
    }),

    // Nos modules métier
    ContentModule, // Lecture des fichiers Markdown
    TeamModule,    // Gestion des équipes Gaslands
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
