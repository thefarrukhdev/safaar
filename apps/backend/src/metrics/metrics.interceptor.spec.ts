import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';
import type { MetricsService } from './metrics.service';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let mockMetricsService: {
    incrementInFlight: jest.Mock;
    decrementInFlight: jest.Mock;
    recordHttpRequest: jest.Mock;
  };

  beforeEach(() => {
    mockMetricsService = {
      incrementInFlight: jest.fn(),
      decrementInFlight: jest.fn(),
      recordHttpRequest: jest.fn(),
    };

    interceptor = new MetricsInterceptor(
      mockMetricsService as unknown as MetricsService,
    );
  });

  function createMockContext(
    type: string,
    req: Record<string, unknown>,
    res: Record<string, unknown>,
  ): ExecutionContext {
    return {
      getType: () => type,
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  }

  it('bypasses non-http execution contexts', (done) => {
    const context = createMockContext('rpc', {}, {});
    const next = { handle: () => of('rpc-data') };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toBe('rpc-data');
      expect(mockMetricsService.incrementInFlight).not.toHaveBeenCalled();
      done();
    });
  });

  it('bypasses /metrics and /v1/metrics requests to avoid feedback loop', (done) => {
    const context = createMockContext(
      'http',
      { originalUrl: '/metrics', method: 'GET' },
      { statusCode: 200 },
    );
    const next = { handle: () => of('metrics-data') };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toBe('metrics-data');
      expect(mockMetricsService.incrementInFlight).not.toHaveBeenCalled();
      expect(mockMetricsService.recordHttpRequest).not.toHaveBeenCalled();
      done();
    });
  });

  it('records successful HTTP requests with in-flight tracking and duration', (done) => {
    const context = createMockContext(
      'http',
      {
        method: 'POST',
        originalUrl: '/v1/bookings',
        baseUrl: '/v1',
        route: { path: '/bookings' },
      },
      { statusCode: 201 },
    );
    const next = { handle: () => of({ booking_id: '123' }) };

    interceptor.intercept(context, next).subscribe({
      next: (result) => {
        expect(result).toEqual({ booking_id: '123' });
      },
      complete: () => {
        expect(mockMetricsService.incrementInFlight).toHaveBeenCalledWith(
          'POST',
        );
        expect(mockMetricsService.decrementInFlight).toHaveBeenCalledWith(
          'POST',
        );
        expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
          'POST',
          '/v1/bookings',
          201,
          expect.any(Number),
        );
        done();
      },
    });
  });

  it('records HttpException status code and decrements in-flight on failure', (done) => {
    const context = createMockContext(
      'http',
      {
        method: 'GET',
        originalUrl: '/v1/hotels/not-found',
        baseUrl: '/v1/hotels',
        route: { path: '/:id' },
      },
      { statusCode: 200 },
    );
    const error = new HttpException('Hotel not found', HttpStatus.NOT_FOUND);
    const next = { handle: () => throwError(() => error) };

    interceptor.intercept(context, next).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        expect(mockMetricsService.incrementInFlight).toHaveBeenCalledWith(
          'GET',
        );
        expect(mockMetricsService.decrementInFlight).toHaveBeenCalledWith(
          'GET',
        );
        expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
          'GET',
          '/v1/hotels/:id',
          404,
          expect.any(Number),
        );
        done();
      },
    });
  });

  it('records 500 status code for unhandled generic errors', (done) => {
    const context = createMockContext(
      'http',
      {
        method: 'GET',
        originalUrl: '/v1/crash',
      },
      { statusCode: 200 },
    );
    const error = new Error('Database unexpected failure');
    const next = { handle: () => throwError(() => error) };

    interceptor.intercept(context, next).subscribe({
      error: () => {
        expect(mockMetricsService.decrementInFlight).toHaveBeenCalledWith(
          'GET',
        );
        expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
          'GET',
          '/v1/crash',
          500,
          expect.any(Number),
        );
        done();
      },
    });
  });

  describe('normalizeRoute', () => {
    it('uses express route when available', () => {
      const route = interceptor.normalizeRoute({
        baseUrl: '/v1/hotels',
        route: { path: '/:id/rooms' },
      } as unknown as Parameters<typeof interceptor.normalizeRoute>[0]);
      expect(route).toBe('/v1/hotels/:id/rooms');
    });

    it('sanitizes query parameters', () => {
      const route = interceptor.normalizeRoute({
        originalUrl: '/v1/catalog/search?query=samarkand&page=2',
      } as unknown as Parameters<typeof interceptor.normalizeRoute>[0]);
      expect(route).toBe('/v1/catalog/search');
    });

    it('normalizes UUIDs to :id', () => {
      const route = interceptor.normalizeRoute({
        originalUrl: '/v1/bookings/550e8400-e29b-41d4-a716-446655440000',
      } as unknown as Parameters<typeof interceptor.normalizeRoute>[0]);
      expect(route).toBe('/v1/bookings/:id');
    });

    it('normalizes integer IDs to :id', () => {
      const route = interceptor.normalizeRoute({
        originalUrl: '/v1/hotels/987123/rooms/456',
      } as unknown as Parameters<typeof interceptor.normalizeRoute>[0]);
      expect(route).toBe('/v1/hotels/:id/rooms/:id');
    });

    it('normalizes long alphanumeric tokens or CUIDs to :id', () => {
      const route = interceptor.normalizeRoute({
        originalUrl: '/v1/users/cm123abc456def789xyz001',
      } as unknown as Parameters<typeof interceptor.normalizeRoute>[0]);
      expect(route).toBe('/v1/users/:id');
    });
  });
});
