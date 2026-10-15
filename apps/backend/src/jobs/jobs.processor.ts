import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import type { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { AiTranslateService } from '../ai-translate/ai-translate.service';
import type { SupportedLanguage } from '../ai-translate/dto/ai-translate.dto';
import { PostgresService } from '../infrastructure/postgres.service';
import { UploadsService } from '../uploads/uploads.service';
import { ExportDataService } from './export-data.service';
import {
  contentTypeForFormat,
  extensionForFormat,
  renderExport,
} from './export-generators';
import { WebhookDeliveryService } from './webhook-delivery.service';

interface ExportJobRow {
  id: string;
  owner_type: string;
  owner_id: string;
  type: string;
  format: string;
}

const EXPORT_JOB_NAMES = new Set([
  'user-data-export',
  'export',
  'partner-export',
]);

@Processor('safaar-background')
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    private readonly pg: PostgresService,
    private readonly exportData: ExportDataService,
    private readonly uploads: UploadsService,
    private readonly webhooks: WebhookDeliveryService,
    @Optional() private readonly aiTranslate?: AiTranslateService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (EXPORT_JOB_NAMES.has(job.name)) {
      await this.processExport(job);
      return;
    }

    if (job.name === 'partner-webhook-delivery') {
      const deliveryId = String(
        (job.data as { delivery_id?: string }).delivery_id ?? '',
      );
      if (deliveryId) {
        await this.webhooks.deliver(deliveryId);
      }
      return;
    }

    if (job.name === 'entity-auto-translate') {
      await this.processAutoTranslate(job);
      return;
    }

    if (job.name === 'send-email') {
      // Email allaqachon navbatga qo'yilishidan OLDIN sinxron yuborilgan
      // (auth.service.ts) — bu job faqat audit yozuvi, bajarish shart emas.
      return;
    }

    this.logger.warn(`Noma'lum job turi e'tiborsiz qoldirildi: ${job.name}`);
  }

  private async processAutoTranslate(job: Job): Promise<void> {
    const data = job.data as {
      entityType?: string;
      entityId?: string;
      sourceLang?: SupportedLanguage;
      fields?: {
        name?: string;
        description?: string;
        short_description?: string;
      };
    };

    if (
      !data.entityType ||
      !data.entityId ||
      !data.fields ||
      !this.aiTranslate
    ) {
      return;
    }

    const now = new Date().toISOString();

    if (data.entityType === 'hotel') {
      const { name, description, short_description } = data.fields;
      let translatedName: { uz: string; ru: string; en: string } | null = null;
      let translatedDesc: { uz: string; ru: string; en: string } | null = null;
      let translatedShort: { uz: string; ru: string; en: string } | null = null;

      if (name) {
        translatedName = await this.aiTranslate.autoTranslateMultilingualField(
          name,
          data.sourceLang,
        );
      }
      if (description) {
        translatedDesc = await this.aiTranslate.autoTranslateMultilingualField(
          description,
          data.sourceLang,
        );
      }
      if (short_description) {
        translatedShort = await this.aiTranslate.autoTranslateMultilingualField(
          short_description,
          data.sourceLang,
        );
      }

      const languages: SupportedLanguage[] = ['uz', 'ru', 'en'];
      for (const lang of languages) {
        const n = translatedName?.[lang] || null;
        const d = translatedDesc?.[lang] || null;
        const s = translatedShort?.[lang] || null;

        if (n || d || s) {
          await this.pg.query(
            `INSERT INTO hotel_translations
               (id, hotel_id, language, name, description, short_description, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
             ON CONFLICT (hotel_id, language) DO UPDATE SET
               name = COALESCE(NULLIF(EXCLUDED.name, ''), hotel_translations.name),
               description = COALESCE(NULLIF(EXCLUDED.description, ''), hotel_translations.description),
               short_description = COALESCE(NULLIF(EXCLUDED.short_description, ''), hotel_translations.short_description),
               updated_at = EXCLUDED.updated_at`,
            [randomUUID(), data.entityId, lang, n ?? '', d ?? '', s ?? '', now],
          );
        }
      }

      await this.pg.query(
        `UPDATE hotels SET updated_at = $2 WHERE id = $1::uuid`,
        [data.entityId, now],
      );
      this.logger.log(`Hotel auto-translation completed for ${data.entityId}`);
    } else if (data.entityType === 'room_type') {
      const { name, description } = data.fields;
      if (name) {
        const translatedName =
          await this.aiTranslate.autoTranslateMultilingualField(
            name,
            data.sourceLang,
          );
        let descToSave = description;
        if (description) {
          const d = await this.aiTranslate.autoTranslateMultilingualField(
            description,
            data.sourceLang,
          );
          descToSave = d.ru || description;
        }

        await this.pg.query(
          `UPDATE room_types
           SET name = $2::jsonb, description = COALESCE($3, description), updated_at = $4
           WHERE id = $1::uuid`,
          [
            data.entityId,
            JSON.stringify(translatedName),
            descToSave ?? null,
            now,
          ],
        );
        this.logger.log(
          `RoomType auto-translation completed for ${data.entityId}`,
        );
      }
    } else if (data.entityType === 'room') {
      const { name } = data.fields;
      if (name) {
        const translatedName =
          await this.aiTranslate.autoTranslateMultilingualField(
            name,
            data.sourceLang,
          );
        for (const lang of ['uz', 'ru', 'en'] as const) {
          await this.pg.query(
            `INSERT INTO hotel_room_translations
               (id, room_id, language, name, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $5)
             ON CONFLICT (room_id, language) DO UPDATE SET
               name = EXCLUDED.name,
               updated_at = EXCLUDED.updated_at`,
            [randomUUID(), data.entityId, lang, translatedName[lang], now],
          );
        }
        this.logger.log(`Room auto-translation completed for ${data.entityId}`);
      }
    }
  }

  private async processExport(job: Job): Promise<void> {
    const exportId = String(
      (job.data as { export_id?: string }).export_id ?? '',
    );
    if (!exportId) {
      this.logger.warn(`Export job'da export_id yo'q: ${job.name}`);
      return;
    }

    const [exportJob] = await this.pg.query<ExportJobRow>(
      `SELECT id::text, owner_type, owner_id::text, type, format
       FROM export_jobs WHERE id = $1::uuid`,
      [exportId],
    );

    if (!exportJob) {
      this.logger.warn(`Export job topilmadi: ${exportId}`);
      return;
    }

    try {
      const data = await this.exportData.resolve(
        exportJob.owner_type,
        exportJob.owner_id,
        exportJob.type,
      );
      const buffer = await renderExport(data, exportJob.format);
      const objectKey = `export/${exportJob.owner_type}/${exportJob.owner_id}/${exportId}${extensionForFormat(exportJob.format)}`;

      await this.uploads.uploadDocument(
        objectKey,
        buffer,
        contentTypeForFormat(exportJob.format),
      );

      await this.pg.query(
        `UPDATE export_jobs
         SET status = 'ready', download_key = $1, error = NULL, updated_at = $2
         WHERE id = $3::uuid`,
        [objectKey, new Date().toISOString(), exportId],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Export generatsiyasi muvaffaqiyatsiz (export_id=${exportId}): ${message}`,
      );
      await this.pg.query(
        `UPDATE export_jobs
         SET status = 'failed', error = $1, updated_at = $2
         WHERE id = $3::uuid`,
        [message.slice(0, 500), new Date().toISOString(), exportId],
      );
      // Xatoni qayta uloqtiramiz — aks holda BullMQ bu job'ni "completed"
      // deb hisoblaydi va queue.add()'ga berilgan attempts/backoff hech
      // qachon ishga tushmaydi (C-4: worker jim to'xtab qolishi mumkin edi,
      // hech qanday retry/alert bo'lmasdan).
      throw error instanceof Error ? error : new Error(message);
    }
  }
}
