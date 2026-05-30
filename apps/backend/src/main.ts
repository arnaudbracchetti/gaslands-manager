import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Préfixe global : toutes les routes seront /api/...
  // Exemple : GET /api/content au lieu de GET /content
  app.setGlobalPrefix('api');

  // CORS : autorise le frontend Angular (port 4200) à appeler notre API
  // Sans ça, le navigateur bloquerait les requêtes cross-origin
  app.enableCors({
    origin: 'http://localhost:4200',
  });

  const port = process.env.PORT || 3000;

  // '0.0.0.0' force l'écoute sur toutes les interfaces IPv4.
  // Sans cet argument, Node.js écoute sur '::' (IPv6 uniquement) sur Windows,
  // ce qui fait que 127.0.0.1 est refusé par le proxy Vite (ECONNREFUSED).
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Backend Gaslands démarré sur http://localhost:${port}/api`);
}

bootstrap();
