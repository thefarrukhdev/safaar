import type { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { ClickProvider } from './click.provider';

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('ClickProvider', () => {
  it('reports not configured when credentials are missing', () => {
    const provider = new ClickProvider(config({}));
    expect(provider.isConfigured()).toBe(false);
  });

  it('reports configured once all three credentials are present', () => {
    const provider = new ClickProvider(
      config({
        CLICK_SERVICE_ID: '123',
        CLICK_MERCHANT_ID: '456',
        CLICK_SECRET_KEY: 'secret',
      }),
    );
    expect(provider.isConfigured()).toBe(true);
  });

  it('builds a checkout URL with the expected Click query params', () => {
    const provider = new ClickProvider(
      config({
        CLICK_SERVICE_ID: '123',
        CLICK_MERCHANT_ID: '456',
        CLICK_SECRET_KEY: 'secret',
      }),
    );

    const url = new URL(
      provider.buildCheckoutUrl({
        bookingId: 'booking-1',
        amount: 1300000,
        returnUrl: 'https://safaar.uz/booking/booking-1',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://my.click.uz/services/pay');
    expect(url.searchParams.get('service_id')).toBe('123');
    expect(url.searchParams.get('merchant_id')).toBe('456');
    expect(url.searchParams.get('amount')).toBe('1300000.00');
    expect(url.searchParams.get('transaction_param')).toBe('booking-1');
    expect(url.searchParams.get('return_url')).toBe(
      'https://safaar.uz/booking/booking-1',
    );
  });

  it('throws when asked to build a URL without credentials', () => {
    const provider = new ClickProvider(config({}));
    expect(() =>
      provider.buildCheckoutUrl({
        bookingId: 'booking-1',
        amount: 1000,
        returnUrl: 'https://safaar.uz/booking/booking-1',
      }),
    ).toThrow('CLICK_NOT_CONFIGURED');
  });

  describe('signature verification', () => {
    const secretKey = 'click-secret-key';
    const provider = new ClickProvider(
      config({
        CLICK_SERVICE_ID: '123',
        CLICK_MERCHANT_ID: '456',
        CLICK_SECRET_KEY: secretKey,
      }),
    );

    function md5(value: string): string {
      return createHash('md5').update(value).digest('hex');
    }

    it('accepts a correctly signed Prepare request', () => {
      const body = {
        click_trans_id: '111',
        service_id: '123',
        merchant_trans_id: 'booking-1',
        amount: '1300000.00',
        action: '0',
        sign_time: '2026-08-21 10:00:00',
        sign_string: '',
      };
      body.sign_string = md5(
        body.click_trans_id +
          body.service_id +
          secretKey +
          body.merchant_trans_id +
          body.amount +
          body.action +
          body.sign_time,
      );

      expect(provider.verifyPrepareSignature(body)).toBe(true);
    });

    it('rejects a Prepare request with a tampered amount (regression: signature must bind amount)', () => {
      const signTime = '2026-08-21 10:00:00';
      const signString = md5(
        '111' + '123' + secretKey + 'booking-1' + '1300000.00' + '0' + signTime,
      );

      const tampered = {
        click_trans_id: '111',
        service_id: '123',
        merchant_trans_id: 'booking-1',
        amount: '1', // attacker lowers the amount after signing
        action: '0',
        sign_time: signTime,
        sign_string: signString,
      };

      expect(provider.verifyPrepareSignature(tampered)).toBe(false);
    });

    it('accepts a correctly signed Complete request (includes merchant_prepare_id)', () => {
      const body = {
        click_trans_id: '111',
        service_id: '123',
        merchant_trans_id: 'booking-1',
        merchant_prepare_id: '111',
        amount: '1300000.00',
        action: '1',
        sign_time: '2026-08-21 10:05:00',
        sign_string: '',
      };
      body.sign_string = md5(
        body.click_trans_id +
          body.service_id +
          secretKey +
          body.merchant_trans_id +
          body.merchant_prepare_id +
          body.amount +
          body.action +
          body.sign_time,
      );

      expect(provider.verifyCompleteSignature(body)).toBe(true);
    });

    it('accepts uppercase sign_string in Prepare request', () => {
      const body = {
        click_trans_id: '111',
        service_id: '123',
        merchant_trans_id: 'booking-1',
        amount: '1300000.00',
        action: '0',
        sign_time: '2026-08-21 10:00:00',
        sign_string: '',
      };
      const hash = md5(
        body.click_trans_id +
          body.service_id +
          secretKey +
          body.merchant_trans_id +
          body.amount +
          body.action +
          body.sign_time,
      );
      body.sign_string = hash.toUpperCase();

      expect(provider.verifyPrepareSignature(body)).toBe(true);
    });

    it('rejects Prepare request when sign_string has different length (timing-safe check)', () => {
      const body = {
        click_trans_id: '111',
        service_id: '123',
        merchant_trans_id: 'booking-1',
        amount: '1300000.00',
        action: '0',
        sign_time: '2026-08-21 10:00:00',
        sign_string: 'short-signature',
      };

      expect(provider.verifyPrepareSignature(body)).toBe(false);
    });

    it('rejects Prepare request when sign_string is empty or missing', () => {
      const body = {
        click_trans_id: '111',
        service_id: '123',
        merchant_trans_id: 'booking-1',
        amount: '1300000.00',
        action: '0',
        sign_time: '2026-08-21 10:00:00',
        sign_string: '',
      };

      expect(provider.verifyPrepareSignature(body)).toBe(false);
    });

    it('rejects Complete request with tampered merchant_prepare_id', () => {
      const signTime = '2026-08-21 10:05:00';
      const validHash = md5(
        '111' +
          '123' +
          secretKey +
          'booking-1' +
          '111' +
          '1300000.00' +
          '1' +
          signTime,
      );

      const tampered = {
        click_trans_id: '111',
        service_id: '123',
        merchant_trans_id: 'booking-1',
        merchant_prepare_id: '999', // tampered
        amount: '1300000.00',
        action: '1',
        sign_time: signTime,
        sign_string: validHash,
      };

      expect(provider.verifyCompleteSignature(tampered)).toBe(false);
    });

    it('rejects when the secret key is not configured at all', () => {
      const unconfigured = new ClickProvider(config({}));
      expect(
        unconfigured.verifyPrepareSignature({
          click_trans_id: '1',
          service_id: '1',
          merchant_trans_id: 'x',
          amount: '1',
          action: '0',
          sign_time: 't',
          sign_string: 'anything',
        }),
      ).toBe(false);
    });
  });
});
