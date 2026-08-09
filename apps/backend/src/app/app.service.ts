import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  getData(): { message: string } {
    return { message: 'Hello API' };
  }

  // IMAGE_TAG absent/vide → null, jamais une valeur de repli comme
  // "latest" (qui n'est pas un numéro de version, cf. env.validation.ts) —
  // le frontend n'affiche alors simplement aucun badge.
  getVersion(): { version: string | null } {
    const tag = this.config.get<string>('IMAGE_TAG');
    return { version: tag ? tag : null };
  }
}
