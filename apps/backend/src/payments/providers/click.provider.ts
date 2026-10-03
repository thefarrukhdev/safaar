import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { timingSafeEqualString } from '../../auth/security';

/**
 * Click.uz "Checkout URL" integratsiyasi — https://docs.click.uz
 *
 * Chiquvchi tomon: haqiqiy API chaqiruvi shart emas, faqat Click'ning
 * to'lov sahifasiga `service_id`/`merchant_id`/`amount`/`transaction_param`
 * bilan redirect qilinadi. Click foydalanuvchi to'lovni tasdiqlagach,
 * BIZNING serverimizga ikkita chaqiruv qiladi: Prepare (action=0) va
 * Complete (action=1) — har biri o'z `sign_string`iga ega.
 *
 * Kiruvchi imzo formulasi (Click rasmiy hujjatidan):
 *   Prepare:  MD5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
 *   Complete: MD5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
 */

export const CLICK_ERROR = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INCORRECT_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  TRANSACTION_NOT_FOUND: -6,
  TRANSACTION_CANCELLED: -9,
} as const;

export interface ClickPrepareBody {
  click_trans_id: string | number;
  service_id: string | number;
  merchant_trans_id: string;
  amount: string | number;
  action: string | number;
  sign_time: string;
  sign_string: string;
  error?: string | number;
}

export interface ClickCompleteBody extends ClickPrepareBody {
  merchant_prepare_id: string | number;
}

@Injectable()
export class ClickProvider {
  private readonly serviceId?: string;
  private readonly merchantId?: string;
  private readonly secretKey?: string;

  constructor(private readonly config: ConfigService) {
    this.serviceId = config.get<string>('CLICK_SERVICE_ID');
    this.merchantId = config.get<string>('CLICK_MERCHANT_ID');
    this.secretKey = config.get<string>('CLICK_SECRET_KEY');
  }

  isConfigured(): boolean {
    return Boolean(this.serviceId && this.merchantId && this.secretKey);
  }

  /** Foydalanuvchi redirect qilinadigan Click checkout URL. */
  buildCheckoutUrl(params: {
    bookingId: string;
    amount: number;
    returnUrl: string;
  }): string {
    if (!this.serviceId || !this.merchantId) {
      throw new Error('CLICK_NOT_CONFIGURED');
    }
    const query = new URLSearchParams({
      service_id: this.serviceId,
      merchant_id: this.merchantId,
      amount: params.amount.toFixed(2),
      transaction_param: params.bookingId,
      return_url: params.returnUrl,
    });
    return `https://my.click.uz/services/pay?${query.toString()}`;
  }

  verifyPrepareSignature(body: ClickPrepareBody): boolean {
    if (!this.secretKey || !body?.sign_string) return false;
    const expected = this.md5(
      String(body.click_trans_id) +
        String(body.service_id) +
        this.secretKey +
        String(body.merchant_trans_id) +
        String(body.amount) +
        String(body.action) +
        String(body.sign_time),
    );
    return timingSafeEqualString(
      expected,
      String(body.sign_string).toLowerCase(),
    );
  }

  verifyCompleteSignature(body: ClickCompleteBody): boolean {
    if (!this.secretKey || !body?.sign_string) return false;
    const expected = this.md5(
      String(body.click_trans_id) +
        String(body.service_id) +
        this.secretKey +
        String(body.merchant_trans_id) +
        String(body.merchant_prepare_id) +
        String(body.amount) +
        String(body.action) +
        String(body.sign_time),
    );
    return timingSafeEqualString(
      expected,
      String(body.sign_string).toLowerCase(),
    );
  }

  private md5(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }
}
