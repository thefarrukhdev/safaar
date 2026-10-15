import type { Job } from 'bullmq';
import { AiTranslateService } from '../ai-translate/ai-translate.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { UploadsService } from '../uploads/uploads.service';
import { ExportDataService } from './export-data.service';
import { JobsProcessor } from './jobs.processor';
import { WebhookDeliveryService } from './webhook-delivery.service';

function job(name: string, data: Record<string, unknown>): Job {
  return { name, data } as unknown as Job;
}

describe('JobsProcessor', () => {
  let processor: JobsProcessor;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>>;
  let exportData: { resolve: jest.Mock };
  let uploads: { uploadDocument: jest.Mock };
  let webhooks: { deliver: jest.Mock };
  let aiTranslate: { autoTranslateMultilingualField: jest.Mock };

  beforeEach(() => {
    pg = { query: jest.fn().mockResolvedValue([]) };
    exportData = { resolve: jest.fn() };
    uploads = { uploadDocument: jest.fn() };
    webhooks = { deliver: jest.fn() };
    aiTranslate = {
      autoTranslateMultilingualField: jest.fn().mockImplementation((text) =>
        Promise.resolve({
          uz: typeof text === 'string' ? text : text?.uz || '',
          ru: 'Перевод ' + (typeof text === 'string' ? text : text?.uz || ''),
          en:
            'Translated ' + (typeof text === 'string' ? text : text?.uz || ''),
        }),
      ),
    };
    processor = new JobsProcessor(
      pg as unknown as PostgresService,
      exportData as unknown as ExportDataService,
      uploads as unknown as UploadsService,
      webhooks as unknown as WebhookDeliveryService,
      aiTranslate as unknown as AiTranslateService,
    );
  });

  it('routes partner-webhook-delivery jobs to WebhookDeliveryService', async () => {
    await processor.process(
      job('partner-webhook-delivery', { delivery_id: 'd1' }),
    );
    expect(webhooks.deliver).toHaveBeenCalledWith('d1');
  });

  it('no-ops on send-email jobs (already sent synchronously)', async () => {
    await processor.process(job('send-email', { to: 'x@example.com' }));
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('logs and ignores unknown job names without throwing', async () => {
    await expect(
      processor.process(job('totally-unknown-job', {})),
    ).resolves.toBeUndefined();
  });

  describe('export jobs (user-data-export / export / partner-export)', () => {
    const exportJobRow = {
      id: 'export-1',
      owner_type: 'partner',
      owner_id: 'partner-1',
      type: 'partner-bookings',
      format: 'csv',
    };

    it('generates the file, uploads it, and marks the export ready', async () => {
      pg.query.mockResolvedValueOnce([exportJobRow]).mockResolvedValueOnce([]);
      exportData.resolve.mockResolvedValueOnce({
        kind: 'tabular',
        title: 'Bookings',
        columns: [{ key: 'a', header: 'A' }],
        rows: [{ a: 1 }],
      });
      uploads.uploadDocument.mockResolvedValueOnce({
        objectKey: 'export/x.csv',
      });

      await processor.process(job('partner-export', { export_id: 'export-1' }));

      expect(exportData.resolve).toHaveBeenCalledWith(
        'partner',
        'partner-1',
        'partner-bookings',
      );
      expect(uploads.uploadDocument).toHaveBeenCalledTimes(1);
      const updateCall = pg.query.mock.calls[1];
      expect(updateCall[0]).toContain("status = 'ready'");
      expect((updateCall[1] as unknown[])[0]).toContain(
        'export/partner/partner-1/export-1',
      );
    });

    it('marks the export failed AND rethrows so BullMQ retry/backoff engages (regression: C-4)', async () => {
      pg.query.mockResolvedValueOnce([exportJobRow]).mockResolvedValueOnce([]);
      exportData.resolve.mockRejectedValueOnce(new Error('DB kutilmagan xato'));

      await expect(
        processor.process(job('user-data-export', { export_id: 'export-1' })),
      ).rejects.toThrow('DB kutilmagan xato');

      expect(uploads.uploadDocument).not.toHaveBeenCalled();
      const updateCall = pg.query.mock.calls[1];
      expect(updateCall[0]).toContain("status = 'failed'");
      expect((updateCall[1] as unknown[])[0]).toContain('DB kutilmagan xato');
    });

    it('does nothing when the export_id is missing from the job payload', async () => {
      await processor.process(job('export', {}));
      expect(pg.query).not.toHaveBeenCalled();
    });

    it('does nothing when the export_jobs row no longer exists', async () => {
      pg.query.mockResolvedValueOnce([]);
      await processor.process(job('export', { export_id: 'gone' }));
      expect(exportData.resolve).not.toHaveBeenCalled();
    });
  });

  describe('entity-auto-translate jobs', () => {
    it('auto-translates hotel name and description into ru/en and updates hotel_translations', async () => {
      await processor.process(
        job('entity-auto-translate', {
          entityType: 'hotel',
          entityId: '00000000-0000-0000-0000-000000000001',
          sourceLang: 'uz',
          fields: {
            name: 'Oq Saroy',
            description: 'Toshkentdagi mehmonxona',
          },
        }),
      );

      expect(aiTranslate.autoTranslateMultilingualField).toHaveBeenCalledTimes(
        2,
      );
      expect(pg.query).toHaveBeenCalledTimes(4);
      expect(pg.query.mock.calls[0]?.[0]).toContain(
        'INSERT INTO hotel_translations',
      );
      expect(pg.query.mock.calls[3]?.[0]).toContain(
        'UPDATE hotels SET updated_at',
      );
    });

    it('auto-translates room_type and updates room_types.name JSONB', async () => {
      await processor.process(
        job('entity-auto-translate', {
          entityType: 'room_type',
          entityId: '00000000-0000-0000-0000-000000000002',
          sourceLang: 'uz',
          fields: {
            name: 'Lyuks xona',
          },
        }),
      );

      expect(aiTranslate.autoTranslateMultilingualField).toHaveBeenCalledWith(
        'Lyuks xona',
        'uz',
      );
      expect(pg.query).toHaveBeenCalledTimes(1);
      expect(pg.query.mock.calls[0]?.[0]).toContain('UPDATE room_types');
      expect(pg.query.mock.calls[0]?.[1]?.[1]).toContain('Перевод Lyuks xona');
    });

    it('auto-translates custom room name and updates hotel_room_translations', async () => {
      await processor.process(
        job('entity-auto-translate', {
          entityType: 'room',
          entityId: '00000000-0000-0000-0000-000000000003',
          sourceLang: 'uz',
          fields: {
            name: 'Baland qavatdagi xona',
          },
        }),
      );

      expect(aiTranslate.autoTranslateMultilingualField).toHaveBeenCalledWith(
        'Baland qavatdagi xona',
        'uz',
      );
      expect(pg.query).toHaveBeenCalledTimes(3);
      expect(pg.query.mock.calls[0]?.[0]).toContain(
        'INSERT INTO hotel_room_translations',
      );
    });
  });
});
