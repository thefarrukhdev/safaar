import { AuthSessionStore } from './session-store';
import { hashSecret } from './security';

describe('AuthSessionStore.isActive', () => {
  it('checks active sessions with a lightweight existence query', async () => {
    const store = new AuthSessionStore();
    const query = jest
      .spyOn(
        store as unknown as {
          query: (
            sql: string,
            params: unknown[],
          ) => Promise<Array<{ active: number }>>;
        },
        'query',
      )
      .mockResolvedValue([{ active: 1 }]);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(123456789);

    await expect(store.isActive('session-1')).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT 1 AS active'),
      ['session-1', 123456789],
    );
    expect(query.mock.calls[0]?.[0]).not.toContain('SELECT *');
    nowSpy.mockRestore();
  });

  it('returns false without querying when session id is missing', async () => {
    const store = new AuthSessionStore();
    const query = jest.spyOn(
      store as unknown as {
        query: (sql: string, params: unknown[]) => Promise<unknown[]>;
      },
      'query',
    );

    await expect(store.isActive(undefined)).resolves.toBe(false);

    expect(query).not.toHaveBeenCalled();
  });
});

describe('AuthSessionStore absolute lifetime (7 days)', () => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  it('session created within 7 days can be rotated and expiration is capped at createdAt + 7d', async () => {
    const store = new AuthSessionStore();
    const createdAtMs = 1_000_000_000_000;
    const createdAt = new Date(createdAtMs).toISOString();
    // 3 days after creation
    const nowMs = createdAtMs + 3 * 24 * 60 * 60 * 1000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);

    const mockSession = {
      id: 'sess-1',
      actor_id: 'actor-1',
      actor_type: 'partner',
      role: 'partner',
      roles: ['partner'],
      organization_id: 'org-1',
      family_id: 'fam-1',
      refresh_hash: hashSecret('old-refresh-token'),
      refresh_jti: 'old-jti',
      refresh_expires_at: nowMs + 100_000,
      revoked_at: null,
      created_at: createdAt,
      updated_at: createdAt,
    };

    jest
      .spyOn(
        store as unknown as {
          get: (id: string) => Promise<unknown>;
        },
        'get',
      )
      .mockResolvedValue(
        (
          store as unknown as { rowToRecord: (r: unknown) => unknown }
        ).rowToRecord(mockSession),
      );

    const querySpy = jest
      .spyOn(
        store as unknown as {
          query: (sql: string, params: unknown[]) => Promise<unknown[]>;
        },
        'query',
      )
      .mockResolvedValue([mockSession]);

    await store.rotate(
      'sess-1',
      'old-refresh-token',
      'old-jti',
      'new-refresh-token',
      'new-jti',
    );

    expect(querySpy).toHaveBeenCalled();
    const updateParams = querySpy.mock.calls[0]?.[1];
    const updatedExpiresAt = Number(updateParams[3]);

    // Expiration must never exceed createdAt + 7 days
    expect(updatedExpiresAt).toBeLessThanOrEqual(createdAtMs + SEVEN_DAYS_MS);
    nowSpy.mockRestore();
  });

  it('rejects rotation and revokes when session exceeds 7 days absolute lifetime', async () => {
    const store = new AuthSessionStore();
    const createdAtMs = 1_000_000_000_000;
    const createdAt = new Date(createdAtMs).toISOString();
    // 7 days and 1 second after creation
    const nowMs = createdAtMs + SEVEN_DAYS_MS + 1000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);

    const mockSession = {
      id: 'sess-1',
      actor_id: 'actor-1',
      actor_type: 'partner',
      role: 'partner',
      roles: ['partner'],
      organization_id: 'org-1',
      family_id: 'fam-1',
      refresh_hash: hashSecret('old-refresh-token'),
      refresh_jti: 'old-jti',
      refresh_expires_at: nowMs + 100_000,
      revoked_at: null,
      created_at: createdAt,
      updated_at: createdAt,
    };

    jest
      .spyOn(
        store as unknown as {
          get: (id: string) => Promise<unknown>;
        },
        'get',
      )
      .mockResolvedValue(
        (
          store as unknown as { rowToRecord: (r: unknown) => unknown }
        ).rowToRecord(mockSession),
      );

    await expect(
      store.rotate(
        'sess-1',
        'old-refresh-token',
        'old-jti',
        'new-refresh-token',
        'new-jti',
      ),
    ).rejects.toThrow('AUTH_SESSION_REVOKED');

    nowSpy.mockRestore();
  });

  it('rejects rotation when session createdAt is invalid date string (fails closed)', async () => {
    const store = new AuthSessionStore();
    const mockSession = {
      id: 'sess-invalid-date',
      actor_id: 'actor-1',
      actor_type: 'partner',
      role: 'partner',
      roles: ['partner'],
      organization_id: 'org-1',
      family_id: 'fam-1',
      refresh_hash: hashSecret('old-refresh-token'),
      refresh_jti: 'old-jti',
      refresh_expires_at: Date.now() + 100_000,
      revoked_at: null,
      created_at: 'not-a-valid-date-string',
      updated_at: 'not-a-valid-date-string',
    };

    jest
      .spyOn(
        store as unknown as {
          get: (id: string) => Promise<unknown>;
        },
        'get',
      )
      .mockResolvedValue(
        (
          store as unknown as { rowToRecord: (r: unknown) => unknown }
        ).rowToRecord(mockSession),
      );

    await expect(
      store.rotate(
        'sess-invalid-date',
        'old-refresh-token',
        'old-jti',
        'new-refresh-token',
        'new-jti',
      ),
    ).rejects.toThrow('AUTH_SESSION_REVOKED');
  });
});
