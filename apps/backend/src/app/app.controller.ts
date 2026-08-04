import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  // Le type de retour reprend exactement celui de AppService.getData().
  // TypeScript vérifierait une incohérence à la compilation.
  getData(): { message: string } {
    return this.appService.getData();
  }

  // Sondée par le futur healthcheck Docker (P0-8) — un healthcheck ne doit
  // jamais se faire limiter en débit par sa propre API. Les deux throttlers
  // nommés enregistrés dans AppModule (P0-5) doivent être sautés
  // explicitement : `@SkipThrottle()` sans argument ne saute que le
  // throttler `default`, `secondary` resterait sinon actif (avec sa config
  // par défaut, inoffensive mais incohérente avec l'intention "jamais
  // throttlé"). Le SELECT 1 n'est jamais catché : si la base est
  // indisponible, l'exception remonte en 500, le signal exact qu'un
  // healthcheck Docker doit voir pour marquer le conteneur "unhealthy".
  @Get('health')
  @SkipThrottle({ default: true, secondary: true })
  async getHealth(): Promise<{ status: 'ok' }> {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok' };
  }
}
