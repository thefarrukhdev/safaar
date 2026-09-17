import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { HttpErrorFilter } from './http-error.filter';

function hostWith(
  headers: Record<string, string> = {},
  request: Record<string, unknown> = {},
) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ headers, ...request }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpErrorFilter (regression: H-5 malformed input -> 500 instead of 400)', () => {
  const filter = new HttpErrorFilter();

  it('turns a Postgres invalid-UUID error (22P02) into a 400, not a 500', () => {
    const { host, status, json } = hostWith();
    const pgError = Object.assign(
      new Error('invalid input syntax for type uuid: "not-a-uuid"'),
      { code: '22P02' },
    );

    filter.catch(pgError, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INVALID_INPUT' }) as {
          code: string;
        },
      }),
    );
  });

  it('turns any Postgres "22xxx" data-exception into a 400 (e.g. invalid date format)', () => {
    const { host, status } = hostWith();
    const pgError = Object.assign(new Error('invalid date format'), {
      code: '22007',
    });

    filter.catch(pgError, host);

    expect(status).toHaveBeenCalledWith(400);
  });

  it('still returns 500 for a genuinely unexpected error with no Postgres code', () => {
    const { host, status, json } = hostWith();

    filter.catch(new Error('kutilmagan xato'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL_ERROR' }) as {
          code: string;
        },
      }),
    );
  });

  it('still respects a deliberately thrown HttpException as before', () => {
    const { host, status, json } = hostWith();

    filter.catch(
      new BadRequestException({ code: 'MY_CODE', message: 'aniq xato' }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'MY_CODE',
          message: 'aniq xato',
        }) as { code: string; message: string },
      }),
    );
  });
});

describe('HttpErrorFilter (regression: 429/ThrottlerException was never logged anywhere)', () => {
  let filter: HttpErrorFilter;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpErrorFilter();
    warnSpy = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (filter as any).logger,
      'warn',
    );
  });

  it('logs a rate_limited WARN with method/path/ip when the guard throws ThrottlerException', () => {
    const { host, status } = hostWith(
      {},
      { method: 'POST', url: '/v1/auth/admin/login', ip: '203.0.113.7' },
    );

    filter.catch(new ThrottlerException(), host);

    expect(status).toHaveBeenCalledWith(429);
    expect(warnSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'rate_limited',
        method: 'POST',
        path: '/v1/auth/admin/login',
        ip: '203.0.113.7',
      }),
    );
  });

  it('does not log a rate_limited WARN for non-429 exceptions', () => {
    const { host } = hostWith(
      {},
      { method: 'POST', url: '/v1/auth/admin/login', ip: '203.0.113.7' },
    );

    filter.catch(new BadRequestException('bad input'), host);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
