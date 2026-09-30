import { Injectable } from '@nestjs/common';
import {
  PostgresService,
  type PostgresTransaction,
} from '../infrastructure/postgres.service';
import type { ValidatePromoDto } from './dto/promo.dto';
import {
  isSchool21Code,
  loadActiveRoomPromotions,
} from '../common/room-pricing';

interface PromoRow {
  id: string;
  code: string;
  discount_type: string | null;
  discount_value: number;
  usage_limit: number;
  used_count: number;
  valid_until: string;
}

type QueryExecutor = Pick<PostgresService, 'query'> | PostgresTransaction;

/**
 * Promo-kod chegirmasini haqiqiy bron summasiga qo'llash uchun —
 * `discount_type` 'percentage' bo'lsa foizdan, aks holda (fixed) to'g'ridan-
 * to'g'ri summadan hisoblanadi. Natija hech qachon subtotal'dan oshmaydi
 * (manfiy umumiy summa hosil bo'lmasligi uchun).
 */
export function calculatePromoDiscount(
  subtotal: number,
  discountType: string | null,
  discountValue: number,
): number {
  if (!discountType || !Number.isFinite(discountValue) || discountValue <= 0) {
    return 0;
  }
  const raw =
    discountType === 'percentage' || discountType === 'percent'
      ? subtotal * (discountValue / 100)
      : discountValue;
  return Math.max(0, Math.min(subtotal, Math.round(raw)));
}

@Injectable()
export class PromosService {
  constructor(private readonly pg: PostgresService) {}

  private async rows(sql: string, params: readonly unknown[] = []) {
    return this.pg.query<PromoRow>(sql, params);
  }

  private promoSelect(extraWhere: string): string {
    return `
      select
        id::text,
        coalesce(title ->> 'uz', upper(slug), 'PROMO') as code,
        metadata ->> 'discountType' as discount_type,
        coalesce((metadata ->> 'discountValue')::float8, 0) as discount_value,
        coalesce((metadata ->> 'usageLimit')::int, 0) as usage_limit,
        coalesce((metadata ->> 'usedCount')::int, 0) as used_count,
        coalesce(published_at, created_at + interval '30 days') as valid_until
      from cms_entries
      where type = 'promo' and status = 'published' ${extraWhere}
    `;
  }

  /** `POST /promos/validate` — checkout'da promo-kodni tekshiradi. */
  async validate(body: ValidatePromoDto) {
    const code = String(body.code ?? '')
      .trim()
      .toUpperCase();
    if (!code) {
      return { code, valid: false, discount_type: null, discount_value: 0 };
    }

    const [promo] = await this.rows(
      `${this.promoSelect('and slug = $1')} limit 1`,
      [code.toLowerCase().replace(/\s+/g, '-')],
    );

    const valid = Boolean(
      promo &&
      new Date(promo.valid_until).getTime() > Date.now() &&
      promo.used_count < promo.usage_limit,
    );

    const roomId = body.room_id ?? body.roomId;
    if (valid && roomId && isSchool21Code(code)) {
      const activePromotions = await loadActiveRoomPromotions(this.pg, [
        roomId,
      ]);
      if (activePromotions.has(roomId)) {
        return {
          code,
          valid: false,
          discount_type: null,
          discount_value: 0,
          reason: 'PROMO_STACKING_NOT_ALLOWED',
        };
      }
    }

    return {
      code,
      valid,
      discount_type: valid ? promo.discount_type : null,
      discount_value: valid ? Number(promo.discount_value) : 0,
    };
  }

  /**
   * Promo-kodni "sarflaydi" — used_count'ni atomik (bir SQL so'rovda,
   * limitni tekshirib) oshiradi. Bron/checkout oqimi promo-kodni haqiqatan
   * qo'llagan paytda shu metod chaqirilishi kerak (validate() faqat
   * o'qish uchun — u hech narsani oshirmaydi, aks holda promo shunchaki
   * tekshirilganda ham "ishlatilgan" bo'lib qolar edi).
   *
   * Limit tugagan yoki promo topilmasa `false` qaytaradi — chaqiruvchi
   * shu holatda bron yaratishni davom ettirmasligi kerak.
   */
  async redeem(code: string, db: QueryExecutor = this.pg): Promise<boolean> {
    const slug = String(code ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (!slug) {
      return false;
    }

    const rows = await db.query<PromoRow>(
      `update cms_entries
       set metadata = jsonb_set(
         metadata,
         '{usedCount}',
         to_jsonb(coalesce((metadata ->> 'usedCount')::int, 0) + 1)
       )
       where type = 'promo' and status = 'published' and slug = $1
         and coalesce(published_at, created_at + interval '30 days') > now()
         and coalesce((metadata ->> 'usedCount')::int, 0)
             < coalesce((metadata ->> 'usageLimit')::int, 0)
       returning id::text`,
      [slug],
    );

    return rows.length > 0;
  }

  /** `GET /promos` — hozir amal qiladigan promo-kodlar ro'yxati (ommaviy). */
  async active() {
    const rows = await this.rows(
      `${this.promoSelect(
        "and coalesce(published_at, created_at + interval '30 days') > now()",
      )} order by created_at desc limit 20`,
    );

    return rows
      .filter((row) => row.used_count < row.usage_limit)
      .map((row) => ({
        code: row.code,
        discount_type: row.discount_type,
        discount_value: Number(row.discount_value),
        valid_until: row.valid_until,
      }));
  }
}
