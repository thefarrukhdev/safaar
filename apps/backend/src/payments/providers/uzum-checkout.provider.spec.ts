import { getGlobalDispatcher } from 'undici';
import { hmacSha256 } from '../../auth/security';
import {
  UZUM_CHECKOUT_ERROR,
  UzumCheckoutError,
  UzumCheckoutProvider,
  buildUzumCheckoutProxyDispatcher,
  normalizeCheckoutCallback,
  pickDebugHeaders,
  redactProxyUrl,
  stableStringify,
} from './uzum-checkout.provider';
import {
  REAL_UZUM_CHECKOUT_COMPLETE_SUCCESS_FIXTURE,
  REAL_UZUM_CHECKOUT_FAIL_FIXTURE,
  REAL_UZUM_CHECKOUT_REFUND_FIXTURE,
  REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE,
} from './uzum-checkout.real-fixtures';

/**
 * Uzum'ning RASMIY Checkout imzo algoritmi bizda YO'Q. Bu testlar faqat
 * abstraction'ning FAIL-CLOSED xulqini va joy-egallovchi `hmac-sha256`
 * sxemasini tekshiradi — Uzum production kontrakti EMAS.
 */

const mkConfig = (cfg: Record<string, string | undefined>) =>
  ({ get: <T>(k: string) => cfg[k] as unknown as T }) as never;

const SIGN_KEY = 'test-callback-sign-key-0123456789';
const body = { orderId: 'A1', state: 'X', amount: '1000' };

describe('UzumCheckoutProvider.verifyCallback — FAIL-CLOSED', () => {
  it('sxema sozlanmagan (default) => har qanday callback rad etiladi', () => {
    const p = new UzumCheckoutProvider(mkConfig({}));
    expect(p.isCallbackVerificationConfigured()).toBe(false);
    expect(() => p.verifyCallback(body, { 'x-signature': 'anything' })).toThrow(
      UzumCheckoutError,
    );
    try {
      p.verifyCallback(body, { 'x-signature': 'anything' });
    } catch (e) {
      expect((e as UzumCheckoutError).code).toBe(
        UZUM_CHECKOUT_ERROR.VERIFICATION_NOT_CONFIGURED,
      );
    }
  });

  it('sign key bor, lekin scheme=none => hali ham fail-closed', () => {
    const p = new UzumCheckoutProvider(
      mkConfig({ UZUM_CHECKOUT_CALLBACK_SIGN_KEY: SIGN_KEY }),
    );
    expect(p.isCallbackVerificationConfigured()).toBe(false);
    expect(() => p.verifyCallback(body, {})).toThrow(UzumCheckoutError);
  });

  it('scheme=hmac-sha256, imzo header yo‘q => SIGNATURE_MISSING', () => {
    const p = new UzumCheckoutProvider(
      mkConfig({
        UZUM_CHECKOUT_CALLBACK_SIGN_KEY: SIGN_KEY,
        UZUM_CHECKOUT_SIGNATURE_SCHEME: 'hmac-sha256',
      }),
    );
    expect(p.isCallbackVerificationConfigured()).toBe(true);
    try {
      p.verifyCallback(body, {});
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as UzumCheckoutError).code).toBe(
        UZUM_CHECKOUT_ERROR.SIGNATURE_MISSING,
      );
    }
  });

  it('scheme=hmac-sha256, noto‘g‘ri imzo => SIGNATURE_INVALID', () => {
    const p = new UzumCheckoutProvider(
      mkConfig({
        UZUM_CHECKOUT_CALLBACK_SIGN_KEY: SIGN_KEY,
        UZUM_CHECKOUT_SIGNATURE_SCHEME: 'hmac-sha256',
      }),
    );
    try {
      p.verifyCallback(body, { 'x-signature': 'deadbeef' });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as UzumCheckoutError).code).toBe(
        UZUM_CHECKOUT_ERROR.SIGNATURE_INVALID,
      );
    }
  });

  it('scheme=hmac-sha256, to‘g‘ri imzo => o‘tadi (joy-egallovchi sxema)', () => {
    const p = new UzumCheckoutProvider(
      mkConfig({
        UZUM_CHECKOUT_CALLBACK_SIGN_KEY: SIGN_KEY,
        UZUM_CHECKOUT_SIGNATURE_SCHEME: 'hmac-sha256',
      }),
    );
    const sig = hmacSha256(stableStringify(body), SIGN_KEY);
    expect(() => p.verifyCallback(body, { 'x-signature': sig })).not.toThrow();
  });

  it('custom header nomi (UZUM_CHECKOUT_SIGNATURE_HEADER)', () => {
    const p = new UzumCheckoutProvider(
      mkConfig({
        UZUM_CHECKOUT_CALLBACK_SIGN_KEY: SIGN_KEY,
        UZUM_CHECKOUT_SIGNATURE_SCHEME: 'hmac-sha256',
        UZUM_CHECKOUT_SIGNATURE_HEADER: 'X-Uzum-Signature',
      }),
    );
    const sig = hmacSha256(stableStringify(body), SIGN_KEY);
    expect(() =>
      p.verifyCallback(body, { 'x-uzum-signature': sig }),
    ).not.toThrow();
    expect(() => p.verifyCallback(body, { 'x-signature': sig })).toThrow(); // eski header nomi endi qabul qilinmaydi
  });

  it('noma‘lum scheme nomi => fail-closed', () => {
    const p = new UzumCheckoutProvider(
      mkConfig({
        UZUM_CHECKOUT_CALLBACK_SIGN_KEY: SIGN_KEY,
        UZUM_CHECKOUT_SIGNATURE_SCHEME: 'rsa-magic',
      }),
    );
    expect(() => p.verifyCallback(body, { 'x-signature': 'x' })).toThrow(
      UzumCheckoutError,
    );
  });
});

describe('UzumCheckoutProvider.isConfigured (outbound /payment/register)', () => {
  it('base+terminalId+apiKey barchasi kerak (2026-09-11 sandboxda tasdiqlangan haqiqiy auth — merchantId ISHLATILMAYDI)', () => {
    expect(new UzumCheckoutProvider(mkConfig({})).isConfigured()).toBe(false);
    expect(
      new UzumCheckoutProvider(
        mkConfig({
          UZUM_CHECKOUT_BASE_URL: 'https://x',
          UZUM_CHECKOUT_TERMINAL_ID: 't',
        }),
      ).isConfigured(),
    ).toBe(false);
    expect(
      new UzumCheckoutProvider(
        mkConfig({
          UZUM_CHECKOUT_BASE_URL: 'https://x',
          UZUM_CHECKOUT_MERCHANT_ID: 'm',
          UZUM_CHECKOUT_API_KEY: 'k',
        }),
      ).isConfigured(),
      // merchantId + apiKey, lekin terminalId YO'Q -> hamon false
    ).toBe(false);
    expect(
      new UzumCheckoutProvider(
        mkConfig({
          UZUM_CHECKOUT_BASE_URL: 'https://x',
          UZUM_CHECKOUT_TERMINAL_ID: 't',
          UZUM_CHECKOUT_API_KEY: 'k',
        }),
      ).isConfigured(),
    ).toBe(true);
  });
});

describe('UzumCheckoutProvider — chiquvchi forward-proxy (statik IP)', () => {
  const PROXY = 'http://safaar:s3cr3t@100.105.86.75:3128';

  it('UZUM_CHECKOUT_HTTPS_PROXY unset => proxy sozlanmagan, dispatcher undefined', () => {
    const p = new UzumCheckoutProvider(mkConfig({}));
    expect(p.isOutboundProxyConfigured()).toBe(false);
    expect(p.outboundDispatcher()).toBeUndefined();
    expect(p.outboundProxyUrlForLog()).toBeUndefined();
  });

  it('UZUM_CHECKOUT_HTTPS_PROXY set => dispatcher qaytadi va KESHLANADI', () => {
    const p = new UzumCheckoutProvider(
      mkConfig({ UZUM_CHECKOUT_HTTPS_PROXY: PROXY }),
    );
    expect(p.isOutboundProxyConfigured()).toBe(true);
    const d1 = p.outboundDispatcher();
    const d2 = p.outboundDispatcher();
    expect(d1).toBeDefined();
    expect(d1).toBe(d2); // aynan bir instance (har chaqiruvda qayta qurilmaydi)
    expect(typeof (d1 as { dispatch?: unknown }).dispatch).toBe('function');
  });

  it('outboundProxyUrlForLog() — credential (userinfo) YASHIRILADI', () => {
    const p = new UzumCheckoutProvider(
      mkConfig({ UZUM_CHECKOUT_HTTPS_PROXY: PROXY }),
    );
    const shown = p.outboundProxyUrlForLog();
    expect(shown).toBeDefined();
    expect(shown).not.toContain('s3cr3t');
    expect(shown).not.toContain('safaar:s3cr3t');
    expect(shown).toContain('100.105.86.75:3128');
  });

  it('proxy — global fetch dispatcher ALMASHTIRILMAYDI (faqat per-request)', () => {
    const before = getGlobalDispatcher();
    const p = new UzumCheckoutProvider(
      mkConfig({ UZUM_CHECKOUT_HTTPS_PROXY: PROXY }),
    );
    p.outboundDispatcher();
    expect(getGlobalDispatcher()).toBe(before);
  });

  it('yaroqsiz proxy URL => PROXY_MISCONFIGURED (xom qiymat log qilinmaydi)', () => {
    const p = new UzumCheckoutProvider(
      mkConfig({ UZUM_CHECKOUT_HTTPS_PROXY: 'not a url' }),
    );
    expect(() => p.outboundDispatcher()).toThrow(UzumCheckoutError);
    try {
      p.outboundDispatcher();
    } catch (e) {
      expect((e as UzumCheckoutError).code).toBe(
        UZUM_CHECKOUT_ERROR.PROXY_MISCONFIGURED,
      );
    }
  });

  it('buildUzumCheckoutProxyDispatcher — http/https bo‘lmagan sxema rad etiladi', () => {
    expect(() =>
      buildUzumCheckoutProxyDispatcher('socks5://100.105.86.75:1080'),
    ).toThrow(UzumCheckoutError);
  });

  it('redactProxyUrl — parol chiqmaydi; yaroqsiz URL xom qaytmaydi', () => {
    expect(redactProxyUrl(PROXY)).not.toContain('s3cr3t');
    expect(redactProxyUrl(PROXY)).toContain('100.105.86.75:3128');
    expect(redactProxyUrl('%%%bogus')).toBe('<invalid-proxy-url>');
  });
});

describe('UzumCheckoutProvider outbound — config gating (NOT_CONFIGURED, tashqi so‘rov yo‘q)', () => {
  const registerInput = {
    bookingId: 'booking-1',
    orderNumber: 'UZB-1',
    merchantOperationId: 'payment-1',
    amountSom: 150000,
    currency: 'UZS',
    successUrl: 'https://safaar.uz/booking/booking-1?payment=success',
    failureUrl: 'https://safaar.uz/booking/booking-1?payment=failed',
  };

  it('env umuman sozlanmagan => NOT_CONFIGURED', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const p = new UzumCheckoutProvider(mkConfig({}));
    await expect(p.register(registerInput)).rejects.toMatchObject({
      code: UZUM_CHECKOUT_ERROR.NOT_CONFIGURED,
    });
    await expect(p.getOrderStatus('order-1')).rejects.toMatchObject({
      code: UZUM_CHECKOUT_ERROR.NOT_CONFIGURED,
    });
    await expect(p.getOperationState('order-1', 'op-1')).rejects.toMatchObject({
      code: UZUM_CHECKOUT_ERROR.NOT_CONFIGURED,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('auth (terminal/apiKey) bor, lekin fiskal (SPIC/packageCode/VAT/TIN-PINFL) yo‘q => NOT_CONFIGURED, register tashqi so‘rov yubormaydi', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const p = new UzumCheckoutProvider(
      mkConfig({
        UZUM_CHECKOUT_BASE_URL: 'https://checkout.example',
        UZUM_CHECKOUT_TERMINAL_ID: 't',
        UZUM_CHECKOUT_API_KEY: 'k',
      }),
    );
    await expect(p.register(registerInput)).rejects.toMatchObject({
      code: UZUM_CHECKOUT_ERROR.NOT_CONFIGURED,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('TIN va PINFL ikkalasi HAM berilsa => fiskal "sozlanmagan" deb hisoblanadi (Uzum ikkalasini birga rad etadi)', () => {
    const p = new UzumCheckoutProvider(
      mkConfig({
        UZUM_CHECKOUT_BASE_URL: 'https://checkout.example',
        UZUM_CHECKOUT_TERMINAL_ID: 't',
        UZUM_CHECKOUT_API_KEY: 'k',
        UZUM_CHECKOUT_SPIC: '10703999001000000',
        UZUM_CHECKOUT_PACKAGE_CODE: '1495084',
        UZUM_CHECKOUT_VAT_PERCENT: '12',
        UZUM_CHECKOUT_RECEIPT_TIN: '123456789',
        UZUM_CHECKOUT_RECEIPT_PINFL: '11111111111111',
      }),
    );
    expect(p.isFiscalConfigured()).toBe(false);
  });

  it('refund() — auth sozlanmagan => NOT_CONFIGURED, tashqi so‘rov yo‘q', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('fetch chaqirilmasligi kerak edi');
    });
    const p = new UzumCheckoutProvider(mkConfig({}));
    await expect(
      p.refund({ orderId: 'order-1', amountSom: 1500 }),
    ).rejects.toMatchObject({ code: UZUM_CHECKOUT_ERROR.NOT_CONFIGURED });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

/** To‘liq (auth + fiskal) konfiguratsiya — 2026-09-11 sandboxda tasdiqlangan real qiymatlar EMAS, faqat TEST fixture'lari. */
const FULL_UZUM_CONFIG: Record<string, string> = {
  UZUM_CHECKOUT_BASE_URL: 'https://checkout.example',
  UZUM_CHECKOUT_TERMINAL_ID: 'terminal-test',
  UZUM_CHECKOUT_API_KEY: 'api-key-test',
  UZUM_CHECKOUT_SPIC: '10703999001000000',
  UZUM_CHECKOUT_PACKAGE_CODE: '1495084',
  UZUM_CHECKOUT_VAT_PERCENT: '12',
  UZUM_CHECKOUT_RECEIPT_PINFL: '11111111111111',
};

function mockFetchOnce(body: unknown, status = 200) {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

/** So‘ralgan `register()` tanasining test uchun kutilayotgan shakli. */
interface RegisterRequestBody {
  currency: number;
  amount: number;
  viewType: string;
  paymentParams: { payType: string; force3ds: boolean };
  successUrl: string;
  failureUrl: string;
  merchantParams: {
    cart: {
      receiptType: string;
      total: number;
      items: Array<{
        receiptParams: {
          spic?: string;
          packageCode?: string;
          vatPercent?: number;
          TIN?: string;
          PINFL?: string;
        };
      }>;
    };
  };
}

function parseRequestBody(init: RequestInit): RegisterRequestBody {
  return JSON.parse(init.body as string) as RegisterRequestBody;
}

describe('UzumCheckoutProvider.register — real wire-format (mocked fetch, hech qanday haqiqiy tarmoq so‘rovi yo‘q)', () => {
  const registerInput = {
    bookingId: 'booking-1',
    orderNumber: 'UZB-1',
    merchantOperationId: 'payment-1',
    amountSom: 1000,
    currency: 'UZS',
    successUrl: 'https://safaar.uz/booking/booking-1?payment=success',
    failureUrl: 'https://safaar.uz/booking/booking-1?payment=failed',
  };

  afterEach(() => jest.restoreAllMocks());

  it('muvaffaqiyatli javob => orderId/paymentUrl qaytaradi, so‘rov shakli rasmiy sxemaga mos', async () => {
    const fetchSpy = mockFetchOnce({
      errorCode: 0,
      message: null,
      result: {
        orderId: 'order-abc',
        paymentRedirectUrl: 'https://checkout.ipt-merch.com/?orderId=order-abc',
      },
    });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    const result = await p.register(registerInput);
    expect(result.orderId).toBe('order-abc');
    expect(result.paymentUrl).toBe(
      'https://checkout.ipt-merch.com/?orderId=order-abc',
    );
    expect(typeof result.raw).toBe('object');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://checkout.example/api/v1/payment/register');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Terminal-Id']).toBe('terminal-test');
    expect(headers['X-Api-Key']).toBe('api-key-test');
    expect(headers['Content-Language']).toBe('uz-UZ');

    const body = parseRequestBody(init as RequestInit);
    expect(body.currency).toBe(860); // ISO-4217 RAQAMLI, "UZS" emas
    expect(body.amount).toBe(100_000); // TIYIN: 1000 so'm * 100
    expect(body.viewType).toBe('REDIRECT');
    expect(body.paymentParams).toEqual({ payType: 'ONE_STEP', force3ds: true });
    expect(body.successUrl).toBe(registerInput.successUrl);
    expect(body.failureUrl).toBe(registerInput.failureUrl);
    const cart = body.merchantParams.cart;
    expect(cart.receiptType).toBe('PURCHASE');
    expect(cart.total).toBe(100_000);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].receiptParams).toEqual({
      spic: '10703999001000000',
      packageCode: '1495084',
      vatPercent: 12,
      PINFL: '11111111111111',
    });
  });

  it('TIN sozlangan bo‘lsa (PINFL emas) — receiptParams.TIN yuboriladi, PINFL yo‘q', async () => {
    const fetchSpy = mockFetchOnce({
      errorCode: 0,
      result: { orderId: 'o', paymentRedirectUrl: 'https://x' },
    });
    const p = new UzumCheckoutProvider(
      mkConfig({
        ...FULL_UZUM_CONFIG,
        UZUM_CHECKOUT_RECEIPT_PINFL: '',
        UZUM_CHECKOUT_RECEIPT_TIN: '123456789',
      }),
    );
    await p.register(registerInput);
    const [, init] = fetchSpy.mock.calls[0];
    const body = parseRequestBody(init as RequestInit);
    expect(body.merchantParams.cart.items[0].receiptParams.TIN).toBe(
      '123456789',
    );
    expect(
      body.merchantParams.cart.items[0].receiptParams.PINFL,
    ).toBeUndefined();
  });

  it("Uzum errorCode!=0 (masalan 3055 IKPU topilmadi) => REGISTER_FAILED, xom xabar UzumCheckoutError message'ida saqlanmaydi", async () => {
    mockFetchOnce({
      errorCode: 3055,
      message:
        '{"spics":[{"spic":"10204001010000000","reason":"IKPU code is not found in the catalog"}]}',
      result: null,
    });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await expect(p.register(registerInput)).rejects.toMatchObject({
      code: UZUM_CHECKOUT_ERROR.REGISTER_FAILED,
    });
  });

  it('HTTP tarmoq xatosi (fetch throw) => REGISTER_FAILED', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('ECONNRESET'));
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await expect(p.register(registerInput)).rejects.toMatchObject({
      code: UZUM_CHECKOUT_ERROR.REGISTER_FAILED,
    });
  });

  it('qo‘llab-quvvatlanmaydigan valyuta => REGISTER_FAILED, fetch UMUMAN chaqirilmaydi', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await expect(
      p.register({ ...registerInput, currency: 'GBP' }),
    ).rejects.toMatchObject({ code: UZUM_CHECKOUT_ERROR.REGISTER_FAILED });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('javobda orderId yoki paymentRedirectUrl yo‘q => REGISTER_FAILED', async () => {
    mockFetchOnce({ errorCode: 0, result: {} });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await expect(p.register(registerInput)).rejects.toMatchObject({
      code: UZUM_CHECKOUT_ERROR.REGISTER_FAILED,
    });
  });
});

describe('UzumCheckoutProvider.getOrderStatus — real wire-format (mocked fetch)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('status=COMPLETED => PAID, completedAmount tiyin->so‘m aylantiriladi', async () => {
    mockFetchOnce({
      errorCode: 0,
      result: {
        orderId: 'order-abc',
        status: 'COMPLETED',
        completedAmount: 100_000,
        operations: [{ operationType: 'COMPLETE', state: 'SUCCESS' }],
      },
    });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    const status = await p.getOrderStatus('order-abc');
    expect(status.state).toBe('PAID');
    expect(status.amountSom).toBe(1000);
    expect(status.rawStatus).toBe('COMPLETED');
  });

  it('status=REGISTERED (hali to‘lanmagan) => PENDING, amountSom=null', async () => {
    mockFetchOnce({
      errorCode: 0,
      result: { orderId: 'o', status: 'REGISTERED', completedAmount: 0 },
    });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    const status = await p.getOrderStatus('o');
    expect(status.state).toBe('PENDING');
    expect(status.amountSom).toBeNull();
  });

  it('hech qachon ko‘rilmagan status qiymati => xavfsiz UNKNOWN (taxmin qilinmaydi)', async () => {
    mockFetchOnce({
      errorCode: 0,
      result: {
        orderId: 'o',
        status: 'SOME_FUTURE_STATUS',
        completedAmount: 0,
      },
    });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    const status = await p.getOrderStatus('o');
    expect(status.state).toBe('UNKNOWN');
  });

  it('status=DECLINED (rasmiy AcquiringStatus qiymati) => FAILED', async () => {
    mockFetchOnce({
      errorCode: 0,
      result: { orderId: 'o', status: 'DECLINED', completedAmount: 0 },
    });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    const status = await p.getOrderStatus('o');
    expect(status.state).toBe('FAILED');
  });

  it('status=REFUNDED/REVERSED/AUTHORIZED/TOP_UP_COMPLETED (rasmiy qiymatlar) => ATAYLAB UNKNOWN (PAID/FAILED bilan aralashtirilmaydi)', async () => {
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    for (const rawStatus of [
      'REFUNDED',
      'REVERSED',
      'AUTHORIZED',
      'TOP_UP_COMPLETED',
    ]) {
      mockFetchOnce({
        errorCode: 0,
        result: { orderId: 'o', status: rawStatus, completedAmount: 0 },
      });
      const status = await p.getOrderStatus('o');
      expect(status.state).toBe('UNKNOWN');
    }
  });

  it('Uzum errorCode!=0 => STATUS_FAILED', async () => {
    mockFetchOnce({ errorCode: 1000, result: null });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await expect(p.getOrderStatus('o')).rejects.toMatchObject({
      code: UZUM_CHECKOUT_ERROR.STATUS_FAILED,
    });
  });
});

describe('UzumCheckoutProvider.getOperationState — real wire-format (mocked fetch)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('operationId bo‘sh => tashqi so‘rovsiz STATUS_FAILED (Uzum operationId\'siz "Field required" beradi — bu yerda oldindan tekshiriladi)', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await expect(p.getOperationState('order-1', '')).rejects.toMatchObject({
      code: UZUM_CHECKOUT_ERROR.STATUS_FAILED,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("operationType=COMPLETE + state=SUCCESS => PAID (xuddi callback STATE_MAP'i bilan bir xil xaritalash)", async () => {
    mockFetchOnce({
      errorCode: 0,
      result: {
        operation: {
          operationId: 'op-1',
          operationType: 'COMPLETE',
          state: 'SUCCESS',
        },
      },
    });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    const status = await p.getOperationState('order-1', 'op-1');
    expect(status.state).toBe('PAID');
    expect(status.amountSom).toBeNull(); // getOperationState javobida summa yo'q
  });

  it('so‘rov tanasi {orderId, operationId} ikkalasini ham o‘z ichiga oladi', async () => {
    const fetchSpy = mockFetchOnce({
      errorCode: 0,
      result: { operation: { operationType: 'COMPLETE', state: 'SUCCESS' } },
    });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await p.getOperationState('order-1', 'op-1');
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string) as unknown;
    expect(body).toEqual({ orderId: 'order-1', operationId: 'op-1' });
  });
});

interface RefundRequestBody {
  orderId: string;
  amount: number;
  cart?: {
    total: number;
    items: Array<{
      productId: string;
      quantity: number;
      receiptParams: Record<string, unknown>;
    }>;
  };
}

/**
 * `getOrderStatus()`ning navbatdagi chaqiruviga (refund fiskal cart.total
 * uchun ICHKI chaqiradigan) mock javob beradi.
 */
function mockGetOrderStatusOnceFor(completedAmountTiyin: number) {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        errorCode: 0,
        result: {
          orderId: 'irrelevant',
          status: 'COMPLETED',
          completedAmount: completedAmountTiyin,
        },
      }),
  } as Response);
}

describe('UzumCheckoutProvider.refund — real wire-format (mocked fetch, rasmiy /api/v1/acquiring/refund kontrakti)', () => {
  afterEach(() => jest.restoreAllMocks());

  it("muvaffaqiyatli javob => operationId qaytaradi; ICHKI getOrderStatus() cart.total uchun original completedAmount'ni oladi (2026-09-11 sandboxda tasdiqlangan: cart.total = ORIGINAL to'liq summa, refund summasi EMAS)", async () => {
    mockGetOrderStatusOnceFor(100_000); // original 1000 so'm
    const refundFetchSpy = mockFetchOnce({
      errorCode: 0,
      message: null,
      result: { operationId: 'refund-op-1' },
    });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    const result = await p.refund({
      orderId: 'order-abc',
      amountSom: 300, // QISMAN refund
      operationId: 'my-idem-key-1',
      originalProductId: 'payment-real-1',
    });
    expect(result.orderId).toBe('order-abc');
    expect(result.refundId).toBe('refund-op-1');
    expect(result.rawStatus).toBe('REQUESTED');

    // `jest.spyOn` bir xil `fetch`ni ikkinchi marta spy qilganda O'SHA BIR
    // spy instance qaytadi — shuning uchun `.mock.calls` ikkalasini ham
    // (getOrderStatus + refund) jamlaydi: [0]=getOrderStatus, [1]=refund.
    expect(refundFetchSpy).toHaveBeenCalledTimes(2);
    const [url, init] = refundFetchSpy.mock.calls[1];
    expect(url).toBe('https://checkout.example/api/v1/acquiring/refund');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Operation-Id']).toBe('my-idem-key-1');
    expect(headers['X-Terminal-Id']).toBe('terminal-test');
    expect(headers['X-Api-Key']).toBe('api-key-test');

    const body = JSON.parse(
      (init as RequestInit).body as string,
    ) as RefundRequestBody;
    expect(body.orderId).toBe('order-abc');
    expect(body.amount).toBe(30_000); // 300 so'm (QISMAN) -> 30000 tiyin
    // cart.total — ORIGINAL to'liq summa (100000), QISMAN refund summasi
    // (30000) EMAS — aynan shu farq sandboxda `errorCode 3059`ni tuzatdi.
    expect(body.cart?.total).toBe(100_000);
    expect(body.cart?.items?.[0]?.productId).toBe('payment-real-1');
    expect(body.cart?.items?.[0]?.quantity).toBe(1);
    expect(body.cart?.items?.[0]?.receiptParams?.PINFL).toBe('11111111111111');
  });

  it('operationId berilmasa => avtomatik randomUUID generatsiya qilinadi (har safar boshqacha)', async () => {
    mockGetOrderStatusOnceFor(10_000);
    const fetchSpy1 = mockFetchOnce({
      errorCode: 0,
      result: { operationId: 'op-1' },
    });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await p.refund({
      orderId: 'order-1',
      amountSom: 100,
      originalProductId: 'payment-1',
    });
    const [, init1] = fetchSpy1.mock.calls[1]; // [0]=ichki getOrderStatus, [1]=refund
    const opId1 = ((init1 as RequestInit).headers as Record<string, string>)[
      'X-Operation-Id'
    ];
    expect(opId1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("originalProductId berilmasa (fiskal yoqilgan holda) => tashqi refund so'rovisiz REFUND_FAILED (taxminiy productId yubormaydi)", async () => {
    mockGetOrderStatusOnceFor(10_000);
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await expect(
      p.refund({ orderId: 'order-1', amountSom: 100 }),
    ).rejects.toMatchObject({ code: UZUM_CHECKOUT_ERROR.REFUND_FAILED });
  });

  it('fiskal konfiguratsiya YO‘Q bo‘lsa ham refund bloklanmaydi — faqat cart (va ichki getOrderStatus chaqiruvi) qo‘shilmaydi (rasmiy: cart faqat autofiskalizatsiyada shart)', async () => {
    const fetchSpy = mockFetchOnce({
      errorCode: 0,
      result: { operationId: 'op-2' },
    });
    const authOnlyConfig = {
      UZUM_CHECKOUT_BASE_URL: 'https://checkout.example',
      UZUM_CHECKOUT_TERMINAL_ID: 'terminal-test',
      UZUM_CHECKOUT_API_KEY: 'api-key-test',
    };
    const p = new UzumCheckoutProvider(mkConfig(authOnlyConfig));
    const result = await p.refund({ orderId: 'order-1', amountSom: 100 });
    expect(result.refundId).toBe('op-2');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // getOrderStatus chaqirilmadi
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(
      (init as RequestInit).body as string,
    ) as RefundRequestBody;
    expect(body.cart).toBeUndefined();
  });

  it('amountSom <= 0 yoki NaN => tashqi so‘rovsiz REFUND_FAILED', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('fetch chaqirilmasligi kerak edi');
    });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await expect(
      p.refund({ orderId: 'order-1', amountSom: 0 }),
    ).rejects.toMatchObject({ code: UZUM_CHECKOUT_ERROR.REFUND_FAILED });
    await expect(
      p.refund({ orderId: 'order-1', amountSom: -50 }),
    ).rejects.toMatchObject({ code: UZUM_CHECKOUT_ERROR.REFUND_FAILED });
    await expect(
      p.refund({ orderId: 'order-1', amountSom: NaN }),
    ).rejects.toMatchObject({ code: UZUM_CHECKOUT_ERROR.REFUND_FAILED });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('Uzum errorCode!=0 => REFUND_FAILED (xom message/result log qilinmaydi)', async () => {
    mockGetOrderStatusOnceFor(10_000);
    mockFetchOnce({ errorCode: 3009, result: null });
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await expect(
      p.refund({
        orderId: 'order-1',
        amountSom: 100,
        originalProductId: 'payment-1',
      }),
    ).rejects.toMatchObject({ code: UZUM_CHECKOUT_ERROR.REFUND_FAILED });
  });

  it('tarmoq xatosi (refund so‘rovining o‘zida) => REFUND_FAILED', async () => {
    mockGetOrderStatusOnceFor(10_000);
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('ECONNRESET'));
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await expect(
      p.refund({
        orderId: 'order-1',
        amountSom: 100,
        originalProductId: 'payment-1',
      }),
    ).rejects.toMatchObject({ code: UZUM_CHECKOUT_ERROR.REFUND_FAILED });
  });

  it("ICHKI getOrderStatus() o'zi muvaffaqiyatsiz (tarmoq) => STATUS_FAILED (refund so'rovining o'zi hech qachon yuborilmaydi)", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('ECONNRESET'));
    const p = new UzumCheckoutProvider(mkConfig(FULL_UZUM_CONFIG));
    await expect(
      p.refund({
        orderId: 'order-1',
        amountSom: 100,
        originalProductId: 'payment-1',
      }),
    ).rejects.toMatchObject({ code: UZUM_CHECKOUT_ERROR.STATUS_FAILED });
    expect(fetchSpy).toHaveBeenCalledTimes(1); // faqat getOrderStatus
  });
});

describe('UzumCheckoutProvider.signatureHeaderName', () => {
  it('default => x-signature', () => {
    expect(new UzumCheckoutProvider(mkConfig({})).signatureHeaderName()).toBe(
      'x-signature',
    );
  });
  it('custom sozlangan bo‘lsa — kichik harfga normallashtirilgan holda qaytadi', () => {
    expect(
      new UzumCheckoutProvider(
        mkConfig({ UZUM_CHECKOUT_SIGNATURE_HEADER: 'X-Uzum-Signature' }),
      ).signatureHeaderName(),
    ).toBe('x-uzum-signature');
  });
});

describe('normalizeCheckoutCallback — audit-only qo‘shimcha maydonlar (operationType/rrn/bindingId)', () => {
  it('mavjud bo‘lsa o‘qiladi (camelCase)', () => {
    const n = normalizeCheckoutCallback({
      orderId: 'A1',
      operationType: 'PAYMENT',
      rrn: '123456789012',
      bindingId: 'bind-1',
    });
    expect(n.operationType).toBe('PAYMENT');
    expect(n.rrn).toBe('123456789012');
    expect(n.bindingId).toBe('bind-1');
  });

  it('mavjud bo‘lsa o‘qiladi (snake_case / RRN)', () => {
    const n = normalizeCheckoutCallback({
      order_id: 'A1',
      operation_type: 'REFUND',
      RRN: '000000000001',
      binding_id: 'bind-2',
    });
    expect(n.operationType).toBe('REFUND');
    expect(n.rrn).toBe('000000000001');
    expect(n.bindingId).toBe('bind-2');
  });

  it('yo‘q bo‘lsa undefined (talab qilinmaydi)', () => {
    const n = normalizeCheckoutCallback({ orderId: 'A1' });
    expect(n.operationType).toBeUndefined();
    expect(n.rrn).toBeUndefined();
    expect(n.bindingId).toBeUndefined();
  });

  it('hech bir maydon xom payloaddan (`raw`) tashlab yuborilmaydi — noma‘lum/kelajakdagi maydonlar ham', () => {
    const raw = {
      orderId: 'A1',
      totallyUnknownFutureField: { nested: [1, 2, 3] },
      anotherOne: 42,
    };
    const n = normalizeCheckoutCallback(raw);
    expect(n.raw).toEqual(raw);
  });
});

describe('normalizeCheckoutCallback — REAL (uchinchi-tomon manba orqali topilgan) Uzum Checkout callback shakli', () => {
  it('AUTHORIZE:SUCCESS -> PAID (bir bosqichli to‘lov muvaffaqiyatli)', () => {
    const n = normalizeCheckoutCallback(REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE);
    expect(n.state).toBe('PAID');
    expect(n.orderId).toBe(REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE.orderId);
    expect(n.orderNumber).toBe(REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE.orderNumber);
    expect(n.operationType).toBe('AUTHORIZE');
    expect(n.rrn).toBe('123456789012');
    // Real shaklda amount/currency umuman yo'q -> NaN / default UZS.
    expect(Number.isNaN(n.amountSom)).toBe(true);
    expect(n.currency).toBe('UZS');
  });

  it('AUTHORIZE:FAIL -> FAILED', () => {
    const n = normalizeCheckoutCallback(REAL_UZUM_CHECKOUT_FAIL_FIXTURE);
    expect(n.state).toBe('FAILED');
  });

  it('COMPLETE:SUCCESS -> PAID (ikki bosqichli to‘lovning tasdiqlash bosqichi)', () => {
    const n = normalizeCheckoutCallback(
      REAL_UZUM_CHECKOUT_COMPLETE_SUCCESS_FIXTURE,
    );
    expect(n.state).toBe('PAID');
    expect(n.bindingId).toBe('binding-qa-fixture-04');
  });

  it('REFUND:SUCCESS -> UNKNOWN (ATAYLAB PAID EMAS — pul CHIQISHI, booking holatiga ta‘sir qilmasligi kerak)', () => {
    const n = normalizeCheckoutCallback(REAL_UZUM_CHECKOUT_REFUND_FIXTURE);
    expect(n.state).toBe('UNKNOWN');
    expect(n.operationType).toBe('REFUND');
  });

  it('to‘liq xom payload hech narsa yo‘qotmasdan saqlanadi (real fixture uchun ham)', () => {
    const n = normalizeCheckoutCallback(REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE);
    expect(n.raw).toEqual(REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE);
  });
});

describe('pickDebugHeaders — faqat kichik xavfsiz allowlist, imzo/authorization/cookie hech qachon', () => {
  it('allowlist’dagi sarlavhalarni oladi', () => {
    const picked = pickDebugHeaders({
      'content-type': 'application/json',
      'user-agent': 'UzumBot/1.0',
      'x-request-id': 'req-1',
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '1.2.3.4',
    });
    expect(picked).toEqual({
      'content-type': 'application/json',
      'user-agent': 'UzumBot/1.0',
      'x-request-id': 'req-1',
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '1.2.3.4',
    });
  });

  it('authorization/cookie hech qachon qaytarilmaydi, ular allowlist’da bo‘lmasa ham', () => {
    const picked = pickDebugHeaders({
      authorization: 'Bearer secret',
      cookie: 'session=secret',
      'content-type': 'application/json',
    });
    expect(picked).toEqual({ 'content-type': 'application/json' });
  });

  it('qo‘shimcha istisno ro‘yxati (imzo sarlavhasi) ham chetlab o‘tiladi', () => {
    const picked = pickDebugHeaders(
      { 'x-signature': 'abc123', 'content-type': 'application/json' },
      ['x-signature'],
    );
    expect(picked).toEqual({ 'content-type': 'application/json' });
  });

  it('array qiymatli sarlavha bo‘lsa birinchisini oladi', () => {
    const picked = pickDebugHeaders({ 'x-request-id': ['a', 'b'] });
    expect(picked['x-request-id']).toBe('a');
  });

  it('mavjud bo‘lmagan/bo‘sh sarlavhalar chiqarilmaydi', () => {
    const picked = pickDebugHeaders({ 'x-request-id': '' });
    expect(picked).toEqual({});
  });
});

describe('stableStringify — deterministik (kalitlar tartiblangan)', () => {
  it('kalit tartibidan qat‘i nazar bir xil natija', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(
      stableStringify({ a: 2, b: 1 }),
    );
    expect(stableStringify({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });
  it('undefined qiymatli kalitlar chiqarib tashlanadi', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});
