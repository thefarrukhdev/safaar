import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus, Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import {
  calculateCommission,
  resolveAccommodationCommissionRate,
} from '../common/finance';
import { CURRENT_TERMS_VERSION } from '../common/legal';
import { AppCacheService } from '../infrastructure/cache.service';
import { EmailService } from '../infrastructure/email.service';
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

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly pg: PostgresService,
    private readonly events: EventsService,
    private readonly emailService: EmailService,
    private readonly promosService: PromosService,
    private readonly paymentsService: PaymentsService,
    private readonly cache: AppCacheService,
  ) {}

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
               WHERE p.booking_id = bookings.id AND p.status IN ('paid', 'processing')
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
      if (
        (hotel.check_in_time && slotTime < hotel.check_in_time) ||
        (hotel.check_out_time && slotTime >= hotel.check_out_time)
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
    const firstName = this.optionalText(dto.firstName ?? dto.first_name);
    const lastName = this.optionalText(dto.lastName ?? dto.last_name);
    const fullName = this.optionalText(dto.fullName ?? dto.full_name);
    const composedName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const guestName =
      this.optionalText(dto.guest_name ?? dto.guestName) ??
      fullName ??
      (composedName || '');
    const guestEmail =
      this.optionalText(
        dto.guest_email ?? dto.guestEmail ?? dto.email,
      )?.toLowerCase() ?? '';
    const guestPhone =
      this.optionalText(dto.guest_phone ?? dto.guestPhone ?? dto.phone) ?? '';

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
        "SELECT id, base_price, hotel_id, total_inventory FROM hotel_rooms WHERE id = $1 AND hotel_id = $2 AND status = 'active' FOR UPDATE",
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
               AND $6::time < (slot_time + interval '90 minutes')`,
            [room.id, ...activeExclusions, checkIn, slotTime],
          )
        : await tx.query<{ booked_count: string | number }>(
            `SELECT COALESCE(SUM(COALESCE((price_snapshot->>'rooms')::int, 1)), 0) AS booked_count
             FROM bookings
             WHERE room_id = $1::uuid
               AND status NOT IN ($2, $3, $4)
               AND check_in < $5::date
               AND $6::date < check_out`,
            [room.id, ...activeExclusions, checkOut, checkIn],
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

      const subtotal = Number(room.base_price) * nights * rooms;
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
        payment_method: this.paymentMethod(dto.payment_method),
        confirmation_mode: this.confirmationMode(dto.confirmation_mode),
        subtotal,
        discount_amount: discountAmount,
        commission_rate_percent: resolvedCommissionRatePercent,
        hotel_id: hotel.id,
        trip_id: null,
        room_id: room.id,
        check_in: checkIn,
        check_out: checkOut,
        slot_time: isRestaurant ? slotTime : null,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        terms_accepted_at: new Date().toISOString(),
        terms_version: CURRENT_TERMS_VERSION,
        price_snapshot: {
          room_id: room.id,
          check_in: checkIn,
          check_out: checkOut,
          slot_time: isRestaurant ? slotTime : null,
          nights,
          rooms,
          adults: Number(dto.adults ?? dto.guests ?? 1),
          children: Number(dto.children ?? 0),
          promo_code: promo?.code ?? null,
          guest: {
            first_name: firstName ?? null,
            last_name: lastName ?? null,
            name: guestName,
            email: guestEmail,
            phone: guestPhone,
          },
        },
      });

      const payment = await this.createPayment(tx, booking);
      const cashOutcome = await this.confirmCashBookingIfNeeded(tx, booking);
      booking.status = cashOutcome.status;
      booking.confirmed_at = cashOutcome.confirmed_at;
      return { booking, payment };
    });

    this.events.bookingStatusChanged(booking);
    this.events.partnerDashboardUpdated(booking.partner_organization_id);
    this.events.adminDashboardUpdated();
    void this.sendBookingConfirmationEmail(booking);

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

    const firstName = this.optionalText(dto.firstName ?? dto.first_name);
    const lastName = this.optionalText(dto.lastName ?? dto.last_name);
    const fullName = this.optionalText(dto.fullName ?? dto.full_name);
    const composedName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const guestName =
      this.optionalText(dto.guest_name ?? dto.guestName) ??
      fullName ??
      (composedName || '');
    const guestEmail =
      this.optionalText(
        dto.guest_email ?? dto.guestEmail ?? dto.email,
      )?.toLowerCase() ?? '';
    const guestPhone =
      this.optionalText(dto.guest_phone ?? dto.guestPhone ?? dto.phone) ?? '';

    const promoCode = this.optionalText(dto.promo_code ?? dto.promoCode);
    const promo = await this.resolvePromo(promoCode);

    const { booking, payment } = await this.pg.transaction(async (tx) => {
      const [locked] = await tx.query<VehicleRow>(
        "SELECT id, price_per_day FROM vehicles WHERE id = $1 AND status = 'active' FOR UPDATE",
        [vehicle.id],
      );
      if (!locked) {
        throw new NotFoundException({
          code: 'VEHICLE_NOT_AVAILABLE',
          message: 'Tanlangan sanalar uchun mashina mavjud emas',
        });
      }

      const activeExclusions = [BS.CANCELLED, BS.EXPIRED, BS.COMPLETED];
      const conflicts = await tx.query<{ id: string }>(
        `SELECT id FROM bookings
         WHERE vehicle_id = $1::uuid
           AND status NOT IN ($2, $3, $4)
           AND check_in < $5::date
           AND $6::date < check_out
         LIMIT 1`,
        [locked.id, ...activeExclusions, checkOut, checkIn],
      );

      if (conflicts[0]) {
        throw new ConflictException({
          code: 'VEHICLE_ALREADY_BOOKED',
          message: 'Tanlangan sanalar uchun mashina allaqachon band qilingan',
        });
      }

      const subtotal = Number(locked.price_per_day) * days;
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
        partner_organization_id: vehicle.partner_organization_id,
        payment_method: this.paymentMethod(dto.payment_method),
        confirmation_mode: this.confirmationMode(dto.confirmation_mode),
        subtotal,
        discount_amount: discountAmount,
        commission_rate_percent: vehicle.commission_rate,
        hotel_id: null,
        trip_id: null,
        vehicle_id: locked.id,
        check_in: checkIn,
        check_out: checkOut,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        price_snapshot: {
          vehicle_id: locked.id,
          check_in: checkIn,
          check_out: checkOut,
          days,
          price_per_day: Number(locked.price_per_day),
          promo_code: promo?.code ?? null,
          guest: {
            first_name: firstName ?? null,
            last_name: lastName ?? null,
            name: guestName,
            email: guestEmail,
            phone: guestPhone,
          },
        },
      });

      const payment = await this.createPayment(tx, booking);
      const cashOutcome = await this.confirmCashBookingIfNeeded(tx, booking);
      booking.status = cashOutcome.status;
      booking.confirmed_at = cashOutcome.confirmed_at;
      return { booking, payment };
    });

    this.events.bookingStatusChanged(booking);
    this.events.partnerDashboardUpdated(booking.partner_organization_id);
    this.events.adminDashboardUpdated();
    void this.sendBookingConfirmationEmail(booking);

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
    const currentActor = this.requireActor(actor);
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

      const booking = await this.createBooking(tx, currentActor.id, {
        type: 'bus',
        partner_organization_id: partnerOrganizationId,
        payment_method: this.paymentMethod(dto.payment_method),
        confirmation_mode: this.confirmationMode(dto.confirmation_mode),
        subtotal,
        discount_amount: discountAmount,
        commission_rate_percent: company.commission_rate,
        hotel_id: null,
        trip_id: trip.id,
        expires_at: expiresAt.toISOString(),
        price_snapshot: {
          seats: seats.map((s) => s.seat_code),
          passengers: dto.passengers ?? [],
          promo_code: promo?.code ?? null,
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

      const payment = await this.createPayment(tx, booking);
      const cashOutcome = await this.confirmCashBookingIfNeeded(tx, booking);
      booking.status = cashOutcome.status;
      booking.confirmed_at = cashOutcome.confirmed_at;
      return { booking, payment };
    });

    this.events.bookingStatusChanged(booking);
    this.events.partnerDashboardUpdated(booking.partner_organization_id);
    this.events.adminDashboardUpdated();
    return { booking, payment };
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
    return { ...booking, payment: payment ?? null };
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

    const [payment] = await this.pg.query(
      'SELECT status, provider, amount, currency FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1',
      [booking.id],
    );

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
    return this.createPayment(this.pg, booking);
  }

  async cancelPreview(actor: RequestActor | undefined, id: string) {
    const booking = await this.assertBooking(id, actor);
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
  ) {
    const booking = await this.assertBooking(id, actor);

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
    booking_number: string;
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
      bookingNumber: booking.booking_number,
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
      return existing;
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
    const payment = {
      id,
      booking_id: booking.id,
      provider: booking.payment_method,
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

    await db.query(
      `INSERT INTO payments (id, booking_id, provider, status, amount, currency, payment_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        payment.id,
        payment.booking_id,
        payment.provider,
        payment.status,
        payment.amount,
        payment.currency,
        payment.payment_url,
        payment.created_at,
        payment.updated_at,
      ],
    );

    return payment;
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

  // Guest booking confirmation sahifasi bir necha kun davomida qayta
  // ochilishi (to'lov holatini tekshirish, kvitansiyani qayta ko'rish)
  // mumkin bo'lgani uchun bir martalik emas — `JWT_REFRESH_TTL`ning
  // standart qiymati (30 kun) bilan bir xil, ishlatilgan muddat.
  private readonly GUEST_BOOKING_ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60;

  private guestBookingAccessKey(token: string): string {
    return `booking:guest-access:${createHash('sha256').update(token).digest('hex')}`;
  }

  /**
   * Guest (login qilmagan) mijoz o'z bronini keyinroq (masalan tasdiqlash
   * sahifasini qayta yuklash orqali) ko'rishi uchun opaque, cache-backed
   * ruxsat tokeni — xuddi `AuthService`dagi parol-tiklash tokeni bilan bir
   * xil naqsh (xom token hech qachon DB/cache'da saqlanmaydi, faqat uning
   * SHA-256 xeshi cache kaliti sifatida ishlatiladi).
   */
  private async issueGuestBookingAccessToken(
    bookingId: string,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.cache.set(
      this.guestBookingAccessKey(token),
      { bookingId },
      this.GUEST_BOOKING_ACCESS_TTL_SECONDS,
    );
    return token;
  }

  /** Peek — NOT consumed, chunki guest bir nechta martalik (sahifani qayta
   * yuklash, keyinroq qaytib kelish) shu bir tokendan foydalanishi kerak. */
  private async resolveGuestBookingAccessTokenBookingId(
    token: string,
  ): Promise<string | undefined> {
    const context = await this.cache.get<{ bookingId: string }>(
      this.guestBookingAccessKey(token),
    );
    return context?.bookingId;
  }

  private paymentMethod(value: unknown): string {
    const method = String(value ?? 'click');
    return ['click', 'payme', 'uzcard', 'humo', 'cash'].includes(method)
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
