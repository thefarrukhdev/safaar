import 'reflect-metadata';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import { Permission, actorHasPermissions } from '../common/permissions';
import { PostgresService } from '../infrastructure/postgres.service';
import { UploadsService } from '../uploads/uploads.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import type { CreateReviewDto } from './dto/review.dto';

const HOTEL_ID = '11111111-1111-1111-1111-111111111111';
const BUS_COMPANY_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_BUS_COMPANY_ID = '33333333-3333-3333-3333-333333333333';
const BOOKING_ID = '44444444-4444-4444-4444-444444444444';

function guestDto(overrides: Record<string, unknown> = {}): CreateReviewDto {
  return {
    target_type: 'hotel',
    target_id: HOTEL_ID,
    rating: 5,
    body: 'Xona juda toza edi.',
    ...overrides,
  } as unknown as CreateReviewDto;
}

function userActor(
  id = 'user-1',
  overrides: Partial<RequestActor> = {},
): RequestActor {
  return {
    id,
    actorType: 'user',
    role: Role.USER,
    roles: [Role.USER],
    ...overrides,
  };
}

describe('ReviewsService', () => {
  let pgMock: jest.Mocked<Pick<PostgresService, 'query'>>;
  let uploadsMock: { createForOwner: jest.Mock };
  let service: ReviewsService;

  beforeEach(() => {
    pgMock = { query: jest.fn() };
    uploadsMock = { createForOwner: jest.fn() };
    service = new ReviewsService(
      pgMock as unknown as PostgresService,
      uploadsMock as unknown as UploadsService,
    );
  });

  // ---------------------------------------------------------------------
  // 1 & 2. create()ning ICHKI xatti-harakati actor=undefined bilan
  //        to'g'ridan-to'g'ri chaqirilganda: INSERT'da author_type='GUEST'
  //        va user_id=NULL yoziladi. DIQQAT: bu servis-darajasidagi himoya
  //        EMAS — haqiqiy HTTP orqali endi bunga yetib bo'lmaydi, chunki
  //        POST /reviews `@Roles(Role.USER)` bilan himoyalangan (2026-09-25
  //        SAFAAR — "review yozish faqat login qilgan user uchun";
  //        haqiqiy 401-rad etish uchun qarang
  //        reviews.controller.integration.spec.ts).
  // ---------------------------------------------------------------------
  describe('ReviewsService.create() ICHKI (unit) xatti-harakati actor=undefined bilan — real API himoyasi emas, qarang controller integration spec', () => {
    it('actor=undefined bo`lganda create() xato TASHLAMAYDI', async () => {
      pgMock.query
        .mockResolvedValueOnce([{ id: HOTEL_ID }]) // assertTargetExists
        .mockResolvedValueOnce([]) // INSERT
        .mockResolvedValueOnce([{ author_name: 'Mehmon' }]); // author_name lookup

      await expect(
        service.create(undefined, guestDto()),
      ).resolves.toMatchObject({
        author_type: 'GUEST',
        user_id: null,
        status: 'pending_review',
        // Mehmon xatti-harakati o'zgarmadi — bu fix faqat autentifikatsiya
        // qilingan USER uchun author_name'ni to'g'irlaydi, lekin bir xil
        // AUTHOR_NAME_CASE_SQL mehmon uchun ham ishlatilgani sababli shu
        // yerda ham to'g'ri natija berishini tasdiqlaymiz.
        author_name: 'Mehmon',
      });
    });

    it("INSERT so'rovi author_type='GUEST' va user_id=NULL ni REAL parametr massividagi to'g'ri pozitsiyada yozadi", async () => {
      pgMock.query
        .mockResolvedValueOnce([{ id: HOTEL_ID }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ author_name: 'Mehmon' }]);

      await service.create(undefined, guestDto());

      const insertCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).toLowerCase().includes('insert into reviews'),
      );
      expect(insertCall).toBeDefined();
      const [sql, params] = insertCall!;
      // Ustun tartibi: id, user_id, author_type, guest_name, booking_id, ...
      expect(String(sql)).toContain(
        '(id, user_id, author_type, guest_name, booking_id, target_type,',
      );
      const paramsArr = params as unknown[];
      expect(paramsArr[1]).toBeNull(); // user_id
      expect(paramsArr[2]).toBe('GUEST'); // author_type
    });
  });

  // ---------------------------------------------------------------------
  // 3. Mehmon user_id'ni soxtalashtira olmaydi — xizmat qatlami.
  // ---------------------------------------------------------------------
  describe("mehmon user_id'ni soxtalashtira olmaydi — xizmat DTO'dan user_id o'qimaydi (talab #3)", () => {
    it('dto obyektiga qo`lda user_id qo`shilsa ham (whitelist chetlab o`tilgan holat simulyatsiyasi), INSERT baribir NULL yozadi', async () => {
      pgMock.query
        .mockResolvedValueOnce([{ id: HOTEL_ID }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ author_name: 'Mehmon' }]);

      const spoofedDto = guestDto({ user_id: 'attacker-controlled-id' });
      await service.create(undefined, spoofedDto);

      const insertCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).toLowerCase().includes('insert into reviews'),
      );
      const [, params] = insertCall!;
      expect((params as unknown[])[1]).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // 4. Login qilgan mijoz — user_id doim actor.id'dan olinadi.
  // ---------------------------------------------------------------------
  describe("login qilgan foydalanuvchi uchun user_id FAQAT actor.id'dan olinadi (talab #4)", () => {
    it("dto.user_id boshqa foydalanuvchini ko'rsatsa ham, INSERT haqiqiy actor.id'ni yozadi", async () => {
      const actor = userActor('real-authenticated-user-id');
      pgMock.query
        .mockResolvedValueOnce([{ id: HOTEL_ID }]) // assertTargetExists
        .mockResolvedValueOnce([]) // resolveVerifiedBooking (booking_id yo'q, mos bron topilmadi)
        .mockResolvedValueOnce([]) // INSERT
        .mockResolvedValueOnce([{ author_name: 'Haqiqiy Foydalanuvchi' }]); // author_name lookup

      const dto = guestDto({ user_id: 'someone-elses-id' });
      const result = await service.create(actor, dto);

      expect(result.user_id).toBe('real-authenticated-user-id');
      expect(result.author_name).toBe('Haqiqiy Foydalanuvchi');
      const insertCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).toLowerCase().includes('insert into reviews'),
      );
      const [, params] = insertCall!;
      expect((params as unknown[])[1]).toBe('real-authenticated-user-id');
      expect((params as unknown[])[2]).toBe('USER');
    });
  });

  // ---------------------------------------------------------------------
  // 5. Noto'g'ri target.
  // ---------------------------------------------------------------------
  describe("noto'g'ri sharh obyekti rad etiladi (talab #5)", () => {
    it('obyekt (target) DBda topilmasa REVIEW_TARGET_NOT_FOUND (404) tashlanadi', async () => {
      pgMock.query.mockResolvedValueOnce([]); // assertTargetExists — bo'sh

      await expect(service.create(undefined, guestDto())).rejects.toMatchObject(
        {
          status: 404,
          response: { code: 'REVIEW_TARGET_NOT_FOUND' },
        },
      );
    });

    it("qo'llab-quvvatlanmaydigan target_type REVIEW_TARGET_TYPE_INVALID (400) bilan rad etiladi, DBga umuman so'rov yuborilmaydi", async () => {
      const dto = guestDto({ target_type: 'restaurant' });

      await expect(service.create(undefined, dto)).rejects.toMatchObject({
        status: 400,
        response: { code: 'REVIEW_TARGET_TYPE_INVALID' },
      });
      expect(pgMock.query).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // 8 & 9. Admin moderatsiya ruxsati — permission qatlami.
  // ---------------------------------------------------------------------
  describe('reviews:moderate ruxsati faqat mos rolga berilgan (talab #8, #9 — permission qatlami)', () => {
    function admin(role: Role): RequestActor {
      return { id: 'admin-1', actorType: 'admin', role, roles: [role] };
    }

    it('FINANCE_ADMIN Permission.ReviewsModerate ga EGA EMAS', () => {
      expect(
        actorHasPermissions(admin(Role.FINANCE_ADMIN), [
          Permission.ReviewsModerate,
        ]),
      ).toBe(false);
    });

    it('oddiy USER (mijoz roli) Permission.ReviewsModerate ga EGA EMAS', () => {
      expect(
        actorHasPermissions(
          { id: 'u-1', actorType: 'user', role: Role.USER, roles: [Role.USER] },
          [Permission.ReviewsModerate],
        ),
      ).toBe(false);
    });

    it('PARTNER Permission.ReviewsModerate ga EGA EMAS', () => {
      expect(
        actorHasPermissions(
          {
            id: 'p-1',
            actorType: 'partner',
            role: Role.PARTNER,
            roles: [Role.PARTNER],
          },
          [Permission.ReviewsModerate],
        ),
      ).toBe(false);
    });

    it('CONTENT_ADMIN Permission.ReviewsModerate ga EGA (moderatsiya qila oladi)', () => {
      expect(
        actorHasPermissions(admin(Role.CONTENT_ADMIN), [
          Permission.ReviewsModerate,
        ]),
      ).toBe(true);
    });

    it('SUPER_ADMIN Permission.ReviewsModerate ga EGA (cheksiz bypass) — audit yozuvi allaqachon admin.service.spec.ts:1487da tekshirilgan, bu yerda faqat ruxsat qatlami takrorlanadi', () => {
      expect(
        actorHasPermissions(admin(Role.SUPER_ADMIN), [
          Permission.ReviewsModerate,
        ]),
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------
  // 10, 11, 12. Ommaviy list() faqat published sharhlarni qaytaradi.
  // ---------------------------------------------------------------------
  describe("list() FAQAT status='published' sharhlarni qaytaradi (talab #10, #11, #12)", () => {
    it("list() SQL'ida r.status = 'published' filtri bor", async () => {
      pgMock.query.mockResolvedValueOnce([]);
      await service.list({ target_type: 'hotel', target_id: HOTEL_ID });
      const [sql] = pgMock.query.mock.calls[0];
      expect(String(sql)).toContain("r.status = 'published'");
    });

    it("list() SQL'ida 'pending_review' YO'Q — moderatsiya navbatidagi sharh ommaga chiqmaydi", async () => {
      pgMock.query.mockResolvedValueOnce([]);
      await service.list({ target_type: 'hotel', target_id: HOTEL_ID });
      const [sql] = pgMock.query.mock.calls[0];
      expect(String(sql)).not.toContain('pending_review');
    });

    it("list() SQL'ida alohida 'hidden' shart YO'Q — yagona status='published' filtri ularni ham chetlaydi", async () => {
      pgMock.query.mockResolvedValueOnce([]);
      await service.list({ target_type: 'hotel', target_id: HOTEL_ID });
      const [sql] = pgMock.query.mock.calls[0];
      expect(String(sql)).not.toContain('hidden');
      // Faqat BITTA status sharti borligini tasdiqlaymiz — u published'ga
      // teng, demak pending_review VA hidden ikkalasi ham shu bitta
      // filtr orqali istisno qilinadi (alohida OR/NOT IN shart shart emas).
      expect(String(sql).match(/r\.status\s*=/g)?.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------
  // 13. O'chirilgan (soft-delete) sharh ommaga chiqmaydi.
  // ---------------------------------------------------------------------
  describe("delete() sharhni status='hidden' qiladi va bu ommaviy filtrdan chetlanadi (talab #13)", () => {
    it("delete() REAL UPDATE parametrlarini ['hidden', <vaqt>, id] tartibida yuboradi", async () => {
      const ownerId = 'owner-1';
      const reviewId = 'review-1';
      const actor = userActor(ownerId);
      pgMock.query
        .mockResolvedValueOnce([
          { id: reviewId, user_id: ownerId, status: 'published' },
        ]) // assertReview
        .mockResolvedValueOnce([]); // UPDATE

      await service.delete(actor, reviewId);

      const updateCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).toLowerCase().includes('update reviews'),
      );
      const [sql, params] = updateCall!;
      expect(String(sql)).toContain('SET status = $1, updated_at = $2');
      const paramsArr = params as unknown[];
      expect(paramsArr[0]).toBe('hidden');
      expect(paramsArr[2]).toBe(reviewId);
    });

    it("status='hidden'ga o'zgargan sharh — yuqoridagi 'list() FAQAT published' testlari bilan bir xil filtr orqali — ommaviy ro'yxatda ko'rinmaydi (bir xil r.status = 'published' sharti)", async () => {
      // Bu test alohida N+1 SQL yozmaydi — u aynan list()ning statusni
      // filtrlash mexanizmi (yuqoridagi describe blok) delete() qo'ygan
      // 'hidden' qiymatini ham qamrab olishini ko'rsatadi: ikkalasi ham
      // reviews.status ustuniga ishlaydi, list() esa faqat 'published'ni
      // o'tkazadi — demak 'hidden' avtomatik chetlanadi.
      pgMock.query.mockResolvedValueOnce([]);
      await service.list({ target_type: 'hotel', target_id: HOTEL_ID });
      const [sql] = pgMock.query.mock.calls[0];
      expect(String(sql)).toContain("r.status = 'published'");
    });
  });

  // ---------------------------------------------------------------------
  // 14. summary() — bitta agregat so'rov, faqat published.
  // ---------------------------------------------------------------------
  describe("summary() BITTA agregat so'rov bilan ishlaydi, faqat published (talab #14)", () => {
    it("summary() SQL'ida status='published' filtri bor va pg.query FAQAT BIR MARTA chaqiriladi (N+1 yo'q)", async () => {
      pgMock.query.mockResolvedValueOnce([
        {
          total: 3,
          average: 4.3,
          cleanliness: 4,
          staff: 4,
          location: 4,
          value_for_money: 4,
          rating_1: 0,
          rating_2: 0,
          rating_3: 1,
          rating_4: 1,
          rating_5: 1,
        },
      ]);

      await service.summary({ target_type: 'hotel', target_id: HOTEL_ID });

      expect(pgMock.query).toHaveBeenCalledTimes(1);
      const [sql] = pgMock.query.mock.calls[0];
      expect(String(sql)).toContain("r.status = 'published'");
    });
  });

  // ---------------------------------------------------------------------
  // 15. Rate limiting — REAL @Throttle metadata.
  // ---------------------------------------------------------------------
  describe('ReviewsController.create() rate-limit qilingan (talab #15)', () => {
    it('@Throttle({default:{limit:5,ttl:60000}}) REAL metadata sifatida create() metodida mavjud (soxta throttler emas)', () => {
      // `Object.getOwnPropertyDescriptor` orqali olinadi: metodga to'g'ridan-
      // to'g'ri murojaat `unbound-method` qoidasini buzadi, metadata esa
      // baribir aynan shu handler funksiyasida saqlanadi.
      const createHandler = Object.getOwnPropertyDescriptor(
        ReviewsController.prototype,
        'create',
      )?.value as object;
      const limit: unknown = Reflect.getMetadata(
        `${THROTTLER_LIMIT}default`,
        createHandler,
      );
      const ttl: unknown = Reflect.getMetadata(
        `${THROTTLER_TTL}default`,
        createHandler,
      );
      expect(limit).toBe(5);
      expect(ttl).toBe(60_000);
    });
  });

  // ---------------------------------------------------------------------
  // 16. Dublikat sharh siyosati.
  // ---------------------------------------------------------------------
  describe('bir xil (user_id, booking_id) uchun ikkinchi sharh REVIEW_DUPLICATE bilan rad etiladi (talab #16)', () => {
    it('mos tasdiqlangan bron topilib, o`sha bron uchun sharh allaqachon mavjud bo`lsa 403 REVIEW_DUPLICATE qaytadi, tekshiruv ham user_id, ham booking_id bo`yicha ishlaydi', async () => {
      const actor = userActor('user-dup');
      pgMock.query
        .mockResolvedValueOnce([{ id: HOTEL_ID }]) // assertTargetExists
        .mockResolvedValueOnce([
          {
            id: BOOKING_ID,
            user_id: actor.id,
            hotel_id: HOTEL_ID,
            bus_company_id: null,
            status: 'confirmed',
          },
        ]) // resolveVerifiedBooking (booking_id berilgan)
        .mockResolvedValueOnce([{ id: 'existing-review-id' }]); // assertNoDuplicateReview — topildi

      const dto = guestDto({ booking_id: BOOKING_ID });
      await expect(service.create(actor, dto)).rejects.toMatchObject({
        status: 403,
        response: { code: 'REVIEW_DUPLICATE' },
      });

      const dupCall = pgMock.query.mock.calls[2];
      const [sql, params] = dupCall;
      expect(String(sql)).toContain('user_id = $1');
      expect(String(sql)).toContain('booking_id = $2');
      expect(params).toEqual([actor.id, BOOKING_ID]);
    });
  });

  // ---------------------------------------------------------------------
  // 19. Egalik tekshiruvi (assertReviewOwner).
  // ---------------------------------------------------------------------
  describe('assertReviewOwner — faqat egasi (yoki admin) sharhni boshqara oladi (talab #19)', () => {
    it("sharh egasi o'zining sharhini o'chira oladi (xato tashlanmaydi)", async () => {
      const actor = userActor('owner-x');
      pgMock.query
        .mockResolvedValueOnce([
          { id: 'r-1', user_id: 'owner-x', status: 'published' },
        ])
        .mockResolvedValueOnce([]);

      await expect(service.delete(actor, 'r-1')).resolves.toMatchObject({
        status: 'hidden',
      });
    });

    it('boshqa foydalanuvchi begona sharhni o`chira olmaydi — REVIEW_FORBIDDEN (403)', async () => {
      const actor = userActor('not-the-owner');
      pgMock.query.mockResolvedValueOnce([
        { id: 'r-1', user_id: 'owner-x', status: 'published' },
      ]);

      await expect(service.delete(actor, 'r-1')).rejects.toMatchObject({
        status: 403,
        response: { code: 'REVIEW_FORBIDDEN' },
      });
      // UPDATE chaqirilmagan — faqat SELECT (assertReview) bo'lgan.
      expect(pgMock.query).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // 22. R-2 regressiya — bus_company uchun ham bron/obyekt mosligi.
  // ---------------------------------------------------------------------
  describe('resolveVerifiedBooking — bron/obyekt mosligi bus_company uchun ham ishlaydi (talab #22, R-2 regressiya)', () => {
    it('bus_company sharhi uchun berilgan booking_id boshqa kompaniyaga tegishli bo`lsa REVIEW_BOOKING_TARGET_MISMATCH (403) bilan rad etiladi (ilgari faqat hotel tekshirilardi)', async () => {
      const actor = userActor('user-bus');
      pgMock.query
        .mockResolvedValueOnce([{ id: BUS_COMPANY_ID }]) // assertTargetExists (bus_company)
        .mockResolvedValueOnce([
          {
            id: BOOKING_ID,
            user_id: actor.id,
            hotel_id: null,
            bus_company_id: OTHER_BUS_COMPANY_ID, // boshqa kompaniya!
            status: 'confirmed',
          },
        ]); // resolveVerifiedBooking (booking_id berilgan)

      const dto = guestDto({
        target_type: 'bus_company',
        target_id: BUS_COMPANY_ID,
        booking_id: BOOKING_ID,
      });

      await expect(service.create(actor, dto)).rejects.toMatchObject({
        status: 403,
        response: { code: 'REVIEW_BOOKING_TARGET_MISMATCH' },
      });
      // INSERT umuman chaqirilmagan — atigi 2 ta so'rov bo'lgan.
      expect(pgMock.query).toHaveBeenCalledTimes(2);
    });

    it("bus_company bron/obyekt MOS bo'lsa 'published' status bilan sharh yaratiladi (sog'lom yo'l — regressiya emasligini tasdiqlaydi)", async () => {
      const actor = userActor('user-bus-2');
      pgMock.query
        .mockResolvedValueOnce([{ id: BUS_COMPANY_ID }])
        .mockResolvedValueOnce([
          {
            id: BOOKING_ID,
            user_id: actor.id,
            hotel_id: null,
            bus_company_id: BUS_COMPANY_ID,
            status: 'confirmed',
          },
        ])
        .mockResolvedValueOnce([]) // assertNoDuplicateReview
        .mockResolvedValueOnce([]) // INSERT
        .mockResolvedValueOnce([{ author_name: 'Haqiqiy Foydalanuvchi' }]); // author_name lookup

      const dto = guestDto({
        target_type: 'bus_company',
        target_id: BUS_COMPANY_ID,
        booking_id: BOOKING_ID,
      });

      await expect(service.create(actor, dto)).resolves.toMatchObject({
        status: 'published',
        target_type: 'bus_company',
        author_name: 'Haqiqiy Foydalanuvchi',
      });
    });
  });

  // ---------------------------------------------------------------------
  // reply() — hamkor javobi endi haqiqatan `reviews.reply_body/reply_by/
  // replied_at`ga yoziladi (regression: "BACKEND BUG FIX — REVIEW PARTNER
  // REPLY PERSISTENCE" — avval faqat xotiradagi obyekt qaytarilardi va
  // reload'dan keyin yo'qolardi).
  // ---------------------------------------------------------------------
  describe('reply() — hamkor javobi endi haqiqatan saqlanadi', () => {
    const REVIEW_ID = 'review-reply-1';

    function partnerActor(overrides: Partial<RequestActor> = {}): RequestActor {
      return {
        id: 'partner-user-1',
        actorType: 'partner',
        role: Role.PARTNER,
        roles: [Role.PARTNER],
        organizationId: 'org-1',
        ...overrides,
      };
    }

    function publishedReview(overrides: Record<string, unknown> = {}) {
      return {
        id: REVIEW_ID,
        user_id: 'user-1',
        booking_id: BOOKING_ID,
        target_type: 'hotel',
        target_id: HOTEL_ID,
        status: 'published',
        reply_body: null,
        ...overrides,
      };
    }

    it("PARTNER o'z tashkilotiga tegishli sharhga javob yozganda, UPDATE reviews so'rovi reply_body/reply_by/replied_at ni haqiqiy qiymatlar bilan yozadi (xotiradagi obyekt EMAS)", async () => {
      const actor = partnerActor();
      pgMock.query
        .mockResolvedValueOnce([publishedReview()]) // assertReview
        .mockResolvedValueOnce([{ partner_organization_id: 'org-1' }]) // assertPartnerCanReply
        .mockResolvedValueOnce([
          {
            id: REVIEW_ID,
            reply_body: 'Rahmat!',
            reply_by: actor.id,
            replied_at: '2026-09-25T10:00:00.000Z',
          },
        ]); // UPDATE ... RETURNING

      const result = await service.reply(actor, REVIEW_ID, { body: 'Rahmat!' });

      const updateCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).toLowerCase().includes('update reviews'),
      );
      expect(updateCall).toBeDefined();
      const [sql, params] = updateCall!;
      expect(String(sql)).toContain('reply_body');
      expect(String(sql)).toContain('reply_by');
      expect(String(sql)).toContain('replied_at');
      // reply_by = joriy PARTNER aktyorining haqiqiy id'si (partner_users.id,
      // chunki RequestActor.id partner login uchun aynan shu jadvaldan keladi).
      expect((params as unknown[])[1]).toBe(actor.id);
      expect((params as unknown[])[3]).toBe(REVIEW_ID);

      // Javob DB'dan qaytgan (RETURNING) qiymatlar asosida qurilgan.
      expect(result).toEqual({
        review_id: REVIEW_ID,
        partner_user_id: actor.id,
        body: 'Rahmat!',
        created_at: '2026-09-25T10:00:00.000Z',
      });
    });

    it("saqlangan javob keyingi list() o'qishida reply_body/replied_at sifatida qaytadi (haqiqiy saqlanganini tasdiqlaydi), lekin ichki reply_by (hamkor id) ommaviy ro'yxatga chiqmaydi", async () => {
      pgMock.query.mockResolvedValueOnce([
        {
          id: REVIEW_ID,
          reply_body: 'Rahmat, tashrifingiz uchun!',
          replied_at: '2026-09-25T10:00:00.000Z',
          status: 'published',
        },
      ]);

      const [row] = await service.list({
        target_type: 'hotel',
        target_id: HOTEL_ID,
      });

      expect((row as Record<string, unknown>).reply_body).toBe(
        'Rahmat, tashrifingiz uchun!',
      );
      expect((row as Record<string, unknown>).replied_at).toBe(
        '2026-09-25T10:00:00.000Z',
      );

      const [sql] = pgMock.query.mock.calls[0];
      expect(String(sql)).toContain('r.reply_body');
      expect(String(sql)).toContain('r.replied_at');
      expect(String(sql)).not.toContain('reply_by');
    });

    it('ikkinchi javob urinishi 409 REVIEW_ALREADY_REPLIED bilan rad etiladi va UPDATE chaqirilmaydi', async () => {
      const actor = partnerActor();
      pgMock.query
        .mockResolvedValueOnce([
          publishedReview({ reply_body: 'Avvalgi javob' }),
        ]) // assertReview
        .mockResolvedValueOnce([{ partner_organization_id: 'org-1' }]); // assertPartnerCanReply

      await expect(
        service.reply(actor, REVIEW_ID, { body: 'Yangi javob' }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'REVIEW_ALREADY_REPLIED' },
      });

      const updateCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).toLowerCase().includes('update reviews'),
      );
      expect(updateCall).toBeUndefined();
    });

    it('actor=undefined (login qilmagan) 401 bilan rad etiladi, so`rov yuborilmaydi', async () => {
      await expect(
        service.reply(undefined, REVIEW_ID, { body: 'Salom' }),
      ).rejects.toMatchObject({ status: 401 });
      expect(pgMock.query).not.toHaveBeenCalled();
    });

    it('boshqa tashkilotning hamkori javob yoza olmaydi (403 REVIEW_REPLY_FORBIDDEN, cross-partner isolation)', async () => {
      const actor = partnerActor({
        id: 'partner-user-2',
        organizationId: 'org-2',
      });
      pgMock.query
        .mockResolvedValueOnce([publishedReview()]) // assertReview
        .mockResolvedValueOnce([{ partner_organization_id: 'org-1' }]); // bron org-1'ga tegishli, aktyor org-2

      await expect(
        service.reply(actor, REVIEW_ID, { body: 'Yozishga urinish' }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'REVIEW_REPLY_FORBIDDEN' },
      });

      const updateCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).toLowerCase().includes('update reviews'),
      );
      expect(updateCall).toBeUndefined();
    });

    it("mavjud bo'lmagan sharh id'siga javob 404 qaytaradi", async () => {
      const actor = partnerActor();
      pgMock.query.mockResolvedValueOnce([]); // assertReview hech narsa topmaydi

      await expect(
        service.reply(actor, 'no-such-review', { body: 'Salom' }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("bo'sh javob matni 400 REVIEW_REPLY_BODY_REQUIRED bilan rad etiladi", async () => {
      const actor = partnerActor();
      pgMock.query
        .mockResolvedValueOnce([publishedReview()])
        .mockResolvedValueOnce([{ partner_organization_id: 'org-1' }]);

      await expect(
        service.reply(actor, REVIEW_ID, { body: '   ' }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'REVIEW_REPLY_BODY_REQUIRED' },
      });
    });
  });
});
