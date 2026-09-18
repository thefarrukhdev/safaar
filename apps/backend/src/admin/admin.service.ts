import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BookingStatus, Role } from '@safaar/types';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import type { RequestActor } from '../common/actor';
import { rolePermissions } from '../common/permissions';
import { resolveAccommodationCommissionRate } from '../common/finance';
import {
  limitOffsetSql,
  paginateArray,
  parsePagination,
  type QueryLike,
} from '../common/pagination';
import { randomToken } from '../auth/security';
import { authSessionStore } from '../auth/session-store';
import { AppCacheService } from '../infrastructure/cache.service';
import { SmsService } from '../infrastructure/sms.service';
import { JobQueueService } from '../infrastructure/job-queue.service';
import {
  PostgresService,
  type PostgresTransaction,
} from '../infrastructure/postgres.service';
import { EventsService } from '../realtime/events.service';

type DbRow = Record<string, unknown>;

const DEFAULT_ADMIN_SETTINGS: Record<string, Record<string, unknown>> = {
  general: {
    app_name: 'safaar',
    timezone: 'Asia/Tashkent',
    support_email: 'support@safaar.uz',
    maintenance_mode: false,
  },
  finance: {
    hotel_commission_rate: 15,
    bus_commission_rate: 10,
  },
  security: {
    admin_2fa_required: true,
  },
  booking: {
    hold_minutes: 15,
  },
  providers: {
    click: { enabled: true },
    payme: { enabled: true },
  },
};

function numberValue(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'hotel';
}

function cmsTypesForResource(resource: string): string[] {
  if (resource === 'banners') {
    return ['banner'];
  }
  if (resource === 'offers') {
    return ['offer', 'promo'];
  }
  if (resource === 'news') {
    return ['news'];
  }
  if (resource === 'pages') {
    return ['page'];
  }
  return [resource.replace(/s$/, '')];
}

function cmsSlugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function field(item: object, key: string): unknown {
  return (item as Record<string, unknown>)[key];
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function localizedObject(value: unknown): Record<string, string | null> {
  const source = objectValue(
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return { uz: value };
          }
        })()
      : value,
  );
  return {
    uz: source['uz'] == null ? null : String(source['uz']),
    ru: source['ru'] == null ? null : String(source['ru']),
    en: source['en'] == null ? null : String(source['en']),
  };
}

function localizedLabel(value: unknown, fallback: string): string {
  const localized = localizedObject(value);
  return localized.uz ?? localized.ru ?? localized.en ?? fallback;
}

const CMS_TEXT_KEYS = {
  title: ['title', 'name', 'heading', 'question'],
  body: ['body', 'content', 'description', 'answer'],
} as const;

const CMS_RESERVED_METADATA_KEYS = new Set([
  'id',
  'type',
  'resource',
  'slug',
  'title',
  'name',
  'heading',
  'question',
  'body',
  'content',
  'description',
  'answer',
  'status',
  'state',
  'metadata',
  'published_at',
  'publishedAt',
]);

function firstDefined(
  body: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    if (body[key] !== undefined) {
      return body[key];
    }
  }
  return undefined;
}

function normalizeCmsLocalizedField(
  body: Record<string, unknown>,
  keys: readonly string[],
  fallback = '',
): Record<string, string | null> {
  const localized = localizedObject(firstDefined(body, keys) ?? fallback);
  const next = { ...localized };

  for (const key of keys) {
    const uz = body[`${key}_uz`] ?? body[`${key}Uz`];
    const ru = body[`${key}_ru`] ?? body[`${key}Ru`];
    const en = body[`${key}_en`] ?? body[`${key}En`];
    if (uz !== undefined) next.uz = uz == null ? null : String(uz);
    if (ru !== undefined) next.ru = ru == null ? null : String(ru);
    if (en !== undefined) next.en = en == null ? null : String(en);
  }

  return {
    uz: next.uz?.trim() ? next.uz.trim() : null,
    ru: next.ru?.trim() ? next.ru.trim() : null,
    en: next.en?.trim() ? next.en.trim() : null,
  };
}

function normalizeCmsStatus(value: unknown, fallback = 'draft'): string {
  const status = String(value ?? fallback)
    .trim()
    .toLowerCase();
  if (
    status === 'draft' ||
    status === 'published' ||
    status === 'active' ||
    status === 'archived'
  ) {
    return status;
  }
  return fallback;
}

function isCmsLocalizedKey(key: string): boolean {
  return /^(title|name|heading|question|body|content|description|answer)(_?(uz|ru|en)|Uz|Ru|En)$/.test(
    key,
  );
}

function normalizeCmsMetadata(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const metadata = { ...objectValue(body.metadata) };
  for (const [key, value] of Object.entries(body)) {
    if (
      value !== undefined &&
      !CMS_RESERVED_METADATA_KEYS.has(key) &&
      !isCmsLocalizedKey(key)
    ) {
      metadata[key] = value;
    }
  }
  return metadata;
}

function normalizeCmsPayload(resource: string, body: Record<string, unknown>) {
  const type = cmsTypesForResource(resource)[0];
  const title = normalizeCmsLocalizedField(body, CMS_TEXT_KEYS.title);
  const titleText = localizedLabel(title, type);
  const slug = cmsSlugify(
    String(body.slug ?? titleText ?? `${type}-${Date.now()}`),
    `${type}-${Date.now()}`,
  );
  const content = normalizeCmsLocalizedField(body, CMS_TEXT_KEYS.body);
  const defaultStatus = type === 'page' ? 'published' : 'draft';
  const status = normalizeCmsStatus(body.status ?? body.state, defaultStatus);
  const rawPublishedAt = body.published_at ?? body.publishedAt;

  return {
    type,
    slug,
    title,
    body: content,
    status,
    metadata: normalizeCmsMetadata(body),
    publishedAt: rawPublishedAt ? String(rawPublishedAt) : null,
  };
}

function cmsOrderValue(metadata: Record<string, unknown>): number {
  return numberValue(metadata.order ?? metadata.sortOrder);
}

function cmsAdminDto(row: DbRow) {
  const metadata = objectValue(row['metadata']);
  const titleI18n = localizedObject(row['title_i18n'] ?? row['title']);
  const bodyI18n = localizedObject(row['body_i18n'] ?? row['body']);
  const slug = String(row['slug'] ?? '');
  const title = localizedLabel(titleI18n, slug || String(row['type'] ?? ''));
  const body = localizedLabel(bodyI18n, '');

  return {
    id: row['id'],
    type: row['type'],
    slug,
    url: slug ? `/${slug}` : '',
    title,
    title_i18n: titleI18n,
    body,
    body_i18n: bodyI18n,
    content: body,
    status: row['status'],
    metadata,
    image_url: metadata.image_url ?? metadata.imageUrl ?? '',
    link: metadata.link ?? '',
    order: cmsOrderValue(metadata),
    published_at: row['published_at'],
    created_at: row['created_at'],
    updated_at: row['updated_at'],
  };
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function localizedObjectFromRows(rows: DbRow[] | undefined) {
  const value: Record<string, string | null> = {
    uz: null,
    ru: null,
    en: null,
  };
  for (const row of rows ?? []) {
    const language = String(row['language']);
    if (language in value) {
      value[language] = row['name'] == null ? null : String(row['name']);
    }
  }
  return value;
}

function localizedDescriptionFromRows(rows: DbRow[] | undefined) {
  const value: Record<string, string | null> = {
    uz: null,
    ru: null,
    en: null,
  };
  for (const row of rows ?? []) {
    const language = String(row['language']);
    if (language in value) {
      value[language] =
        row['description'] == null ? null : String(row['description']);
    }
  }
  return value;
}

function minRoomPrice(
  roomTypes: Array<{ rooms: Array<{ base_price: number }> }>,
): number | null {
  const prices = roomTypes.flatMap((type) =>
    type.rooms
      .map((room) => room.base_price)
      .filter((price) => Number.isFinite(price) && price > 0),
  );
  return prices.length > 0 ? Math.min(...prices) : null;
}

function listingCompleteness(
  row: DbRow,
  media: Array<{ url: string }>,
  amenities: Array<{ code: string }>,
  roomSummary: { active_room_count: number },
) {
  const partnerType = String(row['partner_type'] ?? '').toLowerCase();
  const name = localizedObject(row['name']);
  const shortDescription = localizedObject(row['short_description']);
  const fullDescription = localizedObject(row['full_description']);
  const hasName = Object.values(name).some(
    (value) => (value ?? '').trim().length >= 3,
  );
  const hasShortDescription = Object.values(shortDescription).some(
    (value) => (value ?? '').trim().length >= 20,
  );
  const hasFullDescription = Object.values(fullDescription).some(
    (value) => (value ?? '').trim().length >= 100,
  );
  const hasCoordinates =
    nullableNumber(row['latitude']) !== null &&
    nullableNumber(row['longitude']) !== null;
  const sections: Record<string, boolean> = {
    general: hasName && hasShortDescription && hasFullDescription,
    location: Boolean(String(row['address'] ?? '').trim()) && hasCoordinates,
    media: media.length >= 3,
    amenities: amenities.length >= 3,
    rules: Boolean(
      row['rules_completed_at'] &&
      row['check_in_time'] &&
      row['check_out_time'],
    ),
  };
  if (partnerType !== 'restaurant') {
    sections.rooms = roomSummary.active_room_count > 0;
  }
  const completed = Object.values(sections).filter(Boolean).length;
  const missingFields = Object.entries(sections)
    .filter(([, complete]) => !complete)
    .map(([section]) => section);
  const isComplete = completed === Object.keys(sections).length;
  return {
    score: Math.round((completed / Object.keys(sections).length) * 100),
    is_complete: isComplete,
    is_publishable: isComplete,
    missing_fields: missingFields,
    sections,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  // 23503 = foreign_key_violation, 23001 = restrict_violation (explicit ON DELETE RESTRICT)
  return code === '23503' || code === '23001';
}

function partnerTypeFromHotel(row: DbRow): string {
  const directType = String(row['partner_type'] ?? '').toLowerCase();
  if (directType) return directType;
  return String(objectValue(row['partner'])['type'] ?? '').toLowerCase();
}

function normalizeSettingsGroup(group: string): string {
  const normalized = group.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,80}$/.test(normalized)) {
    throw new BadRequestException({
      code: 'INVALID_SETTINGS_GROUP',
      message: "Sozlamalar guruhi noto'g'ri",
    });
  }
  return normalized;
}

function adminActorUuid(actor: RequestActor | undefined): string {
  if (!actor || !isUuid(actor.id)) {
    throw new UnauthorizedException({
      code: 'AUTH_TOKEN_INVALID',
      message: 'Sessiya topilmadi yoki token yaroqsiz',
    });
  }
  return actor.id;
}

function normalizeUserStatus(
  value: unknown,
): 'active' | 'blocked' | 'deleted' | 'unverified' {
  const status = String(value ?? 'active').toLowerCase();
  if (
    status === 'active' ||
    status === 'blocked' ||
    status === 'deleted' ||
    status === 'unverified'
  ) {
    return status;
  }
  return 'active';
}

function normalizeSupportStatus(
  value: unknown,
): 'open' | 'in_progress' | 'closed' {
  const status = String(value ?? 'open').toLowerCase();
  if (status === 'closed' || status === 'in_progress') {
    return status;
  }
  return 'open';
}

function normalizeWithdrawalStatus(
  value: unknown,
): 'approved' | 'rejected' | 'paid' | 'requested' {
  const status = String(value ?? 'requested').toLowerCase();
  if (status === 'approved' || status === 'rejected' || status === 'paid') {
    return status;
  }
  return 'requested';
}

/**
 * Super Admin xizmati — admin.safaar.uz.
 * Platforma statistikasi, hamkor tasdiqlash, moliya hisobotlari.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly cache: AppCacheService,
    private readonly jobs: JobQueueService,
    private readonly postgres: PostgresService,
    private readonly events: EventsService,
    private readonly sms: SmsService,
  ) {}

  private async rows(sql: string, params: readonly unknown[] = []) {
    return this.postgres.query<DbRow>(sql, params);
  }

  private async audit(
    action: string,
    actor: RequestActor | undefined,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    await this.postgres.query(
      `insert into audit_logs (id, actor_type, actor_id, action, metadata)
       values ($1::uuid, $2, $3::uuid, $4, ($5)::jsonb)`,
      [
        randomUUID(),
        actor?.actorType ?? 'system',
        actor && isUuid(actor.id) ? actor.id : null,
        action,
        JSON.stringify(meta),
      ],
    );
  }

  /**
   * `audit()`ning "entity + old/new value" bilan kengaytirilgan shakli —
   * `audit_logs` jadvalida bu ustunlar (`entity_type`, `entity_id`,
   * `old_value`, `new_value`) ALLAQACHON bor edi (schema.prisma'ga qarang),
   * lekin `audit()` ularni HECH QACHON to'ldirmagan. 2026-09-14 SAFAAR
   * ADMIN vazifasi ("commission/availability/role o'zgarganida OLD va NEW
   * qiymat saqlansin") uchun qo'shildi — YANGI migratsiya SHART EMAS,
   * mavjud ustunlar shunchaki endi to'ldiriladi.
   */
  private async auditChange(
    action: string,
    actor: RequestActor | undefined,
    entityType: string,
    entityId: string | null,
    oldValue: unknown,
    newValue: unknown,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    await this.postgres.query(
      `insert into audit_logs
         (id, actor_type, actor_id, action, entity_type, entity_id, old_value, new_value, metadata)
       values ($1::uuid, $2, $3::uuid, $4, $5, $6::uuid, ($7)::jsonb, ($8)::jsonb, ($9)::jsonb)`,
      [
        randomUUID(),
        actor?.actorType ?? 'system',
        actor && isUuid(actor.id) ? actor.id : null,
        action,
        entityType,
        entityId && isUuid(entityId) ? entityId : null,
        JSON.stringify(oldValue ?? null),
        JSON.stringify(newValue ?? null),
        JSON.stringify(meta),
      ],
    );
  }

  private adminPagination(query: QueryLike = {}) {
    return parsePagination(query, 'admin', {
      defaultLimit: 50,
      allowedSortBy: [
        'created_at',
        'updated_at',
        'status',
        'total_amount',
        'amount',
        'rating_average',
      ],
    });
  }

  private limitClause(query: QueryLike = {}) {
    return limitOffsetSql(this.adminPagination(query));
  }

  private paginateAdmin<T extends object>(
    items: readonly T[],
    query: QueryLike = {},
  ) {
    return paginateArray(items, this.adminPagination(query), {
      created_at: (item) => field(item, 'created_at'),
      updated_at: (item) => field(item, 'updated_at'),
      status: (item) => field(item, 'status'),
      total_amount: (item) => field(item, 'total_amount'),
      amount: (item) => field(item, 'amount'),
      rating_average: (item) => field(item, 'rating_average'),
    });
  }

  private invalidateAdminCache() {
    void this.cache.delByPattern('admin:*');
  }

  private invalidatePublicHotelCache() {
    void this.cache.delByPattern('hotels:list:*');
    void this.cache.delByPattern('catalog:restaurants:*');
  }

  private invalidatePublicRestaurantCache() {
    void this.cache.delByPattern('catalog:restaurants:*');
  }

  private invalidatePublicBusCache() {
    void this.cache.delByPattern('bus-trips:list:*');
    // `catalog:transports` (GET /catalog/transports, the public Transport
    // page's data source) is a single fixed key, not a `bus-trips:*` one —
    // it was never cleared here, so approving/suspending a bus partner or
    // toggling a vehicle's status could take up to its 1h TTL to show on
    // the public site.
    void this.cache.del('catalog:transports');
  }

  private async uniqueHotelSlug(
    name: string,
    partnerId: string,
  ): Promise<string> {
    const base = `${slugify(name)}-${partnerId.replace(/-/g, '').slice(0, 8)}`;
    const rows = await this.rows(
      `select slug from hotels where slug = $1 limit 1`,
      [base],
    );

    if (!rows[0]) {
      return base;
    }

    return `${base}-${randomUUID().replace(/-/g, '').slice(0, 6)}`;
  }

  private async upsertHotelTranslations(
    hotelId: string,
    name: string,
    description: string,
  ): Promise<void> {
    await this.rows(
      `
        insert into hotel_translations
          (id, hotel_id, language, name, description, created_at, updated_at)
        values
          ($1::uuid, $2::uuid, 'uz', $3, $4, now(), now()),
          ($5::uuid, $2::uuid, 'ru', $3, $4, now(), now()),
          ($6::uuid, $2::uuid, 'en', $3, $4, now(), now())
        on conflict (hotel_id, language)
        do update set
          name = excluded.name,
          description = excluded.description,
          updated_at = now()
      `,
      [randomUUID(), hotelId, name, description, randomUUID(), randomUUID()],
    );
  }

  private async ensureApprovedPartnerHotel(partner: DbRow) {
    const type = String(partner.type ?? '');
    if (type !== 'hotel' && type !== 'mixed' && type !== 'restaurant') {
      return undefined;
    }

    const partnerId = String(partner.id ?? '');
    const cityId = String(partner.city_id ?? '');
    const name = String(partner.brand_name ?? partner.legal_name ?? '').trim();
    const address = String(partner.address ?? '').trim();
    const description = '';

    if (!name || !address) {
      throw new BadRequestException({
        code: 'PARTNER_LISTING_DATA_REQUIRED',
        message:
          'Hamkor arizasida obyekt nomi va manzil to‘liq bo‘lishi kerak.',
      });
    }

    if (!cityId) {
      throw new BadRequestException({
        code: 'PARTNER_CITY_REQUIRED',
        message:
          'Hamkor arizasida shahar topilmadi. Mehmonxonani user panelga chiqarish uchun shahar kerak.',
      });
    }

    const existing = await this.rows(
      `
        select id::text, slug
        from hotels
        where partner_organization_id = $1::uuid
          and deleted_at is null
        order by created_at asc
        limit 1
      `,
      [partnerId],
    );

    let hotel = existing[0];
    if (hotel) {
      const updated = await this.rows(
        `
          update hotels
          set status = case when $4 = 'restaurant' then status else 'published'::"HotelStatus" end,
              city_id = $2::uuid,
              address = $3,
              updated_at = now()
          where id = $1::uuid
          returning id::text, slug
        `,
        [hotel.id, cityId, address, type],
      );
      hotel = updated[0];
    } else {
      const slug = await this.uniqueHotelSlug(name, partnerId);
      const initialStatus = type === 'restaurant' ? 'draft' : 'published';
      const inserted = await this.rows(
        `
          insert into hotels
            (
              id,
              partner_organization_id,
              slug,
              city_id,
              address,
              stars,
              rating_average,
              reviews_count,
              status,
              featured,
              check_in_time,
              check_out_time,
              created_at,
              updated_at
            )
          values
            (
              $1::uuid,
              $2::uuid,
              $3,
              $4::uuid,
              $5,
              0,
              0,
              0,
              $6::"HotelStatus",
              false,
              null,
              null,
              now(),
              now()
            )
          returning id::text, slug
        `,
        [randomUUID(), partnerId, slug, cityId, address, initialStatus],
      );
      hotel = inserted[0];
    }

    if (!hotel) {
      return undefined;
    }

    await this.upsertHotelTranslations(String(hotel.id), name, description);
    if (type === 'restaurant') {
      this.invalidatePublicRestaurantCache();
    } else {
      this.invalidatePublicHotelCache();
    }
    return hotel;
  }

  private async ensureApprovedPartnerBusCompany(partner: DbRow) {
    const type = String(partner.type ?? '');
    if (type !== 'bus' && type !== 'mixed') {
      return undefined;
    }

    const partnerId = String(partner.id ?? '');
    const name = String(
      partner.brand_name ?? partner.legal_name ?? 'Avtobus kompaniyasi',
    ).trim();

    const existing = await this.rows(
      `
        select id::text
        from bus_companies
        where partner_organization_id = $1::uuid
        order by created_at asc
        limit 1
      `,
      [partnerId],
    );

    let company = existing[0];
    if (company) {
      const updated = await this.rows(
        `
          update bus_companies
          set name = $2,
              status = 'active',
              updated_at = now()
          where id = $1::uuid
          returning id::text, partner_organization_id::text, name, status,
                    rating_average::float8, reviews_count, created_at, updated_at
        `,
        [company.id, name],
      );
      company = updated[0];
    } else {
      const inserted = await this.rows(
        `
          insert into bus_companies
            (
              id,
              partner_organization_id,
              name,
              status,
              rating_average,
              reviews_count,
              created_at,
              updated_at
            )
          values
            ($1::uuid, $2::uuid, $3, 'active', 0, 0, now(), now())
          returning id::text, partner_organization_id::text, name, status,
                    rating_average::float8, reviews_count, created_at, updated_at
        `,
        [randomUUID(), partnerId, name],
      );
      company = inserted[0];
    }

    const starterTrip = company
      ? await this.ensureStarterBusTrip(company, partner)
      : undefined;

    this.invalidatePublicBusCache();
    return { ...company, starter_trip: starterTrip };
  }

  private async ensureStarterBusTrip(company: DbRow, partner: DbRow) {
    const companyId = String(company.id ?? '');
    const fromCityId = String(partner.city_id ?? '');

    if (!companyId || !fromCityId) {
      return undefined;
    }

    const existingTrips = await this.rows(
      `select id::text from trips where company_id = $1::uuid limit 1`,
      [companyId],
    );
    if (existingTrips[0]) {
      return existingTrips[0];
    }

    const destinationRows = await this.rows(
      `
        select id::text
        from cities
        where id <> $1::uuid
        order by
          case when slug in ('toshkent', 'tashkent') then 0 else 1 end,
          sort_order asc,
          created_at asc
        limit 1
      `,
      [fromCityId],
    );
    const toCityId = String(destinationRows[0]?.id ?? '');
    if (!toCityId) {
      return undefined;
    }

    const route = await this.ensureBusRoute(fromCityId, toCityId);
    const vehicle = await this.ensureBusVehicle(companyId);
    if (!route || !vehicle) {
      return undefined;
    }

    const tripId = randomUUID();
    const trips = await this.rows(
      `
        insert into trips
          (
            id,
            route_id,
            company_id,
            vehicle_id,
            from_city_id,
            to_city_id,
            departure_at,
            arrival_at,
            status,
            base_price,
            policy_snapshot,
            created_at,
            updated_at
          )
        values
          (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::uuid,
            $6::uuid,
            date_trunc('day', now() + interval '1 day') + interval '9 hours',
            date_trunc('day', now() + interval '1 day') + interval '13 hours',
            'scheduled',
            120000,
            $7::jsonb,
            now(),
            now()
          )
        returning id::text, route_id::text, company_id::text, vehicle_id::text,
                  from_city_id::text, to_city_id::text, departure_at, arrival_at,
                  status::text, base_price::float8, created_at, updated_at
      `,
      [
        tripId,
        route.id,
        companyId,
        vehicle.id,
        fromCityId,
        toCityId,
        JSON.stringify({ source: 'partner_approval_starter_trip' }),
      ],
    );

    const seatIds = Array.from({ length: 40 }, () => randomUUID());
    await this.rows(
      `
        insert into trip_seats (id, trip_id, seat_code, seat_class, price, status)
        select
          seat_id::uuid,
          $1::uuid,
          seat_number::text,
          'standard',
          120000,
          'available'
        from unnest($2::uuid[]) with ordinality as seats(seat_id, seat_number)
        on conflict (trip_id, seat_code) do nothing
      `,
      [tripId, seatIds],
    );

    return trips[0];
  }

  private async ensureBusRoute(fromCityId: string, toCityId: string) {
    const existing = await this.rows(
      `
        select id::text, from_city_id::text, to_city_id::text
        from routes
        where from_city_id = $1::uuid and to_city_id = $2::uuid
        limit 1
      `,
      [fromCityId, toCityId],
    );
    if (existing[0]) {
      return existing[0];
    }

    const inserted = await this.rows(
      `
        insert into routes
          (id, from_city_id, to_city_id, duration_minutes, created_at, updated_at)
        values
          ($1::uuid, $2::uuid, $3::uuid, 240, now(), now())
        returning id::text, from_city_id::text, to_city_id::text
      `,
      [randomUUID(), fromCityId, toCityId],
    );
    return inserted[0];
  }

  private async ensureBusVehicle(companyId: string) {
    const existing = await this.rows(
      `
        select id::text
        from vehicles
        where company_id = $1::uuid and status = 'active'
        order by created_at asc
        limit 1
      `,
      [companyId],
    );
    if (existing[0]) {
      return existing[0];
    }

    const inserted = await this.rows(
      `
        insert into vehicles
          (
            id,
            company_id,
            name,
            plate_number,
            seats_count,
            seat_layout,
            status,
            created_at,
            updated_at
          )
        values
          ($1::uuid, $2::uuid, 'Standart avtobus', null, 40, $3::jsonb, 'active', now(), now())
        returning id::text
      `,
      [
        randomUUID(),
        companyId,
        JSON.stringify({ rows: 10, columns: 4, aisleAfterColumn: 2 }),
      ],
    );
    return inserted[0];
  }

  private async syncPartnerPublicVisibility(
    partnerId: string,
    status: string,
  ): Promise<void> {
    const isPublic = status === 'approved';
    await this.rows(
      `
        update hotels
        set status = $2::"HotelStatus",
            updated_at = now()
        where partner_organization_id = $1::uuid
          and deleted_at is null
      `,
      [partnerId, isPublic ? 'published' : 'hidden'],
    );
    await this.rows(
      `
        update bus_companies
        set status = $2,
            updated_at = now()
        where partner_organization_id = $1::uuid
      `,
      [partnerId, isPublic ? 'active' : 'inactive'],
    );
    this.invalidatePublicHotelCache();
    this.invalidatePublicBusCache();
  }

  private dbBookingsSql(where = '') {
    return `
      select
        b.id::text,
        b.booking_number,
        b.user_id::text,
        b.partner_organization_id::text,
        b.type::text,
        b.confirmation_mode::text,
        b.payment_method::text,
        b.status::text,
        b.currency,
        b.subtotal::float8,
        b.discount_amount::float8,
        b.bonus_amount::float8,
        b.service_fee::float8,
        b.total_amount::float8,
        b.commission_amount::float8,
        b.partner_payable::float8,
        b.hotel_id::text,
        b.trip_id::text,
        b.partner_confirmation_deadline,
        b.expires_at,
        b.confirmed_at,
        b.cancelled_at,
        b.cancel_reason_text,
        b.policy_snapshot,
        b.price_snapshot,
        b.guest_name,
        b.guest_phone,
        b.guest_email,
        coalesce(nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), ''), b.guest_name, 'Mijoz') as customer_name,
        coalesce(u.phone, b.guest_phone, '—') as customer_phone,
        coalesce(u.email, b.guest_email, '') as customer_email,
        coalesce(ht.name, po.brand_name, '—') as hotel_name,
        h.address as hotel_address,
        po.type::text as partner_type,
        c.name as city,
        (
          coalesce(b.price_snapshot, '{}'::jsonb) ||
          jsonb_strip_nulls(
            jsonb_build_object(
              'hotel_id', b.hotel_id::text,
              'trip_id', b.trip_id::text,
              'name', coalesce(ht.name, po.brand_name, '—'),
              'check_in', coalesce(b.price_snapshot ->> 'checkIn', b.price_snapshot ->> 'check_in'),
              'check_out', coalesce(b.price_snapshot ->> 'checkOut', b.price_snapshot ->> 'check_out'),
              'room_type', coalesce(b.price_snapshot ->> 'roomType', b.price_snapshot ->> 'room_type'),
              'seatNumber', b.price_snapshot ->> 'seatNumber',
              'seats', case
                when b.price_snapshot ? 'seatNumber'
                  then jsonb_build_array(b.price_snapshot ->> 'seatNumber')
                else null
              end
            )
          )
        ) as item,
        b.price_snapshot ->> 'route' as route,
        b.price_snapshot ->> 'companyName' as company_name,
        b.created_at,
        b.updated_at,
        count(*) over()::int as total_count
      from bookings b
      left join users u on u.id = b.user_id
      left join partner_organizations po on po.id = b.partner_organization_id
      left join hotels h on h.id = b.hotel_id
      left join hotel_translations ht on ht.hotel_id = h.id and ht.language = 'uz'
      left join cities c on c.id = h.city_id
      ${where}
      order by b.created_at desc
    `;
  }

  async getOverview() {
    return this.cache.getOrSet('admin:dashboard:overview', 30, async () => {
      const [row] = await this.rows(`
        select
          (select count(*) from users where deleted_at is null)::int as total_users,
          (select count(*) from partner_organizations where status = 'approved')::int as active_partners,
          (select count(*) from bookings)::int as today_bookings,
          coalesce((select sum(amount) from payments where status = 'paid'), 0)::float8 as monthly_revenue
      `);

      return {
        totalUsers: numberValue(row?.['total_users'] ?? 0),
        activePartners: numberValue(row?.['active_partners'] ?? 0),
        todayBookings: numberValue(row?.['today_bookings'] ?? 0),
        monthlyRevenue: numberValue(row?.['monthly_revenue'] ?? 0),
      };
    });
  }

  chart(type: string) {
    return [{ date: new Date().toISOString().slice(0, 10), type, value: 0 }];
  }

  async activity() {
    return this.rows(`
      select id::text, actor_type, actor_id::text, action, entity_type, entity_id::text,
             old_value, new_value, metadata, ip_address, user_agent, request_id, created_at
      from audit_logs
      order by created_at desc
      limit 20
    `);
  }

  async users(query: QueryLike = {}) {
    return this.rows(`
      select
        u.id::text,
        u.phone,
        u.first_name,
        u.last_name,
        u.email,
        u.status::text,
        u.preferred_language::text,
        u.blocked_reason,
        u.phone_verified_at,
        u.last_login_at,
        coalesce(count(b.id), 0)::int as bookings_count,
        coalesce(sum(b.total_amount), 0)::float8 as total_spent,
        0::float8 as bonus_balance,
        u.created_at,
        u.updated_at
      from users u
      left join bookings b on b.user_id = u.id
      where u.deleted_at is null
      group by u.id
      order by u.created_at desc
      ${this.limitClause(query)}
    `);
  }

  async user(id: string) {
    if (!isUuid(id)) {
      throw new NotFoundException({
        code: 'USER_BLOCKED',
        message: 'User topilmadi',
      });
    }

    const rows = await this.rows(
      `
        select
          u.id::text,
          u.phone,
          u.first_name,
          u.last_name,
          u.email,
          u.status::text,
          u.preferred_language::text,
          u.blocked_reason,
          u.phone_verified_at,
          u.last_login_at,
          coalesce(count(b.id), 0)::int as bookings_count,
          coalesce(sum(b.total_amount), 0)::float8 as total_spent,
          0::float8 as bonus_balance,
          u.created_at,
          u.updated_at
        from users u
        left join bookings b on b.user_id = u.id
        where u.id = $1::uuid and u.deleted_at is null
        group by u.id
      `,
      [id],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'USER_BLOCKED',
        message: 'User topilmadi',
      });
    }
    return rows[0];
  }

  async userStatus(id: string, body: Record<string, unknown>) {
    const status = normalizeUserStatus(body.status);
    const rows = await this.rows(
      `
        update users
        set status = $2::"UserStatus",
            blocked_reason = case
              when $2 = 'blocked' then nullif($3, '')
              else blocked_reason
            end,
            deleted_at = case
              when $2 = 'deleted' then coalesce(deleted_at, now())
              else deleted_at
            end,
            updated_at = now()
        where id = $1::uuid
        returning
          id::text,
          phone,
          email,
          first_name,
          last_name,
          concat_ws(' ', first_name, last_name) as full_name,
          status::text,
          preferred_language,
          blocked_reason,
          last_login_at,
          created_at,
          updated_at
      `,
      [id, status, String(body.reason ?? '')],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'USER_BLOCKED',
        message: 'User topilmadi',
      });
    }
    this.invalidateAdminCache();
    return rows[0];
  }

  async userDelete(actor: RequestActor | undefined, id: string) {
    const rows = await this.rows(
      `
        update users
        set status = 'deleted'::"UserStatus",
            deleted_at = coalesce(deleted_at, now()),
            updated_at = now()
        where id = $1::uuid
        returning
          id::text,
          phone,
          email,
          first_name,
          last_name,
          concat_ws(' ', first_name, last_name) as full_name,
          status::text,
          preferred_language,
          blocked_reason,
          last_login_at,
          created_at,
          updated_at,
          deleted_at
      `,
      [id],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'USER_BLOCKED',
        message: 'User topilmadi',
      });
    }

    await this.audit('user.admin_delete', actor, { user_id: id });
    this.invalidateAdminCache();
    return rows[0];
  }

  async bonusAdjustment(
    id: string,
    body: Record<string, unknown>,
    actor?: RequestActor,
  ) {
    if (!isUuid(id)) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User topilmadi',
      });
    }
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException({
        code: 'BONUS_AMOUNT_INVALID',
        message: 'Bonus summasi noto‘g‘ri',
      });
    }
    const reason = String(body.reason ?? 'Admin bonus adjustment');
    const now = new Date().toISOString();

    const result = await this.postgres.transaction(async (transaction) => {
      const rows = await transaction.query<DbRow>(
        `update users
         set bonus_balance = bonus_balance + $1,
             updated_at = $2
         where id = $3::uuid and deleted_at is null
         returning id::text, bonus_balance::float8`,
        [amount, now, id],
      );
      const user = rows[0];
      if (!user) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: 'User topilmadi',
        });
      }

      await transaction.query(
        `insert into user_bonus_ledger (id, user_id, amount, reason, created_at)
         values ($1::uuid, $2::uuid, $3, $4, $5)`,
        [randomUUID(), id, amount, reason, now],
      );

      return {
        user_id: id,
        amount,
        balance: Number(user['bonus_balance'] ?? 0),
        reason,
      };
    });

    await this.audit('user.bonus_adjustment', actor, {
      user_id: id,
      amount,
      reason,
    });
    this.invalidateAdminCache();
    return result;
  }

  async userBookings(id: string, query: QueryLike = {}) {
    if (!isUuid(id)) {
      return this.paginateAdmin([], query);
    }

    return this.rows(
      `${this.dbBookingsSql('where b.user_id = $1::uuid')} ${this.limitClause(query)}`,
      [id],
    );
  }

  async userAudit(id: string, query: QueryLike = {}) {
    if (!isUuid(id)) {
      return this.paginateAdmin([], query);
    }

    return this.rows(
      `
        select id::text, actor_type, actor_id::text, action, entity_type, entity_id::text,
               old_value, new_value, metadata, ip_address, user_agent, request_id, created_at
        from audit_logs
        where actor_id = $1::uuid
        order by created_at desc
        ${this.limitClause(query)}
      `,
      [id],
    );
  }

  async userMessage(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    if (!isUuid(id)) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User topilmadi',
      });
    }

    const title = String(body.title ?? 'Admin xabari');
    const message = String(body.message ?? body.body ?? '');

    const rows = await this.rows(
      `
        insert into notifications (id, user_id, owner_type, owner_id, title, body)
        values ($1::uuid, $2::uuid, 'user', $2::uuid, $3, $4)
        returning
          id::text,
          user_id::text,
          owner_type,
          owner_id::text,
          title,
          body,
          read_at,
          created_at
      `,
      [randomUUID(), id, title, message],
    );

    const smsResult = await this.sendSmsToUser(id, message);

    await this.audit('user.admin_message', actor, {
      user_id: id,
      sms_sent: smsResult.sent,
    });
    this.events.notificationCreated(id, rows[0]);
    return { ...rows[0], sms_sent: smsResult.sent, sms_error: smsResult.error };
  }

  /**
   * Admin panelidagi "SMS yuborish" tugmasi avval faqat ilova ichidagi
   * notification yaratardi (SMS deb nomlangan bo'lsa ham hech qachon
   * telefon raqamiga haqiqiy matn yubormas edi). Endi shu yerda haqiqiy
   * SMS jo'natiladi; muvaffaqiyatsizlik butun amalni bekor qilmaydi —
   * chaqiruvchi `sms_sent`/`sms_error` orqali haqiqiy natijani ko'radi.
   */
  private async sendSmsToUser(
    userId: string,
    message: string,
  ): Promise<{ sent: boolean; error?: string }> {
    const [user] = await this.rows(
      `select phone from users where id = $1::uuid and deleted_at is null limit 1`,
      [userId],
    );
    const phone = user?.['phone'] ? String(user['phone']) : '';
    if (!phone) {
      return { sent: false, error: 'USER_HAS_NO_PHONE' };
    }

    try {
      const result = await this.sms.send({ phone, text: message });
      return { sent: result.accepted };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'SMS_SEND_FAILED',
      };
    }
  }

  async usersMessage(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const ids = Array.isArray(body.user_ids)
      ? body.user_ids.map(String)
      : Array.isArray(body.ids)
        ? body.ids.map(String)
        : [];
    const title = String(body.title ?? 'Admin xabari');
    const message = String(body.message ?? body.body ?? '');

    let targets: string[];
    if (ids.length) {
      targets = ids;
    } else {
      const userRows = await this.rows(
        'select id::text from users where deleted_at is null',
      );
      targets = userRows.map((r) => String(r['id']));
    }

    const sent: unknown[] = [];
    for (const userId of targets) {
      sent.push(
        await this.userMessage(actor, userId, { title, body: message }),
      );
    }

    return {
      sent: sent.length,
      notifications: sent,
    };
  }

  async exportJob(
    actor: RequestActor | undefined,
    type: string,
    format: 'csv' | 'xlsx' | 'pdf',
  ) {
    const currentActor = this.requireActor(actor);
    const now = new Date().toISOString();

    // Bir xil (admin, type, format) uchun parallel/takroriy so'rovlar
    // cheksiz "queued" duplikat qator yaratavermasligi uchun — DB'dagi
    // qisman UNIQUE indeks (faqat queued/processing statusiga) ON
    // CONFLICT orqali hurmat qilinadi.
    const rows = await this.rows(
      `insert into export_jobs (id, owner_type, owner_id, type, format, status, created_at, updated_at)
       values (gen_random_uuid(), 'admin', $1, $2, $3, 'queued', $4, $4)
       on conflict (owner_type, owner_id, type, format) where status in ('queued', 'processing')
       do nothing
       returning id::text, owner_type, owner_id::text, type, format, status, created_at, updated_at`,
      [currentActor.id, type, format, now],
    );

    if (rows.length === 0) {
      const [existing] = await this.rows(
        `select id::text, owner_type, owner_id::text, type, format, status, created_at, updated_at
         from export_jobs
         where owner_type = 'admin' and owner_id = $1 and type = $2 and format = $3
           and status in ('queued', 'processing')
         order by created_at desc limit 1`,
        [currentActor.id, type, format],
      );
      return existing;
    }

    const job = rows[0];
    await this.jobs.add(
      'export',
      { export_id: job['id'], type, format, owner_id: currentActor.id },
      { idempotencyKey: `export:${currentActor.id}:${type}:${format}` },
    );
    return job;
  }

  private requireActor(actor: RequestActor | undefined): RequestActor {
    if (!actor) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Sessiya topilmadi yoki token yaroqsiz',
      });
    }
    return actor;
  }

  async partners(query: QueryLike = {}) {
    return this.rows(`
      select
        po.id::text,
        po.type::text,
        po.legal_name,
        po.brand_name,
        po.contact_person,
        po.tax_id,
        po.phone,
        po.email,
        po.city_id::text,
        c.name ->> 'uz' as city,
        po.address,
        po.status::text,
        po.default_commission_rate::float8,
        po.approved_by::text,
        po.approved_at,
        po.rejection_reason,
        coalesce(count(b.id), 0)::int as bookings_count,
        coalesce(sum(b.total_amount), 0)::float8 as total_revenue,
        coalesce(max(h.rating_average)::float8, max(bc.rating_average)::float8, 0)::float8 as rating_average,
        po.created_at,
        po.updated_at
      from partner_organizations po
      left join cities c on c.id = po.city_id
      left join bookings b on b.partner_organization_id = po.id
      left join hotels h on h.partner_organization_id = po.id
      left join bus_companies bc on bc.partner_organization_id = po.id
      group by po.id, c.name
      order by po.created_at desc
      ${this.limitClause(query)}
    `);
  }

  async partnerRequests(query: QueryLike = {}) {
    return this.rows(`
      select
        po.id::text,
        po.type::text,
        po.legal_name,
        po.brand_name,
        po.contact_person,
        po.tax_id,
        po.phone,
        po.email,
        po.city_id::text,
        c.name ->> 'uz' as city,
        po.address,
        po.status::text,
        po.default_commission_rate::float8,
        po.rejection_reason,
        '[]'::jsonb as documents,
        po.created_at,
        po.updated_at
      from partner_organizations po
      left join cities c on c.id = po.city_id
      where po.status in (
        'submitted'::"PartnerStatus",
        'under_review'::"PartnerStatus",
        'more_information_required'::"PartnerStatus"
      )
      order by po.created_at desc
      ${this.limitClause(query)}
    `);
  }

  async partner(id: string) {
    const rows = await this.rows(
      `
        select
          po.id::text,
          po.type::text,
          po.legal_name,
          po.brand_name,
          po.contact_person,
          po.tax_id,
          po.phone,
          po.email,
          po.city_id::text,
          c.name ->> 'uz' as city,
          po.address,
          po.status::text,
          po.default_commission_rate::float8,
          po.approved_by::text,
          po.approved_at,
          po.rejection_reason,
          coalesce(count(b.id), 0)::int as bookings_count,
          coalesce(sum(b.total_amount), 0)::float8 as total_revenue,
          coalesce(max(h.rating_average)::float8, max(bc.rating_average)::float8, 0)::float8 as rating_average,
          po.created_at,
          po.updated_at
        from partner_organizations po
        left join cities c on c.id = po.city_id
        left join bookings b on b.partner_organization_id = po.id
        left join hotels h on h.partner_organization_id = po.id
        left join bus_companies bc on bc.partner_organization_id = po.id
        where po.id = $1::uuid
        group by po.id, c.name
      `,
      [id],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Partner topilmadi',
      });
    }
    return rows[0];
  }

  async partnerDecision(
    actor: RequestActor | undefined,
    id: string,
    status: 'approved' | 'rejected' | 'more_information_required',
    body: Record<string, unknown> = {},
  ) {
    const rows = await this.rows(
      `
        update partner_organizations
        set status = $2::"PartnerStatus",
            rejection_reason = case when $2 = 'rejected' then nullif($3, '') else rejection_reason end,
            approved_by = case when $2 = 'approved' then $4::uuid else approved_by end,
            approved_at = case when $2 = 'approved' then now() else approved_at end,
            updated_at = now()
        where id = $1::uuid
        returning
          id::text,
          type::text,
          legal_name,
          brand_name,
          city_id::text,
          address,
          status::text,
          rejection_reason,
          approved_by::text,
          approved_at,
          updated_at
      `,
      [id, status, String(body.reason ?? ''), adminActorUuid(actor)],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Partner topilmadi',
      });
    }

    await this.audit('partner.moderation', actor, { partner_id: id, status });
    this.invalidateAdminCache();
    this.events.partnerDashboardUpdated(id);
    this.events.adminDashboardUpdated();
    return rows[0];
  }

  async partnerStatus(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const requestedStatus = String(body.status ?? '');
    const newStatus =
      requestedStatus === 'active' ? 'approved' : requestedStatus;
    const rows = await this.rows(
      `
        update partner_organizations
        set status = $2::"PartnerStatus", updated_at = now()
        where id = $1::uuid
        returning
          id::text,
          type::text,
          legal_name,
          brand_name,
          city_id::text,
          address,
          status::text,
          updated_at
      `,
      [id, newStatus],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Partner topilmadi',
      });
    }

    if (newStatus === 'approved') {
      // Partner approval is intentionally separate from listing moderation.
      // It must not fabricate or publish a hotel/bus listing.
    } else {
      await this.syncPartnerPublicVisibility(id, newStatus);
    }
    await this.audit('partner.status', actor, {
      partner_id: id,
      status: newStatus,
    });
    this.invalidateAdminCache();
    this.events.partnerDashboardUpdated(id);
    this.events.adminDashboardUpdated();
    return rows[0];
  }

  async partnerDelete(actor: RequestActor | undefined, id: string) {
    if (!isUuid(id)) {
      throw new NotFoundException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Partner topilmadi',
      });
    }

    const existing = await this.rows(
      `select id::text, brand_name, legal_name from partner_organizations where id = $1::uuid`,
      [id],
    );
    if (!existing[0]) {
      throw new NotFoundException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Partner topilmadi',
      });
    }

    await this.rows(
      `
        delete from payment_events
        where payment_id in (
          select p.id
          from payments p
          join bookings b on b.id = p.booking_id
          where b.partner_organization_id = $1::uuid
        )
      `,
      [id],
    );
    await this.rows(
      `delete from payments where booking_id in (select id from bookings where partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from refunds where booking_id in (select id from bookings where partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from booking_messages where booking_id in (select id from bookings where partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from booking_status_history where booking_id in (select id from bookings where partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from partner_ledger_entries where organization_id = $1::uuid or booking_id in (select id from bookings where partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from bookings where partner_organization_id = $1::uuid`,
      [id],
    );

    await this.rows(
      `
        delete from favorites
        where (target_type = 'hotel' and target_id in (select id from hotels where partner_organization_id = $1::uuid))
           or (target_type = 'bus_company' and target_id in (select id from bus_companies where partner_organization_id = $1::uuid))
      `,
      [id],
    );
    await this.rows(
      `
        delete from reviews
        where (target_type = 'hotel' and target_id in (select id from hotels where partner_organization_id = $1::uuid))
           or (target_type = 'bus_company' and target_id in (select id from bus_companies where partner_organization_id = $1::uuid))
      `,
      [id],
    );
    await this.rows(
      `
        delete from notifications
        where (owner_type in ('partner', 'partner_organization') and owner_id = $1::uuid)
           or (owner_type = 'hotel' and owner_id in (select id from hotels where partner_organization_id = $1::uuid))
           or (owner_type = 'bus_company' and owner_id in (select id from bus_companies where partner_organization_id = $1::uuid))
      `,
      [id],
    );

    await this.rows(
      `
        delete from room_inventory
        where room_id in (
          select hr.id
          from hotel_rooms hr
          join hotels h on h.id = hr.hotel_id
          where h.partner_organization_id = $1::uuid
        )
      `,
      [id],
    );
    await this.rows(
      `
        delete from room_amenities
        where room_id in (
          select hr.id
          from hotel_rooms hr
          join hotels h on h.id = hr.hotel_id
          where h.partner_organization_id = $1::uuid
        )
      `,
      [id],
    );
    await this.rows(
      `
        delete from hotel_room_translations
        where room_id in (
          select hr.id
          from hotel_rooms hr
          join hotels h on h.id = hr.hotel_id
          where h.partner_organization_id = $1::uuid
        )
      `,
      [id],
    );
    await this.rows(
      `delete from hotel_rooms where hotel_id in (select id from hotels where partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from hotel_amenities where hotel_id in (select id from hotels where partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from hotel_translations where hotel_id in (select id from hotels where partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from media_files where owner_type = 'hotel' and owner_id in (select id from hotels where partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from hotels where partner_organization_id = $1::uuid`,
      [id],
    );

    await this.rows(
      `delete from trip_seats where trip_id in (select t.id from trips t join bus_companies bc on bc.id = t.company_id where bc.partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from trips where company_id in (select id from bus_companies where partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from vehicles where company_id in (select id from bus_companies where partner_organization_id = $1::uuid)`,
      [id],
    );
    await this.rows(
      `delete from bus_companies where partner_organization_id = $1::uuid`,
      [id],
    );

    await this.rows(
      `delete from withdrawal_requests where organization_id = $1::uuid`,
      [id],
    );
    await this.rows(
      `delete from partner_api_keys where organization_id = $1::uuid`,
      [id],
    );
    await this.rows(
      `delete from partner_webhook_endpoints where organization_id = $1::uuid`,
      [id],
    );
    await this.rows(
      `delete from partner_users where organization_id = $1::uuid`,
      [id],
    );

    const deleted = await this.rows(
      `delete from partner_organizations where id = $1::uuid returning id::text`,
      [id],
    );

    await this.audit('partner.delete', actor, {
      partner_id: id,
      brand_name: existing[0].brand_name,
      legal_name: existing[0].legal_name,
    });
    this.invalidateAdminCache();
    this.invalidatePublicHotelCache();
    this.invalidatePublicBusCache();
    return { id: deleted[0]?.id ?? id, deleted: true };
  }

  async partnerCommission(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const rawRate = body.rate ?? body.default_commission_rate;
    if (rawRate === undefined || rawRate === null || rawRate === '') {
      throw new BadRequestException({
        code: 'COMMISSION_RATE_REQUIRED',
        message: 'Komissiya foizi kiritilishi shart',
      });
    }
    const rate = Number(rawRate);
    // Pul xavfsizligi (2026-09-14 audit topilmasi): ilgari bu yerda
    // HECH QANDAY tasdiqlash yo'q edi — `Number('garbage')` = NaN,
    // manfiy yoki 100%dan katta qiymat ham to'g'ridan-to'g'ri DB'ga
    // yozilardi. `partner_organizations.default_commission_rate`
    // `Decimal(5,2)` — shu aniqlikka mos 2 xonagacha yaxlitlanadi.
    if (!Number.isFinite(rate)) {
      throw new BadRequestException({
        code: 'COMMISSION_RATE_INVALID',
        message: "Komissiya foizi haqiqiy son bo'lishi kerak",
      });
    }
    if (rate < 0) {
      throw new BadRequestException({
        code: 'COMMISSION_RATE_NEGATIVE',
        message: 'Komissiya foizi manfiy bo‘lishi mumkin emas',
      });
    }
    if (rate > 100) {
      throw new BadRequestException({
        code: 'COMMISSION_RATE_TOO_HIGH',
        message: 'Komissiya foizi 100% dan oshmasligi kerak',
      });
    }
    const normalizedRate = Math.round(rate * 100) / 100;

    const [existing] = await this.rows(
      `select id::text, default_commission_rate::float8
       from partner_organizations where id = $1::uuid`,
      [id],
    );
    if (!existing) {
      throw new NotFoundException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Partner topilmadi',
      });
    }

    const rows = await this.rows(
      `
        update partner_organizations
        set default_commission_rate = $2, updated_at = now()
        where id = $1::uuid
        returning
          id::text,
          type::text,
          legal_name,
          brand_name,
          default_commission_rate::float8,
          updated_at
      `,
      [id, normalizedRate],
    );

    await this.auditChange(
      'partner.commission',
      actor,
      'partner_organization',
      id,
      { default_commission_rate: existing.default_commission_rate },
      { default_commission_rate: normalizedRate },
    );
    this.invalidateAdminCache();
    return rows[0];
  }

  /**
   * "Effective commission" — hamkor darajasida BITTA raqam sifatida
   * KO'RSATISH XATO bo'lardi: Excel jadvali (`resolveAccommodationCommissionRate`)
   * har bir MEHMONXONA uchun hudud+tur+yulduzga qarab ALOHIDA stavka
   * beradi (bitta partner tashkilotida bir nechta, HAR XIL shaharda/
   * yulduzda mehmonxona bo'lishi mumkin). Shuning uchun bu yerda:
   *  - `default_commission_rate` — tashkilot darajasidagi qiymat, FAQAT
   *    Excel QAMRAB OLMAGAN turlar (masalan restaurant) uchun HAQIQIY
   *    qo'llaniladi (`hotel`/`hostel`/`guesthouse` uchun Excel HAR DOIM
   *    ustun — 2026-09-13 tasdiqlangan qoida, finance.ts'ga qarang).
   *  - `hotels` — HAR BIR mehmonxona uchun Excel'dan HAQIQIY qo'llanilgan
   *    stavka, aniq manba (`excel` yoki `partner_default`) bilan birga.
   * Bu — admin UI'da "Default/Automatic" holatini soxta yagona foiz
   * bilan emas, HAQIQIY manbaga ko'ra ko'rsatish imkonini beradi.
   */
  async partnerCommissionDetail(id: string) {
    const [partner] = await this.rows(
      `select id::text, type::text, default_commission_rate::float8
       from partner_organizations where id = $1::uuid`,
      [id],
    );
    if (!partner) {
      throw new NotFoundException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Partner topilmadi',
      });
    }

    const hotelRows = await this.postgres.query<{
      id: string;
      name: string;
      stars: number | null;
      city_slug: string | null;
      partner_type: string;
    }>(
      `select h.id::text, coalesce(ht.name, '') as name, h.stars, c.slug as city_slug,
              po.type::text as partner_type
       from hotels h
       join partner_organizations po on po.id = h.partner_organization_id
       left join cities c on c.id = h.city_id
       left join hotel_translations ht on ht.hotel_id = h.id and ht.language = 'uz'
       where h.partner_organization_id = $1::uuid and h.deleted_at is null`,
      [id],
    );

    const hotels = hotelRows.map((h) => {
      const resolved = resolveAccommodationCommissionRate({
        citySlug: h.city_slug,
        partnerOrganizationType: h.partner_type,
        stars: h.stars,
      });
      return {
        hotel_id: h.id,
        hotel_name: h.name,
        effective_rate_percent: resolved.matched
          ? resolved.ratePercent
          : Number(partner.default_commission_rate),
        source: resolved.matched ? 'excel' : 'partner_default',
      };
    });

    return {
      partner_id: partner.id,
      partner_type: partner.type,
      default_commission_rate: Number(partner.default_commission_rate),
      hotels,
    };
  }

  // ---------------------------------------------------------------------------
  // Admin availability blocking (2026-09-14 SAFAAR ADMIN — Part 2)
  //
  // ATAYLAB yangi jadval yaratilmadi: `room_inventory` (`roomId, date,
  // totalCount, heldCount, bookedCount, closed`) allaqachon MAVJUD edi va
  // hamkor tomonidan `blackoutDates()`/`updateInventory()` orqali
  // to'ldirilardi — lekin booking engine bu bayroqni HECH QACHON
  // tekshirmagan edi (real audit topilmasi, `bookings.service.ts` va
  // `partners.service.ts`dagi tuzatishga qarang). Admin availability
  // blokini ham AYNAN SHU jadval/ustun orqali amalga oshiramiz — bitta
  // haqiqat manbai, ikkita parallel mexanizm emas.
  // ---------------------------------------------------------------------------

  private async assertRoomExists(roomId: string): Promise<{
    id: string;
    hotel_id: string;
    total_inventory: number;
  }> {
    const [room] = await this.rows(
      `select id::text, hotel_id::text, total_inventory
       from hotel_rooms where id = $1::uuid`,
      [roomId],
    );
    if (!room) {
      throw new NotFoundException({
        code: 'ROOM_NOT_FOUND',
        message: 'Xona topilmadi',
      });
    }
    return room as { id: string; hotel_id: string; total_inventory: number };
  }

  private validateBlockRange(body: Record<string, unknown>): {
    startDate: string;
    endDate: string;
  } {
    const startDate = String(body.start_date ?? body.startDate ?? '');
    const endDate = String(body.end_date ?? body.endDate ?? '');
    const startMs = Date.parse(startDate);
    const endMs = Date.parse(endDate);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      throw new BadRequestException({
        code: 'AVAILABILITY_DATES_INVALID',
        message: "start_date/end_date noto'g'ri",
      });
    }
    if (endMs <= startMs) {
      throw new BadRequestException({
        code: 'AVAILABILITY_DATES_INVALID',
        message: 'end_date start_date dan keyin bo‘lishi kerak',
      });
    }
    // O'tgan sanaga bron yaratish taqiqlangani bilan BIR XIL konvensiya
    // (`bookings.service.ts::createVehicleRentalInternal`, kechagi va
    // undan oldingi sanalar rad etiladi, bugungi kun ruxsat etiladi) —
    // admin BUGUNGI/kelajakdagi sotuvni bloklaydi, o'tmishni EMAS.
    const todayIso = new Date().toISOString().slice(0, 10);
    if (startDate < todayIso) {
      throw new BadRequestException({
        code: 'AVAILABILITY_DATES_PAST',
        message: "O'tgan sanalarni bloklab bo'lmaydi",
      });
    }
    // Sog'lik tekshiruvi — tasodifiy juda katta oraliq (masalan yillar)
    // butun `room_inventory`ni to'ldirib yubormasligi uchun oqilona chegara.
    const rangeDays = Math.round((endMs - startMs) / 86_400_000);
    if (rangeDays > 366) {
      throw new BadRequestException({
        code: 'AVAILABILITY_RANGE_TOO_LONG',
        message: 'Oraliq 366 kundan oshmasligi kerak',
      });
    }
    return { startDate, endDate };
  }

  /**
   * `[from, to)` oralig'idagi har bir sana uchun: umumiy inventar, shu
   * kunga real bandlik (`bookings`dan hisoblangan, xuddi booking-yaratish
   * yo'lidagi FORMULA bilan bir xil), va admin/hamkor bloki (`closed`).
   * `sellable = blocked ? 0 : max(0, total_inventory - booked_count)`.
   */
  async roomAvailabilityCalendar(
    roomId: string,
    query: Record<string, unknown>,
  ) {
    const room = await this.assertRoomExists(roomId);
    const from = String(query.from ?? new Date().toISOString().slice(0, 10));
    const to = String(
      query.to ??
        new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    );
    if (
      !Number.isFinite(Date.parse(from)) ||
      !Number.isFinite(Date.parse(to))
    ) {
      throw new BadRequestException({
        code: 'AVAILABILITY_DATES_INVALID',
        message: "from/to noto'g'ri",
      });
    }

    const rows = await this.postgres.query<{
      date: string;
      total_count: number;
      blocked: boolean;
      booked_count: string | number;
    }>(
      `select gs.date::date::text as date,
              coalesce(ri.total_count, $4) as total_count,
              coalesce(ri.closed, false) as blocked,
              coalesce(bk.booked_count, 0) as booked_count
       from generate_series($2::date, $3::date - interval '1 day', interval '1 day') as gs(date)
       left join room_inventory ri on ri.room_id = $1::uuid and ri.date = gs.date
       left join lateral (
         select coalesce(sum(coalesce((price_snapshot->>'rooms')::int, 1)), 0) as booked_count
         from bookings
         where room_id = $1::uuid
           and status not in ('cancelled', 'expired', 'completed')
           and check_in <= gs.date and gs.date < check_out
       ) bk on true
       order by gs.date`,
      [roomId, from, to, room.total_inventory],
    );

    return {
      room_id: roomId,
      hotel_id: room.hotel_id,
      total_inventory: room.total_inventory,
      days: rows.map((r) => {
        const bookedCount = Number(r.booked_count);
        const sellable = r.blocked
          ? 0
          : Math.max(0, r.total_count - bookedCount);
        return {
          date: r.date,
          total_count: r.total_count,
          booked_count: bookedCount,
          blocked: r.blocked,
          status: r.blocked
            ? 'blocked'
            : bookedCount === 0
              ? 'available'
              : sellable > 0
                ? 'partially_occupied'
                : 'booked',
          sellable_count: sellable,
        };
      }),
    };
  }

  /**
   * `[start_date, end_date)` oraliqdagi HAR BIR sana uchun `room_inventory
   * .closed=true` qiladi (hamkorning `blackoutDates()`si bilan bir xil
   * mexanizm/ustun — mavjud, tasdiqlangan pattern). `reason` MAJBURIY
   * (task talabi) — DB'da alohida ustun sifatida SAQLANMAYDI (yangi
   * migratsiya SHART EMAS), buning o'rniga `audit_logs.metadata`ga
   * yoziladi (bu ustun ALLAQACHON mavjud, `auditChange()`ga qarang).
   */
  async roomAvailabilityBlock(
    actor: RequestActor | undefined,
    roomId: string,
    body: Record<string, unknown>,
  ) {
    const room = await this.assertRoomExists(roomId);
    const { startDate, endDate } = this.validateBlockRange(body);
    const reason = String(body.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException({
        code: 'AVAILABILITY_BLOCK_REASON_REQUIRED',
        message: 'Bloklash sababi kiritilishi shart',
      });
    }

    const rows = await this.postgres.query<{ date: string }>(
      `insert into room_inventory (id, room_id, date, total_count, closed)
       select gen_random_uuid(), $1::uuid, d.date, $4, true
       from generate_series($2::date, $3::date - interval '1 day', interval '1 day') as d(date)
       on conflict (room_id, date) do update
         set closed = true, version = room_inventory.version + 1
       returning date::text`,
      [roomId, startDate, endDate, room.total_inventory],
    );

    await this.auditChange(
      'availability.block',
      actor,
      'room_inventory',
      roomId,
      { blocked: false },
      { blocked: true, start_date: startDate, end_date: endDate },
      { reason, dates: rows.map((r) => r.date) },
    );
    this.invalidateAdminCache();
    return {
      room_id: roomId,
      start_date: startDate,
      end_date: endDate,
      reason,
      dates_blocked: rows.map((r) => r.date),
    };
  }

  /**
   * `[start_date, end_date)` oraliqni ochadi (`closed=false`). Faqat
   * ALLAQACHON mavjud `room_inventory` qatorlariga tegadi (`update ...
   * where`) — boshqa admin/hamkor tomonidan boshqa sabab bilan
   * bloklangan yoki UMUMAN bloklanmagan sanani "noto'g'ri buzish" xavfi
   * yo'q, chunki bu FAQAT `closed=true -> false` ONE-WAY amal — idempotent
   * (allaqachon ochiq sanaga qayta chaqirilsa 0 qator o'zgaradi, xato
   * bermaydi).
   */
  async roomAvailabilityUnblock(
    actor: RequestActor | undefined,
    roomId: string,
    body: Record<string, unknown>,
  ) {
    await this.assertRoomExists(roomId);
    const { startDate, endDate } = this.validateBlockRange(body);

    const rows = await this.postgres.query<{ date: string }>(
      `update room_inventory
       set closed = false, version = version + 1
       where room_id = $1::uuid
         and date >= $2::date and date < $3::date
         and closed = true
       returning date::text`,
      [roomId, startDate, endDate],
    );

    await this.auditChange(
      'availability.unblock',
      actor,
      'room_inventory',
      roomId,
      { blocked: true },
      { blocked: false, start_date: startDate, end_date: endDate },
      { dates: rows.map((r) => r.date) },
    );
    this.invalidateAdminCache();
    return {
      room_id: roomId,
      start_date: startDate,
      end_date: endDate,
      dates_unblocked: rows.map((r) => r.date),
    };
  }

  // ---------------------------------------------------------------------------
  // Admin reviews moderation (2026-09-14 SAFAAR ADMIN — gap closure Part 6)
  //
  // `reviews` table + customer-facing create/update/reply (`src/reviews/`)
  // already existed and are real, unchanged. What was missing was purely
  // the ADMIN side: no list, no permission-gated publish/hide. The
  // customer-facing `DELETE /reviews/:id` (soft-delete to status='hidden')
  // already allows any `actorType==='admin'`, but with no permission
  // granularity and no audit — these new endpoints give CONTENT_ADMIN a
  // properly scoped, audited moderation path without touching that
  // existing, working customer route.
  // ---------------------------------------------------------------------------

  async reviewsList(query: QueryLike = {}) {
    const status = this.optionalQueryString(query, 'status');
    const targetType = this.optionalQueryString(query, 'target_type');
    const minRating = query['min_rating'] ? Number(query['min_rating']) : null;
    const where: string[] = [];
    const params: unknown[] = [];
    if (status) {
      params.push(status);
      where.push(`r.status::text = $${params.length}`);
    }
    if (targetType) {
      params.push(targetType);
      where.push(`r.target_type = $${params.length}`);
    }
    if (minRating !== null && Number.isFinite(minRating)) {
      params.push(minRating);
      where.push(`r.rating >= $${params.length}`);
    }
    const whereSql = where.length ? `where ${where.join(' and ')}` : '';

    return this.rows(
      `
        select
          r.id::text,
          r.user_id::text,
          coalesce(nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), ''), u.phone, 'Mijoz') as user_name,
          r.booking_id::text,
          r.target_type,
          r.target_id::text,
          coalesce(ht.name, '—') as target_name,
          r.rating::float8,
          r.cleanliness::float8,
          r.staff::float8,
          r.location::float8,
          r.value_for_money::float8,
          r.photos,
          r.body,
          r.status::text,
          r.created_at,
          r.updated_at
        from reviews r
        left join users u on u.id = r.user_id
        left join hotels h on r.target_type = 'hotel' and h.id = r.target_id
        left join hotel_translations ht on ht.hotel_id = h.id and ht.language = 'uz'
        ${whereSql}
        order by r.created_at desc
        ${this.limitClause(query)}
      `,
      params,
    );
  }

  private optionalQueryString(query: QueryLike, key: string): string | null {
    const value = (query as Record<string, unknown>)[key];
    if (value === undefined || value === null || value === '') return null;
    return String(value);
  }

  async reviewModerate(
    actor: RequestActor | undefined,
    id: string,
    action: 'publish' | 'hide',
  ) {
    const [existing] = await this.rows(
      `select id::text, status::text from reviews where id = $1::uuid`,
      [id],
    );
    if (!existing) {
      throw new NotFoundException({
        code: 'REVIEW_NOT_FOUND',
        message: 'Sharh topilmadi',
      });
    }
    const nextStatus = action === 'publish' ? 'published' : 'hidden';
    const now = new Date().toISOString();
    const rows = await this.rows(
      `update reviews set status = $2, updated_at = $3
       where id = $1::uuid
       returning id::text, status::text, updated_at`,
      [id, nextStatus, now],
    );
    await this.auditChange(
      `review.${action}`,
      actor,
      'review',
      id,
      { status: existing.status },
      { status: nextStatus },
    );
    this.invalidateAdminCache();
    return rows[0];
  }

  async partnerLedger(id: string) {
    return this.rows(
      `
        select id::text, organization_id::text as partner_id, booking_id::text,
               type, amount::float8, currency, created_at
        from partner_ledger_entries
        where organization_id = $1::uuid
        order by created_at desc
      `,
      [id],
    );
  }

  async partnerAdjustment(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.partner(id);

    const rows = await this.rows(
      `insert into partner_ledger_entries (organization_id, type, amount, currency)
       values ($1::uuid, 'adjustment', $2, 'UZS')
       returning id::text, organization_id::text as partner_id, type, amount::float8, currency, created_at`,
      [id, Number(body.amount ?? 0)],
    );

    const entry = rows[0];
    await this.audit('partner.adjustment', actor, {
      partner_id: id,
      amount: body.amount,
      reason: String(body.reason ?? ''),
    });

    return {
      id: entry['id'],
      partner_id: entry['partner_id'],
      amount: entry['amount'],
      reason: String(body.reason ?? ''),
      created_at: entry['created_at'],
    };
  }

  /**
   * Booking/partner tafsilot sahifalaridagi "Ichki izoh" — avval faqat
   * frontend Zustand state'ida (sahifa yangilanganda yo'qolib qolardi,
   * boshqa adminlarga ko'rinmasdi). Endi haqiqiy DB'da saqlanadi.
   */
  private async internalNotes(
    entityType: 'booking' | 'partner_organization',
    entityId: string,
  ) {
    return this.rows(
      `select id::text, entity_type, entity_id::text, author_id::text, author_name, body, created_at
       from internal_notes
       where entity_type = $1 and entity_id = $2::uuid
       order by created_at desc`,
      [entityType, entityId],
    );
  }

  private async addInternalNote(
    actor: RequestActor | undefined,
    entityType: 'booking' | 'partner_organization',
    entityId: string,
    body: Record<string, unknown>,
  ) {
    const text = String(body.body ?? '').trim();
    if (!text) {
      throw new BadRequestException({
        code: 'NOTE_BODY_REQUIRED',
        message: "Izoh matni bo'sh bo'lishi mumkin emas",
      });
    }

    const authorRows = actor?.id
      ? await this.rows(
          `select full_name, email from admin_users where id = $1::uuid`,
          [actor.id],
        )
      : [];
    const authorName = authorRows[0]
      ? String(authorRows[0]['full_name'] ?? authorRows[0]['email'] ?? '')
      : null;

    const rows = await this.rows(
      `insert into internal_notes (id, entity_type, entity_id, author_id, author_name, body)
       values ($1, $2, $3::uuid, $4::uuid, $5, $6)
       returning id::text, entity_type, entity_id::text, author_id::text, author_name, body, created_at`,
      [randomUUID(), entityType, entityId, actor?.id ?? null, authorName, text],
    );

    return rows[0];
  }

  async bookingNotes(id: string) {
    return this.internalNotes('booking', id);
  }

  async addBookingNote(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    return this.addInternalNote(actor, 'booking', id, body);
  }

  async partnerNotes(id: string) {
    return this.internalNotes('partner_organization', id);
  }

  async addPartnerNote(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    return this.addInternalNote(actor, 'partner_organization', id, body);
  }

  async hotels(query: QueryLike = {}) {
    const rows = await this.hotelBaseRows(query);
    return this.hydrateAdminHotels(rows, false);
  }

  async hotel(id: string) {
    const rows = await this.hotelBaseRows({}, id);

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'HOTEL_NOT_FOUND',
        message: 'Hotel topilmadi',
      });
    }
    const [detail] = await this.hydrateAdminHotels(rows, true);
    return detail;
  }

  private async hotelBaseRows(query: QueryLike = {}, id?: string) {
    const where = ['h.deleted_at is null'];
    const params: unknown[] = [];
    if (id) {
      where.push('h.id = $1::uuid');
      params.push(id);
    }

    const limit = id ? '' : this.limitClause(query);
    return this.rows(
      `
        select
          h.id::text,
          h.partner_organization_id::text,
          h.slug,
          h.city_id::text,
          coalesce(jsonb_object_agg(ht.language, ht.name) filter (where ht.id is not null), '{}'::jsonb) as name,
          coalesce(jsonb_object_agg(ht.language, coalesce(ht.short_description, '')) filter (where ht.id is not null), '{}'::jsonb) as short_description,
          coalesce(jsonb_object_agg(ht.language, coalesce(ht.description, '')) filter (where ht.id is not null), '{}'::jsonb) as full_description,
          h.address,
          h.latitude::float8,
          h.longitude::float8,
          h.stars,
          h.rating_average::float8,
          h.reviews_count,
          h.status::text,
          h.featured,
          h.check_in_time,
          h.check_out_time,
          h.cancellation_policy_code,
          h.smoking_allowed,
          h.pets_allowed,
          h.children_allowed,
          h.extra_fees,
          h.rules_completed_at,
          h.submitted_at,
          h.reviewed_at,
          h.reviewed_by::text,
          h.rejection_reason,
          h.created_at,
          h.updated_at,
          po.id::text as partner_id,
          po.legal_name as partner_legal_name,
          po.brand_name as partner_brand_name,
          po.type::text as partner_type,
          po.status::text as partner_status,
          c.name as city_name,
          r.id::text as region_id,
          r.name as region_name
        from hotels h
        left join partner_organizations po on po.id = h.partner_organization_id
        left join cities c on c.id = h.city_id
        left join regions r on r.id = c.region_id
        left join hotel_translations ht on ht.hotel_id = h.id
        where ${where.join(' and ')}
        group by h.id, po.id, c.id, r.id
        order by h.updated_at desc
        ${limit}
      `,
      params,
    );
  }

  private async hydrateAdminHotels(rows: DbRow[], detail: boolean) {
    if (rows.length === 0) return [];
    const hotelIds = rows.map((row) => String(row['id']));
    const [mediaRows, amenityRows, roomRows] = await Promise.all([
      this.rows(
        `select id::text, owner_id::text as hotel_id, url, mime_type,
                caption, category, sort_order, is_cover
         from media_files
         where owner_type = 'hotel'
           and owner_id = any($1::uuid[])
           and deleted_at is null
           and url is not null
         order by sort_order asc, created_at asc`,
        [hotelIds],
      ),
      this.rows(
        `select ha.hotel_id::text, a.id::text, a.code, a.name
         from hotel_amenities ha
         join amenities a on a.id = ha.amenity_id
         where ha.hotel_id = any($1::uuid[])
         order by a.code asc`,
        [hotelIds],
      ),
      this.rows(
        `select hr.id::text, hr.hotel_id::text, hr.room_type_id::text,
                hr.code, hr.base_occupancy, hr.max_adults, hr.max_children,
                hr.total_inventory, hr.base_price::float8, hr.status::text,
                rt.code as room_type_code, rt.name as room_type_name
         from hotel_rooms hr
         join room_types rt on rt.id = hr.room_type_id
         where hr.hotel_id = any($1::uuid[])
         order by rt.code asc, hr.code asc`,
        [hotelIds],
      ),
    ]);

    const roomIds = roomRows.map((row) => String(row['id']));
    const [roomTranslationRows, roomAmenityRows] = roomIds.length
      ? await Promise.all([
          this.rows(
            `select room_id::text, language::text, name, description
             from hotel_room_translations
             where room_id = any($1::uuid[])`,
            [roomIds],
          ),
          this.rows(
            `select ra.room_id::text, a.id::text, a.code, a.name
             from room_amenities ra
             join amenities a on a.id = ra.amenity_id
             where ra.room_id = any($1::uuid[])`,
            [roomIds],
          ),
        ])
      : [[], []];

    const mediaByHotel = new Map<string, DbRow[]>();
    const amenitiesByHotel = new Map<string, DbRow[]>();
    const roomsByHotel = new Map<string, DbRow[]>();
    const roomTranslationsById = new Map<string, DbRow[]>();
    const roomAmenitiesById = new Map<string, DbRow[]>();

    for (const row of mediaRows) {
      const list = mediaByHotel.get(String(row['hotel_id'])) ?? [];
      list.push(row);
      mediaByHotel.set(String(row['hotel_id']), list);
    }
    for (const row of amenityRows) {
      const list = amenitiesByHotel.get(String(row['hotel_id'])) ?? [];
      list.push(row);
      amenitiesByHotel.set(String(row['hotel_id']), list);
    }
    for (const row of roomRows) {
      const list = roomsByHotel.get(String(row['hotel_id'])) ?? [];
      list.push(row);
      roomsByHotel.set(String(row['hotel_id']), list);
    }
    for (const row of roomTranslationRows) {
      const list = roomTranslationsById.get(String(row['room_id'])) ?? [];
      list.push(row);
      roomTranslationsById.set(String(row['room_id']), list);
    }
    for (const row of roomAmenityRows) {
      const list = roomAmenitiesById.get(String(row['room_id'])) ?? [];
      list.push(row);
      roomAmenitiesById.set(String(row['room_id']), list);
    }

    return rows.map((row) => {
      const hotelId = String(row['id']);
      const media = (mediaByHotel.get(hotelId) ?? []).map((item) => ({
        id: String(item['id']),
        url: String(item['url']),
        mime_type: String(item['mime_type'] ?? 'image/*'),
        caption: item['caption'] ? String(item['caption']) : null,
        category: item['category'] ? String(item['category']) : null,
        sort_order: Number(item['sort_order'] ?? 0),
        is_cover: Boolean(item['is_cover']),
      }));
      const amenities = (amenitiesByHotel.get(hotelId) ?? []).map((item) => ({
        id: String(item['id']),
        code: String(item['code']),
        name: localizedObject(item['name']),
      }));
      const roomTypes = this.groupAdminRoomTypes(
        roomsByHotel.get(hotelId) ?? [],
        roomTranslationsById,
        roomAmenitiesById,
      );
      const coverImage =
        media.find((item) => item.is_cover) ?? media[0] ?? null;
      const roomSummary = {
        room_type_count: roomTypes.length,
        active_room_count: roomTypes.reduce(
          (total, type) =>
            total +
            type.rooms.filter((room) => room.status === 'active').length,
          0,
        ),
        total_inventory: roomTypes.reduce(
          (total, type) =>
            total +
            type.rooms.reduce((sum, room) => sum + room.total_inventory, 0),
          0,
        ),
        min_price: minRoomPrice(roomTypes),
      };
      const completeness = listingCompleteness(
        row,
        media,
        amenities,
        roomSummary,
      );
      const base = {
        ...row,
        id: hotelId,
        status: String(row['status']),
        name: localizedObject(row['name']),
        short_description: localizedObject(row['short_description']),
        full_description: localizedObject(row['full_description']),
        description: localizedObject(row['full_description']),
        latitude: nullableNumber(row['latitude']),
        longitude: nullableNumber(row['longitude']),
        stars: Number(row['stars'] ?? 0),
        rating_average: Number(row['rating_average'] ?? 0),
        reviews_count: Number(row['reviews_count'] ?? 0),
        featured: Boolean(row['featured']),
        images: media.map((item) => item.url),
        image_ids: media.map((item) => item.id),
        amenities: amenities.map((item) => item.code),
        city: row['city_id']
          ? {
              id: String(row['city_id']),
              name: localizedObject(row['city_name']),
              region: row['region_id']
                ? {
                    id: String(row['region_id']),
                    name: localizedObject(row['region_name']),
                  }
                : null,
            }
          : null,
        partner: row['partner_id']
          ? {
              id: String(row['partner_id']),
              legal_name: String(row['partner_legal_name'] ?? ''),
              brand_name: String(row['partner_brand_name'] ?? ''),
              type: String(row['partner_type'] ?? ''),
              status: String(row['partner_status'] ?? ''),
            }
          : null,
        cover_image: coverImage,
        image_count: media.length,
        amenity_count: amenities.length,
        room_summary: roomSummary,
        completeness,
        created_at: row['created_at'],
        updated_at: row['updated_at'],
      };

      if (!detail) return base;
      return {
        ...base,
        media,
        amenities,
        rules: {
          check_in_time: row['check_in_time']
            ? String(row['check_in_time'])
            : null,
          check_out_time: row['check_out_time']
            ? String(row['check_out_time'])
            : null,
          cancellation_policy_code: String(
            row['cancellation_policy_code'] ?? 'MODERATE',
          ),
          smoking_allowed: Boolean(row['smoking_allowed']),
          pets_allowed: Boolean(row['pets_allowed']),
          children_allowed: Boolean(row['children_allowed']),
          extra_fees: jsonArray(row['extra_fees']),
          completed_at: row['rules_completed_at']
            ? String(row['rules_completed_at'])
            : null,
        },
        room_types: roomTypes,
        moderation: {
          submitted_at: row['submitted_at']
            ? String(row['submitted_at'])
            : null,
          reviewed_at: row['reviewed_at'] ? String(row['reviewed_at']) : null,
          reviewed_by: row['reviewed_by'] ? String(row['reviewed_by']) : null,
          rejection_reason: row['rejection_reason']
            ? String(row['rejection_reason'])
            : null,
        },
      };
    });
  }

  private groupAdminRoomTypes(
    rows: DbRow[],
    translationsById: Map<string, DbRow[]>,
    amenitiesById: Map<string, DbRow[]>,
  ) {
    const grouped = new Map<
      string,
      {
        id: string;
        code: string;
        name: Record<string, string | null>;
        rooms: DbRow[];
      }
    >();
    for (const row of rows) {
      const id = String(row['room_type_id']);
      const group = grouped.get(id) ?? {
        id,
        code: String(row['room_type_code'] ?? ''),
        name: localizedObject(row['room_type_name']),
        rooms: [],
      };
      group.rooms.push(row);
      grouped.set(id, group);
    }

    return [...grouped.values()].map((type) => ({
      id: type.id,
      code: type.code,
      name: type.name,
      rooms: type.rooms.map((row) => ({
        id: String(row['id']),
        code: String(row['code']),
        name: localizedObjectFromRows(translationsById.get(String(row['id']))),
        description: localizedDescriptionFromRows(
          translationsById.get(String(row['id'])),
        ),
        base_occupancy: Number(row['base_occupancy'] ?? 0),
        max_adults: Number(row['max_adults'] ?? 0),
        max_children: Number(row['max_children'] ?? 0),
        total_inventory: Number(row['total_inventory'] ?? 0),
        base_price: Number(row['base_price'] ?? 0),
        status: String(row['status'] ?? 'active'),
        amenities: (amenitiesById.get(String(row['id'])) ?? []).map((item) => ({
          id: String(item['id']),
          code: String(item['code']),
          name: localizedObject(item['name']),
        })),
      })),
    }));
  }

  async hotelStatus(
    actor: RequestActor | undefined,
    id: string,
    status: 'published' | 'hidden' | 'rejected',
    reason = '',
  ) {
    const current = await this.hotel(id);
    if (status === 'published' && !current.completeness?.is_publishable) {
      throw new BadRequestException({
        code: 'HOTEL_INCOMPLETE',
        message: "E'lon to'liq to'ldirilmagan",
        fields: current.completeness?.missing_fields ?? [],
      });
    }
    if (status === 'rejected' && !reason.trim()) {
      throw new BadRequestException({
        code: 'REJECTION_REASON_REQUIRED',
        message: 'Rad etish sababi kerak',
      });
    }
    const now = new Date().toISOString();
    const normalizedReason = reason.trim();
    const hotelName = localizedLabel(
      current.name,
      String(field(current, 'slug') ?? 'Mehmonxona'),
    );
    const moderation = await this.postgres.transaction(async (transaction) => {
      const lockedRows = await transaction.query<DbRow>(
        `select id::text, partner_organization_id::text, city_id::text,
                status::text, submitted_by::text, next_draft_prepared_at
         from hotels
         where id = $1::uuid and deleted_at is null
         for update`,
        [id],
      );
      const locked = lockedRows[0];
      if (!locked) {
        throw new NotFoundException({
          code: 'HOTEL_NOT_FOUND',
          message: 'Hotel topilmadi',
        });
      }
      const previousStatus = String(locked['status']);
      const moderationRows = await transaction.query<DbRow>(
        `update hotels
         set status = $2::"HotelStatus",
             rejection_reason = case when $2::"HotelStatus" = 'rejected'::"HotelStatus" then nullif($3, '') else null end,
             reviewed_at = $5,
             reviewed_by = $4::uuid,
             updated_at = $5
         where id = $1::uuid and deleted_at is null
         returning id::text, partner_organization_id::text, slug, status::text, updated_at`,
        [id, status, normalizedReason, adminActorUuid(actor), now],
      );

      if (!moderationRows[0]) {
        throw new NotFoundException({
          code: 'HOTEL_NOT_FOUND',
          message: 'Hotel topilmadi',
        });
      }

      let draftId: string | null = null;
      if (status === 'published' || status === 'rejected') {
        if (!locked['next_draft_prepared_at']) {
          await transaction.query(
            `update hotels
             set next_draft_prepared_at = $2
             where id = $1::uuid and next_draft_prepared_at is null`,
            [id, now],
          );
          draftId = await this.prepareNextHotelDraft(transaction, locked, now);
        } else {
          const drafts = await transaction.query<{ id: string }>(
            `select id::text
             from hotels
             where partner_organization_id = $1::uuid
               and status = 'draft'
               and deleted_at is null
             order by updated_at desc
             limit 1`,
            [String(locked['partner_organization_id'])],
          );
          draftId = drafts[0]?.id ?? null;
        }
      }

      let notification: DbRow | null = null;
      let notificationRecipientId: string | null = null;
      if (
        (status === 'published' || status === 'rejected') &&
        previousStatus !== status
      ) {
        notificationRecipientId = String(
          locked['submitted_by'] ?? locked['partner_organization_id'],
        );
        const title =
          status === 'published'
            ? "E'loningiz muvaffaqiyatli tasdiqlandi"
            : "E'loningiz rad etildi";
        const body =
          status === 'published'
            ? `"${hotelName}" e'loni muvaffaqiyatli tasdiqlandi.`
            : `"${hotelName}" e'loni rad etildi. Sabab: ${normalizedReason}`;
        const notifications = await transaction.query<DbRow>(
          `insert into notifications
             (id, user_id, owner_type, owner_id, title, body, type,
              related_entity_type, related_entity_id, created_at)
           values ($1::uuid, null, 'partner', $2::uuid, $3, $4,
                   'listing_moderation', 'hotel', $6::uuid, $5)
           returning id::text, user_id::text, owner_type, owner_id::text,
                     title, body, type, related_entity_type,
                     related_entity_id::text, read_at, created_at`,
          [randomUUID(), notificationRecipientId, title, body, now, id],
        );
        notification = notifications[0] ?? null;
      }

      return {
        rows: moderationRows,
        previousStatus,
        draftId,
        notification,
        notificationRecipientId,
      };
    });
    const rows = moderation.rows;
    this.invalidateAdminCache();
    this.invalidatePublicHotelCache();
    if (partnerTypeFromHotel(current) === 'restaurant') {
      this.invalidatePublicRestaurantCache();
    }
    const updated = await this.hotel(id);
    if (moderation.notification && moderation.notificationRecipientId) {
      this.events.notificationCreated(
        moderation.notificationRecipientId,
        moderation.notification,
      );
    }
    this.events.hotelListingChanged({
      hotelId: id,
      partnerId: String(rows[0]['partner_organization_id']),
      status,
      previousStatus: moderation.previousStatus,
      rejectionReason: status === 'rejected' ? normalizedReason : null,
      notificationId: moderation.notification
        ? String(moderation.notification['id'])
        : null,
      draftId: moderation.draftId,
      action: 'moderated',
      sections: ['status'],
    });
    this.events.partnerDashboardUpdated(
      String(rows[0]['partner_organization_id']),
    );
    return updated;
  }

  private async prepareNextHotelDraft(
    transaction: PostgresTransaction,
    source: DbRow,
    now: string,
  ): Promise<string> {
    const sourceId = String(source['id']);
    const organizationId = String(source['partner_organization_id']);
    const cityId = String(source['city_id']);
    const drafts = await transaction.query<DbRow>(
      `select h.id::text,
              exists(select 1 from bookings b where b.hotel_id = h.id) as has_bookings
       from hotels h
       where h.partner_organization_id = $1::uuid
         and h.id <> $2::uuid
         and h.status = 'draft'
         and h.deleted_at is null
       order by h.updated_at desc
       limit 1
       for update of h`,
      [organizationId, sourceId],
    );
    const reusableDraft = drafts[0];

    if (reusableDraft && reusableDraft['has_bookings'] !== true) {
      const draftId = String(reusableDraft['id']);
      await transaction.query(
        `delete from hotel_amenities where hotel_id = $1::uuid`,
        [draftId],
      );
      await transaction.query(
        `update media_files
         set deleted_at = $2, is_cover = false
         where owner_type = 'hotel'
           and owner_id = $1::uuid
           and deleted_at is null`,
        [draftId, now],
      );
      await transaction.query(
        `delete from hotel_rooms where hotel_id = $1::uuid`,
        [draftId],
      );
      await transaction.query(
        `update hotels
         set city_id = $2::uuid,
             address = '', latitude = null, longitude = null, stars = 0,
             rating_average = 0, reviews_count = 0, status = 'draft',
             featured = false, check_in_time = null, check_out_time = null,
             cancellation_policy_id = null,
             cancellation_policy_code = 'MODERATE',
             smoking_allowed = false, pets_allowed = false,
             children_allowed = true, extra_fees = '[]'::jsonb,
             rules_completed_at = null, submitted_at = null,
             submitted_by = null,
             reviewed_at = null, reviewed_by = null,
             rejection_reason = null, next_draft_prepared_at = null,
             updated_at = $3
         where id = $1::uuid`,
        [draftId, cityId, now],
      );
      await this.resetHotelDraftTranslations(transaction, draftId, now);
      return draftId;
    }

    const draftId = randomUUID();
    const slug = `draft-${organizationId.slice(0, 8)}-${draftId.slice(0, 8)}`;
    await transaction.query(
      `insert into hotels
         (id, partner_organization_id, slug, city_id, address,
          latitude, longitude, stars, rating_average, reviews_count,
          status, check_in_time, check_out_time, created_at, updated_at)
       values
         ($1::uuid, $2::uuid, $3, $4::uuid, '',
          null, null, 0, 0, 0,
          'draft', null, null, $5, $5)`,
      [draftId, organizationId, slug, cityId, now],
    );
    await this.resetHotelDraftTranslations(transaction, draftId, now);
    return draftId;
  }

  private async resetHotelDraftTranslations(
    transaction: PostgresTransaction,
    draftId: string,
    now: string,
  ): Promise<void> {
    await transaction.query(
      `insert into hotel_translations
         (hotel_id, language, name, short_description, description, created_at, updated_at)
       values
         ($1::uuid, 'uz', '', '', '', $2, $2),
         ($1::uuid, 'ru', '', '', '', $2, $2),
         ($1::uuid, 'en', '', '', '', $2, $2)
       on conflict (hotel_id, language) do update
       set name = '', short_description = '', description = '', updated_at = $2`,
      [draftId, now],
    );
  }

  async trips(query: QueryLike = {}) {
    return this.rows(`
      select
        t.id::text,
        t.route_id::text,
        t.company_id::text,
        t.vehicle_id::text,
        t.from_city_id::text,
        t.to_city_id::text,
        t.departure_at,
        t.arrival_at,
        v.name as vehicle_name,
        t.status::text,
        t.base_price::float8,
        t.policy_snapshot,
        t.created_at,
        t.updated_at
      from trips t
      left join vehicles v on v.id = t.vehicle_id
      order by t.departure_at desc
      ${this.limitClause(query)}
    `);
  }

  async trip(id: string) {
    const rows = await this.rows(
      `
        select
          t.id::text,
          t.route_id::text,
          t.company_id::text,
          t.vehicle_id::text,
          t.from_city_id::text,
          t.to_city_id::text,
          t.departure_at,
          t.arrival_at,
          v.name as vehicle_name,
          t.status::text,
          t.base_price::float8,
          t.policy_snapshot,
          t.created_at,
          t.updated_at
        from trips t
        left join vehicles v on v.id = t.vehicle_id
        where t.id = $1::uuid
      `,
      [id],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'TRIP_NOT_FOUND',
        message: 'Reys topilmadi',
      });
    }
    return rows[0];
  }

  async tripStatus(id: string, status: 'cancelled') {
    const rows = await this.rows(
      `update trips
       set status = $2, updated_at = now()
       where id = $1::uuid
       returning id::text, company_id::text, from_city_id::text, to_city_id::text,
                 status::text, departure_at, arrival_at, updated_at`,
      [id, status],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'TRIP_NOT_FOUND',
        message: 'Reys topilmadi',
      });
    }
    this.invalidateAdminCache();
    return rows[0];
  }

  async busCompanies() {
    return this.rows(`
      select id::text, partner_organization_id::text, name, status,
             rating_average::float8, reviews_count, created_at, updated_at
      from bus_companies
      order by created_at desc
    `);
  }

  async busCompanyStatus(id: string, body: Record<string, unknown>) {
    const newStatus = String(body.status ?? 'active');
    const rows = await this.rows(
      `update bus_companies
       set status = $2, updated_at = now()
       where id = $1::uuid
       returning id::text, name, status, updated_at`,
      [id, newStatus],
    );
    return (
      rows[0] ?? { id, status: newStatus, updated_at: new Date().toISOString() }
    );
  }

  async bookings(query: QueryLike = {}) {
    const pagination = this.adminPagination(query);
    const rows = await this.rows(
      `${this.dbBookingsSql()} ${this.limitClause(query)}`,
    );
    const total = Number(rows[0]?.['total_count'] ?? 0);
    const items = rows.map(({ total_count: _totalCount, ...row }) => {
      void _totalCount;
      return row;
    });

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      total_pages: Math.max(1, Math.ceil(total / pagination.limit)),
    };
  }

  async booking(id: string) {
    const rows = await this.rows(this.dbBookingsSql('where b.id = $1::uuid'), [
      id,
    ]);

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'BOOKING_EXPIRED',
        message: 'Bron topilmadi',
      });
    }
    return rows[0];
  }

  async bookingCancel(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const rows = await this.rows(
      `update bookings
       set status = $2, cancelled_at = now(), cancel_reason_text = $3, updated_at = now()
       where id = $1::uuid
       returning id::text, booking_number, user_id::text, status::text, total_amount::float8,
                 cancelled_at, cancel_reason_text, created_at, updated_at`,
      [id, BookingStatus.CANCELLED, String(body.reason ?? 'Admin cancel')],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'BOOKING_EXPIRED',
        message: 'Bron topilmadi',
      });
    }

    await this.audit('booking.admin_cancel', actor, { booking_id: id });
    this.invalidateAdminCache();
    this.events.bookingStatusChanged(rows[0]);
    this.events.adminDashboardUpdated();
    return rows[0];
  }

  async bookingStatusAction(id: string, body: Record<string, unknown>) {
    const action = String(body.action ?? '');
    let newStatus: string | null = null;
    if (action === 'confirm') {
      newStatus = BookingStatus.CONFIRMED;
    } else if (action === 'complete') {
      newStatus = BookingStatus.COMPLETED;
    }

    if (!newStatus) {
      return this.booking(id);
    }

    const rows = await this.rows(
      `update bookings
       set status = $2, updated_at = now()
       where id = $1::uuid
       returning id::text, booking_number, user_id::text, status::text, total_amount::float8,
                 created_at, updated_at`,
      [id, newStatus],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'BOOKING_EXPIRED',
        message: 'Bron topilmadi',
      });
    }
    this.invalidateAdminCache();
    this.events.bookingStatusChanged(rows[0]);
    this.events.adminDashboardUpdated();
    return rows[0];
  }

  async payments(query: QueryLike = {}) {
    return this.rows(`
      select id::text, booking_id::text, provider::text, status::text,
             amount::float8, currency, payment_url, provider_reference,
             idempotency_key, created_at, updated_at
      from payments
      order by created_at desc
      ${this.limitClause(query)}
    `);
  }

  async payment(id: string) {
    const rows = await this.rows(
      `
        select id::text, booking_id::text, provider::text, status::text,
               amount::float8, currency, payment_url, provider_reference,
               idempotency_key, created_at, updated_at
        from payments
        where id = $1::uuid
      `,
      [id],
    );
    return rows[0] ?? { id, status: 'not_found' };
  }

  paymentReconcile(id: string) {
    return {
      payment_id: id,
      reconciled: true,
      checked_at: new Date().toISOString(),
    };
  }

  async refunds(query: QueryLike = {}) {
    return this.rows(`
      select id::text, booking_id::text, user_id::text, status::text,
             requested_amount::float8, approved_amount::float8,
             currency, reason, created_at, updated_at
      from refunds
      order by created_at desc
      ${this.limitClause(query)}
    `);
  }

  async refund(id: string) {
    const rows = await this.rows(
      `
        select id::text, booking_id::text, user_id::text, status::text,
               requested_amount::float8, approved_amount::float8,
               currency, reason, created_at, updated_at
        from refunds
        where id = $1::uuid
      `,
      [id],
    );
    return rows[0] ?? { id };
  }

  /**
   * Refund'ni tasdiqlash — avval bu shunchaki `refunds.status`ni
   * o'zgartirardi, boshqa hech narsaga (to'lov, bron, hamkor balansi)
   * ta'sir qilmasdi. Endi haqiqiy moliyaviy holatga o'tkazadi:
   *  - to'lov `refunded` deb belgilanadi (real tashqi provayder integratsiyasi
   *    yo'q — hech qanday tashqi so'rov yuborilmaydi, faqat ICHKI holat rost
   *    aks ettiriladi: "biz mijozga qaytarishni qayd etdik");
   *  - bron, agar allaqachon yakunlangan/bekor qilinmagan bo'lsa, bekor
   *    qilinadi;
   *  - hamkor ledgeriga manfiy yozuv qo'shiladi — shu bron bo'yicha
   *    avval kredit qilingan ulush qaytarib olinadi, aks holda xuddi shu
   *    pul mijozga QAYTARILGAN va hamkor tomonidan YECHISH mumkin bo'lib
   *    qolardi (ikki marta sarflash).
   * Faqat `requested`/`processing` holatidan tasdiqlash mumkin — allaqachon
   * tasdiqlangan/rad etilgan refund'ni qayta tasdiqlab bo'lmaydi.
   *
   * IDEMPOTENTLIK (2026-09-12 tuzatildi): bitta bookingga bir nechta
   * MUSTAQIL `refunds` qatori mavjud bo'lishi mumkin (foydalanuvchi so'rovi,
   * hamkor rad etishi, tizim avto-refundi — har biri boshqa service'dan,
   * bir-biridan bexabar yaratiladi, `refunds.id` bo'yicha alohida-alohida).
   * Ilgari, agar admin shu bookingning IKKINCHI (allaqachon boshqa qator
   * orqali qaytarilgan) so'rovini ham tasdiqlasa, `payments`/`bookings`
   * UPDATE'lari xavfsiz no-op bo'lardi (`WHERE status='paid'` mos kelmasdi),
   * LEKIN hamkor ledgeriga manfiy yozuv SHARTSIZ qo'shilardi — natijada
   * bitta haqiqiy pul qaytarishga IKKITA ledger debiti to'g'ri kelardi.
   * Endi ledger yozuvi (va booking bekor qilish) FAQAT `payments` qatori
   * haqiqatan `paid`dan `refunded`ga o'tgan taqdirdagina yoziladi.
   */
  async refundApprove(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown> = {},
  ) {
    const result = await this.postgres.transaction(async (tx) => {
      const [refund] = await tx.query<{
        id: string;
        booking_id: string;
        status: string;
        requested_amount: string | number;
        currency: string;
      }>(
        `SELECT id::text, booking_id::text, status::text, requested_amount, currency
         FROM refunds WHERE id = $1::uuid FOR UPDATE`,
        [id],
      );
      if (!refund) {
        throw new NotFoundException({
          code: 'REFUND_NOT_ALLOWED',
          message: 'Refund topilmadi',
        });
      }
      if (!['requested', 'processing'].includes(refund.status)) {
        throw new ConflictException({
          code: 'REFUND_INVALID_STATUS',
          message: `Refund "${refund.status}" holatidan tasdiqlab bo'lmaydi`,
        });
      }

      const requestedAmount = Number(refund.requested_amount);
      const approvedAmount =
        body.approved_amount != null
          ? Number(body.approved_amount)
          : requestedAmount;
      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
        throw new BadRequestException({
          code: 'REFUND_AMOUNT_INVALID',
          message: 'Tasdiqlangan summa noto‘g‘ri',
        });
      }

      const now = new Date().toISOString();
      const [updated] = await tx.query(
        `UPDATE refunds
         SET status = 'approved', approved_amount = $2, updated_at = $3
         WHERE id = $1::uuid
         RETURNING id::text, booking_id::text, user_id::text, status,
                   requested_amount::float8, approved_amount::float8,
                   currency, reason, created_at, updated_at`,
        [id, approvedAmount, now],
      );

      const [booking] = await tx.query<{
        id: string;
        status: string;
        partner_organization_id: string;
        partner_payable: string | number;
        total_amount: string | number;
        currency: string;
      }>(
        `SELECT id::text, status::text, partner_organization_id::text,
                partner_payable, total_amount, currency
         FROM bookings WHERE id = $1::uuid FOR UPDATE`,
        [refund.booking_id],
      );

      // Pul xavfsizligi: tasdiqlangan summa bookingning haqiqiy to'langan
      // summasidan OSHIB KETMASLIGI SHART — ilgari bu yerda YUQORI chegara
      // tekshiruvi UMUMAN yo'q edi (faqat `>0` tekshirilardi).
      if (
        booking &&
        approvedAmount > Number(booking.total_amount) + 0.001 // tiyin darajasidagi yaxlitlash farqiga tolerantlik
      ) {
        throw new BadRequestException({
          code: 'REFUND_AMOUNT_INVALID',
          message: "Tasdiqlangan summa bron to'lov summasidan oshmasligi kerak",
        });
      }

      if (booking) {
        // MUHIM (double-ledger-debit bugini tuzatish): shu bookingga bir
        // nechta MUSTAQIL `refunds` qatori mavjud bo'lishi mumkin (foydalanuvchi
        // so'rovi + hamkor rad etishi + tizim avto-refundi — barchasi turli
        // service'lardan, bir-biridan bexabar yaratiladi). Agar ADMIN ikkinchi
        // (allaqachon boshqa qator orqali "refunded" bo'lgan) so'rovni ham
        // tasdiqlasa, quyidagi UPDATE `status='paid'` shartiga mos kelmaydi
        // (0 qator) — bu holatda booking bekor qilish va ledger yozuvi ATAYLAB
        // O'TKAZIB YUBORILADI (`paymentActuallyRefunded` orqali), aks holda
        // hamkor ledgeriga IKKINCHI marta manfiy yozuv tushib, real moliyaviy
        // effekt haqiqiy pul harakatidan ikki barobar ko'p bo'lib qolardi.
        const paymentUpdate = await tx.query<{ id: string }>(
          `UPDATE payments SET status = 'refunded', updated_at = $2
           WHERE booking_id = $1::uuid AND status = 'paid'
           RETURNING id`,
          [booking.id, now],
        );
        const paymentActuallyRefunded = paymentUpdate.length > 0;

        if (
          paymentActuallyRefunded &&
          !['cancelled', 'completed'].includes(booking.status)
        ) {
          await tx.query(
            `UPDATE bookings SET status = 'cancelled', cancelled_at = $2,
                    cancel_reason_text = 'Refund tasdiqlandi', updated_at = $2
             WHERE id = $1::uuid`,
            [booking.id, now],
          );
        }

        if (paymentActuallyRefunded) {
          // MUHIM (qisman refund uchun proporsional ledger reversi): ilgari
          // bu yerda approvedAmount qancha bo'lishidan qat'i nazar HAR DOIM
          // butun `partner_payable` manfiylanardi — bu qisman refundda
          // hamkor ledgerini haqiqiy qaytarilgan summadan KO'PROQ kamaytirib
          // yuborardi. Booking-darajasida qisman-refund holati (schema'da
          // yo'q — `PaymentStatus`/`RefundStatus` enumlarida "partially_refunded"
          // umuman yo'q) sxemasini o'zgartirmasdan, faqat REVERSAL SUMMASINI
          // tasdiqlangan ulushga PROPORSIONAL qilib tuzatildi:
          //   reversal = partner_payable * (approvedAmount / total_amount)
          // To'liq refundda approvedAmount===total_amount => ratio 1 =>
          // avvalgi (to'g'ri) xulq aynan saqlanadi.
          const totalAmount = Number(booking.total_amount);
          const refundRatio =
            Number.isFinite(totalAmount) && totalAmount > 0
              ? Math.min(1, approvedAmount / totalAmount)
              : 1;
          const reversalAmountSom = Math.round(
            Number(booking.partner_payable) * refundRatio,
          );

          await tx.query(
            `INSERT INTO partner_ledger_entries (id, organization_id, booking_id, type, amount, currency, created_at)
             VALUES ($1, $2, $3, 'refund', $4, $5, $6)`,
            [
              randomUUID(),
              booking.partner_organization_id,
              booking.id,
              -reversalAmountSom,
              booking.currency,
              now,
            ],
          );
        }
      }

      return updated;
    });

    await this.audit('refund.approve', actor, {
      refund_id: id,
      approved_amount: result?.['approved_amount'],
    });
    this.invalidateAdminCache();
    this.events.adminDashboardUpdated();
    return (
      result ?? { id, status: 'approved', updated_at: new Date().toISOString() }
    );
  }

  async refundReject(actor: RequestActor | undefined, id: string) {
    const rows = await this.rows(
      `update refunds
       set status = 'rejected', updated_at = now()
       where id = $1::uuid and status in ('requested', 'processing')
       returning id::text, booking_id::text, user_id::text, status,
                 requested_amount::float8, approved_amount::float8,
                 currency, reason, created_at, updated_at`,
      [id],
    );
    if (!rows[0]) {
      const [existing] = await this.rows(
        `select status from refunds where id = $1::uuid`,
        [id],
      );
      if (!existing) {
        throw new NotFoundException({
          code: 'REFUND_NOT_ALLOWED',
          message: 'Refund topilmadi',
        });
      }
      throw new ConflictException({
        code: 'REFUND_INVALID_STATUS',
        message: `Refund "${String(existing['status'])}" holatidan rad etib bo'lmaydi`,
      });
    }
    await this.audit('refund.reject', actor, { refund_id: id });
    this.invalidateAdminCache();
    return rows[0];
  }

  /**
   * "Qayta ko'rib chiqish" — bu haqiqiy tashqi to'lov urinishini qayta
   * yubormaydi (bunday integratsiya hozircha yo'q), balki xato bilan
   * rad etilgan so'rovni yana navbatga ("requested") qaytaradi, shunda
   * admin qayta ko'rib chiqishi mumkin. Avval bu yerda `RefundStatus`
   * enum'ida mavjud bo'lmagan "retrying" qiymati yozilardi — bu chaqiruv
   * har safar Postgres xatosi bilan yiqilardi.
   */
  async refundRetry(actor: RequestActor | undefined, id: string) {
    const rows = await this.rows(
      `update refunds
       set status = 'requested', updated_at = now()
       where id = $1::uuid and status = 'rejected'
       returning id::text, booking_id::text, user_id::text, status,
                 requested_amount::float8, approved_amount::float8,
                 currency, reason, created_at, updated_at`,
      [id],
    );
    if (!rows[0]) {
      const [existing] = await this.rows(
        `select status from refunds where id = $1::uuid`,
        [id],
      );
      if (!existing) {
        throw new NotFoundException({
          code: 'REFUND_NOT_ALLOWED',
          message: 'Refund topilmadi',
        });
      }
      throw new ConflictException({
        code: 'REFUND_INVALID_STATUS',
        message: `Faqat rad etilgan refund'ni qayta ko'rib chiqish mumkin (hozirgi holat: "${String(existing['status'])}")`,
      });
    }
    await this.audit('refund.retry', actor, { refund_id: id });
    this.invalidateAdminCache();
    return rows[0];
  }

  async financeOverview() {
    const [row] = await this.rows(`
      select
        coalesce((select sum(total_amount) from bookings), 0)::float8 as gross_amount,
        coalesce((select sum(amount) from payments where status = 'paid'), 0)::float8 as paid_amount,
        'UZS' as currency
    `);

    return {
      gross_amount: numberValue(row?.['gross_amount'] ?? 0),
      paid_amount: numberValue(row?.['paid_amount'] ?? 0),
      currency: 'UZS',
    };
  }

  async partnersReport() {
    return this.rows(`
      select
        po.id::text as partner_id,
        po.brand_name,
        count(b.id)::int as bookings,
        coalesce(sum(b.total_amount), 0)::float8 as total_revenue,
        coalesce(sum(b.commission_amount), 0)::float8 as total_commission
      from partner_organizations po
      left join bookings b on b.partner_organization_id = po.id
      group by po.id
      order by total_revenue desc
    `);
  }

  async providerReconciliation() {
    return this.rows(`
      select id::text as payment_id, provider::text, status::text, true as matched
      from payments
      order by created_at desc
    `);
  }

  financeDocuments() {
    return [];
  }

  financeDocumentRegenerate(id: string) {
    return { id, regenerated: true, created_at: new Date().toISOString() };
  }

  async withdrawals(query: QueryLike = {}) {
    return this.rows(`
      select
        wr.id::text,
        wr.organization_id::text as partner_id,
        po.brand_name as partner_name,
        wr.amount::float8,
        wr.currency,
        wr.status,
        wr.created_at as request_date,
        wr.created_at,
        wr.updated_at,
        coalesce(po.tax_id, po.id::text) as bank_account
      from withdrawal_requests wr
      left join partner_organizations po on po.id = wr.organization_id
      order by wr.created_at desc
      ${this.limitClause(query)}
    `);
  }

  async withdrawal(id: string) {
    const rows = await this.rows(
      `
        select
          wr.id::text,
          wr.organization_id::text as partner_id,
          po.brand_name as partner_name,
          wr.amount::float8,
          wr.currency,
          wr.status,
          wr.created_at as request_date,
          wr.created_at,
          wr.updated_at,
          coalesce(po.tax_id, po.id::text) as bank_account
        from withdrawal_requests wr
        left join partner_organizations po on po.id = wr.organization_id
        where wr.id = $1::uuid
      `,
      [id],
    );
    return rows[0] ?? { id, status: 'requested' };
  }

  async withdrawalStatus(id: string, status: string) {
    const nextStatus = normalizeWithdrawalStatus(status);
    // Holat mashinasi: requested -> approved/rejected, approved -> paid/
    // rejected. `paid` va `rejected` — TUGATUVCHI holatlar, ulardan
    // hech qanday keyingi o'tish yo'q. Avval bu yerda hech qanday
    // manba-holat tekshiruvi yo'q edi — masalan allaqachon "paid"
    // qilingan yechimni "rejected"ga o'tkazish mumkin edi, bu esa
    // `withdrawal()` metodidagi "alreadyCommitted" hisobidan uni chiqarib
    // tashlab, xuddi shu summani ikkinchi marta so'rash/to'lashga yo'l
    // ochib berardi.
    const allowedFromStatuses: Record<string, string[]> = {
      approved: ['requested'],
      rejected: ['requested', 'approved'],
      paid: ['approved'],
      requested: [],
    };
    const fromStatuses = allowedFromStatuses[nextStatus] ?? [];

    const rows = await this.rows(
      `
        update withdrawal_requests wr
        set status = $2,
            updated_at = now()
        from partner_organizations po
        where wr.id = $1::uuid
          and po.id = wr.organization_id
          and wr.status = ANY($3::text[])
        returning
          wr.id::text,
          wr.organization_id::text as partner_id,
          po.brand_name as partner_name,
          wr.amount::float8,
          wr.currency,
          wr.status,
          wr.created_at as request_date,
          wr.created_at,
          wr.updated_at,
          coalesce(po.tax_id, po.id::text) as bank_account
      `,
      [id, nextStatus, fromStatuses],
    );

    if (!rows[0]) {
      const [existing] = await this.rows(
        `select status from withdrawal_requests where id = $1::uuid`,
        [id],
      );
      if (!existing) {
        throw new NotFoundException({
          code: 'WITHDRAWAL_NOT_FOUND',
          message: 'Pul yechish so‘rovi topilmadi',
        });
      }
      throw new ConflictException({
        code: 'WITHDRAWAL_INVALID_STATUS',
        message: `Pul yechish so'rovini "${String(existing['status'])}" holatidan "${nextStatus}"ga o'tkazib bo'lmaydi`,
      });
    }
    this.invalidateAdminCache();
    return rows[0];
  }

  // ---------------------------------------------------------------------------
  // Developer (cross-partner API keys / webhooks oversight)
  // ---------------------------------------------------------------------------

  async developerApiKeys(query: QueryLike = {}) {
    return this.rows(`
      select
        k.id::text,
        k.organization_id::text as partner_id,
        po.brand_name as partner_name,
        k.name,
        k.key_prefix,
        k.last_used_at,
        k.created_at
      from partner_api_keys k
      left join partner_organizations po on po.id = k.organization_id
      where k.revoked_at is null
      order by k.created_at desc
      ${this.limitClause(query)}
    `);
  }

  async deleteDeveloperApiKey(
    actor: RequestActor | undefined,
    id: string,
  ): Promise<{ id: string; revoked: boolean }> {
    const rows = await this.rows(
      `
        update partner_api_keys
        set revoked_at = now(), status = 'revoked', updated_at = now()
        where id = $1::uuid and revoked_at is null
        returning id::text, organization_id::text as partner_id
      `,
      [id],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'API_KEY_NOT_FOUND',
        message: 'API kalit topilmadi yoki allaqachon bekor qilingan',
      });
    }

    await this.audit('developer.api_key_revoke', actor, {
      api_key_id: id,
      partner_id: rows[0]['partner_id'],
    });

    return { id, revoked: true };
  }

  async developerWebhooks(query: QueryLike = {}) {
    return this.rows(`
      select
        w.id::text,
        w.organization_id::text as partner_id,
        po.brand_name as partner_name,
        w.url,
        w.events,
        (w.status = 'active') as is_active,
        coalesce(fd.failed_count, 0)::int as failed_deliveries,
        w.created_at
      from partner_webhook_endpoints w
      left join partner_organizations po on po.id = w.organization_id
      left join (
        select endpoint_id, count(*) as failed_count
        from partner_webhook_deliveries
        where status = 'failed'
        group by endpoint_id
      ) fd on fd.endpoint_id = w.id
      order by w.created_at desc
      ${this.limitClause(query)}
    `);
  }

  /**
   * `cmsCreate`/`cmsUpdate`/`cmsAction`/`cmsTranslation` faqat `cms:*`ni
   * bo'shatadi — bu yetarli, chunki `/cms/*` va `/catalog/attractions`,
   * `/catalog/restaurants` kabi generik o'qish endpointlari shu prefiks
   * ostida keshlanadi. Lekin `catalog.service.ts`'dagi `destinations()`
   * o'zining ALOHIDA `catalog:destinations` kalitida (300s TTL) keshlaydi
   * (attractions/restaurants'dan farqli, ular o'z resurs-maxsus admin
   * endpointlarida `catalog:*`ni bo'shatadi) — shu sabab resource
   * 'destinations' bo'lganda buni ham aniq bo'shatish kerak, aks holda
   * admin panelda active/inactive/edit/reorder qilingandan keyin ham
   * public `/catalog/destinations` eski holatni to 5 daqiqagacha
   * qaytaraveradi.
   */
  private invalidateCmsCache(resource: string): void {
    void this.cache.delByPattern('cms:*');
    if (resource === 'destinations') {
      void this.cache.del('catalog:destinations');
    }
  }

  async cmsList(resource: string, query: QueryLike = {}) {
    const types = cmsTypesForResource(resource);
    const rows = await this.rows(
      `
        select
          id::text,
          type,
          slug,
          title as title_i18n,
          body as body_i18n,
          status,
          metadata,
          published_at,
          created_at,
          updated_at
        from cms_entries
        where type = any($1::text[])
          and status <> 'archived'
        order by
          coalesce(
            case when metadata ->> 'order' ~ '^-?[0-9]+$' then (metadata ->> 'order')::int end,
            case when metadata ->> 'sortOrder' ~ '^-?[0-9]+$' then (metadata ->> 'sortOrder')::int end,
            9999
          ),
          created_at desc
        ${this.limitClause(query)}
      `,
      [types],
    );
    return rows.map(cmsAdminDto);
  }

  async cmsOne(resource: string, id: string) {
    const types = cmsTypesForResource(resource);
    const condition = isUuid(id) ? 'id = $2::uuid' : 'slug = $2';
    const rows = await this.rows(
      `
        select
          id::text,
          type,
          slug,
          title as title_i18n,
          body as body_i18n,
          status,
          metadata,
          published_at,
          created_at,
          updated_at
        from cms_entries
        where type = any($1::text[])
          and ${condition}
          and status <> 'archived'
        limit 1
      `,
      [types, id],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'CMS_ENTRY_NOT_FOUND',
        message: 'CMS sahifa topilmadi',
      });
    }
    return cmsAdminDto(rows[0]);
  }

  async cmsCreate(resource: string, body: Record<string, unknown>) {
    const payload = normalizeCmsPayload(resource, body);

    let rows: DbRow[];
    try {
      rows = await this.rows(
        `insert into cms_entries (id, type, slug, title, body, status, metadata, published_at, updated_at)
         values (
           gen_random_uuid(),
           $1,
           $2,
           ($3)::jsonb,
           ($4)::jsonb,
           $5::text,
           ($6)::jsonb,
           case when $5::text in ('published', 'active') then coalesce($7::timestamptz, now()) else $7::timestamptz end,
           now()
         )
         returning id::text, type, slug, title as title_i18n, body as body_i18n, status, metadata, published_at, created_at, updated_at`,
        [
          payload.type,
          payload.slug,
          JSON.stringify(payload.title),
          JSON.stringify(payload.body),
          payload.status,
          JSON.stringify(payload.metadata),
          payload.publishedAt,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'CMS_ENTRY_EXISTS',
          message: `"${payload.slug}" slug allaqachon mavjud. Boshqa slug tanlang.`,
        });
      }
      throw error;
    }

    this.invalidateCmsCache(resource);
    this.invalidateAdminCache();
    return cmsAdminDto(rows[0]);
  }

  async cmsUpdate(resource: string, id: string, body: Record<string, unknown>) {
    const types = cmsTypesForResource(resource);
    const hasTitle = CMS_TEXT_KEYS.title.some(
      (key) =>
        body[key] !== undefined ||
        body[`${key}_uz`] !== undefined ||
        body[`${key}_ru`] !== undefined ||
        body[`${key}_en`] !== undefined ||
        body[`${key}Uz`] !== undefined ||
        body[`${key}Ru`] !== undefined ||
        body[`${key}En`] !== undefined,
    );
    const hasBody = CMS_TEXT_KEYS.body.some(
      (key) =>
        body[key] !== undefined ||
        body[`${key}_uz`] !== undefined ||
        body[`${key}_ru`] !== undefined ||
        body[`${key}_en`] !== undefined ||
        body[`${key}Uz`] !== undefined ||
        body[`${key}Ru`] !== undefined ||
        body[`${key}En`] !== undefined,
    );
    const metadata = normalizeCmsMetadata(body);
    const hasMetadata = Object.keys(metadata).length > 0;
    const status =
      body.status !== undefined || body.state !== undefined
        ? normalizeCmsStatus(body.status ?? body.state)
        : null;
    const slug = body.slug ? cmsSlugify(String(body.slug), '') : null;
    const publishedAt = body.published_at ?? body.publishedAt;

    let rows: DbRow[];
    try {
      rows = await this.rows(
        `update cms_entries
         set slug = coalesce(nullif($3, ''), slug),
             title = case when $4::boolean then ($5)::jsonb else title end,
             body = case when $6::boolean then ($7)::jsonb else body end,
             metadata = case
               when $8::boolean then coalesce(metadata, '{}'::jsonb) || ($9)::jsonb
               else metadata
             end,
             status = coalesce($10::text, status),
             published_at = case
               when $10::text in ('published', 'active') then coalesce($11::timestamptz, published_at, now())
               when $11::timestamptz is not null then $11::timestamptz
               else published_at
             end,
             updated_at = now()
         where id = $1::uuid
           and type = any($2::text[])
         returning id::text, type, slug, title as title_i18n, body as body_i18n, status, metadata, published_at, created_at, updated_at`,
        [
          id,
          types,
          slug,
          hasTitle,
          JSON.stringify(normalizeCmsLocalizedField(body, CMS_TEXT_KEYS.title)),
          hasBody,
          JSON.stringify(normalizeCmsLocalizedField(body, CMS_TEXT_KEYS.body)),
          hasMetadata,
          JSON.stringify(metadata),
          status,
          publishedAt ? String(publishedAt) : null,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'CMS_ENTRY_EXISTS',
          message: `"${slug ?? id}" slug allaqachon mavjud. Boshqa slug tanlang.`,
        });
      }
      throw error;
    }

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'CMS_ENTRY_NOT_FOUND',
        message: 'CMS sahifa topilmadi',
      });
    }

    this.invalidateCmsCache(resource);
    this.invalidateAdminCache();
    return cmsAdminDto(rows[0]);
  }

  async cmsAction(resource: string, id: string, action: string) {
    const types = cmsTypesForResource(resource);
    const statusMap: Record<string, string> = {
      publish: 'published',
      unpublish: 'draft',
      archive: 'archived',
      draft: 'draft',
    };
    const newStatus = statusMap[action] ?? action;

    const rows = await this.rows(
      `update cms_entries
       set status = $2::text,
           published_at = case when $2::text = 'published' then coalesce(published_at, now()) else published_at end,
           updated_at = now()
       where id = $1::uuid
         and type = any($3::text[])
       returning id::text, type, slug, title as title_i18n, body as body_i18n, status, metadata, published_at, created_at, updated_at`,
      [id, newStatus, types],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'CMS_ENTRY_NOT_FOUND',
        message: 'CMS sahifa topilmadi',
      });
    }

    this.invalidateCmsCache(resource);
    this.invalidateAdminCache();
    return cmsAdminDto(rows[0]);
  }

  async cmsDelete(resource: string, id: string) {
    return this.cmsAction(resource, id, 'archive');
  }

  async cmsTranslation(
    resource: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    const rows = await this.rows(
      `update cms_entries
       set metadata = metadata || ($2)::jsonb, updated_at = now()
       where id = $1::uuid
       returning id::text, type, slug, title, status, metadata, published_at, created_at, updated_at`,
      [id, JSON.stringify(body)],
    );

    this.invalidateCmsCache(resource);
    this.invalidateAdminCache();
    return (
      rows[0] ?? {
        id,
        resource,
        translations: body,
        updated_at: new Date().toISOString(),
      }
    );
  }

  async promos(query: QueryLike = {}) {
    return this.rows(`
      select
        id::text,
        coalesce(title ->> 'uz', upper(slug), 'PROMO') as code,
        metadata ->> 'discountType' as discount_type,
        coalesce((metadata ->> 'discountValue')::float8, 0) as discount_value,
        coalesce((metadata ->> 'usageLimit')::int, 0) as usage_limit,
        coalesce((metadata ->> 'usedCount')::int, 0) as used_count,
        coalesce(published_at, created_at + interval '30 days') as valid_until,
        status,
        created_at,
        updated_at
      from cms_entries
      where type = 'promo'
      order by created_at desc
      ${this.limitClause(query)}
    `);
  }

  async promoCreate(body: Record<string, unknown>) {
    const code = String(body.code ?? 'safaar10').toUpperCase();
    const validUntilRaw = body.validUntil ?? body.valid_until;
    const validUntilDate = validUntilRaw
      ? new Date(String(validUntilRaw))
      : null;
    // `published_at` promo uchun "amal qilish muddati" o'rnida ishlatiladi —
    // qo'yilmasa, ro'yxat so'rovi created_at + 30 kunni standart qiladi.
    const validUntil =
      validUntilDate && !Number.isNaN(validUntilDate.getTime())
        ? validUntilDate.toISOString()
        : null;
    let rows: DbRow[];
    try {
      rows = await this.rows(
        `insert into cms_entries (id, type, slug, title, body, status, metadata, published_at, updated_at)
         values (gen_random_uuid(), 'promo', $1, ($2)::jsonb, '{}'::jsonb, 'published', ($3)::jsonb, $4, now())
         returning id::text, type, slug, title, metadata, status, published_at, created_at, updated_at`,
        [
          code.toLowerCase().replace(/\s+/g, '-'),
          JSON.stringify({ uz: code }),
          JSON.stringify({
            discountType: body.discountType ?? 'percentage',
            discountValue: Number(body.discountValue ?? 10),
            usageLimit: Number(body.usageLimit ?? 100),
            usedCount: 0,
            ...(body.metadata as Record<string, unknown> | undefined),
          }),
          validUntil,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'PROMO_CODE_EXISTS',
          message: `"${code}" promo-kodi allaqachon mavjud. Boshqa nom tanlang.`,
        });
      }
      throw error;
    }

    void this.cache.delByPattern('cms:*');
    this.invalidateAdminCache();
    this.events.promosUpdated();
    return rows[0];
  }

  async promoUpdate(id: string, body: Record<string, unknown>) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (body.code !== undefined) {
      const code = String(body.code).toUpperCase();
      sets.push(`slug = $${paramIndex++}`);
      params.push(code.toLowerCase().replace(/\s+/g, '-'));
      sets.push(`title = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify({ uz: code }));
    }

    const metadataPatch: Record<string, unknown> = {};
    if (body.discountType !== undefined) {
      metadataPatch.discountType = body.discountType;
    }
    if (body.discountValue !== undefined) {
      metadataPatch.discountValue = Number(body.discountValue);
    }
    if (body.usageLimit !== undefined) {
      metadataPatch.usageLimit = Number(body.usageLimit);
    }
    if (Object.keys(metadataPatch).length > 0) {
      sets.push(`metadata = metadata || $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(metadataPatch));
    }

    const validUntilRaw = body.validUntil ?? body.valid_until;
    if (validUntilRaw !== undefined) {
      const date = new Date(String(validUntilRaw));
      sets.push(`published_at = $${paramIndex++}`);
      params.push(!Number.isNaN(date.getTime()) ? date.toISOString() : null);
    }

    if (body.isActive !== undefined) {
      sets.push(`status = $${paramIndex++}`);
      params.push(body.isActive ? 'published' : 'draft');
    }

    if (sets.length === 0) {
      const [existing] = await this.rows(
        `select id::text, type, slug, title, metadata, status, published_at, created_at, updated_at
         from cms_entries where id = $1::uuid and type = 'promo'`,
        [id],
      );
      if (!existing) {
        throw new NotFoundException({
          code: 'PROMO_NOT_FOUND',
          message: 'Promo-kod topilmadi',
        });
      }
      return existing;
    }

    sets.push('updated_at = now()');
    params.push(id);

    let rows: DbRow[];
    try {
      rows = await this.rows(
        `update cms_entries set ${sets.join(', ')}
         where id = $${paramIndex}::uuid and type = 'promo'
         returning id::text, type, slug, title, metadata, status, published_at, created_at, updated_at`,
        params,
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'PROMO_CODE_EXISTS',
          message: 'Bu promo-kod allaqachon mavjud. Boshqa nom tanlang.',
        });
      }
      throw error;
    }

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'PROMO_NOT_FOUND',
        message: 'Promo-kod topilmadi',
      });
    }

    void this.cache.delByPattern('cms:*');
    this.invalidateAdminCache();
    this.events.promosUpdated();
    return rows[0];
  }

  async promoDelete(id: string) {
    const rows = await this.rows(
      `delete from cms_entries where id = $1::uuid and type = 'promo' returning id::text`,
      [id],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'PROMO_NOT_FOUND',
        message: 'Promo-kod topilmadi',
      });
    }
    void this.cache.delByPattern('cms:*');
    this.invalidateAdminCache();
    this.events.promosUpdated();
    return { id, deleted: true };
  }

  promoStats(id: string) {
    return { id, usages: 0, revenue: 0 };
  }

  private localizedNameJson(body: Record<string, unknown>): string {
    const raw = body.name;
    const name =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : { uz: raw };
    const uz = String(name.uz ?? '').trim();
    if (!uz) {
      throw new BadRequestException({
        code: 'NAME_REQUIRED',
        message: "Nomi (o'zbekcha) kiritilishi shart",
      });
    }
    return JSON.stringify({
      uz,
      ru: name.ru ? String(name.ru) : uz,
      en: name.en ? String(name.en) : uz,
    });
  }

  async regionCreate(body: Record<string, unknown>) {
    const rows = await this.rows(
      `insert into regions (id, name, created_at, updated_at)
       values (gen_random_uuid(), ($1)::jsonb, now(), now())
       returning id::text, name, created_at, updated_at`,
      [this.localizedNameJson(body)],
    );
    void this.cache.delByPattern('catalog:*');
    return rows[0];
  }

  async regionUpdate(id: string, body: Record<string, unknown>) {
    const rows = await this.rows(
      `update regions set name = ($1)::jsonb, updated_at = now()
       where id = $2::uuid
       returning id::text, name, created_at, updated_at`,
      [this.localizedNameJson(body), id],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'REGION_NOT_FOUND',
        message: 'Hudud topilmadi',
      });
    }
    void this.cache.delByPattern('catalog:*');
    return rows[0];
  }

  async regionDelete(id: string) {
    let rows: DbRow[];
    try {
      rows = await this.rows(
        `delete from regions where id = $1::uuid returning id::text`,
        [id],
      );
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException({
          code: 'REGION_IN_USE',
          message:
            "Bu hududga shaharlar bog'langan. Avval shaharlarni o'chiring yoki boshqa hududga ko'chiring.",
        });
      }
      throw error;
    }
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'REGION_NOT_FOUND',
        message: 'Hudud topilmadi',
      });
    }
    void this.cache.delByPattern('catalog:*');
    return { id, deleted: true };
  }

  async amenityCreate(body: Record<string, unknown>) {
    const code = String(body.code ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (!code) {
      throw new BadRequestException({
        code: 'AMENITY_CODE_REQUIRED',
        message: 'Qulaylik kodi kiritilishi shart',
      });
    }
    let rows: DbRow[];
    try {
      rows = await this.rows(
        `insert into amenities (id, code, name, created_at, updated_at)
         values (gen_random_uuid(), $1, ($2)::jsonb, now(), now())
         returning id::text, code, name, created_at, updated_at`,
        [code, this.localizedNameJson(body)],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'AMENITY_CODE_EXISTS',
          message: `"${code}" kodli qulaylik allaqachon mavjud.`,
        });
      }
      throw error;
    }
    void this.cache.delByPattern('catalog:*');
    return rows[0];
  }

  async amenityUpdate(id: string, body: Record<string, unknown>) {
    const rows = await this.rows(
      `update amenities set name = ($1)::jsonb, updated_at = now()
       where id = $2::uuid
       returning id::text, code, name, created_at, updated_at`,
      [this.localizedNameJson(body), id],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'AMENITY_NOT_FOUND',
        message: 'Qulaylik topilmadi',
      });
    }
    void this.cache.delByPattern('catalog:*');
    return rows[0];
  }

  async amenityDelete(id: string) {
    let rows: DbRow[];
    try {
      rows = await this.rows(
        `delete from amenities where id = $1::uuid returning id::text`,
        [id],
      );
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException({
          code: 'AMENITY_IN_USE',
          message:
            "Bu qulaylik mehmonxona yoki xonalarda ishlatilmoqda, shuning uchun o'chirib bo'lmaydi.",
        });
      }
      throw error;
    }
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'AMENITY_NOT_FOUND',
        message: 'Qulaylik topilmadi',
      });
    }
    void this.cache.delByPattern('catalog:*');
    return { id, deleted: true };
  }

  async supportTickets(query: QueryLike = {}) {
    return this.rows(`
      select
        st.id::text,
        st.user_id::text,
        st.actor_type,
        st.actor_id::text,
        st.subject,
        st.priority,
        st.status,
        case
          when st.actor_type = 'partner' then coalesce(
            nullif(trim(pu.full_name), ''),
            nullif(trim(partner_contact.full_name), ''),
            po.legal_name,
            po.brand_name,
            'Hamkor'
          )
          else coalesce(
            nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
            u.email,
            u.phone,
            'Mijoz'
          )
        end as customer_name,
        st.actor_type as customer_type,
        po.id::text as partner_organization_id,
        coalesce(hotel_listing.name, bus_listing.name, po.brand_name, po.legal_name) as business_name,
        coalesce(hotel_listing.name, po.brand_name, po.legal_name) as hotel_name,
        coalesce(bus_listing.name, po.brand_name, po.legal_name) as company_name,
        po.tax_id,
        st.created_at,
        st.updated_at
      from support_tickets st
      left join users u on u.id = st.user_id
      left join partner_users pu on pu.id = st.actor_id and st.actor_type = 'partner'
      left join partner_organizations po
        on st.actor_type = 'partner'
       and (po.id = st.actor_id or po.id = pu.organization_id)
      left join lateral (
        select pu2.full_name
        from partner_users pu2
        where pu2.organization_id = po.id
          and pu2.deleted_at is null
        order by case when pu2.status = 'active' then 0 else 1 end, pu2.created_at asc
        limit 1
      ) partner_contact on true
      left join lateral (
        select ht.name
        from hotels h
        left join hotel_translations ht on ht.hotel_id = h.id and ht.language = 'uz'
        where h.partner_organization_id = po.id
          and h.deleted_at is null
        order by case when h.status = 'published' then 0 when h.status = 'pending_review' then 1 else 2 end,
                 h.created_at desc
        limit 1
      ) hotel_listing on true
      left join lateral (
        select bc.name
        from bus_companies bc
        where bc.partner_organization_id = po.id
        order by case when bc.status = 'active' then 0 else 1 end, bc.created_at desc
        limit 1
      ) bus_listing on true
      order by st.created_at desc
      ${this.limitClause(query)}
    `);
  }

  async supportTicket(id: string) {
    if (!isUuid(id)) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Murojaat topilmadi',
      });
    }

    const rows = await this.rows(
      `
        select
          st.id::text,
          st.user_id::text,
          st.actor_type,
          st.actor_id::text,
          st.subject,
          st.priority,
          st.status,
          case
            when st.actor_type = 'partner' then coalesce(
              nullif(trim(pu.full_name), ''),
              nullif(trim(partner_contact.full_name), ''),
              po.legal_name,
              po.brand_name,
              'Hamkor'
            )
            else coalesce(
              nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
              u.email,
              u.phone,
              'Mijoz'
            )
          end as customer_name,
          st.actor_type as customer_type,
          po.id::text as partner_organization_id,
          coalesce(hotel_listing.name, bus_listing.name, po.brand_name, po.legal_name) as business_name,
          coalesce(hotel_listing.name, po.brand_name, po.legal_name) as hotel_name,
          coalesce(bus_listing.name, po.brand_name, po.legal_name) as company_name,
          po.tax_id,
          st.created_at,
          st.updated_at
        from support_tickets st
        left join users u on u.id = st.user_id
        left join partner_users pu on pu.id = st.actor_id and st.actor_type = 'partner'
        left join partner_organizations po
          on st.actor_type = 'partner'
         and (po.id = st.actor_id or po.id = pu.organization_id)
        left join lateral (
          select pu2.full_name
          from partner_users pu2
          where pu2.organization_id = po.id
            and pu2.deleted_at is null
          order by case when pu2.status = 'active' then 0 else 1 end, pu2.created_at asc
          limit 1
        ) partner_contact on true
        left join lateral (
          select ht.name
          from hotels h
          left join hotel_translations ht on ht.hotel_id = h.id and ht.language = 'uz'
          where h.partner_organization_id = po.id
            and h.deleted_at is null
          order by case when h.status = 'published' then 0 when h.status = 'pending_review' then 1 else 2 end,
                   h.created_at desc
          limit 1
        ) hotel_listing on true
        left join lateral (
          select bc.name
          from bus_companies bc
          where bc.partner_organization_id = po.id
          order by case when bc.status = 'active' then 0 else 1 end, bc.created_at desc
          limit 1
        ) bus_listing on true
        where st.id = $1::uuid
      `,
      [id],
    );
    const messages = await this.rows(
      `
        select
          sm.id::text,
          sm.ticket_id::text,
          sm.sender_type,
          sm.sender_id::text,
          case
            when sm.sender_type = 'admin' then coalesce(au.full_name, 'Admin')
            when sm.sender_type = 'partner' then coalesce(po.brand_name, po.legal_name, 'Hamkor')
            else concat_ws(' ', u.first_name, u.last_name)
          end as sender_name,
          sm.body as message,
          sm.created_at
        from support_messages sm
        left join users u on u.id = sm.sender_id
        left join admin_users au on au.id = sm.sender_id
        left join partner_users pu on pu.id = sm.sender_id and sm.sender_type = 'partner'
        left join partner_organizations po on po.id = pu.organization_id
        where sm.ticket_id = $1::uuid
        order by sm.created_at asc
      `,
      [id],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Murojaat topilmadi',
      });
    }
    return { ...rows[0], messages: messages ?? [] };
  }

  async supportStatus(id: string, body: Record<string, unknown>) {
    const status = normalizeSupportStatus(body.status ?? body.action);
    const rows = await this.rows(
      `
        update support_tickets
        set status = $2,
            updated_at = now()
        where id = $1::uuid
        returning
          id::text,
          user_id::text,
          subject,
          priority,
          status,
          created_at,
          updated_at
      `,
      [id, status],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Murojaat topilmadi',
      });
    }
    this.invalidateAdminCache();
    this.events.supportTicketUpdated(rows[0]);
    this.events.adminDashboardUpdated();
    return rows[0];
  }

  async supportMessage(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    if (!isUuid(id)) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Murojaat topilmadi',
      });
    }

    const message = String(body.message ?? body.body ?? '').trim();
    const rows = await this.rows(
      `
        insert into support_messages (ticket_id, sender_type, sender_id, body)
        values ($1::uuid, 'admin', $2::uuid, $3)
        returning
          id::text,
          ticket_id::text,
          sender_type,
          sender_id::text,
          'Admin' as sender_name,
          body as message,
          created_at
      `,
      [id, adminActorUuid(actor), message],
    );

    await this.supportStatus(id, { status: 'in_progress' });

    // Broadcast message to all ticket participants
    const [ticket] = await this.rows(
      'SELECT * FROM support_tickets WHERE id = $1::uuid',
      [id],
    );
    this.events.supportMessageCreated(id, rows[0], ticket ?? { id });

    return rows[0];
  }

  async supportAction(
    actor: RequestActor | undefined,
    id: string,
    action: string,
    body: Record<string, unknown>,
  ) {
    if (action === 'close') {
      return this.supportStatus(id, { status: 'closed' });
    }
    if (action === 'reopen') {
      return this.supportStatus(id, { status: 'open' });
    }
    if (action === 'status') {
      return this.supportStatus(id, body);
    }
    if (action === 'message' || action === 'reply') {
      return this.supportMessage(actor, id, body);
    }
    return { id, action, body, updated_at: new Date().toISOString() };
  }

  async supportStats() {
    const [row] = await this.rows(`
      select
        count(*) filter (where status = 'open')::int as open,
        count(*) filter (where status = 'closed')::int as closed
      from support_tickets
    `);
    return row ?? { open: 0, closed: 0 };
  }

  /**
   * Frontend sarlavha/matnni oddiy string sifatida yuboradi, `cms_entries`
   * esa CMS'ning umumiy naqshiga mos `{uz, ru, en}` lokalizatsiya obyektini
   * kutadi (`title ->> 'uz'` orqali o'qiladi) — oddiy string kelsa, uni
   * shu shaklga o'raymiz, aks holda `->> 'uz'` NULL qaytarib, matn
   * ro'yxat/detail sahifalarida jim yo'qolib qolardi.
   */
  private toLocalizedJsonb(value: unknown, fallbackUz: string): string {
    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }
    const text = value != null ? String(value) : fallbackUz;
    return JSON.stringify({ uz: text });
  }

  async notificationBroadcastCreate(body: Record<string, unknown>) {
    const rows = await this.rows(
      `insert into cms_entries (id, type, slug, title, body, status, metadata, updated_at)
       values (gen_random_uuid(), 'broadcast', $1, ($2)::jsonb, ($3)::jsonb, 'draft', ($4)::jsonb, now())
       returning id::text, type, slug, title, body, status, metadata, created_at, updated_at`,
      [
        `broadcast-${randomUUID().slice(0, 8)}`,
        this.toLocalizedJsonb(body.title, 'Broadcast'),
        this.toLocalizedJsonb(body.body, ''),
        JSON.stringify(
          body.metadata ?? { target_type: body.target_type ?? 'all' },
        ),
      ],
    );
    return rows[0];
  }

  async notificationBroadcasts(query: QueryLike = {}) {
    return this.rows(`
      select id::text, type, slug,
             coalesce(title ->> 'uz', slug) as title,
             coalesce(body ->> 'uz', '') as body,
             coalesce(metadata ->> 'target_type', 'all') as target_type,
             status, metadata, created_at, updated_at
      from cms_entries
      where type = 'broadcast'
      order by created_at desc
      ${this.limitClause(query)}
    `);
  }

  async notificationBroadcastOne(id: string) {
    const rows = await this.rows(
      `select id::text, type, slug,
              coalesce(title ->> 'uz', slug) as title,
              coalesce(body ->> 'uz', '') as body,
              coalesce(metadata ->> 'target_type', 'all') as target_type,
              status, metadata, created_at, updated_at
       from cms_entries
       where id = $1::uuid and type = 'broadcast'`,
      [id],
    );
    return rows[0] ?? { id };
  }

  /**
   * Broadcasts o'zining generic CMS uch holatidan (draft/published/archived)
   * FARQLI, to'rt holatli status lug'atiga ega (draft/sending/sent/failed —
   * `broadcasts/page.tsx`dagi STATUS_LABELS/handleAction bilan bir xil),
   * chunki bu yerda haqiqiy asinxron yetkazib berish jarayoni ifodalanadi.
   * Audit topilmasi: `action='send'`/`'cancel'` bu lug'atda YO'Q edi, shuning
   * uchun `newStatus` literal `'send'` satrini yozar edi — na CMS, na UI
   * status lug'atiga mos kelmaydigan, "qotib qolgan" qatorga olib kelardi.
   * DIQQAT: bu faqat status-qiymat izchilligini tuzatadi — haqiqiy
   * push/SMS/in-app YETKAZIB BERISH hali yo'q (pastdagi izohga qarang),
   * shuning uchun bu yerda `sentCount`ga tegilmaydi (haqiqatan 0).
   */
  async notificationBroadcastAction(id: string, action: string) {
    const statusMap: Record<string, string> = {
      publish: 'published',
      unpublish: 'draft',
      archive: 'archived',
      send: 'sending',
      cancel: 'draft',
    };
    const newStatus = statusMap[action] ?? action;

    const rows = await this.rows(
      `update cms_entries
       set status = $2::text, updated_at = now()
       where id = $1::uuid
       returning id::text, status, updated_at`,
      [id, newStatus],
    );
    return rows[0] ?? { id, action, updated_at: new Date().toISOString() };
  }

  async adminUsers(query: QueryLike = {}) {
    return this.rows(`
      select id::text, email, full_name, role, status, created_at, updated_at
      from admin_users
      where deleted_at is null
      order by created_at desc
      ${this.limitClause(query)}
    `);
  }

  /**
   * `auth.service.ts::normalizeAdminRole()` bilan BIR XIL alias jadvali —
   * lekin U yerda noma'lum qiymat JIM RAVISHDA `Role.ADMIN`ga tushadi
   * (mavjud, login vaqtidagi "fail-safe" xulq, o'zgartirilmagan). BU YERDA
   * — YOZISH vaqtida — buni ATAYLAB QAYTARMAYMIZ: noma'lum/yaroqsiz rol
   * qiymati ANIQ rad etilishi kerak (2026-09-14 audit: ilgari
   * `adminUserUpdate` ISTALGAN satrni `role` ustuniga yozar edi, hech
   * qanday tasdiqlashsiz).
   */
  private normalizeRoleInput(value: unknown): Role | null {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/-/g, '_');
    const validRoles: string[] = Object.values(Role);
    return validRoles.includes(normalized) ? (normalized as Role) : null;
  }

  async adminUserCreate(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    if (!email) {
      throw new BadRequestException({
        code: 'ADMIN_EMAIL_REQUIRED',
        message: 'Email kiritilishi shart',
      });
    }

    const requestedRole = this.normalizeRoleInput(body.role ?? Role.MODERATOR);
    if (!requestedRole) {
      throw new BadRequestException({
        code: 'ADMIN_ROLE_INVALID',
        message: "Noto'g'ri rol qiymati",
      });
    }
    // Faqat SUPER_ADMIN boshqa foydalanuvchiga SUPER_ADMIN bera oladi —
    // aks holda istalgan `admin-users:write`ga ega admin o'zi yoki
    // boshqasini "eng yuqori" darajaga ko'tarishi mumkin bo'lar edi
    // (privilege escalation, task item 5/9/10 — "Normal admin cannot
    // grant itself SUPER_ADMIN" / "Permission escalation attempt →
    // rejected").
    if (
      requestedRole === Role.SUPER_ADMIN &&
      actor?.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException({
        code: 'ADMIN_ROLE_ESCALATION_DENIED',
        message:
          'Faqat SUPER_ADMIN boshqa foydalanuvchiga SUPER_ADMIN bera oladi',
      });
    }

    // Vaqtinchalik parol generatsiya qilinadi va faqat shu javobda BIR
    // MARTA qaytariladi (2FA setup'dagi recovery-kodlar bilan bir xil
    // uslub) — yangi admin shu parol bilan kirib, keyin o'zgartiradi.
    const temporaryPassword = randomToken(9);
    const passwordHash = await argon2.hash(temporaryPassword);
    const now = new Date().toISOString();

    const rows = await this.rows(
      `insert into admin_users (id, email, password_hash, full_name, role, status, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, $3, $4, 'active', $5, $5)
       returning id::text, email, full_name, role, status, created_at, updated_at`,
      [
        email,
        passwordHash,
        String(body.full_name ?? body.name ?? ''),
        requestedRole.toLowerCase(),
        now,
      ],
    );
    this.invalidateAdminCache();
    await this.auditChange(
      'admin_user.create',
      actor,
      'admin_user',
      (rows[0]?.id as string | undefined) ?? null,
      null,
      { email, role: requestedRole, status: 'active' },
    );
    return { ...rows[0], temporary_password: temporaryPassword };
  }

  async adminUserUpdate(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const [existing] = await this.rows(
      `select id::text, email, full_name, role, status, created_at, updated_at
       from admin_users where id = $1::uuid and deleted_at is null`,
      [id],
    );
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Admin foydalanuvchi topilmadi',
      });
    }

    let nextRole: string | null = null;
    if (body.role !== undefined && body.role !== null && body.role !== '') {
      const requestedRole = this.normalizeRoleInput(body.role);
      if (!requestedRole) {
        throw new BadRequestException({
          code: 'ADMIN_ROLE_INVALID',
          message: "Noto'g'ri rol qiymati",
        });
      }
      // O'z-o'zini o'zgartirish TAQIQLANADI (rol yo'nalishidan qat'iy
      // nazar) — bu faqat self-escalation'ni emas, balki "bittagina
      // SUPER_ADMIN o'zini tasodifan pastroq rolga tushirib, tizimni
      // boshqarib bo'lmaydigan holga keltirish" xavfini ham yopadi.
      if (actor && actor.id === id && actor.actorType === 'admin') {
        throw new ForbiddenException({
          code: 'ADMIN_SELF_ROLE_CHANGE_DENIED',
          message: "O'zingizning rolingizni o'zgartira olmaysiz",
        });
      }
      if (
        requestedRole === Role.SUPER_ADMIN &&
        actor?.role !== Role.SUPER_ADMIN
      ) {
        throw new ForbiddenException({
          code: 'ADMIN_ROLE_ESCALATION_DENIED',
          message:
            'Faqat SUPER_ADMIN boshqa foydalanuvchiga SUPER_ADMIN bera oladi',
        });
      }
      nextRole = requestedRole.toLowerCase();
    }

    const rows = await this.rows(
      `update admin_users
       set email = coalesce(nullif($2, ''), email),
           full_name = coalesce(nullif($3, ''), full_name),
           role = coalesce($4, role),
           updated_at = now()
       where id = $1::uuid and deleted_at is null
       returning id::text, email, full_name, role, status, created_at, updated_at`,
      [
        id,
        body.email ? String(body.email).toLowerCase() : null,
        body.full_name ? String(body.full_name) : null,
        nextRole,
      ],
    );
    this.invalidateAdminCache();
    await this.auditChange(
      'admin_user.update',
      actor,
      'admin_user',
      id,
      existing,
      rows[0] ?? existing,
    );
    return rows[0] ?? { id, ...body, updated_at: new Date().toISOString() };
  }

  async adminUserStatus(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    if (actor && actor.id === id && actor.actorType === 'admin') {
      throw new ForbiddenException({
        code: 'ADMIN_SELF_STATUS_CHANGE_DENIED',
        message: "O'zingizning statusingizni o'zgartira olmaysiz",
      });
    }
    const [existing] = await this.rows(
      `select id::text, status from admin_users where id = $1::uuid`,
      [id],
    );
    const nextStatus = String(body.status ?? 'active');
    const rows = await this.rows(
      `update admin_users
       set status = $2, updated_at = now()
       where id = $1::uuid
       returning id::text, email, full_name, role, status, created_at, updated_at`,
      [id, nextStatus],
    );
    this.invalidateAdminCache();
    await this.auditChange(
      'admin_user.status',
      actor,
      'admin_user',
      id,
      existing ?? null,
      { id, status: nextStatus },
    );
    return (
      rows[0] ?? {
        id,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      }
    );
  }

  async adminUserReset2fa(id: string) {
    const now = new Date().toISOString();
    const rows = await this.rows(
      `update admin_users
       set totp_secret = null, updated_at = $2
       where id = $1::uuid
       returning id::text`,
      [id, now],
    );

    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Admin foydalanuvchi topilmadi',
      });
    }

    await this.postgres.query(
      `delete from admin_recovery_codes where admin_id = $1::uuid`,
      [id],
    );
    await authSessionStore.revokeActor(id);
    this.invalidateAdminCache();
    return { id, two_factor_reset: true, sessions_revoked: true };
  }

  /**
   * Har bir rolga biriktirilgan haqiqiy ruxsatlar — `common/permissions.ts`
   * dagi kompilyatsiya vaqtidagi `rolePermissions` xaritasidan o'qiladi
   * (avval bu yerda soxta, RolesGuard bilan bog'liq bo'lmagan hardcoded
   * ro'yxat qaytardi). SUPER_ADMIN uchun cheksiz ruxsat shu xarita orqali
   * ifodalanadi (barcha Permission qiymatlari).
   */
  roles() {
    return Object.entries(rolePermissions).map(([role, permissions]) => ({
      id: role,
      permissions,
    }));
  }

  /**
   * Rol ruxsatlarini DB'da saqlash hali qo'llab-quvvatlanmaydi — ruxsatlar
   * `common/permissions.ts`dagi kompilyatsiya vaqtidagi xaritada
   * belgilangan va to'g'ridan-to'g'ri `RolesGuard`/`actorHasPermissions`
   * orqali ishlaydi. Muvaffaqiyatni soxta ravishda ko'rsatmaslik uchun bu
   * yerda aniq xato qaytariladi (frontend hozircha faqat ko'rish rejimida).
   */
  rolePermissions(): never {
    throw new BadRequestException({
      code: 'ROLE_PERMISSIONS_NOT_EDITABLE',
      message:
        "Rol ruxsatlarini tahrirlash hozircha qo'llab-quvvatlanmaydi. Ruxsatlar backend kodida belgilangan.",
    });
  }

  async auditLogs(query: QueryLike = {}) {
    return this.rows(`
      select
        al.id::text,
        al.actor_type,
        al.actor_id::text,
        coalesce(au.full_name, au.email) as actor_name,
        al.action,
        al.entity_type,
        al.entity_id::text,
        al.old_value,
        al.new_value,
        coalesce(al.metadata, '{}'::jsonb) ||
          jsonb_build_object('target', concat_ws(':', al.entity_type, al.entity_id::text)) as metadata,
        al.ip_address,
        al.user_agent,
        al.request_id,
        al.created_at
      from audit_logs al
      left join admin_users au
        on al.actor_type = 'admin' and au.id = al.actor_id
      order by al.created_at desc
      ${this.limitClause(query)}
    `);
  }

  async settings() {
    return this.cache.getOrSet('admin:settings', 300, async () => {
      const rows = await this.rows(`
        select group_key, value
        from admin_settings
        order by group_key asc
      `);
      const settings: Record<string, Record<string, unknown>> = {
        ...DEFAULT_ADMIN_SETTINGS,
      };

      for (const row of rows) {
        const group = String(row.group_key ?? '');
        if (!group) {
          continue;
        }
        settings[group] = {
          ...(DEFAULT_ADMIN_SETTINGS[group] ?? {}),
          ...objectValue(row.value),
        };
      }

      return settings;
    });
  }

  async settingsGroup(
    actor: RequestActor | undefined,
    group: string,
    body: Record<string, unknown>,
  ) {
    const groupKey = normalizeSettingsGroup(group);
    const value = objectValue(body);
    const actorId = adminActorUuid(actor);
    const rows = await this.rows(
      `
        insert into admin_settings (group_key, value, updated_by, created_at, updated_at)
        values (
          $1,
          ($2)::jsonb,
          (select id from admin_users where id = $3::uuid),
          now(),
          now()
        )
        on conflict (group_key)
        do update set
          value = admin_settings.value || excluded.value,
          updated_by = excluded.updated_by,
          updated_at = now()
        returning group_key, value, updated_at
      `,
      [groupKey, JSON.stringify(value), actorId],
    );

    this.invalidateAdminCache();
    void this.cache.delByPattern('settings:*');
    await this.audit('settings.update', actor, {
      group: groupKey,
      value,
    });

    const updated = rows[0] ?? {
      group_key: groupKey,
      value,
      updated_at: new Date().toISOString(),
    };
    return {
      group: String(updated.group_key ?? groupKey),
      ...objectValue(updated.value),
      updated_at: updated.updated_at,
    };
  }

  providerSettings(provider: string, body: Record<string, unknown>) {
    this.invalidateAdminCache();
    return {
      provider,
      ...body,
      updated_at: new Date().toISOString(),
      secrets_masked: true,
    };
  }

  providerTest(provider: string) {
    return { provider, ok: true, checked_at: new Date().toISOString() };
  }
}
