import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  // Le type de retour reprend exactement celui de AppService.getData().
  // TypeScript vérifierait une incohérence à la compilation.
  getData(): { message: string } {
    return this.appService.getData();
  }
}
