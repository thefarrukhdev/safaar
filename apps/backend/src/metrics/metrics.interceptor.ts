import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

type RequestWithRoute = Request & {
  route?: { path?: string };
  baseUrl?: string;
};

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithRoute>();
    const response = http.getResponse<Response>();

    const path = request.originalUrl ?? request.url ?? '';
    if (this.isMetricsPath(path)) {
      return next.handle();
    }

    const method = (request.method || 'GET').toUpperCase();
    this.metrics.incrementInFlight(method);
    const startedAt = performance.now();

    let decremented = false;
    const decrement = () => {
      if (!decremented) {
        decremented = true;
        this.metrics.decrementInFlight(method);
      }
    };

    return next.handle().pipe(
      tap({
        next: () => {
          this.record(request, response, method, startedAt, undefined);
          decrement();
        },
        error: (error: unknown) => {
          this.record(request, response, method, startedAt, error);
          decrement();
        },
      }),
      finalize(() => {
        decrement();
      }),
    );
  }

  private isMetricsPath(path: string): boolean {
    return /^\/(?:v1\/)?metrics(?:\/|\?|$)/.test(path);
  }

  private record(
    request: RequestWithRoute,
    response: Response,
    method: string,
    startedAt: number,
    error: unknown,
  ): void {
    const durationSeconds = Math.max(0, (performance.now() - startedAt) / 1000);
    const statusCode = this.extractStatusCode(response, error);
    const route = this.normalizeRoute(request);

    this.metrics.recordHttpRequest(method, route, statusCode, durationSeconds);
  }

  private extractStatusCode(response: Response, error: unknown): number {
    if (error) {
      return error instanceof HttpException ? error.getStatus() : 500;
    }
    return response.statusCode || 200;
  }

  normalizeRoute(request: RequestWithRoute): string {
    const rawRoute = (request as unknown as Record<string, unknown>).route;
    const routeObj =
      typeof rawRoute === 'object' && rawRoute !== null
        ? (rawRoute as Record<string, unknown>)
        : undefined;
    const routePath =
      typeof routeObj?.path === 'string' ? routeObj.path : undefined;

    if (routePath) {
      const base = typeof request.baseUrl === 'string' ? request.baseUrl : '';
      const combined = `${base}${routePath}`.replace(/\/+/g, '/');
      return combined || '/';
    }

    const rawPath = (request.originalUrl ?? request.url ?? '/').split('?')[0];
    return (
      rawPath
        // Replace UUIDs: 12345678-1234-1234-1234-123456789012 -> :id
        .replace(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
          ':id',
        )
        // Replace numeric IDs: /123/ -> /:id/
        .replace(/(?<=\/)\d+(?=\/|$)/g, ':id')
        // Replace long alphanumeric IDs / hashes / cuid / nanoid (>= 20 chars)
        .replace(/(?<=\/)[a-zA-Z0-9_-]{20,}(?=\/|$)/g, ':id')
        // Clean multiple slashes
        .replace(/\/+/g, '/')
    );
  }
}
