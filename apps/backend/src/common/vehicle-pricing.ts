import type {
  PostgresService,
  PostgresTransaction,
} from '../infrastructure/postgres.service';
import { livePromotionPredicate } from './promotion';

/**
 * `vehicles.price_per_day` uchun hamkor promotion'i — `room-pricing.ts`dagi
 * `ActiveRoomPromotion` bilan bir xil qator shakli (`promotions` jadvali
 * `entity_type` bo'yicha umumiy, faqat filtr farqlanadi), lekin ataylab
 * ALOHIDA tur sifatida saqlanadi — mashina narxlash xonalarniki bilan
 * tasodifan aralashib ketmasligi uchun (turlar semantik jihatdan bir xil
 * ko'rinsa ham, chaqiruvchi joyларда xato bilan almashtirib qo'yilmasin).
 */
export interface ActiveVehiclePromotion {
  id?: string;
  entity_id: string;
  old_price_sum: number;
  new_price_sum: number;
  discount_percent: number;
  start_date?: string;
  end_date: string;
}

export interface VehiclePrice {
  basePricePerDay: number;
  effectivePricePerDay: number;
  discountAmountPerDay: number;
}

type QueryExecutor = Pick<PostgresService, 'query'> | PostgresTransaction;

/**
 * `activeRoomPromotionPredicate` (`room-pricing.ts`)ning mashina (`vehicle`)
 * uchun egizagi — xuddi shu umumiy `livePromotionPredicate()`dan
 * foydalanadi (status='published' + bugungi sana [start_date,end_date]
 * oralig'ida), faqat `entity_type = 'vehicle'` bilan toraytiriladi. Aliaslar
 * faqat backend source'dagi statik SQL identifikatorlari; user input bu
 * funksiyaga hech qachon uzatilmaydi.
 */
export function activeVehiclePromotionPredicate(
  alias: string,
  vehicleIdExpression?: string,
): string {
  return `${alias}.entity_type = 'vehicle'
    ${vehicleIdExpression ? `AND ${alias}.entity_id = ${vehicleIdExpression}` : ''}
    AND ${livePromotionPredicate(alias)}`;
}

/**
 * Mashina ijarasi KUNLIK narxini (`vehicles.price_per_day`) hamkor
 * promotion'i asosida hisoblaydi — `room-pricing.ts`dagi
 * `calculateRoomPrice()` bilan AYNAN bir xil formula shakli
 * (`min(base, round(new_price_sum))`), lekin ataylab alohida funksiya
 * sifatida saqlanadi (`RoomPrice`/xona ustunlari bilan aralashtirmaslik
 * uchun) — quyidagi dalil asosida:
 *
 * NEGA "KUNLIK" (per-day), "Jami ijara narxi" (rental-total) EMAS:
 *   - `promotions` jadvalida (barcha migratsiyalar bo'ylab) muddat/kun
 *     ustuni UMUMAN yo'q — ya'ni bitta promotion qatori "N kunlik ijara
 *     uchun jami narx"ni tuzilmaviy jihatdan ifodalay OLMAYDI (har xil
 *     davomiylikdagi bronlar bir xil promotion qatoridan qayta
 *     foydalanadi).
 *   - Hozirgi (ishlab turgan) hamkor UI formasi
 *     (`web-partner/.../room-promotion-dialog.tsx`, `isBus` bo'lsa xuddi
 *     shu forma mashina promotion'ini ham yaratadi) `oldPriceSum`ni
 *     TO'G'RIDAN-TO'G'RI `vehicle.pricePerDay`dan to'ldiradi
 *     (`price: v.pricePerDay || 0`) — xonalar uchun `room.nightlyPrice`dan
 *     to'ldirilgani bilan AYNAN bir xil naqsh — va formada umuman
 *     davomiylik (kunlar soni) maydoni yo'q. Demak hamkor "Yangi narx"
 *     maydoniga kiritgan summa — yangi KUNLIK stavka, jami ijara summasi
 *     emas.
 *   - `bookings.service.ts:createVehicleRentalInternal()`ning o'zi
 *     allaqachon `price_per_day * days` formulasidan foydalanadi —
 *     promotion faqat shu kunlik stavkani almashtiradi, ko'paytirish
 *     (duration) alohida bosqich bo'lib qoladi.
 *
 * `Math.min(basePricePerDay, ...)` — `room-pricing.ts`dagi bilan bir xil
 * sabab: promotion tasdiqlangandan keyin `vehicles.price_per_day` PASTGA
 * tushgan bo'lsa, mijozdan joriy kunlik narxdan ko'p pul olinmasligi
 * kafolati.
 */
export function calculateVehiclePrice(
  pricePerDayInput: string | number,
  promotion?: ActiveVehiclePromotion | null,
): VehiclePrice {
  const basePricePerDay = Number(pricePerDayInput);
  if (!Number.isFinite(basePricePerDay) || basePricePerDay < 0) {
    return {
      basePricePerDay: 0,
      effectivePricePerDay: 0,
      discountAmountPerDay: 0,
    };
  }

  if (!promotion) {
    return {
      basePricePerDay,
      effectivePricePerDay: basePricePerDay,
      discountAmountPerDay: 0,
    };
  }

  const discountAmountPerDay = vehiclePromotionDiscountAmount(
    basePricePerDay,
    promotion,
  );
  return {
    basePricePerDay,
    effectivePricePerDay: basePricePerDay - discountAmountPerDay,
    discountAmountPerDay,
  };
}

function vehiclePromotionDiscountAmount(
  basePricePerDay: number,
  promotion: ActiveVehiclePromotion,
): number {
  const targetPrice = Number(promotion.new_price_sum);
  if (Number.isFinite(targetPrice) && targetPrice >= 0) {
    return basePricePerDay - Math.min(basePricePerDay, Math.round(targetPrice));
  }

  // Zaxira (fallback) yo'l — `promotions.new_price_sum` ustuni NOT NULL,
  // ya'ni haqiqiy qatorda bu holat yuz bermaydi; faqat buzuq/yetishmayotgan
  // qiymat kelib qolsa eski foizli hisob ishlatiladi (room-pricing.ts bilan
  // bir xil zaxira mantiq).
  const percent = Number(promotion.discount_percent);
  if (!Number.isFinite(percent) || percent <= 0) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(
      basePricePerDay,
      Math.round(basePricePerDay * (Math.min(percent, 100) / 100)),
    ),
  );
}

/**
 * `/cms/offers` kabi ko'p-mashinali o'qish yo'llari uchun active vehicle
 * promotion'larni bitta batched query'da yuklaydi — `room-pricing.ts`dagi
 * `loadActiveRoomPromotions()` bilan bir xil naqsh (bir mashina uchun
 * tarixda bir nechta published promotion qolgan bo'lsa, eng oxirgi
 * yangilangani deterministik tarzda tanlanadi).
 */
export async function loadActiveVehiclePromotions(
  db: QueryExecutor,
  vehicleIds: string[],
): Promise<Map<string, ActiveVehiclePromotion>> {
  const result = new Map<string, ActiveVehiclePromotion>();
  if (vehicleIds.length === 0) return result;

  const rows = await db.query<ActiveVehiclePromotion>(
    `SELECT DISTINCT ON (p.entity_id)
            p.id::text, p.entity_id::text,
            p.old_price_sum::float8, p.new_price_sum::float8,
            p.discount_percent, p.start_date::text, p.end_date::text
     FROM promotions p
     WHERE p.entity_id = ANY($1::uuid[])
       AND ${activeVehiclePromotionPredicate('p')}
     ORDER BY p.entity_id, p.updated_at DESC, p.created_at DESC`,
    [vehicleIds],
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
