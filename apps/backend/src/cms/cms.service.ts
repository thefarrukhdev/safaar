import { Injectable, NotFoundException } from '@nestjs/common';
import { AppCacheService } from '../infrastructure/cache.service';
import { PostgresService } from '../infrastructure/postgres.service';

type CmsRow = Record<string, unknown>;

const CMS_COLLECTION_TYPES: Record<string, string[]> = {
  banners: ['banner'],
  offers: ['offer'],
  news: ['news'],
  pages: ['page'],
  faqs: ['faq'],
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown, fallback = ''): string {
  return String(value ?? fallback);
}

function localizedText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  const localized = objectValue(value);
  return textValue(localized.uz ?? localized.ru ?? localized.en, fallback);
}

function numberValue(value: unknown, fallback = 0): number {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

@Injectable()
export class CmsService {
  constructor(
    private readonly cache: AppCacheService,
    private readonly postgres: PostgresService,
  ) {}

  async collection(name: string) {
    const types = CMS_COLLECTION_TYPES[name] ?? [name.replace(/s$/, '')];
    return this.cache.getOrSet(`cms:collection:${name}`, 300, async () => {
      const rows = await this.postgres.query<CmsRow>(
        `
          SELECT id::text, type, slug, title, body, status, metadata,
                 published_at, created_at, updated_at
          FROM cms_entries
          WHERE type = ANY($1::text[])
            AND status IN ('published', 'active')
          ORDER BY
            COALESCE(
              CASE WHEN metadata ->> 'sortOrder' ~ '^-?[0-9]+$' THEN (metadata ->> 'sortOrder')::int END,
              CASE WHEN metadata ->> 'order' ~ '^-?[0-9]+$' THEN (metadata ->> 'order')::int END,
              9999
            ),
            COALESCE(published_at, created_at) DESC
        `,
        [types],
      );
      return rows.map((row) => this.cmsDto(row));
    });
  }

  async one(name: string, slug: string) {
    const types = CMS_COLLECTION_TYPES[name] ?? [name.replace(/s$/, '')];
    return this.cache.getOrSet(`cms:entry:${name}:${slug}`, 300, async () => {
      const rows = await this.postgres.query<CmsRow>(
        `
          SELECT id::text, type, slug, title, body, status, metadata,
                 published_at, created_at, updated_at
          FROM cms_entries
          WHERE type = ANY($1::text[])
            AND slug = $2
            AND status IN ('published', 'active')
          LIMIT 1
        `,
        [types, slug],
      );
      if (!rows[0]) {
        throw new NotFoundException({
          code: 'CMS_ENTRY_NOT_FOUND',
          message: 'CMS yozuvi topilmadi',
        });
      }
      return this.cmsDto(rows[0]);
    });
  }

  async offers() {
    const cmsOffers = await this.collection('offers');
    
    // Note: Cache this query as well to avoid DB hammering
    let promos: any[] = [];
    try {
      promos = await this.cache.getOrSet('cms:promotions:active', 300, async () => {
        const rows = await this.postgres.query(`
          SELECT 
            p.id, p.entity_type, p.entity_name as name, 
            p.old_price_sum, p.new_price_sum, p.discount_percent, p.end_date, p.status,
            h.slug as hotel_slug, hc.name as hotel_city_name, 
            (SELECT url FROM media_files m WHERE m.owner_type = 'hotel' AND m.owner_id = h.id AND m.visibility = 'public' LIMIT 1) as hotel_image,
            bc.id as bus_company_id, bc.name as bus_company_name,
            (SELECT url FROM media_files m WHERE m.owner_type = 'bus_company' AND m.owner_id = bc.id AND m.visibility = 'public' LIMIT 1) as bus_image
          FROM promotions p
          LEFT JOIN hotel_rooms hr ON p.entity_type = 'room' AND p.entity_id = hr.id
          LEFT JOIN hotels h ON hr.hotel_id = h.id
          LEFT JOIN cities hc ON h.city_id = hc.id
          LEFT JOIN vehicles v ON p.entity_type = 'vehicle' AND p.entity_id = v.id
          LEFT JOIN bus_companies bc ON v.company_id = bc.id
          WHERE p.status IN ('approved', 'active')
        `);
        
        return rows.map(row => {
          const isRoom = row.entity_type === 'room';
          const titleStr = isRoom ? (row.name) : (row.bus_company_name || row.name);
          const cityObj = isRoom && row.hotel_city_name ? objectValue(row.hotel_city_name) : {};
          return {
            id: row.id,
            type: 'offer',
            slug: isRoom ? `hotels/${row.hotel_slug}` : `transport/${row.bus_company_id}`,
            title: { uz: titleStr, ru: titleStr, en: titleStr },
            name: titleStr,
            title_text: titleStr,
            name_text: titleStr,
            body: {},
            body_text: '',
            content: '',
            status: row.status,
            metadata: {},
            old_price: Number(row.old_price_sum) || 0,
            new_price: Number(row.new_price_sum) || 0,
            discount_percent: Number(row.discount_percent) || 0,
            ends_at: row.end_date,
            image_url: isRoom ? row.hotel_image : row.bus_image,
            city_name: cityObj,
          };
        });
      });
    } catch (e) {
      console.error('Failed to fetch promos:', e);
      promos = [
        {
          id: 'error-debug',
          type: 'offer',
          slug: 'hotels/error',
          title: { uz: String(e.message), ru: String(e.message), en: String(e.message) },
          name: String(e.message),
          title_text: String(e.message),
          name_text: String(e.message),
          body: {},
          body_text: '',
          content: '',
          status: 'published',
          metadata: {},
          old_price: 9999,
          new_price: 9999,
          discount_percent: 0,
          ends_at: null,
          image_url: null,
          city_name: { uz: 'Error City' },
        }
      ];
    }

    return [...cmsOffers, ...promos];
  }

  async promoBar() {
    return this.cache.getOrSet('cms:promo-bar', 60, async () => {
      const rows = await this.postgres.query<CmsRow>(`
        SELECT id::text, title, metadata, status, published_at, created_at, updated_at
        FROM cms_entries
        WHERE type = 'promo_bar'
          AND status IN ('published', 'active')
        ORDER BY COALESCE(published_at, created_at) DESC
        LIMIT 1
      `);
      if (!rows[0]) return null;

      const row = rows[0];
      const meta = objectValue(row.metadata);
      return {
        id: row.id,
        is_active: booleanValue(meta.is_active ?? meta.isActive, true),
        text: meta.text ?? row.title,
        badge: meta.badge,
        link: meta.link,
        link_text: meta.link_text ?? meta.linkText,
        ends_at: meta.ends_at ?? meta.endsAt ?? null,
        is_dismissible: booleanValue(
          meta.is_dismissible ?? meta.isDismissible,
          true,
        ),
        updated_at: row.updated_at,
      };
    });
  }

  publicSettings() {
    return this.cache.getOrSet('settings:public', 300, async () => {
      const rows = await this.postgres.query<{
        value: Record<string, unknown>;
      }>(
        `
          select value
          from admin_settings
          where group_key = 'general'
          limit 1
        `,
      );
      const general = objectValue(rows[0]?.value);
      const languages = Array.isArray(general.languages)
        ? general.languages.map(String)
        : [];

      return {
        support_phone: textValue(general.support_phone),
        support_email: textValue(general.support_email),
        maintenance_mode: Boolean(general.maintenance_mode ?? false),
        languages,
        currency: textValue(general.currency),
        social_links: objectValue(general.social_links),
      };
    });
  }

  private cmsDto(row: CmsRow) {
    const meta = objectValue(row.metadata);
    const titleText = localizedText(row.title, textValue(row.slug));
    const bodyText = localizedText(row.body);
    return {
      id: row.id,
      type: row.type,
      slug: row.slug,
      title: row.title,
      name: row.title,
      body: row.body,
      title_text: titleText,
      name_text: titleText,
      body_text: bodyText,
      content: bodyText,
      question: row.title,
      answer: row.body,
      status: row.status,
      metadata: meta,
      published_at: row.published_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      hotel_id: meta.hotel_id ?? meta.hotelId ?? '',
      listing_type: meta.listing_type ?? meta.listingType ?? '',
      city_name: meta.city_name ?? meta.cityName ?? {},
      image_url: meta.image_url ?? meta.imageUrl ?? '',
      // Narx kalitlari uchta avlodda yozilgan: `old_price`/`new_price`
      // (migratsiya + seed), `oldPrice`/`newPrice` (eski admin Deals sahifasi)
      // va `oldPriceSum`/`newPriceSum` (hozirgi admin Deals sahifasi).
      // `cmsUpdate` metadata'ni `||` bilan SHALLOW merge qiladi, ya'ni eski
      // kalitlar o'chmaydi — shuning uchun eng oxirgi yozilgan kalit
      // (`*Sum`) birinchi o'qiladi, aks holda admin narxni tahrirlagandan
      // keyin ham ommaviy sahifada eski narx ko'rinib qolardi.
      // `??` null/undefined'ni o'tkazib yuboradi, shuning uchun admin narx
      // maydonini bo'sh qoldirsa (`oldPriceSum: null`) eski qiymat saqlanadi.
      old_price: numberValue(
        meta.oldPriceSum ?? meta.old_price ?? meta.oldPrice,
      ),
      new_price: numberValue(
        meta.newPriceSum ?? meta.new_price ?? meta.newPrice,
      ),
      discount_percent: numberValue(
        meta.discount_percent ?? meta.discountPercent,
      ),
      ends_at: meta.ends_at ?? meta.endsAt ?? null,
      link: meta.link ?? '',
      order: numberValue(meta.order ?? meta.sortOrder),
      category_key: meta.category_key ?? meta.categoryKey ?? '',
      category_default: meta.category_default ?? meta.categoryDefault ?? '',
      excerpt: meta.excerpt ?? meta.summary ?? '',
      seo_title: meta.seo_title ?? meta.seoTitle ?? titleText,
      seo_description: meta.seo_description ?? meta.seoDescription ?? '',
      best_time_to_visit: meta.best_time_to_visit ?? meta.bestTimeToVisit ?? '',
      cuisine: meta.cuisine ?? '',
      address: meta.address ?? '',
      phone: meta.phone ?? '',
      average_check: numberValue(meta.average_check ?? meta.averageCheck),
      working_hours: meta.working_hours ?? meta.workingHours ?? '',
      reviews_count: numberValue(meta.reviews_count ?? meta.reviewsCount),
      rating: numberValue(meta.rating),
      seats: numberValue(meta.seats),
      has_driver: booleanValue(meta.has_driver ?? meta.hasDriver, false),
      fuel_type: meta.fuel_type ?? meta.fuelType ?? '',
      transmission: meta.transmission ?? '',
      price_per_day: numberValue(meta.price_per_day ?? meta.pricePerDay),
    };
  }
}
