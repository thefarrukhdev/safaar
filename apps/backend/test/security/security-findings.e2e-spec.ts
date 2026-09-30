import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@safaar/types';
import { hmacSha256 } from '../../src/auth/security';
import { buildActorFromHeaders } from '../../src/common/actor';
import { PartnerApiService } from '../../src/partner-api/partner-api.service';
import { PartnersService } from '../../src/partners/partners.service';
import { PaymentsService } from '../../src/payments/payments.service';
import { UsersService } from '../../src/users/users.service';
import type { PostgresService } from '../../src/infrastructure/postgres.service';
import type { JobQueueService } from '../../src/infrastructure/job-queue.service';
import type { UploadsService } from '../../src/uploads/uploads.service';

const userActor = {
  id: '00000000-0000-2001-0000-000000000001',
  actorType: 'user' as const,
  role: Role.USER,
  roles: [Role.USER],
};

describe('Security regression tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-32-characters';
    process.env.PAYMENT_WEBHOOK_SECRET = 'test-payment-secret-with-32-chars';
    process.env.PARTNER_API_KEY_PEPPER = 'test-partner-pepper-with-32-chars';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects client-controlled role headers', () => {
    const actor = buildActorFromHeaders({
      'x-client-role': 'SUPER_ADMIN',
      'x-client-id': 'attacker-controlled-id',
    });

    expect(actor).toBeUndefined();
  });

  it('rejects forged bearer tokens', () => {
    const actor = buildActorFromHeaders({
      authorization: 'Bearer forged.attacker-controlled-id.SUPER_ADMIN.any',
    });

    expect(actor).toBeUndefined();
  });

  it('prevents /me booking lookup across users', async () => {
    const pg = postgresMock();
    pg.query.mockResolvedValueOnce([]);
    const users = new UsersService(
      pg as unknown as PostgresService,
      jobsMock() as unknown as JobQueueService,
      { create: jest.fn() } as unknown as UploadsService,
    );

    await expect(
      users.booking(userActor, 'other-user-booking'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(pg.query).toHaveBeenCalledWith(
      'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
      ['other-user-booking', userActor.id],
    );
  });

  it('requires signed, idempotent payment webhooks', async () => {
    const pg = postgresMock();
    pg.transaction.mockImplementation((operation: (tx: unknown) => unknown) =>
      operation({ query: pg.query }),
    );
    const payments = new PaymentsService(
      pg as unknown as PostgresService,
      { get: jest.fn() } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
    );
    const body = {
      booking_id: 'booking-1',
      transaction_id: 'audit-test-transaction',
      amount: 650000,
      currency: 'UZS',
    };

    await expect(
      payments.providerWebhook('click', 'complete', body),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const eventKey = 'click:complete:audit-test-transaction';
    const canonical = `click.complete.${eventKey}.${stableStringify(body)}`;
    const signature = hmacSha256(
      canonical,
      process.env.PAYMENT_WEBHOOK_SECRET ?? '',
    );
    const payment = {
      id: 'payment-1',
      booking_id: 'booking-1',
      amount: '650000',
      currency: 'UZS',
      status: 'pending',
    };
    const bookingRow = {
      id: 'booking-1',
      status: 'pending',
      user_id: 'user-1',
      partner_organization_id: 'partner-1',
      confirmation_mode: 'instant_confirmation',
      partner_payable: '572000',
      currency: 'UZS',
    };
    pg.query
      // 1) first call: INSERT ... ON CONFLICT DO NOTHING claims the event_key
      .mockResolvedValueOnce([
        {
          id: 'event-1',
          payment_id: null,
          processed_at: '2026-07-25T00:00:00.000Z',
        },
      ])
      // 2) SELECT bookings ... FOR UPDATE
      .mockResolvedValueOnce([bookingRow])
      // 3) SELECT payments ... FOR UPDATE
      .mockResolvedValueOnce([payment])
      // 4) UPDATE payments SET status
      .mockResolvedValueOnce([])
      // 5) UPDATE payment_events SET payment_id
      .mockResolvedValueOnce([])
      // 6) UPDATE bookings SET status/confirmed_at/expires_at
      .mockResolvedValueOnce([])
      // 7) INSERT booking_status_history (recordStatusHistory)
      .mockResolvedValueOnce([])
      // 8) INSERT partner_ledger_entries (creditPartnerLedger)
      .mockResolvedValueOnce([])
      // 9) second call: INSERT ... ON CONFLICT DO NOTHING finds the row already claimed
      .mockResolvedValueOnce([])
      // 10) SELECT * FROM payment_events WHERE event_key
      .mockResolvedValueOnce([
        {
          payment_id: 'payment-1',
          processed_at: '2026-07-25T00:00:00.000Z',
        },
      ])
      // 11) SELECT * FROM payments WHERE id
      .mockResolvedValueOnce([{ ...payment, status: 'paid' }]);

    const first = await payments.providerWebhook('click', 'complete', body, {
      'x-safaar-signature': signature,
    });
    const second = await payments.providerWebhook('click', 'complete', body, {
      'x-safaar-signature': signature,
    });

    expect(first).toMatchObject({
      accepted: true,
      duplicate: false,
      payment: { status: 'paid' },
    });
    expect(second).toMatchObject({ accepted: true, duplicate: true });
  });

  it('does not fall back to another organization for invalid partner API keys', async () => {
    const pg = postgresMock();
    pg.query.mockResolvedValueOnce([]);
    const partnerApi = new PartnerApiService(pg as unknown as PostgresService);

    await expect(
      partnerApi.bookings('definitely-not-a-valid-api-key'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('stores only partner API key hashes and accepts the one-time full key', async () => {
    const pg = postgresMock();
    pg.query.mockResolvedValue([]);
    const partners = new PartnersService(
      pg as unknown as PostgresService,
      jobsMock() as unknown as JobQueueService,
    );
    const result = await partners.createApiKey(
      {
        id: '00000000-0000-3001-0000-000000000001',
        actorType: 'partner',
        role: Role.PARTNER,
        roles: [Role.PARTNER],
        organizationId: '00000000-0000-3001-0000-000000000001',
      },
      { name: 'Regression key' },
    );

    const insertParams = pg.query.mock.calls[0]?.[1] ?? [];
    const keyPrefix = String(insertParams[3]);
    const secretHash = String(insertParams[4]);

    expect(result).toHaveProperty('api_key');
    expect(result).not.toHaveProperty('secret');
    expect(secretHash).not.toEqual(result.api_key);

    pg.query.mockReset();
    pg.query
      .mockResolvedValueOnce([
        {
          key_prefix: keyPrefix,
          secret_hash: secretHash,
          organization_id: '00000000-0000-3001-0000-000000000001',
        },
      ])
      .mockResolvedValueOnce([]);

    const partnerApi = new PartnerApiService(pg as unknown as PostgresService);
    await expect(partnerApi.bookings(String(result.api_key))).resolves.toEqual(
      [],
    );
  });
});

function postgresMock() {
  return {
    query: jest.fn<Promise<Record<string, unknown>[]>, unknown[]>(),
    transaction: jest.fn(),
  };
}

function jobsMock() {
  return {
    add: jest.fn().mockResolvedValue(undefined),
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
