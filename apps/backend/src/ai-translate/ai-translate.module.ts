import { Module } from '@nestjs/common';
import { AiTranslateController } from './ai-translate.controller';
import { AiTranslateService } from './ai-translate.service';

@Module({
  controllers: [AiTranslateController],
  providers: [AiTranslateService],
})
export class AiTranslateModule {}
