import { MetricsService } from './metrics.service';
import type { PostgresService } from '../infrastructure/postgres.service';
import type { AppCacheService } from '../infrastructure/cache.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let mockPostgres: Partial<PostgresService>;
  let mockCache: Partial<AppCacheService>;

  beforeEach(() => {
    mockPostgres = {
      getPoolStats: jest.fn().mockReturnValue({
        totalCount: 5,
        idleCount: 3,
        waitingCount: 1,
      }),
    };

    mockCache = {
      getMemorySize: jest.fn().mockReturnValue(42),
    };

    service = new MetricsService(
      mockPostgres as PostgresService,
      mockCache as AppCacheService,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('initializes registry and provides prometheus content type', () => {
    expect(service.contentType).toContain('text/plain');
  });

  it('records HTTP request total and duration histogram', async () => {
    service.recordHttpRequest('GET', '/v1/currency/rates', 200, 0.045);
    service.recordHttpRequest('POST', '/v1/auth/user/login', 401, 0.12);

    const output = await service.getMetrics();
    expect(output).toContain(
      'safaar_http_requests_total{method="GET",route="/v1/currency/rates",status_code="200"} 1',
    );
    expect(output).toContain(
      'safaar_http_requests_total{method="POST",route="/v1/auth/user/login",status_code="401"} 1',
    );
    expect(output).toContain('safaar_http_request_duration_seconds_bucket');
    expect(output).toContain('safaar_http_request_duration_seconds_count');
  });

  it('tracks in-flight requests gauge correctly', async () => {
    service.incrementInFlight('GET');
    service.incrementInFlight('GET');
    service.decrementInFlight('GET');
    service.incrementInFlight('POST');

    const output = await service.getMetrics();
    expect(output).toContain('safaar_http_requests_in_flight{method="GET"} 1');
    expect(output).toContain('safaar_http_requests_in_flight{method="POST"} 1');
  });

  it('records business events counter', async () => {
    service.recordBusinessEvent('booking_create', 'confirmed');
    service.recordBusinessEvent('booking_create', 'confirmed');
    service.recordBusinessEvent('payment_webhook', 'success');

    const output = await service.getMetrics();
    expect(output).toContain(
      'safaar_business_events_total{type="booking_create",status="confirmed"} 2',
    );
    expect(output).toContain(
      'safaar_business_events_total{type="payment_webhook",status="success"} 1',
    );
  });

  it('collects postgres connection pool statistics via collect callback', async () => {
    const output = await service.getMetrics();
    expect(mockPostgres.getPoolStats).toHaveBeenCalled();
    expect(output).toContain('safaar_db_pool_connections{state="total"} 5');
    expect(output).toContain('safaar_db_pool_connections{state="idle"} 3');
    expect(output).toContain('safaar_db_pool_connections{state="waiting"} 1');
  });

  it('collects in-memory cache entries count via collect callback', async () => {
    const output = await service.getMetrics();
    expect(mockCache.getMemorySize).toHaveBeenCalled();
    expect(output).toContain('safaar_cache_memory_entries 42');
  });

  it('handles optional postgres and cache services gracefully when undefined', async () => {
    const bareService = new MetricsService(undefined, undefined);
    const output = await bareService.getMetrics();
    expect(output).toContain('safaar_http_requests_total');
    bareService.onModuleDestroy();
  });
});
