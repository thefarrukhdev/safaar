import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import type { JobQueueService } from '../infrastructure/job-queue.service';
import type { PostgresService } from '../infrastructure/postgres.service';
import type { UploadsService } from '../uploads/uploads.service';
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
      { create: jest.fn() } as unknown as UploadsService,
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

describe('UsersService favorites', () => {
  let service: UsersService;
  let pg: { query: jest.Mock };

  const actorA: RequestActor = {
    id: 'user-a',
    actorType: 'user',
    role: Role.USER,
    roles: [Role.USER],
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new UsersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
      { create: jest.fn() } as unknown as UploadsService,
    );
  });

  it("lists only the authenticated user's favorites, scoped by user_id", async () => {
    const rows = [
      {
        id: 'fav-1',
        user_id: 'user-a',
        target_type: 'hotel',
        target_id: 'hotel-1',
        created_at: '2026-09-01T00:00:00.000Z',
      },
    ];
    pg.query.mockResolvedValueOnce(rows);

    await expect(service.favorites(actorA)).resolves.toEqual(rows);

    const [sql, params] = queryCallsOf(pg)[0];
    expect(sql).toContain('FROM favorites WHERE user_id = $1');
    expect(params).toEqual(['user-a']);
  });

  it('rejects anonymous favorites list access before querying the database', async () => {
    await expect(service.favorites(undefined)).rejects.toMatchObject({
      status: 401,
      response: { code: 'AUTH_TOKEN_INVALID' },
    });
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('persists a new favorite using the authenticated actor id, not a client-supplied user_id', async () => {
    pg.query.mockResolvedValueOnce([
      {
        id: 'fav-new',
        user_id: 'user-a',
        target_type: 'hotel',
        target_id: 'hotel-1',
        created_at: '2026-09-01T00:00:00.000Z',
      },
    ]);

    const result = await service.addFavorite(actorA, {
      target_type: 'hotel',
      target_id: 'hotel-1',
      user_id: 'attacker-controlled-user-id',
    });

    expect(result).toMatchObject({ user_id: 'user-a', target_id: 'hotel-1' });
    const [sql, params] = queryCallsOf(pg)[0];
    expect(sql).toContain('INSERT INTO favorites');
    expect(sql).toContain('ON CONFLICT (user_id, target_type, target_id)');
    expect(params?.[1]).toBe('user-a');
  });

  it('is idempotent on a duplicate add — returns the existing row instead of a unique-constraint 500', async () => {
    const existing = {
      id: 'fav-existing',
      user_id: 'user-a',
      target_type: 'hotel',
      target_id: 'hotel-1',
      created_at: '2026-09-01T00:00:00.000Z',
    };
    pg.query.mockResolvedValueOnce([existing]);

    await expect(
      service.addFavorite(actorA, {
        target_type: 'hotel',
        target_id: 'hotel-1',
      }),
    ).resolves.toEqual(existing);
  });

  it('rejects anonymous add-favorite before querying the database', async () => {
    await expect(
      service.addFavorite(undefined, {
        target_type: 'hotel',
        target_id: 'hotel-1',
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('removes a favorite owned by the authenticated user', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'fav-1' }]);

    await expect(service.deleteFavorite(actorA, 'fav-1')).resolves.toEqual({
      id: 'fav-1',
      user_id: 'user-a',
      deleted: true,
    });

    const [sql, params] = queryCallsOf(pg)[0];
    expect(sql).toContain(
      'DELETE FROM favorites WHERE id = $1 AND user_id = $2',
    );
    expect(params).toEqual(['fav-1', 'user-a']);
  });

  it('does not delete, and reports 404, when the favorite belongs to another user', async () => {
    pg.query.mockResolvedValueOnce([]);

    await expect(
      service.deleteFavorite(actorA, 'someone-elses-favorite'),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'FAVORITE_NOT_FOUND' },
    });
  });

  it('reports 404 (not a false success) for deleting a non-existent favorite', async () => {
    pg.query.mockResolvedValueOnce([]);

    await expect(
      service.deleteFavorite(actorA, 'does-not-exist'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects anonymous delete-favorite before querying the database', async () => {
    await expect(
      service.deleteFavorite(undefined, 'fav-1'),
    ).rejects.toMatchObject({
      status: 401,
    });
    expect(pg.query).not.toHaveBeenCalled();
  });
});

describe('UsersService avatar upload (MEDIA_NOT_FOUND regression)', () => {
  let service: UsersService;
  let pg: { query: jest.Mock };
  let uploads: { create: jest.Mock };

  const actor: RequestActor = {
    id: 'user-1',
    actorType: 'user',
    role: Role.USER,
    roles: [Role.USER],
  };

  const uploadedFile = {
    buffer: Buffer.from('fake-image-bytes'),
    originalname: 'avatar.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    uploads = { create: jest.fn() };
    service = new UsersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
      uploads as unknown as UploadsService,
    );
  });

  it(
    "regression: a real multipart file upload (web-user's actual request shape) " +
      'persists media via UploadsService instead of throwing MEDIA_NOT_FOUND',
    async () => {
      uploads.create.mockResolvedValueOnce({
        id: 'media-123',
        owner_id: 'user-1',
        url: 'https://cdn.example.com/image/media-123.jpg',
      });
      pg.query.mockResolvedValueOnce([
        {
          id: 'user-1',
          avatar_media_id: 'media-123',
          avatar_url: 'https://cdn.example.com/image/media-123.jpg',
        },
      ]);

      const result = await service.setAvatar(actor, {}, uploadedFile);

      expect(uploads.create).toHaveBeenCalledWith(
        actor,
        'image',
        {},
        uploadedFile,
      );
      // The DB write must use the media id UploadsService actually created,
      // scoped to the authenticated actor — never a client-supplied id.
      const [sql, params] = pg.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('avatar_media_id = $1');
      expect(params).toEqual(['media-123', expect.any(String), 'user-1']);
      expect(result).toMatchObject({
        avatar_media_id: 'media-123',
        avatar_url: 'https://cdn.example.com/image/media-123.jpg',
      });
    },
  );

  it('still supports the media_id JSON contract when no file is attached (e.g. a future presign flow)', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'media-999' }])
      .mockResolvedValueOnce([
        { id: 'user-1', avatar_media_id: 'media-999', avatar_url: null },
      ]);

    await service.setAvatar(actor, { media_id: 'media-999' });

    expect(uploads.create).not.toHaveBeenCalled();
    const [ownershipSql, ownershipParams] = pg.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(ownershipSql).toContain('owner_id = $2');
    expect(ownershipParams).toEqual(['media-999', 'user-1']);
  });

  it('rejects with MEDIA_NOT_FOUND when neither a file nor a media_id is provided', async () => {
    await expect(service.setAvatar(actor, {})).rejects.toMatchObject({
      status: 404,
      response: { code: 'MEDIA_NOT_FOUND' },
    });
    expect(uploads.create).not.toHaveBeenCalled();
    expect(pg.query).not.toHaveBeenCalled();
  });

  it("rejects with MEDIA_NOT_FOUND when a media_id does not belong to the actor (can't attach another user's media)", async () => {
    pg.query.mockResolvedValueOnce([]);

    await expect(
      service.setAvatar(actor, { media_id: 'someone-elses-media' }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'MEDIA_NOT_FOUND' },
    });
  });

  it('rejects anonymous avatar upload before touching storage or the database', async () => {
    await expect(
      service.setAvatar(undefined, {}, uploadedFile),
    ).rejects.toMatchObject({ status: 401 });
    expect(uploads.create).not.toHaveBeenCalled();
    expect(pg.query).not.toHaveBeenCalled();
  });
});
