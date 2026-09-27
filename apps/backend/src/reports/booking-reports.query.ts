import { BadRequestException } from '@nestjs/common';
import type { PostgresService } from '../infrastructure/postgres.service';

/**
 * Hisobot domenlari — `bookings.type` (hotel/bus/restaurant) mavjud enum
 * qiymatlariga asoslangan. Alohida "rent_car" `BookingType` YO'Q: mashina
 * ijarasi `type='bus'` + `vehicle_id IS NOT NULL` (`trip_id IS NULL`)
 * orqali ifodalanadi (qarang: bookings.service.ts::createVehicleRental,
 * `@Post('vehicle')`), reyslar bo'yicha avtobus esa `trip_id IS NOT NULL`
 * bilan. "Dacha" ham alohida `BookingType` emas — faqat
 * `partner_organizations.type = 'dacha'` (bron darajasida `type='hotel'`
 * bilan bir xil, faqat hamkor turi orqali ajratiladi) — shu sabab bu
 * yerda alohida domen sifatida YARATILMAYDI (soxta ma'lumot).
 */
export const REPORT_DOMAINS = [
  'hotel',
  'restaurant',
  'bus',
  'vehicle',
] as const;
export type ReportDomain = (typeof REPORT_DOMAINS)[number];

export interface BookingReportFilters {
  /** `undefined`/`null` = barcha hamkorlar (faqat admin ko'rinishida). */
  organizationId?: string | null;
  from?: string;
  to?: string;
  domain?: string;
  paymentMethod?: string;
  status?: string;
}

export interface DomainReportRow {
  domain: ReportDomain;
  totalBookings: number;
  onlineCount: number;
  onsiteCount: number;
  cancelledCount: number;
  refundedCount: number;
  grossAmount: number;
  paidAmount: number;
  refundedAmount: number;
}

export interface DailyReportRow {
  date: string;
  totalBookings: number;
  grossAmount: number;
  paidAmount: number;
}

export interface PartnerReportRow extends DomainReportRow {
  organizationId: string;
  partnerName: string;
}

export interface BookingReportResult {
  period: { from: string | null; to: string | null };
  currency: 'UZS';
  summary: Omit<DomainReportRow, 'domain'>;
  domains: DomainReportRow[];
  daily: DailyReportRow[];
}

const DOMAIN_CASE_SQL = `
  CASE
    WHEN b.type = 'hotel' THEN 'hotel'
    WHEN b.type = 'restaurant' THEN 'restaurant'
    WHEN b.type = 'bus' AND b.vehicle_id IS NOT NULL THEN 'vehicle'
    WHEN b.type = 'bus' THEN 'bus'
  END`;

/**
 * Barcha filter parametrlarini bitta joyda tekshiradi/normallashtiradi —
 * partner (`GET /partners/reports`) va admin (`GET /admin/partner-reports`)
 * endpointlari BIR XIL ushbu funksiyani chaqiradi, biznes-mantiq ikki
 * marta yozilmaydi.
 */
function buildFilterClause(filters: BookingReportFilters): {
  where: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.organizationId) {
    params.push(filters.organizationId);
    conditions.push(`b.partner_organization_id = $${params.length}::uuid`);
  }

  if (filters.from) {
    const fromDate = new Date(filters.from);
    if (Number.isNaN(fromDate.getTime())) {
      throw new BadRequestException({
        code: 'REPORT_FROM_INVALID',
        message: "`from` sanasi noto'g'ri formatda",
      });
    }
    params.push(fromDate.toISOString());
    conditions.push(`b.created_at >= $${params.length}::timestamptz`);
  }

  if (filters.to) {
    const toDate = new Date(filters.to);
    if (Number.isNaN(toDate.getTime())) {
      throw new BadRequestException({
        code: 'REPORT_TO_INVALID',
        message: "`to` sanasi noto'g'ri formatda",
      });
    }
    params.push(toDate.toISOString());
    conditions.push(`b.created_at <= $${params.length}::timestamptz`);
  }

  if (filters.paymentMethod) {
    params.push(filters.paymentMethod);
    conditions.push(`b.payment_method::text = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`b.status::text = $${params.length}`);
  }

  if (filters.domain) {
    if (!REPORT_DOMAINS.includes(filters.domain as ReportDomain)) {
      throw new BadRequestException({
        code: 'REPORT_DOMAIN_INVALID',
        message: `domain "${filters.domain}" noto'g'ri. Ruxsat etilgan: ${REPORT_DOMAINS.join(', ')}`,
      });
    }
    params.push(filters.domain);
    conditions.push(`(${DOMAIN_CASE_SQL}) = $${params.length}`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function emptyDomainRow(domain: ReportDomain): DomainReportRow {
  return {
    domain,
    totalBookings: 0,
    onlineCount: 0,
    onsiteCount: 0,
    cancelledCount: 0,
    refundedCount: 0,
    grossAmount: 0,
    paidAmount: 0,
    refundedAmount: 0,
  };
}

/**
 * Bron+to'lov ma'lumotlarini domen bo'yicha va kunlik kesimda yig'adi.
 * Bitta CTE orqali (`booking_domain`) — hamkor (`/partners/reports`) va
 * admin (`/admin/partner-reports`) endpointlari o'rtasida N+1 yoki
 * takrorlangan mantiq YO'Q. `payments` bilan JOIN alohida CTE
 * (`payment_totals`) orqali — aks holda bir bronga bog'liq bir nechta
 * to'lov urinishi `bookings.total_amount`ni ko'paytirib yuborardi.
 */
export async function computeBookingReport(
  pg: Pick<PostgresService, 'query'>,
  filters: BookingReportFilters,
): Promise<BookingReportResult> {
  const { where, params } = buildFilterClause(filters);

  const rows = await pg.query<{
    domain: ReportDomain;
    total_bookings: string;
    online_count: string;
    onsite_count: string;
    cancelled_count: string;
    refunded_count: string;
    gross_amount: string;
    paid_amount: string;
    refunded_amount: string;
  }>(
    `WITH booking_domain AS (
       SELECT
         b.id, b.status, b.payment_method, b.total_amount,
         (${DOMAIN_CASE_SQL}) AS domain
       FROM bookings b
       ${where}
     ),
     payment_totals AS (
       SELECT booking_id,
         SUM(amount) FILTER (WHERE status = 'paid') AS paid_amount,
         SUM(amount) FILTER (WHERE status = 'refunded') AS refunded_amount
       FROM payments
       GROUP BY booking_id
     )
     SELECT
       bd.domain,
       COUNT(*) AS total_bookings,
       COUNT(*) FILTER (WHERE bd.payment_method::text <> 'cash') AS online_count,
       COUNT(*) FILTER (WHERE bd.payment_method::text = 'cash') AS onsite_count,
       COUNT(*) FILTER (WHERE bd.status::text = 'cancelled') AS cancelled_count,
       COUNT(*) FILTER (WHERE COALESCE(pt.refunded_amount, 0) > 0) AS refunded_count,
       COALESCE(SUM(bd.total_amount), 0)::float8 AS gross_amount,
       COALESCE(SUM(pt.paid_amount), 0)::float8 AS paid_amount,
       COALESCE(SUM(pt.refunded_amount), 0)::float8 AS refunded_amount
     FROM booking_domain bd
     LEFT JOIN payment_totals pt ON pt.booking_id = bd.id
     WHERE bd.domain IS NOT NULL
     GROUP BY bd.domain`,
    params,
  );

  const dailyRows = await pg.query<{
    date: string;
    total_bookings: string;
    gross_amount: string;
    paid_amount: string;
  }>(
    `WITH booking_domain AS (
       SELECT b.id, b.total_amount, b.created_at
       FROM bookings b
       ${where}
     ),
     payment_totals AS (
       SELECT booking_id, SUM(amount) FILTER (WHERE status = 'paid') AS paid_amount
       FROM payments GROUP BY booking_id
     )
     SELECT
       to_char(bd.created_at, 'YYYY-MM-DD') AS date,
       COUNT(*) AS total_bookings,
       COALESCE(SUM(bd.total_amount), 0)::float8 AS gross_amount,
       COALESCE(SUM(pt.paid_amount), 0)::float8 AS paid_amount
     FROM booking_domain bd
     LEFT JOIN payment_totals pt ON pt.booking_id = bd.id
     GROUP BY 1
     ORDER BY 1`,
    params,
  );

  const domainsByKey = new Map<ReportDomain, DomainReportRow>();
  for (const domain of REPORT_DOMAINS) {
    domainsByKey.set(domain, emptyDomainRow(domain));
  }
  for (const row of rows) {
    if (!row.domain) continue;
    domainsByKey.set(row.domain, {
      domain: row.domain,
      totalBookings: toNumber(row.total_bookings),
      onlineCount: toNumber(row.online_count),
      onsiteCount: toNumber(row.onsite_count),
      cancelledCount: toNumber(row.cancelled_count),
      refundedCount: toNumber(row.refunded_count),
      grossAmount: toNumber(row.gross_amount),
      paidAmount: toNumber(row.paid_amount),
      refundedAmount: toNumber(row.refunded_amount),
    });
  }

  const domains = REPORT_DOMAINS.map((d) => domainsByKey.get(d)!);
  const summary = domains.reduce<Omit<DomainReportRow, 'domain'>>(
    (acc, d) => ({
      totalBookings: acc.totalBookings + d.totalBookings,
      onlineCount: acc.onlineCount + d.onlineCount,
      onsiteCount: acc.onsiteCount + d.onsiteCount,
      cancelledCount: acc.cancelledCount + d.cancelledCount,
      refundedCount: acc.refundedCount + d.refundedCount,
      grossAmount: acc.grossAmount + d.grossAmount,
      paidAmount: acc.paidAmount + d.paidAmount,
      refundedAmount: acc.refundedAmount + d.refundedAmount,
    }),
    {
      totalBookings: 0,
      onlineCount: 0,
      onsiteCount: 0,
      cancelledCount: 0,
      refundedCount: 0,
      grossAmount: 0,
      paidAmount: 0,
      refundedAmount: 0,
    },
  );

  return {
    period: { from: filters.from ?? null, to: filters.to ?? null },
    currency: 'UZS',
    summary,
    domains,
    daily: dailyRows.map((r) => ({
      date: r.date,
      totalBookings: toNumber(r.total_bookings),
      grossAmount: toNumber(r.gross_amount),
      paidAmount: toNumber(r.paid_amount),
    })),
  };
}

/**
 * Faqat admin uchun — "barcha hamkorlar" ko'rinishida har bir hamkor
 * bo'yicha yig'ma qator (partner nomi bilan). `filters.organizationId`
 * berilgan bo'lsa, natija bitta qatorga tushadi (bitta hamkor tanlangan
 * holat) — alohida "bitta hamkor" filiali YARATILMAYDI, bir xil so'rov
 * ishlatiladi.
 */
export async function computeBookingReportByPartner(
  pg: Pick<PostgresService, 'query'>,
  filters: BookingReportFilters,
): Promise<PartnerReportRow[]> {
  const { where, params } = buildFilterClause(filters);

  const rows = await pg.query<{
    organization_id: string;
    partner_name: string;
    domain: ReportDomain;
    total_bookings: string;
    online_count: string;
    onsite_count: string;
    cancelled_count: string;
    refunded_count: string;
    gross_amount: string;
    paid_amount: string;
    refunded_amount: string;
  }>(
    `WITH booking_domain AS (
       SELECT
         b.id, b.partner_organization_id, b.status, b.payment_method, b.total_amount,
         (${DOMAIN_CASE_SQL}) AS domain
       FROM bookings b
       ${where}
     ),
     payment_totals AS (
       SELECT booking_id,
         SUM(amount) FILTER (WHERE status = 'paid') AS paid_amount,
         SUM(amount) FILTER (WHERE status = 'refunded') AS refunded_amount
       FROM payments
       GROUP BY booking_id
     )
     SELECT
       bd.partner_organization_id AS organization_id,
       COALESCE(po.brand_name, po.legal_name, 'Noma''lum') AS partner_name,
       bd.domain,
       COUNT(*) AS total_bookings,
       COUNT(*) FILTER (WHERE bd.payment_method::text <> 'cash') AS online_count,
       COUNT(*) FILTER (WHERE bd.payment_method::text = 'cash') AS onsite_count,
       COUNT(*) FILTER (WHERE bd.status::text = 'cancelled') AS cancelled_count,
       COUNT(*) FILTER (WHERE COALESCE(pt.refunded_amount, 0) > 0) AS refunded_count,
       COALESCE(SUM(bd.total_amount), 0)::float8 AS gross_amount,
       COALESCE(SUM(pt.paid_amount), 0)::float8 AS paid_amount,
       COALESCE(SUM(pt.refunded_amount), 0)::float8 AS refunded_amount
     FROM booking_domain bd
     LEFT JOIN payment_totals pt ON pt.booking_id = bd.id
     LEFT JOIN partner_organizations po ON po.id = bd.partner_organization_id
     WHERE bd.domain IS NOT NULL
     GROUP BY bd.partner_organization_id, po.brand_name, po.legal_name, bd.domain
     ORDER BY partner_name, bd.domain`,
    params,
  );

  return rows.map((r) => ({
    organizationId: r.organization_id,
    partnerName: r.partner_name,
    domain: r.domain,
    totalBookings: toNumber(r.total_bookings),
    onlineCount: toNumber(r.online_count),
    onsiteCount: toNumber(r.onsite_count),
    cancelledCount: toNumber(r.cancelled_count),
    refundedCount: toNumber(r.refunded_count),
    grossAmount: toNumber(r.gross_amount),
    paidAmount: toNumber(r.paid_amount),
    refundedAmount: toNumber(r.refunded_amount),
  }));
}
