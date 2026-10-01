import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppCacheService } from '../infrastructure/cache.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { CreateHeroBackgroundDto } from './dto/create-hero-background.dto';
import { HeroBackgroundQueryDto } from './dto/hero-background-query.dto';
import { UpdateHeroBackgroundDto } from './dto/update-hero-background.dto';

export interface HeroBackgroundItem {
  id: string;
  page: string;
  title: Record<string, string> | string | null;
  title_text: string;
  subtitle: Record<string, string> | string | null;
  subtitle_text: string;
  imageUrl: string;
  image_url: string;
  isActive: boolean;
  is_active: boolean;
  sortOrder: number;
  sort_order: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  created_at: string;
  updatedAt: string;
  updated_at: string;
}

interface DbHeroRow {
  id: string;
  page: string;
  title: unknown;
  subtitle: unknown;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  metadata: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(val: string): boolean {
  return UUID_REGEX.test(val);
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function localizedString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  const obj = objectOrNull(value);
  if (obj) {
    const uz = obj.uz;
    const ru = obj.ru;
    const en = obj.en;
    if (typeof uz === 'string' && uz.trim()) return uz;
    if (typeof ru === 'string' && ru.trim()) return ru;
    if (typeof en === 'string' && en.trim()) return en;
  }
  return fallback;
}

function normalizeJsonField(
  value: unknown,
): Record<string, unknown> | string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { uz: value };
    }
    return { uz: value };
  }
  return null;
}

function mapRowToDto(row: DbHeroRow): HeroBackgroundItem {
  const meta = objectOrNull(row.metadata) ?? {};
  const createdAtStr =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at ?? '');
  const updatedAtStr =
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at ?? '');

  const titleParsed: unknown =
    typeof row.title === 'string' &&
    (row.title.startsWith('{') || row.title.startsWith('['))
      ? (() => {
          try {
            return JSON.parse(row.title) as unknown;
          } catch {
            return row.title;
          }
        })()
      : row.title;

  const subtitleParsed: unknown =
    typeof row.subtitle === 'string' &&
    (row.subtitle.startsWith('{') || row.subtitle.startsWith('['))
      ? (() => {
          try {
            return JSON.parse(row.subtitle) as unknown;
          } catch {
            return row.subtitle;
          }
        })()
      : row.subtitle;

  const titleText = localizedString(titleParsed, '');
  const subtitleText = localizedString(subtitleParsed, '');

  return {
    id: row.id,
    page: row.page,
    title: titleParsed as Record<string, string> | string | null,
    title_text: titleText,
    subtitle: subtitleParsed as Record<string, string> | string | null,
    subtitle_text: subtitleText,
    imageUrl: row.image_url,
    image_url: row.image_url,
    isActive: Boolean(row.is_active),
    is_active: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
    sort_order: Number(row.sort_order ?? 0),
    metadata: meta,
    createdAt: createdAtStr,
    created_at: createdAtStr,
    updatedAt: updatedAtStr,
    updated_at: updatedAtStr,
  };
}

@Injectable()
export class HeroBackgroundsService {
  constructor(
    private readonly postgres: PostgresService,
    private readonly cache: AppCacheService,
  ) {}

  /**
   * Public User API: faol bo'lgan barcha hero background rasmlarini olish.
   * Agar `page` ko'rsatilsa, o'sha sahifa bo'yicha filtrlangan ro'yxat qaytadi.
   */
  async findPublic(page?: string): Promise<HeroBackgroundItem[]> {
    const normalizedPage = page?.trim().toLowerCase();
    const cacheKey = normalizedPage
      ? `hero-backgrounds:public:page:${normalizedPage}`
      : 'hero-backgrounds:public:all';

    return this.cache.getOrSet(cacheKey, 300, async () => {
      let sql = `
        SELECT id::text, page, title, subtitle, image_url, is_active, sort_order, metadata, created_at, updated_at
        FROM hero_backgrounds
        WHERE is_active = true
      `;
      const params: unknown[] = [];

      if (normalizedPage) {
        params.push(normalizedPage);
        sql += ` AND LOWER(page) = LOWER($${params.length})`;
      }

      sql += ` ORDER BY sort_order ASC, created_at DESC`;

      try {
        const rows = await this.postgres.query<DbHeroRow>(sql, params);
        return (rows ?? []).map(mapRowToDto);
      } catch (err: unknown) {
        const pgError = err as { code?: string };
        // 42P01: undefined_table (bazada jadval hali bo'lmasa 500 bermasdan bo'sh ro'yxat qaytaramiz)
        if (pgError?.code === '42P01') {
          return [];
        }
        throw err;
      }
    });
  }

  /**
   * Public User API: berilgan sahifa (masalan: home, hotels, restaurants, transport)
   * uchun faol bo'lgan eng asosiy (birinchi) hero background rasmini olish.
   */
  async findPublicByPage(page: string): Promise<HeroBackgroundItem> {
    const normalizedPage = page?.trim().toLowerCase();
    if (!normalizedPage) {
      throw new BadRequestException({
        code: 'PAGE_PARAMETER_REQUIRED',
        message: 'Sahifa parametri kiritilishi shart',
      });
    }

    const items = await this.findPublic(normalizedPage);
    if (!items || items.length === 0) {
      throw new NotFoundException({
        code: 'HERO_BACKGROUND_NOT_FOUND',
        message: `'${page}' sahifasi uchun faol hero fon rasmi topilmadi`,
      });
    }

    return items[0];
  }

  /**
   * Public User API: barcha faol hero background rasmlarini sahifa bo'yicha
   * lug'at (Record<string, HeroBackgroundItem>) ko'rinishida olish.
   */
  async findPublicMap(): Promise<Record<string, HeroBackgroundItem>> {
    const items = await this.findPublic();
    const map: Record<string, HeroBackgroundItem> = {};
    for (const item of items) {
      const pageKey = item.page.toLowerCase();
      if (!map[pageKey]) {
        map[pageKey] = item;
      }
      if (!map[item.page]) {
        map[item.page] = item;
      }
    }
    return map;
  }

  /**
   * Admin API: hero background rasmlari ro'yxatini olish (barcha statuslar).
   */
  async findAll(
    query: HeroBackgroundQueryDto = {},
  ): Promise<HeroBackgroundItem[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.page?.trim()) {
      params.push(query.page.trim().toLowerCase());
      conditions.push(`LOWER(page) = LOWER($${params.length})`);
    }

    const activeFilter = query.isActive ?? query.is_active;
    if (typeof activeFilter === 'boolean') {
      params.push(activeFilter);
      conditions.push(`is_active = $${params.length}`);
    }

    if (query.search?.trim()) {
      params.push(`%${query.search.trim().toLowerCase()}%`);
      conditions.push(
        `(LOWER(page) LIKE $${params.length} OR LOWER(title::text) LIKE $${params.length})`,
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit ? Math.min(Math.max(query.limit, 1), 100) : 50;
    const offset = query.offset ? Math.max(query.offset, 0) : 0;

    params.push(limit);
    const limitParamIndex = params.length;
    params.push(offset);
    const offsetParamIndex = params.length;

    const sql = `
      SELECT id::text, page, title, subtitle, image_url, is_active, sort_order, metadata, created_at, updated_at
      FROM hero_backgrounds
      ${whereClause}
      ORDER BY sort_order ASC, created_at DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    const rows = await this.postgres.query<DbHeroRow>(sql, params);
    return (rows ?? []).map(mapRowToDto);
  }

  /**
   * Admin API: bitta hero background rasmini id bo'yicha olish.
   */
  async findOne(id: string): Promise<HeroBackgroundItem> {
    if (!isUuid(id)) {
      throw new BadRequestException({
        code: 'INVALID_HERO_BACKGROUND_ID',
        message: "Noto'g'ri hero background ID formati",
      });
    }

    const rows = await this.postgres.query<DbHeroRow>(
      `
        SELECT id::text, page, title, subtitle, image_url, is_active, sort_order, metadata, created_at, updated_at
        FROM hero_backgrounds
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [id],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'HERO_BACKGROUND_NOT_FOUND',
        message: 'Hero fon rasmi topilmadi',
      });
    }

    return mapRowToDto(rows[0]);
  }

  /**
   * Admin API: yangi hero background rasmini yaratish.
   */
  async create(dto: CreateHeroBackgroundDto): Promise<HeroBackgroundItem> {
    const page = dto.page.trim().toLowerCase();
    const rawImageUrl = dto.imageUrl ?? dto.image_url;
    if (
      !rawImageUrl ||
      typeof rawImageUrl !== 'string' ||
      !rawImageUrl.trim()
    ) {
      throw new BadRequestException({
        code: 'IMAGE_URL_REQUIRED',
        message: 'imageUrl yoki image_url kiritilishi shart',
      });
    }
    const imageUrl = rawImageUrl.trim();
    const titleJson = normalizeJsonField(dto.title);
    const subtitleJson = normalizeJsonField(dto.subtitle);
    const isActive = dto.isActive ?? dto.is_active ?? true;
    const sortOrder = dto.sortOrder ?? dto.sort_order ?? 0;
    const metadata = dto.metadata ?? {};

    const rows = await this.postgres.query<DbHeroRow>(
      `
        INSERT INTO hero_backgrounds (
          page,
          title,
          subtitle,
          image_url,
          is_active,
          sort_order,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          ($2)::jsonb,
          ($3)::jsonb,
          $4,
          $5,
          $6,
          ($7)::jsonb,
          NOW(),
          NOW()
        )
        RETURNING id::text, page, title, subtitle, image_url, is_active, sort_order, metadata, created_at, updated_at
      `,
      [
        page,
        titleJson ? JSON.stringify(titleJson) : null,
        subtitleJson ? JSON.stringify(subtitleJson) : null,
        imageUrl,
        isActive,
        sortOrder,
        JSON.stringify(metadata),
      ],
    );

    await this.invalidateCache();
    return mapRowToDto(rows[0]);
  }

  /**
   * Admin API: mavjud hero background rasmini yangilash.
   */
  async update(
    id: string,
    dto: UpdateHeroBackgroundDto,
  ): Promise<HeroBackgroundItem> {
    const existing = await this.findOne(id);

    const page =
      dto.page !== undefined ? dto.page.trim().toLowerCase() : existing.page;

    const rawImageUrl =
      dto.imageUrl !== undefined ? dto.imageUrl : dto.image_url;
    if (rawImageUrl !== undefined && (!rawImageUrl || !rawImageUrl.trim())) {
      throw new BadRequestException({
        code: 'IMAGE_URL_INVALID',
        message: "Rasm URL manzili bo'sh bo'lishi mumkin emas",
      });
    }
    const imageUrl =
      rawImageUrl !== undefined ? rawImageUrl.trim() : existing.imageUrl;

    const titleJson =
      dto.title !== undefined ? normalizeJsonField(dto.title) : existing.title;
    const subtitleJson =
      dto.subtitle !== undefined
        ? normalizeJsonField(dto.subtitle)
        : existing.subtitle;
    const isActive =
      dto.isActive !== undefined
        ? dto.isActive
        : dto.is_active !== undefined
          ? dto.is_active
          : existing.isActive;
    const sortOrder =
      dto.sortOrder !== undefined
        ? dto.sortOrder
        : dto.sort_order !== undefined
          ? dto.sort_order
          : existing.sortOrder;
    const metadata =
      dto.metadata !== undefined
        ? { ...existing.metadata, ...dto.metadata }
        : existing.metadata;

    const rows = await this.postgres.query<DbHeroRow>(
      `
        UPDATE hero_backgrounds
        SET
          page = $1,
          title = ($2)::jsonb,
          subtitle = ($3)::jsonb,
          image_url = $4,
          is_active = $5,
          sort_order = $6,
          metadata = ($7)::jsonb,
          updated_at = NOW()
        WHERE id = $8::uuid
        RETURNING id::text, page, title, subtitle, image_url, is_active, sort_order, metadata, created_at, updated_at
      `,
      [
        page,
        titleJson ? JSON.stringify(titleJson) : null,
        subtitleJson ? JSON.stringify(subtitleJson) : null,
        imageUrl,
        isActive,
        sortOrder,
        JSON.stringify(metadata),
        id,
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'HERO_BACKGROUND_NOT_FOUND',
        message: 'Yangilash uchun hero fon rasmi topilmadi',
      });
    }

    await this.invalidateCache();
    return mapRowToDto(rows[0]);
  }

  /**
   * Admin API: hero background rasmini o'chirish.
   */
  async remove(id: string): Promise<{ success: boolean; id: string }> {
    if (!isUuid(id)) {
      throw new BadRequestException({
        code: 'INVALID_HERO_BACKGROUND_ID',
        message: "Noto'g'ri hero background ID formati",
      });
    }

    // Mavjudligini tekshiramiz
    await this.findOne(id);

    await this.postgres.query(
      `
        DELETE FROM hero_backgrounds
        WHERE id = $1::uuid
      `,
      [id],
    );

    await this.invalidateCache();
    return { success: true, id };
  }

  /**
   * Admin API: faollik holatini almashtirish yoki belgilash.
   */
  async toggleActive(
    id: string,
    active?: boolean,
  ): Promise<HeroBackgroundItem> {
    const existing = await this.findOne(id);
    const newActive = active !== undefined ? active : !existing.isActive;

    const rows = await this.postgres.query<DbHeroRow>(
      `
        UPDATE hero_backgrounds
        SET is_active = $1, updated_at = NOW()
        WHERE id = $2::uuid
        RETURNING id::text, page, title, subtitle, image_url, is_active, sort_order, metadata, created_at, updated_at
      `,
      [newActive, id],
    );

    await this.invalidateCache();
    return mapRowToDto(rows[0]);
  }

  /**
   * Admin API: hero background rasmlari tartibini ommaviy yangilash.
   */
  async reorder(dto: {
    orderedIds?: string[];
    items?: Array<{
      id: string;
      sortOrder?: number;
      sort_order?: number;
    }>;
  }): Promise<{ success: boolean; updatedCount: number }> {
    const itemsToUpdate: Array<{ id: string; sortOrder: number }> = [];

    if (Array.isArray(dto.orderedIds)) {
      dto.orderedIds.forEach((id, index) => {
        if (typeof id === 'string' && isUuid(id.trim())) {
          itemsToUpdate.push({ id: id.trim(), sortOrder: index + 1 });
        }
      });
    } else if (Array.isArray(dto.items)) {
      for (const item of dto.items) {
        const order = item?.sortOrder ?? item?.sort_order;
        if (
          item &&
          typeof item.id === 'string' &&
          isUuid(item.id.trim()) &&
          typeof order === 'number'
        ) {
          itemsToUpdate.push({ id: item.id.trim(), sortOrder: order });
        }
      }
    }

    if (itemsToUpdate.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_REORDER_PAYLOAD',
        message: 'Reorder uchun orderedIds yoki items kiritilishi shart',
      });
    }

    let actualUpdatedCount = 0;
    await this.postgres.transaction(async (tx) => {
      for (const item of itemsToUpdate) {
        const rows = await tx.query<{ id: string }>(
          `UPDATE hero_backgrounds SET sort_order = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING id::text`,
          [item.sortOrder, item.id],
        );
        if (rows && rows.length > 0) {
          actualUpdatedCount++;
        }
      }
    });

    await this.invalidateCache();
    return { success: true, updatedCount: actualUpdatedCount };
  }

  private async invalidateCache(): Promise<void> {
    try {
      await Promise.allSettled([
        this.cache.delByPattern('hero-backgrounds:*'),
        this.cache.del('settings:public'),
        this.cache.delByPattern('settings:*'),
      ]);
    } catch {
      // Kesh xatosi asosiy oqimni to'xtatmasligi kerak
    }
  }
}
