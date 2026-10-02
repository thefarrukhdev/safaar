import {
  PostgresService,
  type PostgresTransaction,
} from '../infrastructure/postgres.service';
import { PaymentsService } from './payments.service';
import { UzumProvider } from './providers/uzum.provider';

const UZUM_CFG: Record<string, string> = {
  UZUM_SERVICE_ID: '101202',
  UZUM_USERNAME: 'safaar-test',
  UZUM_PASSWORD: 's3cr3t',
};

const TRANS_ID = '5c398d7e-76b6-11ee-96da-f3a095c6289d';

type QueryCall = [sql: string, params?: readonly unknown[]];
const callsOf = (m: jest.Mock): QueryCall[] => m.mock.calls as QueryCall[];
const findCall = (m: jest.Mock, needle: string): QueryCall | undefined =>
  callsOf(m).find(([sql]) => String(sql).includes(needle));

describe('PaymentsService — Uzum Merchant API', () => {
  let pg: { query: jest.Mock; transaction: jest.Mock };
  let service: PaymentsService;

  const openBooking = {
    id: 'booking-1',
    booking_number: 'SAF-000123',
    status: 'pending',
    user_id: 'user-1',
    partner_organization_id: 'partner-1',
    confirmation_mode: 'instant_confirmation',
    total_amount: '25000',
    partner_payable: '22000',
    currency: 'UZS',
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  };

  const uzumPayment = {
    id: 'payment-1',
    booking_id: 'booking-1',
    amount: '25000',
    currency: 'UZS',
    status: 'processing',
    provider: 'uzum',
    provider_reference: TRANS_ID,
    idempotency_key: `uzum:${TRANS_ID}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

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
      new UzumProvider({ get: (k: string) => UZUM_CFG[k] } as never),
      { isConfigured: () => false } as never,
    );
  });

  // --------------------------------------------------------------------------
  //  /check
  // --------------------------------------------------------------------------
  describe('uzumCheck', () => {
    const body = (over: Record<string, unknown> = {}) => ({
      serviceId: 101202,
      timestamp: Date.now(),
      params: { account: 'SAF-000123' },
      ...over,
    });

    it('valid, ochiq bron — status OK + data: {} (contract namunasi)', async () => {
      pg.query
        .mockResolvedValueOnce([openBooking]) // find by booking_number
        .mockResolvedValueOnce([]); // no paid payment
      const res = (await service.uzumCheck(body())) as Record<string, unknown>;
      expect(res).toMatchObject({ serviceId: 101202, status: 'OK' });
      // Rasmiy `/check` 200 namunasi `data: {}` — taxminiy field qo'shmaymiz.
      expect(res.data).toEqual({});
      // hech qanday write bo'lmasligi kerak
      expect(pg.transaction).not.toHaveBeenCalled();
      expect(
        callsOf(pg.query).some(([s]) => /INSERT|UPDATE/i.test(String(s))),
      ).toBe(false);
    });

    it('nomos serviceId — 10006', async () => {
      await expect(
        service.uzumCheck(body({ serviceId: 999 })),
      ).rejects.toMatchObject({ errorCode: '10006' });
    });

    it('params.account/order_id yo‘q — 10005', async () => {
      await expect(
        service.uzumCheck(body({ params: {} })),
      ).rejects.toMatchObject({ errorCode: '10005' });
    });

    it('Uzum Postman shakli — params.order_id ham qabul qilinadi', async () => {
      pg.query
        .mockResolvedValueOnce([openBooking]) // find by booking_number
        .mockResolvedValueOnce([]); // no paid payment
      const res = (await service.uzumCheck(
        body({ params: { order_id: 'SAF-000123' } }),
      )) as Record<string, unknown>;
      expect(res).toMatchObject({ serviceId: 101202, status: 'OK' });
      const find = findCall(pg.query, 'FROM bookings WHERE booking_number');
      expect(find?.[1]).toEqual(['SAF-000123']);
    });

    it('bron topilmadi — 10007', async () => {
      pg.query.mockResolvedValueOnce([]);
      await expect(service.uzumCheck(body())).rejects.toMatchObject({
        errorCode: '10007',
      });
    });

    it('bron allaqachon to‘langan (paid payment mavjud) — 10008', async () => {
      pg.query
        .mockResolvedValueOnce([openBooking])
        .mockResolvedValueOnce([{ id: 'p-x' }]);
      await expect(service.uzumCheck(body())).rejects.toMatchObject({
        errorCode: '10008',
      });
    });

    it('bron confirmed — 10008', async () => {
      pg.query
        .mockResolvedValueOnce([{ ...openBooking, status: 'confirmed' }])
        .mockResolvedValueOnce([]);
      await expect(service.uzumCheck(body())).rejects.toMatchObject({
        errorCode: '10008',
      });
    });

    it('bron muddati o‘tgan — 10009', async () => {
      pg.query
        .mockResolvedValueOnce([
          {
            ...openBooking,
            expires_at: new Date(Date.now() - 60_000).toISOString(),
          },
        ])
        .mockResolvedValueOnce([]);
      await expect(service.uzumCheck(body())).rejects.toMatchObject({
        errorCode: '10009',
      });
    });
  });

  // --------------------------------------------------------------------------
  //  /create
  // --------------------------------------------------------------------------
  describe('uzumCreate', () => {
    const body = (over: Record<string, unknown> = {}) => ({
      serviceId: 101202,
      timestamp: Date.now(),
      transId: TRANS_ID,
      params: { account: 'SAF-000123' },
      amount: 2_500_000,
      ...over,
    });

    it('valid — payment(processing) yaratiladi, provider_reference=transId, expiry now+35min', async () => {
      pg.query
        .mockResolvedValueOnce([]) // dup check
        .mockResolvedValueOnce([{ id: 'evt-1' }]) // claim event_key
        .mockResolvedValueOnce([openBooking]) // booking FOR UPDATE
        .mockResolvedValueOnce([]) // no paid payment
        .mockResolvedValueOnce([]) // no open payment -> INSERT path
        .mockResolvedValueOnce([]) // INSERT payments
        .mockResolvedValueOnce([]) // UPDATE payment_events
        .mockResolvedValueOnce([]); // UPDATE bookings expires_at

      const res = (await service.uzumCreate(body())) as Record<string, unknown>;
      expect(res).toMatchObject({
        serviceId: 101202,
        transId: TRANS_ID,
        status: 'CREATED',
        amount: 2_500_000,
      });

      const insert = findCall(pg.query, 'INSERT INTO payments');
      expect(insert?.[1]).toEqual(
        expect.arrayContaining([TRANS_ID, `uzum:${TRANS_ID}`, 'booking-1']),
      );

      const expiryUpd = findCall(pg.query, 'SET expires_at = $1');
      const newExpiry = Date.parse(String(expiryUpd?.[1]?.[0]));
      const delta = newExpiry - Date.now();
      expect(delta).toBeGreaterThan(34 * 60_000);
      expect(delta).toBeLessThan(36 * 60_000);
    });

    it('duplicate transId (payment mavjud) — 10010, ikkinchi payment yaratilmaydi', async () => {
      pg.query.mockResolvedValueOnce([{ id: 'payment-1' }]); // dup check hits
      await expect(service.uzumCreate(body())).rejects.toMatchObject({
        errorCode: '10010',
      });
      expect(findCall(pg.query, 'INSERT INTO payments')).toBeUndefined();
    });

    it('event_key race yutqazildi — 10010', async () => {
      pg.query
        .mockResolvedValueOnce([]) // dup check
        .mockResolvedValueOnce([]); // claim returns nothing
      await expect(service.uzumCreate(body())).rejects.toMatchObject({
        errorCode: '10010',
      });
    });

    it('summa nomos (tiyin) — 10011', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'evt-1' }])
        .mockResolvedValueOnce([openBooking])
        .mockResolvedValueOnce([]);
      await expect(
        service.uzumCreate(body({ amount: 999 })),
      ).rejects.toMatchObject({ errorCode: '10011' });
    });

    it('amount yo‘q — 10005', async () => {
      await expect(
        service.uzumCreate(body({ amount: undefined })),
      ).rejects.toMatchObject({ errorCode: '10005' });
    });

    it('bron topilmadi — 10007', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'evt-1' }])
        .mockResolvedValueOnce([]); // booking not found
      await expect(service.uzumCreate(body())).rejects.toMatchObject({
        errorCode: '10007',
      });
    });

    it('bron muddati o‘tgan — QAYTA TIRILTIRILMAYDI (10009)', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'evt-1' }])
        .mockResolvedValueOnce([
          {
            ...openBooking,
            expires_at: new Date(Date.now() - 60_000).toISOString(),
          },
        ])
        .mockResolvedValueOnce([]); // no paid
      await expect(service.uzumCreate(body())).rejects.toMatchObject({
        errorCode: '10009',
      });
      expect(findCall(pg.query, 'INSERT INTO payments')).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  //  /confirm
  // --------------------------------------------------------------------------
  describe('uzumConfirm', () => {
    const body = (over: Record<string, unknown> = {}) => ({
      serviceId: 101202,
      timestamp: Date.now(),
      transId: TRANS_ID,
      paymentSource: 'UZCARD',
      phone: '998901234567',
      cardType: 2,
      ...over,
    });

    it('valid — payment paid, booking confirmed, ledger bir marta, status CONFIRMED', async () => {
      pg.query
        .mockResolvedValueOnce([uzumPayment]) // lookup payment
        // processPaymentEvent transaction:
        .mockResolvedValueOnce([{ id: 'evt-c', payment_id: null }]) // claim
        .mockResolvedValueOnce([openBooking]) // booking FOR UPDATE
        .mockResolvedValueOnce([uzumPayment]) // payment FOR UPDATE
        .mockResolvedValueOnce([]) // UPDATE payments -> paid
        .mockResolvedValueOnce([]) // UPDATE payment_events
        .mockResolvedValueOnce([]) // UPDATE bookings -> confirmed
        .mockResolvedValueOnce([]) // INSERT booking_status_history
        .mockResolvedValueOnce([]); // INSERT partner_ledger_entries

      const res = (await service.uzumConfirm(body())) as Record<
        string,
        unknown
      >;
      expect(res).toMatchObject({
        serviceId: 101202,
        transId: TRANS_ID,
        status: 'CONFIRMED',
        amount: 2_500_000,
      });

      const paidUpd = findCall(pg.query, 'SET status = $1, provider_reference');
      expect(paidUpd?.[1]?.[0]).toBe('paid');
      expect(paidUpd?.[1]?.[1]).toBe(TRANS_ID);

      const ledger = findCall(pg.query, 'INSERT INTO partner_ledger_entries');
      expect(ledger).toBeDefined();
      expect(
        callsOf(pg.query).filter(([s]) =>
          String(s).includes('INSERT INTO partner_ledger_entries'),
        ).length,
      ).toBe(1);
    });

    it('tranzaksiya topilmadi — 10014', async () => {
      pg.query.mockResolvedValueOnce([]);
      await expect(service.uzumConfirm(body())).rejects.toMatchObject({
        errorCode: '10014',
      });
    });

    it('allaqachon tasdiqlangan (payment paid) — 10016', async () => {
      pg.query.mockResolvedValueOnce([{ ...uzumPayment, status: 'paid' }]);
      await expect(service.uzumConfirm(body())).rejects.toMatchObject({
        errorCode: '10016',
      });
    });

    it('bekor qilingan (reversed) — 10015', async () => {
      pg.query.mockResolvedValueOnce([{ ...uzumPayment, status: 'reversed' }]);
      await expect(service.uzumConfirm(body())).rejects.toMatchObject({
        errorCode: '10015',
      });
    });

    it('parallel ikkinchi confirm (event_key race) — 10016', async () => {
      pg.query
        .mockResolvedValueOnce([uzumPayment]) // lookup
        .mockResolvedValueOnce([]) // claim -> duplicate
        .mockResolvedValueOnce([{ id: 'evt-c', payment_id: 'payment-1' }]) // existing event
        .mockResolvedValueOnce([uzumPayment]); // existing payment
      await expect(service.uzumConfirm(body())).rejects.toMatchObject({
        errorCode: '10016',
      });
    });

    it('parallel /reverse confirm bilan poygada — payment "paid"ga sakramaydi, 10015', async () => {
      // Pre-check (tranzaksiyasiz) hali `processing` ko'radi; `/reverse` esa
      // `processPaymentEvent` ichidagi `FOR UPDATE`gacha bo'lgan oynada
      // to'liq commit bo'lib ulguradi.
      pg.query
        .mockResolvedValueOnce([{ ...uzumPayment, status: 'processing' }]) // lookup (stale)
        // processPaymentEvent transaction:
        .mockResolvedValueOnce([
          {
            id: 'evt-c',
            payment_id: null,
            processed_at: new Date().toISOString(),
          },
        ]) // claim OK (event_key `/reverse`nikidan farq qiladi)
        .mockResolvedValueOnce([{ ...openBooking, status: 'cancelled' }]) // booking FOR UPDATE — reverse cancel qilib bo'lgan
        .mockResolvedValueOnce([{ ...uzumPayment, status: 'reversed' }]) // payment FOR UPDATE — reverse flip qilib bo'lgan
        .mockResolvedValueOnce([]); // UPDATE payment_events SET payment_id (audit havolasi)

      await expect(service.uzumConfirm(body())).rejects.toMatchObject({
        errorCode: '10015',
      });

      // `reversed` -> `paid` "sakrash" BO'LMASLIGI kerak.
      const paidFlip = callsOf(pg.query).find(([s]) =>
        String(s).includes('SET status = $1, provider_reference'),
      );
      expect(paidFlip).toBeUndefined();
      // Soxta avto-refund YARATILMASLIGI kerak.
      expect(
        callsOf(pg.query).some(([s]) =>
          String(s).includes('INSERT INTO refunds'),
        ),
      ).toBe(false);
      // Ledger kredit ham bo'lmasligi kerak.
      expect(
        callsOf(pg.query).some(([s]) =>
          String(s).includes('INSERT INTO partner_ledger_entries'),
        ),
      ).toBe(false);
    });

    it('paymentSource yo‘q — 10005', async () => {
      await expect(
        service.uzumConfirm(body({ paymentSource: undefined })),
      ).rejects.toMatchObject({ errorCode: '10005' });
    });
  });

  // --------------------------------------------------------------------------
  //  /reverse
  // --------------------------------------------------------------------------
  describe('uzumReverse', () => {
    const body = () => ({
      serviceId: 101202,
      timestamp: Date.now(),
      transId: TRANS_ID,
    });

    it('valid (paid) — payment reversed, booking cancelled, ledger kompensatsiya', async () => {
      pg.query
        .mockResolvedValueOnce([{ ...uzumPayment, status: 'paid' }]) // payment FOR UPDATE
        .mockResolvedValueOnce([{ id: 'evt-r' }]) // claim
        .mockResolvedValueOnce([]) // UPDATE payments -> reversed
        .mockResolvedValueOnce([]) // UPDATE payment_events
        .mockResolvedValueOnce([{ ...openBooking, status: 'confirmed' }]) // booking FOR UPDATE
        .mockResolvedValueOnce([]) // UPDATE bookings -> cancelled
        .mockResolvedValueOnce([]) // INSERT booking_status_history
        .mockResolvedValueOnce([]) // INSERT partner_ledger_entries (compensation)
        .mockResolvedValueOnce([]); // UPDATE trip_seats

      const res = (await service.uzumReverse(body())) as Record<
        string,
        unknown
      >;
      expect(res).toMatchObject({
        transId: TRANS_ID,
        status: 'REVERSED',
        amount: 2_500_000,
      });

      const revUpd = findCall(pg.query, "SET status = 'reversed'");
      expect(revUpd).toBeDefined();
      const cancel = findCall(pg.query, "status = 'cancelled', cancelled_at");
      expect(cancel?.[1]).toEqual(expect.arrayContaining(['booking-1']));
      const comp = findCall(pg.query, 'INSERT INTO partner_ledger_entries');
      expect(comp?.[1]?.[3]).toBe(-22000); // -partner_payable
    });

    it('allaqachon reversed — 10018', async () => {
      pg.query.mockResolvedValueOnce([{ ...uzumPayment, status: 'reversed' }]);
      await expect(service.uzumReverse(body())).rejects.toMatchObject({
        errorCode: '10018',
      });
    });

    it('tranzaksiya topilmadi — 10014', async () => {
      pg.query.mockResolvedValueOnce([]);
      await expect(service.uzumReverse(body())).rejects.toMatchObject({
        errorCode: '10014',
      });
    });

    it('holat yo‘l qo‘ymaydi (failed) — 10017', async () => {
      pg.query.mockResolvedValueOnce([{ ...uzumPayment, status: 'failed' }]);
      await expect(service.uzumReverse(body())).rejects.toMatchObject({
        errorCode: '10017',
      });
    });

    it('parallel ikkinchi reverse (event_key race) — 10018', async () => {
      pg.query
        .mockResolvedValueOnce([{ ...uzumPayment, status: 'paid' }])
        .mockResolvedValueOnce([]); // claim -> duplicate
      await expect(service.uzumReverse(body())).rejects.toMatchObject({
        errorCode: '10018',
      });
    });
  });

  // --------------------------------------------------------------------------
  //  /status
  // --------------------------------------------------------------------------
  describe('uzumStatus', () => {
    const body = () => ({
      serviceId: 101202,
      timestamp: Date.now(),
      transId: TRANS_ID,
    });

    it.each([
      ['processing', 'CREATED'],
      ['pending', 'CREATED'],
      ['paid', 'CONFIRMED'],
      ['reversed', 'REVERSED'],
      ['refunded', 'REVERSED'],
      ['failed', 'FAILED'],
    ])('payment %s -> Uzum %s (read-only)', async (pStatus, uzStatus) => {
      pg.query.mockResolvedValueOnce([{ ...uzumPayment, status: pStatus }]);
      const res = (await service.uzumStatus(body())) as Record<string, unknown>;
      expect(res).toMatchObject({
        transId: TRANS_ID,
        status: uzStatus,
        amount: 2_500_000,
      });
      // hech qanday write bo'lmasligi kerak
      expect(pg.transaction).not.toHaveBeenCalled();
      expect(
        callsOf(pg.query).some(([s]) => /INSERT|UPDATE/i.test(String(s))),
      ).toBe(false);
    });

    it('tranzaksiya topilmadi — 10014', async () => {
      pg.query.mockResolvedValueOnce([]);
      await expect(service.uzumStatus(body())).rejects.toMatchObject({
        errorCode: '10014',
      });
    });
  });

  // --------------------------------------------------------------------------
  //  Cron: 30-min FAILED
  // --------------------------------------------------------------------------
  it('failStaleUzumTransactions — 30 daqiqadan eski processing/pending -> failed', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'p-1' }, { id: 'p-2' }]);
    await service.failStaleUzumTransactions();
    const upd = findCall(pg.query, "SET status = 'failed'");
    expect(String(upd?.[0])).toContain("provider = 'uzum'");
    expect(String(upd?.[0])).toContain("provider = 'uzum_checkout'");
    expect(String(upd?.[0])).toContain("interval '30 minutes'");
  });
});
