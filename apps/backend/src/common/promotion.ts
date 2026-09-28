/**
 * `promotions` jadvalidan `SELECT`/`RETURNING` orqali qaytadigan qatorning
 * aniq turi va `Promotion`/`PartnerPromotion` (web-partner/web-admin'ning
 * mavjud, o'zgartirilmagan frontend kontraktlari) shakliga aylantiruvchi
 * umumiy funksiya — `partners.service.ts` (yaratish) va `admin.service.ts`
 * (ro'yxat/tasdiqlash/rad etish) ikkalasi ham AYNAN bir xil qator
 * shaklidan foydalanadi, shu sabab bu yerda bitta joyda saqlanadi.
 */
export interface PromotionRow {
  id: string;
  partner_organization_id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  old_price_sum: number;
  new_price_sum: number;
  discount_percent: number;
  start_date: string;
  end_date: string;
  status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * "Bu promotion AYNAN HOZIR kuchda (public narxga ta'sir qilmoqda)mi?" —
 * `status = 'published'` VA bugungi sana `[start_date, end_date]` oralig'ida.
 *
 * Bu shart loyihada bir nechta o'qish yo'lida ishlatiladi
 * (`room-pricing.ts:activeRoomPromotionPredicate()` -> hotel detail/rooms va
 * booking narxlash; `cms.service.ts:offers()` -> ommaviy `/cms/offers`), shu
 * sabab bitta joyda saqlanadi: agar bu shart bir joyda o'zgarib, boshqasida
 * o'zgarmasa, "ommaviy ko'rinadigan chegirma" va "narxga ta'sir qiladigan
 * chegirma" tushunchalari bir-biridan ajralib ketadi.
 *
 * `entity_type` bo'yicha TORAYTIRILMAGAN — `room` ham, `vehicle` ham
 * `/cms/offers`da ko'rinadi, ya'ni "hozir kuchda" tushunchasi ikkala tur
 * uchun ham amal qiladi.
 *
 * `alias` — faqat backend source'dagi statik SQL identifikatori; user input
 * bu funksiyaga hech qachon uzatilmaydi.
 */
export function livePromotionPredicate(alias?: string): string {
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}status = 'published'::"PromotionStatus"
    AND ${prefix}start_date <= CURRENT_DATE
    AND ${prefix}end_date >= CURRENT_DATE`;
}

export const PROMOTION_RETURNING_SQL = `id::text, partner_organization_id::text, entity_type,
              entity_id::text, entity_name,
              old_price_sum::float8, new_price_sum::float8, discount_percent,
              start_date::text, end_date::text, status::text,
              reviewed_at, reviewed_by::text, created_at, updated_at`;

/**
 * `web-partner/app/_lib/api/endpoints/promotions.ts`dagi `Promotion`
 * interfeysi bilan AYNAN mos (mavjud mock shu shaklni qaytargan edi) —
 * frontend o'zgartirilmagani uchun bu shakl MAJBURIY shu ko'rinishda
 * qoladi.
 */
export function toPromotionApiShape(row: PromotionRow) {
  return {
    id: row.id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    entityName: row.entity_name,
    oldPriceSum: Number(row.old_price_sum),
    newPriceSum: Number(row.new_price_sum),
    discountPercent: Number(row.discount_percent),
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
  };
}
