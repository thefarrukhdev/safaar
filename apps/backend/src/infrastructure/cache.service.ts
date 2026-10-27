import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type CacheEntry = {
  value: string;
  expiresAt: number;
};

@Injectable()
export class AppCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AppCacheService.name);
  private readonly enabled: boolean;
  private readonly defaultTtlSeconds: number;
  private readonly memory = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly redis?: Redis;

  constructor(config: ConfigService) {
    this.enabled = stringFlag(config.get<string>('CACHE_ENABLED'), true);
    this.defaultTtlSeconds = toPositiveInt(
      config.get<string>('CACHE_DEFAULT_TTL_SECONDS'),
      300,
    );
    const redisUrl = config.get<string>('REDIS_URL');

    if (this.enabled && redisUrl) {
      this.redis = new Redis(redisUrl, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      this.redis.on('error', (error: Error) =>
        this.logger.warn(
          JSON.stringify({
            event: 'cache_redis_error',
            message: error.message,
          }),
        ),
      );
    }
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    producer: () => Promise<T> | T,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const pending = Promise.resolve()
      .then(producer)
      .then(async (value) => {
        await this.set(key, value, ttlSeconds);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, pending);
    return pending;
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.enabled) {
      return undefined;
    }

    const redisValue = await this.redisGet(key);
    if (redisValue !== undefined) {
      return JSON.parse(redisValue) as T;
    }

    const entry = this.memory.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() >= entry.expiresAt) {
      this.memory.delete(key);
      return undefined;
    }

    return JSON.parse(entry.value) as T;
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds = this.defaultTtlSeconds,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const serialized = JSON.stringify(value);
    const ttl = Math.max(1, ttlSeconds);
    const redisStored = await this.redisSet(key, serialized, ttl);
    if (redisStored) {
      return;
    }

    this.memory.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  /** Reads and deletes a short-lived value atomically when Redis is available. */
  async take<T>(key: string): Promise<T | undefined> {
    if (!this.enabled) {
      return undefined;
    }

    const redisValue = await this.redisGetDel(key);
    if (redisValue !== undefined) {
      return JSON.parse(redisValue) as T;
    }

    const entry = this.memory.get(key);
    this.memory.delete(key);
    if (!entry || Date.now() >= entry.expiresAt) {
      return undefined;
    }

    return JSON.parse(entry.value) as T;
  }

  async del(key: string): Promise<void> {
    this.memory.delete(key);
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch {
      // Redis fallback errors are already logged by the connection listener.
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
      }
    }
    for (const key of this.inFlight.keys()) {
      if (key.startsWith(prefix)) {
        this.inFlight.delete(key);
      }
    }

    if (!this.redis) {
      return;
    }

    try {
      await this.redisDelByPattern(pattern);
    } catch {
      // Redis fallback errors are already logged by the connection listener.
    }
  }

  async healthStatus(): Promise<
    'disabled' | 'memory' | 'ready' | 'unavailable'
  > {
    if (!this.enabled) {
      return 'disabled';
    }

    if (!this.redis) {
      return 'memory';
    }

    try {
      await this.ensureRedisConnected();
      await this.redis.ping();
      return 'ready';
    } catch {
      return 'unavailable';
    }
  }

  async onModuleDestroy() {
    if (!this.redis) {
      return;
    }

    try {
      if (this.redis.status === 'ready') {
        await this.redis.quit();
        return;
      }
    } catch {
      // Fall through to disconnect for half-open local/dev Redis connections.
    }

    this.redis.disconnect();
  }

  private async redisGet(key: string): Promise<string | undefined> {
    if (!this.redis) {
      return undefined;
    }

    try {
      await this.ensureRedisConnected();
      const value = await this.redis.get(key);
      return value ?? undefined;
    } catch {
      return undefined;
    }
  }

  private async redisSet(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      await this.ensureRedisConnected();
      await this.redis.set(key, value, 'EX', ttlSeconds);
      return true;
    } catch {
      return false;
    }
  }

  private async redisDelByPattern(pattern: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    await this.ensureRedisConnected();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        250,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  /**
   * `GETDEL` Redis 6.2.0+da qo'shilgan — production Redis (6.0.16) buni
   * qo'llab-quvvatlamaydi va xato tashlaydi, bu esa jimgina yutilib
   * (`catch`), `take()`ni HAR DOIM "topilmadi" deb noto'g'ri xulosa
   * qilishiga olib kelardi (masalan parol tiklash reset_token'i — Redis'da
   * to'g'ri saqlanardi, lekin hech qachon qayta o'qib bo'lmasdi — real
   * production'da topilgan xato). Shu sabab GET+DEL'ga eski, kengroq
   * qo'llab-quvvatlanadigan usulga o'tamiz. Bu ikkita alohida buyruq —
   * mutlaqo atomik emas, lekin bu yerdagi qiymatlar (bir martalik,
   * kriptografik tasodifiy token/kod, qisqa TTL) uchun mos: race oynasi
   * mikrosekundlarda va moliyaviy/hisoblagich ma'lumot emas.
   */
  private async redisGetDel(key: string): Promise<string | undefined> {
    if (!this.redis) {
      return undefined;
    }

    try {
      await this.ensureRedisConnected();
      const value = await this.redis.get(key);
      if (value === null) {
        return undefined;
      }
      await this.redis.del(key);
      return value;
    } catch {
      return undefined;
    }
  }

  private async ensureRedisConnected() {
    if (!this.redis || this.redis.status === 'ready') {
      return;
    }

    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
  }

  getMemorySize(): number {
    return this.memory.size;
  }
}

function stringFlag(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value).toLowerCase() === 'true';
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
