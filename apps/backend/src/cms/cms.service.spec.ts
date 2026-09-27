import { NotFoundException } from '@nestjs/common';
import { AppCacheService } from '../infrastructure/cache.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { CmsService } from './cms.service';

describe('CmsService pages', () => {
  let service: CmsService;
  let postgres: jest.Mocked<Pick<PostgresService, 'query'>>;
  let cache: {
    getOrSet: jest.Mock;
  };

  beforeEach(() => {
    postgres = {
      query: jest.fn(),
    };
    cache = {
      getOrSet: jest.fn(
        async <T>(
          _key: string,
          _ttl: number,
          producer: () => Promise<T> | T,
        ): Promise<T> => Promise.resolve(producer()),
      ),
    };
    service = new CmsService(
      cache as unknown as AppCacheService,
      postgres as unknown as PostgresService,
    );
  });

  it('returns published CMS pages with text helpers for the user panel', async () => {
    postgres.query.mockResolvedValue([
      {
        id: '00000000-0000-7005-0000-000000000004',
        type: 'page',
        slug: 'about',
        title: { uz: 'Biz haqimizda', ru: null, en: 'About us' },
        body: { uz: 'Safaar haqida matn', ru: null, en: null },
        status: 'published',
        metadata: { menu: 'footer', seoTitle: 'Biz haqimizda' },
        published_at: '2026-08-05T07:00:00.000Z',
        created_at: '2026-08-05T07:00:00.000Z',
        updated_at: '2026-08-05T07:00:00.000Z',
      },
    ]);

    await expect(service.collection('pages')).resolves.toEqual([
      expect.objectContaining({
        slug: 'about',
        title_text: 'Biz haqimizda',
        body_text: 'Safaar haqida matn',
        content: 'Safaar haqida matn',
        seo_title: 'Biz haqimizda',
      }),
    ]);
    expect(postgres.query).toHaveBeenCalledWith(
      expect.stringContaining("status IN ('published', 'active')"),
      [['page']],
    );
  });

  /**
   * Admin Deals sahifasi (`web-admin/app/(dashboard)/cms/deals`) metadata
   * kalitlarini `oldPrice`/`newPrice`dan `oldPriceSum`/`newPriceSum`ga
   * o'zgartirdi va `listingType` qo'shdi. `cmsUpdate` metadata'ni `||` bilan
   * shallow merge qilgani uchun eski kalitlar bazada qolib ketadi — shuning
   * uchun ommaviy `GET /cms/offers` uchala formatni ham to'g'ri o'qishi shart.
   */
  describe('offers — narx metadata formatlari', () => {
    const offerRow = (metadata: Record<string, unknown>) => ({
      id: '00000000-0000-7005-0000-000000000010',
      type: 'offer',
      slug: 'hyatt-regency',
      title: { uz: 'Hashamatli dam olish', ru: null, en: null },
      body: { uz: null, ru: null, en: null },
      status: 'published',
      metadata,
      published_at: '2026-09-01T07:00:00.000Z',
      created_at: '2026-09-01T07:00:00.000Z',
      updated_at: '2026-09-01T07:00:00.000Z',
    });

    it('eski `old_price`/`new_price` (migratsiya + seed) formati avvalgidek ishlaydi', async () => {
      postgres.query.mockResolvedValue([
        offerRow({ old_price: 45000000, new_price: 31500000 }),
      ]);

      await expect(service.offers()).resolves.toEqual([
        expect.objectContaining({
          old_price: 45000000,
          new_price: 31500000,
        }),
      ]);
    });

    it('eski admin panel formati `oldPrice`/`newPrice` ham ishlaydi', async () => {
      postgres.query.mockResolvedValue([
        offerRow({ oldPrice: 500000, newPrice: 350000 }),
      ]);

      await expect(service.offers()).resolves.toEqual([
        expect.objectContaining({ old_price: 500000, new_price: 350000 }),
      ]);
    });

    it('yangi `oldPriceSum`/`newPriceSum` formati nol emas, haqiqiy narxni qaytaradi', async () => {
      postgres.query.mockResolvedValue([
        offerRow({
          oldPriceSum: 700000,
          newPriceSum: 490000,
          discountPercent: 30,
          listingType: 'dachas',
        }),
      ]);

      const [deal] = (await service.offers()) as Array<Record<string, unknown>>;
      expect(deal.old_price).toBe(700000);
      expect(deal.new_price).toBe(490000);
      expect(deal.old_price).not.toBe(0);
      expect(deal.new_price).not.toBe(0);
      expect(deal.discount_percent).toBe(30);
      expect(deal.listing_type).toBe('dachas');
    });

    it("`listing_type` snake_case va camelCase metadata uchun qaytariladi, bo'lmasa bo'sh satr", async () => {
      postgres.query.mockResolvedValueOnce([
        offerRow({ listing_type: 'restaurants' }),
      ]);
      await expect(service.offers()).resolves.toEqual([
        expect.objectContaining({ listing_type: 'restaurants' }),
      ]);

      postgres.query.mockResolvedValueOnce([
        offerRow({ listingType: 'transport' }),
      ]);
      await expect(service.offers()).resolves.toEqual([
        expect.objectContaining({ listing_type: 'transport' }),
      ]);

      postgres.query.mockResolvedValueOnce([offerRow({ old_price: 10 })]);
      await expect(service.offers()).resolves.toEqual([
        expect.objectContaining({ listing_type: '' }),
      ]);
    });

    it("metadata umuman bo'lmasa ham buzilmaydi (0 fallback saqlanadi)", async () => {
      postgres.query.mockResolvedValue([offerRow({})]);

      await expect(service.offers()).resolves.toEqual([
        expect.objectContaining({
          old_price: 0,
          new_price: 0,
          listing_type: '',
        }),
      ]);
    });

    it("eski yozuv yangi admin panelda tahrirlansa (ikkala kalit ham bor) yangi narx g'olib", async () => {
      // `cmsUpdate` shallow merge qiladi: eski `old_price` o'chmaydi, yangi
      // `oldPriceSum` ustiga qo'shiladi. Admin oxirgi kiritgan qiymat
      // ko'rinishi kerak, aks holda ommaviy sahifada eski narx qolib ketardi.
      postgres.query.mockResolvedValue([
        offerRow({
          old_price: 45000000,
          new_price: 31500000,
          oldPriceSum: 40000000,
          newPriceSum: 28000000,
        }),
      ]);

      await expect(service.offers()).resolves.toEqual([
        expect.objectContaining({
          old_price: 40000000,
          new_price: 28000000,
        }),
      ]);
    });

    it("admin narx maydonini bo'sh qoldirsa (`null`) eski qiymat saqlanadi", async () => {
      postgres.query.mockResolvedValue([
        offerRow({
          old_price: 45000000,
          new_price: 31500000,
          oldPriceSum: null,
          newPriceSum: null,
        }),
      ]);

      await expect(service.offers()).resolves.toEqual([
        expect.objectContaining({
          old_price: 45000000,
          new_price: 31500000,
        }),
      ]);
    });
  });

  it('loads one public page by slug and hides missing drafts', async () => {
    postgres.query.mockResolvedValueOnce([]);

    await expect(service.one('pages', 'draft-page')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(cache.getOrSet).toHaveBeenCalledWith(
      'cms:entry:pages:draft-page',
      300,
      expect.any(Function),
    );
  });

  /**
   * Regression: PROMO-ENUM-500 — "Chegirmadagi takliflar" (bosh sahifa,
   * `GET /cms/offers`) hamkor tomonidan yaratilib admin tomonidan
   * tasdiqlangan (`decidePromotion` → `status = 'published'`) promotionni
   * KO'RSATA OLMASDI: SQL `WHERE p.status IN ('published', 'approved')`
   * edi, lekin `'approved'` `PromotionStatus` enumining haqiqiy a'zosi
   * EMAS (faqat pending_review/published/rejected — admin bironta ham
   * hech qachon `'approved'` yozmaydi, `decidePromotion()`ga qarang).
   * Har safar promotions jadvalida BIRON BIR qator bo'lsa (status qanday
   * bo'lishidan qat'i nazar — Postgres IN-list qiymatlarini ustun turiga
   * qarab avval CAST qiladi), real Postgresda tasdiqlangan:
   * `ERROR: invalid input value for enum "PromotionStatus": "approved"`.
   * Bundan tashqari eski SQL sanalar oralig'ini UMUMAN tekshirmasdi —
   * muddati o'tgan/hali boshlanmagan promotion ham abadiy ko'rinardi.
   */
  describe('offers() — promotions-backed deals (promotions jadvalidan)', () => {
    const cmsOfferRow = {
      id: 'cms-offer-1',
      type: 'offer',
      slug: 'static-cms-offer',
      title: { uz: 'CMS orqali', ru: null, en: null },
      body: { uz: null, ru: null, en: null },
      status: 'published',
      metadata: { oldPriceSum: 100000, newPriceSum: 90000 },
      published_at: '2026-09-01T00:00:00.000Z',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    };

    it("the promotions SQL no longer filters on the invalid 'approved' literal, and always scopes to the active date window", async () => {
      postgres.query
        .mockResolvedValueOnce([cmsOfferRow]) // collection('offers')
        .mockResolvedValueOnce([]); // promotions query

      await service.offers();

      const promotionsCall = postgres.query.mock.calls.find(([sql]) =>
        String(sql).includes('FROM promotions'),
      );
      expect(promotionsCall).toBeDefined();
      const [sql] = promotionsCall!;
      expect(String(sql)).not.toContain("'approved'");
      expect(String(sql)).toContain(
        'p.status = \'published\'::"PromotionStatus"',
      );
      expect(String(sql)).toContain('p.start_date <= CURRENT_DATE');
      expect(String(sql)).toContain('p.end_date >= CURRENT_DATE');
    });

    it('maps an approved-and-active hotel room promotion into a correct public deal (discount, prices, dates, entity info)', async () => {
      postgres.query
        .mockResolvedValueOnce([cmsOfferRow])
        .mockResolvedValueOnce([
          {
            id: 'promo-room-1',
            entity_type: 'room',
            name: 'Standart xona',
            old_price_sum: '500000',
            new_price_sum: '350000',
            discount_percent: 30,
            end_date: '2026-10-01',
            status: 'published',
            hotel_slug: 'grand-hotel',
            hotel_city_name: { uz: 'Toshkent' },
            hotel_image: 'https://cdn.example.com/hotel.jpg',
            bus_company_id: null,
            bus_company_name: null,
            bus_image: null,
          },
        ]);

      const result = (await service.offers()) as Array<Record<string, unknown>>;
      const promoDeal = result.find((r) => r.id === 'promo-room-1');

      expect(promoDeal).toMatchObject({
        slug: 'hotels/grand-hotel',
        old_price: 500000,
        new_price: 350000,
        discount_percent: 30,
        ends_at: '2026-10-01',
        image_url: 'https://cdn.example.com/hotel.jpg',
      });
      expect((promoDeal!.title as Record<string, string>).uz).toBe(
        'Standart xona',
      );
      expect(promoDeal!.city_name).toEqual({ uz: 'Toshkent' });
    });

    it('maps an approved-and-active vehicle (rent-a-car) promotion into a correct public deal', async () => {
      postgres.query
        .mockResolvedValueOnce([cmsOfferRow])
        .mockResolvedValueOnce([
          {
            id: 'promo-vehicle-1',
            entity_type: 'vehicle',
            name: 'Chevrolet Cobalt',
            old_price_sum: '300000',
            new_price_sum: '240000',
            discount_percent: 20,
            end_date: '2026-10-01',
            status: 'published',
            hotel_slug: null,
            hotel_city_name: null,
            hotel_image: null,
            bus_company_id: 'bus-co-1',
            bus_company_name: 'Afrosiyob',
            bus_image: 'https://cdn.example.com/bus.jpg',
          },
        ]);

      const result = (await service.offers()) as Array<Record<string, unknown>>;
      const promoDeal = result.find((r) => r.id === 'promo-vehicle-1');

      expect(promoDeal).toMatchObject({
        slug: 'transport/bus-co-1',
        old_price: 300000,
        new_price: 240000,
        discount_percent: 20,
        image_url: 'https://cdn.example.com/bus.jpg',
      });
      expect((promoDeal!.title as Record<string, string>).uz).toBe('Afrosiyob');
    });

    it('a real database error on the promotions query is logged and degrades to zero promo deals — it never fabricates a fake/error-shaped promotion card', async () => {
      const dbError = Object.assign(
        new Error('invalid input value for enum "PromotionStatus": "approved"'),
        { code: '22P02' },
      );
      postgres.query
        .mockResolvedValueOnce([cmsOfferRow])
        .mockRejectedValueOnce(dbError);

      const result = (await service.offers()) as Array<Record<string, unknown>>;

      // Faqat haqiqiy CMS 'offers' yozuvi qaytadi — na xato matni, na
      // "Error City"/soxta chegirma kartochkasi hech qachon qo'shilmaydi.
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'cms-offer-1' });
      expect(
        result.some((r) => JSON.stringify(r).includes('invalid input value')),
      ).toBe(false);
    });
  });
});
