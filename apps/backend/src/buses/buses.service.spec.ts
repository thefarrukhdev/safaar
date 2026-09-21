import { NotFoundException } from '@nestjs/common';
import { AppCacheService } from '../infrastructure/cache.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { BusesService } from './buses.service';

/**
 * Regressiya (talab #21): `companyReviews()` ilgari `SELECT *` ishlatgan
 * (yangi ustun — masalan `guest_name` — avtomatik ommaga chiqib ketardi)
 * va `status` filtri UMUMAN yo'q edi (moderatsiya navbatidagi
 * `pending_review` va yashirilgan `hidden` sharhlar ham ko'rinardi).
 * Bu fayl faqat shu ikkita tuzatishni haqiqiy SQL matni ustidan
 * tasdiqlaydi — bus_company modulida ilgari umuman spec fayl yo'q edi.
 */
describe('BusesService.companyReviews (regression: SELECT * + status filtri yo`qligi tuzatildi, talab #21)', () => {
  let pgMock: jest.Mocked<Pick<PostgresService, 'query'>>;
  let service: BusesService;
  const companyId = '55555555-5555-5555-5555-555555555555';

  beforeEach(() => {
    pgMock = { query: jest.fn() };
    service = new BusesService(
      {} as unknown as AppCacheService,
      pgMock as unknown as PostgresService,
    );
  });

  it("companyReviews() SQL'ida status = 'published' filtri bor", async () => {
    pgMock.query
      .mockResolvedValueOnce([{ id: companyId }]) // kompaniya mavjudligini tekshirish
      .mockResolvedValueOnce([]); // sharhlar so'rovi

    await service.companyReviews(companyId);

    const reviewsCall = pgMock.query.mock.calls[1];
    const [sql, params] = reviewsCall;
    expect(String(sql)).toContain("r.status = 'published'");
    expect(params).toEqual([companyId]);
  });

  it("companyReviews() SQL'i 'SELECT *' EMAS — ustunlar aniq ro'yxat qilingan (PII/kelajakdagi ustunlar tasodifan ommaga chiqmasin)", async () => {
    pgMock.query
      .mockResolvedValueOnce([{ id: companyId }])
      .mockResolvedValueOnce([]);

    await service.companyReviews(companyId);

    const [sql] = pgMock.query.mock.calls[1];
    expect(String(sql).toUpperCase()).not.toContain('SELECT *');
  });

  it('kompaniya topilmasa 404 TRIP_NOT_FOUND tashlanadi va sharh so`rovi UMUMAN yuborilmaydi', async () => {
    pgMock.query.mockResolvedValueOnce([]); // kompaniya topilmadi

    await expect(service.companyReviews(companyId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(pgMock.query).toHaveBeenCalledTimes(1);
  });
});
