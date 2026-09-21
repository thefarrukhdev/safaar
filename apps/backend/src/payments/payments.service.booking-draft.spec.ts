import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import { BookingsService } from '../bookings/bookings.service';
import type { AppCacheService } from '../infrastructure/cache.service';
import { EmailService } from '../infrastructure/email.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { PromosService } from '../promos/promos.service';
import { EventsService } from '../realtime/events.service';
import { PaymentsService } from './payments.service';
import {
  UZUM_CHECKOUT_ERROR,
  UzumCheckoutError,
} from './providers/uzum-checkout.provider';

/**
 * D3 REGRESSION — "karta to'lovi provayderga umuman yetib bormaydi".
 *
 * Nima buzilgan edi (platforma bo'ylab, mehmonxona VA restoran):
 *   1. `bookings.service.ts::createPayment()` bron yaratilishida QORALAMA
 *      (draft) payment qatorini `provider = booking.payment_method`
 *      (masalan xom `'uzcard'`) bilan yozardi. Sxema konvensiyasi
 *      (`prisma/schema.prisma` `Payment.cardScheme`, migratsiya
 *      20260916150100) esa karta sxemalari uchun `provider` DOIM
 *      `'uzum_checkout'`, karta turi esa `card_scheme`da bo'lishini
 *      talab qiladi (kanonik INSERT —
 *      `payments.service.ts::createUzumCheckoutPayment()`).
 *   2. `payments.service.ts::createPayment()`dagi idempotentlik
 *      qisqa-tutashuvi `card_scheme ?? provider` ni so'ralgan usul bilan
 *      solishtiradi — O'LIK qoralama (`pending`, `payment_url` yo'q,
 *      `provider_reference` yo'q) so'ralgan usul bilan mos tushib,
 *      `checkout.register()` HECH QACHON chaqirilmasdan qaytarilardi.
 *
 * MUHIM: bu yerdagi qoralama qator QO'LDA yozilmaydi — u HAQIQIY
 * `BookingsService.createHotel()` ishga tushirilib, uning `INSERT INTO
 * payments` chaqiruvidan (ustunlar + parametrlar) QAYTA TIKLANADI. Aynan
 * shu bo'shliq (mavjud `payments.service.card-scheme.spec.ts` soddalashtirilgan
 * mock ishlatgani) tufayli bu xato tirik qolgan edi.
 */

type QueryCall = [sql: string, params?: readonly unknown[]];
const queryCallsOf = (m: jest.Mock): QueryCall[] => m.mock.calls as QueryCall[];
const findCall = (m: jest.Mock, needle: string): QueryCall | undefined =>
  queryCallsOf(m).find(([sql]) => String(sql).includes(needle));
const findCalls = (m: jest.Mock, needle: string): QueryCall[] =>
  queryCallsOf(m).filter(([sql]) => String(sql).includes(needle));

/**
 * Pozitsion (`$1..$N`) `INSERT INTO payments ...` chaqiruvini haqiqiy DB
 * qatoriga aylantiradi — ustun nomlari SQL'dan, qiymatlar parametrlardan.
 * Shu sabab quyidagi testlar "qo'lda soddalashtirilgan" mock emas, AYNAN
 * production yozadigan qator ustida ishlaydi.
 */
function rowFromPositionalInsert([sql, params]: QueryCall): Record<
  string,
  unknown
> {
  const text = String(sql);
  const columns = /INSERT INTO payments\s*\(([\s\S]*?)\)/i
    .exec(text)?.[1]
    ?.split(',')
    .map((c) => c.trim());
  const values = /VALUES\s*\(([\s\S]*?)\)/i
    .exec(text)?.[1]
    ?.split(',')
    .map((v) => v.trim());
  if (!columns || !values) {
    throw new Error(`INSERT INTO payments tahlil qilinmadi: ${text}`);
  }
  if (columns.length !== values.length) {
    throw new Error(
      `ustunlar (${columns.length}) va qiymatlar (${values.length}) soni mos emas`,
    );
  }
  const row: Record<string, unknown> = {};
  columns.forEach((column, index) => {
    const placeholder = /^\$(\d+)$/.exec(values[index]);
    if (!placeholder) {
      throw new Error(
        `bu yordamchi faqat pozitsion qiymatlar uchun (${values[index]})`,
      );
    }
    row[column] = (params ?? [])[Number(placeholder[1]) - 1];
  });
  return row;
}

const owner: RequestActor = {
  id: 'user-owner',
  actorType: 'user',
  role: Role.USER,
  roles: [Role.USER],
};

const hotelRow = {
  id: 'hotel-1',
  partner_organization_id: 'partner-1',
  partner_type: 'hotel',
  commission_rate: 12,
  check_in_time: null,
  check_out_time: null,
};

const roomRow = {
  id: 'room-1',
  hotel_id: 'hotel-1',
  base_price: '250000',
  total_inventory: 5,
};

interface PgMock {
  query: jest.Mock;
  transaction: jest.Mock;
}

/** `BookingsService` — haqiqiy servis, faqat DB/IO mock qilingan. */
function makeBookingsService() {
  const pg: PgMock = {
    query: jest.fn().mockResolvedValue([]),
    transaction: jest.fn(),
  };
  pg.transaction.mockImplementation((operation: (tx: unknown) => unknown) =>
    Promise.resolve(operation({ query: pg.query })),
  );
  const buildCheckoutUrl = jest.fn((provider: string) => {
    // Haqiqiy `PaymentsService.buildCheckoutUrl()` karta sxemalari va
    // `uzum_checkout` uchun 503 tashlaydi (redirect URL faqat
    // `/payment/register` javobidan keladi) — bron yaratish oqimi buni
    // ushlab, `payment_url = null` bilan davom etadi.
    if (
      provider === 'uzum_checkout' ||
      ['humo', 'uzcard', 'visa', 'mastercard'].includes(provider)
    ) {
      throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
    }
    if (provider === 'cash') {
      return null;
    }
    return `https://checkout.example/${provider}`;
  });
  const service = new BookingsService(
    pg as unknown as PostgresService,
    {
      bookingStatusChanged: jest.fn(),
      partnerDashboardUpdated: jest.fn(),
      adminDashboardUpdated: jest.fn(),
    } as unknown as EventsService,
    {
      send: jest
        .fn()
        .mockResolvedValue({ providerMessageId: '', accepted: true }),
    } as unknown as EmailService,
    {
      validate: jest.fn().mockResolvedValue({
        code: '',
        valid: false,
        discount_type: null,
        discount_value: 0,
      }),
      redeem: jest.fn().mockResolvedValue(true),
    } as unknown as PromosService,
    { buildCheckoutUrl } as unknown as PaymentsService,
    {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      getOrSet: jest.fn((_k: string, _t: number, producer: () => unknown) =>
        Promise.resolve(producer()),
      ),
    } as unknown as AppCacheService,
  );

  pg.query
    .mockResolvedValueOnce([hotelRow]) // SELECT hotel
    .mockResolvedValueOnce([roomRow]) // SELECT room
    .mockResolvedValueOnce([{ booked_count: 0 }]) // sana ziddiyati yo'q
    .mockResolvedValueOnce([{ blocked_count: 0 }]); // inventar bloklanmagan

  return { pg, service };
}

/** `PaymentsService` — haqiqiy servis, DB va Uzum Checkout mock qilingan. */
function makePaymentsService() {
  const pg: PgMock = { query: jest.fn(), transaction: jest.fn() };
  const checkout = { register: jest.fn() };
  const service = new PaymentsService(
    pg as unknown as PostgresService,
    { get: jest.fn() } as never,
    { isConfigured: () => false } as never,
    { isConfigured: () => false } as never,
    { isConfigured: () => false } as never,
    checkout as never,
  );
  return { pg, checkout, service };
}

const bookingVisibilityRow = {
  id: 'booking-1',
  booking_number: 'UZB-D3TEST01',
  user_id: 'user-owner',
  partner_organization_id: 'partner-1',
  total_amount: 500_000,
  currency: 'UZS',
};

/**
 * HAQIQIY bron yaratish oqimini ishga tushiradi va uning `INSERT INTO
 * payments` qatorini (production shakli) qaytaradi.
 */
async function createBookingDraftRow(paymentMethod: string): Promise<{
  row: Record<string, unknown>;
  response: Record<string, unknown>;
}> {
  const { pg, service } = makeBookingsService();
  const result = (await service.createHotel(owner, {
    hotel_id: 'hotel-1',
    room_id: 'room-1',
    agree_terms: true,
    check_in: '2026-10-10',
    check_out: '2026-10-12',
    rooms: 1,
    guests: 2,
    payment_method: paymentMethod,
  })) as { payment: Record<string, unknown> };

  const insert = findCall(pg.query, 'INSERT INTO payments');
  expect(insert).toBeDefined();
  return {
    row: rowFromPositionalInsert(insert as QueryCall),
    response: result.payment,
  };
}

describe('D3 (a) — bron yaratilishidagi QORALAMA qator sxema konvensiyasiga mos yoziladi', () => {
  it.each(['uzcard', 'humo', 'visa', 'mastercard'])(
    "payment_method='%s' => DB'ga provider='uzum_checkout' + card_scheme=<sxema>",
    async (scheme) => {
      const { row, response } = await createBookingDraftRow(scheme);

      // Sxema konvensiyasi (schema.prisma `Payment.cardScheme`): karta
      // turlari uchun `provider` — faqat TRANSPORT.
      expect(row.provider).toBe('uzum_checkout');
      expect(row.card_scheme).toBe(scheme);
      expect(row.status).toBe('pending');
      // Qoralama — hali tashqi sessiya YO'Q (URL faqat `/payment/register`
      // javobidan keladi).
      expect(row.payment_url).toBeNull();
      expect(row.provider_reference).toBeUndefined();

      // Javob shakli (frontend shartnomasi) O'ZGARMAYDI — foydalanuvchi
      // tanlagan usulning O'ZI qaytadi, ichki transport yashiringan.
      expect(response.provider).toBe(scheme);
    },
  );

  it("D3 (d) — 'cash' qoralamasi TEGILMAGAN: provider='cash', card_scheme=null, status='awaiting_cash'", async () => {
    const { row, response } = await createBookingDraftRow('cash');
    expect(row.provider).toBe('cash');
    expect(row.card_scheme).toBeNull();
    expect(row.status).toBe('awaiting_cash');
    expect(row.payment_url).toBeNull();
    expect(response.provider).toBe('cash');
    expect(response.status).toBe('awaiting_cash');
  });

  it("D3 (d) — 'click' qoralamasi TEGILMAGAN: provider='click', card_scheme=null, URL o'z joyida", async () => {
    const { row, response } = await createBookingDraftRow('click');
    expect(row.provider).toBe('click');
    expect(row.card_scheme).toBeNull();
    expect(row.status).toBe('pending');
    expect(row.payment_url).toBe('https://checkout.example/click');
    expect(response.provider).toBe('click');
  });
});

describe('D3 (b) — HAQIQIY qoralama qator ustida to’lov yaratish: qisqa-tutashuv YO’Q, register() CHAQIRILADI', () => {
  it.each(['uzcard', 'humo', 'visa', 'mastercard'])(
    "payment_method='%s' bron => o'sha usul bilan /create => checkout.register() chaqiriladi va haqiqiy payment_url qaytadi",
    async (scheme) => {
      // 1) Qoralama — QO'LDA emas, HAQIQIY bron oqimidan.
      const { row: draftRow } = await createBookingDraftRow(scheme);

      // 2) Endi foydalanuvchi to'lovni boshlaydi (AYNAN o'sha usul bilan —
      //    normal holat; aynan shu holatda xato yuzaga kelardi).
      const { pg, checkout, service } = makePaymentsService();
      checkout.register.mockResolvedValue({
        orderId: `order-${scheme}`,
        paymentUrl: `https://checkout.uzum.uz/pay/order-${scheme}`,
        raw: {},
      });
      pg.query
        .mockResolvedValueOnce([bookingVisibilityRow]) // assertBookingVisible
        .mockResolvedValueOnce([draftRow]) // mavjud ochiq qator = QORALAMA
        .mockResolvedValueOnce([]) // DELETE (o'lik qoralama)
        .mockResolvedValueOnce([]); // INSERT (haqiqiy sessiya)

      const result = await service.createPayment(owner, 'booking-1', {
        provider: scheme,
      });

      expect(checkout.register).toHaveBeenCalledTimes(1);
      const deleteCall = findCall(pg.query, 'DELETE FROM payments');
      expect(deleteCall?.[1]).toEqual([draftRow.id]);
      expect(result).toMatchObject({
        provider: scheme,
        status: 'processing',
        payment_url: `https://checkout.uzum.uz/pay/order-${scheme}`,
      });
      const insert = findCall(pg.query, 'INSERT INTO payments');
      expect(insert?.[1]).toContain(`order-${scheme}`); // provider_reference
    },
  );

  it("ESKI (fix'dan OLDIN yozilgan) qoralama — provider='uzcard', card_scheme=NULL — ham davolanadi: migratsiya SHART EMAS", async () => {
    const legacyDraft = {
      id: 'payment-legacy-draft',
      booking_id: 'booking-1',
      provider: 'uzcard',
      card_scheme: null,
      status: 'pending',
      amount: 500_000,
      currency: 'UZS',
      payment_url: null,
      provider_reference: null,
      created_at: '2026-09-19T10:00:00.000Z',
      updated_at: '2026-09-19T10:00:00.000Z',
    };
    const { pg, checkout, service } = makePaymentsService();
    checkout.register.mockResolvedValue({
      orderId: 'order-legacy',
      paymentUrl: 'https://checkout.uzum.uz/pay/order-legacy',
      raw: {},
    });
    pg.query
      .mockResolvedValueOnce([bookingVisibilityRow])
      .mockResolvedValueOnce([legacyDraft])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.createPayment(owner, 'booking-1', {
      provider: 'uzcard',
    });

    expect(checkout.register).toHaveBeenCalledTimes(1);
    expect(findCall(pg.query, 'DELETE FROM payments')?.[1]).toEqual([
      'payment-legacy-draft',
    ]);
    expect(result).toMatchObject({
      provider: 'uzcard',
      payment_url: 'https://checkout.uzum.uz/pay/order-legacy',
    });
  });

  it('provayder sozlanmagan bo’lsa — 503, va HECH QANDAY yangi qator yozilmaydi (fail-closed saqlanadi)', async () => {
    const { row: draftRow } = await createBookingDraftRow('humo');
    const { pg, checkout, service } = makePaymentsService();
    checkout.register.mockRejectedValue(
      new UzumCheckoutError(UZUM_CHECKOUT_ERROR.NOT_CONFIGURED, 'sozlanmagan'),
    );
    pg.query
      .mockResolvedValueOnce([bookingVisibilityRow])
      .mockResolvedValueOnce([draftRow])
      .mockResolvedValueOnce([]); // DELETE

    await expect(
      service.createPayment(owner, 'booking-1', { provider: 'humo' }),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' },
    });
    expect(findCall(pg.query, 'INSERT INTO payments')).toBeUndefined();
  });
});

describe('D3 (c) — idempotentlik SAQLANADI: takroriy so’rov qo’sh registratsiya yaratmaydi', () => {
  it('bir xil usul + TIRIK tashqi sessiya (processing + provider_reference) => register QAYTA chaqirilmaydi, qator o’zgarmaydi', async () => {
    const { row: draftRow } = await createBookingDraftRow('uzcard');
    const { pg, checkout, service } = makePaymentsService();
    checkout.register.mockResolvedValue({
      orderId: 'order-uzcard-live',
      paymentUrl: 'https://checkout.uzum.uz/pay/order-uzcard-live',
      raw: {},
    });

    // 1-chaqiruv — qoralama almashtiriladi, register BIR marta.
    pg.query
      .mockResolvedValueOnce([bookingVisibilityRow])
      .mockResolvedValueOnce([draftRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const first = await service.createPayment(owner, 'booking-1', {
      provider: 'uzcard',
    });
    expect(checkout.register).toHaveBeenCalledTimes(1);

    // 2-chaqiruv (foydalanuvchi tugmani qayta bosdi) — endi DB'da
    // 1-chaqiruv yozgan TIRIK sessiya bor.
    const liveRow = {
      id: first.id,
      booking_id: 'booking-1',
      provider: 'uzum_checkout',
      card_scheme: 'uzcard',
      status: 'processing',
      provider_reference: 'order-uzcard-live',
      amount: first.amount,
      base_amount: first.base_amount,
      fee_rate: first.fee_rate,
      fee_amount: first.fee_amount,
      currency: 'UZS',
      payment_url: 'https://checkout.uzum.uz/pay/order-uzcard-live',
    };
    pg.query.mockReset();
    pg.query
      .mockResolvedValueOnce([bookingVisibilityRow])
      .mockResolvedValueOnce([liveRow]);

    const second = await service.createPayment(owner, 'booking-1', {
      provider: 'uzcard',
    });

    // Jami REGISTER soni — 1 (qo'sh registratsiya YO'Q).
    expect(checkout.register).toHaveBeenCalledTimes(1);
    expect(findCall(pg.query, 'DELETE FROM payments')).toBeUndefined();
    expect(findCall(pg.query, 'INSERT INTO payments')).toBeUndefined();
    expect(second).toMatchObject({
      id: first.id,
      provider: 'uzcard',
      status: 'processing',
      payment_url: 'https://checkout.uzum.uz/pay/order-uzcard-live',
    });
  });

  it("faqat `provider_reference` bor (status hali 'pending') => bu ham TIRIK sessiya, almashtirilmaydi", async () => {
    const { pg, checkout, service } = makePaymentsService();
    const registeredButPending = {
      id: 'payment-registered',
      booking_id: 'booking-1',
      provider: 'uzum_checkout',
      card_scheme: 'visa',
      status: 'pending',
      provider_reference: 'order-visa-live',
      amount: 517_500,
      currency: 'UZS',
      payment_url: 'https://checkout.uzum.uz/pay/order-visa-live',
    };
    pg.query
      .mockResolvedValueOnce([bookingVisibilityRow])
      .mockResolvedValueOnce([registeredButPending]);

    const result = await service.createPayment(owner, 'booking-1', {
      provider: 'visa',
    });

    expect(checkout.register).not.toHaveBeenCalled();
    expect(findCall(pg.query, 'DELETE FROM payments')).toBeUndefined();
    expect(result).toMatchObject({
      id: 'payment-registered',
      provider: 'visa',
    });
  });
});

describe('D3 (d) — karta bo’lmagan provayderlar semantikasi O’ZGARMAYDI', () => {
  it("'click' qoralamasi + qayta 'click' so'rovi => o'sha qator qaytadi (DELETE/INSERT yo'q)", async () => {
    const { row: draftRow } = await createBookingDraftRow('click');
    const { pg, checkout, service } = makePaymentsService();
    pg.query
      .mockResolvedValueOnce([bookingVisibilityRow])
      .mockResolvedValueOnce([draftRow]);

    const result = await service.createPayment(owner, 'booking-1', {
      provider: 'click',
    });

    expect(checkout.register).not.toHaveBeenCalled();
    expect(findCall(pg.query, 'DELETE FROM payments')).toBeUndefined();
    expect(findCall(pg.query, 'INSERT INTO payments')).toBeUndefined();
    expect(result).toMatchObject({
      id: draftRow.id,
      provider: 'click',
      payment_url: 'https://checkout.example/click',
    });
  });

  it("'uzum' (Merchant) — `payment_url` yo'q, `provider_reference` yo'q pending qator ham ALMASHTIRILMAYDI (Checkout emas)", async () => {
    const { pg, checkout, service } = makePaymentsService();
    const uzumRow = {
      id: 'payment-uzum',
      booking_id: 'booking-1',
      provider: 'uzum',
      card_scheme: null,
      status: 'pending',
      provider_reference: null,
      amount: 500_000,
      currency: 'UZS',
      payment_url: null,
    };
    pg.query
      .mockResolvedValueOnce([bookingVisibilityRow])
      .mockResolvedValueOnce([uzumRow]);

    const result = await service.createPayment(owner, 'booking-1', {
      provider: 'uzum',
    });

    expect(checkout.register).not.toHaveBeenCalled();
    expect(findCall(pg.query, 'DELETE FROM payments')).toBeUndefined();
    expect(findCall(pg.query, 'INSERT INTO payments')).toBeUndefined();
    expect(result).toMatchObject({ id: 'payment-uzum', provider: 'uzum' });
  });

  it("schemasiz 'uzum_checkout' — TIRIK sessiya qaytadi, O'LIK qoralama esa almashtiriladi", async () => {
    // TIRIK
    {
      const { pg, checkout, service } = makePaymentsService();
      pg.query
        .mockResolvedValueOnce([bookingVisibilityRow])
        .mockResolvedValueOnce([
          {
            id: 'payment-live-generic',
            booking_id: 'booking-1',
            provider: 'uzum_checkout',
            card_scheme: null,
            status: 'processing',
            provider_reference: 'order-generic',
            amount: 500_000,
            currency: 'UZS',
          },
        ]);
      const result = await service.createPayment(owner, 'booking-1', {
        provider: 'uzum_checkout',
      });
      expect(checkout.register).not.toHaveBeenCalled();
      expect(result).toMatchObject({ id: 'payment-live-generic' });
    }
    // O'LIK
    {
      const { pg, checkout, service } = makePaymentsService();
      checkout.register.mockResolvedValue({
        orderId: 'order-generic-new',
        paymentUrl: 'https://checkout.uzum.uz/pay/order-generic-new',
        raw: {},
      });
      pg.query
        .mockResolvedValueOnce([bookingVisibilityRow])
        .mockResolvedValueOnce([
          {
            id: 'payment-dead-generic',
            booking_id: 'booking-1',
            provider: 'uzum_checkout',
            card_scheme: null,
            status: 'pending',
            provider_reference: null,
            amount: 500_000,
            currency: 'UZS',
            payment_url: null,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const result = await service.createPayment(owner, 'booking-1', {
        provider: 'uzum_checkout',
      });
      expect(checkout.register).toHaveBeenCalledTimes(1);
      expect(findCall(pg.query, 'DELETE FROM payments')?.[1]).toEqual([
        'payment-dead-generic',
      ]);
      expect(result).toMatchObject({
        provider: 'uzum_checkout',
        fee_amount: 0, // schemasiz => fee YO'Q (avvalgidek)
      });
    }
  });
});

describe('D3 — rekonsiliatsiya oynasi qoralamalar bilan to’lib ketmaydi', () => {
  it("scan so'rovi `provider_reference` bo'sh qatorlarni SQL darajasida chetlab o'tadi (sikldagi `continue` bilan bir xil shart)", async () => {
    const { pg, checkout, service } = makePaymentsService();
    (checkout as unknown as { isConfigured: () => boolean }).isConfigured =
      () => true;
    pg.query.mockResolvedValue([]);

    await service.reconcileUzumCheckoutPayments();

    const scan = findCalls(pg.query, "provider = 'uzum_checkout'")[0];
    expect(scan?.[0]).toContain("coalesce(provider_reference, '') <> ''");
    // Vaqt oynasi va LIMIT ATAYLAB o'zgartirilmagan.
    expect(scan?.[0]).toContain('make_interval(mins => $1::int)');
    expect(scan?.[0]).toContain('LIMIT 100');
  });
});

describe('D3 — o’qish yo’li yozish yo’li bilan MOS: `provider` maydonida karta turi qaytadi', () => {
  /**
   * `GET /bookings/:id` javobidagi `payment.provider` web-user'da to'lov
   * sahifasidagi qayta urinish formasining BOSHLANG'ICH usulini tanlaydi
   * (`booking/[id]/page.tsx` — `initialProvider={... ?? payment?.provider}`).
   * Agar u yerga ichki transport qiymati ('uzum_checkout') tushsa,
   * foydalanuvchi tanlagan karta turi (va unga bog'liq fee) yo'qolardi.
   */
  function makeBookingsServiceForRead() {
    const pg = {
      query: jest.fn().mockResolvedValue([]),
      transaction: jest.fn(),
    };
    const service = new BookingsService(
      pg as unknown as PostgresService,
      {
        bookingStatusChanged: jest.fn(),
        partnerDashboardUpdated: jest.fn(),
        adminDashboardUpdated: jest.fn(),
      } as unknown as EventsService,
      { send: jest.fn() } as unknown as EmailService,
      {} as unknown as PromosService,
      { buildCheckoutUrl: jest.fn() } as unknown as PaymentsService,
      {
        get: jest.fn(),
        set: jest.fn(),
        getOrSet: jest.fn(),
      } as unknown as AppCacheService,
    );
    return { pg, service };
  }

  const storedCardRow = {
    id: 'payment-1',
    booking_id: 'booking-1',
    // DB'dagi KANONIK shakl (yangi qoralama ham, `createUzumCheckoutPayment`
    // yozgan haqiqiy sessiya ham xuddi shunday).
    provider: 'uzum_checkout',
    card_scheme: 'uzcard',
    status: 'pending',
    amount: 500_000,
    currency: 'UZS',
    payment_url: null,
  };

  it("GET /bookings/:id (findOne) => payment.provider = 'uzcard' ('uzum_checkout' EMAS)", async () => {
    const { pg, service } = makeBookingsServiceForRead();
    pg.query
      .mockResolvedValueOnce([
        {
          id: 'booking-1',
          user_id: 'user-owner',
          partner_organization_id: 'partner-1',
        },
      ])
      .mockResolvedValueOnce([storedCardRow]);

    const result = (await service.findOne(owner, 'booking-1')) as {
      payment: Record<string, unknown>;
    };

    expect(result.payment.provider).toBe('uzcard');
    expect(result.payment.id).toBe('payment-1');
  });

  it("POST /bookings/lookup (guest) => payment.provider = 'uzcard', `card_scheme` javobga chiqmaydi", async () => {
    const { pg, service } = makeBookingsServiceForRead();
    pg.query
      .mockResolvedValueOnce([
        {
          id: 'booking-1',
          booking_number: 'UZB-D3TEST01',
          type: 'hotel',
          status: 'awaiting_payment',
          currency: 'UZS',
          total_amount: 500_000,
        },
      ])
      .mockResolvedValueOnce([
        {
          status: 'pending',
          provider: 'uzum_checkout',
          card_scheme: 'uzcard',
          amount: 500_000,
          currency: 'UZS',
        },
      ]);

    const result = (await service.lookupBooking(
      'UZB-D3TEST01',
      'guest@example.com',
    )) as { payment: Record<string, unknown> | null };

    expect(result.payment).toEqual({
      status: 'pending',
      provider: 'uzcard',
      amount: 500_000,
      currency: 'UZS',
    });
  });

  it("karta bo'lmagan provayder (click) — `provider` o'zgarishsiz qaytadi", async () => {
    const { pg, service } = makeBookingsServiceForRead();
    pg.query
      .mockResolvedValueOnce([
        {
          id: 'booking-1',
          user_id: 'user-owner',
          partner_organization_id: 'partner-1',
        },
      ])
      .mockResolvedValueOnce([
        { ...storedCardRow, provider: 'click', card_scheme: null },
      ]);

    const result = (await service.findOne(owner, 'booking-1')) as {
      payment: Record<string, unknown>;
    };

    expect(result.payment.provider).toBe('click');
  });
});

describe('R10 — 0 UZS bron `POST /payments/:bookingId/create`da 500 bermaydi (F7 crash himoyasi)', () => {
  /**
   * `calculateCardSchemeFee()` `baseAmountSom <= 0` bo'lsa `RangeError`
   * tashlaydi va u `checkout.register()`ni o'rab turgan try/catch'dan
   * TASHQARIDA chaqiriladi — himoyasiz bu mijozga 500 sifatida chiqardi.
   * D1'dan keyin bepul bron darhol `confirmed` bo'ladi va normal oqimda bu
   * yerga yetib kelmaydi, LEKIN `retryPayment()`/eski bronlar orqali
   * yetib kelishi MUMKIN.
   */
  const freeBookingRow = {
    id: 'booking-free',
    booking_number: 'UZB-FREE0001',
    user_id: 'user-owner',
    partner_organization_id: 'partner-1',
    total_amount: 0,
    currency: 'UZS',
  };

  it.each([
    'uzcard',
    'humo',
    'visa',
    'mastercard',
    'uzum_checkout',
    'click',
    'payme',
    'cash',
  ])(
    "provider='%s' => 422 PAYMENT_NOT_REQUIRED (RangeError/500 EMAS), qator yozilmaydi",
    async (provider) => {
      const { pg, checkout, service } = makePaymentsService();
      pg.query
        .mockResolvedValueOnce([freeBookingRow]) // assertBookingVisible
        .mockResolvedValueOnce([]); // ochiq to'lov yo'q

      await expect(
        service.createPayment(owner, 'booking-free', { provider }),
      ).rejects.toMatchObject({
        status: 422,
        response: { code: 'PAYMENT_NOT_REQUIRED' },
      });

      expect(checkout.register).not.toHaveBeenCalled();
      expect(findCall(pg.query, 'INSERT INTO payments')).toBeUndefined();
    },
  );

  it('pullik bron (>0) — himoya ishga tushmaydi, oqim avvalgidek davom etadi', async () => {
    const { pg, checkout, service } = makePaymentsService();
    checkout.register.mockResolvedValue({
      orderId: 'order-paid',
      paymentUrl: 'https://checkout.uzum.uz/pay/order-paid',
      raw: {},
    });
    pg.query
      .mockResolvedValueOnce([bookingVisibilityRow]) // total_amount = 500 000
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.createPayment(owner, 'booking-1', {
      provider: 'uzcard',
    });

    expect(checkout.register).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ provider: 'uzcard', status: 'processing' });
  });
});
