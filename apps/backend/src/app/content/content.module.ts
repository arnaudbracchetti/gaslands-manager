import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { DocsService } from './docs.service';

// Un module NestJS regroupe un Controller (routes HTTP) et un Service (logique métier)
@Module({
  controllers: [ContentController],
  providers: [ContentService, DocsService],
})
export class ContentModule {}
