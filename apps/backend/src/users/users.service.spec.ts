import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import type { JobQueueService } from '../infrastructure/job-queue.service';
import type { PostgresService } from '../infrastructure/postgres.service';
import { UsersService } from './users.service';

type QueryCall = [sql: string, params?: readonly unknown[]];
const queryCallsOf = (obj: { query: unknown }): QueryCall[] =>
  (obj.query as jest.Mock).mock.calls as QueryCall[];

describe('UsersService guest booking claim', () => {
  let service: UsersService;
  let pg: { query: jest.Mock };

  const actor: RequestActor = {
    id: 'user-1',
    actorType: 'user',
    role: Role.USER,
    roles: [Role.USER],
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new UsersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('claims unowned guest bookings by a verified normalized phone before returning history', async () => {
    pg.query
      .mockResolvedValueOnce([
        {
          phone: '+998 90 123 45 67',
          email: 'unverified@example.com',
          phone_verified_at: '2026-09-27T10:00:00.000Z',
          email_verified_at: null,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'claimed-booking' }]);

    await expect(service.bookings(actor)).resolves.toEqual([
      { id: 'claimed-booking' },
    ]);

    const [claimSql, claimParams] = queryCallsOf(pg)[1];
    expect(claimSql).toContain('WHERE user_id IS NULL');
    expect(claimSql).toContain('guest_phone');
    expect(claimParams).toEqual([
      actor.id,
      expect.any(String),
      '998901234567',
      null,
    ]);
    expect(queryCallsOf(pg)[2][1]).toEqual([actor.id]);
  });

  it('claims by verified normalized email and never uses an unverified phone', async () => {
    pg.query
      .mockResolvedValueOnce([
        {
          phone: '+998901112233',
          email: '  GUEST@EXAMPLE.COM ',
          phone_verified_at: null,
          email_verified_at: '2026-09-27T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.bookings(actor);

    expect(queryCallsOf(pg)[1][1]).toEqual([
      actor.id,
      expect.any(String),
      null,
      'guest@example.com',
    ]);
  });

  it('does not run a claim update when neither account contact is verified', async () => {
    pg.query
      .mockResolvedValueOnce([
        {
          phone: '+998901234567',
          email: 'guest@example.com',
          phone_verified_at: null,
          email_verified_at: null,
        },
      ])
      .mockResolvedValueOnce([]);

    await service.bookings(actor);

    expect(pg.query).toHaveBeenCalledTimes(2);
    expect(String(queryCallsOf(pg)[1][0])).toContain(
      'SELECT * FROM bookings WHERE user_id = $1',
    );
  });

  it('is idempotent and cannot reassign a booking already owned by another user', async () => {
    const verifiedUser = {
      phone: '+998901234567',
      email: null,
      phone_verified_at: '2026-09-27T10:00:00.000Z',
      email_verified_at: null,
    };
    pg.query
      .mockResolvedValueOnce([verifiedUser])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'booking-1' }])
      .mockResolvedValueOnce([verifiedUser])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'booking-1' }]);

    await service.bookings(actor);
    await service.bookings(actor);

    const claimCalls = queryCallsOf(pg).filter(([sql]) =>
      String(sql).includes('UPDATE bookings'),
    );
    expect(claimCalls).toHaveLength(2);
    for (const [sql, params] of claimCalls) {
      expect(String(sql)).toContain('WHERE user_id IS NULL');
      expect(params?.[0]).toBe(actor.id);
    }
  });

  it("keeps an unrelated user's booking invisible in the single-booking history path", async () => {
    pg.query
      .mockResolvedValueOnce([
        {
          phone: '+998901234567',
          email: null,
          phone_verified_at: null,
          email_verified_at: null,
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(
      service.booking(actor, 'another-users-booking'),
    ).rejects.toMatchObject({ status: 404 });
    expect(queryCallsOf(pg)[1][1]).toEqual(['another-users-booking', actor.id]);
  });
});

describe('UsersService verified email lifecycle', () => {
  it('clears email verification when the user changes the email address', async () => {
    const pg = {
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 'user-1',
          email: 'new@example.com',
          email_verified_at: null,
        },
      ]),
    };
    const service = new UsersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
    const actor: RequestActor = {
      id: 'user-1',
      actorType: 'user',
      role: Role.USER,
      roles: [Role.USER],
    };

    await service.updateProfile(actor, { email: ' NEW@EXAMPLE.COM ' });

    expect(String(queryCallsOf(pg)[0][0])).toContain(
      'email_verified_at = CASE',
    );
    expect(queryCallsOf(pg)[0][1]?.[0]).toBe('new@example.com');
  });
});
