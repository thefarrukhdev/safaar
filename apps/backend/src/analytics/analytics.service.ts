import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestActor } from '../common/actor';
import { PostgresService } from '../infrastructure/postgres.service';

const funnelEvents = [
  'search_performed',
  'hotel_viewed',
  'booking_started',
  'booking_completed',
] as const;

interface AnalyticsContext {
  userAgent?: string;
  ip?: string;
  sessionId?: string;
}

interface FunnelRow {
  event_name: string;
  events_count: string | number;
  sessions_count: string | number;
}

export interface RecordEventInput {
  eventName: string;
  userId?: string | null;
  sessionId?: string | null;
  params?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  occurredAt?: Date;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly pg: PostgresService) {}

  /**
   * Public/Client Event Ingestion API:
   * Mijoz yoki frontend orqali kelgan analitika voqealarini qabul qilish.
   */
  async ingest(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
    context: AnalyticsContext,
  ) {
    const rawEventName = String(body.eventName ?? body.event_name ?? '').trim();
    if (!rawEventName || rawEventName.length > 120) {
      throw new BadRequestException({
        code: 'ANALYTICS_EVENT_NAME_INVALID',
        message: 'eventName majburiy va 120 belgidan oshmasligi kerak',
      });
    }

    const eventName = normalizeEventName(rawEventName);
    const id = randomUUID();
    const occurredAt = parseTimestamp(body.timestamp) ?? new Date();
    const receivedAt = new Date().toISOString();
    const params = objectValue(body.params);
    const sessionId =
      stringValue(body.sessionId ?? body.session_id) ??
      actor?.sessionId ??
      context.sessionId;

    await this.pg.query(
      `INSERT INTO analytics_events
         (id, user_id, session_id, event_name, params, occurred_at,
          received_at, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)`,
      [
        id,
        actor?.actorType === 'user' ? actor.id : null,
        sessionId ?? null,
        eventName,
        JSON.stringify(params),
        occurredAt.toISOString(),
        receivedAt,
        context.userAgent ?? null,
        firstIp(context.ip),
      ],
    );

    return {
      id,
      accepted: true,
      eventName,
      userId: actor?.actorType === 'user' ? actor.id : null,
      sessionId: sessionId ?? null,
      timestamp: occurredAt.toISOString(),
    };
  }

  /**
   * Server-side Event Logger:
   * Backend servislari tomonidan biznes voqealarini to'g'ridan-to'g'ri xavfsiz yozish.
   */
  async recordEvent(input: RecordEventInput): Promise<void> {
    try {
      const eventName = normalizeEventName(input.eventName);
      const id = randomUUID();
      const occurredAt = input.occurredAt ?? new Date();
      const receivedAt = new Date().toISOString();

      await this.pg.query(
        `INSERT INTO analytics_events
           (id, user_id, session_id, event_name, params, occurred_at,
            received_at, user_agent, ip)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)`,
        [
          id,
          input.userId ?? null,
          input.sessionId ?? null,
          eventName,
          JSON.stringify(input.params ?? {}),
          occurredAt.toISOString(),
          receivedAt,
          input.userAgent ?? null,
          firstIp(input.ip ?? undefined),
        ],
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to record analytics event [${input.eventName}]: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Admin API: Umumiy ko'rsatkichlar (Overview)
   * - Bugungi / haftalik faol foydalanuvchilar (DAU / WAU)
   * - Bugungi yaratilgan va to'langan bronlar
   * - Kunlik jami aylanma (Gross Revenue) va platforma sof komissiyasi
   */
  async overview(query: Record<string, string | undefined> = {}) {
    const now = new Date();
    const todayStart =
      query.todayStart ??
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const weekStart =
      query.weekStart ??
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [activeUsersRow, bookingsStatsRow] = await Promise.all([
      this.pg
        .query<{
          active_today: string | number;
          active_week: string | number;
        }>(
          `SELECT
             COUNT(DISTINCT CASE WHEN occurred_at >= $1 THEN COALESCE(user_id::text, session_id, ip) END)::int AS active_today,
             COUNT(DISTINCT CASE WHEN occurred_at >= $2 THEN COALESCE(user_id::text, session_id, ip) END)::int AS active_week
           FROM analytics_events
           WHERE occurred_at >= $2`,
          [todayStart, weekStart],
        )
        .catch(() => [{ active_today: 0, active_week: 0 }]),
      this.pg
        .query<{
          today_total: string | number;
          today_paid: string | number;
          today_gross: string | number;
          today_net_commission: string | number;
        }>(
          `SELECT
             COUNT(*)::int AS today_total,
             COUNT(CASE WHEN status IN ('confirmed', 'completed') THEN 1 END)::int AS today_paid,
             COALESCE(SUM(CASE WHEN status IN ('confirmed', 'completed') THEN total_amount ELSE 0 END), 0)::float8 AS today_gross,
             COALESCE(SUM(CASE WHEN status IN ('confirmed', 'completed') THEN commission_amount ELSE 0 END), 0)::float8 AS today_net_commission
           FROM bookings
           WHERE created_at >= $1`,
          [todayStart],
        )
        .catch(() => [
          {
            today_total: 0,
            today_paid: 0,
            today_gross: 0,
            today_net_commission: 0,
          },
        ]),
    ]);

    const activeToday = Number(activeUsersRow[0]?.active_today ?? 0);
    const activeWeek = Number(activeUsersRow[0]?.active_week ?? 0);
    const b = bookingsStatsRow[0];

    return {
      window: {
        todayStart,
        weekStart,
        now: now.toISOString(),
      },
      activeUsers: {
        today: activeToday,
        thisWeek: activeWeek,
      },
      bookings: {
        todayTotal: Number(b?.today_total ?? 0),
        todayPaid: Number(b?.today_paid ?? 0),
      },
      revenue: {
        todayGross: Number(b?.today_gross ?? 0),
        todayNetCommission: Number(b?.today_net_commission ?? 0),
        currency: 'UZS',
      },
    };
  }

  /**
   * Admin API: Konversiya voronkasi (Funnel Report)
   * Qidiruv -> Ko'rish -> Bron boshlash -> To'lov muvaffaqiyati
   */
  async funnelReport(query: Record<string, string | undefined> = {}) {
    const days = boundedDays(Number(query.days ?? 30));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const rows = await this.funnelRows(since);
    return {
      window: {
        days,
        since,
        until: new Date().toISOString(),
      },
      steps: this.funnel(rows),
    };
  }

  /**
   * Admin API: Eng ommabop yo'nalishlar va mehmonxonalar (Top Destinations & Hotels)
   */
  async topDestinations(query: Record<string, string | undefined> = {}) {
    const days = boundedDays(Number(query.days ?? 30));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const [searches, hotels, cities] = await Promise.all([
      this.popularDestinations(since),
      this.topBookedHotels(since),
      this.topBookedCities(since),
    ]);

    return {
      window: {
        days,
        since,
        until: new Date().toISOString(),
      },
      topSearches: searches,
      topHotels: hotels,
      topCities: cities,
    };
  }

  /**
   * Admin API: Birlashtirilgan umumiy dashboard (Backward compatibility)
   */
  async dashboard(query: Record<string, string | undefined>) {
    const days = boundedDays(Number(query.days ?? 30));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const [funnelRows, destinations, paymentMethods] = await Promise.all([
      this.funnelRows(since),
      this.popularDestinations(since),
      this.paymentMethodShares(since),
    ]);

    return {
      window: {
        days,
        since,
        until: new Date().toISOString(),
      },
      conversionFunnel: this.funnel(funnelRows),
      popularDestinations: destinations,
      paymentMethodShares: paymentMethods,
    };
  }

  private async funnelRows(since: string) {
    return this.pg.query<FunnelRow>(
      `SELECT
          CASE
            WHEN event_name IN ('search_performed', 'search.performed') THEN 'search_performed'
            WHEN event_name IN ('hotel_viewed', 'hotel.viewed', 'item.viewed') THEN 'hotel_viewed'
            WHEN event_name IN ('booking_started', 'booking.created', 'booking_created') THEN 'booking_started'
            WHEN event_name IN ('booking_completed', 'payment.success', 'payment_success') THEN 'booking_completed'
            ELSE event_name
          END AS event_name,
          COUNT(*)::int AS events_count,
          COUNT(DISTINCT COALESCE(session_id, user_id::text, id::text))::int AS sessions_count
       FROM analytics_events
       WHERE (
         event_name IN (
           'search_performed', 'search.performed',
           'hotel_viewed', 'hotel.viewed', 'item.viewed',
           'booking_started', 'booking.created', 'booking_created',
           'booking_completed', 'payment.success', 'payment_success'
         )
       ) AND occurred_at >= $1
       GROUP BY 1`,
      [since],
    );
  }

  private async popularDestinations(since: string) {
    return this.pg.query(
      `SELECT destination, COUNT(*)::int AS searches
       FROM (
         SELECT COALESCE(
           params ->> 'destination',
           params ->> 'city',
           params ->> 'cityName',
           params ->> 'location'
         ) AS destination
         FROM analytics_events
         WHERE event_name IN ('search_performed', 'search.performed')
           AND occurred_at >= $1
       ) source
       WHERE destination IS NOT NULL AND destination <> ''
       GROUP BY destination
       ORDER BY searches DESC, destination ASC
       LIMIT 10`,
      [since],
    );
  }

  private async topBookedHotels(since: string) {
    try {
      return await this.pg.query<{
        hotel_id: string;
        name: string;
        slug: string;
        address: string;
        bookings_count: number;
        total_revenue: number;
      }>(
        `SELECT
           h.id::text AS hotel_id,
           COALESCE(po.brand_name, po.legal_name, h.slug) AS name,
           h.slug,
           COALESCE(h.address, '') AS address,
           COUNT(b.id)::int AS bookings_count,
           COALESCE(SUM(b.total_amount), 0)::float8 AS total_revenue
         FROM bookings b
         JOIN hotels h ON h.id = b.hotel_id
         LEFT JOIN partner_organizations po ON po.id = h.partner_organization_id
         WHERE b.created_at >= $1
           AND b.status IN ('confirmed', 'completed')
         GROUP BY h.id, po.brand_name, po.legal_name, h.slug, h.address
         ORDER BY bookings_count DESC, total_revenue DESC
         LIMIT 10`,
        [since],
      );
    } catch {
      return [];
    }
  }

  private async topBookedCities(since: string) {
    try {
      return await this.pg.query<{
        city_id: string;
        name: string;
        slug: string;
        bookings_count: number;
        total_revenue: number;
      }>(
        `SELECT
           c.id::text AS city_id,
           COALESCE(c.name ->> 'uz', c.name ->> 'ru', c.slug) AS name,
           COALESCE(c.slug, '') AS slug,
           COUNT(b.id)::int AS bookings_count,
           COALESCE(SUM(b.total_amount), 0)::float8 AS total_revenue
         FROM bookings b
         JOIN hotels h ON h.id = b.hotel_id
         JOIN cities c ON c.id = h.city_id
         WHERE b.created_at >= $1
           AND b.status IN ('confirmed', 'completed')
         GROUP BY c.id, c.name, c.slug
         ORDER BY bookings_count DESC, total_revenue DESC
         LIMIT 10`,
        [since],
      );
    } catch {
      return [];
    }
  }

  private async paymentMethodShares(since: string) {
    return this.pg.query(
      `SELECT payment_method::text AS payment_method,
          COUNT(*)::int AS bookings,
          COALESCE(SUM(total_amount), 0)::float8 AS total_sum
       FROM bookings
       WHERE created_at >= $1
       GROUP BY payment_method
       ORDER BY bookings DESC, payment_method ASC`,
      [since],
    );
  }

  private funnel(rows: FunnelRow[]) {
    const byName = new Map(rows.map((row) => [row.event_name, row]));
    let previousSessions: number | null = null;

    return funnelEvents.map((eventName) => {
      const row = byName.get(eventName);
      const sessions = Number(row?.sessions_count ?? 0);
      const events = Number(row?.events_count ?? 0);
      const step = {
        eventName,
        events,
        sessions,
        conversionFromPrevious:
          previousSessions && previousSessions > 0
            ? Number((sessions / previousSessions).toFixed(4))
            : null,
      };
      previousSessions = sessions;
      return step;
    });
  }
}

function normalizeEventName(name: string): string {
  return name.trim();
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function firstIp(value: string | undefined): string | null {
  return value?.split(',')[0]?.trim().slice(0, 80) || null;
}

function boundedDays(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.min(Math.max(Math.round(value), 1), 365);
}
