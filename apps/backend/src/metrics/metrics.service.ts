import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import { PostgresService } from '../infrastructure/postgres.service';
import { AppCacheService } from '../infrastructure/cache.service';

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: Registry;

  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDurationSeconds: Histogram<string>;
  readonly httpRequestsInFlight: Gauge<string>;
  readonly dbPoolConnections: Gauge<string>;
  readonly cacheMemoryEntries: Gauge<string>;
  readonly businessEventsTotal: Counter<string>;

  constructor(
    @Optional() private readonly postgresService?: PostgresService,
    @Optional() private readonly cacheService?: AppCacheService,
  ) {
    this.registry = new Registry();

    // Default Node.js / process telemetry (CPU, Heap, RSS, EventLoop, GC, Handles)
    try {
      collectDefaultMetrics({
        prefix: 'safaar_',
        register: this.registry,
      });
    } catch (error) {
      this.logger.warn(`Default metrics to'plashda ogohlantirish: ${error}`);
    }

    // HTTP Requests Total Counter
    this.httpRequestsTotal = new Counter({
      name: 'safaar_http_requests_total',
      help: 'Total number of HTTP requests processed by safaar backend',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // HTTP Request Duration Histogram (in seconds)
    this.httpRequestDurationSeconds = new Histogram({
      name: 'safaar_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // In-flight active HTTP requests
    this.httpRequestsInFlight = new Gauge({
      name: 'safaar_http_requests_in_flight',
      help: 'Current number of active in-flight HTTP requests',
      labelNames: ['method'],
      registers: [this.registry],
    });

    // PostgreSQL Connection Pool stats
    this.dbPoolConnections = new Gauge({
      name: 'safaar_db_pool_connections',
      help: 'PostgreSQL connection pool connections by state (total, idle, waiting)',
      labelNames: ['state'],
      registers: [this.registry],
      collect: () => {
        if (!this.postgresService) return;
        try {
          const stats = this.postgresService.getPoolStats();
          this.dbPoolConnections.set({ state: 'total' }, stats.totalCount);
          this.dbPoolConnections.set({ state: 'idle' }, stats.idleCount);
          this.dbPoolConnections.set({ state: 'waiting' }, stats.waitingCount);
        } catch (error) {
          this.logger.debug?.(`DB pool stats collection error: ${error}`);
        }
      },
    });

    // In-memory cache entries
    this.cacheMemoryEntries = new Gauge({
      name: 'safaar_cache_memory_entries',
      help: 'Current number of entries stored in the in-memory cache',
      registers: [this.registry],
      collect: () => {
        if (!this.cacheService) return;
        try {
          this.cacheMemoryEntries.set(this.cacheService.getMemorySize());
        } catch (error) {
          this.logger.debug?.(`Cache entries collection error: ${error}`);
        }
      },
    });

    // Business events counter (bookings, payments, auth)
    this.businessEventsTotal = new Counter({
      name: 'safaar_business_events_total',
      help: 'Total count of business operations (bookings, payments, registrations)',
      labelNames: ['type', 'status'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number | string,
    durationSeconds: number,
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route,
      status_code: String(statusCode),
    };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(
      labels,
      Math.max(0, durationSeconds),
    );
  }

  incrementInFlight(method: string): void {
    this.httpRequestsInFlight.inc({ method: method.toUpperCase() });
  }

  decrementInFlight(method: string): void {
    this.httpRequestsInFlight.dec({ method: method.toUpperCase() });
  }

  recordBusinessEvent(type: string, status: string): void {
    this.businessEventsTotal.inc({ type, status });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  clear(): void {
    this.registry.clear();
  }

  onModuleDestroy(): void {
    this.clear();
  }
}
