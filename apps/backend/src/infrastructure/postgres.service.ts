import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';

// node-postgres DATE ustunlarini standart holda JS `Date` obyektiga
// aylantiradi — bu server jarayonining vaqt zonasi orqali kun siljishiga
// olib kelishi mumkin (masalan '2026-08-10' -> '2026-08-09T19:00:00.000Z').
// DATE (oid 1082) qiymatini xom "YYYY-MM-DD" satr sifatida qaytaramiz.
types.setTypeParser(1082, (value: string) => value);

export interface PostgresTransaction {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
}

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private readonly pool: Pool;
  private readonly slowQueryMs: number;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    const connectionTimeoutMillis = toPositiveInt(
      config.get<string>('DB_CONNECTION_TIMEOUT_MS'),
      8_000,
    );
    const queryTimeoutMillis = toPositiveInt(
      config.get<string>('DB_QUERY_TIMEOUT_MS'),
      8_000,
    );
    const max = toPositiveInt(config.get<string>('DB_POOL_MAX'), 5);
    const idleTimeoutMillis = toPositiveInt(
      config.get<string>('DB_IDLE_TIMEOUT_MS'),
      10_000,
    );
    this.slowQueryMs = toPositiveInt(config.get<string>('SLOW_QUERY_MS'), 300);

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL talab qilinadi — PostgreSQL ulanish URL ni .env faylida belgilang',
      );
    }

    this.pool = new Pool({
      connectionString,
      connectionTimeoutMillis,
      idleTimeoutMillis,
      query_timeout: queryTimeoutMillis,
      statement_timeout: queryTimeoutMillis,
      max,
    });

    this.pool.on('error', (error: Error) => {
      this.logger.error(`Pool xatosi: ${error.message}`);
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    let lastError: unknown;
    const attempts = 3;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const startedAt = performance.now();
        const result = await this.pool.query<T>(sql, [...params]);
        this.logQuery(sql, startedAt, result.rowCount ?? result.rows.length);
        return result.rows;
      } catch (error) {
        lastError = error;
        if (attempt < attempts - 1 && isRetryablePostgresError(error)) {
          await new Promise((resolve) =>
            setTimeout(resolve, 300 * (attempt + 1)),
          );
        } else {
          break;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async transaction<T>(
    operation: (transaction: PostgresTransaction) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(this.transactionClient(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        this.logger.error(
          `Transaction rollback xatosi: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  private logQuery(sql: string, startedAt: number, rowCount: number) {
    const durationMs = Math.round(performance.now() - startedAt);
    if (durationMs < this.slowQueryMs) {
      return;
    }

    this.logger.warn(
      JSON.stringify({
        event: 'slow_query',
        duration_ms: durationMs,
        row_count: rowCount,
        query: summarizeSql(sql),
      }),
    );
  }

  private transactionClient(client: PoolClient): PostgresTransaction {
    return {
      query: async <T extends QueryResultRow = QueryResultRow>(
        sql: string,
        params: readonly unknown[] = [],
      ): Promise<T[]> => {
        const startedAt = performance.now();
        const result = await client.query<T>(sql, [...params]);
        this.logQuery(sql, startedAt, result.rowCount ?? result.rows.length);
        return result.rows;
      },
    };
  }

  getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function isRetryablePostgresError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  return RETRYABLE_POSTGRES_ERROR_CODES.has(code);
}

function summarizeSql(sql: string): string {
  return sql
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
    .replace(/'(?:''|[^'])*'/g, "'?'");
}

const RETRYABLE_POSTGRES_ERROR_CODES = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '08P01',
  '40001',
  '40P01',
  '53300',
  '57P01',
  '57P02',
  '57P03',
]);
