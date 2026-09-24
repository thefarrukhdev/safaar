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
