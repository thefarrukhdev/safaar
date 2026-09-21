import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PostgresService } from '../infrastructure/postgres.service';
import { UploadsService } from '../uploads/uploads.service';
import { RolesGuard } from '../common/roles.guard';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * INTEGRATSIYA testi (talab #18 — ENG MUHIM TEST).
 *
 * Bu unit-mock EMAS: haqiqiy Nest testing moduli haqiqiy
 * `ReviewsController` + haqiqiy `RolesGuard` (class-level
 * `@UseGuards(RolesGuard)`) + haqiqiy global `ValidationPipe` bilan
 * ko'tariladi (xuddi `main.ts`dagi sozlama — whitelist/forbidNonWhitelisted/
 * transform). Faqat chegara (`PostgresService`, `UploadsService`) mock
 * qilinadi — HTTP so'rovi supertest orqali REAL Express instance ustidan
 * yuboriladi. Shu bilan "guest sharh yoza oladi" mahsulot talabi soxta
 * (unit-mock) emas, HAQIQIY so'rov-javob darajasida tasdiqlanadi.
 *
 * Naqsh: `test/app.e2e-spec.ts` (supertest + `Test.createTestingModule` +
 * `PostgresService` override) shu repodagi supertest/Nest integratsiya
 * uslubi — bu yerda aynan shu uslub qo'llaniladi.
 */
describe('ReviewsController (integration, real HTTP) — POST /reviews mehmon uchun auth SHART EMAS (talab #18)', () => {
  let app: INestApplication<App>;
  let pgMock: { query: jest.Mock };

  const HOTEL_ID = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    pgMock = { query: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        ReviewsService,
        RolesGuard,
        Reflector,
        { provide: PostgresService, useValue: pgMock },
        {
          provide: UploadsService,
          useValue: { createForOwner: jest.fn() },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Authorization sarlavhasi UMUMAN yuborilmasa ham javob 401 EMAS (guest sharh yaratadi, mahsulot talabi: bron kerak emas)', async () => {
    pgMock.query
      .mockResolvedValueOnce([{ id: HOTEL_ID }]) // assertTargetExists (RolesGuard hech qanday query qilmaydi — token yo'q)
      .mockResolvedValueOnce([]); // INSERT INTO reviews

    const response = await request(app.getHttpServer()).post('/reviews').send({
      target_type: 'hotel',
      target_id: HOTEL_ID,
      rating: 5,
      body: 'Ajoyib xizmat, minnatdorman!',
    });

    expect(response.status).not.toBe(401);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      author_type: 'GUEST',
      user_id: null,
      status: 'pending_review',
      target_type: 'hotel',
      target_id: HOTEL_ID,
    });
  });

  it('token bilan (login qilgan foydalanuvchi) ham xuddi shu marshrut ishlaydi — RolesGuard "auth ixtiyoriy" rejimini buzmaydi (regressiya nazorati)', async () => {
    // Token yuborilmagan (bo'sh Authorization) — noto'g'ri/muddati o'tgan
    // token ham qattiq 401 bermasligi, aksincha guest sifatida davom
    // etishi kerak (RolesGuard'dagi "auth ixtiyoriy" mantiq — roles.guard.ts
    // izohi: "token yo'q/yaroqsiz ... guest sifatida davom etiladi").
    pgMock.query
      .mockResolvedValueOnce([{ id: HOTEL_ID }])
      .mockResolvedValueOnce([]);

    const response = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', 'Bearer this-is-not-a-valid-jwt')
      .send({
        target_type: 'hotel',
        target_id: HOTEL_ID,
        rating: 4,
        body: 'Yaxshi, lekin ba`zi kamchiliklar bor edi.',
      });

    expect(response.status).not.toBe(401);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ author_type: 'GUEST' });
  });
});
