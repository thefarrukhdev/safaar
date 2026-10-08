import { Role, type ActorType } from '@safaar/types';
import { Pool, type QueryResultRow } from 'pg';
import { hashSecret, jwtSecurityConfig } from './security';

export interface AuthSessionRecord {
  id: string;
  actorId: string;
  actorType: ActorType;
  role: Role;
  roles: Role[];
  organizationId?: string | null;
  familyId: string;
  refreshHash: string;
  refreshJti: string;
  refreshExpiresAt: number;
  revokedAt?: string;
  replacedByJti?: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateSessionInput {
  sessionId: string;
  familyId: string;
  actorId: string;
  actorType: ActorType;
  role: Role;
  roles: Role[];
  organizationId?: string | null;
  refreshToken: string;
  refreshJti: string;
  ipAddress?: string;
  userAgent?: string;
}

export const DEFAULT_SESSION_ABSOLUTE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 kun

export class AuthSessionStore {
  private pool: Pool | null = null;

  getAbsoluteLifetimeMs(): number {
    return DEFAULT_SESSION_ABSOLUTE_LIFETIME_MS;
  }

  private getPool(): Pool {
    if (!this.pool) {
      const url = process.env.DATABASE_URL;
      if (!url) {
        throw new Error(
          'AuthSessionStore: DATABASE_URL is required for session persistence',
        );
      }
      const connectionTimeoutMillis = toPositiveInt(
        process.env.AUTH_SESSION_DB_CONNECTION_TIMEOUT_MS ??
          process.env.DB_CONNECTION_TIMEOUT_MS,
        8_000,
      );
      const queryTimeoutMillis = toPositiveInt(
        process.env.AUTH_SESSION_DB_QUERY_TIMEOUT_MS ??
          process.env.DB_QUERY_TIMEOUT_MS,
        8_000,
      );
      const idleTimeoutMillis = toPositiveInt(
        process.env.AUTH_SESSION_DB_IDLE_TIMEOUT_MS ??
          process.env.DB_IDLE_TIMEOUT_MS,
        10_000,
      );
      const max = toPositiveInt(process.env.AUTH_SESSION_DB_POOL_MAX, 3);
      this.pool = new Pool({
        connectionString: url,
        connectionTimeoutMillis,
        idleTimeoutMillis,
        query_timeout: queryTimeoutMillis,
        statement_timeout: queryTimeoutMillis,
        max,
      });
    }
    return this.pool;
  }

  private async query<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const { rows } = await this.getPool().query<T>(sql, [...params]);
    return rows;
  }

  private rowToRecord(row: Record<string, unknown>): AuthSessionRecord {
    return {
      id: String(row.id),
      actorId: String(row.actor_id),
      actorType: String(row.actor_type) as ActorType,
      role: String(row.role) as Role,
      roles: (row.roles as Role[]) ?? [],
      organizationId: row.organization_id ? String(row.organization_id) : null,
      familyId: String(row.family_id),
      refreshHash: String(row.refresh_hash),
      refreshJti: String(row.refresh_jti),
      refreshExpiresAt: Number(row.refresh_expires_at),
      revokedAt: row.revoked_at ? String(row.revoked_at) : undefined,
      replacedByJti: row.replaced_by_jti
        ? String(row.replaced_by_jti)
        : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
      ipAddress: row.ip_address ? String(row.ip_address) : undefined,
      userAgent: row.user_agent ? String(row.user_agent) : undefined,
    };
  }

  async create(input: CreateSessionInput): Promise<AuthSessionRecord> {
    const now = new Date().toISOString();
    const absoluteLifetimeMs = this.getAbsoluteLifetimeMs();
    const refreshExpiresAt =
      Date.now() +
      Math.min(
        jwtSecurityConfig().refreshTtlSeconds * 1000,
        absoluteLifetimeMs,
      );
    const refreshHash = hashSecret(input.refreshToken);

    const rows = await this.query(
      `INSERT INTO auth_sessions (
         id, actor_id, actor_type, role, roles, organization_id,
         family_id, refresh_hash, refresh_jti, refresh_expires_at,
         created_at, updated_at, ip_address, user_agent
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        input.sessionId,
        input.actorId,
        input.actorType,
        input.role,
        input.roles,
        input.organizationId ?? null,
        input.familyId,
        refreshHash,
        input.refreshJti,
        refreshExpiresAt,
        now,
        now,
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );

    return this.rowToRecord(rows[0]);
  }

  async get(id: string | undefined): Promise<AuthSessionRecord | undefined> {
    if (!id) return undefined;
    const rows = await this.query('SELECT * FROM auth_sessions WHERE id = $1', [
      id,
    ]);
    return rows[0] ? this.rowToRecord(rows[0]) : undefined;
  }

  async isActive(id: string | undefined): Promise<boolean> {
    if (!id) return false;
    const rows = await this.query<{ active: number }>(
      `SELECT 1 AS active
       FROM auth_sessions
       WHERE id = $1
         AND revoked_at IS NULL
         AND refresh_expires_at > $2
       LIMIT 1`,
      [id, Date.now()],
    );
    return rows.length > 0;
  }

  async listForActor(actorId: string): Promise<AuthSessionRecord[]> {
    const rows = await this.query(
      `SELECT * FROM auth_sessions
       WHERE actor_id = $1
       ORDER BY created_at DESC`,
      [actorId],
    );
    return rows.map((r) => this.rowToRecord(r));
  }

  async rotate(
    sessionId: string,
    refreshToken: string,
    refreshJti: string,
    nextRefreshToken: string,
    nextRefreshJti: string,
  ): Promise<AuthSessionRecord> {
    const session = await this.get(sessionId);
    if (!session || session.revokedAt) {
      throw new Error('AUTH_SESSION_REVOKED');
    }

    const nowMs = Date.now();
    const createdAtMs = new Date(session.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) {
      throw new Error('AUTH_SESSION_REVOKED');
    }
    const absoluteLifetimeMs = this.getAbsoluteLifetimeMs();

    if (
      session.refreshExpiresAt <= nowMs ||
      nowMs - createdAtMs >= absoluteLifetimeMs
    ) {
      throw new Error('AUTH_SESSION_REVOKED');
    }

    if (
      session.refreshJti !== refreshJti ||
      session.refreshHash !== hashSecret(refreshToken)
    ) {
      await this.revokeFamily(session.familyId);
      throw new Error('AUTH_REFRESH_REUSED');
    }

    const now = new Date().toISOString();
    const remainingAbsoluteLifetimeMs = Math.max(
      0,
      createdAtMs + absoluteLifetimeMs - nowMs,
    );
    const newRefreshExpiresAt =
      nowMs +
      Math.min(
        jwtSecurityConfig().refreshTtlSeconds * 1000,
        remainingAbsoluteLifetimeMs,
      );
    const newRefreshHash = hashSecret(nextRefreshToken);

    const rows = await this.query(
      `UPDATE auth_sessions
       SET refresh_hash = $1,
           replaced_by_jti = $2,
           refresh_jti = $3,
           refresh_expires_at = $4,
           last_used_at = $5,
           updated_at = $5
       WHERE id = $6
       RETURNING *`,
      [
        newRefreshHash,
        nextRefreshJti,
        nextRefreshJti,
        newRefreshExpiresAt,
        now,
        sessionId,
      ],
    );

    return this.rowToRecord(rows[0]);
  }

  async revokeSession(id: string): Promise<boolean> {
    const result = await this.query(
      `UPDATE auth_sessions
       SET revoked_at = now(), updated_at = now()
       WHERE id = $1 AND revoked_at IS NULL
       RETURNING id`,
      [id],
    );
    return result.length > 0;
  }

  async revokeActor(actorId: string): Promise<number> {
    const result = await this.query(
      `UPDATE auth_sessions
       SET revoked_at = now(), updated_at = now()
       WHERE actor_id = $1 AND revoked_at IS NULL`,
      [actorId],
    );
    return (result as unknown[]).length;
  }

  async revokeFamily(familyId: string): Promise<number> {
    const result = await this.query(
      `UPDATE auth_sessions
       SET revoked_at = now(), updated_at = now()
       WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId],
    );
    return (result as unknown[]).length;
  }
}

export const authSessionStore = new AuthSessionStore();

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
