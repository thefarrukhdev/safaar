/**
 * Uzum Merchant API — REAL PostgreSQL integration E2E.
 *
 * Unlike the mock-`pg` unit suites (`src/payments/*.uzum.spec.ts`), this drives
 * the real `PaymentsService.uzum*` methods against a real Postgres instance:
 * real transactions, `FOR UPDATE`, `ON CONFLICT` idempotency, enum writes
 * (`provider='uzum'`, `status='reversed'`), `Decimal` so'm↔tiyin round-trip,
 * ledger + booking state transitions.
 *
 * It is SKIPPED unless `UZUM_E2E_DB_URL` points at a disposable local Postgres,
 * so CI (which runs with `DATABASE_URL=''`) is unaffected. Run manually by
 * pointing `UZUM_E2E_DB_URL` at a throwaway local cluster
 * (host 127.0.0.1, a non-default port such as 55432, database safaar_uzum_test,
 * throwaway user/password), then:
 *
 *   pnpm jest --config test/jest-e2e.json test/uzum-webhook-db.e2e-spec.ts --runInBand
 */
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PostgresService } from '../src/infrastructure/postgres.service';
import { PaymentsService } from '../src/payments/payments.service';
import { UzumProvider } from '../src/payments/providers/uzum.provider';

const DB_URL = process.env.UZUM_E2E_DB_URL;
const d = DB_URL ? describe : describe.skip;

const UZUM_CFG: Record<string, string> = {
  UZUM_SERVICE_ID: '123123',
  UZUM_USERNAME: 'test-user',
  UZUM_PASSWORD: 'test-password',
};

function fakeConfig(map: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => map[k] } as unknown as ConfigService;
}

d('Uzum Merchant API — real Postgres E2E', () => {
  let pg: PostgresService;
  let service: PaymentsService;

  const BOOKING_NUMBER = 'UZUM-E2E-001';
  const ids = {
    region: randomUUID(),
    city: randomUUID(),
    org: randomUUID(),
    booking: randomUUID(),
  };
  const transId = randomUUID();

  const q = <T = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    pg.query<T & Record<string, unknown>>(sql, p);

  beforeAll(async () => {
    pg = new PostgresService(
      fakeConfig({ DATABASE_URL: DB_URL, DB_POOL_MAX: '4' }),
    );
    const uzum = new UzumProvider(fakeConfig(UZUM_CFG));
    service = new PaymentsService(
      pg,
      fakeConfig({}),
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      uzum,
      { isConfigured: () => false } as never,
    );

    // Clean any prior run, then seed the FK chain: region → city → org → booking.
    await q(
      `DELETE FROM payment_events WHERE event_key LIKE 'uzum:%' AND payload::text LIKE '%${BOOKING_NUMBER}%'`,
    );
    await q(
      `DELETE FROM partner_ledger_entries WHERE booking_id IN (SELECT id FROM bookings WHERE booking_number = $1)`,
      [BOOKING_NUMBER],
    );
    await q(
      `DELETE FROM refunds WHERE booking_id IN (SELECT id FROM bookings WHERE booking_number = $1)`,
      [BOOKING_NUMBER],
    );
    await q(
      `DELETE FROM booking_status_history WHERE booking_id IN (SELECT id FROM bookings WHERE booking_number = $1)`,
      [BOOKING_NUMBER],
    );
    await q(
      `DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE booking_number = $1)`,
      [BOOKING_NUMBER],
    );
    await q(`DELETE FROM bookings WHERE booking_number = $1`, [BOOKING_NUMBER]);

    await q(
      `INSERT INTO regions (id, name, updated_at) VALUES ($1, '{"en":"E2E Region"}'::jsonb, now())
       ON CONFLICT (id) DO NOTHING`,
      [ids.region],
    );
    await q(
      `INSERT INTO cities (id, region_id, name, updated_at)
       VALUES ($1, $2, '{"en":"E2E City"}'::jsonb, now()) ON CONFLICT (id) DO NOTHING`,
      [ids.city, ids.region],
    );
    await q(
      `INSERT INTO partner_organizations
         (id, type, legal_name, brand_name, phone, email, city_id, updated_at)
       VALUES ($1, 'hotel', 'E2E LLC', 'E2E', '998900000000', 'e2e@example.test', $2, now())
       ON CONFLICT (id) DO NOTHING`,
      [ids.org, ids.city],
    );
    await q(
      `INSERT INTO bookings
         (id, booking_number, user_id, partner_organization_id, type, confirmation_mode,
          payment_method, status, currency, subtotal, discount_amount, bonus_amount,
          service_fee, total_amount, commission_amount, partner_payable,
          expires_at, policy_snapshot, price_snapshot, guest_name, guest_phone, updated_at)
       VALUES
         ($1, $2, NULL, $3, 'hotel', 'instant_confirmation',
          'uzum', 'pending', 'UZS', 100000, 0, 0,
          0, 100000.00, 10000.00, 90000.00,
          now() + interval '15 minutes', '{}'::jsonb, '{}'::jsonb, 'E2E Guest', '998900000000', now())`,
      [ids.booking, BOOKING_NUMBER, ids.org],
    );
  });

  afterAll(async () => {
    if (!DB_URL) return;
    await q(`DELETE FROM partner_ledger_entries WHERE booking_id = $1`, [
      ids.booking,
    ]);
    await q(`DELETE FROM refunds WHERE booking_id = $1`, [ids.booking]);
    await q(`DELETE FROM booking_status_history WHERE booking_id = $1`, [
      ids.booking,
    ]);
    await q(
      `DELETE FROM payment_events WHERE payment_id IN (SELECT id FROM payments WHERE booking_id = $1)`,
      [ids.booking],
    );
    await q(`DELETE FROM payments WHERE booking_id = $1`, [ids.booking]);
    await q(`DELETE FROM bookings WHERE id = $1`, [ids.booking]);
    await q(`DELETE FROM partner_organizations WHERE id = $1`, [ids.org]);
    await q(`DELETE FROM cities WHERE id = $1`, [ids.city]);
    await q(`DELETE FROM regions WHERE id = $1`, [ids.region]);
    await pg.onModuleDestroy();
  });

  const body = (over: Record<string, unknown> = {}) => ({
    serviceId: 123123,
    timestamp: Date.now(),
    params: { account: BOOKING_NUMBER },
    ...over,
  });

  const paymentsCount = async () =>
    Number(
      (
        await q<{ n: string }>(
          `SELECT count(*) n FROM payments WHERE booking_id = $1`,
          [ids.booking],
        )
      )[0].n,
    );
  const ledgerRows = async () =>
    q<{ type: string; amount: string }>(
      `SELECT type, amount FROM partner_ledger_entries WHERE booking_id = $1 ORDER BY created_at`,
      [ids.booking],
    );
  const eventRows = async () =>
    q<{ event_key: string }>(
      `SELECT event_key FROM payment_events WHERE event_key LIKE $1 ORDER BY event_key`,
      [`uzum:%${transId}`],
    );

  it('/check — status OK, data {}, no DB write', async () => {
    const before = await paymentsCount();
    const res = (await service.uzumCheck(body())) as Record<string, unknown>;
    expect(res).toMatchObject({ serviceId: 123123, status: 'OK' });
    expect(res.data).toEqual({});
    expect(await paymentsCount()).toBe(before);
  });

  it('/check — Uzum Postman shape: params.order_id resolves the same booking', async () => {
    const res = (await service.uzumCheck({
      serviceId: 123123,
      timestamp: Date.now(),
      params: { order_id: BOOKING_NUMBER },
    })) as Record<string, unknown>;
    expect(res).toMatchObject({ serviceId: 123123, status: 'OK' });
    expect(res.data).toEqual({});
  });

  it('/create — CREATED; payment row (uzum/processing/refs) + create event + expires_at ≈ now+35m', async () => {
    const res = (await service.uzumCreate(
      body({ transId, amount: 10_000_000 }),
    )) as Record<string, unknown>;
    expect(res).toMatchObject({
      transId,
      status: 'CREATED',
      amount: 10_000_000,
    });

    const [p] = await q<{
      provider: string;
      status: string;
      amount: string;
      provider_reference: string;
      idempotency_key: string;
    }>(
      `SELECT provider, status, amount, provider_reference, idempotency_key FROM payments WHERE booking_id = $1`,
      [ids.booking],
    );
    expect(p.provider).toBe('uzum');
    expect(p.status).toBe('processing');
    expect(Number(p.amount)).toBe(100000);
    expect(p.provider_reference).toBe(transId);
    expect(p.idempotency_key).toBe(`uzum:${transId}`);

    expect((await eventRows()).map((r) => r.event_key)).toContain(
      `uzum:create:${transId}`,
    );

    const [b] = await q<{ ms: string }>(
      `SELECT extract(epoch from (expires_at - now())) * 1000 ms FROM bookings WHERE id = $1`,
      [ids.booking],
    );
    expect(Number(b.ms)).toBeGreaterThan(34 * 60_000);
    expect(Number(b.ms)).toBeLessThan(36 * 60_000);
  });

  it('duplicate /create — 10010, no second payment / event', async () => {
    await expect(
      service.uzumCreate(body({ transId, amount: 10_000_000 })),
    ).rejects.toMatchObject({
      errorCode: '10010',
    });
    expect(await paymentsCount()).toBe(1);
    expect(
      (await eventRows()).filter(
        (r) => r.event_key === `uzum:create:${transId}`,
      ),
    ).toHaveLength(1);
  });

  it('/status after create — CREATED, no DB write', async () => {
    const before = await paymentsCount();
    const res = (await service.uzumStatus({
      serviceId: 123123,
      transId,
    })) as Record<string, unknown>;
    expect(res).toMatchObject({ transId, status: 'CREATED' });
    expect(await paymentsCount()).toBe(before);
  });

  it('/confirm — CONFIRMED; payment paid, booking confirmed, expires_at NULL, ledger +90000 once', async () => {
    const res = (await service.uzumConfirm({
      serviceId: 123123,
      transId,
      paymentSource: 'LOCAL_TEST',
      phone: '998900000000',
    })) as Record<string, unknown>;
    expect(res).toMatchObject({
      transId,
      status: 'CONFIRMED',
      amount: 10_000_000,
    });

    const [p] = await q<{ status: string }>(
      `SELECT status FROM payments WHERE booking_id = $1`,
      [ids.booking],
    );
    expect(p.status).toBe('paid');
    const [b] = await q<{ status: string; expires_at: string | null }>(
      `SELECT status, expires_at FROM bookings WHERE id = $1`,
      [ids.booking],
    );
    expect(b.status).toBe('confirmed');
    expect(b.expires_at).toBeNull();

    const ledger = await ledgerRows();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe('booking_earned');
    expect(Number(ledger[0].amount)).toBe(90000);

    expect((await eventRows()).map((r) => r.event_key)).toContain(
      `uzum:confirm:${transId}`,
    );
  });

  it('duplicate /confirm — 10016, ledger still exactly one credit', async () => {
    await expect(
      service.uzumConfirm({
        serviceId: 123123,
        transId,
        paymentSource: 'LOCAL_TEST',
        phone: '998900000000',
      }),
    ).rejects.toMatchObject({ errorCode: '10016' });
    expect(await ledgerRows()).toHaveLength(1);
  });

  it('/status after confirm — CONFIRMED', async () => {
    const res = (await service.uzumStatus({
      serviceId: 123123,
      transId,
    })) as Record<string, unknown>;
    expect(res).toMatchObject({ transId, status: 'CONFIRMED' });
  });

  it('/reverse — REVERSED; payment reversed, booking cancelled, ledger -90000 once, NO refund row', async () => {
    const res = (await service.uzumReverse({
      serviceId: 123123,
      transId,
    })) as Record<string, unknown>;
    expect(res).toMatchObject({
      transId,
      status: 'REVERSED',
      amount: 10_000_000,
    });

    const [p] = await q<{ status: string }>(
      `SELECT status FROM payments WHERE booking_id = $1`,
      [ids.booking],
    );
    expect(p.status).toBe('reversed');
    const [b] = await q<{ status: string }>(
      `SELECT status FROM bookings WHERE id = $1`,
      [ids.booking],
    );
    expect(b.status).toBe('cancelled');

    const ledger = await ledgerRows();
    expect(ledger).toHaveLength(2);
    expect(ledger[1].type).toBe('booking_reversed');
    expect(Number(ledger[1].amount)).toBe(-90000);

    const [{ n }] = await q<{ n: string }>(
      `SELECT count(*) n FROM refunds WHERE booking_id = $1`,
      [ids.booking],
    );
    expect(Number(n)).toBe(0);

    expect((await eventRows()).map((r) => r.event_key)).toContain(
      `uzum:reverse:${transId}`,
    );
  });

  it('duplicate /reverse — 10018, no second compensation', async () => {
    await expect(
      service.uzumReverse({ serviceId: 123123, transId }),
    ).rejects.toMatchObject({ errorCode: '10018' });
    expect(await ledgerRows()).toHaveLength(2);
  });

  it('/status after reverse — REVERSED', async () => {
    const res = (await service.uzumStatus({
      serviceId: 123123,
      transId,
    })) as Record<string, unknown>;
    expect(res).toMatchObject({ transId, status: 'REVERSED' });
  });

  it('negatives — 10006 / 10005 / 10007 / 10014', async () => {
    await expect(
      service.uzumCheck(body({ serviceId: 999999 })),
    ).rejects.toMatchObject({ errorCode: '10006' });
    await expect(service.uzumCheck(body({ params: {} }))).rejects.toMatchObject(
      { errorCode: '10005' },
    );
    await expect(
      service.uzumCheck(body({ params: { account: 'UZUM-E2E-NOT-FOUND' } })),
    ).rejects.toMatchObject({ errorCode: '10007' });
    await expect(
      service.uzumStatus({ serviceId: 123123, transId: randomUUID() }),
    ).rejects.toMatchObject({ errorCode: '10014' });
  });
});
