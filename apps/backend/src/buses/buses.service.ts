import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  parsePagination,
  limitOffsetSql,
  type QueryLike,
} from '../common/pagination';
import { AppCacheService } from '../infrastructure/cache.service';
import { PostgresService } from '../infrastructure/postgres.service';

@Injectable()
export class BusesService {
  constructor(
    private readonly cache: AppCacheService,
    private readonly pg: PostgresService,
  ) {}

  async routes() {
    const sql = `
      SELECT
        r.id,
        r.from_city_id,
        r.to_city_id,
        r.duration_minutes,
        r.created_at,
        r.updated_at,
        jsonb_build_object('id', fc.id, 'name', fc.name) AS from_city,
        jsonb_build_object('id', tc.id, 'name', tc.name) AS to_city
      FROM routes r
      JOIN cities fc ON fc.id = r.from_city_id
      JOIN cities tc ON tc.id = r.to_city_id
      ORDER BY r.created_at DESC
    `;
    return this.pg.query(sql);
  }

  async trips(query: QueryLike) {
    const cacheKeyStr = `bus-trips:list:${cacheKey(query)}`;
    return this.cache.getOrSet(cacheKeyStr, 60, async () => {
      const pagination = parsePagination(query, 'public', {
        allowedSortBy: ['departure_at', 'base_price', 'available_seats'],
        defaultSortBy: 'departure_at',
        defaultLimit: 20,
      });

      const conditions: string[] = [
        "t.status = 'scheduled'",
        "bc.status = 'active'",
      ];
      const params: unknown[] = [];
      let paramIdx = 1;

      const fromCityId = first(query.from_city_id);
      if (fromCityId) {
        conditions.push(`t.from_city_id = $${paramIdx++}`);
        params.push(fromCityId);
      }

      const toCityId = first(query.to_city_id);
      if (toCityId) {
        conditions.push(`t.to_city_id = $${paramIdx++}`);
        params.push(toCityId);
      }

      const departureDate = first(query.departure_date);
      if (departureDate) {
        conditions.push(`t.departure_at::text LIKE $${paramIdx++} || '%'`);
        params.push(departureDate);
      }

      const minPrice = first(query.min_price);
      if (minPrice) {
        conditions.push(`t.base_price >= $${paramIdx++}::numeric`);
        params.push(Number(minPrice));
      }

      const maxPrice = first(query.max_price);
      if (maxPrice) {
        conditions.push(`t.base_price <= $${paramIdx++}::numeric`);
        params.push(Number(maxPrice));
      }

      const whereClause = conditions.join(' AND ');

      const orderDir = pagination.order === 'asc' ? 'ASC' : 'DESC';
      let sortClause: string;
      if (pagination.sortBy === 'available_seats') {
        sortClause = `ORDER BY available_seats ${orderDir}`;
      } else if (pagination.sortBy === 'base_price') {
        sortClause = `ORDER BY t.base_price ${orderDir}`;
      } else {
        sortClause = `ORDER BY t.departure_at ${orderDir}`;
      }

      const sql = `
        SELECT
          t.id,
          t.route_id,
          t.company_id,
          t.from_city_id,
          t.to_city_id,
          t.departure_at,
          t.arrival_at,
          t.status,
          t.base_price,
          t.policy_snapshot,
          t.created_at,
          t.updated_at,
          r.duration_minutes,
          jsonb_build_object('id', fc.id, 'name', fc.name) AS from_city,
          jsonb_build_object('id', tc.id, 'name', tc.name) AS to_city,
          jsonb_build_object(
            'id', bc.id,
            'name', bc.name,
            'rating_average', bc.rating_average,
            'reviews_count', bc.reviews_count
          ) AS company,
          (
            SELECT COUNT(*)
            FROM trip_seats ts
            WHERE ts.trip_id = t.id AND ts.status = 'available'
          ) AS available_seats
        FROM trips t
        JOIN routes r ON r.id = t.route_id
        JOIN cities fc ON fc.id = t.from_city_id
        JOIN cities tc ON tc.id = t.to_city_id
        JOIN bus_companies bc ON bc.id = t.company_id
        WHERE ${whereClause}
        ${sortClause}
        ${limitOffsetSql(pagination)}
      `;

      return this.pg.query(sql, params);
    });
  }

  async trip(id: string) {
    const [result] = await this.pg.query(
      `
        SELECT
          t.id,
          t.route_id,
          t.company_id,
          t.from_city_id,
          t.to_city_id,
          t.departure_at,
          t.arrival_at,
          t.status,
          t.base_price,
          t.policy_snapshot,
          t.created_at,
          t.updated_at,
          r.duration_minutes,
          jsonb_build_object('id', fc.id, 'name', fc.name) AS from_city,
          jsonb_build_object('id', tc.id, 'name', tc.name) AS to_city,
          jsonb_build_object(
            'id', bc.id,
            'name', bc.name,
            'rating_average', bc.rating_average,
            'reviews_count', bc.reviews_count
          ) AS company,
          (
            SELECT COUNT(*)
            FROM trip_seats ts
            WHERE ts.trip_id = t.id AND ts.status = 'available'
          ) AS available_seats
        FROM trips t
        JOIN routes r ON r.id = t.route_id
        JOIN cities fc ON fc.id = t.from_city_id
        JOIN cities tc ON tc.id = t.to_city_id
        JOIN bus_companies bc ON bc.id = t.company_id
        WHERE t.id = $1
      `,
      [id],
    );

    if (!result) {
      throw new NotFoundException({
        code: 'TRIP_NOT_FOUND',
        message: 'Reys topilmadi',
      });
    }

    return result;
  }

  async seats(tripId: string) {
    await this.trip(tripId);
    return this.pg.query(
      'SELECT * FROM trip_seats WHERE trip_id = $1 ORDER BY seat_code',
      [tripId],
    );
  }

  async quote(id: string, body: Record<string, unknown>) {
    await this.trip(id);

    let seatCodes: string[];
    if (Array.isArray(body.seats)) {
      seatCodes = body.seats.map(String);
    } else {
      const availableSeats = await this.pg.query<{ seat_code: string }>(
        "SELECT seat_code FROM trip_seats WHERE trip_id = $1 AND status = 'available' ORDER BY seat_code LIMIT 1",
        [id],
      );
      seatCodes = availableSeats.map((s) => s.seat_code);
    }

    const selectedSeats = await this.pg.query(
      'SELECT * FROM trip_seats WHERE trip_id = $1 AND seat_code = ANY($2::text[])',
      [id, seatCodes],
    );

    const subtotal = selectedSeats.reduce(
      (sum, seat) => sum + Number(seat.price),
      0,
    );

    return {
      quote_id: randomUUID(),
      trip_id: id,
      seats: selectedSeats,
      currency: 'UZS',
      subtotal,
      service_fee: 0,
      total_amount: subtotal,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
  }

  async companyReviews(id: string) {
    const [company] = await this.pg.query(
      'SELECT id FROM bus_companies WHERE id = $1',
      [id],
    );

    if (!company) {
      throw new NotFoundException({
        code: 'TRIP_NOT_FOUND',
        message: 'Avtobus kompaniyasi topilmadi',
      });
    }

    // `SELECT *` ATAYLAB olib tashlandi: bu marshrut ommaviy (guard yo'q),
    // shuning uchun `reviews` jadvaliga qo'shiladigan har bir yangi ustun
    // (masalan `guest_name`) avtomatik ravishda ommaga chiqib ketardi.
    // `status` filtri ham yo'q edi — moderatsiya navbatidagi
    // (`pending_review`) va yashirilgan (`hidden`) sharhlar ko'rinib
    // turardi. Ikkalasi ham shu yerda tuzatildi.
    return this.pg.query(
      `SELECT r.id::text,
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
       FROM reviews r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.target_type = 'bus_company'
         AND r.target_id = $1
         AND r.status = 'published'
       ORDER BY r.created_at DESC`,
      [id],
    );
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function cacheKey(query: QueryLike): string {
  return Object.keys(query)
    .sort()
    .map(
      (key) => `${key}=${encodeURIComponent(String(first(query[key]) ?? ''))}`,
    )
    .join('&');
}
