import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { hashSecret } from '../auth/security';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus, Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import {
  isValidEmail,
  isValidUzbekPhone,
  normalizeEmail,
  normalizePhone,
} from '../common/contact-normalization';
import {
  calculateCommission,
  resolveAccommodationCommissionRate,
} from '../common/finance';
import { CURRENT_TERMS_VERSION } from '../common/legal';
import { isSlotWithinOperatingHours } from '../common/operating-hours';
import {
  activeRoomPromotionPredicate,
  calculateRoomPrice,
  type ActiveRoomPromotion,
} from '../common/room-pricing';
import {
  activeVehiclePromotionPredicate,
  calculateVehiclePrice,
  type ActiveVehiclePromotion,
} from '../common/vehicle-pricing';
import { GuestBookingAccessService } from '../common/guest-booking-access.service';
import { otpStore, type OtpChallenge } from '../auth/otp-store';
import { AppCacheService } from '../infrastructure/cache.service';
import { EmailService } from '../infrastructure/email.service';
import { SmsService } from '../infrastructure/sms.service';
import {
  PostgresService,
  type PostgresTransaction,
} from '../infrastructure/postgres.service';
import {
  calculatePromoDiscount,
  PromosService,
} from '../promos/promos.service';
import { EventsService } from '../realtime/events.service';
import { PaymentsService } from '../payments/payments.service';
import { isCardScheme } from '../payments/providers/card-scheme-fee';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function cashOtpPepper(phone: string): string {
  return `${process.env.OTP_PEPPER ?? 'safaar-dev-otp-pepper'}:booking_cash_confirm:${phone}`;
}

/**
 * DB-level booking status constants (lowercase, matching pg enum values).
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

interface HotelBookingRow {
  id: string;
  partner_organization_id: string;
}

interface HotelRoomRow {
  id: string;
  hotel_id: string;
  base_price: string | number;
  total_inventory: number;
  promotion_id?: string | null;
  promotion_old_price?: string | number | null;
  promotion_new_price?: string | number | null;
  promotion_discount_percent?: string | number | null;
  promotion_start_date?: string | null;
  promotion_end_date?: string | null;
}

interface TripRow {
  id: string;
  company_id: string;
  base_price: string | number;
}

interface TripSeatRow {
  id: string;
  seat_code: string;
  status: string;
  price: string | number;
}

interface BusCompanyRow {
  partner_organization_id: string;
}

interface VehicleRow {
  id: string;
  company_id: string;
  price_per_day: string | number;
  promotion_id?: string | null;
  promotion_old_price?: string | number | null;
  promotion_new_price?: string | number | null;
  promotion_discount_percent?: string | number | null;
  promotion_start_date?: string | null;
  promotion_end_date?: string | null;
}

export interface BookingRow {
  id: string;
  status: string;
  user_id: string | null;
  partner_organization_id: string;
  total_amount: string | number;
  currency: string;
  payment_method: string;
  expires_at?: string | null;
  booking_number?: string;
  [key: string]: unknown;
}

interface GuestContact {
  firstName: string | null;
  lastName: string | null;
  name: string;
  email: string;
  phone: string;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  /**
   * `cache`dan qurilgan yordamchi (Nest DI param EMAS — konstruktor
   * signature'i shu sabab o'zgarmadi, mavjud test fayllaridagi `new
   * BookingsService(...)` chaqiruvlari buzilmaydi). Guest-access token
   * mantig'i `PaymentsService` bilan bo'lishish uchun shu yerdan
   * `common/guest-booking-access.service.ts`ga ko'chirildi — cache-kalit
   * prefiksi/TTL/xeshlash BIR XIL saqlangan (production'da allaqachon
   * chiqarilgan tokenlar yaroqli qolishi uchun).
   */
  private readonly guestAccess: GuestBookingAccessService;

  constructor(
    private readonly pg: PostgresService,
    private readonly events: EventsService,
    private readonly emailService: EmailService,
    private readonly promosService: PromosService,
    private readonly paymentsService: PaymentsService,
    private readonly cache: AppCacheService,
    @Optional() private readonly smsService?: SmsService,
  ) {
    this.guestAccess = new GuestBookingAccessService(cache);
  }

  /**
   * `Idempotency-Key` header orqali booking-yaratish so'rovlarini
   * dublikatsiyadan himoya qiladi (PHASE 14G, PHASE 14F'da aniqlangan
   * MEDIUM topilma). `bookings` jadvalida bu maqsad uchun ustun/UNIQUE
   * constraint YO'Q va migration bu fazada ataylab qo'llanilmadi —
   * shuning uchun mavjud, allaqachon production'da ishlatilayotgan
   * Redis-backed `AppCacheService.getOrSet()` primitividan foydalaniladi
   * (parol-tiklash tokenlari uchun ham xuddi shu servis ishlatiladi).
   *
   * Xatti-harakat:
   *  - Header YO'Q  → eskicha ishlaydi (orqaga qarab to'liq moslashuvchan,
   *    hech qanday mavjud client buzilmaydi).
   *  - BIR XIL kalit + BIR XIL so'rov tanasi (SHA-256 fingerprint) →
   *    ikkinchi marta booking YARATILMAYDI, birinchi natija qaytariladi.
   *  - BIR XIL kalit + BOSHQA so'rov tanasi → 409 CONFLICT (rad etiladi).
   *  - Parallel (bir vaqtdagi) so'rovlar — `getOrSet`ning ichki
   *    `inFlight` xaritasi orqali bitta ijro natijasini bo'lishadi
   *    (bitta backend instance doirasida — hozirgi production topologiyasi
   *    aynan shunday, bitta instance; gorizontal masshtablashda bu
   *    kafolat instance-lararo TO'LIQ atomik bo'lmaydi — bu mavjud
   *    `getOrSet` utilitasining hujjatlashtirilgan chegarasi, PHASE 14G
   *    tomonidan yaratilmagan).
   *  - Kalit har doim `actor.id` (yoki mehmon-checkout uchun `'guest'`)
   *    bilan bog'lanadi — boshqa foydalanuvchining kaliti bilan
   *    to'qnashuv MUMKIN EMAS.
   */
  private async withIdempotency<T>(
    actor: RequestActor | undefined,
    idempotencyKey: string | undefined,
    body: Record<string, unknown>,
    create: () => Promise<T>,
  ): Promise<T> {
    const key = idempotencyKey?.trim();
    if (!key) {
      return create();
    }
    if (key.length > 200) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_INVALID',
        message: 'Idempotency-Key qiymati juda uzun',
      });
    }

    // Mehmon (guest) checkout'da actor yo'q — bu holatda "guest" scope
    // ishlatiladi. Bu — ro'yxatdan o'tgan foydalanuvchilarga qaraganda
    // kuchsizroq izolyatsiya (barcha mehmon so'rovlari bitta "guest"
    // scope'ni bo'lishadi), lekin bu yerda ham qat'iy per-IP `@Throttle`
    // (10/min) allaqachon amal qiladi — shu bilan birga ikkalasi
    // to'ldiradi.
    const scope = actor?.id ?? 'guest';
    const cacheKey = `idem:booking:${scope}:${key}`;
    const bodyFingerprint = this.stableHash(body);

    const claim = await this.cache.get<{ fingerprint: string }>(
      `${cacheKey}:fp`,
    );
    if (claim && claim.fingerprint !== bodyFingerprint) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message:
          "Bu Idempotency-Key allaqachon boshqa so'rov tanasi bilan ishlatilgan",
      });
    }
    if (!claim) {
      await this.cache.set(
        `${cacheKey}:fp`,
        { fingerprint: bodyFingerprint },
        600,
      );
    }

    return this.cache.getOrSet(cacheKey, 600, create);
  }

  private stableHash(value: unknown): string {
    return createHash('sha256')
      .update(this.stableStringify(value))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(
        ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
      );
      return `{${entries
        .map(([k, v]) => `${JSON.stringify(k)}:${this.stableStringify(v)}`)
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }

  /**
   * `expires_at`si o'tib ketgan, hali `pending`/`awaiting_payment`
   * holatidagi bronlarni `expired`ga o'tkazadi va ularga bog'langan
   * (avtobus) o'rindiqlarni bo'shatadi. Avval bu ustunlar yozilardi,
   * lekin hech qanday jarayon o'qib harakat qilmasdi — bronlar/o'rindiqlar
   * abadiy "band" holida qolib ketardi.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleBookings(): Promise<void> {
    try {
      const { expired, unconfirmed } = await this.pg.transaction(async (tx) => {
        const now = new Date().toISOString();
        const rows = await tx.query<BookingRow>(
          `UPDATE bookings
           SET status = $1, updated_at = $2
           WHERE status IN ($3, $4)
             AND expires_at IS NOT NULL
             AND expires_at < $2
             AND NOT EXISTS (
               SELECT 1 FROM payments p
               WHERE p.booking_id = bookings.id
                 AND (
                   p.status = 'paid'
                   OR (p.status = 'processing' AND p.created_at > $2::timestamptz - interval '5 minutes')
                 )
             )
           RETURNING *`,
          [BS.EXPIRED, now, BS.PENDING, BS.AWAITING_PAYMENT],
        );

        if (rows.length > 0) {
          const bookingIds = rows.map((row) => row.id);
          await tx.query(
            `UPDATE trip_seats
             SET status = 'available', held_by_booking_id = NULL, held_until = NULL
             WHERE held_by_booking_id = ANY($1::uuid[])`,
            [bookingIds],
          );

          for (const row of rows) {
            await this.addStatusHistory(tx, row, 'expired');
          }
        }

        // To'lov qilingan, lekin hamkor `request_confirmation` bosqichida
        // belgilangan muddat ichida javob bermagan bronlar — bu holat
        // avval umuman ishlanmas edi (`awaiting_partner_confirmation`
        // hech qachon avtomatik tugatilmasdi, mijoz pulini to'lab abadiy
        // "javob kutmoqda" holatida osilib qolishi mumkin edi). Pul
        // haqiqatan kelgan bo'lgani uchun bekor qilish bilan birga
        // avtomatik qaytarish so'rovi ham ochiladi.
        const unconfirmedRows = await tx.query<BookingRow>(
          `UPDATE bookings
           SET status = $1, cancelled_at = $2, cancel_reason_text = $3, updated_at = $2
           WHERE status = $4
             AND partner_confirmation_deadline IS NOT NULL
             AND partner_confirmation_deadline < $2
           RETURNING *`,
          [
            BS.CANCELLED,
            now,
            'Hamkor tasdiqlash muddatida javob bermadi — tizim tomonidan avtomatik bekor qilindi',
            BS.AWAITING_PARTNER_CONFIRMATION,
          ],
        );

        for (const row of unconfirmedRows) {
          await this.addStatusHistory(
            tx,
            row,
            'auto_cancelled_partner_confirmation_timeout',
          );
          const [payment] = await tx.query<{
            id: string;
            amount: number | string;
            currency: string;
          }>(
            `SELECT id, amount, currency FROM payments
             WHERE booking_id = $1 AND status = 'paid'
             ORDER BY created_at DESC LIMIT 1`,
            [row.id],
          );
          if (payment) {
            await tx.query(
              `INSERT INTO refunds (id, booking_id, user_id, status, currency, requested_amount, reason, created_at, updated_at)
               VALUES ($1, $2, $3, 'requested', $4, $5, $6, $7, $7)`,
              [
                randomUUID(),
                row.id,
                row.user_id,
                payment.currency,
                Number(payment.amount),
                "Tizim: hamkor tasdiqlash muddatida javob bermadi — avtomatik qaytarish so'rovi",
                now,
              ],
            );
          }
        }

        return { expired: rows, unconfirmed: unconfirmedRows };
      });

      for (const booking of expired) {
        this.events.bookingStatusChanged(booking);
        this.events.partnerDashboardUpdated(booking.partner_organization_id);
      }
      for (const booking of unconfirmed) {
        this.events.bookingStatusChanged(booking);
        this.events.partnerDashboardUpdated(booking.partner_organization_id);
      }
      if (expired.length > 0 || unconfirmed.length > 0) {
        this.events.adminDashboardUpdated();
      }
      if (expired.length > 0) {
        this.logger.log(
          `${expired.length} ta muddati o'tgan bron 'expired'ga o'tkazildi`,
        );
      }
      if (unconfirmed.length > 0) {
        this.logger.log(
          `${unconfirmed.length} ta hamkor tasdiqlamagan bron avtomatik bekor qilindi va qaytarish so'rovi ochildi`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Bron muddati tekshiruvida xatolik: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Foydalanuvchi yoki mehmon no-show (kelmaganlik) sababli 60 kunga
   * bloklanganligini tekshiradi. Agar blok muddati hali tugamagan bo'lsa,
   * har qanday yangi bron qilish darhol 403 Forbidden bilan to'xtatiladi.
   */
  async assertUserNotBlockedFromBooking(
    actor: RequestActor | undefined,
    phone?: string | null,
    email?: string | null,
  ): Promise<void> {
    const rawActorId = actor?.id ? String(actor.id).trim() : null;
    const userId = rawActorId && isUuid(rawActorId) ? rawActorId : null;
    const normalizedPhone =
      phone && isValidUzbekPhone(normalizePhone(phone))
        ? normalizePhone(phone)
        : null;
    const rawEmail = email ? String(email).trim() : null;
    const normalizedEmail =
      rawEmail && isValidEmail(rawEmail) ? normalizeEmail(rawEmail) : null;

    // 1. users jadvalida tekshirish
    if (userId || normalizedPhone || normalizedEmail) {
      const userRows = await this.pg.query<{
        id: string;
        booking_blocked_until: string | null;
        booking_blocked_reason: string | null;
      }>(
        `SELECT id, booking_blocked_until, booking_blocked_reason
         FROM users
         WHERE (
           ($1::uuid IS NOT NULL AND id = $1::uuid)
           OR ($2::text IS NOT NULL AND phone = $2::text)
           OR ($3::text IS NOT NULL AND lower(email) = lower($3::text))
         )
         AND booking_blocked_until IS NOT NULL
         AND booking_blocked_until > NOW()
         ORDER BY booking_blocked_until DESC
         LIMIT 1`,
        [userId, normalizedPhone, normalizedEmail],
      );

      if (userRows[0]?.booking_blocked_until) {
        const until = new Date(userRows[0].booking_blocked_until).toISOString();
        throw new ForbiddenException({
          code: 'USER_BOOKING_BLOCKED',
          message: `Siz avvalgi naqd to‘lovli broningizga kelmaganligingiz sababli 60 kunga bron qilishdan bloklangansiz. Blok muddati: ${until} gacha`,
          blocked_until: until,
          reason: userRows[0].booking_blocked_reason ?? 'no_show',
        });
      }
    }

    // 2. booking_penalties jadvalida tekshirish (telefon yoki user bo'yicha)
    if (userId || normalizedPhone) {
      try {
        const penaltyRows = await this.pg.query<{
          blocked_until: string;
          reason: string;
        }>(
          `SELECT blocked_until, reason
           FROM booking_penalties
           WHERE (
             ($1::uuid IS NOT NULL AND user_id = $1::uuid)
             OR ($2::text IS NOT NULL AND phone = $2::text)
           )
           AND blocked_until > NOW()
           ORDER BY blocked_until DESC
           LIMIT 1`,
          [userId, normalizedPhone],
        );

        if (penaltyRows[0]?.blocked_until) {
          const until = new Date(penaltyRows[0].blocked_until).toISOString();
          throw new ForbiddenException({
            code: 'USER_BOOKING_BLOCKED',
            message: `Siz avvalgi naqd to‘lovli broningizga kelmaganligingiz sababli 60 kunga bron qilishdan bloklangansiz. Blok muddati: ${until} gacha`,
            blocked_until: until,
            reason: penaltyRows[0].reason ?? 'no_show',
          });
        }
      } catch (err: unknown) {
        if (err instanceof ForbiddenException) {
          throw err;
        }
        this.logger.debug?.(
          `booking_penalties tekshiruvi: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  private isDemoAuthEnabled(): boolean {
    return String(process.env.ENABLE_DEMO_AUTH ?? '').toLowerCase() === 'true';
  }

  private isPhoneAllowedForDemoAuth(phone: string): boolean {
    const raw = process.env.DEMO_AUTH_ALLOWED_PHONES;
    if (!raw) return false;
    const allowed = raw
      .split(',')
      .map((entry) => normalizePhone(entry.trim()))
      .filter((entry) => isValidUzbekPhone(entry));
    return allowed.includes(phone);
  }

  private async saveCashOtpToCache(phone: string, challenge: OtpChallenge) {
    const payload = {
      challengeId: challenge.id,
      phone,
      codeHash: challenge.codeHash,
      attempts: 0,
      expiresAt: Date.now() + 180_000, // 3 minutes
      createdAt: challenge.createdAt,
    };
    try {
      await this.cache.set(`booking:cash-otp:phone:${phone}`, payload, 180);
      await this.cache.set(
        `booking:cash-otp:challenge:${challenge.id}`,
        payload,
        180,
      );
    } catch (err) {
      this.logger.warn(`Failed to save cash OTP to cache: ${err}`);
    }
  }

  private async clearCashOtpFromCache(phone?: string, challengeId?: string) {
    try {
      let resolvedPhone = phone;
      let resolvedChallengeId = challengeId;

      if (!resolvedChallengeId && resolvedPhone) {
        const entry = await this.cache.get<{ challengeId?: string }>(
          `booking:cash-otp:phone:${resolvedPhone}`,
        );
        if (entry?.challengeId) {
          resolvedChallengeId = entry.challengeId;
        }
      } else if (!resolvedPhone && resolvedChallengeId) {
        const entry = await this.cache.get<{ phone?: string }>(
          `booking:cash-otp:challenge:${resolvedChallengeId}`,
        );
        if (entry?.phone) {
          resolvedPhone = entry.phone;
        }
      }

      if (resolvedPhone) {
        await this.cache.del(`booking:cash-otp:phone:${resolvedPhone}`);
      }
      if (resolvedChallengeId) {
        await this.cache.del(
          `booking:cash-otp:challenge:${resolvedChallengeId}`,
        );
      }
    } catch {
      // ignore
    }
  }

  async sendCashBookingOtp(
    actor: RequestActor | undefined,
    rawPhone: string,
  ): Promise<{
    challenge_id: string;
    phone: string;
    resend_after: number;
    dev_code?: string;
  }> {
    const phone = normalizePhone(rawPhone);
    if (!isValidUzbekPhone(phone)) {
      throw new BadRequestException({
        code: 'INVALID_PHONE',
        message:
          "Noto'g'ri telefon raqami. Format: +998XXXXXXXXX bo'lishi kerak",
      });
    }

    // Bloklangan foydalanuvchiga SMS yuborib mablag' sarflamaymiz
    await this.assertUserNotBlockedFromBooking(actor, phone);

    let challenge: OtpChallenge;
    try {
      challenge = otpStore.create(phone, 'booking_cash_confirm');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'OTP_RESEND_TOO_SOON') {
        throw new BadRequestException({
          code: 'OTP_RESEND_TOO_SOON',
          message: 'Kodni qayta yuborish uchun biroz kuting',
        });
      }
      if (msg === 'OTP_RATE_LIMITED') {
        throw new BadRequestException({
          code: 'OTP_RATE_LIMITED',
          message: 'SMS yuborish limiti oshib ketdi, keyinroq urinib ko‘ring',
        });
      }
      throw err;
    }

    const code = otpStore.getDeliveryCode(challenge.id);

    // Redis/kesh orqali 2-3 daqiqa (180s) saqlaymiz
    await this.saveCashOtpToCache(phone, challenge);

    if (
      this.isDemoAuthEnabled() ||
      this.isPhoneAllowedForDemoAuth(phone) ||
      !this.smsService
    ) {
      return {
        challenge_id: challenge.id,
        phone,
        resend_after: challenge.resendAfter,
        dev_code: code,
      };
    }

    try {
      const smsText = process.env.TEXTUP_TEMPLATE_ID
        ? `Safaar ilovasiga uchun tasdiqlash kodi: ${code ?? '******'}`
        : `Safaar: Naqd to'lovli bronni tasdiqlash kodi: ${code ?? '******'}`;
      const delivery = await this.smsService.send({
        phone,
        text: smsText,
      });
      if (!delivery.accepted) {
        otpStore.cancel(challenge.id, phone, 'booking_cash_confirm');
        await this.clearCashOtpFromCache(phone, challenge.id);
        throw new ServiceUnavailableException({
          code: 'SMS_DELIVERY_FAILED',
          message: 'Tasdiqlash kodini SMS orqali yuborib bo‘lmadi',
        });
      }
    } catch (error) {
      otpStore.cancel(challenge.id, phone, 'booking_cash_confirm');
      await this.clearCashOtpFromCache(phone, challenge.id);
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      this.logger.error(
        `SMS OTP delivery error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException({
        code: 'SMS_DELIVERY_FAILED',
        message: 'Tasdiqlash kodini SMS orqali yuborib bo‘lmadi',
      });
    }

    return {
      challenge_id: challenge.id,
      phone,
      resend_after: challenge.resendAfter,
    };
  }

  verifyCashBookingOtp(
    phone: string,
    code: string,
    challengeId?: string,
  ): void {
    if (!code || typeof code !== 'string' || !code.trim()) {
      throw new BadRequestException({
        code: 'OTP_REQUIRED',
        message: 'SMS tasdiqlash kodini kiriting',
      });
    }
    const normalizedPhone = normalizePhone(phone);
    if (!isValidUzbekPhone(normalizedPhone)) {
      throw new BadRequestException({
        code: 'INVALID_PHONE',
        message:
          "Noto'g'ri telefon raqami. Format: +998XXXXXXXXX bo'lishi kerak",
      });
    }
    try {
      otpStore.consume({
        phone: normalizedPhone,
        purpose: 'booking_cash_confirm',
        code: code.trim(),
        challengeId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'OTP_EXPIRED') {
        throw new BadRequestException({
          code: 'OTP_EXPIRED',
          message: 'Tasdiqlash kodi muddati o‘tgan, yangi kod so‘rang',
        });
      }
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'Tasdiqlash kodi noto‘g‘ri',
      });
    }
  }

  async verifyAndConsumeCashBookingOtp(
    phone: string,
    code: string,
    challengeId?: string,
  ): Promise<void> {
    if (!code || typeof code !== 'string' || !code.trim()) {
      throw new BadRequestException({
        code: 'OTP_REQUIRED',
        message: 'SMS tasdiqlash kodini kiriting',
      });
    }
    const normalizedPhone = normalizePhone(phone);
    if (!isValidUzbekPhone(normalizedPhone)) {
      throw new BadRequestException({
        code: 'INVALID_PHONE',
        message:
          "Noto'g'ri telefon raqami. Format: +998XXXXXXXXX bo'lishi kerak",
      });
    }

    let consumedInStore = false;
    let storeError: BadRequestException | undefined;
    try {
      this.verifyCashBookingOtp(normalizedPhone, code, challengeId);
      consumedInStore = true;
    } catch (err) {
      if (err instanceof BadRequestException) {
        const resp = err.getResponse() as Record<string, unknown>;
        if (resp.code === 'OTP_REQUIRED' || resp.code === 'INVALID_PHONE') {
          throw err;
        }
        storeError = err;
      } else {
        throw err;
      }
    }

    if (!consumedInStore) {
      const cacheKey = challengeId
        ? `booking:cash-otp:challenge:${challengeId}`
        : `booking:cash-otp:phone:${normalizedPhone}`;
      const entry = await this.cache.get<{
        challengeId: string;
        phone: string;
        codeHash: string;
        attempts: number;
        expiresAt: number;
      }>(cacheKey);

      if (!entry || Date.now() >= entry.expiresAt) {
        await this.clearCashOtpFromCache(normalizedPhone, challengeId);
        if (storeError) {
          const resp = storeError.getResponse() as Record<string, unknown>;
          if (resp.code === 'OTP_INVALID') {
            throw storeError;
          }
        }
        throw new BadRequestException({
          code: 'OTP_EXPIRED',
          message: 'Tasdiqlash kodi muddati o‘tgan, yangi kod so‘rang',
        });
      }

      entry.attempts = (entry.attempts || 0) + 1;
      const expectedHash = hashSecret(
        code.trim(),
        cashOtpPepper(normalizedPhone),
      );

      const resolvedChallengeId = entry.challengeId || challengeId;

      if (
        entry.attempts > 5 ||
        !constantTimeEqual(entry.codeHash, expectedHash)
      ) {
        if (entry.attempts > 5) {
          await this.clearCashOtpFromCache(
            normalizedPhone,
            resolvedChallengeId,
          );
        } else {
          await this.cache.set(
            `booking:cash-otp:phone:${normalizedPhone}`,
            entry,
            180,
          );
          if (resolvedChallengeId) {
            await this.cache.set(
              `booking:cash-otp:challenge:${resolvedChallengeId}`,
              entry,
              180,
            );
          }
        }
        throw new BadRequestException({
          code: 'OTP_INVALID',
          message: 'Tasdiqlash kodi noto‘g‘ri',
        });
      }

      await this.clearCashOtpFromCache(normalizedPhone, resolvedChallengeId);
      return;
    }

    await this.clearCashOtpFromCache(normalizedPhone, challengeId);
  }

  private async validateCashBookingOtpIfNeeded(
    dto: Record<string, unknown>,
    phone: string,
    actor?: RequestActor,
  ): Promise<(() => Promise<void>) | void> {
    const paymentMethod = this.paymentMethod(
      dto.payment_method ?? dto.paymentMethod,
    );
    if (paymentMethod !== 'cash') {
      return;
    }

    if (!actor && (!phone || !phone.trim())) {
      throw new BadRequestException({
        code: 'PHONE_REQUIRED',
        message:
          'Naqd to‘lov bilan bron qilish uchun telefon raqami kiritilishi shart',
      });
    }

    const verificationToken = String(
      dto.verification_token ?? dto.verificationToken ?? '',
    ).trim();

    if (verificationToken) {
      const cached = await this.cache.get<{
        phone: string;
        verified_at: string;
      }>(`booking:cash-verified:${verificationToken}`);

      if (cached && normalizePhone(cached.phone) === normalizePhone(phone)) {
        return async () => {
          await this.cache.del(`booking:cash-verified:${verificationToken}`);
        };
      }
      throw new BadRequestException({
        code: 'OTP_TOKEN_INVALID',
        message: 'Tasdiqlash tokeni eskirgan yoki noto‘g‘ri',
      });
    }

    const otpCode = String(dto.otp_code ?? dto.otpCode ?? '').trim();
    const challengeId =
      (dto.challenge_id ?? dto.challengeId)
        ? String(dto.challenge_id ?? dto.challengeId)
        : undefined;

    if (otpCode) {
      await this.verifyAndConsumeCashBookingOtp(phone, otpCode, challengeId);
      return;
    }

    const isGuestBookingWithPhone = !actor && Boolean(phone);
    const isEnforced =
      String(process.env.ENFORCE_CASH_OTP ?? '').toLowerCase() === 'true';

    if (isGuestBookingWithPhone || isEnforced) {
      throw new BadRequestException({
        code: 'OTP_REQUIRED',
        message:
          'Naqd to‘lov bilan bron qilish uchun telefon raqamiga yuborilgan SMS kodni tasdiqlash shart',
      });
    }
  }

  async sendCashOtpForBooking(
    actor: RequestActor | undefined,
    bookingId: string,
    guestToken?: string,
  ) {
    const booking = await this.assertBooking(bookingId, actor, guestToken);
    if (booking.status === BS.CONFIRMED || booking.status === BS.COMPLETED) {
      throw new UnprocessableEntityException({
        code: 'BOOKING_ALREADY_CONFIRMED',
        message: 'Bron allaqachon tasdiqlangan',
      });
    }
    if (booking.status === BS.CANCELLED) {
      throw new UnprocessableEntityException({
        code: 'BOOKING_CANCELLED',
        message: 'Bekor qilingan bron uchun OTP kod yuborib bo‘lmaydi',
      });
    }
    if (booking.status === BS.EXPIRED) {
      throw new UnprocessableEntityException({
        code: 'BOOKING_EXPIRED',
        message: 'Muddati o‘tgan bron uchun OTP kod yuborib bo‘lmaydi',
      });
    }

    const rawPhone =
      (typeof booking.guest_phone === 'string' && booking.guest_phone) ||
      (actor ? await this.getUserPhone(actor.id) : null);
    if (!rawPhone) {
      throw new BadRequestException({
        code: 'PHONE_REQUIRED',
        message: 'Naqd to‘lov uchun telefon raqami ko‘rsatilmagan',
      });
    }

    return this.sendCashBookingOtp(actor, String(rawPhone));
  }

  private async executeCashBookingConfirmation(
    booking: BookingRow,
    actor?: RequestActor,
  ): Promise<{
    booking: BookingRow;
    payment?: Record<string, unknown>;
    guestAccessToken?: string;
  }> {
    const now = new Date().toISOString();
    const result = await this.pg.transaction(async (tx) => {
      const nextStatus =
        booking.confirmation_mode === 'request_confirmation'
          ? BS.AWAITING_PARTNER_CONFIRMATION
          : BS.CONFIRMED;

      const [updated] = await tx.query<BookingRow>(
        `UPDATE bookings
         SET status = $1, payment_method = 'cash', confirmed_at = $2, expires_at = NULL, updated_at = $2
         WHERE id = $3
         RETURNING *`,
        [nextStatus, now, booking.id],
      );

      const [existingPayment] = await tx.query<{ id: string }>(
        `SELECT id FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [booking.id],
      );

      let payment: Record<string, unknown> | undefined;
      if (existingPayment) {
        const [updatedPayment] = await tx.query<Record<string, unknown>>(
          `UPDATE payments SET provider = 'cash', status = 'awaiting_cash', updated_at = $1 WHERE id = $2 RETURNING *`,
          [now, existingPayment.id],
        );
        payment = updatedPayment;
      } else {
        const [newPayment] = await tx.query<Record<string, unknown>>(
          `INSERT INTO payments (id, booking_id, provider, status, amount, base_amount, fee_rate, fee_amount, currency, created_at, updated_at)
           VALUES ($1, $2, 'cash', 'awaiting_cash', $3, $3, 0, 0, $4, $5, $5)
           RETURNING *`,
          [
            randomUUID(),
            booking.id,
            Number(booking.total_amount),
            booking.currency || 'UZS',
            now,
          ],
        );
        payment = newPayment;
      }

      await this.addStatusHistory(
        tx,
        { id: booking.id, status: nextStatus },
        'cash_booking_confirmed',
        actor,
      );

      return {
        booking: updated,
        payment,
      };
    });

    this.events.bookingStatusChanged(result.booking);
    this.events.partnerDashboardUpdated(result.booking.partner_organization_id);
    this.events.adminDashboardUpdated();
    void this.sendBookingConfirmationEmail(result.booking);

    const guestAccessToken = result.booking.user_id
      ? undefined
      : await this.issueGuestBookingAccessToken(result.booking.id);

    return {
      ...result,
      guestAccessToken,
    };
  }

  async confirmCashBooking(
    actor: RequestActor | undefined,
    bookingId: string,
    dto: {
      otp_code?: string;
      otpCode?: string;
      challenge_id?: string;
      challengeId?: string;
      phone?: string;
    },
    guestToken?: string,
  ) {
    const booking = await this.assertBooking(bookingId, actor, guestToken);
    if (booking.status === BS.CONFIRMED || booking.status === BS.COMPLETED) {
      throw new UnprocessableEntityException({
        code: 'BOOKING_ALREADY_CONFIRMED',
        message: 'Bron allaqachon tasdiqlangan',
      });
    }
    if (booking.status === BS.CANCELLED) {
      throw new UnprocessableEntityException({
        code: 'BOOKING_CANCELLED',
        message: 'Bekor qilingan bronni tasdiqlab bo‘lmaydi',
      });
    }
    if (booking.status === BS.EXPIRED) {
      throw new UnprocessableEntityException({
        code: 'BOOKING_EXPIRED',
        message: 'Muddati o‘tgan bronni tasdiqlab bo‘lmaydi',
      });
    }

    const rawPhone =
      dto.phone ||
      (typeof booking.guest_phone === 'string' && booking.guest_phone) ||
      (actor ? await this.getUserPhone(actor.id) : null);
    if (!rawPhone) {
      throw new BadRequestException({
        code: 'PHONE_REQUIRED',
        message: 'Naqd to‘lov uchun telefon raqami ko‘rsatilmagan',
      });
    }

    const phone = normalizePhone(String(rawPhone));
    if (
      booking.guest_phone &&
      normalizePhone(String(booking.guest_phone)) !== phone
    ) {
      throw new ForbiddenException({
        code: 'PHONE_MISMATCH',
        message: 'Kiritilgan telefon raqami bron ma‘lumotlariga mos kelmadi',
      });
    }

    await this.assertUserNotBlockedFromBooking(actor, phone);

    const code = String(dto.otp_code ?? dto.otpCode ?? '').trim();
    if (!code) {
      throw new BadRequestException({
        code: 'OTP_REQUIRED',
        message: 'SMS tasdiqlash kodini kiriting',
      });
    }

    const challengeId = dto.challenge_id ?? dto.challengeId;
    await this.verifyAndConsumeCashBookingOtp(phone, code, challengeId);

    return this.executeCashBookingConfirmation(booking, actor);
  }

  async verifyCashOtp(
    actor: RequestActor | undefined,
    dto: {
      phone: string;
      otp_code?: string;
      otpCode?: string;
      challenge_id?: string;
      challengeId?: string;
      booking_id?: string;
      bookingId?: string;
    },
    guestToken?: string,
  ) {
    const rawPhone = dto.phone;
    if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
      throw new BadRequestException({
        code: 'PHONE_REQUIRED',
        message: 'Telefon raqamini kiriting',
      });
    }

    const phone = normalizePhone(rawPhone);
    if (!isValidUzbekPhone(phone)) {
      throw new BadRequestException({
        code: 'INVALID_PHONE',
        message:
          "Noto'g'ri telefon raqami. Format: +998XXXXXXXXX bo'lishi kerak",
      });
    }

    const code = String(dto.otp_code ?? dto.otpCode ?? '').trim();
    if (!code) {
      throw new BadRequestException({
        code: 'OTP_REQUIRED',
        message: 'SMS tasdiqlash kodini kiriting',
      });
    }

    const challengeId = dto.challenge_id ?? dto.challengeId;
    const bookingId = dto.booking_id ?? dto.bookingId;

    await this.assertUserNotBlockedFromBooking(actor, phone);

    if (bookingId) {
      const [booking] = await this.pg.query<BookingRow>(
        'SELECT * FROM bookings WHERE id = $1',
        [bookingId],
      );
      if (!booking) {
        throw new NotFoundException({
          code: 'BOOKING_NOT_FOUND',
          message: 'Bron topilmadi',
        });
      }

      if (booking.status === BS.CONFIRMED || booking.status === BS.COMPLETED) {
        throw new UnprocessableEntityException({
          code: 'BOOKING_ALREADY_CONFIRMED',
          message: 'Bron allaqachon tasdiqlangan',
        });
      }
      if (booking.status === BS.CANCELLED) {
        throw new UnprocessableEntityException({
          code: 'BOOKING_CANCELLED',
          message: 'Bekor qilingan bronni tasdiqlab bo‘lmaydi',
        });
      }
      if (booking.status === BS.EXPIRED) {
        throw new UnprocessableEntityException({
          code: 'BOOKING_EXPIRED',
          message: 'Muddati o‘tgan bronni tasdiqlab bo‘lmaydi',
        });
      }

      if (actor) {
        if (
          actor.role !== Role.SUPER_ADMIN &&
          actor.actorType !== 'admin' &&
          booking.user_id !== actor.id
        ) {
          throw new ForbiddenException({
            code: 'FORBIDDEN',
            message: 'Bu bronni tasdiqlash uchun ruxsat yo‘q',
          });
        }
      } else {
        if (booking.user_id) {
          throw new UnauthorizedException({
            code: 'AUTH_TOKEN_REQUIRED',
            message: 'Foydalanuvchi hisobiga kirish talab etiladi',
          });
        }
        const bookingPhone = booking.guest_phone
          ? normalizePhone(String(booking.guest_phone))
          : '';
        let guestTokenValid = false;
        if (guestToken) {
          const grantedBookingId =
            await this.resolveGuestBookingAccessTokenBookingId(guestToken);
          guestTokenValid = grantedBookingId === booking.id;
        }
        if (!guestTokenValid && bookingPhone !== phone) {
          throw new ForbiddenException({
            code: 'PHONE_MISMATCH',
            message:
              'Kiritilgan telefon raqami bron ma‘lumotlariga mos kelmadi',
          });
        }
      }

      // ONLY consume OTP AFTER all validations pass!
      await this.verifyAndConsumeCashBookingOtp(phone, code, challengeId);

      const result = await this.executeCashBookingConfirmation(booking, actor);

      return {
        success: true,
        message: 'Broningiz muvaffaqiyatli tasdiqlandi',
        status: result.booking.status,
        ...result,
      };
    }

    // Pre-validation oqimi (bookingId yo'q bo'lganda)
    await this.verifyAndConsumeCashBookingOtp(phone, code, challengeId);

    const verificationToken = randomBytes(24).toString('base64url');
    await this.cache.set(
      `booking:cash-verified:${verificationToken}`,
      { phone, verified_at: new Date().toISOString() },
      600, // 10 minutes
    );

    return {
      success: true,
      message: 'Telefon raqami muvaffaqiyatli tasdiqlandi',
      verified: true,
      phone,
      verification_token: verificationToken,
    };
  }

  private async getUserPhone(userId: string): Promise<string | null> {
    if (!isUuid(userId)) return null;
    const [row] = await this.pg.query<{ phone: string | null }>(
      `SELECT phone FROM users WHERE id = $1::uuid`,
      [userId],
    );
    return row?.phone ?? null;
  }

  async applyNoShowPenalty(
    bookingId: string,
    reason = 'Mijoz kelmadi (No-show)',
    actor?: RequestActor,
  ) {
    if (!isUuid(bookingId)) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Bron topilmadi',
      });
    }

    const [booking] = await this.pg.query<
      BookingRow & {
        guest_phone: string | null;
        user_id: string | null;
      }
    >(
      `SELECT id, user_id, guest_phone, status, partner_organization_id, payment_method
       FROM bookings WHERE id = $1::uuid`,
      [bookingId],
    );

    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Bron topilmadi',
      });
    }

    // Role va tashkilot tekshiruvi: Agar actor berilgan bo'lsa
    if (actor) {
      const isSuperAdmin =
        actor.role === Role.SUPER_ADMIN || actor.actorType === 'admin';
      if (!isSuperAdmin) {
        if (
          actor.actorType === 'partner' &&
          booking.partner_organization_id !== actor.organizationId
        ) {
          throw new ForbiddenException({
            code: 'BOOKING_FORBIDDEN',
            message: 'Bu bron sizning tashkilotingizga tegishli emas',
          });
        }
        if (actor.actorType !== 'partner') {
          throw new ForbiddenException({
            code: 'BOOKING_FORBIDDEN',
            message:
              'Faqat hamkor yoki admin no-show jarimasini qo‘llashi mumkin',
          });
        }
      }
    }

    if (booking.status === BS.CANCELLED) {
      throw new ConflictException({
        code: 'BOOKING_ALREADY_CANCELLED',
        message: 'Bron allaqachon bekor qilingan',
      });
    }

    if (booking.status === BS.COMPLETED) {
      throw new ConflictException({
        code: 'BOOKING_ALREADY_COMPLETED',
        message: 'Bron allaqachon yakunlangan',
      });
    }

    const now = new Date().toISOString();
    const penaltyDays = 60;
    const blockedUntil = new Date(
      Date.now() + penaltyDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const phone = booking.guest_phone
      ? normalizePhone(booking.guest_phone)
      : null;
    const rawUserId = booking.user_id ? String(booking.user_id).trim() : null;
    const userId = rawUserId && isUuid(rawUserId) ? rawUserId : null;

    return this.pg.transaction(async (tx) => {
      const [updated] = await tx.query<BookingRow>(
        `UPDATE bookings
         SET status = $1, cancelled_at = $2, cancel_reason_text = $3, updated_at = $2
         WHERE id = $4
         RETURNING *`,
        [BS.CANCELLED, now, reason, booking.id],
      );

      await tx.query(
        `UPDATE trip_seats
         SET status = 'available', held_by_booking_id = NULL, held_until = NULL
         WHERE held_by_booking_id = $1::uuid`,
        [booking.id],
      );

      await tx.query(
        `UPDATE payments
         SET status = 'failed', updated_at = $1
         WHERE booking_id = $2 AND status = 'awaiting_cash'`,
        [now, booking.id],
      );

      if (phone || userId) {
        try {
          await tx.query(
            `INSERT INTO booking_penalties (id, user_id, phone, booking_id, reason, blocked_until, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              randomUUID(),
              userId,
              phone ?? '',
              booking.id,
              'no_show',
              blockedUntil,
              now,
            ],
          );
        } catch (err) {
          this.logger.warn(
            `booking_penalties yozishda ogohlantirish: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }

        if (userId) {
          await tx.query(
            `UPDATE users
             SET booking_blocked_until = $1, booking_blocked_reason = $2, updated_at = $3
             WHERE id = $4::uuid`,
            [blockedUntil, 'no_show', now, userId],
          );
        }
        if (phone) {
          await tx.query(
            `UPDATE users
             SET booking_blocked_until = $1, booking_blocked_reason = $2, updated_at = $3
             WHERE phone = $4`,
            [blockedUntil, 'no_show', now, phone],
          );
        }
      }

      await tx.query(
        `INSERT INTO booking_status_history (id, booking_id, status, action, actor_type, actor_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          randomUUID(),
          booking.id,
          BS.CANCELLED,
          'no_show_penalty_applied',
          actor?.role ?? 'system',
          actor?.id ?? null,
          JSON.stringify({
            blocked_until: blockedUntil,
            penalty_days: penaltyDays,
            reason,
          }),
          now,
        ],
      );

      return {
        booking: updated,
        blocked_until: blockedUntil,
        penalty_days: penaltyDays,
        reason,
      };
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processNoShowCashBookings(): Promise<void> {
    try {
      const staleCashBookings = await this.pg.query<
        BookingRow & { guest_phone: string | null }
      >(
        `SELECT b.id, b.user_id, b.guest_phone, b.check_in, b.check_out, b.partner_organization_id
         FROM bookings b
         JOIN payments p ON p.booking_id = b.id
         LEFT JOIN trips t ON t.id = b.trip_id
         WHERE b.payment_method = 'cash'
           AND b.status = $1
           AND p.status = 'awaiting_cash'
           AND (b.policy_snapshot->>'checked_in_at') IS NULL
           AND (
             (b.check_out IS NOT NULL AND b.check_out < CURRENT_DATE)
             OR (b.check_in IS NOT NULL AND b.check_out IS NULL AND b.check_in < CURRENT_DATE - 1)
             OR (b.type = 'bus' AND t.departure_at IS NOT NULL AND t.departure_at < NOW() - INTERVAL '2 hours')
           )
         LIMIT 50`,
        [BS.CONFIRMED],
      );

      for (const booking of staleCashBookings) {
        try {
          await this.applyNoShowPenalty(
            booking.id,
            'Avtomatik tizim: Bron muddati o‘tgan, mijoz kelmadi (No-show) — 60 kunga bloklandi',
          );
          this.logger.log(
            `No-show jarimasi qo'llandi: bookingId=${booking.id}`,
          );
        } catch (penErr) {
          this.logger.error(
            `No-show jarimasini qo'llashda xatolik bookingId=${booking.id}: ${penErr}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`processNoShowCashBookings cron xatosi: ${err}`);
    }
  }

  async unblockUserBooking(userIdOrPhone: string): Promise<boolean> {
    const raw = String(userIdOrPhone ?? '').trim();
    if (!raw) {
      throw new BadRequestException({
        code: 'TARGET_REQUIRED',
        message: 'Telefon raqam yoki User ID ko‘rsatilishi shart',
      });
    }

    const normalized = normalizePhone(raw);
    const isPhone = isValidUzbekPhone(normalized);
    const now = new Date().toISOString();

    if (isPhone) {
      await this.pg.query(
        `UPDATE users SET booking_blocked_until = NULL, booking_blocked_reason = NULL, updated_at = $1 WHERE phone = $2`,
        [now, normalized],
      );
      try {
        await this.pg.query(
          `UPDATE booking_penalties SET blocked_until = NOW() WHERE phone = $1 AND blocked_until > NOW()`,
          [normalized],
        );
      } catch {
        // booking_penalties jadvali mavjud bo'lmasa yoki xatolik bo'lsa o'tkazib yuborish
      }
      return true;
    }

    const validUuid = isUuid(raw) ? raw : null;
    if (validUuid) {
      await this.pg.query(
        `UPDATE users SET booking_blocked_until = NULL, booking_blocked_reason = NULL, updated_at = $1 WHERE id = $2::uuid`,
        [now, validUuid],
      );
      try {
        await this.pg.query(
          `UPDATE booking_penalties SET blocked_until = NOW() WHERE user_id = $1::uuid AND blocked_until > NOW()`,
          [validUuid],
        );
      } catch {
        // booking_penalties jadvali mavjud bo'lmasa yoki xatolik bo'lsa o'tkazib yuborish
      }
      return true;
    }

    throw new BadRequestException({
      code: 'INVALID_TARGET',
      message: 'Noto‘g‘ri telefon raqami yoki User ID formati',
    });
  }

  async createHotel(
    actor: RequestActor | undefined,
    dto: Record<string, unknown>,
    idempotencyKey?: string,
  ) {
    return this.withIdempotency(actor, idempotencyKey, dto, () =>
      this.createHotelInternal(actor, dto),
    );
  }

  private async createHotelInternal(
    actor: RequestActor | undefined,
    dto: Record<string, unknown>,
  ) {
    // Ommaviy Oferta (Terms of Service)ga rozilik — checkout (guest yoki
    // login qilingan) source of truth SERVERDA. Client "agreeTerms: true"
    // yuborgani o'ziga o'zi ishonchli emas; checkbox required bo'lishi
    // frontendda bo'lsa ham, backend buni HAR DOIM qayta tekshiradi. Har
    // qanday DB so'rovidan OLDIN — sof input tekshiruvi (real xonani
    // qulflab, keyin rad etib, behuda tranzaksiya boshlamaslik uchun).
    const agreeTerms = dto.agree_terms ?? dto.agreeTerms;
    if (agreeTerms !== true) {
      throw new BadRequestException({
        code: 'TERMS_NOT_ACCEPTED',
        message: 'Ommaviy Oferta shartlariga rozilik berish shart',
      });
    }

    const userId = actor?.id ?? null;
    const hotelId = String(dto.hotel_id ?? dto.hotelId ?? '');
    const roomId = String(dto.room_id ?? dto.roomId ?? dto.roomTypeId ?? '');

    const [hotel] = await this.pg.query<
      HotelBookingRow & {
        partner_type?: string;
        commission_rate: number;
        check_in_time: string | null;
        check_out_time: string | null;
        stars: number | null;
        city_slug: string | null;
      }
    >(
      `SELECT h.id, h.partner_organization_id, po.type AS partner_type,
              po.default_commission_rate::float8 AS commission_rate,
              h.check_in_time, h.check_out_time, h.stars, c.slug AS city_slug
       FROM hotels h
       JOIN partner_organizations po ON po.id = h.partner_organization_id
       JOIN cities c ON c.id = h.city_id
       WHERE h.id = $1 AND h.deleted_at IS NULL AND h.status = 'published'
         AND po.status = 'approved'`,
      [hotelId],
    );

    if (!hotel) {
      throw new NotFoundException({
        code: 'ROOM_NOT_AVAILABLE',
        message: 'Tanlangan sanalar uchun xona mavjud emas',
      });
    }

    // SAFAAR komissiya stavkasi — 2026-09-13 biznes Excel jadvali BUSINESS
    // SOURCE OF TRUTH: `hotel`/`hostel`/`guesthouse` turlari uchun jadval
    // (hudud + tur + yulduz) HAR DOIM ustun, hatto shu tashkilotda
    // `default_commission_rate` boshqacha sozlangan bo'lsa ham (biznes
    // tomonidan tasdiqlangan qaror). Jadval qamrab olmagan turlar
    // (`motel`/`dacha`/`sanatorium`/`resort`/`restaurant`/`mixed`/boshqa)
    // uchun ESKI, mavjud `default_commission_rate` fallback'i o'zgarishsiz
    // qoladi — Excel'da yo'q narsa TAXMIN QILINMAYDI.
    const accommodationRate = resolveAccommodationCommissionRate({
      citySlug: hotel.city_slug,
      partnerOrganizationType: hotel.partner_type,
      stars: hotel.stars,
    });
    const resolvedCommissionRatePercent = accommodationRate.matched
      ? (accommodationRate.ratePercent as number)
      : hotel.commission_rate;

    const bookingType: 'hotel' | 'restaurant' =
      hotel?.partner_type === 'restaurant' || dto.type === 'restaurant'
        ? 'restaurant'
        : 'hotel';
    const isRestaurant = bookingType === 'restaurant';

    const checkIn = String(dto.check_in ?? dto.checkIn ?? '');
    const slotTime = this.optionalText(dto.slot_time ?? dto.slotTime) ?? null;

    if (isRestaurant) {
      // Restoran (stol) broni — bitta kun + vaqt-slot, kelish/ketish sanasi
      // oralig'i emas. Ilgari bu yo'l umuman `slot_time`ni o'qimas/
      // saqlamas edi (faqat hamkorning o'z panelidan yaratgan bron shunday
      // qilardi) va check_in===check_out'ni "noto'g'ri sana" deb rad
      // etardi — natijada mijoz o'zi bron qilganda vaqt umuman
      // saqlanmas, bir xil stol/vaqt uchun ziddiyat tekshirilmas edi.
      if (!Number.isFinite(Date.parse(checkIn)) || !slotTime) {
        throw new BadRequestException({
          code: 'BOOKING_DATES_INVALID',
          message: 'Sana va vaqtni tanlang',
        });
      }
      // Yarim tundan keyin yopiladigan restoran (masalan 07:01 -> 01:53)
      // uchun eski bir kunlik solishtiruv HAR QANDAY vaqtni rad etardi —
      // `common/operating-hours.ts` ga qarang.
      if (
        !isSlotWithinOperatingHours(
          slotTime,
          hotel.check_in_time,
          hotel.check_out_time,
        )
      ) {
        throw new BadRequestException({
          code: 'SLOT_OUTSIDE_HOURS',
          message: 'Tanlangan vaqt ish vaqtidan tashqarida',
        });
      }
    }

    const checkOut = isRestaurant
      ? checkIn
      : String(dto.check_out ?? dto.checkOut ?? '');
    const checkInMs = Date.parse(checkIn);
    const checkOutMs = Date.parse(checkOut);
    if (
      !isRestaurant &&
      (!Number.isFinite(checkInMs) ||
        !Number.isFinite(checkOutMs) ||
        checkOutMs <= checkInMs)
    ) {
      throw new BadRequestException({
        code: 'BOOKING_DATES_INVALID',
        message: "check_in/check_out sanalari noto'g'ri",
      });
    }
    const nights = isRestaurant ? 1 : this.calculateNights(checkIn, checkOut);
    const rooms = isRestaurant ? 1 : Number(dto.rooms ?? 1);
    const guest = this.guestContact(actor, dto);

    const consumeOtp = await this.validateCashBookingOtpIfNeeded(
      dto,
      guest.phone,
      actor,
    );

    const promoCode = this.optionalText(dto.promo_code ?? dto.promoCode);
    const promo = await this.resolvePromo(promoCode);

    // Xona qulfi + sana-ziddiyat tekshiruvi + INSERT bitta tranzaksiya
    // ichida bo'lishi SHART — aks holda bir necha bir vaqtdagi so'rov
    // bitta xonani bir necha marta "band qilib" yuborishi mumkin (avval
    // shu yerda umuman himoya yo'q edi, `FOR UPDATE` tranzaksiyasiz
    // qulf sifatida ishlamas edi). Pattern — hamkor walk-in bron kodida
    // (`partners.service.ts createBooking`) allaqachon to'g'ri qo'llangan.
    const { booking, payment } = await this.pg.transaction(async (tx) => {
      const [room] = await tx.query<HotelRoomRow>(
        `SELECT hr.id, hr.base_price, hr.hotel_id, hr.total_inventory,
                ap.id::text AS promotion_id,
                ap.old_price_sum::float8 AS promotion_old_price,
                ap.new_price_sum::float8 AS promotion_new_price,
                ap.discount_percent AS promotion_discount_percent,
                ap.start_date::text AS promotion_start_date,
                ap.end_date::text AS promotion_end_date
         FROM hotel_rooms hr
         LEFT JOIN LATERAL (
           SELECT p.*
           FROM promotions p
           WHERE ${activeRoomPromotionPredicate('p', 'hr.id', 'hr.room_type_id')}
           ORDER BY (CASE WHEN p.entity_id = hr.id THEN 0 ELSE 1 END) ASC, p.updated_at DESC, p.created_at DESC
           LIMIT 1
         ) ap ON TRUE
         WHERE hr.id = $1 AND hr.hotel_id = $2 AND hr.status = 'active'
         FOR UPDATE OF hr`,
        [roomId, hotelId],
      );

      if (!room) {
        throw new NotFoundException({
          code: 'ROOM_NOT_AVAILABLE',
          message: 'Tanlangan sanalar uchun xona mavjud emas',
        });
      }

      // MUHIM: `hotel_rooms` bitta jismoniy xona/stolni emas, balki BUTUN
      // bir XONA TURINI (masalan "Standart", `total_inventory=10` — shu
      // turdan 10 tasi bor) ifodalaydi — buni `total_inventory` ustuni
      // isbotlaydi. Ilgari bu yerda faqat "biror ziddiyatli bron bormi"
      // (`LIMIT 1`) tekshirilardi — ya'ni 10 tadan BITTASI band qilinishi
      // BILANOQ, tizim qolgan 9 tasini ham "sotib bo'lmaydi" deb rad
      // etardi ("soxta sold-out" — real production QA orqali topilgan
      // eng jiddiy moliyaviy xato). Endi ziddiyatli bronlardagi band
      // qilingan XONALAR SONI (`price_snapshot.rooms`) yig'indisi hisoblab,
      // `total_inventory` bilan solishtiriladi.
      // Foydalanuvchi/mehmon to'lov oynasidan ortga qaytib yana qayta bron qilayotgan
      // bo'lsa, o'zining avvalgi to'lanmagan pending/awaiting_payment broni uni
      // bloklab qo'ymasligi uchun ziddiyat hisobidan chiqariladi.
      const activeExclusions = [BS.CANCELLED, BS.EXPIRED, BS.COMPLETED];
      const [{ booked_count: bookedCountRaw }] = isRestaurant
        ? await tx.query<{ booked_count: string | number }>(
            `SELECT COALESCE(SUM(COALESCE((price_snapshot->>'rooms')::int, 1)), 0) AS booked_count
             FROM bookings
             WHERE room_id = $1::uuid
               AND status NOT IN ($2, $3, $4)
               AND check_in = $5::date
               AND slot_time IS NOT NULL
               AND slot_time < ($6::time + interval '90 minutes')
               AND $6::time < (slot_time + interval '90 minutes')
               AND NOT (
                 status IN ('pending', 'awaiting_payment')
                 AND (
                   ($7::uuid IS NOT NULL AND user_id = $7::uuid)
                   OR ($7::uuid IS NULL AND user_id IS NULL AND (
                     ($8::text IS NOT NULL AND $8 != '' AND guest_email = $8)
                     OR ($9::text IS NOT NULL AND $9 != '' AND guest_phone = $9)
                   ))
                 )
               )`,
            [
              room.id,
              ...activeExclusions,
              checkIn,
              slotTime,
              userId ?? null,
              guest.email || null,
              guest.phone || null,
            ],
          )
        : await tx.query<{ booked_count: string | number }>(
            `SELECT COALESCE(SUM(COALESCE((price_snapshot->>'rooms')::int, 1)), 0) AS booked_count
             FROM bookings
             WHERE room_id = $1::uuid
               AND status NOT IN ($2, $3, $4)
               AND check_in < $5::date
               AND $6::date < check_out
               AND NOT (
                 status IN ('pending', 'awaiting_payment')
                 AND (
                   ($7::uuid IS NOT NULL AND user_id = $7::uuid)
                   OR ($7::uuid IS NULL AND user_id IS NULL AND (
                     ($8::text IS NOT NULL AND $8 != '' AND guest_email = $8)
                     OR ($9::text IS NOT NULL AND $9 != '' AND guest_phone = $9)
                   ))
                 )
               )`,
            [
              room.id,
              ...activeExclusions,
              checkOut,
              checkIn,
              userId ?? null,
              guest.email || null,
              guest.phone || null,
            ],
          );

      const bookedCount = Number(bookedCountRaw);
      if (bookedCount + rooms > room.total_inventory) {
        throw new ConflictException({
          code: isRestaurant ? 'TABLE_ALREADY_BOOKED' : 'ROOM_ALREADY_BOOKED',
          message: isRestaurant
            ? 'Bu stol tanlangan vaqtda band'
            : 'Tanlangan sanalar uchun xona allaqachon band qilingan',
        });
      }

      // MUHIM (2026-09-14 audit topilmasi): `room_inventory.closed` —
      // hamkorning `blackoutDates()` orqali (va endi admin
      // `roomAvailabilityBlock()` orqali ham) belgilaydigan "sotuvdan
      // vaqtincha bloklangan sana" bayrog'i — ILGARI bu yerda UMUMAN
      // tekshirilmas edi. Ya'ni hamkor/admin bir sanani "yopiq" deb
      // belgilasa ham, real booking baribir yaratilaverardi — bloklash
      // faqat "frontend status" bo'lib qolgan, booking engine uni hisobga
      // OLMAGAN edi. Endi shu yerda, xuddi shu FOR UPDATE qulflangan
      // tranzaksiya ichida, aniq tekshiriladi.
      const [{ blocked_count: blockedCountRaw }] = isRestaurant
        ? await tx.query<{ blocked_count: string | number }>(
            `SELECT COUNT(*) AS blocked_count
             FROM room_inventory
             WHERE room_id = $1::uuid AND date = $2::date AND closed = true`,
            [room.id, checkIn],
          )
        : await tx.query<{ blocked_count: string | number }>(
            `SELECT COUNT(*) AS blocked_count
             FROM room_inventory
             WHERE room_id = $1::uuid
               AND date >= $2::date AND date < $3::date
               AND closed = true`,
            [room.id, checkIn, checkOut],
          );
      if (Number(blockedCountRaw) > 0) {
        throw new ConflictException({
          code: 'ROOM_DATES_BLOCKED',
          message:
            'Tanlangan sanalarning bir qismi vaqtincha sotuvdan bloklangan',
        });
      }

      const partnerPromotion: ActiveRoomPromotion | null = room.promotion_id
        ? {
            id: room.promotion_id,
            entity_id: room.id,
            old_price_sum: Number(room.promotion_old_price),
            new_price_sum: Number(room.promotion_new_price),
            discount_percent: Number(room.promotion_discount_percent),
            start_date: room.promotion_start_date ?? undefined,
            end_date: String(room.promotion_end_date ?? ''),
          }
        : null;
      const unitPrice = calculateRoomPrice(room.base_price, partnerPromotion);
      const baseSubtotal = unitPrice.basePrice * nights * rooms;
      const effectiveSubtotal = unitPrice.effectivePrice * nights * rooms;
      const partnerDiscountAmount = baseSubtotal - effectiveSubtotal;

      if (partnerPromotion && promo) {
        throw new BadRequestException({
          code: 'PROMO_STACKING_NOT_ALLOWED',
          message:
            "Ushbu xonaga allaqachon chegirma e'lon qilingan. Promo-kod faqat chegirmasiz xonalar uchun amal qiladi",
        });
      }

      const promoDiscountAmount = promo
        ? calculatePromoDiscount(
            effectiveSubtotal,
            promo.discount_type,
            promo.discount_value,
          )
        : 0;
      const discountAmount = partnerDiscountAmount + promoDiscountAmount;

      if (promo && promoDiscountAmount > 0) {
        const redeemed = await this.promosService.redeem(promo.code, tx);
        if (!redeemed) {
          // Tasdiqlash (validate) va shu yerdagi haqiqiy sarflash orasida
          // limit boshqa mijoz tomonidan to'ldirilib qolishi mumkin edi —
          // bu holda butun bron tranzaksiyasi bekor qilinadi (xona qulfi
          // ham bo'shatiladi), mijoz aniq xato bilan qayta urinadi.
          throw new ConflictException({
            code: 'PROMO_LIMIT_REACHED',
            message: "Promo-kod limiti tugadi, qaytadan urinib ko'ring",
          });
        }
      }

      const booking = await this.createBooking(tx, userId, {
        type: bookingType,
        partner_organization_id: hotel.partner_organization_id,
        payment_method: this.paymentMethod(
          dto.payment_method ?? dto.paymentMethod,
        ),
        confirmation_mode: this.confirmationMode(dto.confirmation_mode),
        subtotal: baseSubtotal,
        discount_amount: discountAmount,
        commission_rate_percent: resolvedCommissionRatePercent,
        hotel_id: hotel.id,
        trip_id: null,
        room_id: room.id,
        check_in: checkIn,
        check_out: checkOut,
        slot_time: isRestaurant ? slotTime : null,
        guest_name: guest.name,
        guest_email: guest.email,
        guest_phone: guest.phone,
        terms_accepted_at: new Date().toISOString(),
        terms_version: CURRENT_TERMS_VERSION,
        price_snapshot: {
          room_id: room.id,
          check_in: checkIn,
          check_out: checkOut,
          slot_time: isRestaurant ? slotTime : null,
          nights,
          rooms,
          base_price_per_night: unitPrice.basePrice,
          effective_price_per_night: unitPrice.effectivePrice,
          partner_promotion: partnerPromotion
            ? {
                id: partnerPromotion.id,
                discount_percent: partnerPromotion.discount_percent,
                discount_amount: partnerDiscountAmount,
              }
            : null,
          adults: Number(dto.adults ?? dto.guests ?? 1),
          children: Number(dto.children ?? 0),
          promo_code: promo?.code ?? null,
          guest: {
            first_name: guest.firstName,
            last_name: guest.lastName,
            name: guest.name,
            email: guest.email,
            phone: guest.phone,
          },
        },
      });

      const payment = await this.settleNewBooking(tx, booking);
      return { booking, payment };
    });

    this.events.bookingStatusChanged(booking);
    this.events.partnerDashboardUpdated(booking.partner_organization_id);
    this.events.adminDashboardUpdated();
    void this.sendBookingConfirmationEmail(booking);
    await consumeOtp?.();

    // Guest (login qilmagan) checkout — tasdiqlash sahifasi keyinroq
    // `GET /bookings/:id`ni bu token bilan chaqirishi uchun, faqat bron
    // haqiqatan ham commit bo'lgandan KEYIN (tranzaksiya muvaffaqiyatli
    // yakunlangach) generatsiya qilinadi.
    const guestAccessToken = booking.user_id
      ? undefined
      : await this.issueGuestBookingAccessToken(booking.id);

    return { booking, payment, guestAccessToken };
  }

  /**
   * Mashina ijarasi (rent-a-car) broni — `createHotel`ga deyarli bir xil
   * naqsh (bitta inventar birligi + sana oralig'i + ziddiyat tekshiruvi),
   * faqat `hotels`/`hotel_rooms` o'rniga `vehicles`/`bus_companies`.
   * Mehmon (guest) checkout ruxsat etiladi — hotel kabi, login shart emas.
   */
  async createVehicleRental(
    actor: RequestActor | undefined,
    dto: Record<string, unknown>,
    idempotencyKey?: string,
  ) {
    return this.withIdempotency(actor, idempotencyKey, dto, () =>
      this.createVehicleRentalInternal(actor, dto),
    );
  }

  private async createVehicleRentalInternal(
    actor: RequestActor | undefined,
    dto: Record<string, unknown>,
  ) {
    const userId = actor?.id ?? null;
    const vehicleId = String(dto.vehicle_id ?? dto.vehicleId ?? '');

    const [vehicle] = await this.pg.query<
      VehicleRow & { partner_organization_id: string; commission_rate: number }
    >(
      `SELECT v.id, v.price_per_day, bc.partner_organization_id,
              po.default_commission_rate::float8 AS commission_rate
       FROM vehicles v
       JOIN bus_companies bc ON bc.id = v.company_id
       JOIN partner_organizations po ON po.id = bc.partner_organization_id
       WHERE v.id = $1 AND v.status = 'active' AND bc.status = 'active'
         AND po.status = 'approved'`,
      [vehicleId],
    );

    if (!vehicle) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_AVAILABLE',
        message: 'Tanlangan sanalar uchun mashina mavjud emas',
      });
    }

    const checkIn = String(dto.check_in ?? dto.checkIn ?? '');
    const checkOut = String(dto.check_out ?? dto.checkOut ?? '');
    const checkInMs = Date.parse(checkIn);
    const checkOutMs = Date.parse(checkOut);
    // O'tgan sanaga bron — audit paytida haqiqiy production so'rovi bilan
    // tasdiqlangan bug (2020-01-01 uchun bron muvaffaqiyatli yaratilgan
    // edi). Bugungi kun uchun bron ruxsat etiladi (mijoz bugun mashina
    // olishi mumkin) — faqat KECHAGI va undan oldingi sanalar rad etiladi.
    const todayIso = new Date().toISOString().slice(0, 10);
    if (
      !Number.isFinite(checkInMs) ||
      !Number.isFinite(checkOutMs) ||
      checkOutMs <= checkInMs ||
      checkIn < todayIso
    ) {
      throw new BadRequestException({
        code: 'BOOKING_DATES_INVALID',
        message: "check_in/check_out sanalari noto'g'ri",
      });
    }
    const days = this.calculateNights(checkIn, checkOut);

    const guest = this.guestContact(actor, dto);

    const consumeOtp = await this.validateCashBookingOtpIfNeeded(
      dto,
      guest.phone,
      actor,
    );

    const promoCode = this.optionalText(dto.promo_code ?? dto.promoCode);
    const promo = await this.resolvePromo(promoCode);

    const { booking, payment } = await this.pg.transaction(async (tx) => {
      // Xona yo'liga (`createHotelInternal`) AYNAN bir xil naqsh: mashina
      // qulflanadigan (`FOR UPDATE`) SO'ROVNING O'ZIDA joriy faol hamkor
      // promotion'i ham LEFT JOIN LATERAL orqali yuklanadi — bu narxni
      // promotion tasdiqlangan paytdagi emas, HOZIRGI (booking daqiqasidagi)
      // `price_per_day` va HOZIRGI faol promotion holatiga bog'laydi
      // ("suzuvchi" — floating — narx, xuddi xona promotion'i kabi).
      const [locked] = await tx.query<VehicleRow>(
        `SELECT v.id, v.price_per_day,
                ap.id::text AS promotion_id,
                ap.old_price_sum::float8 AS promotion_old_price,
                ap.new_price_sum::float8 AS promotion_new_price,
                ap.discount_percent AS promotion_discount_percent,
                ap.start_date::text AS promotion_start_date,
                ap.end_date::text AS promotion_end_date
         FROM vehicles v
         LEFT JOIN LATERAL (
           SELECT p.*
           FROM promotions p
           WHERE ${activeVehiclePromotionPredicate('p', 'v.id')}
           ORDER BY p.updated_at DESC, p.created_at DESC
           LIMIT 1
         ) ap ON TRUE
         WHERE v.id = $1 AND v.status = 'active'
         FOR UPDATE OF v`,
        [vehicle.id],
      );
      if (!locked) {
        throw new NotFoundException({
          code: 'VEHICLE_NOT_AVAILABLE',
          message: 'Tanlangan sanalar uchun mashina mavjud emas',
        });
      }

      // Foydalanuvchi/mehmon to'lov oynasidan ortga qaytib yana qayta bron qilayotgan
      // bo'lsa, o'zining avvalgi to'lanmagan pending/awaiting_payment broni uni
      // bloklab qo'ymasligi uchun ziddiyat hisobidan chiqariladi.
      const activeExclusions = [BS.CANCELLED, BS.EXPIRED, BS.COMPLETED];
      const conflicts = await tx.query<{ id: string }>(
        `SELECT id FROM bookings
         WHERE vehicle_id = $1::uuid
           AND status NOT IN ($2, $3, $4)
           AND check_in < $5::date
           AND $6::date < check_out
           AND NOT (
             status IN ('pending', 'awaiting_payment')
             AND (
               ($7::uuid IS NOT NULL AND user_id = $7::uuid)
               OR ($7::uuid IS NULL AND user_id IS NULL AND (
                 ($8::text IS NOT NULL AND $8 != '' AND guest_email = $8)
                 OR ($9::text IS NOT NULL AND $9 != '' AND guest_phone = $9)
               ))
             )
           )
         LIMIT 1`,
        [
          locked.id,
          ...activeExclusions,
          checkOut,
          checkIn,
          userId ?? null,
          guest.email || null,
          guest.phone || null,
        ],
      );

      if (conflicts[0]) {
        throw new ConflictException({
          code: 'VEHICLE_ALREADY_BOOKED',
          message: 'Tanlangan sanalar uchun mashina allaqachon band qilingan',
        });
      }

      // Xona yo'liga AYNAN bir xil naqsh (`bookings.service.ts:633-636` —
      // `createHotelInternal`): promotion narxi joriy `price_per_day`dan
      // OSHIB ketmasligini kafolatlaydigan `calculateVehiclePrice()`
      // (ilgari bu yerda promotion UMUMAN hisobga olinmas edi — hamkor
      // tasdiqlangan chegirma bilan e'lon qilingan mashina baribir to'liq
      // narxda hisoblanardi, "SAFAAR VEHICLE PROMOTION PRICING AUDIT"
      // aniqlagan asosiy pul yo'lidagi xato).
      const vehiclePromotion: ActiveVehiclePromotion | null =
        locked.promotion_id
          ? {
              id: locked.promotion_id,
              entity_id: locked.id,
              old_price_sum: Number(locked.promotion_old_price),
              new_price_sum: Number(locked.promotion_new_price),
              discount_percent: Number(locked.promotion_discount_percent),
              start_date: locked.promotion_start_date ?? undefined,
              end_date: String(locked.promotion_end_date ?? ''),
            }
          : null;
      const unitPrice = calculateVehiclePrice(
        locked.price_per_day,
        vehiclePromotion,
      );
      const baseSubtotal = unitPrice.basePricePerDay * days;
      const effectiveSubtotal = unitPrice.effectivePricePerDay * days;
      const partnerDiscountAmount = baseSubtotal - effectiveSubtotal;

      // Xona yo'lidagi bir xil SCHOOL21 anti-stacking siyosati (`:638-643`)
      // — endi mashina promotion'i ham narxga ta'sir qilishi mumkin bo'lgani
      // uchun, xuddi shu suiiste'mol yo'li (bitta obyektga ikkita chegirmani
      // birlashtirish) mashinalar uchun ham ochiladi, shuning uchun bir xil
      // himoya qo'llaniladi.
      if (vehiclePromotion && promo) {
        throw new BadRequestException({
          code: 'PROMO_STACKING_NOT_ALLOWED',
          message:
            "Ushbu transport vositasiga allaqachon chegirma e'lon qilingan. Promo-kod faqat chegirmasiz transportlar uchun amal qiladi",
        });
      }

      const promoDiscountAmount = promo
        ? calculatePromoDiscount(
            effectiveSubtotal,
            promo.discount_type,
            promo.discount_value,
          )
        : 0;
      const discountAmount = partnerDiscountAmount + promoDiscountAmount;

      if (promo) {
        const redeemed = await this.promosService.redeem(promo.code, tx);
        if (!redeemed) {
          throw new ConflictException({
            code: 'PROMO_LIMIT_REACHED',
            message: "Promo-kod limiti tugadi, qaytadan urinib ko'ring",
          });
        }
      }

      const booking = await this.createBooking(tx, userId, {
        type: 'bus',
        partner_organization_id: vehicle.partner_organization_id,
        payment_method: this.paymentMethod(
          dto.payment_method ?? dto.paymentMethod,
        ),
        confirmation_mode: this.confirmationMode(dto.confirmation_mode),
        subtotal: baseSubtotal,
        discount_amount: discountAmount,
        commission_rate_percent: vehicle.commission_rate,
        hotel_id: null,
        trip_id: null,
        vehicle_id: locked.id,
        check_in: checkIn,
        check_out: checkOut,
        guest_name: guest.name,
        guest_email: guest.email,
        guest_phone: guest.phone,
        price_snapshot: {
          vehicle_id: locked.id,
          check_in: checkIn,
          check_out: checkOut,
          days,
          price_per_day: unitPrice.basePricePerDay,
          effective_price_per_day: unitPrice.effectivePricePerDay,
          partner_promotion: vehiclePromotion
            ? {
                id: vehiclePromotion.id,
                discount_percent: vehiclePromotion.discount_percent,
                discount_amount: partnerDiscountAmount,
              }
            : null,
          promo_code: promo?.code ?? null,
          guest: {
            first_name: guest.firstName,
            last_name: guest.lastName,
            name: guest.name,
            email: guest.email,
            phone: guest.phone,
          },
        },
      });

      const payment = await this.settleNewBooking(tx, booking);
      return { booking, payment };
    });

    this.events.bookingStatusChanged(booking);
    this.events.partnerDashboardUpdated(booking.partner_organization_id);
    this.events.adminDashboardUpdated();
    void this.sendBookingConfirmationEmail(booking);
    await consumeOtp?.();

    // Guest (login qilmagan) checkout — hotel bilan bir xil sabab/naqsh.
    const guestAccessToken = booking.user_id
      ? undefined
      : await this.issueGuestBookingAccessToken(booking.id);

    return { booking, payment, guestAccessToken };
  }

  /**
   * Promo-kod berilgan bo'lsa, oldindan (tranzaksiyadan tashqarida)
   * tekshiradi — noto'g'ri/eskirgan/limiti tugagan kod bo'lsa mijozga
   * darhol aniq xato ko'rsatiladi, "chegirma sukut bo'yicha jim
   * qo'llanilmadi" degan chalkash holat bo'lmaydi. Haqiqiy "sarflash"
   * (used_count oshirish) esa faqat bron tranzaksiyasi ichida, xona
   * qulfi ushlab turilganda amalga oshiriladi.
   */
  private async resolvePromo(code: string | null | undefined) {
    if (!code) {
      return null;
    }
    const result = await this.promosService.validate({ code });
    if (!result.valid) {
      throw new BadRequestException({
        code: 'PROMO_INVALID',
        message: "Promo-kod yaroqsiz yoki muddati o'tgan",
      });
    }
    return {
      code,
      discount_type: result.discount_type,
      discount_value: result.discount_value,
    };
  }

  async createBus(
    actor: RequestActor | undefined,
    dto: Record<string, unknown>,
    idempotencyKey?: string,
  ) {
    return this.withIdempotency(actor, idempotencyKey, dto, () =>
      this.createBusInternal(actor, dto),
    );
  }

  private async createBusInternal(
    actor: RequestActor | undefined,
    dto: Record<string, unknown>,
  ) {
    const userId = actor?.id ?? null;
    const guest = this.guestContact(actor, dto);

    const consumeOtp = await this.validateCashBookingOtpIfNeeded(
      dto,
      guest.phone,
      actor,
    );

    const tripId = String(dto.trip_id ?? dto.tripId ?? '');

    const [trip] = await this.pg.query<TripRow>(
      "SELECT id, company_id, base_price FROM trips WHERE id = $1 AND status = 'scheduled'",
      [tripId],
    );

    if (!trip) {
      throw new NotFoundException({
        code: 'TRIP_NOT_FOUND',
        message: 'Reys topilmadi',
      });
    }

    const [company] = await this.pg.query<
      BusCompanyRow & { commission_rate: number }
    >(
      `SELECT bc.partner_organization_id,
              po.default_commission_rate::float8 AS commission_rate
       FROM bus_companies bc
       JOIN partner_organizations po ON po.id = bc.partner_organization_id
       WHERE bc.id = $1 AND po.status = 'approved'`,
      [trip.company_id],
    );
    if (!company?.partner_organization_id) {
      throw new NotFoundException({
        code: 'BUS_COMPANY_NOT_FOUND',
        message: 'Avtobus hamkori topilmadi',
      });
    }
    const partnerOrganizationId = company.partner_organization_id;
    const requestedSeatCodes = Array.isArray(dto.seats)
      ? dto.seats.map(String)
      : null;
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const promoCode = this.optionalText(dto.promo_code ?? dto.promoCode);
    const promo = await this.resolvePromo(promoCode);

    // O'rindiq qulfi + bandlik tekshiruvi + bron/to'lov yozish bitta
    // tranzaksiya ichida bo'lishi SHART — aks holda ikkita bir vaqtdagi
    // so'rov bitta o'rindiqni ikkalasiga ham "band qilib" berishi mumkin
    // (avval `FOR UPDATE` tranzaksiyasiz qulf sifatida ishlamas edi —
    // xuddi mehmonxona bron qilishdagi kabi, BUG-03'ning ikkinchisi).
    const { booking, payment } = await this.pg.transaction(async (tx) => {
      const seatCodes =
        requestedSeatCodes ??
        (
          await tx.query<{ seat_code: string }>(
            "SELECT seat_code FROM trip_seats WHERE trip_id = $1 AND status = 'available' ORDER BY seat_code LIMIT 1",
            [tripId],
          )
        ).map((s) => s.seat_code);

      if (seatCodes.length === 0) {
        throw new UnprocessableEntityException({
          code: 'SEAT_NOT_AVAILABLE',
          message: "O'rindiq band",
        });
      }

      const seats = await tx.query<TripSeatRow>(
        'SELECT * FROM trip_seats WHERE trip_id = $1 AND seat_code = ANY($2::text[]) FOR UPDATE',
        [tripId, seatCodes],
      );

      if (
        seats.length !== seatCodes.length ||
        seats.some((seat) => seat.status !== 'available')
      ) {
        throw new UnprocessableEntityException({
          code: 'SEAT_NOT_AVAILABLE',
          message: "O'rindiq band",
        });
      }

      const subtotal = seats.reduce((sum, seat) => sum + Number(seat.price), 0);
      const discountAmount = promo
        ? calculatePromoDiscount(
            subtotal,
            promo.discount_type,
            promo.discount_value,
          )
        : 0;

      if (promo) {
        const redeemed = await this.promosService.redeem(promo.code, tx);
        if (!redeemed) {
          throw new ConflictException({
            code: 'PROMO_LIMIT_REACHED',
            message: "Promo-kod limiti tugadi, qaytadan urinib ko'ring",
          });
        }
      }

      const booking = await this.createBooking(tx, userId, {
        type: 'bus',
        partner_organization_id: partnerOrganizationId,
        payment_method: this.paymentMethod(
          dto.payment_method ?? dto.paymentMethod,
        ),
        confirmation_mode: this.confirmationMode(dto.confirmation_mode),
        subtotal,
        discount_amount: discountAmount,
        commission_rate_percent: company.commission_rate,
        hotel_id: null,
        trip_id: trip.id,
        expires_at: expiresAt.toISOString(),
        guest_name: guest.name,
        guest_email: guest.email,
        guest_phone: guest.phone,
        price_snapshot: {
          seats: seats.map((s) => s.seat_code),
          passengers: dto.passengers ?? [],
          promo_code: promo?.code ?? null,
          guest: {
            first_name: guest.firstName,
            last_name: guest.lastName,
            name: guest.name,
            email: guest.email,
            phone: guest.phone,
          },
        },
      });

      // O'rindiqlarni "band" deb belgilash — xuddi shu tranzaksiya
      // ichida, hali qulf ushlab turilganda.
      for (const seat of seats) {
        await tx.query(
          'UPDATE trip_seats SET status = $1, held_by_booking_id = $2, held_until = $3 WHERE id = $4',
          ['held', booking.id, booking.expires_at, seat.id],
        );
      }

      const payment = await this.settleNewBooking(tx, booking);
      return { booking, payment };
    });

    this.events.bookingStatusChanged(booking);
    this.events.partnerDashboardUpdated(booking.partner_organization_id);
    this.events.adminDashboardUpdated();
    void this.sendBookingConfirmationEmail(booking);
    await consumeOtp?.();

    const guestAccessToken = booking.user_id
      ? undefined
      : await this.issueGuestBookingAccessToken(booking.id);

    return { booking, payment, guestAccessToken };
  }

  async findOne(
    actor: RequestActor | undefined,
    id: string,
    guestAccessToken?: string,
  ) {
    const booking = await this.assertBooking(id, actor, guestAccessToken);
    const [payment] = await this.pg.query(
      'SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id],
    );
    return {
      ...booking,
      payment: payment ? this.shapePaymentRow(payment) : null,
    };
  }

  /**
   * To'lov qatorini frontendga qaytariladigan shaklga keltiradi —
   * `payments.service.ts::shapePaymentResponse()` bilan AYNAN bir xil
   * konvensiya: `card_scheme` to'ldirilgan bo'lsa (humo/uzcard/visa/
   * mastercard) `provider` maydonida AYNAN SHU karta turi qaytadi, ichki
   * transport qiymati (`provider = 'uzum_checkout'`) YASHIRILADI.
   *
   * Buni sinxron saqlash MAJBURIY: `GET /bookings/:id` javobidagi
   * `payment.provider` frontend'da to'lov sahifasida qayta urinish
   * formasining boshlang'ich usulini tanlaydi — u yerga 'uzum_checkout'
   * tushsa, foydalanuvchi tanlagan karta turi (va unga bog'liq fee)
   * yo'qolardi.
   */
  private shapePaymentRow<T extends Record<string, unknown>>(row: T): T {
    const cardScheme = row.card_scheme;
    return cardScheme ? { ...row, provider: cardScheme } : row;
  }

  /**
   * Login qilmagan (guest) mijoz o'z bronini xom ID orqali emas, balki
   * booking_number + email juftligi orqali qidiradi. Ikkalasi ham to'g'ri
   * kelmasa xuddi shu umumiy xabar qaytariladi — shu orqali "bron raqami
   * mavjud, lekin email noto'g'ri" holatini tashqi kuzatuvchi bilib
   * olmaydi (enumeration'ga qarshi).
   */
  async lookupBooking(bookingNumber: string, email: string) {
    const normalizedNumber = bookingNumber.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedNumber || !normalizedEmail) {
      throw new BadRequestException({
        code: 'BOOKING_LOOKUP_INVALID',
        message: 'Bron raqami va email kiritilishi shart',
      });
    }

    const [booking] = await this.pg.query<BookingRow>(
      `SELECT id, booking_number, type, status, currency, total_amount,
              hotel_id, trip_id, check_in, check_out, slot_time,
              guest_name, guest_email, created_at
       FROM bookings
       WHERE booking_number = $1 AND lower(guest_email) = $2
       LIMIT 1`,
      [normalizedNumber, normalizedEmail],
    );

    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: "Bron topilmadi. Bron raqami va email'ni tekshiring",
      });
    }

    // `card_scheme` — javobda QAYTARILMAYDI, faqat `provider`ni
    // foydalanuvchi tanlagan karta turiga (`shapePaymentRow`) keltirish
    // uchun o'qiladi.
    const [paymentRow] = await this.pg.query<{
      status: string;
      provider: string;
      card_scheme: string | null;
      amount: string | number;
      currency: string;
    }>(
      'SELECT status, provider, card_scheme, amount, currency FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1',
      [booking.id],
    );
    // Javob maydonlari ANIQ sanab o'tiladi (avvalgi shakl bilan bir xil:
    // status/provider/amount/currency) — `card_scheme` ichki ustun bo'lib
    // qoladi va guest javobiga CHIQMAYDI.
    const shapedPayment = paymentRow ? this.shapePaymentRow(paymentRow) : null;
    const payment = shapedPayment
      ? {
          status: shapedPayment.status,
          provider: shapedPayment.provider,
          amount: shapedPayment.amount,
          currency: shapedPayment.currency,
        }
      : null;

    // Ichki moliyaviy maydonlar (commission_amount, partner_payable) va
    // to'liq guest kontakt ma'lumotlari qaytarilmaydi — email orqali
    // tasdiqlash JWT'dan zaifroq isbot, shuning uchun javob ataylab cheklangan.
    return {
      id: booking.id,
      booking_number: booking.booking_number,
      type: booking.type,
      status: booking.status,
      currency: booking.currency,
      total_amount: booking.total_amount,
      hotel_id: booking.hotel_id,
      trip_id: booking.trip_id,
      check_in: booking.check_in,
      check_out: booking.check_out,
      slot_time: booking.slot_time,
      guest_name: booking.guest_name,
      created_at: booking.created_at,
      payment: payment ?? null,
    };
  }

  async retryPayment(actor: RequestActor | undefined, id: string) {
    const booking = await this.assertBooking(id, actor);

    // BUG FIX (payments/refunds audit, 2026-09-29): booking allaqachon
    // TO'LANGAN bo'lsa (confirmed/awaiting_partner_confirmation/completed)
    // yangi to'lov sessiyasi OCHILMAYDI. `createPayment()`dagi "mavjud ochiq
    // to'lov" qidiruvi faqat `status IN ('pending','processing')` qatorlarni
    // ko'radi — allaqachon `'paid'` bo'lgan yagona to'lov shu qidiruvga mos
    // kelmagani uchun bu yerga HECH QANDAY booking-holat tekshiruvisiz
    // yetib kelinsa, IKKINCHI, mustaqil, HAQIQIY to'lov sessiyasi (yangi
    // checkout URL yoki karta sxemalari uchun HAQIQIY Uzum Checkout
    // `/payment/register` chaqiruvi) ochilardi — mijoz uchun haqiqiy
    // ikkinchi marta to'lov (double-charge) xavfi, hech qanday avtomatik
    // qaytarishsiz. `payments.service.ts::createPayment()`dagi bilan BIR
    // XIL "allaqachon to'langan" ta'rifi (`assertUzumPayable()`dagi
    // ALREADY_PAID bilan bir xil uchta holat).
    if (
      booking.status === BS.CONFIRMED ||
      booking.status === BS.AWAITING_PARTNER_CONFIRMATION ||
      booking.status === BS.COMPLETED
    ) {
      throw new UnprocessableEntityException({
        code: 'BOOKING_ALREADY_PAID',
        message: 'Bu bron uchun to\u2018lov allaqachon qabul qilingan',
      });
    }

    return this.createPayment(this.pg, booking);
  }

  async cancelPreview(
    actor: RequestActor | undefined,
    id: string,
    guestAccessToken?: string,
  ) {
    const booking = await this.assertBooking(id, actor, guestAccessToken);

    if (
      booking.status === BS.PENDING ||
      booking.status === BS.AWAITING_PAYMENT
    ) {
      return {
        booking_id: id,
        currency: booking.currency,
        paid_amount: 0,
        refund_amount: 0,
        penalty_amount: 0,
        policy: 'To‘lov amalga oshirilmagan — bepul bekor qilish',
      };
    }

    const total = Number(booking.total_amount);
    const refundAmount = Math.round(total * 0.8);

    return {
      booking_id: id,
      currency: booking.currency,
      paid_amount: total,
      refund_amount: refundAmount,
      penalty_amount: total - refundAmount,
      policy: 'Flexible: 24 soatgacha 80% refund',
    };
  }

  async cancel(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
    guestAccessToken?: string,
  ) {
    const booking = await this.assertBooking(id, actor, guestAccessToken);

    if (booking.status === BS.CANCELLED) {
      throw new UnprocessableEntityException({
        code: 'BOOKING_INVALID_STATUS',
        message: 'Bron allaqachon bekor qilingan',
      });
    }

    const now = new Date().toISOString();
    const reason = String(body.reason ?? 'Bekor qilindi');

    const updated = await this.pg.transaction(async (tx) => {
      const [row] = await tx.query<BookingRow>(
        `UPDATE bookings
         SET status = $1, cancelled_at = $2, cancel_reason_text = $3, updated_at = $4
         WHERE id = $5
         RETURNING *`,
        [BS.CANCELLED, now, reason, now, id],
      );

      // Avtobus broni bekor qilinganda o'rindiq bo'shatilishi kerak —
      // avval bu FAQAT muddat tugab (cron) avtomatik bekor bo'lganda
      // ishlardi; mijoz/hamkor QO'LDA bekor qilsa o'rindiq abadiy "held"
      // holida, endi hech qachon sotilmaydigan bo'lib qolardi.
      await tx.query(
        `UPDATE trip_seats
         SET status = 'available', held_by_booking_id = NULL, held_until = NULL
         WHERE held_by_booking_id = $1::uuid`,
        [id],
      );

      // Audit topilmasi: mijoz TO'LANGAN bronni shu yo'l orqali bekor
      // qilganda hech qachon qaytarish (refund) so'rovi yaratilmasdi —
      // frontend faqat `cancelPreview()`ni ko'rsatib, keyin shu `cancel()`ni
      // chaqirar edi, pul hech qanday iz qoldirmasdan "yo'qolib" ketardi.
      // `cancelPreview()`da ko'rsatilgan 80% siyosat bilan bir xil formula
      // ishlatiladi (`refunds.service.ts`dagi `create()` bilan bir xil).
      // Guest (login qilmagan) mijoz uchun ham ishlaydi — avval faqat
      // `POST /refunds` orqali (login talab qiladigan) qo'lda so'rash
      // mumkin edi.
      const [payment] = await tx.query<{
        amount: number | string;
        currency: string;
      }>(
        `SELECT amount, currency FROM payments
         WHERE booking_id = $1 AND status = 'paid'
         ORDER BY created_at DESC LIMIT 1`,
        [id],
      );
      if (payment) {
        const [existingRefund] = await tx.query<{ id: string }>(
          `SELECT id FROM refunds WHERE booking_id = $1 AND status != 'rejected' LIMIT 1`,
          [id],
        );
        if (!existingRefund) {
          await tx.query(
            `INSERT INTO refunds (id, booking_id, user_id, status, currency, requested_amount, reason, created_at, updated_at)
             VALUES ($1, $2, $3, 'requested', $4, $5, $6, $7, $7)`,
            [
              randomUUID(),
              id,
              row?.user_id ?? null,
              payment.currency,
              Math.round(Number(payment.amount) * 0.8),
              'Mijoz bronni bekor qildi — avtomatik qaytarish so‘rovi',
              now,
            ],
          );
        }
      }

      await this.addStatusHistory(tx, row, 'cancelled', actor);

      return row;
    });

    this.events.bookingStatusChanged(updated);
    return updated;
  }

  async voucher(actor: RequestActor | undefined, id: string) {
    const booking = await this.assertBooking(id, actor);
    return {
      booking_id: id,
      booking_number: booking.booking_number,
      format: 'pdf',
      download_url: `${this.publicOrigin()}/bookings/${id}/voucher`,
    };
  }

  async statusHistory(actor: RequestActor | undefined, id: string) {
    await this.assertBooking(id, actor);
    return this.pg.query(
      'SELECT * FROM booking_status_history WHERE booking_id = $1 ORDER BY created_at DESC',
      [id],
    );
  }

  conversation(_actor: RequestActor | undefined, id: string) {
    return {
      id: `conversation_${id}`,
      booking_id: id,
      participants: [],
    };
  }

  async messages(actor: RequestActor | undefined, id: string) {
    await this.assertBooking(id, actor);
    return this.pg.query(
      'SELECT * FROM booking_messages WHERE booking_id = $1 AND hidden_at IS NULL ORDER BY created_at ASC',
      [id],
    );
  }

  async sendMessage(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertBooking(id, actor);
    const currentActor = this.requireActor(actor);
    const messageId = randomUUID();
    const now = new Date().toISOString();

    await this.pg.query(
      `INSERT INTO booking_messages (id, booking_id, sender_type, sender_id, message_type, body, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        messageId,
        id,
        currentActor.actorType,
        currentActor.id,
        'text',
        String(body.body ?? ''),
        now,
      ],
    );

    const msg = {
      id: messageId,
      booking_id: id,
      sender_type: currentActor.actorType,
      sender_id: currentActor.id,
      message_type: 'text',
      body: String(body.body ?? ''),
      created_at: now,
    };

    // Fetch booking for partner context
    const [booking] = await this.pg.query<{
      partner_organization_id?: string;
    }>('SELECT partner_organization_id FROM bookings WHERE id = $1', [id]);
    this.events.bookingMessageCreated(
      id,
      msg,
      booking?.partner_organization_id,
    );
    return msg;
  }

  async readMessage(
    actor: RequestActor | undefined,
    id: string,
    messageId: string,
  ) {
    await this.assertBooking(id, actor);
    const [message] = await this.pg.query(
      'SELECT * FROM booking_messages WHERE id = $1 AND booking_id = $2',
      [messageId, id],
    );

    if (!message) {
      throw new NotFoundException({
        code: 'BOOKING_CHAT_FORBIDDEN',
        message: 'Xabar topilmadi',
      });
    }

    return message;
  }

  async findByUser(userId: string) {
    return this.pg.query(
      'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private requireActor(actor: RequestActor | undefined): RequestActor {
    if (!actor) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Sessiya topilmadi yoki token yaroqsiz',
      });
    }
    return actor;
  }

  private guestContact(
    actor: RequestActor | undefined,
    dto: Record<string, unknown>,
  ): GuestContact {
    const firstName = this.optionalText(dto.firstName ?? dto.first_name);
    const lastName = this.optionalText(dto.lastName ?? dto.last_name);
    const fullName = this.optionalText(dto.fullName ?? dto.full_name);
    const composedName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const name =
      this.optionalText(dto.guest_name ?? dto.guestName) ??
      fullName ??
      composedName;

    const rawEmail = this.optionalText(
      dto.guest_email ?? dto.guestEmail ?? dto.email,
    );
    const email = rawEmail ? normalizeEmail(rawEmail) : '';
    if (email && !isValidEmail(email)) {
      throw new BadRequestException({
        code: 'BOOKING_GUEST_EMAIL_INVALID',
        message: "To'g'ri email manzil kiriting",
      });
    }

    const rawPhone = this.optionalText(
      dto.guest_phone ?? dto.guestPhone ?? dto.phone,
    );
    const phone = rawPhone ? normalizePhone(rawPhone) : '';
    if (phone && !isValidUzbekPhone(phone)) {
      throw new BadRequestException({
        code: 'BOOKING_GUEST_PHONE_INVALID',
        message: "To'g'ri telefon raqam kiriting",
      });
    }

    if (!actor && !name) {
      throw new BadRequestException({
        code: 'BOOKING_GUEST_NAME_REQUIRED',
        message: 'Mehmon ism-familiyasini kiriting',
      });
    }
    if (!actor && !phone && !email) {
      throw new BadRequestException({
        code: 'BOOKING_GUEST_CONTACT_REQUIRED',
        message: 'Telefon raqam yoki email manzil kiriting',
      });
    }

    return {
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      name,
      email,
      phone,
    };
  }

  private publicOrigin(): string {
    return (
      process.env.PUBLIC_API_ORIGIN ??
      `http://localhost:${process.env.PORT ?? '4000'}`
    ).replace(/\/$/, '');
  }

  private async createBooking(
    db: PostgresTransaction,
    userId: string | null,
    input: {
      type: 'hotel' | 'bus' | 'restaurant';
      partner_organization_id: string;
      payment_method: string;
      confirmation_mode: string;
      subtotal: number;
      discount_amount?: number;
      commission_rate_percent?: number;
      hotel_id: string | null;
      trip_id: string | null;
      room_id?: string | null;
      vehicle_id?: string | null;
      check_in?: string | null;
      check_out?: string | null;
      slot_time?: string | null;
      expires_at?: string;
      price_snapshot: Record<string, unknown>;
      guest_name?: string;
      guest_email?: string;
      guest_phone?: string;
      /** Faqat checkout haqiqatan Terms tekshiruvini majburlaydigan
       * chaqiruvchidan (`createHotelInternal`) keladi — boshqa bron
       * turlari (bus/vehicle) buni hozircha yubormaydi, ustunlar NULL
       * qoladi (bu vazifaning e'lon qilingan scope'i emas). */
      terms_accepted_at?: string;
      terms_version?: string;
    },
  ) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const discountAmount = Math.max(
      0,
      Math.min(input.subtotal, Math.round(input.discount_amount ?? 0)),
    );
    const totalAmount = input.subtotal - discountAmount;
    const commission = calculateCommission(
      totalAmount,
      input.commission_rate_percent,
    );
    const partnerPayable = totalAmount - commission;
    const expiresAt =
      input.expires_at ?? new Date(Date.now() + 15 * 60_000).toISOString();
    const partnerConfirmationDeadline =
      input.confirmation_mode === 'request_confirmation'
        ? new Date(Date.now() + 30 * 60_000).toISOString()
        : null;

    const guestName = input.guest_name ?? null;
    const guestEmail = input.guest_email ?? null;
    const guestPhone = input.guest_phone ?? null;

    const bookingRow = {
      id,
      booking_number: bookingNumber(),
      user_id: userId,
      partner_organization_id: input.partner_organization_id,
      type: input.type,
      confirmation_mode: input.confirmation_mode,
      payment_method: input.payment_method,
      status: BS.PENDING,
      currency: 'UZS',
      subtotal: input.subtotal,
      discount_amount: discountAmount,
      bonus_amount: 0,
      service_fee: 0,
      total_amount: totalAmount,
      commission_amount: commission,
      partner_payable: partnerPayable,
      hotel_id: input.hotel_id,
      trip_id: input.trip_id,
      room_id: input.room_id ?? null,
      vehicle_id: input.vehicle_id ?? null,
      check_in: input.check_in ?? null,
      check_out: input.check_out ?? null,
      slot_time: input.slot_time ?? null,
      partner_confirmation_deadline: partnerConfirmationDeadline,
      expires_at: expiresAt,
      confirmed_at: null as string | null,
      cancelled_at: null,
      cancel_reason_text: null,
      policy_snapshot: {},
      price_snapshot: input.price_snapshot,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone,
      terms_accepted_at: input.terms_accepted_at ?? null,
      terms_version: input.terms_version ?? null,
      created_at: now,
      updated_at: now,
    };

    await db.query(
      `INSERT INTO bookings (
        id, booking_number, user_id, partner_organization_id,
        type, confirmation_mode, payment_method, status,
        currency, subtotal, discount_amount, bonus_amount, service_fee,
        total_amount, commission_amount, partner_payable,
        hotel_id, trip_id, room_id, vehicle_id, check_in, check_out, slot_time,
        partner_confirmation_deadline, expires_at,
        confirmed_at, cancelled_at, cancel_reason_text,
        policy_snapshot, price_snapshot,
        guest_name, guest_email, guest_phone,
        terms_accepted_at, terms_version,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20, $21::date, $22::date, $23::time,
        $24, $25,
        $26, $27, $28,
        $29, $30,
        $31, $32, $33,
        $34, $35,
        $36, $37
      )`,
      [
        bookingRow.id,
        bookingRow.booking_number,
        bookingRow.user_id,
        bookingRow.partner_organization_id,
        bookingRow.type,
        bookingRow.confirmation_mode,
        bookingRow.payment_method,
        bookingRow.status,
        bookingRow.currency,
        bookingRow.subtotal,
        bookingRow.discount_amount,
        bookingRow.bonus_amount,
        bookingRow.service_fee,
        bookingRow.total_amount,
        bookingRow.commission_amount,
        bookingRow.partner_payable,
        bookingRow.hotel_id,
        bookingRow.trip_id,
        bookingRow.room_id,
        bookingRow.vehicle_id,
        bookingRow.check_in,
        bookingRow.check_out,
        bookingRow.slot_time,
        bookingRow.partner_confirmation_deadline,
        bookingRow.expires_at,
        bookingRow.confirmed_at,
        bookingRow.cancelled_at,
        bookingRow.cancel_reason_text,
        JSON.stringify(bookingRow.policy_snapshot),
        JSON.stringify(bookingRow.price_snapshot),
        bookingRow.guest_name,
        bookingRow.guest_email,
        bookingRow.guest_phone,
        bookingRow.terms_accepted_at,
        bookingRow.terms_version,
        bookingRow.created_at,
        bookingRow.updated_at,
      ],
    );

    if (bookingRow.terms_accepted_at) {
      // Best-effort — auth.service.ts'dagi auditAuthEvent bilan bir xil
      // naqsh: audit yozuvi muvaffaqiyatsiz bo'lsa ham booking oqimi
      // to'xtamaydi. SHU transaction ichida (`db.query`, `this.pg.query`
      // emas) — agar tranzaksiya biror sababdan rollback bo'lsa, audit
      // yozuvi ham birga qaytariladi (orphan audit qatori qolmaydi).
      try {
        await db.query(
          `insert into audit_logs (id, actor_type, actor_id, action, entity_type, entity_id, metadata)
           values ($1::uuid, $2, $3::uuid, $4, $5, $6::uuid, ($7)::jsonb)`,
          [
            randomUUID(),
            // 'guest' emas — bu ustunda mavjud konventsiya
            // ('user'|'partner'|'admin'|'system', qarang admin.service.ts
            // audit()) bilan mos: haqiqiy actor yo'q bo'lganda 'system'.
            userId ? 'user' : 'system',
            userId,
            'booking.terms_accepted',
            'booking',
            bookingRow.id,
            JSON.stringify({ terms_version: bookingRow.terms_version }),
          ],
        );
      } catch {
        // Audit log yozuvi muvaffaqiyatsiz bo'lsa ham booking oqimi davom etadi.
      }
    }

    await this.addStatusHistory(db, bookingRow, 'created');

    return bookingRow;
  }

  private async addStatusHistory(
    db: PostgresTransaction,
    booking: { id: string; status: string },
    action: string,
    actor?: RequestActor,
  ) {
    const now = new Date().toISOString();
    await db.query(
      `INSERT INTO booking_status_history (id, booking_id, status, action, actor_type, actor_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        booking.id,
        booking.status,
        action,
        actor?.actorType ?? null,
        actor?.id ?? null,
        now,
      ],
    );
  }

  /**
   * "Joyida to'lash" (cash) tanlangan mijoz bronidagi to'lov HECH QACHON
   * onlayn webhook orqali "paid" bo'lmaydi — shuning uchun bron `pending`
   * holatida abadiy qolib, keyin cron tomonidan avtomatik "expired"
   * qilinardi (mijoz haqiqatan joy band qilgan, hali to'lamagan bo'lsa
   * ham). Hamkorning o'zi yaratgan naqd pul bron (walk-in) darhol
   * "confirmed" qilib yaratiladigandek — mijozning o'zi tanlagan naqd
   * pul broni ham xuddi shu tarzda darhol tasdiqlanadi; pul esa keyinroq,
   * joyida olinadi.
   */
  private async confirmCashBookingIfNeeded(
    tx: PostgresTransaction,
    booking: {
      id: string;
      payment_method: string;
      confirmation_mode: string;
      status: string;
    },
  ): Promise<{ status: string; confirmed_at: string | null }> {
    if (booking.payment_method !== 'cash') {
      return { status: booking.status, confirmed_at: null };
    }
    const now = new Date().toISOString();
    const nextStatus =
      booking.confirmation_mode === 'request_confirmation'
        ? BS.AWAITING_PARTNER_CONFIRMATION
        : BS.CONFIRMED;
    await tx.query(
      `UPDATE bookings SET status = $1, confirmed_at = $2, expires_at = NULL, updated_at = $2 WHERE id = $3`,
      [nextStatus, now, booking.id],
    );
    await this.addStatusHistory(
      tx,
      { id: booking.id, status: nextStatus },
      'cash_booking_confirmed',
    );
    return { status: nextStatus, confirmed_at: now };
  }

  /**
   * 0 UZS (BEPUL) bron — masalan restoran rezervatsiyasi (mahsulot qarori,
   * 2026-09-20: restoran joy band qilish BEPUL, bu xato emas, ataylab
   * shunday).
   *
   * Bunday bron uchun to'lanadigan summa YO'Q, demak hech qachon hech
   * qanday to'lov webhook'i kelmaydi. Ilgari u `pending` + `expires_at =
   * now+15min` bilan yaratilar, so'ng `expireStaleBookings()` croni uni
   * jim `expired` qilib qo'yardi — ya'ni mijoz ham, hamkor ham ko'rgan
   * "band qilindi" bron 15 daqiqadan keyin YO'QOLARDI.
   *
   * Yechim — naqd pul (`confirmCashBookingIfNeeded`) presedenti bilan
   * AYNAN bir xil holat o'tishi: darhol tasdiqlanadi va `expires_at`
   * tozalanadi. Faqat `booking_status_history.action` ALOHIDA
   * (`free_booking_confirmed`) — bu naqd pul broni EMAS, `cash_booking_
   * confirmed` deb yozish tarixni yolg'on qilar edi.
   *
   * ⚠️ ATAYLAB QILINMAYDIGAN ishlar (mahsulot qarori bilan tasdiqlangan):
   *   - `payments` qatori YARATILMAYDI (qarang `createPayment()`) —
   *     `GET /payments/:bookingId` bunday bron uchun 404 qaytaradi, bu
   *     KUTILGAN holat;
   *   - `partner_ledger_entries` yozuvi YO'Q — 0 so'mdan hamkorga
   *     to'lanadigan hech narsa yo'q (naqd-tasdiq presedenti ham
   *     yozmaydi);
   *   - komissiya/`partner_payable` hisobi TEGILMAYDI (`finance.ts`).
   */
  private async confirmZeroAmountBooking(
    tx: PostgresTransaction,
    booking: { id: string; confirmation_mode: string },
  ): Promise<{ status: string; confirmed_at: string | null }> {
    const now = new Date().toISOString();
    const nextStatus =
      booking.confirmation_mode === 'request_confirmation'
        ? BS.AWAITING_PARTNER_CONFIRMATION
        : BS.CONFIRMED;
    await tx.query(
      `UPDATE bookings SET status = $1, confirmed_at = $2, expires_at = NULL, updated_at = $2 WHERE id = $3`,
      [nextStatus, now, booking.id],
    );
    await this.addStatusHistory(
      tx,
      { id: booking.id, status: nextStatus },
      'free_booking_confirmed',
    );
    return { status: nextStatus, confirmed_at: now };
  }

  /**
   * Bron yaratilgandan keyingi YAKUNIY bosqich — uchala yaratish oqimi
   * (mehmonxona/restoran, avto ijara, avtobus) uchun bir xil, shuning
   * uchun bitta joyda. Bron yaratish tranzaksiyasining ICHIDA chaqiriladi:
   * to'lov qatori (kerak bo'lsa) va holat o'tishi bron bilan BIR ATOMAR
   * amalda yoziladi — qisman muvaffaqiyatsizlikda hammasi birga qaytariladi.
   */
  private async settleNewBooking(
    tx: PostgresTransaction,
    booking: {
      id: string;
      total_amount: number | string;
      currency: string;
      payment_method: string;
      confirmation_mode: string;
      status: string;
      confirmed_at: string | null;
    },
  ) {
    // 0 UZS bronda bu `null` qaytaradi (qator umuman yaratilmaydi).
    const payment = await this.createPayment(tx, booking);
    const outcome =
      Number(booking.total_amount) <= 0
        ? await this.confirmZeroAmountBooking(tx, booking)
        : await this.confirmCashBookingIfNeeded(tx, booking);
    booking.status = outcome.status;
    booking.confirmed_at = outcome.confirmed_at;
    return payment;
  }

  /**
   * Bron yaratilgach tasdiqlash xabari yuboriladi — guest (login qilmagan)
   * mijoz uchun bu bron raqamini bilishning YAGONA yo'li, chunki `GET
   * /bookings/:id` endi auth talab qiladi. Xatolik bron yaratishni
   * to'xtatmasligi kerak (email provayder vaqtincha ishlamasa ham bron
   * o'zi muvaffaqiyatli qolishi kerak), shuning uchun chaqiruvchi tomonda
   * `await`siz, xatosi yutilgan holda ishlatiladi.
   */
  /**
   * Admin `cms/templates` panelida `code='booking_confirmation_email'`
   * bilan yaratib faollashtirilgan shablon bo'lsa — shu matn ishlatiladi
   * ({bookingNumber}/{guestName}/{totalAmount}/{currency} joylashtiriladi).
   * Topilmasa/faol bo'lmasa — pastdagi standart matn ishlatiladi (xulq-atvor
   * o'zgarmaydi). OTP SMS/email'lardan farqli — bu xabar provayderda
   * tasdiqlangan shablonga bog'liq EMAS (oddiy SMTP/Resend), shuning uchun
   * CMS orqali tahrirlash xavfsiz.
   */
  private async resolveCmsEmailTemplate(
    code: string,
  ): Promise<{ subject: string; body: string } | null> {
    try {
      const [row] = await this.pg.query<{
        body: unknown;
        metadata: unknown;
      }>(
        `SELECT body, metadata FROM cms_entries
         WHERE type = 'template' AND metadata ->> 'code' = $1
           AND status IN ('published', 'active')
         LIMIT 1`,
        [code],
      );
      if (!row) return null;

      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const subject =
        typeof metadata.subject === 'string' ? metadata.subject.trim() : '';
      const rawBody = row.body as Record<string, unknown> | string | null;
      const body =
        typeof rawBody === 'string' ? rawBody : String(rawBody?.uz ?? '');

      if (!subject || !body.trim()) return null;
      return { subject, body };
    } catch {
      return null;
    }
  }

  private renderCmsTemplate(
    text: string,
    vars: Record<string, string>,
  ): string {
    return text.replace(
      /\{(\w+)\}/g,
      (match, key: string) => vars[key] ?? match,
    );
  }

  private async sendBookingConfirmationEmail(booking: {
    id: string;
    booking_number?: string | null;
    guest_name?: string | null;
    guest_email?: string | null;
    total_amount: number | string;
    currency: string;
  }) {
    const to = (booking.guest_email ?? '').trim();
    if (!to) {
      return;
    }

    const vars = {
      bookingNumber: booking.booking_number ?? booking.id,
      guestName: booking.guest_name ?? '',
      totalAmount: String(booking.total_amount),
      currency: booking.currency,
    };
    const fallbackSubject = `Safaar — bron tasdiqlandi (${booking.booking_number})`;
    const fallbackText = `Assalomu alaykum${booking.guest_name ? ', ' + booking.guest_name : ''}!\n\nBroningiz qabul qilindi.\nBron raqami: ${booking.booking_number}\nSumma: ${booking.total_amount} ${booking.currency}\n\nBronni keyinchalik tekshirish uchun saytda "Bronni topish" bo'limida bron raqami va shu email manzilingizni kiriting.`;

    const template = await this.resolveCmsEmailTemplate(
      'booking_confirmation_email',
    );
    const subject = template
      ? this.renderCmsTemplate(template.subject, vars)
      : fallbackSubject;
    const text = template
      ? this.renderCmsTemplate(template.body, vars)
      : fallbackText;
    const html = template
      ? `<p>${text.replace(/\n/g, '<br/>')}</p>`
      : `<p>Assalomu alaykum${booking.guest_name ? ', ' + booking.guest_name : ''}!</p><p>Broningiz qabul qilindi.</p><p><b>Bron raqami:</b> ${booking.booking_number}<br/><b>Summa:</b> ${booking.total_amount} ${booking.currency}</p><p>Bronni keyinchalik tekshirish uchun saytda "Bronni topish" bo'limida bron raqami va shu email manzilingizni kiriting.</p>`;

    try {
      await this.emailService.send({ to, subject, text, html });
    } catch (error) {
      this.logger.warn(
        `Booking tasdiqlash emaili yuborilmadi (booking_id=${booking.id}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async createPayment(
    db: PostgresTransaction,
    booking: {
      id: string;
      total_amount: number | string;
      currency: string;
      payment_method: string;
    },
  ) {
    // 0 UZS (BEPUL) bron uchun `payments` qatori UMUMAN YARATILMAYDI
    // (mahsulot qarori, 2026-09-20): to'lanadigan summa yo'q va hech bir
    // provayder 0 so'mlik sessiyani ro'yxatga ola olmaydi. Ilgari bu yerda
    // 0 so'mlik "pending" qoralama yozilardi — u hech qachon `paid`
    // bo'lmasdi, natijada bron `expireStaleBookings()` croni tomonidan
    // jim `expired` qilinardi.
    //
    // Natija (kutilgan, xato emas): `GET /payments/:bookingId` bunday bron
    // uchun 404 `PAYMENT_PROVIDER_ERROR` qaytaradi, `lookupBooking()` va
    // `findOne()` esa `payment: null` beradi — ikkalasi ham buni
    // allaqachon qo'llab-quvvatlaydi. Bron o'zi `confirmZeroAmountBooking()`
    // orqali darhol tasdiqlanadi (`expires_at = NULL`).
    if (Number(booking.total_amount) <= 0) {
      return null;
    }

    // Shu bron uchun hali natijasi chiqmagan (pending/processing) payment
    // bo'lsa — yangisini yaratmasdan o'shani qaytaramiz (masalan
    // `retryPayment()` xuddi shu urinishning o'zini ochib qoladigan
    // holatda). Buni bilmasdan yangi qator yaratish bir bronga bir nechta
    // mustaqil to'lov qatorini keltirib chiqarardi, va webhook keyinchalik
    // qaysi birini "to'landi" deb belgilashni noaniq tanlashga majbur
    // bo'lardi.
    const [existing] = await db.query<{
      id: string;
      booking_id: string;
      provider: string;
      card_scheme: string | null;
      status: string;
      amount: number | string;
      currency: string;
      payment_url: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT * FROM payments
       WHERE booking_id = $1 AND status IN ('pending', 'processing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [booking.id],
    );
    if (existing) {
      // Javobda (frontendga) `provider` — foydalanuvchi TANLAGAN usul
      // (`card_scheme` bo'lsa o'sha), ichki transport (`uzum_checkout`)
      // EMAS — javob shakli o'zgarmasligi uchun.
      return this.shapePaymentRow(existing);
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    // Bron yaratilishining o'zi provayder sozlanmagan bo'lsa ham
    // muvaffaqiyatsiz bo'lib qolmasligi kerak (mijoz bronni ko'rib,
    // keyinroq `/payments/:id/create`'ni qayta chaqirib to'lashi mumkin —
    // o'sha marshrut sozlanmagan holatda aniq xato qaytaradi). Shu sabab
    // bu yerda checkout URL yaratib bo'lmasa jim `null`ga tushamiz.
    let paymentUrl: string | null = null;
    try {
      paymentUrl = this.paymentsService.buildCheckoutUrl(
        booking.payment_method,
        booking.id,
        Number(booking.total_amount),
      );
    } catch {
      paymentUrl = null;
    }
    // Karta sxemalari (humo/uzcard/visa/mastercard) UCHUN `provider` ustuni
    // DOIM 'uzum_checkout' (texnik transport/rail), tanlangan karta turi esa
    // `card_scheme` ustunida — bu sxema konvensiyasi (schema.prisma
    // `Payment.cardScheme`, migratsiya 20260916150100) va
    // `payments.service.ts::createUzumCheckoutPayment()` yozadigan KANONIK
    // qator bilan bir xil. Ilgari bu yerga xom `provider='uzcard'` yozilardi
    // — natijada `payments.service.ts::createPayment()`dagi idempotentlik
    // tekshiruvi (`card_scheme ?? provider`) bu O'LIK qoralamani so'ralgan
    // usul bilan bir xil deb topib, uni HECH QACHON `checkout.register()`ga
    // yubormasdan qaytarardi (karta to'lovi umuman provayderga yetib
    // bormasdi).
    const cardScheme = isCardScheme(booking.payment_method)
      ? booking.payment_method
      : null;
    const payment = {
      id,
      booking_id: booking.id,
      provider: cardScheme ? 'uzum_checkout' : booking.payment_method,
      card_scheme: cardScheme,
      // "Joyida to'lash" tanlangan bron uchun to'lov hech qachon onlayn
      // webhook orqali "paid" bo'lmaydi — pul mehmonxonada qo'lda
      // olinadi. Avval bu ham 'pending' deb yozilardi, ya'ni frontend
      // (`?payment=cash` URL parametriga tayanib) mijozga "joyida
      // to'lang" deb ko'rsatib turgan payment.status'ning o'zi buni
      // hech qachon aks ettirmasdi.
      status: booking.payment_method === 'cash' ? 'awaiting_cash' : 'pending',
      amount: Number(booking.total_amount),
      currency: booking.currency,
      payment_url: paymentUrl,
      created_at: now,
      updated_at: now,
    };

    // ESLATMA — `base_amount`/`fee_rate`/`fee_amount` ATAYLAB to'ldirilmaydi
    // (NULL, avvalgidek): bu qator faqat QORALAMA/placeholder (hali hech
    // qanday tashqi sessiya yo'q, `payment_url` ham `null`). Karta fee'si
    // (`card-scheme-fee.ts`) YAGONA joyda — `payments.service.ts::
    // createUzumCheckoutPayment()`da, HAQIQIY `/payment/register` summasi
    // bilan birga hisoblanadi; bu yerda uni takrorlash ikkita mustaqil fee
    // manbai (va `amount` bilan ziddiyat) xavfini tug'dirar edi.
    await db.query(
      `INSERT INTO payments (id, booking_id, provider, card_scheme, status, amount, currency, payment_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        payment.id,
        payment.booking_id,
        payment.provider,
        payment.card_scheme,
        payment.status,
        payment.amount,
        payment.currency,
        payment.payment_url,
        payment.created_at,
        payment.updated_at,
      ],
    );

    // Javob shakli O'ZGARMAYDI (orqaga moslik): frontend avvalgidek
    // `provider` maydonida AYNAN tanlangan usulni (`uzcard`/`humo`/...)
    // ko'radi; `uzum_checkout` faqat DB ichidagi transport qiymati.
    return this.shapePaymentRow(payment);
  }

  private async assertBooking(
    id: string,
    actor?: RequestActor,
    guestAccessToken?: string,
  ): Promise<BookingRow> {
    const [booking] = await this.pg.query<BookingRow>(
      'SELECT * FROM bookings WHERE id = $1',
      [id],
    );

    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_EXPIRED',
        message: 'Bron topilmadi',
      });
    }

    if (!actor) {
      // Guest (login qilmagan) mijoz — faqat AYNAN shu bronni yaratishda
      // o'ziga berilgan opaque access-tokeni bilan, VA faqat bron haqiqatan
      // ham egasiz (user_id NULL) bo'lsagina o'tkaziladi. Xom bron ID'ini
      // bilishning o'zi HECH QACHON yetarli emas (IDOR'ga qarshi) — token
      // booking-yaratishda cache'ga yozilgan va AYNAN shu ID'ga bog'langan,
      // boshqa bronni ochish uchun ishlatib bo'lmaydi.
      if (guestAccessToken && !booking.user_id) {
        const grantedBookingId =
          await this.resolveGuestBookingAccessTokenBookingId(guestAccessToken);
        if (grantedBookingId === id) {
          return booking;
        }
      }

      // Anonim (tokensiz yoki yaroqsiz guest-token) chaqiruv — bron egasini
      // aniqlab bo'lmaydi, shuning uchun rad etiladi. Guest bronni email
      // orqali qidirish uchun `POST /bookings/lookup` ishlatilishi mumkin.
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

  async assertBookingForActor(actor: RequestActor | undefined, id: string) {
    return this.assertBooking(id, actor);
  }

  /**
   * Guest (login qilmagan) mijoz o'z bronini keyinroq (masalan tasdiqlash
   * sahifasini qayta yuklash orqali) ko'rishi uchun opaque, cache-backed
   * ruxsat tokeni. Endi `GuestBookingAccessService`ga ko'chirilgan
   * (`PaymentsService` ham qayta ishlatadi guest to'lov uchun) — bu yerda
   * faqat nomlar moslik uchun saqlangan.
   */
  private async issueGuestBookingAccessToken(
    bookingId: string,
  ): Promise<string> {
    return this.guestAccess.issue(bookingId);
  }

  /** Peek — NOT consumed, chunki guest bir nechta martalik (sahifani qayta
   * yuklash, keyinroq qaytib kelish) shu bir tokendan foydalanishi kerak. */
  private async resolveGuestBookingAccessTokenBookingId(
    token: string,
  ): Promise<string | undefined> {
    return this.guestAccess.resolve(token);
  }

  private paymentMethod(value: unknown): string {
    const method = String(value ?? 'click');
    return [
      'click',
      'payme',
      'uzcard',
      'humo',
      'visa',
      'mastercard',
      'cash',
    ].includes(method)
      ? method
      : 'click';
  }

  private confirmationMode(value: unknown): string {
    const mode = String(value ?? 'instant_confirmation');
    return mode === 'request_confirmation' ? mode : 'instant_confirmation';
  }

  private optionalText(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const text = String(value).trim();
    return text || undefined;
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const start = Date.parse(checkIn);
    const end = Date.parse(checkOut);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return 1;
    }

    return Math.max(1, Math.ceil((end - start) / 86_400_000));
  }
}

function bookingNumber(): string {
  return `UZB-${Date.now().toString(36).toUpperCase()}`;
}
