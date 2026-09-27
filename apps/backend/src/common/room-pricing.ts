import type {
  PostgresService,
  PostgresTransaction,
} from '../infrastructure/postgres.service';

export interface ActiveRoomPromotion {
  id?: string;
  entity_id: string;
  old_price_sum: number;
  new_price_sum: number;
  discount_percent: number;
  start_date?: string;
  end_date: string;
}

export interface RoomPrice {
  basePrice: number;
  effectivePrice: number;
  discountAmount: number;
}

type QueryExecutor = Pick<PostgresService, 'query'> | PostgresTransaction;

/**
 * Barcha room-promotion o'qish yo'llari ishlatadigan yagona eligibility
 * predikati. Aliaslar faqat backend source'dagi statik SQL identifikatorlari;
 * user input bu funksiyaga hech qachon uzatilmaydi.
 */
export function activeRoomPromotionPredicate(
  alias: string,
  roomIdExpression?: string,
): string {
  return `${alias}.entity_type = 'room'
    ${roomIdExpression ? `AND ${alias}.entity_id = ${roomIdExpression}` : ''}
    AND ${alias}.status = 'published'::"PromotionStatus"
    AND ${alias}.start_date <= CURRENT_DATE
    AND ${alias}.end_date >= CURRENT_DATE`;
}

/**
 * Hamkor promotion'i foizli modelga ega. UZS qiymatlari loyiha bo'ylab
 * ishlatiladigan `Math.round` qoidasi bilan butun so'mga yaxlitlanadi.
 * Saqlangan `hotel_rooms.base_price` hech qachon o'zgartirilmaydi.
 */
export function calculateRoomPrice(
  basePriceInput: string | number,
  promotion?: ActiveRoomPromotion | null,
): RoomPrice {
  const basePrice = Number(basePriceInput);
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return { basePrice: 0, effectivePrice: 0, discountAmount: 0 };
  }

  if (!promotion) {
    return { basePrice, effectivePrice: basePrice, discountAmount: 0 };
  }

  const percent = Number(promotion.discount_percent);
  if (!Number.isFinite(percent) || percent <= 0) {
    return { basePrice, effectivePrice: basePrice, discountAmount: 0 };
  }

  const discountAmount = Math.max(
    0,
    Math.min(basePrice, Math.round(basePrice * (Math.min(percent, 100) / 100))),
  );
  return {
    basePrice,
    effectivePrice: basePrice - discountAmount,
    discountAmount,
  };
}

/**
 * Detail/rooms endpointlari uchun active promotion'larni bitta batched
 * query'da yuklaydi. Bir xona uchun tarixda bir nechta published promotion
 * qolgan bo'lsa, eng oxirgi yangilangani deterministik tarzda tanlanadi.
 */
export async function loadActiveRoomPromotions(
  db: QueryExecutor,
  roomIds: string[],
): Promise<Map<string, ActiveRoomPromotion>> {
  const result = new Map<string, ActiveRoomPromotion>();
  if (roomIds.length === 0) return result;

  const rows = await db.query<ActiveRoomPromotion>(
    `SELECT DISTINCT ON (p.entity_id)
            p.id::text, p.entity_id::text,
            p.old_price_sum::float8, p.new_price_sum::float8,
            p.discount_percent, p.start_date::text, p.end_date::text
     FROM promotions p
     WHERE p.entity_id = ANY($1::uuid[])
       AND ${activeRoomPromotionPredicate('p')}
     ORDER BY p.entity_id, p.updated_at DESC, p.created_at DESC`,
    [roomIds],
  );

  for (const row of rows) {
    result.set(row.entity_id, {
      ...row,
      old_price_sum: Number(row.old_price_sum),
      new_price_sum: Number(row.new_price_sum),
      discount_percent: Number(row.discount_percent),
    });
  }
  return result;
}

export function isSchool21Code(code: string | null | undefined): boolean {
  return (
    String(code ?? '')
      .trim()
      .toUpperCase() === 'SCHOOL21'
  );
}
