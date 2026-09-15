import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import {
  PostgresService,
  type PostgresTransaction,
} from '../infrastructure/postgres.service';
import {
  hmacSha256,
  paymentWebhookSecret,
  timingSafeEqualString,
} from '../auth/security';
import {
  CLICK_ERROR,
  ClickProvider,
  type ClickCompleteBody,
  type ClickPrepareBody,
} from './providers/click.provider';
import { PaymeProvider } from './providers/payme.provider';
import {
  UzumCheckoutError,
  UzumCheckoutProvider,
  type NormalizedCheckoutCallback,
  type RegisterCheckoutResult,
} from './providers/uzum-checkout.provider';
import {
  UZUM_ERROR,
  UZUM_STATUS,
  UzumProvider,
  UzumWebhookError,
} from './providers/uzum.provider';

type HeaderMap = Record<string, string | string[] | undefined>;

/**
 * DB-level booking status konstantalari (kichik harf, pg enum'iga mos) —
 * `bookings.service.ts`dagi bilan bir xil, lekin qasddan mustaqil
 * nusxada — ikkala modul o'zaro bog'liq bo'lib qolmasligi uchun.
 */
const BS = {
  PENDING: BookingStatus.PENDING.toLowerCase(),
  AWAITING_PAYMENT: BookingStatus.AWAITING_PAYMENT.toLowerCase(),
  AWAITING_PARTNER_CONFIRMATION:
    BookingStatus.AWAITING_PARTNER_CONFIRMATION.toLowerCase(),
  CONFIRMED: BookingStatus.CONFIRMED.toLowerCase(),
  CANCELLED: BookingStatus.CANCELLED.toLowerCase(),
  COMPLETED: BookingStatus.COMPLETED.toLowerCase(),
  EXPIRED: BookingStatus.EXPIRED.toLowerCase(),
} as const;

const OPEN_BOOKING_STATUSES = [BS.PENDING, BS.AWAITING_PAYMENT];
const SETTLED_BOOKING_STATUSES = [BS.EXPIRED, BS.CANCELLED];

/**
 * To'lov allaqachon yakuniy holatga o'tgan bo'lsa, webhook event uni qayta
 * yozib yubormasligi kerak (`processPaymentEvent` idempotentligi). Click
 * oqimida payment doim `pending`/`processing` bo'ladi — bu ro'yxat unga
 * ta'sir qilmaydi; Uzum `/reverse` esa `/confirm`dan alohida `event_key`
 * ishlatgani uchun parallel `reverse`+`confirm`da bu himoya zarur.
 */
const TERMINAL_PAYMENT_STATUSES = ['paid', 'reversed', 'refunded', 'failed'];

interface BookingVisibilityRow {
  id: string;
  booking_number: string;
  user_id: string | null;
  partner_organization_id: string;
  total_amount: string | number;
  currency: string;
  status?: string;
  expires_at?: string | null;
}

interface BookingRow {
  id: string;
  status: string;
  user_id: string | null;
  partner_organization_id: string;
  confirmation_mode: string;
  partner_payable: string | number;
  currency: string;
  [key: string]: unknown;
}

export interface PaymentRow {
  id: string;
  booking_id: string;
  amount: string | number;
  currency: string;
  status?: string;
  provider_reference?: string | null;
  updated_at?: string;
  [key: string]: unknown;
}

interface PaymentEventRow {
  id: string;
  payment_id?: string | null;
  processed_at?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  /** Uzum `/confirm` oynasi (30 daq) + xavfsizlik buferi (5 daq). */
  private static readonly UZUM_CONFIRM_WINDOW_MS = 35 * 60_000;

  constructor(
    private readonly pg: PostgresService,
    private readonly config: ConfigService,
    private readonly click: ClickProvider,
    private readonly payme: PaymeProvider,
    private readonly uzum: UzumProvider,
    private readonly checkout: UzumCheckoutProvider,
  ) {}

  async payment(actor: RequestActor | undefined, bookingId: string) {
    await this.assertBookingVisible(actor, bookingId);
    const [payment] = await this.pg.query<PaymentRow>(
      'SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1',
      [bookingId],
    );
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_PROVIDER_ERROR',
        message: 'Payment topilmadi',
      });
    }
    return payment;
  }

  async createPayment(
    actor: RequestActor | undefined,
    bookingId: string,
    body: Record<string, unknown>,
  ) {
    const booking = await this.assertBookingVisible(actor, bookingId);

    // Shu bron uchun hali natijasi chiqmagan (pending/processing) payment
    // bo'lsa — yangisini yaratmasdan o'shani qaytaramiz. Aks holda har bir
    // "Qayta urinish"/checkout'ni qayta ochish bir xil bronga bir nechta
    // mustaqil payment qatori yaratardi, va webhook keyinchalik qaysi
    // birini "to'landi" deb belgilashni noaniq tanlashga majbur bo'lardi.
    const [existing] = await this.pg.query<PaymentRow>(
      `SELECT * FROM payments
       WHERE booking_id = $1 AND status IN ('pending', 'processing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [booking.id],
    );
    if (existing) {
      return existing;
    }

    const provider = this.provider(body.provider);

    // Uzum Checkout — ALOHIDA oqim: to'lov URL'i faqat Uzum `/payment/register`
    // javobidan keyin ma'lum bo'ladi (Click/Payme kabi lokal URL qurish EMAS).
    // Bu shart mavjud sinxron yo'lni (click/payme/uzcard/humo/cash/uzum)
    // umuman o'zgartirmaydi — faqat erta `return`.
    if (provider === 'uzum_checkout') {
      return this.createUzumCheckoutPayment(booking);
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const amount = Number(booking.total_amount);
    const paymentUrl = this.buildCheckoutUrl(provider, booking.id, amount);

    await this.pg.query(
      `INSERT INTO payments (id, booking_id, provider, status, amount, currency, payment_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        booking.id,
        provider,
        provider === 'cash' ? 'awaiting_cash' : 'pending',
        booking.total_amount,
        booking.currency,
        paymentUrl,
        now,
        now,
      ],
    );
    return {
      id,
      booking_id: booking.id,
      provider,
      status: 'pending',
      payment_url: paymentUrl,
      amount: Number(booking.total_amount),
      currency: booking.currency,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * `cash` uchun URL kerak emas — hamkor to'lovni joyida qabul qiladi.
   * Boshqa provayderlar uchun sozlanmagan bo'lsa, jim `null` qaytarish
   * o'rniga aniq xato tashlaymiz — aks holda frontend "to'lov kutilmoqda"
   * holatida abadiy qolib ketardi (aynan shu audit findingi).
   */
  buildCheckoutUrl(
    provider: string,
    bookingId: string,
    amount: number,
  ): string | null {
    if (provider === 'cash') {
      return null;
    }

    // Uzum'da checkout/redirect YO'Q — foydalanuvchi to'lovni Uzum
    // ilovasidan boshlaydi, `payments` qatori `/uzum/webhook/create`
    // kelganda yaratiladi.
    if (provider === 'uzum') {
      return null;
    }

    // Uzum CHECKOUT — redirect URL faqat `/payment/register` javobidan keladi,
    // shuning uchun `createPayment()` uni `createUzumCheckoutPayment()` orqali
    // ALOHIDA hal qiladi. Bu sinxron yordamchi Checkout uchun ishlatilmaydi;
    // agar shu yerga yetib kelinsa (masalan `bookings.service.createPayment`
    // sinxron `buildCheckoutUrl` chaqirsa) — hali ulanmagani uchun aniq 503,
    // jim `null` emas.
    if (provider === 'uzum_checkout') {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
        message:
          'Uzum Checkout to‘lov provayderi hali ulanmagan ' +
          '(UZUM_CHECKOUT_* + rasmiy /payment/register spec kutilmoqda)',
      });
    }

    const returnUrl = `${this.webUserUrl()}/booking/${bookingId}`;

    if (provider === 'click') {
      if (!this.click.isConfigured()) {
        throw new ServiceUnavailableException({
          code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
          message:
            'Click to‘lov provayderi sozlanmagan (CLICK_SERVICE_ID/CLICK_MERCHANT_ID/CLICK_SECRET_KEY)',
        });
      }
      return this.click.buildCheckoutUrl({ bookingId, amount, returnUrl });
    }

    if (provider === 'payme') {
      if (!this.payme.isConfigured()) {
        throw new ServiceUnavailableException({
          code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
          message: 'Payme to‘lov provayderi sozlanmagan (PAYME_MERCHANT_ID)',
        });
      }
      return this.payme.buildCheckoutUrl({ bookingId, amount, returnUrl });
    }

    // uzcard/humo — hozircha checkout URL generatsiyasi qo'shilmagan
    // (real API/spec integratsiyasi kelajakdagi ish sifatida qoladi).
    throw new ServiceUnavailableException({
      code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
      message: `${provider} to‘lov provayderi hali ulanmagan`,
    });
  }

  private webUserUrl(): string {
    return (
      this.config.get<string>('WEB_USER_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  /**
   * Uzum Checkout to'lovini yaratadi — Merchant (`provider='uzum'`) oqimidan
   * MUTLAQO ALOHIDA. Mavjud ochiq (`pending`/`processing`) payment bo'lsa
   * uni qaytaradi (idempotent); aks holda Uzum `/payment/register` chaqiriladi
   * va javobdagi `orderId` + to'lov URL'i bilan yangi `payments` qatori
   * (`provider = 'uzum_checkout'`) yoziladi.
   *
   * Mapping:
   *   bookings.booking_number      -> Uzum `orderNumber`
   *   payments.id                  -> Uzum `merchantOperationId`
   *   Uzum javob `orderId`         -> payments.provider_reference
   *   payments.idempotency_key      = `uzum_checkout:<orderId>`
   *
   * `checkout.register()` — 2026-09-11dan buyon RASMIY tasdiqlangan
   * wire-format bilan HAQIQIY so'rov yuboradi (`docs/payments-uzum-checkout.md`),
   * LEKIN to'liq env (auth + fiskal — `UZUM_CHECKOUT_*`) sozlanmasa hamon
   * FAIL-CLOSED (`NOT_CONFIGURED`) — bu yerda u aniq 503'ga aylantiriladi
   * (uzcard/humo bilan bir xil UX) va HECH QANDAY qator yozilmaydi.
   */
  private async createUzumCheckoutPayment(booking: BookingVisibilityRow) {
    const [existing] = await this.pg.query<PaymentRow>(
      `SELECT * FROM payments
       WHERE booking_id = $1 AND status IN ('pending', 'processing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [booking.id],
    );
    if (existing) {
      return existing;
    }

    const paymentId = randomUUID();
    let reg: RegisterCheckoutResult;
    try {
      reg = await this.checkout.register({
        bookingId: booking.id,
        orderNumber: booking.booking_number,
        merchantOperationId: paymentId,
        amountSom: Number(booking.total_amount),
        currency: booking.currency,
        successUrl: `${this.webUserUrl()}/booking/${booking.id}?payment=success`,
        failureUrl: `${this.webUserUrl()}/booking/${booking.id}?payment=failed`,
      });
    } catch (err) {
      if (err instanceof UzumCheckoutError) {
        // Secret/URL/imzo LOG QILINMAYDI — faqat code + booking id.
        this.logger.warn(
          `uzum-checkout register bloklandi: ${err.code} booking=${booking.id}`,
        );
        throw new ServiceUnavailableException({
          code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
          message:
            'Uzum Checkout to‘lov provayderi hali ulanmagan ' +
            '(UZUM_CHECKOUT_* + rasmiy /payment/register spec kutilmoqda)',
        });
      }
      throw err;
    }

    const now = new Date().toISOString();
    // TODO(uzum-checkout-commission): `register()` 2026-09-11dan buyon
    // to'liq sozlangan terminalda (auth + fiskal env) HAQIQIY so'rov
    // yuboradi — bu qator ENDI bajariladi. Hali qo'shilmagan:
    // `provider_fee_rate/provider_fee_amount/net_settlement_amount` —
    // `calculateUzumCheckoutCommission(booking.total_amount)` orqali
    // (qarang `uzum-checkout-commission.ts` + `docs/payments-uzum-checkout.md`
    // "Uzum Checkout komissiyasi"). Migratsiya
    // (`20260911000000_uzum_checkout_commission_fields`) DIZAYN QILINGAN,
    // lekin ATAYLAB productionga qo'llanilmagan — shu ustunlarni to'ldirish
    // ALOHIDA, ongli qaror bilan qo'shiladi (bu commit doirasidan tashqarida).
    await this.pg.query(
      `INSERT INTO payments
         (id, booking_id, provider, status, amount, currency, payment_url,
          provider_reference, idempotency_key, created_at, updated_at)
       VALUES ($1, $2, 'uzum_checkout', 'processing', $3, $4, $5, $6, $7, $8, $8)`,
      [
        paymentId,
        booking.id,
        booking.total_amount,
        booking.currency,
        reg.paymentUrl,
        reg.orderId,
        `uzum_checkout:${reg.orderId}`,
        now,
      ],
    );

    return {
      id: paymentId,
      booking_id: booking.id,
      provider: 'uzum_checkout',
      status: 'processing',
      payment_url: reg.paymentUrl,
      amount: Number(booking.total_amount),
      currency: booking.currency,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Click'ning haqiqiy Prepare/Complete oqimi — https://docs.click.uz
   * Click bilan MUVOFIQLIK uchun javob HAR DOIM HTTP 200 bo'lishi shart,
   * xato bo'lsa ham (`error` maydonida manfiy kod bilan bildiriladi) —
   * aks holda Click cheksiz retry qilib turadi.
   */
  async clickPrepare(body: ClickPrepareBody) {
    if (!this.click.verifyPrepareSignature(body)) {
      return this.clickError(
        body,
        CLICK_ERROR.SIGN_CHECK_FAILED,
        'SIGN CHECK FAILED!',
      );
    }

    const bookingId = String(body.merchant_trans_id ?? '');
    const eventKey = `click:prepare:${body.click_trans_id}`;

    try {
      await this.processPaymentEvent('click', 'prepare', eventKey, {
        booking_id: bookingId,
        amount: body.amount,
        transaction_id: body.click_trans_id,
      });
      return {
        success: true as const,
        click_trans_id: body.click_trans_id,
        merchant_trans_id: bookingId,
        merchant_prepare_id: body.click_trans_id,
        error: CLICK_ERROR.SUCCESS,
        error_note: 'Success',
      };
    } catch (error) {
      return this.clickErrorFromException(body, error);
    }
  }

  async clickComplete(body: ClickCompleteBody) {
    if (!this.click.verifyCompleteSignature(body)) {
      return this.clickError(
        body,
        CLICK_ERROR.SIGN_CHECK_FAILED,
        'SIGN CHECK FAILED!',
      );
    }

    if (Number(body.error) < 0) {
      // Click o'zi bekor qilingan/muvaffaqiyatsiz to'lovni bildirmoqda —
      // bizning tomonimizda hech narsa "to'landi" deb belgilanmaydi.
      return {
        success: true as const,
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        merchant_confirm_id: body.merchant_prepare_id,
        error: CLICK_ERROR.TRANSACTION_CANCELLED,
        error_note: 'Transaction cancelled',
      };
    }

    const bookingId = String(body.merchant_trans_id ?? '');
    const eventKey = `click:complete:${body.click_trans_id}`;

    try {
      await this.processPaymentEvent('click', 'complete', eventKey, {
        booking_id: bookingId,
        amount: body.amount,
        transaction_id: body.click_trans_id,
      });
      return {
        success: true as const,
        click_trans_id: body.click_trans_id,
        merchant_trans_id: bookingId,
        merchant_confirm_id: body.merchant_prepare_id,
        error: CLICK_ERROR.SUCCESS,
        error_note: 'Success',
      };
    } catch (error) {
      return this.clickErrorFromException(body, error);
    }
  }

  private clickError(body: ClickPrepareBody, error: number, errorNote: string) {
    return {
      success: true as const,
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      error,
      error_note: errorNote,
    };
  }

  private clickErrorFromException(body: ClickPrepareBody, error: unknown) {
    const code =
      error instanceof NotFoundException
        ? CLICK_ERROR.TRANSACTION_NOT_FOUND
        : error instanceof UnprocessableEntityException
          ? CLICK_ERROR.INCORRECT_AMOUNT
          : CLICK_ERROR.ACTION_NOT_FOUND;
    const message =
      error instanceof Error ? error.message : 'Payment processing error';
    return this.clickError(body, code, message);
  }

  async providerWebhook(
    provider: string,
    event: string,
    body: Record<string, unknown>,
    headers: HeaderMap = {},
  ) {
    const secret = this.requiredWebhookSecret();
    const eventKey = this.eventKey(provider, event, body);
    this.verifySignature(provider, event, eventKey, body, headers, secret);

    return this.processPaymentEvent(provider, event, eventKey, body);
  }

  /**
   * `providerWebhook()`dan chiqarilgan umumiy tranzaksiya logikasi —
   * imzo allaqachon tekshirilgan bo'lishi shart, chunki bu yerda buni
   * qayta tekshirmaymiz. Click kabi provayderlar o'zining haqiqiy imzo
   * sxemasi bilan tekshirib, keyin shu metodni chaqiradi (`clickWebhook`).
   */
  private async processPaymentEvent(
    provider: string,
    event: string,
    eventKey: string,
    body: Record<string, unknown>,
  ) {
    // Bu yerdagi hash faqat audit/dedup uchun fingerprint — haqiqiy
    // xavfsizlik allaqachon (a) chaqiruvchi tomonidan bajarilgan imzo
    // tekshiruvi va (b) `event_key` ustidagi UNIQUE constraint orqali
    // ta'minlangan, shuning uchun bu yerga webhook secret kerak emas.
    const payloadHash = createHash('sha256')
      .update(this.stableStringify(body))
      .digest('hex');

    return this.pg.transaction(async (tx) => {
      // event_key ustidagi UNIQUE constraint + ON CONFLICT DO NOTHING —
      // bir xil webhook parallel/qayta kelsa ham faqat bitta so'rov uni
      // "yutib oladi", qolganlari 500 bermasdan duplicate:true qaytaradi.
      const claimed = await tx.query<PaymentEventRow>(
        `INSERT INTO payment_events (id, provider, event_type, event_key, payload, payload_hash, processed_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         ON CONFLICT (event_key) DO NOTHING
         RETURNING *`,
        [
          randomUUID(),
          provider,
          event,
          eventKey,
          JSON.stringify(body),
          payloadHash,
          new Date().toISOString(),
        ],
      );

      if (claimed.length === 0) {
        const [existingEvent] = await tx.query<PaymentEventRow>(
          'SELECT * FROM payment_events WHERE event_key = $1',
          [eventKey],
        );
        const payment = existingEvent?.payment_id
          ? (
              await tx.query<PaymentRow>(
                'SELECT * FROM payments WHERE id = $1',
                [existingEvent.payment_id],
              )
            )[0]
          : undefined;
        return {
          provider,
          event,
          accepted: true,
          duplicate: true,
          payment,
          processed_at: existingEvent?.processed_at,
        };
      }

      const eventRow = claimed[0];

      const bookingId = String(
        body.booking_id ?? body.bookingId ?? body.account ?? '',
      );

      // Bronni AVVAL, qulflab olamiz — aynan shu qulf `expireStaleBookings`
      // cron'i bilan haqiqiy o'zaro istisno (mutual exclusion) ta'minlaydi:
      // ikkalasi ham xuddi shu qatorga UPDATE qiladi, shuning uchun Postgres
      // ularni tabiiy ravishda ketma-ket, bittasi ikkinchisidan KEYIN
      // (yangilangan holatni ko'rib) bajaradi — "hozir ikkalasi ham
      // muvaffaqiyatli, natija board bo'lib qoladi" degan holat bo'lmaydi.
      const [booking] = bookingId
        ? await tx.query<BookingRow>(
            'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
            [bookingId],
          )
        : [];

      // To'lov qatorini tanlashda avval hali natijasi chiqmagan
      // (pending/processing)ni afzal ko'ramiz — bir bronga bir nechta
      // payment qatori bo'lib qolgan taqdirda ham (masalan eski, tugagan
      // urinish) webhook noto'g'ri/eskirgan qatorni "to'landi" deb
      // belgilab qo'ymasligi uchun.
      const paymentRows = bookingId
        ? await tx.query<PaymentRow>(
            `SELECT * FROM payments WHERE booking_id = $1
             ORDER BY (status IN ('pending', 'processing')) DESC, created_at DESC
             LIMIT 1 FOR UPDATE`,
            [bookingId],
          )
        : [];
      const [payment] = paymentRows;

      if (!payment || !booking) {
        throw new NotFoundException({
          code: 'PAYMENT_NOT_FOUND',
          message: 'Webhook uchun payment topilmadi',
        });
      }

      // Tanlangan to'lov allaqachon yakuniy holatda (paid/reversed/refunded/
      // failed) bo'lsa — bu event uni qayta "paid" qilmasligi kerak. Masalan
      // parallel Uzum `/reverse` (payment → reversed) + kechikkan `/confirm`:
      // `/confirm` `event_key`i `/reverse`nikidan farq qilgani uchun claim
      // o'tadi, lekin bu yerda to'xtatamiz — aks holda `reversed` → `paid`
      // "sakrash" va soxta avto-refund yuz beradi.
      if (
        payment.status &&
        TERMINAL_PAYMENT_STATUSES.includes(String(payment.status))
      ) {
        await tx.query(
          'UPDATE payment_events SET payment_id = $1 WHERE id = $2',
          [payment.id, eventRow.id],
        );
        return {
          provider,
          event,
          accepted: true,
          duplicate: true,
          payment,
          processed_at: eventRow.processed_at,
        };
      }

      this.assertPaymentMatchesPayload(payment, body);

      const now = new Date().toISOString();
      const newStatus = event === 'prepare' ? 'processing' : 'paid';
      const providerReference = String(
        body.transaction_id ?? body.id ?? eventKey,
      );

      await tx.query(
        'UPDATE payments SET status = $1, provider_reference = $2, updated_at = $3 WHERE id = $4',
        [newStatus, providerReference, now, payment.id],
      );

      await tx.query(
        'UPDATE payment_events SET payment_id = $1 WHERE id = $2',
        [payment.id, eventRow.id],
      );

      let bookingOutcome:
        | 'confirmed'
        | 'awaiting_partner_confirmation'
        | 'no_action'
        | 'lost_race_refund_requested' = 'no_action';

      if (newStatus === 'paid') {
        if (OPEN_BOOKING_STATUSES.includes(booking.status)) {
          // Kutilgan, oddiy holat: to'lov muddat tugashidan oldin yetib
          // keldi. Bron endi cron tomonidan "expired"ga o'tkazilmasligi
          // uchun `expires_at`ni ham shu yerda tozalaymiz.
          const nextStatus =
            booking.confirmation_mode === 'request_confirmation'
              ? BS.AWAITING_PARTNER_CONFIRMATION
              : BS.CONFIRMED;

          await tx.query(
            `UPDATE bookings
             SET status = $1, confirmed_at = $2, expires_at = NULL, updated_at = $2
             WHERE id = $3`,
            [nextStatus, now, booking.id],
          );
          await this.recordStatusHistory(
            tx,
            booking.id,
            nextStatus,
            'payment_paid',
          );
          await this.creditPartnerLedger(tx, booking);

          bookingOutcome =
            nextStatus === BS.CONFIRMED
              ? 'confirmed'
              : 'awaiting_partner_confirmation';
        } else if (SETTLED_BOOKING_STATUSES.includes(booking.status)) {
          // Poyga yutqazildi: pul haqiqatan keldi, lekin bron cron
          // tomonidan allaqachon "expired"/"cancelled" qilingan — xona/
          // o'rindiq boshqa mijozga qayta sotilgan bo'lishi mumkin, shuning
          // uchun bronni jim tasdiqlab bo'lmaydi. Pul esa hech qachon
          // "yo'qolib" ketmasligi kerak — shu sabab avtomatik refund
          // so'rovi ochiladi (admin navbatida ko'rinadi) va bu holat
          // bron tarixida aniq qayd etiladi.
          await this.recordStatusHistory(
            tx,
            booking.id,
            booking.status,
            'paid_after_settlement_auto_refund',
          );
          await this.autoRefundForLostRace(tx, booking, payment, now);
          bookingOutcome = 'lost_race_refund_requested';
        }
        // Boshqa holatlar (booking allaqachon confirmed/awaiting_partner_
        // confirmation/completed) — idempotentlik tufayli odatda bu yerga
        // yetib kelmaydi, lekin yetib kelsa ham qo'shimcha harakat
        // qilinmaydi (ikki marta kredit/tasdiqlashning oldi olinadi).
      }

      return {
        provider,
        event,
        accepted: true,
        duplicate: false,
        booking_outcome: bookingOutcome,
        payment: {
          ...payment,
          status: newStatus,
          provider_reference: providerReference,
          updated_at: now,
        },
        processed_at: eventRow.processed_at,
      };
    });
  }

  private async recordStatusHistory(
    tx: PostgresTransaction,
    bookingId: string,
    status: string,
    action: string,
  ) {
    await tx.query(
      `INSERT INTO booking_status_history (id, booking_id, status, action, actor_type, actor_id, created_at)
       VALUES ($1, $2, $3, $4, NULL, NULL, $5)`,
      [randomUUID(), bookingId, status, action, new Date().toISOString()],
    );
  }

  /**
   * Bron "topshirilgan" (to'lov qabul qilingan va hamkorga tasdiqlangan/
   * tasdiqlanishi so'ralgan) bo'lganda hamkorning haqiqiy hisobiga
   * (`partner_ledger_entries`) shu bron bo'yicha ulush qo'shiladi — bu
   * jadval endi hamkor balansi uchun YAGONA haqiqat manbai (avval balans
   * to'g'ridan-to'g'ri `bookings.total_amount`dan, holatidan qat'iy nazar,
   * hisoblab chiqilardi).
   */
  private async creditPartnerLedger(
    tx: PostgresTransaction,
    booking: BookingRow,
  ) {
    await tx.query(
      `INSERT INTO partner_ledger_entries (id, organization_id, booking_id, type, amount, currency, created_at)
       VALUES ($1, $2, $3, 'booking_earned', $4, $5, $6)`,
      [
        randomUUID(),
        booking.partner_organization_id,
        booking.id,
        Number(booking.partner_payable),
        booking.currency,
        new Date().toISOString(),
      ],
    );
  }

  /**
   * Pul kelgan, lekin bron allaqachon "expired"/"cancelled" bo'lib
   * qolgan holat uchun — avtomatik refund so'rovi. `requested_amount`
   * to'liq to'langan summa (mijoz aybi emas, tizim tomonidagi vaqt
   * poygasi), reason maydonida sabab aniq yozib qo'yiladi.
   */
  private async autoRefundForLostRace(
    tx: PostgresTransaction,
    booking: BookingRow,
    payment: PaymentRow,
    now: string,
  ) {
    await tx.query(
      `INSERT INTO refunds (id, booking_id, user_id, status, currency, requested_amount, reason, created_at, updated_at)
       VALUES ($1, $2, $3, 'requested', $4, $5, $6, $7, $7)`,
      [
        randomUUID(),
        booking.id,
        booking.user_id,
        payment.currency,
        Number(payment.amount),
        "Tizim: to'lov bron muddati tugagach/bekor qilingach yetib keldi — avtomatik qaytarish so'rovi",
        now,
      ],
    );
  }

  private async assertBookingVisible(
    actor: RequestActor | undefined,
    bookingId: string,
  ) {
    const [booking] = await this.pg.query<BookingVisibilityRow>(
      'SELECT * FROM bookings WHERE id = $1',
      [bookingId],
    );
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_EXPIRED',
        message: 'Bron topilmadi',
      });
    }
    if (!actor) {
      // Anonim (tokensiz) chaqiruv — bron egasini aniqlab bo'lmaydi.
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Sessiya topilmadi yoki token yaroqsiz',
      });
    }
    if (actor.role === Role.SUPER_ADMIN || actor.actorType === 'admin') {
      return booking;
    }
    if (actor.actorType === 'user' && booking.user_id === actor.id) {
      return booking;
    }
    if (
      actor.actorType === 'partner' &&
      booking.partner_organization_id === actor.organizationId
    ) {
      return booking;
    }
    throw new ForbiddenException({
      code: 'BOOKING_FORBIDDEN',
      message: 'Bu bron sizga tegishli emas',
    });
  }

  private verifySignature(
    provider: string,
    event: string,
    eventKey: string,
    body: Record<string, unknown>,
    headers: HeaderMap,
    secret: string,
  ) {
    const signature = this.firstHeader(
      headers['x-safaar-signature'] ?? headers['x-signature'],
    );
    if (!signature) {
      throw new UnauthorizedException({
        code: 'PAYMENT_SIGNATURE_INVALID',
        message: 'Webhook signature yuborilmagan',
      });
    }
    const canonical = `${provider}.${event}.${eventKey}.${this.stableStringify(body)}`;
    const expected = hmacSha256(canonical, secret);
    if (!timingSafeEqualString(signature, expected)) {
      throw new UnauthorizedException({
        code: 'PAYMENT_SIGNATURE_INVALID',
        message: 'Webhook signature noto\u2018g\u2018ri',
      });
    }
  }

  private requiredWebhookSecret(): string {
    const secret = paymentWebhookSecret();
    if (!secret) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
        message: 'Payment provider rasmiy webhook integratsiyasi ulanmagan',
      });
    }
    return secret;
  }

  private eventKey(
    provider: string,
    event: string,
    body: Record<string, unknown>,
  ): string {
    const value =
      body.event_id ??
      body.eventId ??
      body.transaction_id ??
      body.id ??
      body.booking_id ??
      body.bookingId;
    return `${provider}:${event}:${String(value ?? '')}`;
  }

  private assertPaymentMatchesPayload(
    payment: Record<string, unknown>,
    body: Record<string, unknown>,
  ) {
    const amount = body.amount ?? body.total_amount;
    if (amount !== undefined && Number(amount) !== Number(payment.amount)) {
      throw new UnprocessableEntityException({
        code: 'PAYMENT_AMOUNT_MISMATCH',
        message: 'Webhook summasi payment bilan mos emas',
      });
    }
    const currency = body.currency
      ? String(body.currency).toUpperCase()
      : 'UZS';
    if (currency !== payment.currency) {
      throw new UnprocessableEntityException({
        code: 'PAYMENT_CURRENCY_MISMATCH',
        message: 'Webhook valyutasi payment bilan mos emas',
      });
    }
  }

  /**
   * Uzum Checkout audit-only `payment_events.payload` yozuvlari uchun
   * umumiy shakl: TO'LIQ xom callback + (mavjud bo'lsa) debug-safe
   * sarlavhalar. Faqat `uzumCheckoutCallback()`ning audit yo'llarida
   * (unknown_order va non-PAID) ishlatiladi — PAID/confirm yo'li o'z
   * ichiga (booking_id/transaction_id kabi) qo'shimcha maydonlarni ham
   * olgani uchun bu helper'ni ishlatmaydi.
   */
  private buildCheckoutAuditPayload(
    input: NormalizedCheckoutCallback,
    debugHeaders?: Record<string, string>,
  ): Record<string, unknown> {
    return debugHeaders && Object.keys(debugHeaders).length > 0
      ? { raw: input.raw, debug_headers: debugHeaders }
      : { raw: input.raw };
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      return `{${Object.entries(value as Record<string, unknown>)
        // `undefined`-qiymatli kalitlar kanonik matnga umuman kirmasligi
        // kerak — aks holda ular JSON.stringify orqali so'zma-so'z
        // "undefined" matniga aylanadi, va real provayder (masalan Click)
        // yubormaydigan/bilmaydigan maydonlar imzoni buzib qo'yadi.
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(
          ([key, entry]) =>
            `${JSON.stringify(key)}:${this.stableStringify(entry)}`,
        )
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }

  private firstHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private provider(value: unknown): string {
    const provider = String(value ?? 'click');
    return [
      'click',
      'payme',
      'uzcard',
      'humo',
      'cash',
      'uzum',
      'uzum_checkout',
    ].includes(provider)
      ? provider
      : 'click';
  }

  // ==========================================================================
  //  UZUM MERCHANT API — rasmiy contract (developer.uzumbank.uz, 1.0.0).
  //  5 ta webhook: /check /create /confirm /reverse /status.
  //  Toza Uzum logikasi `UzumProvider`da (ClickProvider naqshi); bu yerda
  //  payment domen logikasi. `/confirm` mavjud `processPaymentEvent()`ni
  //  qayta ishlatadi — uning semantikasi o'zgartirilmagan.
  // ==========================================================================

  /**
   * Uzum buyurtma identifikatori = SAFAAR `bookings.booking_number`.
   * Uzum Postman kolleksiyasi buni `params.order_id` sifatida yuboradi;
   * rasmiy contract namunasi esa `params.account` deb ataydi — ikkalasini
   * (va zaxira sifatida top-level `order_id`ni) ham qabul qilamiz.
   * Summa (tiyin) va uni tekshirish `readUzumAmountTiyin` / `toTiyin`da
   * qoladi — bu yerda FAQAT buyurtma raqami o'qiladi, summa semantikasi
   * o'zgarmaydi.
   */
  private readUzumAccount(body: Record<string, unknown>): string {
    const params = body.params;
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      throw new UzumWebhookError(UZUM_ERROR.BAD_JSON, body.serviceId);
    }
    const p = params as Record<string, unknown>;
    const raw = p.order_id ?? p.account ?? p.orderId ?? body.order_id;
    const value =
      typeof raw === 'string'
        ? raw.trim()
        : typeof raw === 'number' && Number.isFinite(raw)
          ? String(raw)
          : '';
    if (!value) {
      throw new UzumWebhookError(UZUM_ERROR.MISSING_PARAMS, body.serviceId);
    }
    return value;
  }

  private readUzumTransId(body: Record<string, unknown>): string {
    const transId = typeof body.transId === 'string' ? body.transId.trim() : '';
    if (!transId) {
      throw new UzumWebhookError(UZUM_ERROR.MISSING_PARAMS, body.serviceId);
    }
    return transId;
  }

  private readUzumAmountTiyin(body: Record<string, unknown>): number {
    const amount = body.amount;
    if (amount === undefined || amount === null || amount === '') {
      throw new UzumWebhookError(UZUM_ERROR.MISSING_PARAMS, body.serviceId);
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      throw new UzumWebhookError(UZUM_ERROR.INVALID_AMOUNT, body.serviceId);
    }
    return n;
  }

  private async findBookingByNumber(bookingNumber: string) {
    const [booking] = await this.pg.query<BookingRow>(
      'SELECT * FROM bookings WHERE booking_number = $1',
      [bookingNumber],
    );
    return booking;
  }

  /**
   * Bron hozir Uzum orqali to'lanishga yaroqlimi? Yaroqsiz bo'lsa
   * contractdagi mos error-code'ni tashlaydi. HECH QANDAY yozuv qilmaydi.
   */
  private assertUzumPayable(booking: BookingRow, serviceId: unknown): void {
    const status = String(booking.status);
    if (
      status === BS.CONFIRMED ||
      status === BS.AWAITING_PARTNER_CONFIRMATION ||
      status === BS.COMPLETED
    ) {
      throw new UzumWebhookError(UZUM_ERROR.ALREADY_PAID, serviceId);
    }
    if (!OPEN_BOOKING_STATUSES.includes(status)) {
      // cancelled / expired / boshqa yopiq holat.
      throw new UzumWebhookError(UZUM_ERROR.CANCELLED, serviceId);
    }
    const expiresAt = booking.expires_at
      ? Date.parse(String(booking.expires_at))
      : NaN;
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      // Muddati o'tgan — `expireStaleBookings` cron bir daqiqada `expired`ga o'tkazadi.
      throw new UzumWebhookError(UZUM_ERROR.CANCELLED, serviceId);
    }
  }

  /**
   * `/check` — to'lov mumkinligini tekshiradi. YOZUV QILMAYDI.
   * Muvaffaqiyat: `{ serviceId, timestamp, status: "OK", data }`.
   */
  async uzumCheck(body: Record<string, unknown>) {
    const serviceId = this.uzum.assertServiceId(body.serviceId);
    const account = this.readUzumAccount(body);

    const booking = await this.findBookingByNumber(account);
    if (!booking) {
      throw new UzumWebhookError(UZUM_ERROR.ACCOUNT_NOT_FOUND, serviceId);
    }

    const [paid] = await this.pg.query<PaymentRow>(
      "SELECT id FROM payments WHERE booking_id = $1 AND status = 'paid' LIMIT 1",
      [booking.id],
    );
    if (paid) {
      throw new UzumWebhookError(UZUM_ERROR.ALREADY_PAID, serviceId);
    }

    this.assertUzumPayable(booking, serviceId);

    // Rasmiy contract `/check` 200 namunasi `data: {}` (bo'sh) ko'rsatadi.
    // `data` ichidagi aniq kalitlar (masalan summa) merchant onboarding'da
    // kelishiladi — kelishilmaguncha hech qanday taxminiy field qo'shmaymiz.
    return this.uzum.checkOk(serviceId, {});
  }

  /**
   * `/create` — Uzum tranzaksiyasini SAFAAR tarafida ro'yxatga oladi.
   * Idempotent: bir xil `transId` qayta kelsa → 10010.
   */
  async uzumCreate(body: Record<string, unknown>) {
    const serviceId = this.uzum.assertServiceId(body.serviceId);
    const account = this.readUzumAccount(body);
    const transId = this.readUzumTransId(body);
    const amountTiyin = this.readUzumAmountTiyin(body);

    return this.pg.transaction(async (tx) => {
      const [dup] = await tx.query<{ id: string }>(
        `SELECT id FROM payments
         WHERE provider = 'uzum'
           AND (provider_reference = $1 OR idempotency_key = $2)
         LIMIT 1`,
        [transId, `uzum:${transId}`],
      );
      if (dup) {
        throw new UzumWebhookError(UZUM_ERROR.ALREADY_CREATED, serviceId);
      }

      const claimed = await tx.query<{ id: string }>(
        `INSERT INTO payment_events (id, provider, event_type, event_key, payload, payload_hash, processed_at)
         VALUES ($1, 'uzum', 'create', $2, $3::jsonb, $4, $5)
         ON CONFLICT (event_key) DO NOTHING
         RETURNING id`,
        [
          randomUUID(),
          `uzum:create:${transId}`,
          JSON.stringify(body),
          createHash('sha256').update(this.stableStringify(body)).digest('hex'),
          new Date().toISOString(),
        ],
      );
      if (claimed.length === 0) {
        throw new UzumWebhookError(UZUM_ERROR.ALREADY_CREATED, serviceId);
      }

      const [booking] = await tx.query<BookingRow>(
        'SELECT * FROM bookings WHERE booking_number = $1 FOR UPDATE',
        [account],
      );
      if (!booking) {
        throw new UzumWebhookError(UZUM_ERROR.ACCOUNT_NOT_FOUND, serviceId);
      }

      const [paid] = await tx.query<PaymentRow>(
        "SELECT id FROM payments WHERE booking_id = $1 AND status = 'paid' LIMIT 1",
        [booking.id],
      );
      if (paid) {
        throw new UzumWebhookError(UZUM_ERROR.ALREADY_PAID, serviceId);
      }
      // Muddati o'tgan/bekor qilingan bronni QAYTA TIRILTIRMAYMIZ.
      this.assertUzumPayable(booking, serviceId);

      const expectedTiyin = this.uzum.toTiyin(Number(booking.total_amount));
      if (amountTiyin !== expectedTiyin) {
        throw new UzumWebhookError(UZUM_ERROR.INVALID_AMOUNT, serviceId);
      }

      const now = new Date().toISOString();
      const [existing] = await tx.query<PaymentRow>(
        `SELECT * FROM payments
         WHERE booking_id = $1 AND status IN ('pending', 'processing')
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [booking.id],
      );
      let paymentId: string;
      if (existing) {
        paymentId = existing.id;
        await tx.query(
          `UPDATE payments
           SET provider = 'uzum', status = 'processing',
               amount = $1, currency = $2,
               provider_reference = $3, idempotency_key = $4, updated_at = $5
           WHERE id = $6`,
          [
            booking.total_amount,
            booking.currency,
            transId,
            `uzum:${transId}`,
            now,
            paymentId,
          ],
        );
      } else {
        paymentId = randomUUID();
        await tx.query(
          `INSERT INTO payments
             (id, booking_id, provider, status, amount, currency, payment_url,
              provider_reference, idempotency_key, created_at, updated_at)
           VALUES ($1, $2, 'uzum', 'processing', $3, $4, NULL, $5, $6, $7, $7)`,
          [
            paymentId,
            booking.id,
            booking.total_amount,
            booking.currency,
            transId,
            `uzum:${transId}`,
            now,
          ],
        );
      }

      await tx.query(
        'UPDATE payment_events SET payment_id = $1 WHERE id = $2',
        [paymentId, claimed[0].id],
      );

      // Uzum confirm oynasi (30 daq) SAFAAR default (15 daq)dan uzun —
      // faqat hali OCHIQ bo'lsa muddatni now+35 daqiqaga uzaytiramiz.
      await tx.query(
        `UPDATE bookings
         SET expires_at = $1, updated_at = $2
         WHERE id = $3 AND status IN ('pending', 'awaiting_payment')`,
        [
          new Date(
            Date.now() + PaymentsService.UZUM_CONFIRM_WINDOW_MS,
          ).toISOString(),
          now,
          booking.id,
        ],
      );

      return this.uzum.created(serviceId, transId, amountTiyin, {});
    });
  }

  /**
   * `/confirm` — to'lov muvaffaqiyatli; xizmatni ko'rsatamiz, tranzaksiyani
   * yakuniy holatga o'tkazamiz. Mavjud `processPaymentEvent()`ni qayta
   * ishlatadi (booking → confirmed, ledger BIR MARTA, `event_key` UNIQUE).
   */
  async uzumConfirm(body: Record<string, unknown>) {
    const serviceId = this.uzum.assertServiceId(body.serviceId);
    const transId = this.readUzumTransId(body);

    if (
      typeof body.paymentSource !== 'string' ||
      !String(body.paymentSource).trim()
    ) {
      throw new UzumWebhookError(UZUM_ERROR.MISSING_PARAMS, serviceId);
    }
    if (typeof body.phone !== 'string' || !String(body.phone).trim()) {
      throw new UzumWebhookError(UZUM_ERROR.MISSING_PARAMS, serviceId);
    }

    const [payment] = await this.pg.query<PaymentRow>(
      `SELECT * FROM payments
       WHERE provider = 'uzum'
         AND (provider_reference = $1 OR idempotency_key = $2)
       ORDER BY created_at DESC
       LIMIT 1`,
      [transId, `uzum:${transId}`],
    );
    if (!payment) {
      throw new UzumWebhookError(UZUM_ERROR.TRANS_NOT_FOUND, serviceId);
    }
    const pStatus = String(payment.status ?? '');
    if (pStatus === 'paid') {
      throw new UzumWebhookError(UZUM_ERROR.ALREADY_CONFIRMED, serviceId);
    }
    if (
      pStatus === 'reversed' ||
      pStatus === 'refunded' ||
      pStatus === 'failed'
    ) {
      throw new UzumWebhookError(UZUM_ERROR.TRANS_CANCELLED, serviceId);
    }

    // Rasmiy contractda `/confirm` summa/valyuta yubormaydi. Himoya sifatida
    // `amount`/`total_amount`/`currency`ni olib tashlaymiz — aks holda bank
    // kutilmaganda tiyin `amount` qo'shsa `assertPaymentMatchesPayload`
    // (so'm bilan solishtirib) noto'g'ri mismatch beradi.
    const confirmBody: Record<string, unknown> = { ...body };
    delete confirmBody.amount;
    delete confirmBody.total_amount;
    delete confirmBody.currency;
    const result = (await this.processPaymentEvent(
      'uzum',
      'confirm',
      `uzum:confirm:${transId}`,
      {
        ...confirmBody,
        booking_id: payment.booking_id,
        transaction_id: transId,
      },
    )) as { duplicate?: boolean; payment?: { status?: unknown } };

    if (result.duplicate) {
      // Takroriy yoki parallel `/confirm`. Agar to'lov shu orada bekor
      // qilingan bo'lsa (parallel `/reverse`) — 10015; aks holda
      // "allaqachon tasdiqlangan" — 10016.
      const dupStatus = String(result.payment?.status ?? '');
      if (
        dupStatus === 'reversed' ||
        dupStatus === 'refunded' ||
        dupStatus === 'failed'
      ) {
        throw new UzumWebhookError(UZUM_ERROR.TRANS_CANCELLED, serviceId);
      }
      throw new UzumWebhookError(UZUM_ERROR.ALREADY_CONFIRMED, serviceId);
    }

    return this.uzum.confirmed(
      serviceId,
      transId,
      this.uzum.toTiyin(Number(payment.amount)),
      {},
    );
  }

  /**
   * `/reverse` — Uzum tranzaksiyani bekor qildi (pulni o'zi qaytardi).
   * Payment → reversed, bron → cancelled, ledger kompensatsiyasi. SAFAAR
   * ichida `refunds` qatori YARATILMAYDI. Idempotent (10018).
   */
  async uzumReverse(body: Record<string, unknown>) {
    const serviceId = this.uzum.assertServiceId(body.serviceId);
    const transId = this.readUzumTransId(body);

    return this.pg.transaction(async (tx) => {
      const [payment] = await tx.query<PaymentRow>(
        `SELECT * FROM payments
         WHERE provider = 'uzum'
           AND (provider_reference = $1 OR idempotency_key = $2)
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [transId, `uzum:${transId}`],
      );
      if (!payment) {
        throw new UzumWebhookError(UZUM_ERROR.TRANS_NOT_FOUND, serviceId);
      }
      const pStatus = String(payment.status ?? '');
      if (pStatus === 'reversed' || pStatus === 'refunded') {
        throw new UzumWebhookError(UZUM_ERROR.ALREADY_REVERSED, serviceId);
      }
      if (pStatus !== 'processing' && pStatus !== 'paid') {
        throw new UzumWebhookError(UZUM_ERROR.CANNOT_REVERSE, serviceId);
      }

      const claimed = await tx.query<{ id: string }>(
        `INSERT INTO payment_events (id, provider, event_type, event_key, payload, payload_hash, processed_at)
         VALUES ($1, 'uzum', 'reverse', $2, $3::jsonb, $4, $5)
         ON CONFLICT (event_key) DO NOTHING
         RETURNING id`,
        [
          randomUUID(),
          `uzum:reverse:${transId}`,
          JSON.stringify(body),
          createHash('sha256').update(this.stableStringify(body)).digest('hex'),
          new Date().toISOString(),
        ],
      );
      if (claimed.length === 0) {
        throw new UzumWebhookError(UZUM_ERROR.ALREADY_REVERSED, serviceId);
      }

      const now = new Date().toISOString();
      const wasPaid = pStatus === 'paid';

      await tx.query(
        "UPDATE payments SET status = 'reversed', updated_at = $1 WHERE id = $2",
        [now, payment.id],
      );
      await tx.query(
        'UPDATE payment_events SET payment_id = $1 WHERE id = $2',
        [payment.id, claimed[0].id],
      );

      const [booking] = await tx.query<BookingRow>(
        'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
        [payment.booking_id],
      );
      if (
        booking &&
        booking.status !== BS.CANCELLED &&
        booking.status !== BS.COMPLETED &&
        booking.status !== BS.EXPIRED
      ) {
        await tx.query(
          `UPDATE bookings
           SET status = 'cancelled', cancelled_at = $1,
               cancel_reason_text = $2, expires_at = NULL, updated_at = $1
           WHERE id = $3`,
          [now, 'Uzum reverse (bank tomonidan bekor qilindi)', booking.id],
        );
        await this.recordStatusHistory(
          tx,
          booking.id,
          BS.CANCELLED,
          'payment_reversed',
        );

        if (wasPaid) {
          // Ledger kompensatsiyasi — `partner_ledger_entries.type` erkin
          // varchar(80); `booking_earned` musbat yozuvini bekor qiluvchi
          // manfiy `booking_reversed` yozuvi.
          await tx.query(
            `INSERT INTO partner_ledger_entries (id, organization_id, booking_id, type, amount, currency, created_at)
             VALUES ($1, $2, $3, 'booking_reversed', $4, $5, $6)`,
            [
              randomUUID(),
              booking.partner_organization_id,
              booking.id,
              -Number(booking.partner_payable),
              booking.currency,
              now,
            ],
          );
        }

        // Avtobus o'rindiq hold'larini bo'shatamiz (mehmonxona bronida 0 qator).
        await tx.query(
          `UPDATE trip_seats
           SET status = 'available', held_by_booking_id = NULL, held_until = NULL
           WHERE held_by_booking_id = $1 AND status = 'held'`,
          [booking.id],
        );
      }

      return this.uzum.reversed(
        serviceId,
        transId,
        this.uzum.toTiyin(Number(payment.amount)),
        {},
      );
    });
  }

  /**
   * `/status` — tranzaksiya holatini qaytaradi. READ-ONLY, deterministik
   * (Uzum `/confirm` timeout'da buni 10 martagacha so'raydi).
   */
  async uzumStatus(body: Record<string, unknown>) {
    const serviceId = this.uzum.assertServiceId(body.serviceId);
    const transId = this.readUzumTransId(body);

    const [payment] = await this.pg.query<PaymentRow>(
      `SELECT * FROM payments
       WHERE provider = 'uzum'
         AND (provider_reference = $1 OR idempotency_key = $2)
       ORDER BY created_at DESC
       LIMIT 1`,
      [transId, `uzum:${transId}`],
    );
    if (!payment) {
      throw new UzumWebhookError(UZUM_ERROR.TRANS_NOT_FOUND, serviceId);
    }

    const map: Record<string, string> = {
      pending: UZUM_STATUS.CREATED,
      awaiting_cash: UZUM_STATUS.CREATED,
      processing: UZUM_STATUS.CREATED,
      paid: UZUM_STATUS.CONFIRMED,
      reversed: UZUM_STATUS.REVERSED,
      refunded: UZUM_STATUS.REVERSED,
      failed: UZUM_STATUS.FAILED,
    };
    const status = map[String(payment.status ?? '')] ?? UZUM_STATUS.CREATED;

    const createdMs = payment.created_at
      ? Date.parse(String(payment.created_at))
      : NaN;
    const updatedMs = payment.updated_at
      ? Date.parse(String(payment.updated_at))
      : NaN;

    return this.uzum.statusResult(
      serviceId,
      transId,
      status,
      {
        transTime: Number.isFinite(createdMs) ? createdMs : null,
        confirmTime:
          status === UZUM_STATUS.CONFIRMED && Number.isFinite(updatedMs)
            ? updatedMs
            : null,
        reverseTime:
          status === UZUM_STATUS.REVERSED && Number.isFinite(updatedMs)
            ? updatedMs
            : null,
      },
      this.uzum.toTiyin(Number(payment.amount)),
      {},
    );
  }

  // ==========================================================================
  //  UZUM CHECKOUT — to'lov callback (Merchant API'dan MUTLAQO ALOHIDA).
  //  `/v1/uzum/checkout/callback` -> shu metod. Mavjud `processPaymentEvent()`
  //  (idempotentlik, amount/currency tekshiruvi, booking->confirmed, ledger)
  //  QAYTA ISHLATILADI — yangi parallel to'lov-processing mexanizmi YO'Q.
  //
  //  MUHIM: Uzum Checkout'ning rasmiy callback payload + imzo spec'i hali
  //  bizda YO'Q. Imzo controllerda `UzumCheckoutProvider.verifyCallback` orqali
  //  FAIL-CLOSED tekshiriladi; xom->ichki holat mapping bo'sh — spec kelmaguncha
  //  hech bir callback to'lovni PAID qilmaydi (`input.state !== 'PAID'`).
  // ==========================================================================

  /**
   * Normallashtirilgan Uzum Checkout callbackini idempotent qayta ishlaydi.
   *
   * Qaytish:
   *   - `{ code }` bo'lsa — rad etildi, to'lov TEGILMAYDI (`unknown_order` /
   *     `amount_mismatch` / `currency_mismatch`); controller mos 4xx qaytaradi.
   *   - aks holda — qabul qilindi: `duplicate` (takroriy callback),
   *     `applied` (haqiqatan holat o'zgardimi).
   */
  async uzumCheckoutCallback(
    input: NormalizedCheckoutCallback,
    debugHeaders?: Record<string, string>,
  ): Promise<{
    received: true;
    duplicate: boolean;
    applied: boolean;
    code?: 'unknown_order' | 'amount_mismatch' | 'currency_mismatch';
  }> {
    // 1) To'lovni topamiz — FAQAT Checkout to'lovi (`idempotency_key` prefiksi
    //    yoki `provider`). Merchant (`provider='uzum'`) to'lovi bilan
    //    aralashmaymiz.
    const idemKey = `uzum_checkout:${input.orderId}`;
    const [payment] = await this.pg.query<PaymentRow>(
      `SELECT * FROM payments
       WHERE idempotency_key = $1
          OR provider_reference = $2
          OR id::text = $3
          OR booking_id IN (SELECT id FROM bookings WHERE booking_number = $4)
       ORDER BY (status IN ('pending', 'processing')) DESC, created_at DESC
       LIMIT 1`,
      [
        idemKey,
        // Bo'sh bo'lsa hech qachon mos kelmaydigan placeholder ishlatamiz.
        // Ilgari bu yerda xom NUL bayt (`'\x00'`) bo'lgan, lekin Postgres
        // matn ustunlari o'rnatilgan NUL baytni rad etadi (driver darajasida
        // xato) — bo'sh `orderId`/`orderNumber` bilan kelgan callback butun
        // so'rovni ag'darib yuborardi. Haqiqiy `provider_reference`/
        // `booking_number` qiymatlari hech qachon shu formatga mos kelmaydi.
        input.orderId || '__uzum_checkout_no_order_id__',
        input.merchantOperationId || '00000000-0000-0000-0000-000000000000',
        input.orderNumber || '__uzum_checkout_no_order_number__',
      ],
    );

    const isCheckoutPayment =
      payment != null &&
      (String((payment as Record<string, unknown>).provider ?? '') ===
        'uzum_checkout' ||
        String(
          (payment as Record<string, unknown>).idempotency_key ?? '',
        ).startsWith('uzum_checkout:'));

    if (!payment || !isCheckoutPayment) {
      // "Callback qabul qilindi" bilan "to'lov tasdiqlandi"ni ANIQ ajratamiz:
      // order topilmasa ham xom payload yo'qolib ketmasligi kerak (QA/
      // tekshiruv uchun) — lekin hech qanday payment/booking holati
      // O'ZGARTIRILMAYDI. Bir xil noma'lum callback qayta-qayta kelsa ham
      // (Uzum retry) `event_key` UNIQUE + ON CONFLICT DO NOTHING orqali
      // faqat bitta audit qatori saqlanadi.
      const unknownKey =
        input.orderId ||
        input.orderNumber ||
        createHash('sha256')
          .update(this.stableStringify(input.raw))
          .digest('hex');
      await this.pg.query(
        `INSERT INTO payment_events
           (id, provider, event_type, event_key, payload, payload_hash, processed_at)
         VALUES ($1, 'uzum_checkout', $2, $3, $4::jsonb, $5, $6)
         ON CONFLICT (event_key) DO NOTHING`,
        [
          randomUUID(),
          'callback:unknown_order',
          `uzum_checkout:unknown:${unknownKey}`,
          JSON.stringify(this.buildCheckoutAuditPayload(input, debugHeaders)),
          createHash('sha256')
            .update(this.stableStringify(input.raw))
            .digest('hex'),
          new Date().toISOString(),
        ],
      );
      return {
        received: true,
        duplicate: false,
        applied: false,
        code: 'unknown_order',
      };
    }

    // 2) Faqat ichki `PAID` holati to'lovni tasdiqlaydi. `STATE_MAP` bo'sh
    //    ekan (spec yo'q) — bu yerga hech qachon yetib kelinmaydi.
    if (input.state !== 'PAID') {
      await this.pg.query(
        `INSERT INTO payment_events
           (id, provider, event_type, event_key, payload, payload_hash, processed_at)
         VALUES ($1, 'uzum_checkout', $2, $3, $4::jsonb, $5, $6)
         ON CONFLICT (event_key) DO NOTHING`,
        [
          randomUUID(),
          `callback:${input.state.toLowerCase()}`,
          `uzum_checkout:${input.orderId}:${input.state}`,
          JSON.stringify(this.buildCheckoutAuditPayload(input, debugHeaders)),
          createHash('sha256')
            .update(this.stableStringify(input.raw))
            .digest('hex'),
          new Date().toISOString(),
        ],
      );
      return { received: true, duplicate: false, applied: false };
    }

    // 3) PAID -> mavjud `processPaymentEvent()`ni qayta ishlatamiz:
    //    idempotentlik (`event_key` UNIQUE), amount/currency tekshiruvi,
    //    terminal-holat qo'riqchi, booking -> confirmed + `expires_at=NULL`
    //    + `booking_status_history` + partner ledger krediti.
    //
    //    MUHIM (2026-09-11 YANGILANDI): rasmiy `AcquiringCallbackData`
    //    schema'da amount/currency MAYDONI UMUMAN YO'Q (tasdiqlangan —
    //    `uzum-checkout.provider.ts` fayl boshidagi izohga qarang). Demak
    //    HAQIQIY Uzum callback'ida `input.amountSom` DEYARLI HAR DOIM `NaN`
    //    bo'ladi — va agar shuni to'g'ridan-to'g'ri `processPaymentEvent()`ga
    //    uzatsak, `assertPaymentMatchesPayload()` `amount === undefined`
    //    bo'lganda tekshiruvni JIM O'TKAZIB YUBORADI (ya'ni amount-mismatch
    //    himoyasi callback orqali AMALIYOTDA hech qachon ishlamas edi — bu
    //    haqiqiy, avval yashirin bo'lgan bo'shliq). Shu sabab callback
    //    body'siga ISHONISH O'RNIGA har doim BIZNING o'z (X-Terminal-Id/
    //    X-Api-Key bilan autentifikatsiyalangan) `getOrderStatus(orderId)`
    //    chaqiruvimiz orqali summa QAYTA TASDIQLANADI, va FAQAT shu
    //    tasdiqlangan summa quyida ishlatiladi.
    let verifiedAmountSom: number | undefined;
    try {
      const verified = await this.checkout.getOrderStatus(input.orderId);
      if (verified.state === 'PAID' && verified.amountSom !== null) {
        verifiedAmountSom = verified.amountSom;
      }
    } catch (err) {
      // `getOrderStatus`ning o'zi muvaffaqiyatsiz (tarmoq/konfiguratsiya) —
      // `UzumCheckoutError` ATAYLAB oddiy `Error`ga aylantiriladi: aks holda
      // controller uni signature-rad etish (401) deb noto'g'ri talqin
      // qilardi (`instanceof UzumCheckoutError`). Oddiy `Error` esa
      // controller'ning umumiy catch bloki orqali 500'ga tushadi — Uzum
      // buni qayta urinish signali sifatida qabul qiladi (rasmiy: max 5
      // marta), bu yerda esa hech qanday DB holati O'ZGARMAYDI.
      this.logger.warn(
        `uzum-checkout callback: getOrderStatus orqali qayta tasdiqlash ` +
          `muvaffaqiyatsiz order=${input.orderId}: ${
            err instanceof Error ? err.message : "noma'lum"
          }`,
      );
      throw new Error('uzum_checkout_status_reverify_failed');
    }

    if (verifiedAmountSom === undefined) {
      // Callback PAID deb da'vo qildi, lekin BIZNING o'z autentifikatsiyalangan
      // tekshiruvimiz (`getOrderStatus`) buni tasdiqlay olmadi (masalan hali
      // COMPLETED emas, yoki soxta/eskirgan callback) — HECH QANDAY
      // payment/booking holati o'zgarmaydi, faqat audit yoziladi. Uzum
      // rasmiy qoidaga ko'ra keyinroq qayta callback yuboradi va
      // `reconcileUzumCheckoutPayments()` cron ham mustaqil tasdiqlaydi.
      await this.pg.query(
        `INSERT INTO payment_events
           (id, provider, event_type, event_key, payload, payload_hash, processed_at)
         VALUES ($1, 'uzum_checkout', 'callback:unverified', $2, $3::jsonb, $4, $5)
         ON CONFLICT (event_key) DO NOTHING`,
        [
          randomUUID(),
          `uzum_checkout:unverified:${input.orderId}`,
          JSON.stringify(this.buildCheckoutAuditPayload(input, debugHeaders)),
          createHash('sha256')
            .update(this.stableStringify(input.raw))
            .digest('hex'),
          new Date().toISOString(),
        ],
      );
      return { received: true, duplicate: false, applied: false };
    }

    try {
      const result = (await this.processPaymentEvent(
        'uzum_checkout',
        'confirm',
        `uzum_checkout:confirm:${input.orderId}`,
        {
          booking_id: payment.booking_id,
          transaction_id: input.orderId,
          // Callback body'sidan EMAS — yuqorida `getOrderStatus()` orqali
          // mustaqil tasdiqlangan summa.
          amount: verifiedAmountSom,
          currency: input.currency,
          // To'liq xom Uzum payload + debug-safe sarlavhalar — faqat audit
          // uchun qo'shiladi, `processPaymentEvent()`ning o'z mantig'i
          // (booking_id/transaction_id/amount/currency) bu qo'shimcha
          // kalitlarni o'qimaydi/e'tiborga olmaydi.
          uzum_raw: input.raw,
          ...(debugHeaders && Object.keys(debugHeaders).length > 0
            ? { uzum_debug_headers: debugHeaders }
            : {}),
        },
      )) as { duplicate?: boolean };
      return {
        received: true,
        duplicate: Boolean(result.duplicate),
        applied: !result.duplicate,
      };
    } catch (err) {
      const code =
        (err as { response?: { code?: string } })?.response?.code ??
        (err as { code?: string })?.code;
      if (code === 'PAYMENT_AMOUNT_MISMATCH') {
        return {
          received: true,
          duplicate: false,
          applied: false,
          code: 'amount_mismatch',
        };
      }
      if (code === 'PAYMENT_CURRENCY_MISMATCH') {
        return {
          received: true,
          duplicate: false,
          applied: false,
          code: 'currency_mismatch',
        };
      }
      if (code === 'PAYMENT_NOT_FOUND') {
        return {
          received: true,
          duplicate: false,
          applied: false,
          code: 'unknown_order',
        };
      }
      throw err;
    }
  }

  /**
   * Uzum contract: `/create`dan 30 daqiqa ichida `/confirm` kelmasa —
   * tranzaksiya muvaffaqiyatsiz hisoblanadi, uni `FAILED`ga o'tkazamiz.
   * (Bron `expires_at = now+35 min` bo'lgani uchun `expireStaleBookings`
   * croni orqali ~5 daqiqadan keyin `expired`ga o'tadi.)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async failStaleUzumTransactions(): Promise<void> {
    try {
      const rows = await this.pg.query<{ id: string }>(
        `UPDATE payments
         SET status = 'failed', updated_at = now()
         WHERE provider = 'uzum'
           AND status IN ('pending', 'processing')
           AND created_at < now() - interval '30 minutes'
         RETURNING id`,
      );
      if (rows.length > 0) {
        this.logger.log(
          `${rows.length} ta Uzum tranzaksiyasi 30 daqiqada tasdiqlanmadi — 'failed'ga o'tkazildi`,
        );
      }
    } catch (error) {
      this.logger.error(
        `failStaleUzumTransactions xatosi: ${
          error instanceof Error ? error.message : 'nomaʼlum'
        }`,
      );
    }
  }

  /**
   * Uzum Checkout to'lovlarini rekonsiliatsiya qiladi — `pending`/`processing`
   * holatida qotib qolgan `provider = 'uzum_checkout'` to'lovlar uchun Uzum
   * `/payment/getOrderStatus` so'raladi va natijaga qarab:
   *   - normallashtirilgan `PAID`   -> mavjud `uzumCheckoutCallback()` oqimi
   *     (idempotentlik, booking -> confirmed, partner ledger — hammasi bir joyda);
   *   - normallashtirilgan `FAILED` -> payment `failed`.
   * Boshqa holatlar (`PENDING` / `UNKNOWN`) TEGILMAYDI.
   *
   * FAIL-CLOSED:
   *   - `checkout.isConfigured()` FALSE -> darhol no-op (fiskal env shart
   *     EMAS — `getOrderStatus()`ga kerak emas, faqat auth);
   *   - `ORDER_STATUS_MAP` FAQAT rasmiy/sandboxda tasdiqlangan `status`
   *     qiymatlarini (`REGISTERED`->PENDING, `COMPLETED`->PAID,
   *     `DECLINED`->FAILED) taniydi — boshqa har qanday qiymat xavfsiz
   *     `UNKNOWN`ga tushadi, hech narsa o'zgartirmaydi;
   *   - `getOrderStatus()` tarmoq/HTTP xatosida yoki `errorCode!=0` bo'lsa
   *     `STATUS_FAILED` throw qiladi — quyidagi catch jim o'tkazib yuboradi.
   *
   * ─────────────────────────────────────────────────────────────────────
   * 2026-09-11 YANGILANDI — ENDI `@Cron` BILAN, PRODUCTIONDA YAGONA
   * ISHONCHLI TASDIQLASH YO'LI SIFATIDA:
   * ─────────────────────────────────────────────────────────────────────
   * Uzum Checkout'ning rasmiy OpenAPI spec'i (2026-09-11 to'g'ridan-to'g'ri
   * tasdiqlangan, `uzum-checkout.provider.ts` fayl boshiga qarang) inbound
   * callback uchun HECH QANDAY signature/autentifikatsiya mexanizmi
   * TAQDIM ETMAYDI. `UzumCheckoutController.callback()` shu sababdan
   * production'da (`UZUM_CHECKOUT_SIGNATURE_SCHEME` sozlanmagan holatda)
   * HAR DOIM rad etadi (401) — bu ATAYLAB O'ZGARTIRILMAYDI ("placeholder"
   * imzo sxemasini productionga qabul qilish YO'Q). Amaliy natija: haqiqiy
   * Uzum callback'i production'da HECH QACHON to'g'ridan-to'g'ri PAID
   * holatiga OLIB KELMAYDI.
   *
   * Shuning uchun bu metod — o'zining OUTBOUND, `X-Terminal-Id`/`X-Api-Key`
   * bilan autentifikatsiyalangan `getOrderStatus()` chaqiruviga tayangani
   * uchun — production uchun YAGONA ishonchli PAID-tasdiqlash yo'li bo'lib
   * qoladi (bu callback signature'ning "o'rnini bosuvchi zaif nusxasi"
   * EMAS — aksincha KUCHLIROQ: hech qanday tasdiqlanmagan tashqi POST
   * body'siga ISHONILMAYDI, faqat bizning o'z autentifikatsiyalangan
   * so'rovimizga). `olderThanMinutes` standart qiymati shu sababdan
   * (ilgari `15`) `2`ga TUSHIRILDI — aks holda to'lov ~15 daqiqagacha
   * "pending" ko'rinib turardi. `2` daqiqa — checkout sahifasi
   * ochilishi/3DS/redirect uchun kichik xavfsizlik bo'shlig'i, lekin
   * javob tezligi uchun YETARLICHA qisqa. `@Cron(EVERY_MINUTE)` — mavjud
   * `failStaleUzumTransactions()` konvensiyasi bilan bir xil chastota.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileUzumCheckoutPaymentsCron(): Promise<void> {
    try {
      const result = await this.reconcileUzumCheckoutPayments();
      if (result.updated > 0) {
        this.logger.log(
          `uzum-checkout reconcile: ${result.scanned} ko'rildi, ${result.updated} yangilandi`,
        );
      }
    } catch (error) {
      this.logger.error(
        `reconcileUzumCheckoutPaymentsCron xatosi: ${
          error instanceof Error ? error.message : 'nomaʼlum'
        }`,
      );
    }
  }

  async reconcileUzumCheckoutPayments(
    olderThanMinutes = 2,
  ): Promise<{ scanned: number; updated: number }> {
    if (!this.checkout.isConfigured()) {
      return { scanned: 0, updated: 0 };
    }

    const rows = await this.pg.query<PaymentRow>(
      `SELECT * FROM payments
       WHERE provider = 'uzum_checkout'
         AND status IN ('pending', 'processing')
         AND created_at < now() - make_interval(mins => $1::int)
       ORDER BY created_at ASC
       LIMIT 100`,
      [Math.max(1, Math.floor(olderThanMinutes))],
    );

    let updated = 0;
    for (const payment of rows) {
      const orderId = String(payment.provider_reference ?? '');
      if (!orderId) {
        continue;
      }
      try {
        const status = await this.checkout.getOrderStatus(orderId);
        if (status.state === 'PAID') {
          await this.uzumCheckoutCallback({
            orderId,
            orderNumber: '',
            merchantOperationId: String(payment.id),
            amountSom: status.amountSom ?? Number(payment.amount),
            currency: String(payment.currency),
            state: 'PAID',
            raw: status.raw,
          });
          updated += 1;
        } else if (status.state === 'FAILED') {
          await this.pg.query(
            `UPDATE payments SET status = 'failed', updated_at = now()
             WHERE id = $1 AND status IN ('pending', 'processing')`,
            [payment.id],
          );
          updated += 1;
        }
      } catch (err) {
        // `getOrderStatus` muvaffaqiyatsiz (tarmoq/HTTP/errorCode) bo'lsa —
        // jim o'tamiz, secret log qilinmaydi (faqat orderId + xabar); keyingi
        // cron aylanishida qayta sinaladi.
        this.logger.warn(
          `uzum-checkout reconcile order=${orderId} o'tkazib yuborildi: ${
            err instanceof Error ? err.message : 'nomaʼlum'
          }`,
        );
      }
    }

    return { scanned: rows.length, updated };
  }
}
