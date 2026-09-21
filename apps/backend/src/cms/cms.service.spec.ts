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
});
