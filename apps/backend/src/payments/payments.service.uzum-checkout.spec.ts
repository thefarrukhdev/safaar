import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import {
  PostgresService,
  type PostgresTransaction,
} from '../infrastructure/postgres.service';
import { PaymentsService } from './payments.service';
import { UzumProvider } from './providers/uzum.provider';
import {
  UzumCheckoutProvider,
  normalizeCheckoutCallback,
  type NormalizedCheckoutCallback,
} from './providers/uzum-checkout.provider';
import {
  REAL_UZUM_CHECKOUT_FAIL_FIXTURE,
  REAL_UZUM_CHECKOUT_REFUND_FIXTURE,
  REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE,
} from './providers/uzum-checkout.real-fixtures';

/**
 * PaymentsService.uzumCheckoutCallback() — SAFAAR ICHKI, normallashtirilgan
 * callback shakli ustidan test.
 *
 * MUHIM: bu fixture'lar Uzum production kontrakti EMAS. Uzum Checkout'ning
 * rasmiy callback payload + `operationState` + imzo spec'i bizda hali YO'Q.
 * Bu testlar service qatlamining ICHKI shartnomasini (`NormalizedCheckoutCallback`)
 * va mavjud `processPaymentEvent()` bilan integratsiyasini tekshiradi.
 */

type QueryCall = [sql: string, params?: readonly unknown[]];
const callsOf = (m: jest.Mock): QueryCall[] => m.mock.calls as QueryCall[];
const findCall = (m: jest.Mock, needle: string): QueryCall | undefined =>
  callsOf(m).find(([sql]) => String(sql).includes(needle));
const countCalls = (m: jest.Mock, needle: string): number =>
  callsOf(m).filter(([sql]) => String(sql).includes(needle)).length;

const ORDER_ID = 'uzc-88817263';

const openBooking = {
  id: 'booking-1',
  booking_number: 'UZB-QATEST01',
  status: 'pending',
  user_id: 'user-1',
  partner_organization_id: 'partner-1',
  confirmation_mode: 'instant_confirmation',
  total_amount: '150000',
  partner_payable: '135000',
  currency: 'UZS',
  expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
};

const checkoutPayment = {
  id: 'payment-uzc-1',
  booking_id: 'booking-1',
  amount: '150000',
  currency: 'UZS',
  status: 'processing',
  provider: 'uzum_checkout',
  provider_reference: ORDER_ID,
  idempotency_key: `uzum_checkout:${ORDER_ID}`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const normalized = (
  over: Partial<NormalizedCheckoutCallback> = {},
): NormalizedCheckoutCallback => ({
  orderId: ORDER_ID,
  orderNumber: 'UZB-QATEST01',
  merchantOperationId: 'payment-uzc-1',
  amountSom: 150000,
  currency: 'UZS',
  state: 'PAID',
  raw: { orderId: ORDER_ID, state: 'X' },
  ...over,
});

/**
 * `getOrderStatus()` uchun auth (auth-only, fiskal SHART EMAS — `isConfigured()`
 * fiskalni tekshirmaydi). PAID yo'liga yetgan HAR BIR testda callback endi
 * BU orqali (X-Terminal-Id/X-Api-Key bilan autentifikatsiyalangan, mocked
 * `fetch`) o'z summasini MUSTAQIL qayta tasdiqlaydi — callback body'sidagi
 * `amountSom` ENDI hech qachon to'g'ridan-to'g'ri ishonilmaydi (2026-09-11
 * YANGILANDI, `uzum-checkout.provider.ts` fayl boshidagi izohga qarang).
 */
const GET_ORDER_STATUS_AUTH_CONFIG: Record<string, string> = {
  UZUM_CHECKOUT_BASE_URL: 'https://checkout.example',
  UZUM_CHECKOUT_TERMINAL_ID: 'terminal-test',
  UZUM_CHECKOUT_API_KEY: 'api-key-test',
};

/** `getOrderStatus()`ning navbatdagi (bitta) chaqiruviga mock javob beradi. */
function mockGetOrderStatusOnce(opts: {
  status: 'COMPLETED' | 'REGISTERED' | 'DECLINED';
  completedAmountTiyin?: number;
}) {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        errorCode: 0,
        result: {
          orderId: 'irrelevant-for-this-mock',
          status: opts.status,
          completedAmount: opts.completedAmountTiyin ?? 0,
        },
      }),
  } as Response);
}

describe('PaymentsService.uzumCheckoutCallback (INTERNAL contract layer)', () => {
  let pg: { query: jest.Mock; transaction: jest.Mock };
  let service: PaymentsService;

  beforeEach(() => {
    pg = { query: jest.fn(), transaction: jest.fn() };
    pg.transaction.mockImplementation(
      (op: (tx: PostgresTransaction) => unknown) => op({ query: pg.query }),
    );
    service = new PaymentsService(
      pg as unknown as PostgresService,
      { get: jest.fn() } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      new UzumProvider({ get: jest.fn() } as never),
      new UzumCheckoutProvider({
        get: (k: string) => GET_ORDER_STATUS_AUTH_CONFIG[k],
      } as never),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('8/9) state=PAID — payment paid, booking confirmed, ledger bir marta', async () => {
    mockGetOrderStatusOnce({
      status: 'COMPLETED',
      completedAmountTiyin: 15_000_000,
    }); // 150000 so'm
    pg.query
      .mockResolvedValueOnce([checkoutPayment]) // 1: locate checkout payment
      // processPaymentEvent(...):
      .mockResolvedValueOnce([{ id: 'evt-1', payment_id: null }]) // claim event
      .mockResolvedValueOnce([openBooking]) // booking FOR UPDATE
      .mockResolvedValueOnce([checkoutPayment]) // payment FOR UPDATE
      .mockResolvedValueOnce([]) // UPDATE payments -> paid
      .mockResolvedValueOnce([]) // UPDATE payment_events
      .mockResolvedValueOnce([]) // UPDATE bookings -> confirmed
      .mockResolvedValueOnce([]) // INSERT booking_status_history
      .mockResolvedValueOnce([]); // INSERT partner_ledger_entries

    const res = await service.uzumCheckoutCallback(normalized());
    expect(res).toEqual({ received: true, duplicate: false, applied: true });

    const paidUpd = findCall(pg.query, 'SET status = $1, provider_reference');
    expect(paidUpd?.[1]?.[0]).toBe('paid');
    expect(countCalls(pg.query, 'INSERT INTO partner_ledger_entries')).toBe(1);
    // event_key uzum_checkout:confirm:<orderId>
    const claim = findCall(pg.query, 'INSERT INTO payment_events');
    expect(String(claim?.[1]?.[3])).toBe(`uzum_checkout:confirm:${ORDER_ID}`);
  });

  it('2/10) duplicate callback — ikkinchi marta PAID/ledger qilinmaydi, applied=false', async () => {
    mockGetOrderStatusOnce({
      status: 'COMPLETED',
      completedAmountTiyin: 15_000_000,
    });
    pg.query
      .mockResolvedValueOnce([checkoutPayment]) // locate payment
      .mockResolvedValueOnce([]) // claim -> ON CONFLICT DO NOTHING (0 rows)
      .mockResolvedValueOnce([{ id: 'evt-1', payment_id: 'payment-uzc-1' }]) // existing event
      .mockResolvedValueOnce([{ ...checkoutPayment, status: 'paid' }]); // existing payment

    const res = await service.uzumCheckoutCallback(normalized());
    expect(res).toEqual({ received: true, duplicate: true, applied: false });
    expect(countCalls(pg.query, 'INSERT INTO partner_ledger_entries')).toBe(0);
    expect(
      findCall(pg.query, 'SET status = $1, provider_reference'),
    ).toBeUndefined();
  });

  it("2b) allaqachon YAKUNIY holatda (refunded) to'lov uchun YANGI (duplicate EMAS) PAID claim keladi — qayta 'paid' qilinmaydi, ledger qayta kreditlanmaydi (TERMINAL_PAYMENT_STATUSES qo'riqchisi)", async () => {
    mockGetOrderStatusOnce({
      status: 'COMPLETED',
      completedAmountTiyin: 15_000_000,
    });
    const refundedPayment = { ...checkoutPayment, status: 'refunded' };
    pg.query
      .mockResolvedValueOnce([refundedPayment]) // locate payment (allaqachon refunded)
      .mockResolvedValueOnce([{ id: 'evt-new', payment_id: null }]) // YANGI claim (duplicate emas)
      .mockResolvedValueOnce([openBooking]) // booking FOR UPDATE
      .mockResolvedValueOnce([refundedPayment]) // payment FOR UPDATE — hamon refunded
      .mockResolvedValueOnce([]); // UPDATE payment_events SET payment_id (terminal-guard yo'li)

    const res = await service.uzumCheckoutCallback(normalized());
    expect(res).toEqual({ received: true, duplicate: true, applied: false });
    expect(countCalls(pg.query, 'INSERT INTO partner_ledger_entries')).toBe(0);
    expect(
      findCall(pg.query, 'SET status = $1, provider_reference'),
    ).toBeUndefined();
    expect(findCall(pg.query, 'UPDATE bookings')).toBeUndefined();
  });

  it("3) unknown order — payment/booking holati o'zgarmaydi, lekin xom payload audit uchun saqlanadi, code=unknown_order", async () => {
    pg.query
      .mockResolvedValueOnce([]) // no payment
      .mockResolvedValueOnce([]); // audit INSERT INTO payment_events
    const res = await service.uzumCheckoutCallback(normalized());
    expect(res).toMatchObject({ applied: false, code: 'unknown_order' });
    expect(pg.query).toHaveBeenCalledTimes(2);

    // Hech qanday payment/booking UPDATE bo'lmaydi — faqat audit INSERT.
    expect(
      findCall(pg.query, 'SET status = $1, provider_reference'),
    ).toBeUndefined();
    expect(findCall(pg.query, 'UPDATE bookings')).toBeUndefined();

    const audit = findCall(pg.query, 'INSERT INTO payment_events');
    expect(String(audit?.[1]?.[1])).toBe('callback:unknown_order');
    expect(String(audit?.[1]?.[2])).toBe(`uzum_checkout:unknown:${ORDER_ID}`);
    const payload = JSON.parse(String(audit?.[1]?.[3])) as {
      raw: unknown;
    };
    expect(payload.raw).toEqual(normalized().raw);
  });

  it('3b) matched payment is NOT a checkout payment — treated as unknown_order, still audited', async () => {
    pg.query
      .mockResolvedValueOnce([
        { ...checkoutPayment, provider: 'click', idempotency_key: 'click:x' },
      ])
      .mockResolvedValueOnce([]); // audit INSERT
    const res = await service.uzumCheckoutCallback(normalized());
    expect(res).toMatchObject({ applied: false, code: 'unknown_order' });
    expect(findCall(pg.query, 'INSERT INTO payment_events')).toBeDefined();
  });

  it('3c-debug) unknown order with debug headers — headers preserved alongside raw payload, never overwrite raw fields', async () => {
    pg.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const debugHeaders = { 'content-type': 'application/json' };
    await service.uzumCheckoutCallback(normalized(), debugHeaders);
    const audit = findCall(pg.query, 'INSERT INTO payment_events');
    const payload = JSON.parse(String(audit?.[1]?.[3])) as {
      raw: unknown;
      debug_headers?: Record<string, string>;
    };
    expect(payload.debug_headers).toEqual(debugHeaders);
    expect(payload.raw).toEqual(normalized().raw);
  });

  it('3d-debug) unknown order without debug headers — no debug_headers key added', async () => {
    pg.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await service.uzumCheckoutCallback(normalized());
    const audit = findCall(pg.query, 'INSERT INTO payment_events');
    const payload = JSON.parse(String(audit?.[1]?.[3])) as Record<
      string,
      unknown
    >;
    expect(Object.prototype.hasOwnProperty.call(payload, 'debug_headers')).toBe(
      false,
    );
  });

  it('3c) missing orderId/orderNumber (malformed callback) — no NUL byte reaches SQL params, graceful unknown_order (regression: raw \\x00 fallback used to be sent as a Postgres query param and would throw a driver-level error instead of resolving cleanly)', async () => {
    pg.query.mockResolvedValueOnce([]); // no payment matches the placeholder sentinels
    const res = await service.uzumCheckoutCallback(
      normalized({ orderId: '', orderNumber: '' }),
    );
    expect(res).toMatchObject({ applied: false, code: 'unknown_order' });

    const lookup = pg.query.mock.calls[0] as [string, unknown[]];
    const params = lookup[1];
    // Hech bir parametrda xom NUL bayt bo'lmasligi kerak.
    for (const p of params) {
      expect(String(p)).not.toContain(String.fromCharCode(0)); // NUL bayt
    }
    expect(params[1]).toBe('__uzum_checkout_no_order_id__');
    expect(params[3]).toBe('__uzum_checkout_no_order_number__');
  });

  it("4) amount mismatch — callback body'sidagi amountSom ENDI ISHLATILMAYDI; Uzum'ning O'ZI (getOrderStatus) qaytargan tasdiqlangan summa payment.amount bilan solishtiriladi", async () => {
    // Callback body 150000 (to'g'ri) da'vo qilsa ham — bu ENDI e'tiborga
    // olinmaydi. Uzum'ning O'Z (mustaqil, autentifikatsiyalangan)
    // getOrderStatus javobi 999999 qaytaradi => shu tasdiqlangan summa
    // payment.amount (150000) bilan solishtiriladi va mos kelmaydi.
    mockGetOrderStatusOnce({
      status: 'COMPLETED',
      completedAmountTiyin: 99_999_900,
    });
    pg.query
      .mockResolvedValueOnce([checkoutPayment])
      .mockResolvedValueOnce([{ id: 'evt-1', payment_id: null }]) // claim
      .mockResolvedValueOnce([openBooking]) // booking
      .mockResolvedValueOnce([checkoutPayment]); // payment FOR UPDATE (amount 150000)

    const res = await service.uzumCheckoutCallback(
      normalized({ amountSom: 150000 }), // callback body o'zi "to'g'ri" deb da'vo qiladi
    );
    expect(res).toMatchObject({ applied: false, code: 'amount_mismatch' });
    expect(
      findCall(pg.query, 'SET status = $1, provider_reference'),
    ).toBeUndefined();
  });

  it("4b) Uzum'ning O'Z getOrderStatus javobi HALI COMPLETED EMAS (masalan REGISTERED) — callback PAID deb da'vo qilsa ham hech narsa qo'llanilmaydi, faqat audit (callback:unverified)", async () => {
    mockGetOrderStatusOnce({ status: 'REGISTERED', completedAmountTiyin: 0 });
    pg.query
      .mockResolvedValueOnce([checkoutPayment]) // locate payment
      .mockResolvedValueOnce([]); // audit INSERT (callback:unverified)

    const res = await service.uzumCheckoutCallback(normalized());
    expect(res).toEqual({ received: true, duplicate: false, applied: false });
    expect(
      findCall(pg.query, 'SET status = $1, provider_reference'),
    ).toBeUndefined();
    // `event_type='callback:unverified'` SQL matnida literal (bog'langan
    // parametr emas) — `findCall` SQL matnini o'zi orqali tekshiramiz.
    const auditSql = pg.query.mock.calls.find(([sql]: [string]) =>
      String(sql).includes("'callback:unverified'"),
    ) as [string, readonly unknown[]] | undefined;
    expect(auditSql).toBeDefined();
    expect(String(auditSql?.[1]?.[1])).toBe(
      `uzum_checkout:unverified:${ORDER_ID}`,
    );
  });

  it("4c) getOrderStatus() o'zi muvaffaqiyatsiz (tarmoq/konfiguratsiya) — oddiy Error throw qiladi (UzumCheckoutError EMAS — controller uni signature-rad etish deb noto'g'ri talqin qilmasligi uchun), hech narsa PAID bo'lmaydi", async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('ECONNRESET'));
    pg.query.mockResolvedValueOnce([checkoutPayment]); // locate payment

    await expect(service.uzumCheckoutCallback(normalized())).rejects.toThrow(
      'uzum_checkout_status_reverify_failed',
    );
    expect(
      findCall(pg.query, 'SET status = $1, provider_reference'),
    ).toBeUndefined();
  });

  it('5) currency mismatch — reject, PAID qilinmaydi', async () => {
    mockGetOrderStatusOnce({
      status: 'COMPLETED',
      completedAmountTiyin: 15_000_000,
    });
    pg.query
      .mockResolvedValueOnce([checkoutPayment])
      .mockResolvedValueOnce([{ id: 'evt-1', payment_id: null }])
      .mockResolvedValueOnce([openBooking])
      .mockResolvedValueOnce([checkoutPayment]); // currency UZS

    const res = await service.uzumCheckoutCallback(
      normalized({ currency: 'USD' }),
    );
    expect(res).toMatchObject({ applied: false, code: 'currency_mismatch' });
    expect(
      findCall(pg.query, 'SET status = $1, provider_reference'),
    ).toBeUndefined();
  });

  it('11) non-PAID state — audit event claim, payment/booking TEGILMAYDI', async () => {
    pg.query
      .mockResolvedValueOnce([checkoutPayment]) // locate payment
      .mockResolvedValueOnce([]); // INSERT payment_events (audit)

    const res = await service.uzumCheckoutCallback(
      normalized({ state: 'FAILED' }),
    );
    expect(res).toEqual({ received: true, duplicate: false, applied: false });
    expect(
      findCall(pg.query, 'SET status = $1, provider_reference'),
    ).toBeUndefined();
    expect(countCalls(pg.query, 'INSERT INTO partner_ledger_entries')).toBe(0);
    const audit = findCall(pg.query, 'INSERT INTO payment_events');
    // audit INSERT params: [id, event_type, event_key, payload, hash, ts]
    expect(String(audit?.[1]?.[2])).toBe(`uzum_checkout:${ORDER_ID}:FAILED`);
    expect(String(audit?.[1]?.[1])).toBe('callback:failed');
  });

  it('UNKNOWN state (spec yo‘q) — hech narsa PAID bo‘lmaydi', async () => {
    pg.query.mockResolvedValueOnce([checkoutPayment]).mockResolvedValueOnce([]); // audit insert
    const res = await service.uzumCheckoutCallback(
      normalized({ state: 'UNKNOWN' }),
    );
    expect(res.applied).toBe(false);
    expect(
      findCall(pg.query, 'SET status = $1, provider_reference'),
    ).toBeUndefined();
  });
});

describe('normalizeCheckoutCallback (raw -> internal, best-effort, fail-closed state)', () => {
  it('noma‘lum xom state => UNKNOWN (STATE_MAP bo‘sh — Uzum spec yo‘q)', () => {
    for (const s of [
      'COMPLETED',
      'SUCCESS',
      'PAID',
      'DECLINED',
      'random',
      '',
    ]) {
      expect(normalizeCheckoutCallback({ state: s }).state).toBe('UNKNOWN');
    }
  });

  it('keng tarqalgan maydon nomlarini best-effort o‘qiydi', () => {
    const n = normalizeCheckoutCallback({
      orderId: 'A1',
      orderNumber: 'UZB-1',
      merchantOperationId: 'P1',
      amount: '150000',
      currency: 'uzs',
    });
    expect(n).toMatchObject({
      orderId: 'A1',
      orderNumber: 'UZB-1',
      merchantOperationId: 'P1',
      amountSom: 150000,
      currency: 'UZS',
      state: 'UNKNOWN',
    });
  });

  it('snake_case aliaslar', () => {
    const n = normalizeCheckoutCallback({
      order_id: 'A2',
      order_number: 'UZB-2',
      merchant_operation_id: 'P2',
      total: 300000,
    });
    expect(n).toMatchObject({
      orderId: 'A2',
      orderNumber: 'UZB-2',
      merchantOperationId: 'P2',
      amountSom: 300000,
    });
  });

  it('amount yo‘q => NaN (assertPaymentMatchesPayload tekshiruvi o‘tkazib yuboriladi)', () => {
    expect(Number.isNaN(normalizeCheckoutCallback({}).amountSom)).toBe(true);
  });
});

/**
 * Register-flow (`createPayment({ provider: 'uzum_checkout' })` ->
 * `createUzumCheckoutPayment`) — INTERNAL seam. `UzumCheckoutProvider.
 * register()` 2026-09-11dan buyon RASMIY tasdiqlangan wire-format bilan
 * HAQIQIY so'rov yuboradi (to'liq env sozlangan bo'lsa) — shu sabab bu
 * blokda ENDI ham fail-closed (env yetarli emas) HAM muvaffaqiyatli
 * (fetch mock qilingan, hech qanday haqiqiy tarmoq so'rovi yo'q) yo'llar
 * bor.
 */
describe('PaymentsService.createUzumCheckoutPayment (register seam)', () => {
  const admin: RequestActor = {
    id: 'admin-1',
    actorType: 'admin',
    role: Role.SUPER_ADMIN,
    roles: [Role.SUPER_ADMIN],
  };
  const bookingRow = {
    id: 'booking-1',
    booking_number: 'UZB-QATEST01',
    user_id: 'user-1',
    partner_organization_id: 'partner-1',
    total_amount: '150000',
    currency: 'UZS',
    status: 'pending',
  };

  const makeService = (cfg: Record<string, string | undefined>) => {
    const pg = { query: jest.fn(), transaction: jest.fn() };
    const service = new PaymentsService(
      pg as unknown as PostgresService,
      { get: jest.fn() } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      new UzumProvider({ get: jest.fn() } as never),
      new UzumCheckoutProvider({ get: (k: string) => cfg[k] } as never),
    );
    return { pg, service };
  };

  it('konfiguratsiya yo‘q => 503 PAYMENT_PROVIDER_NOT_CONFIGURED, INSERT yo‘q', async () => {
    const { pg, service } = makeService({});
    pg.query
      .mockResolvedValueOnce([bookingRow]) // assertBookingVisible
      .mockResolvedValueOnce([]) // createPayment: no open payment
      .mockResolvedValueOnce([]); // createUzumCheckoutPayment: no open payment

    await expect(
      service.createPayment(admin, 'booking-1', { provider: 'uzum_checkout' }),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' },
    });

    const insertCall = (pg.query.mock.calls as Array<[string]>).find(([sql]) =>
      String(sql).includes('INSERT INTO payments'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('mavjud ochiq to‘lov bo‘lsa — o‘shani qaytaradi, register chaqirilmaydi', async () => {
    const { pg, service } = makeService({});
    const open = { ...checkoutPayment, status: 'processing' };
    pg.query
      .mockResolvedValueOnce([bookingRow]) // assertBookingVisible
      // `createPayment()`ning yagona, markazlashtirilgan existing-row
      // tekshiruvi (endi `createUzumCheckoutPayment()`da ALOHIDA
      // takrorlanmaydi) — so'ralgan provider ('uzum_checkout') mavjud
      // qatorning provider'i ('uzum_checkout', card_scheme yo'q) bilan
      // MOS kelgani uchun shu yerning o'zida qaytariladi.
      .mockResolvedValueOnce([open]);

    const res = await service.createPayment(admin, 'booking-1', {
      provider: 'uzum_checkout',
    });
    expect(res).toEqual(open);
    const insertCall = (pg.query.mock.calls as Array<[string]>).find(([sql]) =>
      String(sql).includes('INSERT INTO payments'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('to‘liq sozlangan (auth+fiskal) + Uzum muvaffaqiyatli javob (fetch mock) => payments qatori orderId/paymentUrl bilan yoziladi', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          errorCode: 0,
          result: {
            orderId: 'order-real-1',
            paymentRedirectUrl:
              'https://checkout.ipt-merch.com/?orderId=order-real-1',
          },
        }),
    } as Response);

    const { pg, service } = makeService({
      UZUM_CHECKOUT_BASE_URL: 'https://checkout.example',
      UZUM_CHECKOUT_TERMINAL_ID: 'terminal-test',
      UZUM_CHECKOUT_API_KEY: 'api-key-test',
      UZUM_CHECKOUT_SPIC: '10703999001000000',
      UZUM_CHECKOUT_PACKAGE_CODE: '1495084',
      UZUM_CHECKOUT_VAT_PERCENT: '12',
      UZUM_CHECKOUT_RECEIPT_PINFL: '11111111111111',
    });
    pg.query
      .mockResolvedValueOnce([bookingRow]) // assertBookingVisible
      .mockResolvedValueOnce([]) // createPayment: no open payment
      .mockResolvedValueOnce([]) // createUzumCheckoutPayment: no open payment
      .mockResolvedValueOnce([]); // INSERT INTO payments

    const res = await service.createPayment(admin, 'booking-1', {
      provider: 'uzum_checkout',
    });
    expect(res).toMatchObject({
      provider: 'uzum_checkout',
      status: 'processing',
      payment_url: 'https://checkout.ipt-merch.com/?orderId=order-real-1',
      amount: 150_000,
      currency: 'UZS',
    });

    const insertCall = (
      pg.query.mock.calls as Array<[string, readonly unknown[]]>
    ).find(([sql]) => String(sql).includes('INSERT INTO payments'));
    expect(insertCall).toBeDefined();
    const [, params] = insertCall!;
    expect(params).toContain('order-real-1'); // provider_reference
    expect(params).toContain(
      'https://checkout.ipt-merch.com/?orderId=order-real-1',
    ); // payment_url
    expect(params).toContain('uzum_checkout:order-real-1'); // idempotency_key

    // USER_PAYS audit (2026-09-13): Uzum'ga yuboriladigan register so'rovi
    // `amount`i HAMON faqat GROSS (150000 so'm = 15_000_000 tiyin) —
    // 1.5% Uzum user fee HECH QACHON bu yerga avtomatik qo'shilmasligi
    // kerak (item 12 — "provider register amount" hali BLOCKED/rasmiy
    // contract kutmoqda, taxmin bilan o'zgartirilmaydi).
    const fetchMock = globalThis.fetch as jest.Mock<
      Promise<Response>,
      [string, { body: string }]
    >;
    const [, fetchInit] = fetchMock.mock.calls[0];
    const registerBody = JSON.parse(fetchInit.body) as {
      amount: number;
      merchantParams: { cart: { total: number } };
    };
    expect(registerBody.amount).toBe(15_000_000); // gross tiyin, EMAS 15_225_000 (gross+1.5%)
    expect(registerBody.merchantParams.cart.total).toBe(15_000_000);
  });
});

describe('PaymentsService.reconcileUzumCheckoutPayments (fail-closed)', () => {
  it('checkout sozlanmagan => no-op ({scanned:0,updated:0}), DB so‘rovsiz', async () => {
    const pg = { query: jest.fn(), transaction: jest.fn() };
    const service = new PaymentsService(
      pg as unknown as PostgresService,
      { get: jest.fn() } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      new UzumProvider({ get: jest.fn() } as never),
      new UzumCheckoutProvider({ get: () => undefined } as never),
    );

    const res = await service.reconcileUzumCheckoutPayments();
    expect(res).toEqual({ scanned: 0, updated: 0 });
    expect(pg.query).not.toHaveBeenCalled();
  });
});

/**
 * FULL end-to-end: REAL (uchinchi-tomon manba orqali topilgan) Uzum
 * Checkout callback shakli -> `normalizeCheckoutCallback()` -> haqiqiy
 * `PaymentsService.uzumCheckoutCallback()`. Yuqoridagi testlardan farqi:
 * bu yerda `normalized()` qo'lda qurilmaydi — chinakam parser ishlatiladi.
 */
describe('PaymentsService.uzumCheckoutCallback — REAL Uzum Checkout fixture orqali E2E', () => {
  const REAL_ORDER_ID = String(REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE.orderId);
  const REAL_ORDER_NUMBER = String(
    REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE.orderNumber,
  );

  const realBooking = {
    ...openBooking,
    id: 'booking-real-1',
    booking_number: REAL_ORDER_NUMBER,
  };
  const realPayment = {
    ...checkoutPayment,
    id: 'payment-real-1',
    booking_id: 'booking-real-1',
    provider_reference: REAL_ORDER_ID,
    idempotency_key: `uzum_checkout:${REAL_ORDER_ID}`,
  };

  let pg: { query: jest.Mock; transaction: jest.Mock };
  let service: PaymentsService;

  beforeEach(() => {
    pg = { query: jest.fn(), transaction: jest.fn() };
    pg.transaction.mockImplementation(
      (op: (tx: PostgresTransaction) => unknown) => op({ query: pg.query }),
    );
    service = new PaymentsService(
      pg as unknown as PostgresService,
      { get: jest.fn() } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      new UzumProvider({ get: jest.fn() } as never),
      new UzumCheckoutProvider({
        get: (k: string) => GET_ORDER_STATUS_AUTH_CONFIG[k],
      } as never),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('REAL SUCCESS (AUTHORIZE:SUCCESS) fixture -> parser PAID deb aniqlaydi -> to‘lov/booking tasdiqlanadi', async () => {
    mockGetOrderStatusOnce({
      status: 'COMPLETED',
      completedAmountTiyin: 15_000_000,
    });
    pg.query
      .mockResolvedValueOnce([realPayment]) // locate checkout payment
      .mockResolvedValueOnce([{ id: 'evt-real-1', payment_id: null }]) // claim event
      .mockResolvedValueOnce([realBooking]) // booking FOR UPDATE
      .mockResolvedValueOnce([realPayment]) // payment FOR UPDATE
      .mockResolvedValueOnce([]) // UPDATE payments -> paid
      .mockResolvedValueOnce([]) // UPDATE payment_events
      .mockResolvedValueOnce([]) // UPDATE bookings -> confirmed
      .mockResolvedValueOnce([]) // INSERT booking_status_history
      .mockResolvedValueOnce([]); // INSERT partner_ledger_entries

    const normalized = normalizeCheckoutCallback(
      REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE,
    );
    expect(normalized.state).toBe('PAID'); // sanity: haqiqatan real parser orqali

    const res = await service.uzumCheckoutCallback(normalized);
    expect(res).toEqual({ received: true, duplicate: false, applied: true });

    const paidUpd = findCall(pg.query, 'SET status = $1, provider_reference');
    expect(paidUpd?.[1]?.[0]).toBe('paid');
    // Audit uchun to'liq xom Uzum payload ham saqlanadi (nafaqat ichki summary).
    const claim = findCall(pg.query, 'INSERT INTO payment_events');
    const payload = JSON.parse(String(claim?.[1]?.[4])) as {
      uzum_raw?: unknown;
    };
    expect(payload.uzum_raw).toEqual(REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE);
  });

  it('REAL FAIL (AUTHORIZE:FAIL) fixture -> parser FAILED deb aniqlaydi -> hech narsa PAID bo‘lmaydi, faqat audit', async () => {
    pg.query
      .mockResolvedValueOnce([realPayment]) // locate payment (orderId farq qiladi, lekin shu test uchun bir xil payment ishlatamiz)
      .mockResolvedValueOnce([]); // audit INSERT

    const normalized = normalizeCheckoutCallback(
      REAL_UZUM_CHECKOUT_FAIL_FIXTURE,
    );
    expect(normalized.state).toBe('FAILED');

    const res = await service.uzumCheckoutCallback(normalized);
    expect(res).toEqual({ received: true, duplicate: false, applied: false });
    expect(
      findCall(pg.query, 'SET status = $1, provider_reference'),
    ).toBeUndefined();
  });

  it('REAL REFUND (REFUND:SUCCESS) fixture -> parser UNKNOWN deb aniqlaydi (ATAYLAB) -> hech narsa PAID bo‘lmaydi', async () => {
    pg.query
      .mockResolvedValueOnce([realPayment]) // locate payment
      .mockResolvedValueOnce([]); // audit INSERT (non-PAID branch)

    const normalized = normalizeCheckoutCallback(
      REAL_UZUM_CHECKOUT_REFUND_FIXTURE,
    );
    expect(normalized.state).toBe('UNKNOWN');

    const res = await service.uzumCheckoutCallback(normalized);
    expect(res).toEqual({ received: true, duplicate: false, applied: false });
    expect(
      findCall(pg.query, 'SET status = $1, provider_reference'),
    ).toBeUndefined();
  });

  it('REAL SUCCESS fixture ikkinchi marta (duplicate) -> applied:false, duplicate:true, ledger ikkinchi marta kredit qilinmaydi', async () => {
    mockGetOrderStatusOnce({
      status: 'COMPLETED',
      completedAmountTiyin: 15_000_000,
    });
    pg.query
      .mockResolvedValueOnce([realPayment]) // locate payment
      .mockResolvedValueOnce([]) // claim -> ON CONFLICT DO NOTHING (0 rows, already claimed)
      .mockResolvedValueOnce([
        { id: 'evt-real-1', payment_id: 'payment-real-1' },
      ]) // existing event
      .mockResolvedValueOnce([{ ...realPayment, status: 'paid' }]); // existing payment already paid

    const normalized = normalizeCheckoutCallback(
      REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE,
    );
    const res = await service.uzumCheckoutCallback(normalized);
    expect(res).toEqual({ received: true, duplicate: true, applied: false });
    expect(countCalls(pg.query, 'INSERT INTO partner_ledger_entries')).toBe(0);
  });
});
