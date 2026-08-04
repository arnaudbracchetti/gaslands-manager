import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app/app.module';

const DEFAULT_CORS_ORIGIN = 'http://localhost:4200';

// Promise<void> : bootstrap est async et ne retourne rien (appelée en fire-and-forget).
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Le backend est placé derrière un unique reverse proxy public (Caddy) —
  // "1" fait confiance au premier hop uniquement, jamais à un en-tête
  // X-Forwarded-For arbitraire fourni directement par le client.
  app.set('trust proxy', 1);

  // La CSP vit exclusivement dans Caddy (qui sert le HTML) — deux sources de
  // CSP sur la même réponse rendrait l'application cassée sans savoir quel
  // en-tête gagne. Les autres protections par défaut de helmet (anti-sniffing,
  // anti-clickjacking...) restent actives.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Le corps le plus volumineux de l'API (RecordResultDto) reste très en
  // dessous de ces limites — coupe court à un corps de requête abusif avant
  // même qu'un ValidationPipe ne s'en occupe.
  app.use(json({ limit: '128kb' }));
  app.use(urlencoded({ limit: '16kb', extended: false }));

  // Préfixe global : toutes les routes seront /api/...
  // Exemple : GET /api/content au lieu de GET /content
  app.setGlobalPrefix('api');

  // CORS_ORIGIN (env.validation.ts) : chaîne unique, origines séparées par
  // des virgules, obligatoire seulement en production. En dev/test/e2e, où
  // elle est absente, on retombe sur l'origine historique du frontend local.
  const config = app.get(ConfigService);
  const corsOrigin = config.get<string>('CORS_ORIGIN');
  const allowedOrigins = corsOrigin
    ? corsOrigin
        .split(',')
        .map((origin: string): string => origin.trim())
        .filter((origin: string): boolean => origin.length > 0)
    : [DEFAULT_CORS_ORIGIN];
  app.enableCors({ origin: allowedOrigins });

  // parseInt() convertit le string d'env en number.
  // Le second argument (10) est la base décimale — toujours le préciser pour éviter les surprises.
  const port: number = parseInt(process.env.PORT ?? '3000', 10);

  // '0.0.0.0' force l'écoute sur toutes les interfaces IPv4, nécessaire
  // pour que le proxy de dev (apps/frontend/proxy.conf.cjs) accède au backend.
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Backend Gaslands démarré sur http://localhost:${port}/api`);
}

bootstrap();
