import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { redisConnection } from '../infrastructure/job-queue.service';
import { AiTranslateModule } from '../ai-translate/ai-translate.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ExportDataService } from './export-data.service';
import { JobsProcessor } from './jobs.processor';
import { WebhookDeliveryService } from './webhook-delivery.service';

/**
 * `JobQueueService` (infrastructure) faqat PRODUCER — navbatga job
 * qo'shadi. Aynan shu modul CONSUMER tomonini ta'minlaydi: Redis
 * sozlanmagan bo'lsa (masalan lokal dev'da) `safaar-background` nomli
 * BullMQ worker Redis'ga ulanishga urinadi va ulanolmasa fon rejimida
 * qayta-qayta urinaveradi — bu ilovaning ishga tushishini bloklamaydi.
 */
@Module({
  imports: [
    UploadsModule,
    AiTranslateModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl =
          config.get<string>('QUEUE_REDIS_URL') ??
          config.get<string>('REDIS_URL') ??
          'redis://localhost:6379/0';
        return { connection: redisConnection(redisUrl) };
      },
    }),
    BullModule.registerQueue({ name: 'safaar-background' }),
  ],
  providers: [JobsProcessor, ExportDataService, WebhookDeliveryService],
})
export class JobsModule {}
