import { AppCacheService } from '../infrastructure/cache.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { HotelsService } from './hotels.service';

describe('HotelsService.findAll', () => {
  let service: HotelsService;
  let cache: AppCacheService;
  let pg: jest.Mocked<PostgresService>;

  beforeEach(() => {
    cache = {
      getOrSet: jest
        .fn()
        .mockImplementation(
          (_key: string, _ttl: number, producer: () => Promise<unknown>) =>
            producer(),
        ),
    } as unknown as AppCacheService;

    pg = {
      query: jest.fn(),
    } as unknown as jest.Mocked<PostgresService>;

    service = new HotelsService(cache, pg);
  });

  it('applies pagination in SQL before loading listing side data', async () => {
    pg.query
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-4000-8000-000000000001',
          partner_organization_id: 'partner-1',
          slug: 'hotel-one',
          city_id: 'city-1',
          address: 'Address',
          latitude: 41.31,
          longitude: 69.28,
          stars: 4,
          rating_average: 4.8,
          reviews_count: 12,
          status: 'published',
          featured: false,
          check_in_time: '14:00',
          check_out_time: '12:00',
          created_at: '2026-08-04T00:00:00.000Z',
          updated_at: '2026-08-04T00:00:00.000Z',
          name: { uz: 'Hotel One' },
          description: { uz: 'Description' },
          city_name: { uz: 'Toshkent' },
          region_id: 'region-1',
          min_price: 120000,
          total_count: 12,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.findAll({
      page: '2',
      limit: '5',
      sort_by: 'min_price',
      order: 'asc',
    });

    const [sql, params] = pg.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('COUNT(*) OVER()::int AS total_count');
    expect(sql).toContain('ORDER BY COALESCE(rp.min_price, 0) ASC');
    expect(sql).toContain('LIMIT $1 OFFSET $2');
    expect(params).toEqual([5, 5]);
    expect(pg.query.mock.calls[1]?.[1]).toEqual([
      ['00000000-0000-4000-8000-000000000001'],
    ]);
    expect(result).toMatchObject({
      total: 12,
      page: 2,
      limit: 5,
      total_pages: 3,
    });
    expect(result.items).toHaveLength(1);
  });

  it('excludes non-lodging partner types (transport/restaurant) from the public catalog', async () => {
    pg.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.findAll({});

    const [sql] = pg.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(
      "po.type IN ('hotel', 'hostel', 'guesthouse', 'motel', 'dacha', 'mixed')",
    );
  });

  describe('?featured=true ordering (regression: admin featured-reorder had no persisted order, hotels only ever sorted by rating)', () => {
    it('orders by the admin-set featured_order first when ?featured=true', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.findAll({ featured: 'true' });

      const [sql] = pg.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain(
        'ORDER BY h.featured_order ASC NULLS LAST, h.rating_average DESC',
      );
    });

    it('does not touch featured_order ordering for a normal (non-featured) listing query', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.findAll({});

      const [sql] = pg.query.mock.calls[0] as [string, unknown[]];
      expect(sql).not.toContain('featured_order');
      expect(sql).toContain('ORDER BY h.rating_average DESC');
    });
  });

  it.each(['dacha', 'resort', 'sanatorium'])(
    'filters by a single partner type when ?type=%s (category routes)',
    async (type) => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.findAll({ type });

      const [sql, params] = pg.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('po.type = $1');
      expect(sql).not.toContain(
        "po.type IN ('hotel', 'hostel', 'guesthouse', 'motel', 'dacha', 'mixed')",
      );
      expect(params[0]).toBe(type);
    },
  );

  it('normalizes ?type casing/whitespace before filtering', async () => {
    pg.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.findAll({ type: '  Dacha ' });

    const [sql, params] = pg.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('po.type = $1');
    expect(params[0]).toBe('dacha');
  });

  it.each(['bus', 'restaurant', 'garbage', ''])(
    'ignores a non-accommodation / unknown ?type=%p and keeps the default catalog',
    async (type) => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.findAll({ type });

      const [sql] = pg.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain(
        "po.type IN ('hotel', 'hostel', 'guesthouse', 'motel', 'dacha', 'mixed')",
      );
      expect(sql).not.toContain('po.type = $1');
    },
  );

  describe('check_in/check_out/guests/amenities filters (regression: "SAFAAR — IMPLEMENT THE TWO CONFIRMED BACKEND GAPS" — frontend already sent these 4 params, findAllFresh() silently ignored all of them)', () => {
    it('check_in/check_out adds a room-availability EXISTS check, excluding cancelled/expired/completed bookings and closed inventory dates', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.findAll({ check_in: '2026-10-01', check_out: '2026-10-05' });

      const [sql, params] = pg.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('EXISTS (SELECT 1 FROM hotel_rooms r WHERE');
      expect(sql).toContain('room_inventory');
      expect(sql).toContain('ri.closed = true');
      expect(sql).toContain("NOT IN ('cancelled', 'expired', 'completed')");
      expect(sql).toContain('b.check_in <');
      expect(sql).toContain('total_inventory >');
      expect(params).toContain('2026-10-01');
      expect(params).toContain('2026-10-05');
    });

    it('rejects check_out <= check_in with a 400', async () => {
      await expect(
        service.findAll({ check_in: '2026-10-05', check_out: '2026-10-01' }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'SEARCH_DATES_INVALID' },
      });
      expect(pg.query).not.toHaveBeenCalled();
    });

    it('rejects a malformed check_in/check_out date', async () => {
      await expect(
        service.findAll({ check_in: 'not-a-date', check_out: '2026-10-05' }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'SEARCH_DATES_INVALID' },
      });
    });

    it('rejects when only one of check_in/check_out is supplied', async () => {
      await expect(
        service.findAll({ check_in: '2026-10-01' }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('does not add the availability EXISTS clause when no dates/guests are supplied (regression safety)', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.findAll({});

      const [sql] = pg.query.mock.calls[0] as [string, unknown[]];
      expect(sql).not.toContain('EXISTS (SELECT 1 FROM hotel_rooms r WHERE');
    });

    it('guests adds a max_adults capacity check on hotel_rooms', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.findAll({ guests: '3' });

      const [sql, params] = pg.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('r.max_adults >=');
      expect(params).toContain(3);
    });

    it.each(['0', '-1', 'abc', '2.5'])(
      'rejects an invalid guests=%s',
      async (guests) => {
        await expect(service.findAll({ guests })).rejects.toMatchObject({
          status: 400,
          response: { code: 'SEARCH_GUESTS_INVALID' },
        });
      },
    );

    it('amenities=wifi adds a hotel_amenities match', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.findAll({ amenities: 'wifi' });

      const [sql, params] = pg.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('hotel_amenities');
      expect(sql).toContain('unnest($');
      expect(sql).toContain('a.code = required_code');
      expect(params).toContainEqual(['wifi']);
    });

    it('amenities=wifi,pool requires ALL supplied codes (AND semantics), not any one of them', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.findAll({ amenities: 'wifi,pool' });

      const [sql, params] = pg.query.mock.calls[0] as [string, unknown[]];
      // relational-division pattern: NOT EXISTS a required code the hotel lacks
      expect(sql).toContain('NOT EXISTS');
      expect(params).toContainEqual(['wifi', 'pool']);
    });

    it('blank amenities param adds no amenity filter', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.findAll({ amenities: '' });

      const [sql] = pg.query.mock.calls[0] as [string, unknown[]];
      expect(sql).not.toContain('hotel_amenities');
    });

    it('applies check_in/check_out + guests + amenities together, alongside existing filters (combined query)', async () => {
      pg.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.findAll({
        type: 'dacha',
        city_id: 'city-1',
        stars: '4',
        min_rating: '3',
        check_in: '2026-10-01',
        check_out: '2026-10-05',
        guests: '2',
        amenities: 'wifi,parking',
      });

      const [sql, params] = pg.query.mock.calls[0] as [string, unknown[]];
      // existing filters untouched
      expect(sql).toContain('po.type = $1');
      expect(sql).toContain('h.city_id = $');
      expect(sql).toContain('h.stars = $');
      expect(sql).toContain('h.rating_average >= $');
      // new filters all present together
      expect(sql).toContain('r.max_adults >=');
      expect(sql).toContain('room_inventory');
      expect(sql).toContain('hotel_amenities');
      expect(params).toEqual(
        expect.arrayContaining([
          'dacha',
          'city-1',
          4,
          3,
          2,
          '2026-10-01',
          '2026-10-05',
          ['wifi', 'parking'],
        ]),
      );
    });
  });
});

describe('HotelsService.findOne', () => {
  it('allows sanatorium and resort listings (their detail pages must resolve)', async () => {
    const cache = {
      getOrSet: jest.fn(),
    } as unknown as AppCacheService;
    const pg = {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PostgresService>;
    const service = new HotelsService(cache, pg);

    await expect(service.findOne('some-slug')).rejects.toMatchObject({
      response: { code: 'HOTEL_NOT_FOUND' },
    });

    const [sql] = pg.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(
      "po.type IN ('hotel', 'hostel', 'guesthouse', 'motel', 'dacha', 'sanatorium', 'resort', 'mixed')",
    );
  });

  const HOTEL_ROW = {
    id: 'hotel-1',
    partner_organization_id: 'partner-1',
    slug: 'hotel-one',
    city_id: 'city-1',
    address: 'Address',
    latitude: 41.31,
    longitude: 69.28,
    stars: 4,
    rating_average: 4.8,
    reviews_count: 12,
    status: 'published',
    check_in_time: '14:00',
    check_out_time: '12:00',
    created_at: '2026-08-04T00:00:00.000Z',
    updated_at: '2026-08-04T00:00:00.000Z',
    name: { uz: 'Hotel One' },
    description: { uz: 'Description' },
    city_name: { uz: 'Toshkent' },
    region_id: 'region-1',
  };

  /**
   * Wires up the exact pg.query call sequence findOne() makes:
   * 1) main hotel query, 2-4) loadListingData (translations/media/amenities),
   * 5) room+room_type query, 6) loadRoomNames (hotel_room_translations).
   */
  function mockFindOneQueries(
    pg: jest.Mocked<PostgresService>,
    roomRows: Record<string, unknown>[],
    roomTranslationRows: Record<string, unknown>[] = [],
  ) {
    pg.query
      .mockResolvedValueOnce([HOTEL_ROW]) // hotel
      .mockResolvedValueOnce([]) // hotel_translations
      .mockResolvedValueOnce([]) // media_files
      .mockResolvedValueOnce([]) // hotel_amenities
      .mockResolvedValueOnce(roomRows) // hotel_rooms + room_types
      .mockResolvedValueOnce(roomTranslationRows); // hotel_room_translations
  }

  function makeService() {
    const cache = { getOrSet: jest.fn() } as unknown as AppCacheService;
    const pg = { query: jest.fn() } as unknown as jest.Mocked<PostgresService>;
    return { service: new HotelsService(cache, pg), pg };
  }

  it('room query joins room_types; a hotel with rooms also batches hotel_room_translations (no N+1)', async () => {
    const { service, pg } = makeService();
    mockFindOneQueries(
      pg,
      [
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          room_type_id: 'type-1',
          code: 'STD-1',
          base_occupancy: 2,
          max_adults: 2,
          max_children: 1,
          total_inventory: 5,
          base_price: 550000,
          status: 'active',
          room_type_name: { uz: 'Standart' },
        },
      ],
      [],
    );

    await service.findOne('hotel-one');

    const [roomSql] = pg.query.mock.calls[4] as [string, unknown[]];
    expect(roomSql).toContain('JOIN room_types rt ON rt.id = hr.room_type_id');
    const [translationSql, translationParams] = pg.query.mock.calls[5] as [
      string,
      unknown[],
    ];
    expect(translationSql).toContain('FROM hotel_room_translations');
    expect(translationSql).toContain('room_id = ANY($1::uuid[])');
    expect(translationParams).toEqual([['room-1']]);
    // One query per resource type, not per room — 6 total regardless of room count.
    expect(pg.query.mock.calls.length).toBe(6);
  });

  it('a hotel with zero rooms skips the room-names query entirely (no wasted round-trip)', async () => {
    const { service, pg } = makeService();
    mockFindOneQueries(pg, []);

    await service.findOne('hotel-one');

    // loadRoomNames([]) short-circuits before querying — only 5 total calls.
    expect(pg.query.mock.calls.length).toBe(5);
  });

  it('a room with a translated name returns that name for the translated locale', async () => {
    const { service, pg } = makeService();
    mockFindOneQueries(
      pg,
      [
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          room_type_id: 'type-1',
          code: 'STD-1',
          base_occupancy: 2,
          max_adults: 2,
          max_children: 1,
          total_inventory: 5,
          base_price: 550000,
          status: 'active',
          room_type_name: { uz: 'Standart', ru: 'Стандарт', en: 'Standard' },
        },
      ],
      [
        {
          room_id: 'room-1',
          language: 'uz',
          name: "Bog'ga qaragan Standart xona",
        },
      ],
    );

    const result = await service.findOne('hotel-one');

    expect(result.rooms).toHaveLength(1);
    // uz: the partner's own per-room translation wins.
    expect(result.rooms[0].name.uz).toBe("Bog'ga qaragan Standart xona");
    // ru/en: no per-room translation for these locales -> falls back to the
    // generic room-type name per locale, independently (never blank).
    expect(result.rooms[0].name.ru).toBe('Стандарт');
    expect(result.rooms[0].name.en).toBe('Standard');
    // Price/availability/other room fields must be untouched by the fix.
    expect(result.rooms[0].base_price).toBe(550000);
    expect(result.rooms[0].available).toBe(5);
    expect(result.rooms[0].total_inventory).toBe(5);
    expect(result.rooms[0].code).toBe('STD-1');
  });

  it('a room with NO translation falls back to the room type name (never blank)', async () => {
    const { service, pg } = makeService();
    mockFindOneQueries(
      pg,
      [
        {
          id: 'room-2',
          hotel_id: 'hotel-1',
          room_type_id: 'type-1',
          code: 'STD-2',
          base_occupancy: 2,
          max_adults: 2,
          max_children: 1,
          total_inventory: 3,
          base_price: 480000,
          status: 'active',
          room_type_name: { uz: 'Standart', ru: 'Стандарт', en: 'Standard' },
        },
      ],
      [], // no hotel_room_translations rows at all
    );

    const result = await service.findOne('hotel-one');

    expect(result.rooms[0].name).toEqual({
      uz: 'Standart',
      ru: 'Стандарт',
      en: 'Standard',
    });
    expect(result.rooms[0].name.uz).not.toBe('');
    expect(result.rooms[0].name.uz).not.toBeNull();
  });

  it('multiple rooms each receive their own correct name independently', async () => {
    const { service, pg } = makeService();
    mockFindOneQueries(
      pg,
      [
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          room_type_id: 'type-std',
          code: 'STD-1',
          base_occupancy: 2,
          max_adults: 2,
          max_children: 1,
          total_inventory: 5,
          base_price: 550000,
          status: 'active',
          room_type_name: { uz: 'Standart' },
        },
        {
          id: 'room-2',
          hotel_id: 'hotel-1',
          room_type_id: 'type-dlx',
          code: 'DLX-1',
          base_occupancy: 3,
          max_adults: 3,
          max_children: 1,
          total_inventory: 2,
          base_price: 820000,
          status: 'active',
          room_type_name: { uz: 'Deluxe' },
        },
      ],
      [{ room_id: 'room-1', language: 'uz', name: 'Standart (hovli tomon)' }],
    );

    const result = await service.findOne('hotel-one');

    expect(result.rooms).toHaveLength(2);
    expect(result.rooms.find((r) => r.id === 'room-1')?.name.uz).toBe(
      'Standart (hovli tomon)',
    );
    expect(result.rooms.find((r) => r.id === 'room-2')?.name.uz).toBe('Deluxe');
  });

  it('a hotel with no rooms returns an empty rooms array (no crash)', async () => {
    const { service, pg } = makeService();
    mockFindOneQueries(pg, []);

    const result = await service.findOne('hotel-one');

    expect(result.rooms).toEqual([]);
  });
});

describe('HotelsService.rooms (public GET /hotels/:id/rooms)', () => {
  it('returns the same name-with-fallback shape as findOne()', async () => {
    const cache = { getOrSet: jest.fn() } as unknown as AppCacheService;
    const pg = { query: jest.fn() } as unknown as jest.Mocked<PostgresService>;
    const service = new HotelsService(cache, pg);

    pg.query
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          room_type_id: 'type-1',
          code: 'STD-1',
          base_occupancy: 2,
          max_adults: 2,
          max_children: 1,
          total_inventory: 5,
          base_price: 550000,
          status: 'active',
          room_type_name: { uz: 'Standart' },
        },
      ])
      .mockResolvedValueOnce([]);

    const rooms = await service.rooms('hotel-1');

    expect(rooms).toHaveLength(1);
    expect(rooms[0].name).toEqual({ uz: 'Standart', ru: null, en: null });
    expect(rooms[0].base_price).toBe(550000);
  });
});
