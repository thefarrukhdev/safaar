import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import type { JobQueueService } from '../infrastructure/job-queue.service';
import type { PostgresService } from '../infrastructure/postgres.service';
import { UsersService } from './users.service';

type QueryCall = [sql: string, params?: readonly unknown[]];
const queryCallsOf = (obj: { query: unknown }): QueryCall[] =>
  (obj.query as jest.Mock).mock.calls as QueryCall[];

describe('UsersService contact-matched guest booking history', () => {
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

  it('returns owned and matching unowned guest bookings in one authenticated query', async () => {
    const rows = [
      { id: 'owned-booking', user_id: actor.id },
      {
        id: 'phone-matched-guest',
        user_id: null,
        guest_phone: '+998901234567',
      },
      {
        id: 'email-matched-guest',
        user_id: null,
        guest_email: 'guest@example.com',
      },
    ];
    pg.query.mockResolvedValueOnce(rows);

    await expect(service.bookings(actor)).resolves.toEqual(rows);

    const [sql, params] = queryCallsOf(pg)[0];
    expect(sql).toContain('b.user_id = $1');
    expect(sql).toContain('b.user_id IS NULL');
    expect(sql).toContain('b.guest_phone');
    expect(sql).toContain('b.guest_email');
    expect(sql).toContain('regexp_replace');
    expect(sql).toContain('lower(btrim');
    expect(params).toEqual([actor.id]);
  });

  it('does not require phone_verified_at or email_verified_at for contact matching', async () => {
    pg.query.mockResolvedValueOnce([
      { id: 'unverified-contact-match', user_id: null },
    ]);

    await service.bookings(actor);

    const [sql] = queryCallsOf(pg)[0];
    expect(sql).not.toContain('phone_verified_at');
    expect(sql).not.toContain('email_verified_at');
    expect(sql).not.toContain('UPDATE bookings');
  });

  it('uses phone OR email matching and excludes empty account contacts', async () => {
    pg.query.mockResolvedValueOnce([]);

    await service.bookings(actor);

    const [sql] = queryCallsOf(pg)[0];
    expect(sql).toMatch(/guest_phone[\s\S]+OR[\s\S]+guest_email/);
    expect(sql).toContain('NULLIF');
  });

  it('leaves a matching guest booking unowned instead of transferring user_id', async () => {
    pg.query.mockResolvedValueOnce([
      { id: 'matching-guest', user_id: null, guest_phone: '+998901234567' },
    ]);

    const result = await service.bookings(actor);

    expect(result[0]).toMatchObject({ id: 'matching-guest', user_id: null });
    expect(pg.query).toHaveBeenCalledTimes(1);
    expect(String(queryCallsOf(pg)[0][0])).toMatch(/^\s*SELECT/i);
  });

  it('does not expose unmatched or another user-owned bookings when the database returns no eligible row', async () => {
    pg.query.mockResolvedValueOnce([]);

    await expect(service.bookings(actor)).resolves.toEqual([]);
    expect(queryCallsOf(pg)[0][1]).toEqual([actor.id]);
  });

  it('allows detail access to a matching unowned guest booking without changing ownership', async () => {
    pg.query.mockResolvedValueOnce([
      { id: 'matching-guest', user_id: null, guest_email: 'guest@example.com' },
    ]);

    await expect(
      service.booking(actor, 'matching-guest'),
    ).resolves.toMatchObject({
      id: 'matching-guest',
      user_id: null,
    });

    const [sql, params] = queryCallsOf(pg)[0];
    expect(sql).toContain('b.id = $2');
    expect(sql).toContain('b.user_id = $1');
    expect(sql).toContain('b.user_id IS NULL');
    expect(params).toEqual([actor.id, 'matching-guest']);
  });

  it("keeps an unrelated user's booking invisible in the detail path", async () => {
    pg.query.mockResolvedValueOnce([]);

    await expect(
      service.booking(actor, 'another-users-booking'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects anonymous history access before querying the database', async () => {
    await expect(service.bookings(undefined)).rejects.toMatchObject({
      status: 401,
      response: { code: 'AUTH_TOKEN_INVALID' },
    });
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('does not accept phone/email query parameters as an authentication or filtering bypass', async () => {
    pg.query.mockResolvedValueOnce([]);

    await service.bookings(actor, {
      phone: '+998909999999',
      email: 'attacker@example.com',
    });

    const [sql, params] = queryCallsOf(pg)[0];
    expect(sql).not.toContain('attacker@example.com');
    expect(sql).not.toContain('+998909999999');
    expect(params).toEqual([actor.id]);
  });
});
