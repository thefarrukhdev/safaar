import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import {
  PostgresService,
  type PostgresTransaction,
} from '../infrastructure/postgres.service';
import { PaymentsService } from './payments.service';
import { hmacSha256 } from '../auth/security';

const secret = 'test-payment-webhook-secret-32-characters';

type QueryCall = [sql: string, params?: readonly unknown[]];
const queryCallsOf = (obj: { query: unknown }): QueryCall[] =>
  (obj.query as jest.Mock).mock.calls as QueryCall[];

describe('PaymentsService — authorization (regression: unauthenticated IDOR)', () => {
  let service: PaymentsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>>;

  const bookingRow = {
    id: 'booking-1',
    user_id: 'user-owner',
    partner_organization_id: 'partner-1',
    total_amount: 100000,
    currency: 'UZS',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PaymentsService(
      pg as unknown as PostgresService,
      { get: jest.fn() } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
    );
  });

  it('anonim (actor yo‘q) chaqiruv 401 bilan rad etiladi', async () => {
    pg.query.mockResolvedValueOnce([bookingRow]);

    await expect(service.payment(undefined, 'booking-1')).rejects.toMatchObject(
      { status: 401 },
    );
  });

  it('boshqa foydalanuvchi bron to‘lovini ko‘ra olmaydi (403)', async () => {
    pg.query.mockResolvedValueOnce([bookingRow]);
    const otherUser: RequestActor = {
      id: 'user-other',
      actorType: 'user',
      role: Role.USER,
      roles: [Role.USER],
    };

    await expect(service.payment(otherUser, 'booking-1')).rejects.toMatchObject(
      { status: 403 },
    );
  });

  it('bron egasi o‘z to‘lovini ko‘ra oladi', async () => {
    pg.query
      .mockResolvedValueOnce([bookingRow])
      .mockResolvedValueOnce([{ id: 'payment-1', booking_id: 'booking-1' }]);
    const owner: RequestActor = {
      id: 'user-owner',
      actorType: 'user',
      role: Role.USER,
      roles: [Role.USER],
    };

    const result = await service.payment(owner, 'booking-1');
    expect(result.id).toBe('payment-1');
  });

  it('anonim POST /payments/:id/create ham 401 bilan rad etiladi', async () => {
    pg.query.mockResolvedValueOnce([bookingRow]);

    await expect(
      service.createPayment(undefined, 'booking-1', { provider: 'cash' }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('PaymentsService.providerWebhook (regression: C-3 paid-vs-expiry race, H-4 concurrent duplicate 500)', () => {
  const originalEnv = { ...process.env };
  let pg: { query: jest.Mock; transaction: jest.Mock };
  let service: PaymentsService;

  const payment = {
    id: 'payment-1',
    booking_id: 'booking-1',
    amount: '650000',
    currency: 'UZS',
    status: 'pending',
  };

  const openBooking = {
    id: 'booking-1',
    status: 'pending',
    user_id: 'user-1',
    partner_organization_id: 'partner-1',
    confirmation_mode: 'instant_confirmation',
    partner_payable: '572000',
    currency: 'UZS',
  };

  beforeEach(() => {
    process.env.PAYMENT_WEBHOOK_SECRET = secret;
    pg = { query: jest.fn(), transaction: jest.fn() };
    pg.transaction.mockImplementation(
      (operation: (tx: PostgresTransaction) => unknown) =>
        operation({ query: pg.query }),
    );
    service = new PaymentsService(
      pg as unknown as PostgresService,
      { get: jest.fn() } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function sign(
    provider: string,
    event: string,
    body: Record<string, unknown>,
  ) {
    const eventKey = `${provider}:${event}:${String(
      body.transaction_id ?? body.id ?? body.booking_id ?? '',
    )}`;
    const canonical = `${provider}.${event}.${eventKey}.${JSON.stringify(
      Object.fromEntries(
        Object.entries(body).sort(([a], [b]) => a.localeCompare(b)),
      ),
    )}`;
    return hmacSha256(canonical, secret);
  }

  it('confirms the booking (instant_confirmation), clears the hold and credits the partner ledger once payment is paid (regression: booking never reached confirmed)', async () => {
    const body = {
      booking_id: 'booking-1',
      transaction_id: 'tx-1',
      amount: 650000,
      currency: 'UZS',
    };
    pg.query
      .mockResolvedValueOnce([{ id: 'event-1', payment_id: null }]) // INSERT ... ON CONFLICT claim
      .mockResolvedValueOnce([openBooking]) // SELECT booking FOR UPDATE
      .mockResolvedValueOnce([payment]) // SELECT payment FOR UPDATE
      .mockResolvedValueOnce([]) // UPDATE payments
      .mockResolvedValueOnce([]) // UPDATE payment_events
      .mockResolvedValueOnce([]) // UPDATE bookings SET status = confirmed ...
      .mockResolvedValueOnce([]) // INSERT booking_status_history
      .mockResolvedValueOnce([]); // INSERT partner_ledger_entries

    const result = await service.providerWebhook('click', 'complete', body, {
      'x-safaar-signature': sign('click', 'complete', body),
    });

    expect(result).toMatchObject({ booking_outcome: 'confirmed' });

    const confirmCall = queryCallsOf(pg).find(([sql]) =>
      String(sql).includes('SET status = $1, confirmed_at'),
    );
    expect(confirmCall).toBeDefined();
    expect(confirmCall?.[1]).toEqual([
      'confirmed',
      expect.any(String),
      'booking-1',
    ]);

    const ledgerCall = queryCallsOf(pg).find(([sql]) =>
      String(sql).includes('INSERT INTO partner_ledger_entries'),
    );
    expect(ledgerCall).toBeDefined();
    expect(ledgerCall?.[1]).toEqual([
      expect.any(String),
      'partner-1',
      'booking-1',
      572000,
      'UZS',
      expect.any(String),
    ]);
  });

  it('moves an awaiting_partner_confirmation booking to awaiting_partner_confirmation status, not straight to confirmed', async () => {
    const body = {
      booking_id: 'booking-1',
      transaction_id: 'tx-1b',
      amount: 650000,
      currency: 'UZS',
    };
    const requestConfirmationBooking = {
      ...openBooking,
      confirmation_mode: 'request_confirmation',
    };
    pg.query
      .mockResolvedValueOnce([{ id: 'event-1b', payment_id: null }])
      .mockResolvedValueOnce([requestConfirmationBooking])
      .mockResolvedValueOnce([payment])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.providerWebhook('click', 'complete', body, {
      'x-safaar-signature': sign('click', 'complete', body),
    });

    expect(result).toMatchObject({
      booking_outcome: 'awaiting_partner_confirmation',
    });
    const confirmCall = queryCallsOf(pg).find(([sql]) =>
      String(sql).includes('SET status = $1, confirmed_at'),
    );
    expect(confirmCall?.[1]?.[0]).toBe('awaiting_partner_confirmation');
  });

  it('regression (paid+expired impossible state): a payment arriving after the booking already expired does NOT silently confirm it — files an auto-refund instead', async () => {
    const body = {
      booking_id: 'booking-1',
      transaction_id: 'tx-1c',
      amount: 650000,
      currency: 'UZS',
    };
    const expiredBooking = { ...openBooking, status: 'expired' };
    pg.query
      .mockResolvedValueOnce([{ id: 'event-1c', payment_id: null }])
      .mockResolvedValueOnce([expiredBooking]) // SELECT booking FOR UPDATE — already expired
      .mockResolvedValueOnce([payment])
      .mockResolvedValueOnce([]) // UPDATE payments -> paid (money IS real)
      .mockResolvedValueOnce([]) // UPDATE payment_events
      .mockResolvedValueOnce([]) // INSERT booking_status_history (audit trail)
      .mockResolvedValueOnce([]); // INSERT refunds (auto-refund)

    const result = await service.providerWebhook('click', 'complete', body, {
      'x-safaar-signature': sign('click', 'complete', body),
    });

    expect(result).toMatchObject({
      booking_outcome: 'lost_race_refund_requested',
    });
    expect(result.payment?.status).toBe('paid');

    // Bron statusi hech qachon "confirmed"ga jim o'zgartirilmasligi kerak.
    const confirmCall = queryCallsOf(pg).find(([sql]) =>
      String(sql).includes('SET status = $1, confirmed_at'),
    );
    expect(confirmCall).toBeUndefined();

    const refundCall = queryCallsOf(pg).find(([sql]) =>
      String(sql).includes('INSERT INTO refunds'),
    );
    expect(refundCall).toBeDefined();
    expect(refundCall?.[1]).toEqual([
      expect.any(String),
      'booking-1',
      'user-1',
      'UZS',
      650000,
      expect.any(String),
      expect.any(String),
    ]);
  });

  it('does not touch bookings for a non-final (prepare) event', async () => {
    const body = {
      booking_id: 'booking-1',
      transaction_id: 'tx-2',
      amount: 650000,
      currency: 'UZS',
    };
    pg.query
      .mockResolvedValueOnce([{ id: 'event-2', payment_id: null }])
      .mockResolvedValueOnce([openBooking])
      .mockResolvedValueOnce([payment])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.providerWebhook('click', 'prepare', body, {
      'x-safaar-signature': sign('click', 'prepare', body),
    });

    const bookingUpdateCall = queryCallsOf(pg).find(([sql]) =>
      String(sql).startsWith('UPDATE bookings'),
    );
    expect(bookingUpdateCall).toBeUndefined();
  });

  it('a webhook that loses the event_key race returns duplicate:true instead of crashing', async () => {
    const body = {
      booking_id: 'booking-1',
      transaction_id: 'tx-3',
      amount: 650000,
      currency: 'UZS',
    };
    pg.query
      .mockResolvedValueOnce([]) // INSERT ... ON CONFLICT DO NOTHING -> lost the race
      .mockResolvedValueOnce([
        { payment_id: 'payment-1', processed_at: '2026-08-10T00:00:00.000Z' },
      ]) // SELECT existing event
      .mockResolvedValueOnce([{ ...payment, status: 'paid' }]); // SELECT payment

    const result = await service.providerWebhook('click', 'complete', body, {
      'x-safaar-signature': sign('click', 'complete', body),
    });

    expect(result).toMatchObject({ accepted: true, duplicate: true });
  });
});

describe('PaymentsService.createPayment (regression: payment_url was always null)', () => {
  let pg: { query: jest.Mock; transaction: jest.Mock };
  let click: { isConfigured: jest.Mock; buildCheckoutUrl: jest.Mock };
  let payme: { isConfigured: jest.Mock; buildCheckoutUrl: jest.Mock };
  let service: PaymentsService;
  const owner: RequestActor = {
    id: 'user-owner',
    actorType: 'user',
    role: Role.USER,
    roles: [Role.USER],
  };
  const bookingRow = {
    id: 'booking-1',
    user_id: 'user-owner',
    partner_organization_id: 'partner-1',
    total_amount: 1300000,
    currency: 'UZS',
  };

  beforeEach(() => {
    pg = { query: jest.fn(), transaction: jest.fn() };
    click = { isConfigured: jest.fn(), buildCheckoutUrl: jest.fn() };
    payme = { isConfigured: jest.fn(), buildCheckoutUrl: jest.fn() };
    service = new PaymentsService(
      pg as unknown as PostgresService,
      { get: jest.fn() } as never,
      click as never,
      payme,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
    );
  });

  it('returns a real checkout URL when Click is configured', async () => {
    click.isConfigured.mockReturnValue(true);
    click.buildCheckoutUrl.mockReturnValue(
      'https://my.click.uz/services/pay?service_id=1',
    );
    pg.query
      .mockResolvedValueOnce([bookingRow]) // assertBookingVisible
      .mockResolvedValueOnce([]) // no existing pending payment
      .mockResolvedValueOnce([]); // INSERT payments

    const result = await service.createPayment(owner, 'booking-1', {
      provider: 'click',
    });

    expect(result.payment_url).toBe(
      'https://my.click.uz/services/pay?service_id=1',
    );
    const insertCall = queryCallsOf(pg).find(([sql]) =>
      String(sql).includes('INSERT INTO payments'),
    );
    expect(insertCall?.[1]).toContain(
      'https://my.click.uz/services/pay?service_id=1',
    );
  });

  it('fails clearly instead of returning a fake/null payment_url when Click is not configured', async () => {
    click.isConfigured.mockReturnValue(false);
    pg.query.mockResolvedValueOnce([bookingRow]).mockResolvedValueOnce([]);

    await expect(
      service.createPayment(owner, 'booking-1', { provider: 'click' }),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' },
    });
  });

  it('cash payments need no checkout URL and never call a provider', async () => {
    pg.query
      .mockResolvedValueOnce([bookingRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.createPayment(owner, 'booking-1', {
      provider: 'cash',
    });

    expect(result.payment_url).toBeNull();
    expect(click.buildCheckoutUrl).not.toHaveBeenCalled();
    expect(payme.buildCheckoutUrl).not.toHaveBeenCalled();
  });

  // BUG REGRESSION (payments/refunds audit, 2026-09-29): a booking that is
  // ALREADY paid (`confirmed` / `awaiting_partner_confirmation` / `completed`
  // — the exact same "already paid" definition `assertUzumPayable()` already
  // uses for the Uzum Merchant `/check` + `/create` webhooks) must NOT be
  // able to open a brand-new payment session via `POST /payments/:id/create`.
  // Before the fix, the "existing open payment?" lookup only matched
  // `status IN ('pending','processing')` — a booking whose ONLY payment row
  // is already `'paid'` sailed straight through and got a SECOND, real,
  // independent payment session (new Click/Payme checkout URL, or a real
  // Uzum Checkout `/payment/register` call for card schemes). If the
  // customer (or an attacker replaying an old checkout link) completes that
  // second session, the webhook marks the SECOND row `'paid'` too — no
  // ledger double-credit (booking is no longer in `OPEN_BOOKING_STATUSES`),
  // but the customer is charged a SECOND real payment with no automatic
  // refund, and `booking-reports.query.ts`'s
  // `SUM(amount) FILTER (WHERE status='paid') GROUP BY booking_id` then
  // double-counts that booking's paid_amount.
  it("REJECTS creating a new payment session for a booking that's already paid (confirmed) — prevents real double-charge", async () => {
    pg.query.mockResolvedValueOnce([{ ...bookingRow, status: 'confirmed' }]); // assertBookingVisible

    await expect(
      service.createPayment(owner, 'booking-1', { provider: 'click' }),
    ).rejects.toMatchObject({
      status: 422,
      response: { code: 'BOOKING_ALREADY_PAID' },
    });

    // No new payment row may be written once rejected.
    const insertCall = queryCallsOf(pg).find(([sql]) =>
      String(sql).includes('INSERT INTO payments'),
    );
    expect(insertCall).toBeUndefined();
  });

  it.each(['awaiting_partner_confirmation', 'completed'])(
    'REJECTS creating a new payment session for booking status=%s too (same "already paid" definition as assertUzumPayable)',
    async (status) => {
      pg.query.mockResolvedValueOnce([{ ...bookingRow, status }]);

      await expect(
        service.createPayment(owner, 'booking-1', { provider: 'click' }),
      ).rejects.toMatchObject({
        status: 422,
        response: { code: 'BOOKING_ALREADY_PAID' },
      });
    },
  );
});

describe('PaymentsService.clickPrepare / clickComplete (real Click protocol)', () => {
  let pg: { query: jest.Mock; transaction: jest.Mock };
  let click: {
    isConfigured: jest.Mock;
    verifyPrepareSignature: jest.Mock;
    verifyCompleteSignature: jest.Mock;
  };
  let service: PaymentsService;

  const payment = {
    id: 'payment-1',
    booking_id: 'booking-1',
    amount: '650000',
    currency: 'UZS',
    status: 'pending',
  };
  const openBooking = {
    id: 'booking-1',
    status: 'pending',
    user_id: 'user-1',
    partner_organization_id: 'partner-1',
    confirmation_mode: 'instant_confirmation',
    partner_payable: '572000',
    currency: 'UZS',
  };

  beforeEach(() => {
    pg = { query: jest.fn(), transaction: jest.fn() };
    pg.transaction.mockImplementation(
      (operation: (tx: PostgresTransaction) => unknown) =>
        operation({ query: pg.query }),
    );
    click = {
      isConfigured: jest.fn().mockReturnValue(true),
      verifyPrepareSignature: jest.fn(),
      verifyCompleteSignature: jest.fn(),
    };
    service = new PaymentsService(
      pg as unknown as PostgresService,
      { get: jest.fn() } as never,
      click as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
    );
  });

  it('rejects an unsigned/incorrectly signed Prepare request with error -1, HTTP-200-shaped (Click never gets a raw 401)', async () => {
    click.verifyPrepareSignature.mockReturnValue(false);

    const result = await service.clickPrepare({
      click_trans_id: '111',
      service_id: '123',
      merchant_trans_id: 'booking-1',
      amount: '650000',
      action: '0',
      sign_time: 't',
      sign_string: 'wrong',
    });

    expect(result).toMatchObject({
      error: -1,
      error_note: 'SIGN CHECK FAILED!',
    });
    expect(pg.transaction).not.toHaveBeenCalled();
  });

  it('confirms a valid Prepare and echoes click_trans_id as merchant_prepare_id', async () => {
    click.verifyPrepareSignature.mockReturnValue(true);
    pg.query
      .mockResolvedValueOnce([{ id: 'event-1', payment_id: null }])
      .mockResolvedValueOnce([openBooking])
      .mockResolvedValueOnce([payment])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.clickPrepare({
      click_trans_id: '111',
      service_id: '123',
      merchant_trans_id: 'booking-1',
      amount: '650000',
      action: '0',
      sign_time: 't',
      sign_string: 'valid',
    });

    expect(result).toMatchObject({
      click_trans_id: '111',
      merchant_trans_id: 'booking-1',
      merchant_prepare_id: '111',
      error: 0,
      error_note: 'Success',
    });
  });

  it('confirms a valid Complete, transitions the booking, and credits the partner ledger', async () => {
    click.verifyCompleteSignature.mockReturnValue(true);
    pg.query
      .mockResolvedValueOnce([{ id: 'event-2', payment_id: null }])
      .mockResolvedValueOnce([openBooking])
      .mockResolvedValueOnce([payment])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.clickComplete({
      click_trans_id: '111',
      service_id: '123',
      merchant_trans_id: 'booking-1',
      merchant_prepare_id: '111',
      amount: '650000',
      action: '1',
      sign_time: 't',
      sign_string: 'valid',
    });

    expect(result).toMatchObject({ error: 0, error_note: 'Success' });
    const ledgerCall = queryCallsOf(pg).find(([sql]) =>
      String(sql).includes('INSERT INTO partner_ledger_entries'),
    );
    expect(ledgerCall).toBeDefined();
  });

  it('treats a Click-reported cancellation (negative error field) as cancelled, not paid', async () => {
    click.verifyCompleteSignature.mockReturnValue(true);

    const result = await service.clickComplete({
      click_trans_id: '111',
      service_id: '123',
      merchant_trans_id: 'booking-1',
      merchant_prepare_id: '111',
      amount: '650000',
      action: '1',
      sign_time: 't',
      sign_string: 'valid',
      error: -9,
    });

    expect(result).toMatchObject({
      error: -9,
      error_note: 'Transaction cancelled',
    });
    expect(pg.transaction).not.toHaveBeenCalled();
  });
});
