import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta: {
    request_id: string;
  };
}

function requestIdFromContext(context: ExecutionContext): string {
  const request = context
    .switchToHttp()
    .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
  const header = request.headers['x-request-id'];
  return Array.isArray(header) ? header[0] : (header ?? 'local-request');
}

function requestFromContext(context: ExecutionContext): {
  headers: Record<string, string | string[] | undefined>;
  originalUrl?: string;
  url?: string;
  legacyApiPrefix?: boolean;
} {
  return context.switchToHttp().getRequest();
}

function isLegacyApiRequest(context: ExecutionContext): boolean {
  const request = requestFromContext(context);
  return Boolean(
    request.legacyApiPrefix ||
    request.originalUrl?.startsWith('/api') ||
    request.url?.startsWith('/api'),
  );
}

function isRawEndpoint(context: ExecutionContext): boolean {
  const request = requestFromContext(context);
  const path = request.originalUrl ?? request.url ?? '';
  return /^\/(?:v1\/)?metrics(?:\/|\?|$)/.test(path);
}

function legacyResponse(data: unknown, context: ExecutionContext): unknown {
  const request = requestFromContext(context);
  const originalUrl = request.originalUrl ?? request.url ?? '';

  if (
    /^\/api\/hotels(?:\?|$)/.test(originalUrl) &&
    typeof data === 'object' &&
    data !== null &&
    'items' in data &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return (data as { items: unknown[] }).items;
  }

  return data;
}

function isAlreadyEnveloped(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    ('data' in value || 'error' in value)
  );
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  T | ApiEnvelope<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | ApiEnvelope<T>> {
    return next.handle().pipe(
      map((data) => {
        if (isLegacyApiRequest(context)) {
          return legacyResponse(data, context) as T;
        }

        if (isRawEndpoint(context)) {
          return data;
        }

        if (isAlreadyEnveloped(data)) {
          return data;
        }

        return {
          success: true,
          data,
          meta: {
            request_id: requestIdFromContext(context),
          },
        };
      }),
    );
  }
}
