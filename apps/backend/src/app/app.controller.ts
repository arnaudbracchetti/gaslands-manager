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

  // Sondée par le futur healthcheck Docker (P0-8). @SkipThrottle() anticipe
  // P0-5 (ThrottlerGuard posé globalement) — un healthcheck ne doit jamais
  // se faire limiter en débit par sa propre API. Le SELECT 1 n'est jamais
  // catché : si la base est indisponible, l'exception remonte en 500, le
  // signal exact qu'un healthcheck Docker doit voir pour marquer le
  // conteneur "unhealthy".
  @Get('health')
  @SkipThrottle()
  async getHealth(): Promise<{ status: 'ok' }> {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok' };
  }
}
