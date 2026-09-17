import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

interface ErrorBody {
  code?: string;
  message?: string | string[];
  error?: string;
  fields?: unknown;
}

// Postgres SQLSTATE "22" sinfi — "Data Exception" (masalan 22P02 = noto'g'ri
// UUID/matn formati, 22007 = noto'g'ri sana formati) — bular DOIM mijoz
// yuborgan noto'g'ri qiymatdan kelib chiqadi, hech qachon server xatosi
// emas. Ilgari bular ParseUUIDPipe kabi validatsiya bo'lmagani sababli
// to'g'ridan-to'g'ri SQL qatlamigacha yetib borib, umumiy 500 sifatida
// chiqar edi — endi markazlashtirilgan holda 400'ga aylantiriladi.
function isPostgresDataException(exception: unknown): boolean {
  const code =
    typeof exception === 'object' && exception !== null && 'code' in exception
      ? String((exception as { code?: unknown }).code)
      : undefined;
  return Boolean(code && code.startsWith('22'));
}

function normalizeError(exception: unknown): {
  status: number;
  code: string;
  message: string;
  fields: unknown;
} {
  if (isPostgresDataException(exception)) {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: 'INVALID_INPUT',
      message: "So'rovdagi qiymatlardan biri noto'g'ri formatda",
      fields: null,
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'object' && response !== null) {
      const body = response as ErrorBody;
      const message = Array.isArray(body.message)
        ? body.message.join(', ')
        : (body.message ?? exception.message);

      return {
        status,
        code: body.code ?? body.error ?? 'REQUEST_ERROR',
        message,
        fields:
          body.fields ?? (Array.isArray(body.message) ? body.message : null),
      };
    }

    return {
      status,
      code: 'REQUEST_ERROR',
      message: String(response),
      fields: null,
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'Kutilmagan server xatosi',
    fields: null,
  };
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (!(exception instanceof HttpException)) {
      // Kutilmagan (nazoratsiz) xatolar — sabab bilinmasa production'da
      // debug qilib bo'lmaydi, shuning uchun to'liq stack trace logga
      // yoziladi.
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }
    const context = host.switchToHttp();
    const response = context.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const request = context.getRequest<{
      headers: Record<string, string | string[] | undefined>;
      method?: string;
      url?: string;
      ip?: string;
    }>();

    // 429 (ThrottlerException) — ThrottlerGuard bu xatoni request
    // PerformanceInterceptor'ga yetib kelmasdan OLDIN (Nest'da Guard'lar
    // Interceptor'lardan OLDIN ishlaydi) tashlaydi, shuning uchun
    // "status_code":429 hech qachon PerformanceInterceptor loglarida
    // ko'rinmaydi — production incident'ni (masalan "login 429 qaytaryapti")
    // sabab qaysi route/IP ekanini aniqlab bo'lmaydigan qilib qo'yardi. Bu
    // yagona, maxsus WARN qatori shu ko'rinmaslik bo'shlig'ini yopadi;
    // hech qanday response/behavior o'zgarmaydi, faqat kuzatuv qo'shiladi.
    if (exception instanceof HttpException && exception.getStatus() === 429) {
      this.logger.warn(
        JSON.stringify({
          event: 'rate_limited',
          method: request.method,
          path: request.url,
          ip: request.ip,
        }),
      );
    }
    const requestIdHeader = request.headers['x-request-id'];
    const requestId = Array.isArray(requestIdHeader)
      ? requestIdHeader[0]
      : (requestIdHeader ?? 'local-request');
    const error = normalizeError(exception);

    if (
      request.headers['x-legacy-api-prefix'] === 'true' ||
      (request as { legacyApiPrefix?: boolean; originalUrl?: string })
        .legacyApiPrefix ||
      (request as { originalUrl?: string }).originalUrl?.startsWith('/api')
    ) {
      response.status(error.status).json({
        statusCode: error.status,
        code: error.code,
        message: error.message,
        fields: error.fields,
        meta: {
          request_id: requestId,
        },
      });
      return;
    }

    response.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        fields: error.fields,
      },
      meta: {
        request_id: requestId,
      },
    });
  }
}
