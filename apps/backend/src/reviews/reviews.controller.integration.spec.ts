import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { Role } from '@safaar/types';
import { PostgresService } from '../infrastructure/postgres.service';
import { UploadsService } from '../uploads/uploads.service';
import { RolesGuard } from '../common/roles.guard';
import { signJwt } from '../auth/security';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

// `authSessionStore` bu faylda ATAYLAB "chegara" (boundary) sifatida mock
// qilinadi — xuddi PostgresService/UploadsService kabi. U haqiqiy, alohida
// Postgres `Pool`ga ulanadigan real-vaqt singleton (auth/session-store.ts),
// bu testning o'z mock qilingan PostgresService'idan MUSTAQIL. Haqiqiy
// himoyalangan marshrutni RolesGuard orqali tekshirish uchun yaroqli JWT
// kerak, yaroqli JWT esa `session_id` bo'sh bo'lmasligini talab qiladi
// (security.ts verifyJwt: `!payload.session_id` → rad etadi) — shu sabab
// haqiqiy sessiya-tekshiruvi ham chaqiriladi, uni haqiqiy DB'siz mock
// qilish shart.
jest.mock('../auth/session-store', () => ({
  authSessionStore: { isActive: jest.fn().mockResolvedValue(true) },
}));

/**
 * INTEGRATSIYA testi — haqiqiy Nest testing moduli haqiqiy
 * `ReviewsController` + haqiqiy `RolesGuard` (class-level
 * `@UseGuards(RolesGuard)`) + haqiqiy global `ValidationPipe` bilan
 * ko'tariladi. Faqat chegara (`PostgresService`, `UploadsService`,
 * `authSessionStore`) mock qilinadi — HTTP so'rovi supertest orqali REAL
 * Express instance ustidan yuboriladi. Global exception filter/response
 * interceptor BU minimal modulga ulanmagan, shuning uchun javob tanasi
 * controller/guard nima qaytarsa aynan o'sha — `{success,data,meta}`/
 * `{success,error,meta}` konvertlari YO'Q (production'dagi haqiqiy
 * `main.ts` bootstrap'idan farqli).
 *
 * Regression (2026-09-25 SAFAAR — "review yozish faqat login qilgan
 * user uchun"): `POST /reviews` endi `@Roles(Role.USER)` bilan
 * himoyalangan — guest (auth ixtiyoriy) endi RUXSAT ETILMAYDI. Bu fayl
 * ilgari buning teskarisini (guest sharh yoza olishini) tasdiqlagan —
 * talab o'zgargani sababli testlar ham yangi, to'g'ri xatti-harakatga
 * moslab qayta yozildi.
 */
describe('ReviewsController (integration, real HTTP) — POST /reviews endi login talab qiladi (guest rad etiladi)', () => {
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

  function userToken(userId: string): string {
    return signJwt(
      {
        sub: userId,
        role: Role.USER,
        roles: [Role.USER],
        actor_type: 'user',
        session_id: randomUUID(),
        jti: randomUUID(),
      },
      'access',
    );
  }

  it('Authorization sarlavhasi UMUMAN yuborilmasa — 401 AUTH_TOKEN_INVALID, DBga umuman yozuv bormaydi (guest endi sharh yoza olmaydi)', async () => {
    const response = await request(app.getHttpServer()).post('/reviews').send({
      target_type: 'hotel',
      target_id: HOTEL_ID,
      rating: 5,
      body: 'Ajoyib xizmat, minnatdorman!',
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'AUTH_TOKEN_INVALID' });
    // RolesGuard so'rovni servicega umuman uzatmaydi — hech qanday
    // pg.query (jumladan INSERT INTO reviews) chaqirilmagan.
    expect(pgMock.query).not.toHaveBeenCalled();
  });

  it("noto'g'ri/yaroqsiz token yuborilsa ham — 401 AUTH_TOKEN_INVALID, jim ravishda guest sifatida davom ETILMAYDI", async () => {
    const response = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', 'Bearer this-is-not-a-valid-jwt')
      .send({
        target_type: 'hotel',
        target_id: HOTEL_ID,
        rating: 4,
        body: "Yaxshi, lekin ba'zi kamchiliklar bor edi.",
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'AUTH_TOKEN_INVALID' });
    expect(pgMock.query).not.toHaveBeenCalled();
  });

  it("haqiqiy, yaroqli USER token bilan mavjud muvaffaqiyatli oqim ishlaydi — 201, user_id haqiqiy actor identity'sidan olinadi", async () => {
    const userId = 'real-authenticated-user-id';
    pgMock.query
      .mockResolvedValueOnce([]) // RolesGuard.assertActorAllowed: SELECT status FROM users
      .mockResolvedValueOnce([{ id: HOTEL_ID }]) // assertTargetExists
      .mockResolvedValueOnce([]) // resolveVerifiedBooking — mos tasdiqlangan bron topilmadi
      .mockResolvedValueOnce([]); // INSERT INTO reviews

    const response = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${userToken(userId)}`)
      .send({
        target_type: 'hotel',
        target_id: HOTEL_ID,
        rating: 5,
        body: 'Ajoyib xizmat, minnatdorman!',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      author_type: 'USER',
      user_id: userId,
      status: 'pending_review',
      target_type: 'hotel',
      target_id: HOTEL_ID,
    });
  });

  it("authenticated user body orqali boshqa user_id yuborsa ham, sharh HAQIQIY actor identity'si bilan yaratiladi (mass-assignment himoyasi)", async () => {
    const realUserId = 'real-authenticated-user-id';
    // Pipelar Guard'dan KEYIN ishlaydi — RolesGuard.assertActorAllowed
    // baribir bitta pg.query yuboradi, keyingina ValidationPipe 400 beradi.
    pgMock.query.mockResolvedValueOnce([]);

    const response = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${userToken(realUserId)}`)
      .send({
        target_type: 'hotel',
        target_id: HOTEL_ID,
        rating: 5,
        body: 'Ajoyib xizmat!',
        user_id: 'someone-elses-id',
      });

    // CreateReviewDto'da user_id maydoni umuman e'lon qilinmagan va
    // forbidNonWhitelisted:true bilan ishlaydi — klient uni yuborsa butun
    // so'rov 400 bo'lishi kerak (mass-assignment himoyasi allaqachon DTO
    // darajasida ishlaydi, RolesGuard tekshiruvidan KEYIN — shuning uchun
    // assertActorAllowed uchun bitta pg.query hali ham chaqiriladi).
    expect(response.status).toBe(400);
  });
});
