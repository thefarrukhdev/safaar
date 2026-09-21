import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import {
  limitOffsetSql,
  parsePagination,
  type QueryLike,
} from '../common/pagination';
import { PostgresService } from '../infrastructure/postgres.service';
import { UploadsService, type UploadedFile } from '../uploads/uploads.service';
import {
  REVIEW_TARGET_TYPES,
  sanitizeReviewText,
  type CreateReviewDto,
  type ReviewTargetType,
} from './dto/review.dto';

/**
 * Obyekt mavjudligini tekshirish uchun SQL — jadval nomi HECH QACHON
 * foydalanuvchi kiritmasidan qurilmaydi, har bir tur uchun to'liq literal
 * so'rov yozilgan (SQL injection yuzasi nol).
 */
const TARGET_EXISTS_SQL: Record<ReviewTargetType, string> = {
  hotel: 'SELECT id::text FROM hotels WHERE id = $1 LIMIT 1',
  bus_company: 'SELECT id::text FROM bus_companies WHERE id = $1 LIMIT 1',
};

/**
 * Ommaviy sharh ro'yxatida qaytariladigan ustunlar. ATAYLAB `SELECT *` EMAS:
 * jadvalga yangi ustun qo'shilganda (masalan `guest_name`) u avtomatik
 * ommaviy API'ga chiqib ketmasligi kerak. `user_id`, `u.phone`, `u.email`
 * va boshqa PII bu ro'yxatda YO'Q — faqat ko'rsatiladigan ism qaytadi.
 */
const PUBLIC_REVIEW_COLUMNS = `
  r.id::text,
  r.target_type,
  r.target_id::text,
  r.rating::float8,
  r.cleanliness::float8,
  r.staff::float8,
  r.location::float8,
  r.value_for_money::float8,
  r.photos,
  r.body,
  r.status::text,
  r.author_type,
  CASE
    WHEN r.author_type = 'GUEST'
      THEN coalesce(nullif(trim(coalesce(r.guest_name, '')), ''), 'Mehmon')
    ELSE coalesce(
      nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), ''),
      'Mijoz'
    )
  END AS author_name,
  (r.booking_id IS NOT NULL) AS verified,
  r.created_at,
  r.updated_at
`;

const PUBLIC_SORT_COLUMNS: Record<string, string> = {
  created_at: 'r.created_at',
  rating: 'r.rating',
};

@Injectable()
export class ReviewsService {
  constructor(
    private readonly pg: PostgresService,
    private readonly uploads: UploadsService,
  ) {}

  async photos(actor: RequestActor | undefined, files: UploadedFile[]) {
    const currentActor = this.requireActor(actor);
    if (files.length === 0 || files.length > 5) {
      throw new BadRequestException({
        code: 'REVIEW_PHOTOS_COUNT_INVALID',
        message: '1 tadan 5 tagacha rasm yuboring',
      });
    }

    const uploaded = await Promise.all(
      files.map((file) =>
        this.uploads.createForOwner(
          'review_photo',
          currentActor.id,
          'image',
          {},
          file,
          {
            bucket: 'reviews',
            maxSize: 10 * 1024 * 1024,
          },
        ),
      ),
    );

    return {
      urls: uploaded
        .map((file) => String(file['url'] ?? ''))
        .filter((url) => url.length > 0),
    };
  }

  /**
   * Sharh yaratish.
   *
   * KIMLIK FAQAT `actor`DAN OLINADI. `user_id`, `status`, `author_type`,
   * `id`, `created_at`, `updated_at` HECH QACHON so'rov tanasidan
   * o'qilmaydi — bular doim serverda belgilanadi. `CreateReviewDto`da bu
   * maydonlar UMUMAN e'lon qilinmagan, global ValidationPipe esa
   * `forbidNonWhitelisted: true` bilan ishlaydi, shuning uchun klient
   * ularni yuborishga urinsa butun so'rov 400 bo'ladi (mass-assignment
   * himoyasi).
   *
   * MODERATSIYA QOIDASI:
   *   - mehmon (login yo'q)                  -> 'pending_review'
   *   - login + tasdiqlangan bron topildi    -> 'published' (eski xatti-harakat)
   *   - login + bron topilmadi               -> 'pending_review'
   * Login qilgan mijoz mehmondan QAT'IYROQ cheklanmasligi kerak: mahsulot
   * qaroriga ko'ra mehmon umuman bronsiz sharh qoldira oladi.
   * ISTISNO: klient ANIQ `booking_id` yuborib, u boshqa mijozniki/
   * tasdiqlanmagan/boshqa obyektga tegishli bo'lsa — bu tasdiqlash
   * signalini soxtalashtirishga urinish, shuning uchun jim "pending"ga
   * tushirilmaydi, 403 qaytariladi.
   */
  async create(actor: RequestActor | undefined, dto: CreateReviewDto) {
    const targetType = dto.target_type ?? dto.targetType ?? 'hotel';
    const targetId =
      dto.target_id ?? dto.targetId ?? dto.hotel_id ?? dto.hotelId ?? '';
    if (!targetId) {
      throw new BadRequestException({
        code: 'REVIEW_TARGET_REQUIRED',
        message: 'Sharh obyekti ko‘rsatilishi kerak',
      });
    }

    await this.assertTargetExists(targetType, targetId);

    const booking = actor
      ? await this.resolveVerifiedBooking(
          actor.id,
          targetType,
          targetId,
          dto.booking_id ?? dto.bookingId,
        )
      : null;

    if (actor && booking) {
      await this.assertNoDuplicateReview(actor.id, booking.id);
    }

    const authorType = actor ? 'USER' : 'GUEST';
    const status = actor && booking ? 'published' : 'pending_review';
    const criteria = this.reviewCriteria(
      dto as unknown as Record<string, unknown>,
    );
    const rating = ratingValue(
      dto.rating,
      averageRating(Object.values(criteria).filter(isNumber)),
    );
    const reviewBody = String(dto.body ?? '');
    // Mehmon rasm yuklay olmaydi: `media_files.owner_id` UUID NOT NULL va
    // `uploads.createForOwner` real actor id talab qiladi. Soxta UUID
    // yaratilmaydi — mehmon sharhida photos doim [].
    const photos = actor ? photoList(dto.photos) : [];
    const guestName = actor
      ? null
      : (stringValue(sanitizeReviewText(dto.guest_name)) ?? null);
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.pg.query(
      `INSERT INTO reviews
         (id, user_id, author_type, guest_name, booking_id, target_type,
          target_id, rating, cleanliness, staff, location, value_for_money,
          photos, body, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16, $17)`,
      [
        id,
        actor?.id ?? null,
        authorType,
        guestName,
        booking?.id ?? null,
        targetType,
        targetId,
        rating,
        criteria.cleanliness,
        criteria.staff,
        criteria.location,
        criteria.valueForMoney,
        JSON.stringify(photos),
        reviewBody,
        status,
        now,
        now,
      ],
    );

    return {
      id,
      user_id: actor?.id ?? null,
      author_type: authorType,
      guest_name: guestName,
      booking_id: booking?.id ?? null,
      target_type: targetType,
      target_id: targetId,
      rating,
      cleanliness: criteria.cleanliness,
      staff: criteria.staff,
      location: criteria.location,
      value_for_money: criteria.valueForMoney,
      photos,
      body: reviewBody,
      status,
      verified: booking !== null,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * `GET /reviews?target_type=&target_id=` — ommaviy sharh ro'yxati.
   * FAQAT `status = 'published'`: moderatsiya navbatidagi
   * (`pending_review`) va yashirilgan (`hidden`) sharhlar chiqmaydi.
   */
  async list(query: QueryLike = {}) {
    const { targetType, targetId } = this.parseTargetFilter(query);
    const pagination = parsePagination(query, 'public', {
      allowedSortBy: ['created_at', 'rating'],
      defaultSortBy: 'created_at',
      defaultLimit: 20,
    });
    const sortColumn =
      PUBLIC_SORT_COLUMNS[pagination.sortBy] ?? PUBLIC_SORT_COLUMNS.created_at;
    const direction = pagination.order === 'asc' ? 'ASC' : 'DESC';

    return this.pg.query(
      `SELECT ${PUBLIC_REVIEW_COLUMNS}
       FROM reviews r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.target_type = $1 AND r.target_id = $2 AND r.status = 'published'
       ORDER BY ${sortColumn} ${direction}
       ${limitOffsetSql(pagination)}`,
      [targetType, targetId],
    );
  }

  /**
   * `GET /reviews/summary?target_type=&target_id=` — jami/o'rtacha/taqsimot.
   * BITTA agregat so'rov (N+1 yo'q), faqat `status = 'published'` ustidan.
   */
  async summary(query: QueryLike = {}) {
    const { targetType, targetId } = this.parseTargetFilter(query);

    const [row] = await this.pg.query<{
      total: number;
      average: number;
      cleanliness: number | null;
      staff: number | null;
      location: number | null;
      value_for_money: number | null;
      rating_1: number;
      rating_2: number;
      rating_3: number;
      rating_4: number;
      rating_5: number;
    }>(
      `SELECT
         count(*)::int AS total,
         coalesce(avg(r.rating), 0)::float8 AS average,
         avg(r.cleanliness)::float8 AS cleanliness,
         avg(r.staff)::float8 AS staff,
         avg(r.location)::float8 AS location,
         avg(r.value_for_money)::float8 AS value_for_money,
         count(*) FILTER (WHERE round(r.rating) = 1)::int AS rating_1,
         count(*) FILTER (WHERE round(r.rating) = 2)::int AS rating_2,
         count(*) FILTER (WHERE round(r.rating) = 3)::int AS rating_3,
         count(*) FILTER (WHERE round(r.rating) = 4)::int AS rating_4,
         count(*) FILTER (WHERE round(r.rating) = 5)::int AS rating_5
       FROM reviews r
       WHERE r.target_type = $1 AND r.target_id = $2 AND r.status = 'published'`,
      [targetType, targetId],
    );

    return {
      target_type: targetType,
      target_id: targetId,
      total: Number(row?.total ?? 0),
      average: Math.round(Number(row?.average ?? 0) * 10) / 10,
      criteria: {
        cleanliness: roundOrNull(row?.cleanliness),
        staff: roundOrNull(row?.staff),
        location: roundOrNull(row?.location),
        value_for_money: roundOrNull(row?.value_for_money),
      },
      distribution: {
        '1': Number(row?.rating_1 ?? 0),
        '2': Number(row?.rating_2 ?? 0),
        '3': Number(row?.rating_3 ?? 0),
        '4': Number(row?.rating_4 ?? 0),
        '5': Number(row?.rating_5 ?? 0),
      },
    };
  }

  async update(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const review = await this.assertReview(id);
    this.assertReviewOwner(actor, review);
    const now = new Date().toISOString();
    const criteria = this.reviewCriteria(body, review);
    const rating = ratingValue(body.rating, Number(review['rating'] ?? 5));
    const reviewBody = String(body.body ?? review['body']);
    const photos =
      body.photos === undefined
        ? photoList(review['photos'])
        : photoList(body.photos);
    await this.pg.query(
      `UPDATE reviews
       SET rating = $1,
           cleanliness = $2,
           staff = $3,
           location = $4,
           value_for_money = $5,
           photos = $6::jsonb,
           body = $7,
           updated_at = $8
       WHERE id = $9`,
      [
        rating,
        criteria.cleanliness,
        criteria.staff,
        criteria.location,
        criteria.valueForMoney,
        JSON.stringify(photos),
        reviewBody,
        now,
        id,
      ],
    );
    return {
      ...review,
      rating,
      cleanliness: criteria.cleanliness,
      staff: criteria.staff,
      location: criteria.location,
      value_for_money: criteria.valueForMoney,
      photos,
      body: reviewBody,
      updated_at: now,
    };
  }

  async delete(actor: RequestActor | undefined, id: string) {
    const review = await this.assertReview(id);
    this.assertReviewOwner(actor, review);
    const now = new Date().toISOString();
    await this.pg.query(
      'UPDATE reviews SET status = $1, updated_at = $2 WHERE id = $3',
      ['hidden', now, id],
    );
    return { ...review, status: 'hidden', updated_at: now };
  }

  async reply(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const currentActor = this.requireActor(actor);
    const review = await this.assertReview(id);
    await this.assertPartnerCanReply(currentActor, review);
    const reply = {
      id: randomUUID(),
      review_id: id,
      partner_user_id: currentActor.id,
      body: String(body.body ?? ''),
      created_at: new Date().toISOString(),
    };
    return reply;
  }

  private async assertReview(id: string) {
    const [review] = await this.pg.query(
      'SELECT * FROM reviews WHERE id = $1',
      [id],
    );
    if (!review) {
      throw new NotFoundException({
        code: 'VALIDATION_ERROR',
        message: 'Sharh topilmadi',
      });
    }
    return review;
  }

  private assertReviewOwner(
    actor: RequestActor | undefined,
    review: Record<string, unknown>,
  ) {
    const currentActor = this.requireActor(actor);
    if (
      currentActor.role === Role.SUPER_ADMIN ||
      currentActor.actorType === 'admin' ||
      review['user_id'] === currentActor.id
    ) {
      return;
    }
    throw new ForbiddenException({
      code: 'REVIEW_FORBIDDEN',
      message: 'Bu sharh sizga tegishli emas',
    });
  }

  private async assertPartnerCanReply(
    actor: RequestActor,
    review: Record<string, unknown>,
  ) {
    const [booking] = await this.pg.query<{
      partner_organization_id: string;
    }>('SELECT partner_organization_id FROM bookings WHERE id = $1', [
      String(review['booking_id'] ?? ''),
    ]);
    if (
      booking &&
      actor.actorType === 'partner' &&
      booking.partner_organization_id === actor.organizationId
    ) {
      return;
    }
    throw new ForbiddenException({
      code: 'REVIEW_REPLY_FORBIDDEN',
      message: 'Bu sharh sizning tashkilotingizga tegishli emas',
    });
  }

  private requireActor(actor: RequestActor | undefined): RequestActor {
    if (!actor) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Sessiya topilmadi yoki token yaroqsiz',
      });
    }
    return actor;
  }

  /**
   * Obyekt (hotel / bus_company) haqiqatan mavjudligini tekshiradi.
   * Jadval nomi foydalanuvchi kiritmasidan QURILMAYDI —
   * `TARGET_EXISTS_SQL` literal so'rovlar xaritasidan olinadi.
   */
  private async assertTargetExists(
    targetType: ReviewTargetType,
    targetId: string,
  ) {
    const sql = TARGET_EXISTS_SQL[targetType];
    if (!sql) {
      throw new BadRequestException({
        code: 'REVIEW_TARGET_TYPE_INVALID',
        message: 'Sharh obyekti turi qo‘llab-quvvatlanmaydi',
      });
    }

    const [row] = await this.pg.query(sql, [targetId]);
    if (!row) {
      throw new NotFoundException({
        code: 'REVIEW_TARGET_NOT_FOUND',
        message: 'Sharh qoldiriladigan obyekt topilmadi',
      });
    }
  }

  /**
   * DUBLIKAT QOIDASI: bitta (user_id, booking_id) juftligi uchun BITTA
   * sharh. Ataylab ILOVA qatlamida, INSERT'dan oldin tekshiriladi —
   * DB UNIQUE cheklovi QO'YILMAYDI, chunki produktsiyadagi mavjud
   * dublikat holati tekshirilmagan va UNIQUE bir tomonlama eshik
   * (migratsiya mavjud ma'lumotda yiqilishi mumkin).
   *
   * `status` ATAYLAB filtrlanmaydi: moderator yashirgan (`hidden`)
   * sharh ham dublikat hisoblanadi, aks holda mijoz moderatsiyadan
   * qayta-qayta post qilib qochib ketardi.
   *
   * Mehmonda (GUEST) dedupe identifikatori YO'Q — ular faqat rate
   * limiting bilan cheklanadi (`@Throttle` 5/min, ReviewsController).
   */
  private async assertNoDuplicateReview(userId: string, bookingId: string) {
    const [existing] = await this.pg.query<{ id: string }>(
      `SELECT id::text FROM reviews
       WHERE user_id = $1 AND booking_id = $2
       LIMIT 1`,
      [userId, bookingId],
    );
    if (existing) {
      throw new ForbiddenException({
        code: 'REVIEW_DUPLICATE',
        message: 'Bu bron uchun sharh allaqachon qoldirilgan',
      });
    }
  }

  private parseTargetFilter(query: QueryLike): {
    targetType: ReviewTargetType;
    targetId: string;
  } {
    const targetType = firstQueryValue(
      query.target_type ?? query.targetType ?? 'hotel',
    );
    const targetId = firstQueryValue(query.target_id ?? query.targetId ?? '');

    if (!REVIEW_TARGET_TYPES.includes(targetType as ReviewTargetType)) {
      throw new BadRequestException({
        code: 'REVIEW_TARGET_TYPE_INVALID',
        message: 'Sharh obyekti turi qo‘llab-quvvatlanmaydi',
      });
    }
    if (!UUID_RE.test(targetId)) {
      throw new BadRequestException({
        code: 'REVIEW_TARGET_REQUIRED',
        message: 'Sharh obyekti ko‘rsatilishi kerak',
      });
    }

    return { targetType: targetType as ReviewTargetType, targetId };
  }

  /**
   * Tasdiqlangan bronni topadi.
   *
   * `bookingId` ANIQ berilgan bo'lsa — egalik/status/obyekt mosligi
   * buzilganda XATO tashlanadi. Berilmagan bo'lsa — mos bron qidiriladi
   * va topilmasa `null` qaytariladi (sharh `pending_review` sifatida
   * yoziladi, rad etilmaydi).
   *
   * R-2 TUZATILDI: ilgari obyekt mosligi FAQAT `targetType === 'hotel'`
   * holatida tekshirilardi — bu bitta qonuniy broni bor mijozga boshqa
   * turdagi IXTIYORIY obyektga "tasdiqlangan" sharh biriktirish imkonini
   * berardi. Endi tekshiruv har bir qo'llab-quvvatlanadigan tur uchun
   * ishlaydi va noma'lum tur deny-by-default rad etiladi.
   *
   * Shuningdek `checked_out` `allowedStatuses`dan olib tashlandi — u
   * `BookingStatus` enum a'zosi EMAS (schema.prisma:96-104 —
   * pending / awaiting_payment / awaiting_partner_confirmation /
   * confirmed / cancelled / completed / expired), ya'ni o'lik qiymat edi.
   */
  private async resolveVerifiedBooking(
    userId: string,
    targetType: ReviewTargetType,
    targetId: string,
    bookingId?: string,
  ): Promise<VerifiedBooking | null> {
    const allowedStatuses = ['confirmed', 'completed'];

    if (bookingId) {
      const [booking] = await this.pg.query<VerifiedBooking>(
        `SELECT b.id::text, b.user_id::text, b.hotel_id::text,
                t.company_id::text AS bus_company_id, b.status::text
         FROM bookings b
         LEFT JOIN trips t ON t.id = b.trip_id
         WHERE b.id = $1`,
        [bookingId],
      );
      if (!booking || booking.user_id !== userId) {
        throw new ForbiddenException({
          code: 'REVIEW_BOOKING_FORBIDDEN',
          message: 'Faqat o‘z broningiz uchun sharh qoldirasiz',
        });
      }
      if (!allowedStatuses.includes(booking.status)) {
        throw new ForbiddenException({
          code: 'REVIEW_BOOKING_NOT_VERIFIED',
          message:
            'Faqat tasdiqlangan yoki yakunlangan bron uchun sharh qoldiriladi',
        });
      }
      if (bookingTargetId(booking, targetType) !== targetId) {
        throw new ForbiddenException({
          code: 'REVIEW_BOOKING_TARGET_MISMATCH',
          message: 'Bron qilingan obyekt bilan sharh obyekti mos emas',
        });
      }
      return booking;
    }

    const [booking] = await this.pg.query<VerifiedBooking>(
      `SELECT b.id::text, b.user_id::text, b.hotel_id::text,
              t.company_id::text AS bus_company_id, b.status::text
       FROM bookings b
       LEFT JOIN trips t ON t.id = b.trip_id
       WHERE b.user_id = $1
         AND b.status::text = ANY($2::text[])
         AND (
           ($3 = 'hotel' AND b.hotel_id = $4::uuid)
           OR ($3 = 'bus_company' AND t.company_id = $4::uuid)
         )
       ORDER BY b.confirmed_at DESC NULLS LAST, b.created_at DESC
       LIMIT 1`,
      [userId, allowedStatuses, targetType, targetId],
    );

    return booking ?? null;
  }

  private reviewCriteria(
    body: Record<string, unknown>,
    fallback: Record<string, unknown> = {},
  ) {
    return {
      cleanliness: optionalRatingValue(body.cleanliness, fallback.cleanliness),
      staff: optionalRatingValue(body.staff, fallback.staff),
      location: optionalRatingValue(body.location, fallback.location),
      valueForMoney: optionalRatingValue(
        body.value_for_money ?? body.valueForMoney,
        fallback.value_for_money ?? fallback.valueForMoney,
      ),
    };
  }
}

interface VerifiedBooking {
  id: string;
  user_id: string | null;
  hotel_id: string | null;
  bus_company_id: string | null;
  status: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bron qaysi obyektga tegishli ekanini tur bo'yicha qaytaradi.
 * Noma'lum tur uchun `null` — `!== targetId` bo'lib deny-by-default
 * ishlaydi (R-2).
 */
function bookingTargetId(
  booking: VerifiedBooking,
  targetType: ReviewTargetType,
): string | null {
  if (targetType === 'hotel') return booking.hotel_id;
  if (targetType === 'bus_company') return booking.bus_company_id;
  return null;
}

function firstQueryValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
}

function roundOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 10) / 10;
}

function ratingValue(value: unknown, fallback = 5): number {
  return boundedRating(value ?? fallback, 'rating');
}

function optionalRatingValue(
  value: unknown,
  fallback?: unknown,
): number | null {
  if (value === undefined && fallback == null) return null;
  if (value === null) return null;
  return boundedRating(value ?? fallback, 'rating');
}

function boundedRating(value: unknown, field: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 5) {
    throw new BadRequestException({
      code: 'REVIEW_RATING_INVALID',
      message: `${field} 1 dan 5 gacha bo‘lishi kerak`,
    });
  }
  return Math.round(numeric * 10) / 10;
}

function averageRating(values: number[]): number {
  if (values.length === 0) return 5;
  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
    ) / 10
  );
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function photoList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.length > 0);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return photoList(parsed);
    } catch {
      return [value.trim()];
    }
  }
  return [];
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
