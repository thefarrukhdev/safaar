import { Injectable, NotFoundException } from '@nestjs/common';
import { parseGeoBounds } from '../common/geo-bounds';
import { AppCacheService } from '../infrastructure/cache.service';
import { PostgresService } from '../infrastructure/postgres.service';

type DbRow = Record<string, unknown>;
type CatalogQuery = Record<string, string | string[] | undefined>;

const latitudeSql = `COALESCE(
  latitude,
  CASE WHEN metadata ->> 'latitude' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (metadata ->> 'latitude')::numeric END,
  CASE WHEN metadata ->> 'lat' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (metadata ->> 'lat')::numeric END
)`;

const longitudeSql = `COALESCE(
  longitude,
  CASE WHEN metadata ->> 'longitude' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (metadata ->> 'longitude')::numeric END,
  CASE WHEN metadata ->> 'lng' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (metadata ->> 'lng')::numeric END,
  CASE WHEN metadata ->> 'lon' ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (metadata ->> 'lon')::numeric END
)`;

const DEMO_RESTAURANT_SLUGS = [
  'osh-markazi',
  'osh-markazi-toshkent',
  'registon-terrace',
  'buxoro-caravan',
];

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown, fallback = 0): number {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function nullableNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function publicApiOrigin(): string {
  const raw =
    process.env.PUBLIC_API_ORIGIN ??
    'https://backend-production-87e6.up.railway.app';
  try {
    return new URL(raw).origin;
  } catch {
    return 'https://backend-production-87e6.up.railway.app';
  }
}

function publicMediaUrl(value: unknown): string {
  const url = String(value ?? '').trim();
  if (!url) return '';
  const origin = publicApiOrigin();
  if (url.startsWith('/uploads/')) {
    return `${origin}${url}`;
  }
  return url.replace(
    /^https?:\/\/localhost(?::\d+)?\/uploads\//i,
    `${origin}/uploads/`,
  );
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly cache: AppCacheService,
    private readonly postgres: PostgresService,
  ) {}

  async regions() {
    return this.cache.getOrSet('catalog:regions', 3600, async () => {
      return this.postgres.query(`
        select id::text, name, created_at, updated_at
        from regions
        order by name ->> 'uz'
      `);
    });
  }

  async cities() {
    return this.cache.getOrSet('catalog:cities', 3600, async () => {
      return this.postgres.query(`
        select id::text, region_id::text, name, created_at, updated_at
        from cities
        order by name ->> 'uz'
      `);
    });
  }

  async amenities() {
    return this.cache.getOrSet('catalog:amenities', 3600, async () => {
      return this.postgres.query(`
        select id::text, code, name, created_at, updated_at
        from amenities
        order by name ->> 'uz'
      `);
    });
  }

  async roomTypes() {
    return this.cache.getOrSet('catalog:room-types', 3600, async () => {
      return this.postgres.query(`
        select id::text, code, name, created_at, updated_at
        from room_types
        order by name ->> 'uz'
      `);
    });
  }

  async cancellationPolicies() {
    return this.cache.getOrSet(
      'catalog:cancellation-policies',
      3600,
      async () => {
        return this.postgres.query(`
        select id::text, name, rules, refundable_until_hours, created_at, updated_at
        from cancellation_policies
        order by name ->> 'uz'
      `);
      },
    );
  }

  async popularCities() {
    return this.cache.getOrSet('catalog:popular-cities', 3600, async () => {
      return this.postgres.query(`
        SELECT c.id::text, c.name, c.slug, c.image_url,
          c.sort_order,
          COUNT(h.id)::int as hotel_count
        FROM cities c
        LEFT JOIN hotels h ON h.city_id = c.id AND h.status = 'published'
        GROUP BY c.id, c.name, c.slug, c.image_url, c.sort_order
        ORDER BY c.sort_order, hotel_count DESC
      `);
    });
  }

  /**
   * "Mashhur yo'nalishlar" (bosh sahifa) — admin `POST/PATCH/DELETE
   * /admin/cms/destinations` orqali boshqaradigan, mavjud generik CMS
   * yozuvlari (`cms_entries`, `type='destination'`). Yangi jadval/model
   * YO'Q — `attractions()` bilan BIR XIL naqsh: shu jadvaldan
   * to'g'ridan-to'g'ri o'qiladi, faqat `status IN ('published','active')`
   * (draft/archived — jamoat ko'rinishida YO'Q, admin.service.ts'dagi
   * cmsList bilan bir xil qoida). `metadata.image_url`/`metadata.link`/
   * `metadata.order` — admin.service.ts'dagi cmsAdminDto/normalizeCmsMetadata
   * bilan bir xil kalitlar (banners/offers'da ham shu nomlar ishlatiladi).
   */
  async destinations() {
    return this.cache.getOrSet('catalog:destinations', 300, async () => {
      const rows = await this.postgres.query<DbRow>(`
        SELECT id::text, slug, title, metadata, published_at, created_at
        FROM cms_entries
        WHERE type = 'destination'
          AND status IN ('published', 'active')
        ORDER BY
          COALESCE((metadata ->> 'order')::int, (metadata ->> 'sortOrder')::int, 9999),
          COALESCE(published_at, created_at) DESC
      `);
      return rows.map((row) => {
        const meta = objectValue(row.metadata);
        const link = String(meta.link ?? '').trim();
        return {
          id: row.id,
          slug: row.slug,
          name: row.title,
          image_url: publicMediaUrl(meta.image_url ?? meta.imageUrl),
          // Faqat relative (`/`-prefixed) yo'llar ruxsat etiladi — admin
          // panelda ham (cms-destination-manager.tsx) shu qoida bilan
          // tekshiriladi; tashqi/absolyut URL yoki `javascript:` kabi
          // sxemalar XSS/open-redirect xavfi tug'dirishi mumkin.
          link: link.startsWith('/') ? link : null,
        };
      });
    });
  }

  async partnersShowcase() {
    return this.cache.getOrSet('catalog:partners-showcase', 3600, async () => {
      return this.postgres.query(`
        SELECT po.id::text, po.brand_name as company_name,
          po.logo_url, po.type, 0 as sort_order
        FROM partner_organizations po
        WHERE po.status = 'approved' AND po.showcase = true
        ORDER BY po.brand_name
      `);
    });
  }

  async attractions(query: CatalogQuery = {}) {
    return this.cache.getOrSet(
      `catalog:attractions:${cacheKey(query)}`,
      3600,
      async () => {
        const { conditions, params } = boundsConditions('attraction', query);
        const rows = await this.postgres.query<DbRow>(
          `
        SELECT id::text, slug, title, body, metadata,
          ${latitudeSql}::float8 AS latitude,
          ${longitudeSql}::float8 AS longitude,
          published_at, updated_at
        FROM cms_entries
        WHERE ${conditions.join(' AND ')}
        ORDER BY
          COALESCE((metadata ->> 'sortOrder')::int, (metadata ->> 'order')::int, 9999),
          COALESCE(published_at, created_at) DESC
      `,
          params,
        );
        return rows.map((row) => {
          const meta = objectValue(row.metadata);
          return {
            id: row.id,
            slug: row.slug,
            name: row.title,
            city_name: meta.city_name ?? meta.cityName ?? {},
            category_key: meta.category_key ?? meta.categoryKey ?? '',
            category_default:
              meta.category_default ?? meta.categoryDefault ?? '',
            description: row.body,
            rating: numberValue(meta.rating),
            latitude:
              nullableNumber(row.latitude) ??
              nullableNumber(meta.latitude ?? meta.lat),
            longitude:
              nullableNumber(row.longitude) ??
              nullableNumber(meta.longitude ?? meta.lng ?? meta.lon),
            image_url: publicMediaUrl(meta.image_url ?? meta.imageUrl),
            best_time_to_visit:
              meta.best_time_to_visit ?? meta.bestTimeToVisit ?? '',
            updated_at: row.updated_at,
          };
        });
      },
    );
  }

  async restaurants(query: CatalogQuery = {}) {
    return this.cache.getOrSet(
      `catalog:restaurants:${cacheKey(query)}`,
      60,
      () => this.restaurantsFresh(query),
    );
  }

  private async restaurantsFresh(query: CatalogQuery = {}) {
    const bounds = parseGeoBounds(query.bounds);

    // 1. Fetch published partner restaurants from hotels table
    const hotelConditions = [
      "po.type = 'restaurant'",
      "h.status = 'published'",
      "po.status = 'approved'",
      'h.deleted_at IS NULL',
    ];
    const hotelParams: unknown[] = [];
    let hotelParamIdx = 1;

    if (bounds) {
      hotelConditions.push(
        `h.latitude IS NOT NULL AND h.longitude IS NOT NULL AND h.latitude BETWEEN $${hotelParamIdx++} AND $${hotelParamIdx++}`,
      );
      hotelParams.push(bounds.south, bounds.north);
      if (bounds.west <= bounds.east) {
        hotelConditions.push(
          `h.longitude BETWEEN $${hotelParamIdx++} AND $${hotelParamIdx++}`,
        );
        hotelParams.push(bounds.west, bounds.east);
      } else {
        hotelConditions.push(
          `(h.longitude >= $${hotelParamIdx++} OR h.longitude <= $${hotelParamIdx++})`,
        );
        hotelParams.push(bounds.west, bounds.east);
      }
    }

    const partnerRows = await this.postgres.query<DbRow>(
      `
          SELECT
            h.id::text,
            h.slug,
            COALESCE(ht.name, po.brand_name) AS title,
            h.address,
            h.rating_average::float8 AS rating,
            h.reviews_count,
            h.latitude::float8 AS latitude,
            h.longitude::float8 AS longitude,
            CASE
              WHEN h.check_in_time IS NOT NULL AND h.check_out_time IS NOT NULL THEN h.check_in_time || ' - ' || h.check_out_time
              ELSE COALESCE(h.check_in_time, h.check_out_time, '')
            END AS working_hours,
            po.phone,
            c.name AS city_name,
            COALESCE(
              (SELECT url FROM media_files WHERE owner_type = 'hotel' AND owner_id = h.id AND deleted_at IS NULL AND url IS NOT NULL ORDER BY is_cover DESC, sort_order ASC LIMIT 1),
              po.logo_url,
              ''
            ) AS image_url,
            COALESCE(
              (SELECT MIN(base_price)::float8 FROM hotel_rooms WHERE hotel_id = h.id AND status = 'active'),
              0
            ) AS average_check,
            h.updated_at
          FROM hotels h
          JOIN partner_organizations po ON po.id = h.partner_organization_id
          LEFT JOIN hotel_translations ht ON ht.hotel_id = h.id AND ht.language = 'uz'
          LEFT JOIN cities c ON c.id = h.city_id
          WHERE ${hotelConditions.join(' AND ')}
          ORDER BY h.rating_average DESC, h.created_at DESC
        `,
      hotelParams,
    );

    const partnerRestaurants = partnerRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.title,
      city_name: row.city_name ?? {},
      address: row.address ?? '',
      cuisine: '',
      rating: numberValue(row.rating),
      reviews_count: numberValue(row.reviews_count),
      average_check: numberValue(row.average_check),
      latitude: nullableNumber(row.latitude),
      longitude: nullableNumber(row.longitude),
      working_hours: row.working_hours ?? '',
      image_url: publicMediaUrl(row.image_url),
      phone: row.phone ?? '',
      updated_at: row.updated_at,
    }));

    if (partnerRestaurants.length > 0) {
      return partnerRestaurants;
    }

    // 2. Fetch CMS entries for restaurants (excluding demo seed entries)
    const { conditions, params } = boundsConditions('restaurant', query);
    const demoSlugParam = params.length + 1;
    const cmsRows = await this.postgres.query<DbRow>(
      `
        SELECT id::text, slug, title, metadata,
          ${latitudeSql}::float8 AS latitude,
          ${longitudeSql}::float8 AS longitude,
          published_at, updated_at
        FROM cms_entries
        WHERE ${conditions.join(' AND ')}
          AND slug <> ALL($${demoSlugParam}::text[])
        ORDER BY
          COALESCE((metadata ->> 'sortOrder')::int, (metadata ->> 'order')::int, 9999),
          COALESCE(published_at, created_at) DESC
      `,
      [...params, DEMO_RESTAURANT_SLUGS],
    );
    const cmsRestaurants = cmsRows.map((row) => {
      const meta = objectValue(row.metadata);
      return {
        id: row.id,
        slug: row.slug,
        name: row.title,
        city_name: meta.city_name ?? meta.cityName ?? {},
        address: meta.address ?? '',
        cuisine: meta.cuisine ?? '',
        rating: numberValue(meta.rating),
        reviews_count: numberValue(meta.reviews_count ?? meta.reviewsCount),
        average_check: numberValue(meta.average_check ?? meta.averageCheck),
        latitude:
          nullableNumber(row.latitude) ??
          nullableNumber(meta.latitude ?? meta.lat),
        longitude:
          nullableNumber(row.longitude) ??
          nullableNumber(meta.longitude ?? meta.lng ?? meta.lon),
        working_hours: meta.working_hours ?? meta.workingHours ?? '',
        image_url: publicMediaUrl(meta.image_url ?? meta.imageUrl),
        phone: meta.phone ?? '',
        updated_at: row.updated_at,
      };
    });

    return cmsRestaurants;
  }

  async restaurant(slugOrId: string) {
    const rows = await this.postgres.query<DbRow>(
      `
      SELECT
        h.id::text,
        h.slug,
        COALESCE(ht.name, po.brand_name) AS name,
        ht.description,
        h.address,
        h.rating_average::float8 AS rating,
        h.reviews_count,
        h.latitude::float8 AS latitude,
        h.longitude::float8 AS longitude,
        h.check_in_time,
        h.check_out_time,
        CASE
          WHEN h.check_in_time IS NOT NULL AND h.check_out_time IS NOT NULL THEN h.check_in_time || ' - ' || h.check_out_time
          ELSE COALESCE(h.check_in_time, h.check_out_time, '')
        END AS working_hours,
        po.phone,
        c.id::text AS city_id,
        c.name AS city_name,
        h.updated_at
      FROM hotels h
      JOIN partner_organizations po ON po.id = h.partner_organization_id
      LEFT JOIN hotel_translations ht ON ht.hotel_id = h.id AND ht.language = 'uz'
      LEFT JOIN cities c ON c.id = h.city_id
      WHERE (h.id::text = $1 OR h.slug = $1)
        AND po.type = 'restaurant'
        AND h.status = 'published'
        AND po.status = 'approved'
        AND h.deleted_at IS NULL
    `,
      [slugOrId],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'RESTAURANT_NOT_FOUND',
        message: 'Restoran topilmadi',
      });
    }

    const res = rows[0];
    const hotelId = String(res.id);

    const [mediaRows, roomRows] = await Promise.all([
      this.postgres.query<{ url: string }>(
        `SELECT url FROM media_files WHERE owner_type = 'hotel' AND owner_id = $1::uuid AND deleted_at IS NULL AND url IS NOT NULL ORDER BY is_cover DESC, sort_order ASC`,
        [hotelId],
      ),
      this.postgres.query<{
        id: string;
        code: string;
        base_occupancy: number;
        max_adults: number;
        base_price: number;
        status: string;
      }>(
        `SELECT id::text, code, base_occupancy, max_adults, base_price::float8, status::text
         FROM hotel_rooms
         WHERE hotel_id = $1::uuid AND status = 'active'
         ORDER BY code ASC`,
        [hotelId],
      ),
    ]);

    const images = mediaRows.map((m) => publicMediaUrl(m.url));
    const tables = roomRows.map((r) => ({
      id: r.id,
      code: r.code,
      name: `Stol № ${r.code}`,
      capacity: r.max_adults || r.base_occupancy || 4,
      base_price: Number(r.base_price || 0),
    }));

    return {
      id: res.id,
      slug: res.slug,
      name: res.name,
      description: res.description ?? '',
      city: { id: res.city_id, name: res.city_name },
      address: res.address,
      latitude: nullableNumber(res.latitude),
      longitude: nullableNumber(res.longitude),
      working_hours: res.working_hours,
      check_in_time: res.check_in_time,
      check_out_time: res.check_out_time,
      phone: res.phone,
      rating: numberValue(res.rating),
      reviews_count: numberValue(res.reviews_count),
      image_url: images[0] ?? '',
      images,
      tables,
    };
  }

  /**
   * `checkIn`/`checkOut` berilsa — shu sanalarda band bo'lgan mashinalar
   * ro'yxatdan chiqarib tashlanadi (mehmonxonaning `GET /hotels?check_in=&
   * check_out=` bilan bir xil g'oya) va natija keshlanmaydi — turli sana
   * kombinatsiyasi uchun keshlash keraksiz murakkablik qo'shar edi.
   */
  async transports(checkIn?: string, checkOut?: string) {
    const query = () =>
      checkIn && checkOut
        ? this.postgres.query(
            `
              SELECT
                v.id::text,
                v.name,
                c.name AS city_name,
                'transfer' AS category_key,
                'Transport' AS category_default,
                v.seats_count AS seats,
                true AS has_driver,
                '' AS fuel_type,
                '' AS transmission,
                v.price_per_day::float8 AS price_per_day,
                bc.rating_average::float8 AS rating,
                COALESCE(po.logo_url, '') AS image_url,
                po.phone,
                v.updated_at
              FROM vehicles v
              JOIN bus_companies bc ON bc.id = v.company_id
              JOIN partner_organizations po ON po.id = bc.partner_organization_id
              LEFT JOIN cities c ON c.id = po.city_id
              WHERE v.status = 'active'
                AND bc.status = 'active'
                AND po.status = 'approved'
                AND NOT EXISTS (
                  SELECT 1 FROM bookings b
                  WHERE b.vehicle_id = v.id
                    AND b.status NOT IN ('cancelled', 'expired', 'completed')
                    AND b.check_in < $2::date
                    AND $1::date < b.check_out
                )
              ORDER BY v.updated_at DESC
            `,
            [checkIn, checkOut],
          )
        : this.postgres.query(`
            SELECT
              v.id::text,
              v.name,
              c.name AS city_name,
              'transfer' AS category_key,
              'Transport' AS category_default,
              v.seats_count AS seats,
              true AS has_driver,
              '' AS fuel_type,
              '' AS transmission,
              v.price_per_day::float8 AS price_per_day,
              bc.rating_average::float8 AS rating,
              COALESCE(po.logo_url, '') AS image_url,
              po.phone,
              v.updated_at
            FROM vehicles v
            JOIN bus_companies bc ON bc.id = v.company_id
            JOIN partner_organizations po ON po.id = bc.partner_organization_id
            LEFT JOIN cities c ON c.id = po.city_id
            WHERE v.status = 'active'
              AND bc.status = 'active'
              AND po.status = 'approved'
            ORDER BY v.updated_at DESC
          `);

    if (checkIn && checkOut) {
      return query();
    }
    return this.cache.getOrSet('catalog:transports', 3600, query);
  }

  /** `transports()` bilan bir xil `vehicles`/`bus_companies` manbasidan, bitta transport uchun. */
  async transport(id: string) {
    const rows = await this.postgres.query<DbRow>(
      `
        SELECT
          v.id::text,
          v.name,
          v.plate_number,
          v.seats_count AS seats,
          v.fuel_type,
          v.has_ac,
          v.luggage_capacity_bags,
          v.photos,
          v.price_per_day::float8 AS price_per_day,
          c.name AS city_name,
          bc.name AS company_name,
          bc.rating_average::float8 AS rating,
          bc.reviews_count,
          po.phone,
          COALESCE(po.logo_url, '') AS image_url
        FROM vehicles v
        JOIN bus_companies bc ON bc.id = v.company_id
        JOIN partner_organizations po ON po.id = bc.partner_organization_id
        LEFT JOIN cities c ON c.id = po.city_id
        WHERE v.id::text = $1
          AND v.status = 'active'
          AND bc.status = 'active'
          AND po.status = 'approved'
      `,
      [id],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        message: 'Transport topilmadi',
      });
    }

    const res = rows[0];
    const imageUrl = String(res.image_url ?? '');
    const photos = Array.isArray(res.photos)
      ? (res.photos as unknown[]).filter(
          (p): p is string => typeof p === 'string',
        )
      : [];
    const images = photos.length > 0 ? photos : [imageUrl].filter(Boolean);

    return {
      id: String(res.id),
      name: String(res.name ?? ''),
      cityName: String(res.city_name ?? ''),
      categoryKey: 'transfer',
      categoryDefault: 'Transport',
      seats: Number(res.seats) || 0,
      hasDriver: true,
      fuelType: String(res.fuel_type ?? ''),
      transmission: '',
      hasAc: Boolean(res.has_ac),
      luggageCapacityBags:
        res.luggage_capacity_bags == null
          ? null
          : Number(res.luggage_capacity_bags),
      plateNumber: res.plate_number == null ? null : String(res.plate_number),
      pricePerDay: Number(res.price_per_day) || 0,
      companyName: String(res.company_name ?? ''),
      rating: Number(res.rating) || 0,
      reviewsCount: Number(res.reviews_count) || 0,
      phone: String(res.phone ?? ''),
      imageUrl,
      images,
    };
  }
}

function boundsConditions(
  type: 'attraction' | 'restaurant',
  query: CatalogQuery,
) {
  const conditions = [`type = $1`, "status IN ('published', 'active')"];
  const params: unknown[] = [type];
  let paramIndex = 2;
  const bounds = parseGeoBounds(query.bounds);

  if (!bounds) {
    return { conditions, params };
  }

  conditions.push(
    `${latitudeSql} IS NOT NULL`,
    `${longitudeSql} IS NOT NULL`,
    `${latitudeSql} BETWEEN $${paramIndex++} AND $${paramIndex++}`,
  );
  params.push(bounds.south, bounds.north);

  if (bounds.west <= bounds.east) {
    conditions.push(
      `${longitudeSql} BETWEEN $${paramIndex++} AND $${paramIndex++}`,
    );
    params.push(bounds.west, bounds.east);
  } else {
    conditions.push(
      `(${longitudeSql} >= $${paramIndex++} OR ${longitudeSql} <= $${paramIndex++})`,
    );
    params.push(bounds.west, bounds.east);
  }

  return { conditions, params };
}

function cacheKey(query: CatalogQuery): string {
  return Object.keys(query)
    .sort()
    .map((key) => {
      const value = query[key];
      const first = Array.isArray(value) ? value[0] : value;
      return `${key}=${encodeURIComponent(String(first ?? ''))}`;
    })
    .join('&');
}
