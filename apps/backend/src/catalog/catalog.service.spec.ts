import { CatalogService } from './catalog.service';
import { AppCacheService } from '../infrastructure/cache.service';
import { PostgresService } from '../infrastructure/postgres.service';

describe('CatalogService.restaurants', () => {
  let service: CatalogService;
  let cache: AppCacheService;
  let postgres: jest.Mocked<PostgresService>;

  beforeEach(() => {
    cache = {
      getOrSet: jest
        .fn()
        .mockImplementation(
          (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
        ),
    } as unknown as AppCacheService;

    postgres = {
      query: jest.fn(),
    } as unknown as jest.Mocked<PostgresService>;

    service = new CatalogService(cache, postgres);
  });

  it('e-lon qilingan va tasdiqlangan partner restoranlarini hamda CMS restoranlarini qaytarishi kerak', async () => {
    const mockPartnerRow = {
      id: 'rest-uuid-1',
      slug: 'nook-restaurant',
      title: 'Nook Restorani',
      address: 'Toshkent sh., Amir Temur ko‘chasi 10',
      rating: 4.8,
      reviews_count: 25,
      latitude: 41.311,
      longitude: 69.279,
      working_hours: '09:00 - 23:00',
      phone: '+998901234567',
      city_name: { uz: 'Toshkent' },
      image_url: 'https://example.com/rest.jpg',
      average_check: 150000,
      updated_at: '2026-08-04T12:00:00Z',
    };

    const mockCmsRow = {
      id: 'cms-rest-1',
      slug: 'samarqand-restoran',
      title: 'Samarqand Restorani',
      metadata: {
        city_name: { uz: 'Samarqand' },
        address: 'Registon ko‘chasi 5',
        rating: 4.5,
        reviews_count: 10,
        average_check: 100000,
        latitude: 39.654,
        longitude: 66.975,
        working_hours: '10:00 - 22:00',
        image_url: 'https://example.com/cms.jpg',
        phone: '+998662334455',
      },
      latitude: 39.654,
      longitude: 66.975,
      updated_at: '2026-08-04T12:00:00Z',
    };

    postgres.query
      .mockResolvedValueOnce([mockPartnerRow])
      .mockResolvedValueOnce([mockCmsRow]);

    const result = await service.restaurants({});

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'rest-uuid-1',
      slug: 'nook-restaurant',
      name: 'Nook Restorani',
      city_name: { uz: 'Toshkent' },
      address: 'Toshkent sh., Amir Temur ko‘chasi 10',
      cuisine: '',
      rating: 4.8,
      reviews_count: 25,
      average_check: 150000,
      latitude: 41.311,
      longitude: 69.279,
      working_hours: '09:00 - 23:00',
      image_url: 'https://example.com/rest.jpg',
      phone: '+998901234567',
      updated_at: '2026-08-04T12:00:00Z',
    });
  });

  it('partner restoran bo‘lmasa demo seed CMS restoranlarini yashirishi kerak', async () => {
    const realCmsRow = {
      id: 'cms-real-rest-1',
      slug: 'real-family-restaurant',
      title: 'Haqiqiy Oilaviy Restoran',
      metadata: {
        city_name: { uz: 'Toshkent' },
        address: 'Toshkent sh., real manzil 12',
        cuisine: 'Oilaviy oshxona',
        rating: 4.4,
        reviews_count: 7,
        average_check: 90000,
        working_hours: '10:00 - 22:00',
        image_url: 'https://example.com/real.jpg',
        phone: '+998901112233',
      },
      latitude: 41.31,
      longitude: 69.28,
      updated_at: '2026-08-04T12:00:00Z',
    };

    postgres.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([realCmsRow]);

    const result = await service.restaurants({});

    const cmsQuery = postgres.query.mock.calls[1]?.[0];
    const cmsParams = postgres.query.mock.calls[1]?.[1] as unknown[];

    expect(cmsQuery).toContain('slug <> ALL($2::text[])');
    expect(cmsParams).toEqual([
      'restaurant',
      [
        'osh-markazi',
        'osh-markazi-toshkent',
        'registon-terrace',
        'buxoro-caravan',
      ],
    ]);
    expect(result).toEqual([
      {
        id: 'cms-real-rest-1',
        slug: 'real-family-restaurant',
        name: 'Haqiqiy Oilaviy Restoran',
        city_name: { uz: 'Toshkent' },
        address: 'Toshkent sh., real manzil 12',
        cuisine: 'Oilaviy oshxona',
        rating: 4.4,
        reviews_count: 7,
        average_check: 90000,
        latitude: 41.31,
        longitude: 69.28,
        working_hours: '10:00 - 22:00',
        image_url: 'https://example.com/real.jpg',
        phone: '+998901112233',
        updated_at: '2026-08-04T12:00:00Z',
      },
    ]);
  });
});

describe('CatalogService.destinations', () => {
  let service: CatalogService;
  let cache: AppCacheService;
  let postgres: jest.Mocked<PostgresService>;

  beforeEach(() => {
    cache = {
      getOrSet: jest
        .fn()
        .mockImplementation(
          (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
        ),
    } as unknown as AppCacheService;

    postgres = {
      query: jest.fn(),
    } as unknown as jest.Mocked<PostgresService>;

    service = new CatalogService(cache, postgres);
  });

  it('admin CMS orqali boshqariladigan yo‘nalishlarni to‘g‘ri xaritalashi kerak', async () => {
    postgres.query.mockResolvedValueOnce([
      {
        id: 'dest-1',
        slug: 'toshkent',
        title: { uz: 'Toshkent', ru: 'Ташкент', en: 'Tashkent' },
        metadata: {
          image_url: '/uploads/images/tashkent.jpg',
          link: '/uz/hotels?city_id=toshkent',
          order: 1,
        },
        published_at: '2026-08-04T12:00:00Z',
        created_at: '2026-08-01T12:00:00Z',
      },
    ]);

    const result = await service.destinations();

    expect(postgres.query.mock.calls[0]?.[0]).toContain("type = 'destination'");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'dest-1',
      slug: 'toshkent',
      name: { uz: 'Toshkent', ru: 'Ташкент', en: 'Tashkent' },
      link: '/uz/hotels?city_id=toshkent',
    });
    expect(result[0].image_url).toContain('/uploads/images/tashkent.jpg');
  });

  it('tashqi/absolyut havolalarni rad etishi kerak (open-redirect/XSS himoyasi)', async () => {
    postgres.query.mockResolvedValueOnce([
      {
        id: 'dest-2',
        slug: 'samarqand',
        title: { uz: 'Samarqand' },
        metadata: {
          image_url: 'https://example.com/samarqand.jpg',
          link: 'https://evil.example.com/phish',
        },
        published_at: null,
        created_at: '2026-08-01T12:00:00Z',
      },
    ]);

    const result = await service.destinations();

    expect(result[0].link).toBeNull();
  });
});
