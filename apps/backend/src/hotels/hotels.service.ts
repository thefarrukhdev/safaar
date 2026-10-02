import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parsePagination, type QueryLike } from '../common/pagination';
import { AppCacheService } from '../infrastructure/cache.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { parseGeoBounds } from '../common/geo-bounds';
import {
  calculateRoomPrice,
  loadActiveRoomPromotions,
} from '../common/room-pricing';

// `partner_organizations.type` (PartnerOrganizationType) qiymatlaridan yashash
// joyi turidagilari — `hotels` katalogi/detali faqat shularni ko'rsatadi
// (`bus`, `restaurant` emas).
const ACCOMMODATION_TYPE_MAP: Record<string, string> = {
  hotel: 'hotel',
  hotels: 'hotel',
  hostel: 'hostel',
  hostels: 'hostel',
  guesthouse: 'guesthouse',
  guesthouses: 'guesthouse',
  motel: 'motel',
  motels: 'motel',
  dacha: 'dacha',
  dachas: 'dacha',
  sanatorium: 'sanatorium',
  sanatoriums: 'sanatorium',
  resort: 'resort',
  resorts: 'resort',
  mixed: 'mixed',
};

/**
 * `?type=` yoki `?types=` so'rov parametrlarini tekshiradi va normallashtiradi.
 * Birlik ("hotel", "dacha") va ko'plik ("hotels", "dachas") shakllarini qabul qiladi.
 */
function normalizeAccommodationTypes(
  value: string | string[] | undefined,
): string[] {
  if (!value) return [];
  const rawList = Array.isArray(value) ? value : [value];
  const result: string[] = [];

  for (const item of rawList) {
    if (typeof item !== 'string') continue;
    const tokens = item.split(',').map((t) => t.trim().toLowerCase());
    for (const token of tokens) {
      const mapped = ACCOMMODATION_TYPE_MAP[token];
      if (mapped && !result.includes(mapped)) {
        result.push(mapped);
      }
    }
  }

  return result;
}

@Injectable()
export class HotelsService {
  constructor(
    private readonly cache: AppCacheService,
    private readonly pg: PostgresService,
  ) {}

  async findAll(query: QueryLike) {
    return this.cache.getOrSet(`hotels:list:${cacheKey(query)}`, 60, () => {
      return this.findAllFresh(query);
    });
  }

  private async findAllFresh(query: QueryLike) {
    const conditions = [
      "h.status = 'published'",
      'h.deleted_at IS NULL',
      "po.status = 'approved'",
    ];
    const params: unknown[] = [];
    let paramIndex = 1;

    // `hotels` jadvali barcha hamkor turlari (jumladan transport/restoran) uchun
    // umumiy "e'lon" yozuvi sifatida ishlatiladi (getPrimaryHotel() auto-create
    // orqali). `?type=` berilsa — kategoriya sahifasi (/dachas, /resorts,
    // /sanatoriums) — aynan o'sha yashash-joyi turi ko'rsatiladi; berilmasa,
    // sukut bo'yicha "Mehmonxonalar" katalogi (sanatoriy/oromgoh o'z
    // bo'limlarida qoladi, transport/restoran esa hech qachon chiqmaydi).
    const accommodationTypes = normalizeAccommodationTypes(
      query.types ?? query.type,
    );
    if (accommodationTypes.length === 1) {
      conditions.push(`po.type = $${paramIndex++}`);
      params.push(accommodationTypes[0]);
    } else if (accommodationTypes.length > 1) {
      conditions.push(`po.type::text = ANY($${paramIndex++}::text[])`);
      params.push(accommodationTypes);
    } else {
      conditions.push(
        "po.type IN ('hotel', 'hostel', 'guesthouse', 'motel', 'dacha', 'mixed', 'sanatorium', 'resort')",
      );
    }

    if (query.city_id) {
      conditions.push(`h.city_id = $${paramIndex++}`);
      params.push(query.city_id);
    }

    // `?min_stars=` yoki `?stars=` — mehmonxona yulduzlari bo'yicha filtr.
    // Frontendda "4 va yuqori", "3 va yuqori" tanlanganida `stars="4"`, `stars="3"` yuboriladi (>= stars).
    // Shuningdek, bir nechta yulduzlar (`stars="3,4,5"` yoki `stars=["3", "4"]`) ANY(...) orqali qo'llab-quvvatlanadi.
    const minStarsRaw = first(query.min_stars ?? query.minStars);
    const starsRaw = query.stars;
    if (minStarsRaw !== undefined && minStarsRaw !== '') {
      const minStars = Number(minStarsRaw);
      if (
        !Number.isFinite(minStars) ||
        !Number.isInteger(minStars) ||
        minStars < 1 ||
        minStars > 5
      ) {
        throw new BadRequestException({
          code: 'SEARCH_STARS_INVALID',
          message:
            "min_stars parametri noto'g'ri (1-5 oralig'ida bo'lishi kerak)",
        });
      }
      conditions.push(`h.stars >= $${paramIndex++}`);
      params.push(minStars);
    } else if (starsRaw !== undefined && starsRaw !== '') {
      const rawStr = Array.isArray(starsRaw)
        ? starsRaw.join(',')
        : String(starsRaw);
      const parts = rawStr
        .split(',')
        .map((s) => s.trim().replace(/\+$/, ''))
        .filter(Boolean);
      const starNums = parts.map(Number);
      const hasInvalid =
        starNums.length === 0 ||
        starNums.some(
          (n) => !Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 5,
        );

      if (hasInvalid) {
        throw new BadRequestException({
          code: 'SEARCH_STARS_INVALID',
          message: "stars parametri noto'g'ri (1-5 oralig'ida bo'lishi kerak)",
        });
      }

      if (starNums.length > 1) {
        conditions.push(`h.stars = ANY($${paramIndex++}::int[])`);
        params.push(starNums);
      } else {
        conditions.push(`h.stars >= $${paramIndex++}`);
        params.push(starNums[0]);
      }
    }

    if (query.featured === 'true') {
      conditions.push('h.featured = true');
    }

    if (query.min_rating) {
      conditions.push(`h.rating_average >= $${paramIndex++}`);
      params.push(Number(query.min_rating));
    }

    // `?min_price=` va `?max_price=` — 1 kechalik minimal xona narxi (rp.min_price) bo'yicha filtr.
    const minPriceRaw = first(query.min_price ?? query.minPrice);
    let minPrice: number | undefined;
    if (minPriceRaw !== undefined && minPriceRaw !== '') {
      const parsed = Number(minPriceRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new BadRequestException({
          code: 'SEARCH_PRICE_INVALID',
          message: "min_price parametri noto'g'ri",
        });
      }
      minPrice = parsed;
    }

    const maxPriceRaw = first(query.max_price ?? query.maxPrice);
    let maxPrice: number | undefined;
    if (maxPriceRaw !== undefined && maxPriceRaw !== '') {
      const parsed = Number(maxPriceRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new BadRequestException({
          code: 'SEARCH_PRICE_INVALID',
          message: "max_price parametri noto'g'ri",
        });
      }
      maxPrice = parsed;
    }

    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException({
        code: 'SEARCH_PRICE_INVALID',
        message: "min_price max_price dan katta bo'lishi mumkin emas",
      });
    }

    if (minPrice !== undefined) {
      conditions.push(`rp.min_price >= $${paramIndex++}`);
      params.push(minPrice);
    }

    if (maxPrice !== undefined) {
      conditions.push(`rp.min_price <= $${paramIndex++}`);
      params.push(maxPrice);
    }

    // `?payment_type=` — to'lov turi bo'yicha filtr:
    // "online_payment" (onlayn) yoki "pay_at_property" / "cash" (joyida naqd to'lash)
    const paymentTypeRaw = first(query.payment_type ?? query.paymentType);
    if (paymentTypeRaw !== undefined && paymentTypeRaw !== '') {
      const pt = paymentTypeRaw.trim().toLowerCase();
      if (pt === 'pay_at_property' || pt === 'cash') {
        conditions.push('COALESCE(h.allows_cash, true) = true');
      } else if (pt === 'online_payment' || pt === 'online') {
        conditions.push('COALESCE(h.allows_online_payment, true) = true');
      }
    }

    const bounds = parseGeoBounds(query.bounds);
    if (bounds) {
      conditions.push(
        `h.latitude IS NOT NULL AND h.longitude IS NOT NULL AND h.latitude BETWEEN $${paramIndex++} AND $${paramIndex++}`,
      );
      params.push(bounds.south, bounds.north);

      if (bounds.west <= bounds.east) {
        conditions.push(
          `h.longitude BETWEEN $${paramIndex++} AND $${paramIndex++}`,
        );
        params.push(bounds.west, bounds.east);
      } else {
        conditions.push(
          `(h.longitude >= $${paramIndex++} OR h.longitude <= $${paramIndex++})`,
        );
        params.push(bounds.west, bounds.east);
      }
    }

    // `?check_in=&check_out=` — audit topilmasi: frontend allaqachon
    // yuborardi, lekin bu yerda UMUMAN o'qilmasdi (URL o'zgaradi, natijalar
    // filtrlanmaydi). Ikkalasi birga berilishi shart — faqat bittasi
    // berilsa noto'g'ri so'rov hisoblanadi. Format/oraliq tekshiruvi
    // `bookings.service.ts`dagi (booking yaratish) AYNAN bir xil
    // `BOOKING_DATES_INVALID` konvensiyasi bilan bir xil (`Date.parse` +
    // `checkOut <= checkIn` rad etiladi).
    const checkInRaw = first(query.check_in);
    const checkOutRaw = first(query.check_out);
    let availabilityRange: { checkIn: string; checkOut: string } | undefined;
    if (checkInRaw || checkOutRaw) {
      const checkIn = String(checkInRaw ?? '');
      const checkOut = String(checkOutRaw ?? '');
      const checkInMs = Date.parse(checkIn);
      const checkOutMs = Date.parse(checkOut);
      if (
        !Number.isFinite(checkInMs) ||
        !Number.isFinite(checkOutMs) ||
        checkOutMs <= checkInMs
      ) {
        throw new BadRequestException({
          code: 'SEARCH_DATES_INVALID',
          message: "check_in/check_out sanalari noto'g'ri",
        });
      }
      availabilityRange = { checkIn, checkOut };
    }

    // `?guests=` — "guests" domenda "adults"ga mos keladi (qarang
    // `packages/api-client/src/services/bookings.ts`: `adults: input.guests
    // ?? 1` — booking yaratishda ishlatiladigan AYNAN shu naqsh), shu
    // sabab xona sig'imi `hotel_rooms.max_adults` bilan solishtiriladi.
    const guestsRaw = first(query.guests);
    let guests: number | undefined;
    if (guestsRaw !== undefined && guestsRaw !== '') {
      const parsed = Number(guestsRaw);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
        throw new BadRequestException({
          code: 'SEARCH_GUESTS_INVALID',
          message: "guests parametri noto'g'ri",
        });
      }
      guests = parsed;
    }

    // Xona mavjudligi: hotel FAQAT kamida bitta "band qilinadigan" xonasi
    // bo'lsa qaytariladi — booking yaratishdagi (`bookings.service.ts`)
    // AYNAN bir xil ikki tekshiruv qayta ishlatiladi (yangi mantiq
    // o'ylab topilmadi):
    //   1) `room_inventory.closed=true` — hamkor/admin vaqtincha
    //      bloklagan sanalar (qarang `roomAvailabilityBlock()`).
    //   2) band qilingan xonalar yig'indisi (`price_snapshot->>'rooms'`)
    //      `total_inventory`dan oshmasligi — faqat HALI YAKUNLANMAGAN
    //      bronlar hisoblanadi: `cancelled`/`expired`/`completed`
    //      chiqarib tashlanadi (bir xil `activeExclusions` ro'yxati,
    //      `bookings.service.ts:528`).
    // Bitta EXISTS-subquery orqali — N+1 emas, bitta SQL so'rovining bir
    // qismi (Postgres uni nested-loop/index orqali bajaradi).
    if (availabilityRange || guests !== undefined) {
      const roomConditions: string[] = [
        'r.hotel_id = h.id',
        "r.status = 'active'",
      ];
      if (guests !== undefined) {
        roomConditions.push(`r.max_adults >= $${paramIndex++}`);
        params.push(guests);
      }
      if (availabilityRange) {
        const checkInParam = paramIndex++;
        const checkOutParam = paramIndex++;
        params.push(availabilityRange.checkIn, availabilityRange.checkOut);
        roomConditions.push(
          `NOT EXISTS (
             SELECT 1 FROM room_inventory ri
             WHERE ri.room_id = r.id AND ri.closed = true
               AND ri.date >= $${checkInParam}::date AND ri.date < $${checkOutParam}::date
           )`,
        );
        roomConditions.push(
          `r.total_inventory > COALESCE((
             SELECT SUM(COALESCE((b.price_snapshot->>'rooms')::int, 1))
             FROM bookings b
             WHERE b.room_id = r.id
               AND b.status NOT IN ('cancelled', 'expired', 'completed')
               AND b.check_in < $${checkOutParam}::date
               AND $${checkInParam}::date < b.check_out
           ), 0)`,
        );
      }
      conditions.push(
        `EXISTS (SELECT 1 FROM hotel_rooms r WHERE ${roomConditions.join(' AND ')})`,
      );
    }

    // `?amenities=wifi,pool` — vergul bilan ajratilgan `amenities.code`
    // ro'yxati (frontend AYNAN shu formatda yuboradi: `packages/api-client
    // /src/services/hotels.ts`: `amenities: params.amenities?.join(",")`).
    // AND semantikasi: hotel SO'RALGAN HAMMA amenity'larga ega bo'lishi
    // kerak (frontend/mock hech qanday OR signalini bermagan — bir nechta
    // filtrni birga tanlash odatda natijalarni TORAYTIRADI, kengaytirmaydi
    // — standart qidiruv-filtr UX konvensiyasi). Relyatsion bo'lish
    // ("division"): so'ralgan kodlar orasida hotel EGA BO'LMAGAN birortasi
    // qolmasligi kerak.
    const amenityCodes = String(first(query.amenities) ?? '')
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);
    if (amenityCodes.length > 0) {
      conditions.push(
        `NOT EXISTS (
           SELECT 1 FROM unnest($${paramIndex}::text[]) AS required_code
           WHERE NOT EXISTS (
             SELECT 1 FROM hotel_amenities ha
             JOIN amenities a ON a.id = ha.amenity_id
             WHERE ha.hotel_id = h.id AND a.code = required_code
           )
         )`,
      );
      params.push(amenityCodes);
      paramIndex++;
    }

    const pagination = parsePagination(query, 'public', {
      allowedSortBy: ['created_at', 'rating_average', 'stars', 'min_price'],
      defaultSortBy: 'rating_average',
    });
    const limitParam = paramIndex++;
    const offsetParam = paramIndex++;
    params.push(pagination.limit, pagination.offset);

    // `?featured=true` — admin `cms/featured-hotels` orqali belgilagan
    // ANIQ tartib birinchi o'ringa qo'yiladi (NULLS LAST: hali tartib
    // berilmagan, lekin featured=true bo'lgan hotel oxirida qoladi, hech
    // qachon admin belgilagan tartibni buzmaydi). `featured != true`
    // so'rovlarda bu ustun butunlay e'tiborga olinmaydi.
    const orderBySql =
      query.featured === 'true'
        ? `h.featured_order ASC NULLS LAST, ${hotelOrderBySql(pagination.sortBy, pagination.order)}`
        : hotelOrderBySql(pagination.sortBy, pagination.order);

    const rows = await this.pg.query(
      `SELECT h.id::text, h.partner_organization_id::text, h.slug, h.city_id::text,
        h.address, h.latitude::float8, h.longitude::float8, h.stars,
        h.rating_average::float8, h.reviews_count, h.status::text, h.featured,
        h.check_in_time, h.check_out_time,
        h.created_at, h.updated_at,
        ht.name, ht.description,
        c.name as city_name, c.region_id::text,
        rp.min_price::float8,
        COALESCE(h.allows_cash, true) as allows_cash,
        COALESCE(h.allows_online_payment, true) as allows_online_payment,
        COUNT(*) OVER()::int AS total_count
      FROM hotels h
      JOIN partner_organizations po ON po.id = h.partner_organization_id
      LEFT JOIN hotel_translations ht ON ht.hotel_id = h.id AND ht.language = 'uz'
      LEFT JOIN cities c ON c.id = h.city_id
      LEFT JOIN (SELECT hotel_id, MIN(base_price) as min_price FROM hotel_rooms WHERE status = 'active' GROUP BY hotel_id) rp ON rp.hotel_id = h.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBySql}
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    const listingData = await this.loadListingData(
      rows.map((row) => String((row as Record<string, unknown>).id)),
    );

    const mapped = rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      partner_organization_id: r.partner_organization_id,
      slug: r.slug,
      city_id: r.city_id,
      address: r.address,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      stars: Number(r.stars),
      rating_average: Number(r.rating_average),
      reviews_count: Number(r.reviews_count),
      status: r.status,
      featured: r.featured ?? false,
      check_in_time: r.check_in_time,
      check_out_time: r.check_out_time,
      created_at: r.created_at,
      updated_at: r.updated_at,
      name: listingData.names.get(String(r.id)) ?? localized(r.name),
      description:
        listingData.descriptions.get(String(r.id)) ?? localized(r.description),
      city: { id: r.city_id, region_id: r.region_id, name: r.city_name },
      amenities: listingData.amenities.get(String(r.id)) ?? [],
      images: listingData.images.get(String(r.id)) ?? [],
      min_price: Number(r.min_price || 0),
      allows_cash: Boolean(r.allows_cash ?? true),
      allows_online_payment: Boolean(r.allows_online_payment ?? true),
    }));

    const total = totalCount(rows);
    return {
      items: mapped,
      total,
      page: pagination.page,
      limit: pagination.limit,
      total_pages: Math.max(1, Math.ceil(total / pagination.limit)),
    };
  }

  async findOne(slugOrId: string) {
    const rows = await this.pg.query(
      `SELECT h.id::text, h.partner_organization_id::text, h.slug, h.city_id::text,
        h.address, h.latitude::float8, h.longitude::float8, h.stars,
        h.rating_average::float8, h.reviews_count, h.status::text,
        h.check_in_time, h.check_out_time,
        h.cancellation_policy_code, h.smoking_allowed, h.pets_allowed, h.children_allowed,
        h.created_at, h.updated_at,
        COALESCE(h.allows_cash, true) as allows_cash,
        COALESCE(h.allows_online_payment, true) as allows_online_payment,
        ht.name, ht.description,
        c.name as city_name, c.region_id::text
      FROM hotels h
      JOIN partner_organizations po ON po.id = h.partner_organization_id
      LEFT JOIN hotel_translations ht ON ht.hotel_id = h.id AND ht.language = 'uz'
      LEFT JOIN cities c ON c.id = h.city_id
      WHERE (h.id::text = $1 OR h.slug = $1)
        AND h.status = 'published'
        AND h.deleted_at IS NULL
        AND po.status = 'approved'
        AND po.type IN ('hotel', 'hostel', 'guesthouse', 'motel', 'dacha', 'sanatorium', 'resort', 'mixed')`,
      [slugOrId],
    );

    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'HOTEL_NOT_FOUND',
        message: 'Hotel topilmadi',
      });
    }

    const h = rows[0] as Record<string, unknown>;
    const listingData = await this.loadListingData([String(h.id)]);
    const rooms = await this.loadHotelRooms(String(h.id));

    return {
      id: h.id,
      partner_organization_id: h.partner_organization_id,
      slug: h.slug,
      city_id: h.city_id,
      address: h.address,
      latitude: Number(h.latitude),
      longitude: Number(h.longitude),
      stars: Number(h.stars),
      rating_average: Number(h.rating_average),
      reviews_count: Number(h.reviews_count),
      status: h.status,
      check_in_time: h.check_in_time,
      check_out_time: h.check_out_time,
      created_at: h.created_at,
      updated_at: h.updated_at,
      name: listingData.names.get(String(h.id)) ?? localized(h.name),
      description:
        listingData.descriptions.get(String(h.id)) ?? localized(h.description),
      city: { id: h.city_id, region_id: h.region_id, name: h.city_name },
      amenities: listingData.amenities.get(String(h.id)) ?? [],
      images: listingData.images.get(String(h.id)) ?? [],
      allows_cash: Boolean(h.allows_cash ?? true),
      allows_online_payment: Boolean(h.allows_online_payment ?? true),
      rooms,
    };
  }

  async rooms(id: string) {
    return this.loadHotelRooms(id);
  }

  /**
   * Bitta mehmonxonaning faol xonalarini, HAR BIR xona nomi bilan birga
   * yuklaydi — `findOne()` va `rooms()` ikkalasi ham shu yerdan foydalanadi.
   *
   * Nom manbasi ikkita, aniq ustuvorlik bilan (P2 bug fix):
   *   1) `hotel_room_translations` — hamkor shu ANIQ xona uchun kiritgan,
   *      moslashtirilgan nom (bor bo'lsa eng aniq manba).
   *   2) `room_types.name` — umumiy xona turi nomi ("Standart"/"Deluxe"),
   *      hamkor moslashtirilgan nom kiritmagan bo'lsa fallback sifatida.
   * `room_type_id` `hotel_rooms`da NOT NULL + FK bilan cheklangan, shuning
   * uchun (2) doim mavjud — ikkalasi ham bo'lmagan holat yo'q.
   *
   * Ikkita so'rov (xona+tur INNER JOIN, keyin tarjimalar uchun bitta
   * batched `= ANY($1)`) — xonalar soniga qarab N+1 bo'lmaydi, `hotel_id`
   * bo'yicha bittadan.
   */
  private async loadHotelRooms(hotelId: string) {
    const roomRows = await this.pg.query(
      `SELECT hr.id::text, hr.hotel_id::text, hr.room_type_id::text, hr.code,
        hr.base_occupancy, hr.max_adults, hr.max_children,
        hr.total_inventory, hr.base_price::float8, hr.status::text,
        rt.name AS room_type_name
      FROM hotel_rooms hr
      JOIN room_types rt ON rt.id = hr.room_type_id
      WHERE hr.hotel_id = $1 AND hr.status = 'active'`,
      [hotelId],
    );

    const roomIds = roomRows.map((r: Record<string, unknown>) => String(r.id));
    const roomTypeIds = roomRows.map((r: Record<string, unknown>) =>
      String(r.room_type_id),
    );
    const allRoomRelatedIds = Array.from(new Set([...roomIds, ...roomTypeIds]));

    const roomNames = await this.loadRoomNames(roomIds);
    const roomPromotions = await loadActiveRoomPromotions(
      this.pg,
      allRoomRelatedIds,
    );

    const roomMediaMap = new Map<string, string[]>();
    if (allRoomRelatedIds.length > 0) {
      const roomMedia = await this.pg.query<{ owner_id: string; url: string }>(
        `SELECT owner_id::text, url
         FROM media_files
         WHERE owner_type IN ('room', 'room_type')
           AND owner_id = ANY($1::uuid[])
           AND deleted_at IS NULL
           AND url IS NOT NULL
         ORDER BY sort_order ASC, created_at ASC`,
        [allRoomRelatedIds],
      );
      for (const m of roomMedia) {
        if (!roomMediaMap.has(m.owner_id)) {
          roomMediaMap.set(m.owner_id, []);
        }
        roomMediaMap.get(m.owner_id)!.push(m.url);
      }
    }

    return roomRows.map((r: Record<string, unknown>) => {
      const roomTypeName = localized(r.room_type_name);
      const translation = roomNames.get(String(r.id));
      const activePromotion =
        roomPromotions.get(String(r.id)) ??
        roomPromotions.get(String(r.room_type_id)) ??
        null;
      const pricing = calculateRoomPrice(Number(r.base_price), activePromotion);
      const promotion = activePromotion
        ? {
            old_price_sum: activePromotion.old_price_sum,
            new_price_sum: activePromotion.new_price_sum,
            discount_percent: activePromotion.discount_percent,
            end_date: activePromotion.end_date,
          }
        : null;
      return {
        id: r.id,
        hotel_id: r.hotel_id,
        room_type_id: r.room_type_id,
        code: r.code,
        name: {
          uz: translation?.uz ?? roomTypeName.uz,
          ru: translation?.ru ?? roomTypeName.ru,
          en: translation?.en ?? roomTypeName.en,
        },
        base_occupancy: Number(r.base_occupancy),
        max_adults: Number(r.max_adults),
        max_children: Number(r.max_children),
        total_inventory: Number(r.total_inventory),
        base_price: Number(r.base_price),
        effective_price: pricing.effectivePrice,
        status: r.status,
        available: Number(r.total_inventory),
        promotion,
        images: Array.from(
          new Set([
            ...(roomMediaMap.get(String(r.id)) || []),
            ...(roomMediaMap.get(String(r.room_type_id)) || []),
          ]),
        ),
      };
    });
  }

  /**
   * `hotel_room_translations`ni berilgan xona id'lari uchun bitta batched
   * so'rovda yuklaydi (`loadListingData()`dagi bilan bir xil naqsh) —
   * xonalar soniga qarab N+1 so'rov bo'lmasligi uchun.
   */
  private async loadRoomNames(
    ids: string[],
  ): Promise<Map<string, Record<string, string | null>>> {
    const names = new Map<string, Record<string, string | null>>();
    if (ids.length === 0) {
      return names;
    }

    const rows = await this.pg.query<{
      room_id: string;
      language: string;
      name: string | null;
    }>(
      `SELECT room_id::text, language::text, name
       FROM hotel_room_translations
       WHERE room_id = ANY($1::uuid[])`,
      [ids],
    );

    for (const row of rows) {
      const name = names.get(row.room_id) ?? { uz: null, ru: null, en: null };
      if (row.language in name) name[row.language] = row.name;
      names.set(row.room_id, name);
    }
    return names;
  }

  async quote(id: string, body: Record<string, unknown>) {
    const rooms = await this.rooms(id);
    const roomId = String(body.room_id ?? rooms[0]?.id ?? '');
    const room = rooms.find((item) => item.id === roomId);

    if (!room) {
      throw new NotFoundException({
        code: 'ROOM_NOT_AVAILABLE',
        message: 'Xona mavjud emas',
      });
    }

    const checkIn = String(body.check_in ?? '');
    const checkOut = String(body.check_out ?? '');
    const nights = this.calculateNights(checkIn, checkOut);
    const roomsCount = Number(body.rooms ?? 1);
    const baseSubtotal = Number(room.base_price) * nights * roomsCount;
    const totalAmount = Number(room.effective_price) * nights * roomsCount;

    return {
      quote_id: `quote-${Date.now()}`,
      hotel_id: id,
      room,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      rooms: roomsCount,
      currency: 'UZS',
      subtotal: baseSubtotal,
      discount_amount: baseSubtotal - totalAmount,
      service_fee: 0,
      total_amount: totalAmount,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
  }

  async reviews(id: string) {
    return this.pg.query(
      `SELECT r.id::text, r.user_id::text, r.booking_id::text,
         r.target_type, r.target_id::text, r.rating::float8,
         r.cleanliness::float8, r.staff::float8, r.location::float8,
         r.value_for_money::float8, r.photos, r.body, r.status::text,
         r.reply_body, r.replied_at,
         r.created_at, r.updated_at, u.first_name, u.last_name
       FROM reviews r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.target_type = 'hotel' AND r.target_id = $1 AND r.status = 'published'
       ORDER BY r.created_at DESC`,
      [id],
    );
  }

  private async loadListingData(ids: string[]) {
    if (ids.length === 0) {
      return {
        names: new Map<string, Record<string, string | null>>(),
        descriptions: new Map<string, Record<string, string | null>>(),
        images: new Map<string, string[]>(),
        amenities: new Map<string, string[]>(),
      };
    }

    const [translations, media, amenities] = await Promise.all([
      this.pg.query<{
        hotel_id: string;
        language: string;
        name: string | null;
        description: string | null;
      }>(
        `SELECT hotel_id::text, language::text, name, description
         FROM hotel_translations
         WHERE hotel_id = ANY($1::uuid[])`,
        [ids],
      ),
      this.pg.query<{ hotel_id: string; url: string }>(
        `SELECT owner_id::text as hotel_id, url
         FROM media_files
         WHERE owner_type = 'hotel'
           AND owner_id = ANY($1::uuid[])
           AND deleted_at IS NULL
           AND url IS NOT NULL
         ORDER BY sort_order ASC, created_at ASC`,
        [ids],
      ),
      this.pg.query<{ hotel_id: string; code: string }>(
        `SELECT ha.hotel_id::text, a.code
         FROM hotel_amenities ha
         JOIN amenities a ON a.id = ha.amenity_id
         WHERE ha.hotel_id = ANY($1::uuid[])
         ORDER BY a.code ASC`,
        [ids],
      ),
    ]);

    const names = new Map<string, Record<string, string | null>>();
    const descriptions = new Map<string, Record<string, string | null>>();
    const images = new Map<string, string[]>();
    const amenityMap = new Map<string, string[]>();

    for (const row of translations) {
      const name = names.get(row.hotel_id) ?? { uz: null, ru: null, en: null };
      const description = descriptions.get(row.hotel_id) ?? {
        uz: null,
        ru: null,
        en: null,
      };
      if (row.language in name) name[row.language] = row.name;
      if (row.language in description)
        description[row.language] = row.description;
      names.set(row.hotel_id, name);
      descriptions.set(row.hotel_id, description);
    }
    for (const row of media) {
      const list = images.get(row.hotel_id) ?? [];
      list.push(row.url);
      images.set(row.hotel_id, list);
    }
    for (const row of amenities) {
      const list = amenityMap.get(row.hotel_id) ?? [];
      list.push(row.code);
      amenityMap.set(row.hotel_id, list);
    }

    return { names, descriptions, images, amenities: amenityMap };
  }

  async map(query: QueryLike) {
    const hotels = (await this.findAll(query)) as {
      items: Array<Record<string, unknown>>;
    };
    return hotels.items.map((hotel) => ({
      id: hotel['id'],
      slug: hotel['slug'],
      name: hotel['name'],
      latitude: hotel['latitude'],
      longitude: hotel['longitude'],
      rating_average: hotel['rating_average'],
      min_price: hotel['min_price'],
    }));
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const start = Date.parse(checkIn);
    const end = Date.parse(checkOut);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return 1;
    }

    return Math.max(1, Math.ceil((end - start) / 86_400_000));
  }
}

function localized(value: unknown): Record<string, string | null> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const source = value as Record<string, unknown>;
    return {
      uz: source.uz == null ? null : String(source.uz),
      ru: source.ru == null ? null : String(source.ru),
      en: source.en == null ? null : String(source.en),
    };
  }
  const text = value == null ? null : String(value);
  return { uz: text, ru: text, en: text };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function totalCount(rows: unknown[]): number {
  const firstRow = rows[0] as Record<string, unknown> | undefined;
  const total = Number(firstRow?.total_count ?? 0);
  return Number.isFinite(total) ? total : 0;
}

function hotelOrderBySql(sortBy: string, order: 'asc' | 'desc'): string {
  const direction = order === 'asc' ? 'ASC' : 'DESC';
  const column =
    {
      created_at: 'h.created_at',
      rating_average: 'h.rating_average',
      stars: 'h.stars',
      min_price: 'COALESCE(rp.min_price, 0)',
    }[sortBy] ?? 'h.rating_average';

  return `${column} ${direction} NULLS LAST, h.created_at DESC, h.id ASC`;
}

function cacheKey(query: QueryLike): string {
  return Object.keys(query)
    .sort()
    .map(
      (key) => `${key}=${encodeURIComponent(String(first(query[key]) ?? ''))}`,
    )
    .join('&');
}
