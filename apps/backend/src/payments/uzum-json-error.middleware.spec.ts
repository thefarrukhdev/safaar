import { uzumJsonErrorMiddleware } from './uzum-json-error.middleware';
import { UZUM_ERROR, UZUM_STATUS } from './providers/uzum.provider';
import { UZUM_CHECKOUT_ERROR } from './providers/uzum-checkout.provider';

/**
 * `express.json()` body-parser'ning JSON parse xatosi ROUTE HANDLER'GA
 * umuman yetib bormaydi — shu sabab bu middleware alohida test qilinadi
 * (controller-darajasidagi testlar buni umuman qamrab ololmaydi, chunki
 * ular allaqachon parse qilingan `body` bilan ishlaydi).
 */

type Sent = { status?: number; body?: unknown };

function fakeRes(headersSent = false): { res: never; sent: Sent } {
  const sent: Sent = {};
  const res = {
    headersSent,
    status(code: number) {
      sent.status = code;
      return res;
    },
    json(body: unknown) {
      sent.body = body;
      return res;
    },
  };
  return { res: res as never, sent };
}

const jsonParseError = () => {
  const e = new SyntaxError('Unexpected token } in JSON');
  (e as unknown as { status: number; type: string }).status = 400;
  (e as unknown as { status: number; type: string }).type =
    'entity.parse.failed';
  return e;
};

const reqTo = (url: string) => ({ originalUrl: url, url }) as never;

describe('uzumJsonErrorMiddleware', () => {
  it('non-JSON-parse error -> passes through unchanged (next(err))', () => {
    const next = jest.fn();
    const { res } = fakeRes();
    uzumJsonErrorMiddleware(
      new Error('unrelated'),
      reqTo('/v1/uzum/checkout/callback'),
      res,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('JSON parse error on an unrelated route -> passes through unchanged', () => {
    const next = jest.fn();
    const { res, sent } = fakeRes();
    uzumJsonErrorMiddleware(jsonParseError(), reqTo('/v1/bookings'), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(sent.status).toBeUndefined();
  });

  it('JSON parse error on the Merchant webhook route -> Uzum Merchant contract shape (unchanged behavior)', () => {
    const next = jest.fn();
    const { res, sent } = fakeRes();
    uzumJsonErrorMiddleware(
      jsonParseError(),
      reqTo('/v1/uzum/webhook/check'),
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(sent.status).toBe(400);
    expect(sent.body).toEqual({
      serviceId: null,
      status: UZUM_STATUS.FAILED,
      errorCode: UZUM_ERROR.BAD_JSON,
    });
  });

  it('JSON parse error on the Checkout callback route -> Checkout error shape (new behavior)', () => {
    const next = jest.fn();
    const { res, sent } = fakeRes();
    uzumJsonErrorMiddleware(
      jsonParseError(),
      reqTo('/v1/uzum/checkout/callback'),
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(sent.status).toBe(400);
    expect(sent.body).toEqual({
      status: 'FAILED',
      code: UZUM_CHECKOUT_ERROR.MALFORMED_BODY,
    });
  });

  it('handles the legacy /api prefix rewrite for the Checkout callback route too', () => {
    const next = jest.fn();
    const { res, sent } = fakeRes();
    uzumJsonErrorMiddleware(
      jsonParseError(),
      reqTo('/api/uzum/checkout/callback'),
      res,
      next,
    );
    expect(sent.status).toBe(400);
    expect(sent.body).toMatchObject({
      code: UZUM_CHECKOUT_ERROR.MALFORMED_BODY,
    });
  });

  it('headers already sent -> passes through unchanged, never double-responds', () => {
    const next = jest.fn();
    const { res, sent } = fakeRes(true);
    uzumJsonErrorMiddleware(
      jsonParseError(),
      reqTo('/v1/uzum/checkout/callback'),
      res,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(sent.status).toBeUndefined();
  });
});
