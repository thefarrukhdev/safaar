import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import { registrationVerificationStore } from '../auth/registration-verification-store';
import type { AppCacheService } from '../infrastructure/cache.service';
import { JobQueueService } from '../infrastructure/job-queue.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { EventsService } from '../realtime/events.service';
import { PartnersService } from './partners.service';

jest.mock('../common/ssrf-guard', () => ({
  assertPublicHttpUrl: jest.fn((rawUrl: string) =>
    Promise.resolve(new URL(rawUrl)),
  ),
}));

import { assertPublicHttpUrl } from '../common/ssrf-guard';

type QueryCall = [sql: string, params?: readonly unknown[]];
const queryCallsOf = (obj: { query: unknown }): QueryCall[] =>
  (obj.query as jest.Mock).mock.calls as QueryCall[];

describe('PartnersService frontend action endpoints', () => {
  let service: PartnersService;
  let pgMock: jest.Mocked<Pick<PostgresService, 'query'>> & {
    transaction: jest.Mock;
  };
  let eventsMock: {
    hotelListingChanged: jest.Mock;
    adminDashboardUpdated: jest.Mock;
  };
  const actor: RequestActor = {
    id: '00000000-0000-0000-0000-000000000001',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: '00000000-0000-0000-0000-000000000002',
    sessionId: 'test-session-id',
  };
  const hotelId = '00000000-0000-0000-0000-000000000003';
  const hotelRow = {
    id: hotelId,
    partner_organization_id: '00000000-0000-0000-0000-000000000002',
    name: { uz: 'Old', ru: 'Old', en: 'Old' },
    description: { uz: '', ru: '', en: '' },
    stars: 3,
    address: '',
    latitude: 0,
    longitude: 0,
    amenities: [],
    images: [],
    status: 'draft',
    check_in_time: '14:00',
    check_out_time: '12:00',
  };

  beforeEach(() => {
    pgMock = {
      query: jest.fn().mockResolvedValue([hotelRow]),
      transaction: jest.fn((operation: (tx: unknown) => unknown) =>
        Promise.resolve(operation({ query: pgMock.query })),
      ),
    };
    eventsMock = {
      hotelListingChanged: jest.fn(),
      adminDashboardUpdated: jest.fn(),
    };
    service = new PartnersService(
      pgMock as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
      eventsMock as unknown as EventsService,
    );
  });

  it('returns the published listing before a pending next-draft, and an active draft before a rejected one', async () => {
    pgMock.query.mockResolvedValueOnce([]);

    await service.hotels(actor);

    expect(pgMock.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'ORDER BY CASE status\n' +
          "                  WHEN 'published' THEN 0\n" +
          "                  WHEN 'pending_review' THEN 1\n" +
          "                  WHEN 'hidden' THEN 2\n" +
          "                  WHEN 'draft' THEN 3\n" +
          "                  WHEN 'rejected' THEN 4\n" +
          '                  ELSE 5\n' +
          '                END',
      ),
      [actor.organizationId, 50, 0],
    );
    expect(pgMock.query.mock.calls[0]?.[0]).toContain('AND deleted_at IS NULL');
  });

  it('keeps a reset draft name empty instead of falling back to its slug', async () => {
    pgMock.query
      .mockResolvedValueOnce([{ ...hotelRow, slug: 'draft-partner-1234' }])
      .mockResolvedValueOnce([
        {
          hotel_id: hotelId,
          language: 'uz',
          name: '',
          short_description: '',
          description: '',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const [draft] = await service.hotels(actor);

    expect(draft.name).toEqual({ uz: '', ru: '', en: '' });
  });

  it('supports room type and bulk room buttons from the partner listing UI', async () => {
    pgMock.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([]) // room-type code cross-hotel conflict check — bo'sh
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-0000-0000-000000000004',
          code: 'deluxe',
          name: { uz: 'Deluxe', ru: 'Deluxe', en: 'Deluxe' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-0000-0000-000000000004',
          base_price: 90000000,
          capacity: 2,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const roomType = await service.createRoomType(actor, hotelId, {
      name: 'Deluxe',
      basePrice: 90000000,
      capacity: 2,
    });
    const bulk = await service.createRoomsBulk(actor, hotelId, {
      roomTypeId: roomType.id,
      startNumber: 301,
      count: 2,
      basePrice: 90000000,
    });

    expect((roomType.name as { uz: string }).uz).toBe('Deluxe');
    expect(bulk).toMatchObject({ ok: true, added: 2 });
  });

  it('rejects creating a room type whose code is already used by ANOTHER hotel instead of silently overwriting it (regression: cross-tenant room_type IDOR)', async () => {
    pgMock.query
      .mockResolvedValueOnce([hotelRow]) // assertHotel
      .mockResolvedValueOnce([{ hotel_id: 'someone-elses-hotel' }]); // conflict found

    await expect(
      service.createRoomType(actor, hotelId, {
        code: 'standard',
        name: 'Standard',
        basePrice: 100000,
        capacity: 2,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects updating a room type that belongs to a different hotel, even with a valid hotelId the caller does own (regression: cross-tenant room_type IDOR)', async () => {
    pgMock.query
      .mockResolvedValueOnce([hotelRow]) // assertHotel(hotelId) — caller's own hotel, succeeds
      .mockResolvedValueOnce([{ owned_by_self: false, used_by_other: true }]); // assertRoomTypeOwnedByHotel — belongs elsewhere, never used by caller

    await expect(
      service.updateRoomType(actor, hotelId, 'someone-elses-room-type-id', {
        base_price: 1,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows updating a room type that IS shared with other hotels, as long as the caller\'s own hotel also uses it (regression: false-positive 403 "Bu xona turi boshqa mehmonxonaga tegishli" on legitimately shared catalog room_types, e.g. seeded "standard"/"deluxe")', async () => {
    pgMock.query
      .mockResolvedValueOnce([hotelRow]) // assertHotel
      .mockResolvedValueOnce([{ owned_by_self: true, used_by_other: true }]) // assertRoomTypeOwnedByHotel — shared, but caller also owns it
      .mockResolvedValueOnce([
        {
          id: 'room-type-1',
          code: 'standard',
          name: { uz: 'Standard' },
          description: null,
          image_url: null,
          bed_type: null,
          size_sqm: null,
          base_price: 100000,
          capacity: 2,
          amenities: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]); // UPDATE ... RETURNING

    const roomType = await service.updateRoomType(
      actor,
      hotelId,
      'room-type-1',
      {
        base_price: 150000,
      },
    );

    expect(roomType).toMatchObject({ id: 'room-type-1' });
  });

  it('allows updating a room type that is not yet linked to any hotel (freshly created, no rooms yet)', async () => {
    pgMock.query
      .mockResolvedValueOnce([hotelRow]) // assertHotel
      .mockResolvedValueOnce([{ owned_by_self: false, used_by_other: false }]) // assertRoomTypeOwnedByHotel — unlinked, allowed
      .mockResolvedValueOnce([
        {
          id: 'room-type-1',
          code: 'standard',
          name: { uz: 'Standard' },
          base_price: 120000,
          capacity: 2,
        },
      ]);

    const result = await service.updateRoomType(actor, hotelId, 'room-type-1', {
      base_price: 120000,
    });
    expect(result).toMatchObject({ id: 'room-type-1' });
  });

  it('updateInventory persists real room_inventory rows instead of echoing the request back (regression: was a no-op stub)', async () => {
    pgMock.query
      .mockResolvedValueOnce([hotelRow]) // assertHotel
      .mockResolvedValueOnce([{ total_inventory: 5 }]) // room ownership check
      .mockResolvedValueOnce([
        {
          room_id: 'room-1',
          date: '2026-08-20',
          total_count: 3,
          held_count: 0,
          booked_count: 0,
          closed: true,
        },
      ]); // INSERT ... ON CONFLICT DO UPDATE RETURNING

    const result = await service.updateInventory(actor, hotelId, {
      items: [
        { room_id: 'room-1', date: '2026-08-20', total_count: 3, closed: true },
      ],
    });

    expect(result.updated).toBe(true);
    expect(result.items).toHaveLength(1);
    const upsertCall = pgMock.query.mock.calls.find(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO room_inventory'),
    );
    expect(upsertCall).toBeDefined();
    expect(upsertCall?.[1]).toEqual([
      expect.any(String),
      'room-1',
      '2026-08-20',
      3,
      true,
    ]);
  });

  it("updateInventory rejects a room_id that does not belong to the caller's hotel", async () => {
    pgMock.query
      .mockResolvedValueOnce([hotelRow]) // assertHotel
      .mockResolvedValueOnce([]); // room ownership check — not found for this hotel

    await expect(
      service.updateInventory(actor, hotelId, {
        items: [{ room_id: 'someone-elses-room', date: '2026-08-20' }],
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('blackoutDates persists closed=true room_inventory rows for every active room when no room_id is given (regression: was a no-op stub)', async () => {
    pgMock.query
      .mockResolvedValueOnce([hotelRow]) // assertHotel
      .mockResolvedValueOnce([
        { id: 'room-1', total_inventory: 5 },
        { id: 'room-2', total_inventory: 5 },
      ]) // active rooms for the hotel
      .mockResolvedValueOnce([]) // upsert room-1 x date-1
      .mockResolvedValueOnce([]); // upsert room-2 x date-1

    const result = await service.blackoutDates(actor, hotelId, {
      dates: ['2026-08-25'],
    });

    expect(result).toMatchObject({ closed: true, dates: ['2026-08-25'] });
    const upsertCalls = pgMock.query.mock.calls.filter(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO room_inventory'),
    );
    expect(upsertCalls).toHaveLength(2);
  });

  it('blackoutDates rejects an empty/invalid dates array instead of silently "succeeding"', async () => {
    pgMock.query.mockResolvedValueOnce([hotelRow]);

    await expect(
      service.blackoutDates(actor, hotelId, { dates: [] }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('updates listing sections and publish status for partner listing UI', async () => {
    await service.updateListingGeneral(actor, hotelId, {
      name: 'Yangi nom',
      description: 'Batafsil tavsif',
      stars: 5,
    });

    expect(pgMock.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE hotels'),
      expect.arrayContaining([5, expect.any(String), hotelId]),
    );
  });

  it('keeps listing rules SQL placeholders aligned', async () => {
    await service.updateListingRules(actor, hotelId, {
      checkInTime: '15:00',
      checkOutTime: '11:00',
    });

    const updateCall = pgMock.query.mock.calls.find(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('rules_completed_at = $3'),
    );

    expect(updateCall).toBeDefined();
    expect(updateCall?.[0]).toContain(
      "submitted_at = CASE WHEN status = 'published' THEN $5",
    );
    expect(updateCall?.[0]).toContain('WHERE id = $6');
    expect(updateCall?.[1]).toEqual([
      '15:00',
      '11:00',
      expect.any(String),
      expect.any(String),
      expect.any(String),
      hotelId,
    ]);
  });

  it('rejects review submission until every listing section is complete', async () => {
    pgMock.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        {
          name: 'Hotel',
          short_description: 'Qisqa tavsif',
          description: 'Batafsil tavsif',
        },
      ])
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ type: 'hotel' }]);

    await expect(
      service.updateListingStatus(actor, hotelId, { status: 'UNDER_REVIEW' }),
    ).rejects.toThrow("E'lon to'liq to'ldirilmagan");
  });

  it('writes submitted_at when a complete listing enters review', async () => {
    const completeHotel = {
      ...hotelRow,
      address: 'Samarqand, Registon kochasi 1',
      latitude: 39.65,
      longitude: 66.96,
      rules_completed_at: new Date().toISOString(),
    };
    pgMock.query
      .mockResolvedValueOnce([completeHotel])
      .mockResolvedValueOnce([
        {
          name: 'Hotel',
          short_description: 'Yetarlicha uzun qisqa tavsif matni',
          description:
            'Bu mehmonxona haqida mijozga ko‘rinadigan yetarlicha uzun batafsil tavsif matni mavjud. Mehmonlar uchun muhim xizmatlar va qulayliklar batafsil tushuntiriladi.',
        },
      ])
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ type: 'hotel' }])
      .mockResolvedValueOnce([{ ...completeHotel, status: 'pending_review' }]);

    const result = await service.updateListingStatus(actor, hotelId, {
      status: 'UNDER_REVIEW',
    });

    expect(result).toMatchObject({ status: 'pending_review' });
    expect(pgMock.query).toHaveBeenLastCalledWith(
      expect.stringContaining('status = $1::"HotelStatus"'),
      expect.arrayContaining([
        'pending_review',
        expect.any(String),
        actor.id,
        hotelId,
      ]),
    );
    expect(pgMock.query.mock.calls.at(-1)?.[0]).toContain(
      `$1::"HotelStatus" = 'pending_review'::"HotelStatus"`,
    );
    expect(pgMock.query.mock.calls.at(-1)?.[0]).toContain(
      'submitted_by = CASE',
    );
    expect(eventsMock.hotelListingChanged).toHaveBeenCalledWith({
      hotelId,
      partnerId: actor.organizationId,
      status: 'pending_review',
      action: 'submitted',
      sections: ['status'],
    });
    expect(eventsMock.adminDashboardUpdated).toHaveBeenCalledTimes(1);
  });

  it("restoran e'lonini faol xona bo'lmasa ham ko'rib chiqishga yuboradi", async () => {
    const completeRestaurant = {
      ...hotelRow,
      address: 'Samarqand, Registon kochasi 1',
      latitude: 39.65,
      longitude: 66.96,
      rules_completed_at: new Date().toISOString(),
    };
    pgMock.query
      .mockResolvedValueOnce([completeRestaurant])
      .mockResolvedValueOnce([
        {
          name: 'Restoran',
          short_description: 'Yetarlicha uzun qisqa restoran tavsifi',
          description:
            'Bu restoran haqida mijozga ko‘rinadigan yetarlicha uzun batafsil tavsif matni mavjud. Taomlar, ish vaqti va bron qoidalari tushuntiriladi.',
        },
      ])
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ type: 'restaurant' }])
      .mockResolvedValueOnce([
        { ...completeRestaurant, status: 'pending_review' },
      ]);

    const result = await service.updateListingStatus(actor, hotelId, {
      status: 'UNDER_REVIEW',
    });

    expect(result).toMatchObject({ status: 'pending_review' });
  });

  it('auto-creates amenity codes that are not in the catalog', async () => {
    pgMock.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        { code: 'wifi', id: '00000000-0000-0000-0000-000000000004' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { code: 'wifi', id: '00000000-0000-0000-0000-000000000004' },
        { code: 'unknown-amenity', id: '00000000-0000-0000-0000-000000000005' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([hotelRow]);

    const res = await service.updateListingAmenities(actor, hotelId, {
      amenities: ['wifi', 'unknown-amenity'],
    });
    expect(res).toBeDefined();
  });

  describe('createBooking — restoran stol/vaqt-slot himoyasi', () => {
    const roomTypeId = '00000000-0000-0000-0000-000000000005';
    const roomId = '00000000-0000-0000-0000-000000000006';
    const restaurantHotelRow = {
      id: hotelId,
      check_in_time: '10:00',
      check_out_time: '23:00',
      partner_type: 'restaurant',
      commission_rate: 12,
    };
    const walkInBody = {
      hotelId,
      roomTypeId,
      roomNumber: 'T1',
      slotTime: '19:00',
      checkIn: '2026-08-10',
      checkOut: '2026-08-10',
      adults: 2,
      children: 0,
      nights: 1,
      totalPrice: 200000,
      source: 'walk_in',
      fullName: 'Test Guest',
      phone: '+998901234567',
    };

    it("bron turini 'restaurant' deb yozadi va xona/sana/slot ustunlarini haqiqiy INSERT ustunlariga to'ldiradi", async () => {
      pgMock.query
        .mockResolvedValueOnce([restaurantHotelRow]) // hotel + partner_organizations JOIN
        .mockResolvedValueOnce([
          { id: roomTypeId, name: { uz: 'Stol' }, base_price: 0, capacity: 4 },
        ]) // room_types
        .mockResolvedValueOnce([
          { id: roomId, room_type_id: roomTypeId, code: 'T1', base_price: 0 },
        ]) // hotel_rooms (roomNumber bo'yicha)
        .mockResolvedValueOnce([{ id: roomId }]) // FOR UPDATE qulf
        .mockResolvedValueOnce([]) // ziddiyat tekshiruvi — bo'sh, ziddiyat yo'q
        .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
        .mockResolvedValueOnce([]) // INSERT bookings
        .mockResolvedValueOnce([]) // INSERT payments
        .mockResolvedValueOnce([]) // INSERT partner_ledger_entries
        .mockResolvedValueOnce([
          { id: 'booking-1', partner_organization_id: actor.organizationId },
        ]); // this.booking() ichidagi so'rov

      await service.createBooking(actor, walkInBody);

      expect(pgMock.transaction).toHaveBeenCalledTimes(1);
      const insertCall = pgMock.query.mock.calls.find(
        ([sql]) =>
          typeof sql === 'string' && sql.includes('INSERT INTO bookings'),
      );
      expect(insertCall).toBeDefined();
      const params = insertCall?.[1] as unknown[];
      expect(params[4]).toBe('restaurant');
      expect(params[18]).toBe(roomId);
      expect(params[19]).toBe('2026-08-10');
      expect(params[20]).toBe('2026-08-10');
      expect(params[21]).toBe('19:00');
    });

    it('bir xil stol + kesishuvchi vaqt-slot uchun 409 (TABLE_ALREADY_BOOKED) qaytaradi', async () => {
      pgMock.query
        .mockResolvedValueOnce([restaurantHotelRow])
        .mockResolvedValueOnce([
          { id: roomTypeId, name: { uz: 'Stol' }, base_price: 0, capacity: 4 },
        ])
        .mockResolvedValueOnce([
          { id: roomId, room_type_id: roomTypeId, code: 'T1', base_price: 0 },
        ])
        .mockResolvedValueOnce([{ id: roomId }]) // FOR UPDATE qulf
        .mockResolvedValueOnce([{ id: 'existing-booking-id' }]); // ziddiyat topildi

      await expect(service.createBooking(actor, walkInBody)).rejects.toThrow(
        'Bu stol tanlangan vaqtda band',
      );

      expect(
        pgMock.query.mock.calls.some(
          ([sql]) =>
            typeof sql === 'string' && sql.includes('INSERT INTO bookings'),
        ),
      ).toBe(false);
    });

    it("hamkorning haqiqiy komissiya stavkasidan foydalanadi va daromadni ledger'ga yozadi (regression: qattiq yozilgan 12% + ledger yozuvi yo'qligi)", async () => {
      pgMock.query
        .mockResolvedValueOnce([{ ...restaurantHotelRow, commission_rate: 20 }])
        .mockResolvedValueOnce([
          { id: roomTypeId, name: { uz: 'Stol' }, base_price: 0, capacity: 4 },
        ])
        .mockResolvedValueOnce([
          { id: roomId, room_type_id: roomTypeId, code: 'T1', base_price: 0 },
        ])
        .mockResolvedValueOnce([{ id: roomId }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
        .mockResolvedValueOnce([]) // INSERT bookings
        .mockResolvedValueOnce([]) // INSERT payments
        .mockResolvedValueOnce([]) // INSERT partner_ledger_entries
        .mockResolvedValueOnce([
          { id: 'booking-1', partner_organization_id: actor.organizationId },
        ]);

      await service.createBooking(actor, walkInBody);

      const insertCall = pgMock.query.mock.calls.find(
        ([sql]) =>
          typeof sql === 'string' && sql.includes('INSERT INTO bookings'),
      );
      const params = insertCall?.[1] as unknown[];
      // totalPrice 200000, 20% komissiya = 40000
      expect(params[14]).toBe(40000); // commission_amount
      expect(params[15]).toBe(160000); // partner_payable

      const ledgerCall = pgMock.query.mock.calls.find(
        ([sql]) =>
          typeof sql === 'string' &&
          sql.includes('INSERT INTO partner_ledger_entries'),
      );
      expect(ledgerCall).toBeDefined();
      expect(ledgerCall?.[1]).toEqual([
        expect.any(String),
        actor.organizationId,
        expect.any(String),
        160000,
        'UZS',
        expect.any(String),
      ]);
    });

    it("hamkor walk-in bron 'hotel' turi uchun ham SAFAAR Excel komissiya jadvalidan (org'ning default_commission_rate'idan EMAS) foydalanadi (2026-09-13, bookings.service.ts createHotelInternal bilan bir xil qoida)", async () => {
      pgMock.query
        .mockResolvedValueOnce([
          {
            ...restaurantHotelRow,
            partner_type: 'hotel',
            commission_rate: 25, // org'da qo'lda sozlangan — Excel ustun bo'lgani uchun e'tiborga olinmaydi
            stars: 3,
            city_slug: 'samarqand',
          },
        ])
        .mockResolvedValueOnce([
          { id: roomTypeId, name: { uz: 'Stol' }, base_price: 0, capacity: 4 },
        ])
        .mockResolvedValueOnce([
          { id: roomId, room_type_id: roomTypeId, code: 'T1', base_price: 0 },
        ])
        .mockResolvedValueOnce([{ id: roomId }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
        .mockResolvedValueOnce([]) // INSERT bookings
        .mockResolvedValueOnce([]) // INSERT payments
        .mockResolvedValueOnce([]) // INSERT partner_ledger_entries
        .mockResolvedValueOnce([
          { id: 'booking-1', partner_organization_id: actor.organizationId },
        ]);

      await service.createBooking(actor, walkInBody);

      const insertCall = pgMock.query.mock.calls.find(
        ([sql]) =>
          typeof sql === 'string' && sql.includes('INSERT INTO bookings'),
      );
      const params = insertCall?.[1] as unknown[];
      // totalPrice 200000, Samarqand + 3 yulduz (hotel, star_4_5 EMAS) = 10%
      // Excel bo'yicha (org'ning 25%i EMAS) = 20000
      expect(params[14]).toBe(20000); // commission_amount
      expect(params[15]).toBe(180000); // partner_payable
    });

    it('ish vaqtidan tashqari slot uchun SLOT_OUTSIDE_HOURS xatosini qaytaradi', async () => {
      pgMock.query
        .mockResolvedValueOnce([restaurantHotelRow])
        .mockResolvedValueOnce([
          { id: roomTypeId, name: { uz: 'Stol' }, base_price: 0, capacity: 4 },
        ])
        .mockResolvedValueOnce([
          { id: roomId, room_type_id: roomTypeId, code: 'T1', base_price: 0 },
        ]);

      await expect(
        service.createBooking(actor, { ...walkInBody, slotTime: '23:30' }),
      ).rejects.toThrow('Tanlangan vaqt ish vaqtidan tashqarida');
    });

    // -------------------------------------------------------------
    // Ish vaqti (opening hours) regressiyasi — hamkor walk-in yo'li.
    // Eski kod faqat BIR KUNLIK oraliqni bilardi:
    //   slot < check_in_time || slot >= check_out_time -> rad etish
    // Yarim tundan keyin yopiladigan restoran uchun (close < open) bu
    // shart tavtologiyaga aylanib, HAR QANDAY vaqtni rad etardi.
    // Quyidagi testlar HAQIQIY service yo'lini tekshiradi.
    // -------------------------------------------------------------
    const mockWalkInFlow = (hotelRow: Record<string, unknown>) => {
      pgMock.query
        .mockResolvedValueOnce([hotelRow]) // hotel + partner_organizations JOIN
        .mockResolvedValueOnce([
          { id: roomTypeId, name: { uz: 'Stol' }, base_price: 0, capacity: 4 },
        ]) // room_types
        .mockResolvedValueOnce([
          { id: roomId, room_type_id: roomTypeId, code: 'T1', base_price: 0 },
        ]) // hotel_rooms
        .mockResolvedValueOnce([{ id: roomId }]) // FOR UPDATE qulf
        .mockResolvedValueOnce([]) // ziddiyat yo'q
        .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
        .mockResolvedValueOnce([]) // INSERT bookings
        .mockResolvedValueOnce([]) // INSERT payments
        .mockResolvedValueOnce([]) // INSERT partner_ledger_entries
        .mockResolvedValueOnce([
          { id: 'booking-1', partner_organization_id: actor.organizationId },
        ]); // this.booking()
    };

    const insertedSlotTime = () => {
      const insertCall = pgMock.query.mock.calls.find(
        ([sql]) =>
          typeof sql === 'string' && sql.includes('INSERT INTO bookings'),
      );
      expect(insertCall).toBeDefined();
      return (insertCall?.[1] as unknown[])[21];
    };

    describe("yarim tundan o'tuvchi ish vaqti 07:01 -> 01:53 (production: Osh markazi)", () => {
      const overnightHotelRow = {
        ...restaurantHotelRow,
        check_in_time: '07:01',
        check_out_time: '01:53',
      };

      it.each(['07:01', '10:00', '23:00', '23:59', '00:00', '00:30', '01:52'])(
        'ish vaqti ICHIDAGI %s slotini qabul qiladi va slot_time ustuniga yozadi',
        async (slotTime) => {
          mockWalkInFlow(overnightHotelRow);

          await service.createBooking(actor, { ...walkInBody, slotTime });

          expect(insertedSlotTime()).toBe(slotTime);
        },
      );

      it.each(['01:53', '01:54', '02:00', '06:00', '07:00'])(
        'ish vaqtidan TASHQARIDAGI %s slotini SLOT_OUTSIDE_HOURS bilan rad etadi',
        async (slotTime) => {
          pgMock.query
            .mockResolvedValueOnce([overnightHotelRow])
            .mockResolvedValueOnce([
              {
                id: roomTypeId,
                name: { uz: 'Stol' },
                base_price: 0,
                capacity: 4,
              },
            ])
            .mockResolvedValueOnce([
              {
                id: roomId,
                room_type_id: roomTypeId,
                code: 'T1',
                base_price: 0,
              },
            ]);

          await expect(
            service.createBooking(actor, { ...walkInBody, slotTime }),
          ).rejects.toMatchObject({
            status: 400,
            response: { code: 'SLOT_OUTSIDE_HOURS' },
          });

          expect(
            pgMock.query.mock.calls.some(
              ([sql]) =>
                typeof sql === 'string' && sql.includes('INSERT INTO bookings'),
            ),
          ).toBe(false);
        },
      );
    });

    describe('bir kunlik ish vaqti 10:00 -> 23:00 (eski xulq-atvor saqlanadi)', () => {
      it.each(['10:00', '12:00', '22:59'])(
        'ish vaqti ICHIDAGI %s slotini qabul qiladi',
        async (slotTime) => {
          mockWalkInFlow(restaurantHotelRow);

          await service.createBooking(actor, { ...walkInBody, slotTime });

          expect(insertedSlotTime()).toBe(slotTime);
        },
      );

      it.each(['09:59', '23:00', '23:01', '00:30'])(
        'ish vaqtidan TASHQARIDAGI %s slotini SLOT_OUTSIDE_HOURS bilan rad etadi',
        async (slotTime) => {
          pgMock.query
            .mockResolvedValueOnce([restaurantHotelRow])
            .mockResolvedValueOnce([
              {
                id: roomTypeId,
                name: { uz: 'Stol' },
                base_price: 0,
                capacity: 4,
              },
            ])
            .mockResolvedValueOnce([
              {
                id: roomId,
                room_type_id: roomTypeId,
                code: 'T1',
                base_price: 0,
              },
            ]);

          await expect(
            service.createBooking(actor, { ...walkInBody, slotTime }),
          ).rejects.toMatchObject({
            status: 400,
            response: { code: 'SLOT_OUTSIDE_HOURS' },
          });
        },
      );
    });
  });
});

describe('PartnersService.withdrawal (regression: C-2 unlimited overdraft)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock; transaction: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn(), transaction: jest.fn() };
    pg.transaction.mockImplementation((operation: (tx: unknown) => unknown) =>
      operation({ query: pg.query }),
    );
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  // Ledger endi balansning yagona haqiqat manbai — `partner_ledger_entries`
  // yig'indisi to'g'ridan-to'g'ri yechish mumkin bo'lgan summa (avvalgidek
  // "gross * 0.7" formulasi yo'q, chunki ledger yozuvlari komissiya va
  // qaytarishlar hisobga olingan HOLDA yoziladi).
  function mockBalanceQueries(ledgerTotal: number, alreadyCommitted: number) {
    pg.query
      .mockResolvedValueOnce([{ id: 'org-1' }]) // SELECT ... FOR UPDATE lock
      .mockResolvedValueOnce([{ sum: String(ledgerTotal) }]) // ledger balance
      .mockResolvedValueOnce([{ sum: String(alreadyCommitted) }]); // already requested/approved/paid
  }

  it('rejects a withdrawal that exceeds the available balance', async () => {
    // ledger balance 700,000; nothing committed yet; asking for 700,001.
    mockBalanceQueries(700_000, 0);

    await expect(
      service.withdrawal(actor, {
        amount: 700_001,
        bankAccount: '8600 1111 2222 3333',
      }),
    ).rejects.toMatchObject({
      response: { code: 'WITHDRAWAL_EXCEEDS_BALANCE' },
    });
  });

  it('rejects a second withdrawal once a prior one already committed the remaining balance', async () => {
    // ledger balance 700,000; 700,000 already requested; nothing left for a new 1 UZS request.
    mockBalanceQueries(700_000, 700_000);

    await expect(
      service.withdrawal(actor, {
        amount: 1,
        bankAccount: '8600 1111 2222 3333',
      }),
    ).rejects.toMatchObject({
      response: { code: 'WITHDRAWAL_EXCEEDS_BALANCE' },
    });
  });

  it('allows a withdrawal that fits within the available balance', async () => {
    mockBalanceQueries(700_000, 0);
    pg.query.mockResolvedValueOnce([
      { id: 'wr-1', amount: 700_000, status: 'requested' },
    ]);

    const result = await service.withdrawal(actor, {
      amount: 700_000,
      bankAccount: '8600 1111 2222 3333',
    });
    expect(result).toMatchObject({ id: 'wr-1', status: 'requested' });
  });

  it('locks the organization row before computing balance (serializes concurrent requests)', async () => {
    mockBalanceQueries(700_000, 0);
    pg.query.mockResolvedValueOnce([{ id: 'wr-1' }]);

    await service.withdrawal(actor, {
      amount: 100,
      bankAccount: '8600 1111 2222 3333',
    });

    expect(queryCallsOf(pg)[0]?.[0]).toContain('FOR UPDATE');
  });

  it('excludes refunded/cancelled bookings from the withdrawable balance because the ledger itself already nets them out (regression: balance previously summed ALL bookings regardless of status)', async () => {
    // Ledger: +200,000 (booking_earned) - 200,000 (refund) = 0 available,
    // hech qanday status-filtri kerak emas — refund allaqachon manfiy yozuv.
    mockBalanceQueries(0, 0);

    await expect(
      service.withdrawal(actor, {
        amount: 1,
        bankAccount: '8600 1111 2222 3333',
      }),
    ).rejects.toMatchObject({
      response: { code: 'WITHDRAWAL_EXCEEDS_BALANCE' },
    });
  });

  it('rejects a withdrawal with no bank account, before ever touching the balance query', async () => {
    await expect(
      service.withdrawal(actor, { amount: 100 }),
    ).rejects.toMatchObject({
      response: { code: 'WITHDRAWAL_BANK_ACCOUNT_REQUIRED' },
    });
    // Fails fast on input validation — never even queries the ledger.
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('rejects a withdrawal with a blank/whitespace-only bank account', async () => {
    await expect(
      service.withdrawal(actor, { amount: 100, bankAccount: '   ' }),
    ).rejects.toMatchObject({
      response: { code: 'WITHDRAWAL_BANK_ACCOUNT_REQUIRED' },
    });
  });
});

describe('PartnersService.resubmitApplication (regression: an already-approved partner could self-demote and lock themselves out)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('allows resubmitting a rejected application', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'org-1', status: 'submitted' }]);

    const result = await service.resubmitApplication(actor);
    expect(result).toMatchObject({ status: 'submitted' });
  });

  it('rejects resubmitting an already-approved organization (self-lockout guard)', async () => {
    pg.query
      .mockResolvedValueOnce([]) // UPDATE ... WHERE status IN (...) -> no match, already approved
      .mockResolvedValueOnce([{ status: 'approved' }]); // current-status lookup

    await expect(service.resubmitApplication(actor)).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('PartnersService.createHotel business-type enforcement (regression: any approved partner type could create any listing type, unchecked)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('rejects a bus-type organization from creating a hotel listing', async () => {
    pg.query.mockResolvedValueOnce([
      {
        type: 'bus',
        brand_name: 'Comfort Bus',
        legal_name: null,
        address: 'Tashkent',
        city_id: 'city-1',
      },
    ]);

    await expect(
      service.createHotel(actor, { name: 'Illegit Hotel' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('does not block a hotel-type organization (proceeds past the type gate to the actual insert)', async () => {
    pg.query.mockResolvedValueOnce([
      {
        type: 'hotel',
        brand_name: 'Grand Hotel',
        legal_name: null,
        address: 'Tashkent',
        city_id: 'city-1',
      },
    ]);
    // Keyingi so'rovlarni mock qilmaymiz — muhim narsa shu: turi rad
    // etilmadi, va kod haqiqiy INSERT bosqichiga yetib bordi (agar tur
    // bloklangan bo'lsa, hech qanday keyingi so'rov yuborilmas edi).
    pg.query.mockResolvedValue([]);

    await service.createHotel(actor, { name: 'Grand Hotel' }).catch(() => {});

    expect(queryCallsOf(pg).length).toBeGreaterThan(1);
  });

  it('does not block a restaurant-type organization (restaurants also live in the hotels table)', async () => {
    pg.query.mockResolvedValueOnce([
      {
        type: 'restaurant',
        brand_name: 'Osh Markazi',
        legal_name: null,
        address: 'Samarqand',
        city_id: 'city-2',
      },
    ]);
    pg.query.mockResolvedValue([]);

    await service.createHotel(actor, { name: 'Osh Markazi' }).catch(() => {});

    expect(queryCallsOf(pg).length).toBeGreaterThan(1);
  });
});

describe('PartnersService.createBusCompany (regression: no live code path ever created a BusCompany — the entire transport partner line was non-functional)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('creates a bus company for an approved bus-type organization', async () => {
    pg.query
      .mockResolvedValueOnce([
        {
          type: 'bus',
          brand_name: 'Comfort Bus',
          legal_name: 'Comfort Bus LLC',
        },
      ]) // organization lookup
      .mockResolvedValueOnce([]) // no existing company
      .mockResolvedValueOnce([
        {
          id: 'company-1',
          partner_organization_id: 'org-1',
          name: 'Comfort Bus',
          status: 'active',
        },
      ]); // INSERT

    const result = await service.createBusCompany(actor, {});

    expect(result).toMatchObject({ id: 'company-1', status: 'active' });
    const insertCall = queryCallsOf(pg).find(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO bus_companies'),
    );
    expect(insertCall?.[1]).toEqual([
      expect.any(String),
      'org-1',
      'Comfort Bus',
      null,
      null,
      null,
      '[]',
      null,
      null,
      'MODERATE',
      '[]',
      expect.any(String),
    ]);
  });

  it('is idempotent — returns the existing company instead of creating a duplicate', async () => {
    pg.query
      .mockResolvedValueOnce([
        { type: 'bus', brand_name: 'Comfort Bus', legal_name: null },
      ])
      .mockResolvedValueOnce([{ id: 'company-existing' }])
      .mockResolvedValueOnce([{ id: 'company-existing', status: 'active' }])
      .mockResolvedValueOnce([]); // translations lookup for the existing company

    const result = await service.createBusCompany(actor, {});

    expect(result).toMatchObject({ id: 'company-existing' });
    const insertCall = queryCallsOf(pg).find(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO bus_companies'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('rejects a hotel-type organization from creating a bus company', async () => {
    pg.query.mockResolvedValueOnce([
      { type: 'hotel', brand_name: 'Grand Hotel', legal_name: null },
    ]);

    await expect(service.createBusCompany(actor, {})).rejects.toMatchObject({
      status: 403,
    });
  });

  it('allows a mixed-type organization to create a bus company', async () => {
    pg.query
      .mockResolvedValueOnce([
        { type: 'mixed', brand_name: 'Multi Biz', legal_name: null },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'company-2', status: 'active' }]);

    const result = await service.createBusCompany(actor, { name: 'My Fleet' });
    expect(result).toMatchObject({ id: 'company-2' });
    const insertCall = queryCallsOf(pg).find(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO bus_companies'),
    );
    expect(insertCall?.[1]?.[2]).toBe('My Fleet');
  });
});

describe('PartnersService.busCompany / updateBusCompany (read + rename for the transport partner "Kompaniya e\'loni" screen)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('returns null (not a 404) when the organization has no bus company yet', async () => {
    pg.query.mockResolvedValueOnce([]);

    const result = await service.busCompany(actor);

    expect(result).toBeNull();
  });

  it('returns the existing bus company scoped to the actor organization', async () => {
    pg.query
      .mockResolvedValueOnce([
        {
          id: 'company-1',
          partner_organization_id: 'org-1',
          name: 'Comfort Bus',
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([]); // translations lookup

    const result = await service.busCompany(actor);

    expect(result).toMatchObject({ id: 'company-1', name: 'Comfort Bus' });
    expect(queryCallsOf(pg)[0][1]).toEqual(['org-1']);
  });

  it('updates the bus company name for the caller organization', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }]) // busCompanyId lookup
      .mockResolvedValueOnce([]) // existing translations lookup (none yet)
      .mockResolvedValueOnce([]) // upsert uz translation
      .mockResolvedValueOnce([]) // upsert ru translation
      .mockResolvedValueOnce([]) // upsert en translation
      .mockResolvedValueOnce([
        {
          id: 'company-1',
          partner_organization_id: 'org-1',
          name: 'Renamed Fleet',
          status: 'active',
        },
      ]); // UPDATE ... RETURNING

    const result = await service.updateBusCompany(actor, {
      name: 'Renamed Fleet',
    });

    expect(result).toMatchObject({ id: 'company-1', name: 'Renamed Fleet' });
    const updateCall = queryCallsOf(pg).find(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('UPDATE bus_companies'),
    );
    expect(updateCall?.[1]).toEqual([
      'Renamed Fleet',
      expect.any(String),
      'company-1',
    ]);
  });

  it('rejects an empty name with a 400', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'company-1' }]);

    await expect(service.updateBusCompany(actor, {})).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejects updating when the organization has no bus company', async () => {
    pg.query.mockResolvedValueOnce([]); // busCompanyId finds nothing

    await expect(
      service.updateBusCompany(actor, { name: 'Whatever' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('PartnersService bus company short_description/full_description persistence (regression: web-partner PATCH /partners/bus-company sent these fields, but bus_companies had no columns for them and updateBusCompany()/createBusCompany() only ever read body.name — the fields were silently dropped, so the "Umumiy ma\'lumotlar" checklist (generalComplete) could never become true for bus/rent_car partners)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('A: persists name + shortDescription + fullDescription on creation', async () => {
    pg.query
      .mockResolvedValueOnce([
        { type: 'bus', brand_name: 'Comfort Bus', legal_name: null },
      ]) // organization lookup
      .mockResolvedValueOnce([]) // no existing company
      .mockResolvedValueOnce([
        {
          id: 'company-1',
          partner_organization_id: 'org-1',
          name: 'Comfort Bus',
          status: 'active',
        },
      ]) // INSERT bus_companies ... RETURNING
      .mockResolvedValueOnce([]) // INSERT bus_company_translations (uz)
      .mockResolvedValueOnce([]) // INSERT bus_company_translations (ru)
      .mockResolvedValueOnce([]); // INSERT bus_company_translations (en)

    const shortDescription = 'Qulay va ishonchli avtobus kompaniyasi';
    const fullDescription =
      "Comfort Bus 2010-yildan beri O'zbekiston bo'ylab yo'lovchi tashish xizmatlarini ko'rsatib kelmoqda.";

    const result = await service.createBusCompany(actor, {
      name: 'Comfort Bus',
      shortDescription,
      fullDescription,
    });

    const translationCalls = queryCallsOf(pg).filter(
      ([sql]) =>
        typeof sql === 'string' &&
        sql.includes('INSERT INTO bus_company_translations'),
    );
    expect(translationCalls).toHaveLength(3);
    const languages = translationCalls.map(([, params]) => params?.[2]);
    expect(new Set(languages)).toEqual(new Set(['uz', 'ru', 'en']));
    for (const [, params] of translationCalls) {
      expect(params?.[1]).toBe('company-1'); // company_id
      expect(params?.[3]).toBe(shortDescription);
      expect(params?.[4]).toBe(fullDescription);
    }

    expect(result.short_description).toEqual({
      uz: shortDescription,
      ru: shortDescription,
      en: shortDescription,
    });
    expect(result.full_description).toEqual({
      uz: fullDescription,
      ru: fullDescription,
      en: fullDescription,
    });
  });

  it('B: update persists all three fields for an existing company', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }]) // busCompanyId lookup
      .mockResolvedValueOnce([]) // existing translations (none yet)
      .mockResolvedValueOnce([]) // upsert uz
      .mockResolvedValueOnce([]) // upsert ru
      .mockResolvedValueOnce([]) // upsert en
      .mockResolvedValueOnce([
        {
          id: 'company-1',
          partner_organization_id: 'org-1',
          name: 'Renamed Fleet',
          status: 'active',
        },
      ]); // UPDATE bus_companies ... RETURNING

    const shortDescription = 'Yangilangan qisqa tavsif';
    const fullDescription = "Yangilangan to'liq tavsif matni.";

    const result = await service.updateBusCompany(actor, {
      name: 'Renamed Fleet',
      shortDescription,
      fullDescription,
    });

    const upsertCalls = queryCallsOf(pg).filter(
      ([sql]) =>
        typeof sql === 'string' &&
        sql.includes('INSERT INTO bus_company_translations'),
    );
    expect(upsertCalls).toHaveLength(3);
    for (const [sql, params] of upsertCalls) {
      expect(sql).toContain('ON CONFLICT (company_id, language) DO UPDATE');
      expect(params?.[3]).toBe(shortDescription);
      expect(params?.[4]).toBe(fullDescription);
    }

    expect(result.name).toBe('Renamed Fleet');
    expect(result.short_description).toEqual({
      uz: shortDescription,
      ru: shortDescription,
      en: shortDescription,
    });
    expect(result.full_description).toEqual({
      uz: fullDescription,
      ru: fullDescription,
      en: fullDescription,
    });
  });

  it('C: read returns all three fields, localized per language, from persisted translations', async () => {
    pg.query
      .mockResolvedValueOnce([
        {
          id: 'company-1',
          partner_organization_id: 'org-1',
          name: 'Comfort Bus',
          status: 'active',
        },
      ]) // company select
      .mockResolvedValueOnce([
        {
          language: 'uz',
          short_description: 'Qisqa tavsif (uz)',
          description: "To'liq tavsif (uz)",
        },
        {
          language: 'ru',
          short_description: 'Краткое описание',
          description: 'Полное описание',
        },
      ]); // translations select

    const result = await service.busCompany(actor);

    expect(result).toMatchObject({ id: 'company-1', name: 'Comfort Bus' });
    expect(result?.short_description).toEqual({
      uz: 'Qisqa tavsif (uz)',
      ru: 'Краткое описание',
      en: 'Qisqa tavsif (uz)', // no 'en' row persisted — falls back to uz, matching localizedTextFromMap()
    });
    expect(result?.full_description).toEqual({
      uz: "To'liq tavsif (uz)",
      ru: 'Полное описание',
      en: "To'liq tavsif (uz)",
    });
  });

  it('D: partial update — omitting shortDescription/fullDescription retains the previously persisted values (matches updateListingGeneral()\'s established PATCH semantics for hotel_translations)', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }]) // busCompanyId lookup
      .mockResolvedValueOnce([
        {
          language: 'uz',
          short_description: 'Eski qisqa tavsif',
          description: "Eski to'liq tavsif",
        },
        {
          language: 'ru',
          short_description: 'Старое краткое описание',
          description: 'Старое полное описание',
        },
        {
          language: 'en',
          short_description: 'Old short description',
          description: 'Old full description',
        },
      ]) // existing translations
      .mockResolvedValueOnce([]) // upsert uz
      .mockResolvedValueOnce([]) // upsert ru
      .mockResolvedValueOnce([]) // upsert en
      .mockResolvedValueOnce([
        {
          id: 'company-1',
          partner_organization_id: 'org-1',
          name: 'Renamed Only',
          status: 'active',
        },
      ]); // UPDATE ... RETURNING

    const result = await service.updateBusCompany(actor, {
      name: 'Renamed Only',
      // shortDescription / fullDescription intentionally omitted
    });

    const upsertCalls = queryCallsOf(pg).filter(
      ([sql]) =>
        typeof sql === 'string' &&
        sql.includes('INSERT INTO bus_company_translations'),
    );
    const uzCall = upsertCalls.find(([, params]) => params?.[2] === 'uz');
    const ruCall = upsertCalls.find(([, params]) => params?.[2] === 'ru');
    expect(uzCall?.[1]?.[3]).toBe('Eski qisqa tavsif');
    expect(uzCall?.[1]?.[4]).toBe("Eski to'liq tavsif");
    expect(ruCall?.[1]?.[3]).toBe('Старое краткое описание');
    expect(ruCall?.[1]?.[4]).toBe('Старое полное описание');

    expect(result.short_description.uz).toBe('Eski qisqa tavsif');
    expect(result.full_description.ru).toBe('Старое полное описание');
  });

  it('F: checklist verification — persisted-then-read-back values are genuinely non-empty, exactly what generalComplete (apps/web-partner listing-overview.tsx) observes', async () => {
    pg.query
      .mockResolvedValueOnce([
        { type: 'bus', brand_name: 'Comfort Bus', legal_name: null },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'company-1',
          partner_organization_id: 'org-1',
          name: 'Comfort Bus',
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const shortDescription =
      'Bu kompaniya haqida qisqacha, lekin mazmunli tavsif.';
    const fullDescription =
      "Bu kompaniya haqida to'liq tavsif: tarixi, xizmatlari va yo'nalishlari haqida batafsil ma'lumot beriladi.";

    const created = await service.createBusCompany(actor, {
      name: 'Comfort Bus',
      shortDescription,
      fullDescription,
    });

    // generalComplete gates on non-empty, trimmed shortDescription/fullDescription —
    // assert the backend response now genuinely carries that, not empty strings.
    expect(created.short_description.uz.trim().length).toBeGreaterThan(0);
    expect(created.full_description.uz.trim().length).toBeGreaterThan(0);
    expect(created.short_description.uz).toBe(shortDescription);
    expect(created.full_description.uz).toBe(fullDescription);
  });
});

describe('PartnersService bus company Transport location/rental-rules persistence (regression: "SAFAAR — VERIFY BUS/TRANSPORT LOCATION & RENTAL RULES PERSISTENCE" audit confirmed bus_companies had no columns at all for address/latitude/longitude/nearby_places/check_in_time/check_out_time/cancellation_policy_code/extra_fees, and createBusCompany()/updateBusCompany() only ever read body.name — every value the "Joylashuv"/"Ijara qoidalari" screens submitted for a bus/rent_car partner was silently discarded)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  const nearbyPlaces = [{ id: 'p1', name: 'Aeroport', distance: '5 km' }];
  const extraFees = [
    { id: 'f1', name: 'Garov puli', amount: 100000, charge: 'per_stay', required: true },
  ];

  it('CREATE: persists all eight fields when supplied', async () => {
    pg.query
      .mockResolvedValueOnce([
        { type: 'bus', brand_name: 'Comfort Bus', legal_name: null },
      ]) // organization lookup
      .mockResolvedValueOnce([]) // no existing company
      .mockResolvedValueOnce([
        {
          id: 'company-1',
          partner_organization_id: 'org-1',
          name: 'Comfort Bus',
          status: 'active',
          address: 'Toshkent, Amir Temur ko\'chasi 1',
          latitude: 41.311081,
          longitude: 69.240562,
          nearby_places: nearbyPlaces,
          check_in_time: '09:00',
          check_out_time: '18:00',
          cancellation_policy_code: 'STRICT',
          extra_fees: extraFees,
        },
      ]) // INSERT bus_companies ... RETURNING
      .mockResolvedValueOnce([]) // INSERT bus_company_translations (uz)
      .mockResolvedValueOnce([]) // INSERT bus_company_translations (ru)
      .mockResolvedValueOnce([]); // INSERT bus_company_translations (en)

    const result = await service.createBusCompany(actor, {
      name: 'Comfort Bus',
      address: "Toshkent, Amir Temur ko'chasi 1",
      latitude: 41.311081,
      longitude: 69.240562,
      nearbyPlaces,
      checkInTime: '09:00',
      checkOutTime: '18:00',
      cancellationPolicyCode: 'strict',
      extraFees,
    });

    const insertCall = queryCallsOf(pg).find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO bus_companies'),
    );
    expect(insertCall).toBeDefined();
    const [, params] = insertCall!;
    expect(params).toEqual([
      expect.any(String), // id (randomUUID)
      'org-1',
      'Comfort Bus',
      "Toshkent, Amir Temur ko'chasi 1",
      41.311081,
      69.240562,
      JSON.stringify(nearbyPlaces),
      '09:00',
      '18:00',
      'STRICT', // normalized to uppercase
      JSON.stringify(extraFees),
      expect.any(String), // now (created_at = updated_at)
    ]);

    expect(result.address).toBe("Toshkent, Amir Temur ko'chasi 1");
    expect(result.latitude).toBe(41.311081);
    expect(result.longitude).toBe(69.240562);
    expect(result.nearby_places).toEqual(nearbyPlaces);
    expect(result.check_in_time).toBe('09:00');
    expect(result.check_out_time).toBe('18:00');
    expect(result.cancellation_policy_code).toBe('STRICT');
    expect(result.extra_fees).toEqual(extraFees);
  });

  it('CREATE: omitted fields fall back to null/default (address/lat/lng/times → null, nearbyPlaces/extraFees → [], cancellationPolicyCode → MODERATE) — matches bus_companies column defaults', async () => {
    pg.query
      .mockResolvedValueOnce([
        { type: 'bus', brand_name: 'Comfort Bus', legal_name: null },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'company-1', partner_organization_id: 'org-1', name: 'Comfort Bus', status: 'active' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.createBusCompany(actor, { name: 'Comfort Bus' });

    const [, params] = queryCallsOf(pg).find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO bus_companies'),
    )!;
    expect(params).toEqual([
      expect.any(String),
      'org-1',
      'Comfort Bus',
      null, // address
      null, // latitude
      null, // longitude
      '[]', // nearby_places
      null, // check_in_time
      null, // check_out_time
      'MODERATE', // cancellation_policy_code
      '[]', // extra_fees
      expect.any(String),
    ]);
  });

  it('UPDATE: persists all eight fields for an existing company, alongside the existing name/translation behavior', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }]) // busCompanyId lookup
      .mockResolvedValueOnce([]) // existing translations (none yet)
      .mockResolvedValueOnce([]) // upsert uz
      .mockResolvedValueOnce([]) // upsert ru
      .mockResolvedValueOnce([]) // upsert en
      .mockResolvedValueOnce([
        {
          id: 'company-1',
          partner_organization_id: 'org-1',
          name: 'Renamed Fleet',
          status: 'active',
          address: 'Samarqand, Registon ko\'chasi 5',
          latitude: 39.654896,
          longitude: 66.975786,
          nearby_places: nearbyPlaces,
          check_in_time: '08:30',
          check_out_time: '20:00',
          cancellation_policy_code: 'FLEXIBLE',
          extra_fees: extraFees,
        },
      ]); // UPDATE ... RETURNING

    const result = await service.updateBusCompany(actor, {
      name: 'Renamed Fleet',
      address: "Samarqand, Registon ko'chasi 5",
      latitude: 39.654896,
      longitude: 66.975786,
      nearbyPlaces,
      checkInTime: '08:30',
      checkOutTime: '20:00',
      cancellationPolicyCode: 'flexible',
      extraFees,
    });

    const updateCall = queryCallsOf(pg).find(
      ([sql]) => typeof sql === 'string' && sql.startsWith('UPDATE bus_companies'),
    );
    expect(updateCall).toBeDefined();
    const [sql, params] = updateCall!;
    for (const column of [
      'name',
      'address',
      'latitude',
      'longitude',
      'nearby_places',
      'check_in_time',
      'check_out_time',
      'cancellation_policy_code',
      'extra_fees',
      'updated_at',
    ]) {
      expect(sql).toContain(`${column} = $`);
    }
    expect(params).toEqual([
      'Renamed Fleet',
      "Samarqand, Registon ko'chasi 5",
      39.654896,
      66.975786,
      JSON.stringify(nearbyPlaces),
      '08:30',
      '20:00',
      'FLEXIBLE',
      JSON.stringify(extraFees),
      expect.any(String), // updated_at
      'company-1', // WHERE id = $N
    ]);

    expect(result.address).toBe("Samarqand, Registon ko'chasi 5");
    expect(result.latitude).toBe(39.654896);
    expect(result.longitude).toBe(66.975786);
    expect(result.nearby_places).toEqual(nearbyPlaces);
    expect(result.check_in_time).toBe('08:30');
    expect(result.check_out_time).toBe('20:00');
    expect(result.cancellation_policy_code).toBe('FLEXIBLE');
    expect(result.extra_fees).toEqual(extraFees);
  });

  it('UPDATE (partial): supplying only address + extraFees leaves latitude/longitude/nearbyPlaces/checkInTime/checkOutTime/cancellationPolicyCode untouched in the SQL', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'company-1', partner_organization_id: 'org-1', name: 'Comfort Bus', status: 'active' },
      ]);

    await service.updateBusCompany(actor, {
      name: 'Comfort Bus',
      address: 'Buxoro, Registon 10',
      extraFees,
    });

    const [sql, params] = queryCallsOf(pg).find(
      ([s]) => typeof s === 'string' && s.startsWith('UPDATE bus_companies'),
    )!;
    expect(sql).toContain('address = $');
    expect(sql).toContain('extra_fees = $');
    for (const column of [
      'latitude',
      'longitude',
      'nearby_places',
      'check_in_time',
      'check_out_time',
      'cancellation_policy_code',
    ]) {
      expect(sql).not.toContain(`${column} = $`);
    }
    // name, address, extra_fees, updated_at, id — nothing else
    expect(params).toEqual([
      'Comfort Bus',
      'Buxoro, Registon 10',
      JSON.stringify(extraFees),
      expect.any(String),
      'company-1',
    ]);
  });

  it('UPDATE: an explicitly empty address clears it to null rather than storing an empty string', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'company-1', partner_organization_id: 'org-1', name: 'Comfort Bus', status: 'active', address: null },
      ]);

    await service.updateBusCompany(actor, { name: 'Comfort Bus', address: '   ' });

    const [, params] = queryCallsOf(pg).find(
      ([s]) => typeof s === 'string' && s.startsWith('UPDATE bus_companies'),
    )!;
    expect(params[1]).toBeNull();
  });

  it('UPDATE: a non-numeric latitude is not persisted (skipped, not written as NaN) and does not throw', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'company-1', partner_organization_id: 'org-1', name: 'Comfort Bus', status: 'active' },
      ]);

    await expect(
      service.updateBusCompany(actor, { name: 'Comfort Bus', latitude: 'not-a-number' }),
    ).resolves.toBeDefined();

    const [sql] = queryCallsOf(pg).find(
      ([s]) => typeof s === 'string' && s.startsWith('UPDATE bus_companies'),
    )!;
    expect(sql).not.toContain('latitude = $');
  });

  it('UPDATE: a blank cancellationPolicyCode is not persisted (NOT NULL column keeps its previous value rather than being set blank)', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'company-1', partner_organization_id: 'org-1', name: 'Comfort Bus', status: 'active' },
      ]);

    await service.updateBusCompany(actor, { name: 'Comfort Bus', cancellationPolicyCode: '' });

    const [sql] = queryCallsOf(pg).find(
      ([s]) => typeof s === 'string' && s.startsWith('UPDATE bus_companies'),
    )!;
    expect(sql).not.toContain('cancellation_policy_code = $');
  });

  it('UPDATE: also accepts snake_case aliases (nearby_places, check_in_time, check_out_time, cancellation_policy_code, extra_fees)', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'company-1', partner_organization_id: 'org-1', name: 'Comfort Bus', status: 'active' },
      ]);

    await service.updateBusCompany(actor, {
      name: 'Comfort Bus',
      nearby_places: nearbyPlaces,
      check_in_time: '10:00',
      check_out_time: '17:00',
      cancellation_policy_code: 'moderate',
      extra_fees: extraFees,
    });

    const [sql, params] = queryCallsOf(pg).find(
      ([s]) => typeof s === 'string' && s.startsWith('UPDATE bus_companies'),
    )!;
    expect(sql).toContain('nearby_places = $');
    expect(sql).toContain('check_in_time = $');
    expect(sql).toContain('check_out_time = $');
    expect(sql).toContain('cancellation_policy_code = $');
    expect(sql).toContain('extra_fees = $');
    expect(params).toContain('10:00');
    expect(params).toContain('17:00');
    expect(params).toContain('MODERATE');
  });

  it('translation persistence (shortDescription/fullDescription) keeps working unchanged alongside the new fields', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([]) // existing translations
      .mockResolvedValueOnce([]) // upsert uz
      .mockResolvedValueOnce([]) // upsert ru
      .mockResolvedValueOnce([]) // upsert en
      .mockResolvedValueOnce([
        { id: 'company-1', partner_organization_id: 'org-1', name: 'Comfort Bus', status: 'active' },
      ]);

    const shortDescription = 'Qulay va ishonchli avtobus kompaniyasi';
    const fullDescription = "Comfort Bus O'zbekiston bo'ylab ishlaydi.";

    const result = await service.updateBusCompany(actor, {
      name: 'Comfort Bus',
      shortDescription,
      fullDescription,
      address: 'Toshkent',
    });

    const upsertCalls = queryCallsOf(pg).filter(
      ([sql]) =>
        typeof sql === 'string' &&
        sql.includes('INSERT INTO bus_company_translations'),
    );
    expect(upsertCalls).toHaveLength(3);
    for (const [, params] of upsertCalls) {
      expect(params?.[3]).toBe(shortDescription);
      expect(params?.[4]).toBe(fullDescription);
    }
    expect(result.short_description.uz).toBe(shortDescription);
    expect(result.full_description.uz).toBe(fullDescription);
  });
});

describe('PartnersService vehicle/company mutations invalidate the public transport cache (regression: GET /catalog/transports is cached for 1h with zero invalidation hooks — a partner creating a company or vehicle would not appear on the public Transport page for up to an hour)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  let cache: { del: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    cache = { del: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
      undefined,
      cache as unknown as AppCacheService,
    );
  });

  it('invalidates catalog:transports when a new bus company is created', async () => {
    pg.query
      .mockResolvedValueOnce([
        { type: 'bus', brand_name: 'Comfort Bus', legal_name: null },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'company-1', status: 'active' }]);

    await service.createBusCompany(actor, {});

    expect(cache.del).toHaveBeenCalledWith('catalog:transports');
  });

  it('invalidates catalog:transports when a bus company is renamed', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }]) // busCompanyId lookup
      .mockResolvedValueOnce([]) // existing translations lookup
      .mockResolvedValueOnce([]) // upsert uz translation
      .mockResolvedValueOnce([]) // upsert ru translation
      .mockResolvedValueOnce([]) // upsert en translation
      .mockResolvedValueOnce([{ id: 'company-1', name: 'New Name' }]); // UPDATE ... RETURNING

    await service.updateBusCompany(actor, { name: 'New Name' });

    expect(cache.del).toHaveBeenCalledWith('catalog:transports');
  });

  it('invalidates catalog:transports when a vehicle is created', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }]) // busCompanyId lookup
      .mockResolvedValueOnce([{ id: 'vehicle-1' }]); // INSERT ... RETURNING

    await service.createVehicle(actor, {
      name: 'Mercedes Sprinter',
      seats_count: 18,
    });

    expect(cache.del).toHaveBeenCalledWith('catalog:transports');
  });

  it('persists price_per_day on vehicle creation (rent-a-car booking needs a real price)', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([{ id: 'vehicle-1', price_per_day: '250000' }]);

    await service.createVehicle(actor, {
      name: 'Chevrolet Cobalt',
      seats_count: 5,
      price_per_day: 250000,
    });

    const insertCall = queryCallsOf(pg).find(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO vehicles'),
    );
    expect(insertCall?.[1]).toEqual([
      expect.any(String),
      'company-1',
      'Chevrolet Cobalt',
      null,
      5,
      250000,
      expect.any(String),
    ]);
  });

  it('rejects a negative price_per_day', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'company-1' }]);

    await expect(
      service.createVehicle(actor, {
        name: 'Chevrolet Cobalt',
        seats_count: 5,
        price_per_day: -100,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an implausible seat count on creation (regression: audit found 999999 seats accepted)', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'company-1' }]);

    await expect(
      service.createVehicle(actor, {
        name: 'Mega Van',
        seats_count: 999999,
        price_per_day: 100000,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a non-integer seat count on creation (regression: audit found 5.5 seats only failed at the raw DB layer with an unhelpful error)', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'company-1' }]);

    await expect(
      service.createVehicle(actor, {
        name: 'Half Seat Car',
        seats_count: 5.5,
        price_per_day: 100000,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an implausible daily price on creation (regression: audit found 999999999999 accepted)', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'company-1' }]);

    await expect(
      service.createVehicle(actor, {
        name: 'Overpriced Car',
        seats_count: 4,
        price_per_day: 999999999999,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an implausibly short plate number (regression: audit found "asdfghjkl"-style garbage accepted with zero format checking)', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'company-1' }]);

    await expect(
      service.createVehicle(actor, {
        name: 'Bad Plate Car',
        seats_count: 4,
        price_per_day: 100000,
        plate_number: 'AB',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a negative price_per_day on UPDATE (regression: createVehicle validated price but updateVehicle did not — confirmed live via PATCH during audit)', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'vehicle-1' }]); // assertVehicle

    await expect(
      service.updateVehicle(actor, 'vehicle-1', { price_per_day: -50000 }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an arbitrary/garbage status value on UPDATE (regression: audit found any string accepted, e.g. "totally_bogus_status_xyz")', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'vehicle-1' }]); // assertVehicle

    await expect(
      service.updateVehicle(actor, 'vehicle-1', {
        status: 'totally_bogus_status_xyz',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('accepts the documented status values on UPDATE', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'vehicle-1' }]) // assertVehicle
      .mockResolvedValueOnce([{ id: 'vehicle-1', status: 'inactive' }]);

    await expect(
      service.updateVehicle(actor, 'vehicle-1', { status: 'inactive' }),
    ).resolves.toMatchObject({ status: 'inactive' });
  });

  it('invalidates catalog:transports when a vehicle is updated', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'vehicle-1' }]) // assertVehicle
      .mockResolvedValueOnce([{ id: 'vehicle-1', status: 'inactive' }]);

    await service.updateVehicle(actor, 'vehicle-1', { status: 'inactive' });

    expect(cache.del).toHaveBeenCalledWith('catalog:transports');
  });

  it('does not throw when no cache service is provided (cache is optional)', async () => {
    const serviceWithoutCache = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
    pg.query
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([{ id: 'vehicle-1' }]);

    await expect(
      serviceWithoutCache.createVehicle(actor, {
        name: 'Bus',
        seats_count: 20,
      }),
    ).resolves.toBeDefined();
  });
});

describe('PartnersService.updateRoute (regression: routes had zero ownership check — any partner could corrupt any route)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('rejects updating a route that a different company already has live trips on', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'trip-owned-by-someone-else' }]);

    await expect(
      service.updateRoute(actor, 'route-1', { duration_minutes: 999 }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows updating a route with no foreign trips on it', async () => {
    pg.query
      .mockResolvedValueOnce([]) // no foreign usage
      .mockResolvedValueOnce([{ id: 'route-1', duration_minutes: 180 }]);

    const result = await service.updateRoute(actor, 'route-1', {
      duration_minutes: 180,
    });
    expect(result).toMatchObject({ id: 'route-1', duration_minutes: 180 });
  });
});

describe('PartnersService.rejectBooking / cancelTrip (regression: explicit cancellation never released bus seats)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock; transaction: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn(), transaction: jest.fn() };
    pg.transaction.mockImplementation((operation: (tx: unknown) => unknown) =>
      operation({ query: pg.query }),
    );
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('rejectBooking releases the seat tied to the rejected booking', async () => {
    pg.query
      .mockResolvedValueOnce([
        { id: 'booking-1', partner_organization_id: 'org-1' },
      ]) // this.booking() ownership check
      .mockResolvedValueOnce([{ id: 'booking-1', status: 'cancelled' }]) // UPDATE bookings
      .mockResolvedValueOnce([]); // UPDATE trip_seats

    await service.rejectBooking(actor, 'booking-1', { reason: 'No-show' });

    const seatRelease = queryCallsOf(pg).find(
      ([sql]) => typeof sql === 'string' && sql.includes('trip_seats'),
    );
    expect(seatRelease).toBeDefined();
    expect(seatRelease?.[1]).toEqual(['booking-1']);
  });

  it('cancelTrip releases ALL seats on the trip and cancels+auto-refunds any still-open bookings', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'trip-1', company_id: 'company-1' }]) // assertTrip
      .mockResolvedValueOnce([{ id: 'trip-1', status: 'cancelled' }]) // UPDATE trips
      .mockResolvedValueOnce([]) // UPDATE trip_seats (all seats on trip)
      .mockResolvedValueOnce([
        { id: 'booking-1', user_id: 'user-1', currency: 'UZS' },
      ]) // UPDATE bookings ... RETURNING (affected bookings)
      .mockResolvedValueOnce([{ amount: 50000, currency: 'UZS' }]) // SELECT paid payment for booking-1
      .mockResolvedValueOnce([]); // INSERT refunds

    const result = await service.cancelTrip(actor, 'trip-1');

    expect(result).toMatchObject({ id: 'trip-1', status: 'cancelled' });

    const seatRelease = queryCallsOf(pg).find(
      ([sql]) =>
        typeof sql === 'string' &&
        sql.includes('trip_seats') &&
        sql.includes('WHERE trip_id'),
    );
    expect(seatRelease).toBeDefined();
    expect(seatRelease?.[1]).toEqual(['trip-1']);

    const refundInsert = queryCallsOf(pg).find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO refunds'),
    );
    expect(refundInsert).toBeDefined();
    expect(refundInsert?.[1]).toEqual([
      expect.any(String),
      'booking-1',
      'user-1',
      'UZS',
      50000,
      expect.any(String),
      expect.any(String),
    ]);
  });

  it('cancelTrip does not create a refund for a booking that was never paid', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'trip-1', company_id: 'company-1' }])
      .mockResolvedValueOnce([{ id: 'trip-1', status: 'cancelled' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'booking-1', user_id: 'user-1', currency: 'UZS' },
      ])
      .mockResolvedValueOnce([]); // no paid payment found

    await service.cancelTrip(actor, 'trip-1');

    const refundInsert = queryCallsOf(pg).find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO refunds'),
    );
    expect(refundInsert).toBeUndefined();
  });
});

describe('PartnersService.financeOverview / ledger (regression: balance was SUM(bookings) regardless of status)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('reads available/pending balance from partner_ledger_entries, not bookings.total_amount', async () => {
    pg.query
      .mockResolvedValueOnce([{ sum: '160000' }]) // ledger balance
      .mockResolvedValueOnce([{ sum: '0' }]); // committed withdrawals

    const result = await service.financeOverview(actor);

    expect(result).toEqual({
      pending_balance: 160000,
      available_balance: 160000,
      currency: 'UZS',
    });
    const [ledgerSql] = queryCallsOf(pg)[0];
    expect(String(ledgerSql)).toContain('FROM partner_ledger_entries');
  });

  it('subtracts already-committed withdrawals from available_balance but not from pending_balance', async () => {
    pg.query
      .mockResolvedValueOnce([{ sum: '160000' }])
      .mockResolvedValueOnce([{ sum: '60000' }]);

    const result = await service.financeOverview(actor);

    expect(result.pending_balance).toBe(160000);
    expect(result.available_balance).toBe(100000);
  });

  it('never returns a negative available_balance even if withdrawals somehow exceed the ledger total', async () => {
    pg.query
      .mockResolvedValueOnce([{ sum: '50000' }])
      .mockResolvedValueOnce([{ sum: '80000' }]);

    const result = await service.financeOverview(actor);
    expect(result.available_balance).toBe(0);
  });

  it('ledger() lists real partner_ledger_entries rows scoped to the organization', async () => {
    pg.query.mockResolvedValueOnce([
      {
        id: 'entry-1',
        partner_id: 'org-1',
        booking_id: 'booking-1',
        type: 'booking_earned',
        amount: 160000,
        currency: 'UZS',
        created_at: '2026-08-12T00:00:00.000Z',
      },
    ]);

    const result = await service.ledger(actor, {});
    expect(result).toHaveLength(1);
    const [sql, params] = queryCallsOf(pg)[0];
    expect(String(sql)).toContain('FROM partner_ledger_entries');
    expect(String(sql)).toContain('WHERE organization_id = $1');
    expect(params).toEqual(['org-1']);
  });
});

describe('PartnersService.createExport (regression: M-2 duplicate in-flight export rows)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  let jobs: { add: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    jobs = { add: jest.fn().mockResolvedValue(undefined) };
    service = new PartnersService(
      pg as unknown as PostgresService,
      jobs as unknown as JobQueueService,
    );
  });

  it('enqueues a job and returns the new row when no export is already in flight', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'job-1' }]) // INSERT ... ON CONFLICT ... RETURNING id
      .mockResolvedValueOnce([{ id: 'job-1', status: 'queued' }]); // SELECT * WHERE id

    const result = await service.createExport(actor, 'finance', {
      format: 'csv',
    });

    expect(jobs.add).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: 'job-1', status: 'queued' });
  });

  it('does not enqueue a second job and returns the existing row when one is already queued', async () => {
    pg.query
      .mockResolvedValueOnce([]) // INSERT ... ON CONFLICT DO NOTHING -> lost the race, 0 rows
      .mockResolvedValueOnce([{ id: 'job-existing', status: 'queued' }]); // SELECT existing in-flight row

    const result = await service.createExport(actor, 'finance', {
      format: 'csv',
    });

    expect(jobs.add).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'job-existing', status: 'queued' });
  });

  it('the INSERT relies on the DB partial-unique-index conflict target, not a separate check-then-write', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'job-1' }])
      .mockResolvedValueOnce([{ id: 'job-1' }]);

    await service.createExport(actor, 'finance', { format: 'csv' });

    const [sql] = queryCallsOf(pg)[0];
    expect(String(sql)).toContain('ON CONFLICT');
    expect(String(sql)).toContain("status IN ('queued', 'processing')");
  });
});

describe('PartnersService.deleteTeamMember (regression: L-1 false success on cross-org/missing id)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('404s instead of reporting fake success for a member outside the caller org', async () => {
    pg.query.mockResolvedValueOnce([]); // WHERE organization_id filtered it out

    await expect(
      service.deleteTeamMember(actor, 'other-org-member-id'),
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ code: 'TEAM_MEMBER_NOT_FOUND' }) as {
        code: string;
      },
    });
  });

  it('404s for a nonexistent id', async () => {
    pg.query.mockResolvedValueOnce([]);

    await expect(
      service.deleteTeamMember(actor, 'does-not-exist'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('reports success when a real, in-org member is deleted', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'member-1' }]);

    const result = await service.deleteTeamMember(actor, 'member-1');

    expect(result).toEqual({ id: 'member-1', deleted: true });
  });
});

describe('PartnersService webhooks (SSRF guard)', () => {
  let service: PartnersService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>>;
  const actor: RequestActor = {
    id: '00000000-0000-0000-0000-000000000001',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: '00000000-0000-0000-0000-000000000002',
    sessionId: 'test-session-id',
  };

  beforeEach(() => {
    (assertPublicHttpUrl as jest.Mock).mockClear();
    (assertPublicHttpUrl as jest.Mock).mockImplementation((rawUrl: string) =>
      Promise.resolve(new URL(rawUrl)),
    );
    pg = { query: jest.fn().mockResolvedValue([{ id: 'webhook-1' }]) };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('createWebhook validates the URL through the SSRF guard before inserting it', async () => {
    await service.createWebhook(actor, {
      url: 'https://partner.example.com/hook',
    });

    expect(assertPublicHttpUrl).toHaveBeenCalledWith(
      'https://partner.example.com/hook',
    );
  });

  it('createWebhook rejects (and never inserts) a URL the SSRF guard blocks', async () => {
    (assertPublicHttpUrl as jest.Mock).mockRejectedValueOnce(
      new Error('WEBHOOK_URL_NOT_ALLOWED'),
    );

    await expect(
      service.createWebhook(actor, {
        url: 'http://169.254.169.254/latest/meta-data',
      }),
    ).rejects.toThrow('WEBHOOK_URL_NOT_ALLOWED');

    expect(pg.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO partner_webhook_endpoints'),
      expect.anything(),
    );
  });

  it('updateWebhook validates a new URL through the SSRF guard before persisting it', async () => {
    await service.updateWebhook(actor, 'webhook-1', {
      url: 'https://partner.example.com/new-hook',
    });

    expect(assertPublicHttpUrl).toHaveBeenCalledWith(
      'https://partner.example.com/new-hook',
    );
  });

  it('updateWebhook rejects a URL the SSRF guard blocks', async () => {
    (assertPublicHttpUrl as jest.Mock).mockRejectedValueOnce(
      new Error('WEBHOOK_URL_NOT_ALLOWED'),
    );

    await expect(
      service.updateWebhook(actor, 'webhook-1', {
        url: 'http://10.0.0.5/hook',
      }),
    ).rejects.toThrow('WEBHOOK_URL_NOT_ALLOWED');
  });
});

describe('PartnersService.submitPublicPartnerRequest (regression: Hotel QA BUG-002 — "Mas\'ul shaxs" / contact person was collected on the registration form but silently discarded, never persisted anywhere)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('persists the submitted contact person and returns it verbatim instead of falling back to the company name', async () => {
    pg.query
      .mockResolvedValueOnce([]) // duplicate phone/email/taxId check -> none
      .mockResolvedValueOnce([{ id: 'city-1' }]) // resolveCityId("Samarqand") match
      .mockResolvedValueOnce([
        {
          id: 'org-1',
          type: 'hotel',
          legal_name: 'QA Hotel',
          brand_name: 'QA Hotel',
          contact_person: 'Test QA Ismoilov',
          tax_id: '123456789',
          phone: '+998901234567',
          email: 'qa@example.com',
          city_id: 'city-1',
          address: 'Registon 10',
          status: 'submitted',
          rejection_reason: null,
          created_at: '2026-08-25T00:00:00.000Z',
          updated_at: '2026-08-25T00:00:00.000Z',
        },
      ]); // INSERT ... RETURNING

    const { token } = registrationVerificationStore.issue('+998901234567');
    const result = await service.submitPublicPartnerRequest({
      type: 'hotel',
      companyName: 'QA Hotel',
      contactPerson: 'Test QA Ismoilov',
      phone: '+998901234567',
      email: 'qa@example.com',
      city: 'Samarqand',
      address: 'Registon 10',
      taxId: '123456789',
      phoneVerificationToken: token,
    });

    expect(result.item.contactPerson).toBe('Test QA Ismoilov');
    expect(result.item.contactPerson).not.toBe('QA Hotel');

    // The INSERT must actually write contact_person, not just echo the
    // input back without persisting it.
    const insertCall = queryCallsOf(pg)[2];
    expect(insertCall[0]).toMatch(/contact_person/);
    expect(insertCall[1]).toContain('Test QA Ismoilov');
  });

  it('rejects the application when no valid phone-verification proof is presented (2026-09 registration security hardening)', async () => {
    await expect(
      service.submitPublicPartnerRequest({
        type: 'hotel',
        companyName: 'QA Hotel Unverified',
        contactPerson: 'Test QA',
        phone: '+998901234599',
        email: 'qa-unverified@example.com',
        city: 'Samarqand',
        address: 'Registon 10',
        taxId: '999999999',
        // phoneVerificationToken omitted entirely
      }),
    ).rejects.toMatchObject({
      response: { code: 'PARTNER_PHONE_NOT_VERIFIED' },
    });

    // Must fail BEFORE ever touching the DB (no duplicate-check, no insert).
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('rejects a verification proof issued for a DIFFERENT phone number (replay across phones)', async () => {
    const { token } = registrationVerificationStore.issue('+998907650001');

    await expect(
      service.submitPublicPartnerRequest({
        type: 'hotel',
        companyName: 'QA Hotel Cross Phone',
        contactPerson: 'Test QA',
        phone: '+998907650002', // different phone than the proof was issued for
        email: 'qa-cross-phone@example.com',
        city: 'Samarqand',
        address: 'Registon 10',
        taxId: '888888888',
        phoneVerificationToken: token,
      }),
    ).rejects.toMatchObject({
      response: { code: 'PARTNER_PHONE_NOT_VERIFIED' },
    });
  });

  it('rejects a replayed (already-used) verification proof — one-time use', async () => {
    pg.query
      .mockResolvedValueOnce([]) // duplicate check -> none
      .mockResolvedValueOnce([{ id: 'city-1' }]) // resolveCityId
      .mockResolvedValueOnce([
        {
          id: 'org-2',
          type: 'hotel',
          legal_name: 'QA Hotel Replay',
          brand_name: 'QA Hotel Replay',
          contact_person: 'Test QA',
          tax_id: '777777777',
          phone: '+998907650003',
          email: 'qa-replay@example.com',
          city_id: 'city-1',
          address: 'Registon 10',
          status: 'submitted',
          rejection_reason: null,
          created_at: '2026-08-25T00:00:00.000Z',
          updated_at: '2026-08-25T00:00:00.000Z',
        },
      ]);

    const { token } = registrationVerificationStore.issue('+998907650003');
    await service.submitPublicPartnerRequest({
      type: 'hotel',
      companyName: 'QA Hotel Replay',
      contactPerson: 'Test QA',
      phone: '+998907650003',
      email: 'qa-replay@example.com',
      city: 'Samarqand',
      address: 'Registon 10',
      taxId: '777777777',
      phoneVerificationToken: token,
    });

    // Second submission attempt reusing the SAME (already-consumed) token.
    await expect(
      service.submitPublicPartnerRequest({
        type: 'hotel',
        companyName: 'QA Hotel Replay 2',
        contactPerson: 'Test QA',
        phone: '+998907650003',
        email: 'qa-replay-2@example.com',
        city: 'Samarqand',
        address: 'Registon 10',
        taxId: '666666666',
        phoneVerificationToken: token,
      }),
    ).rejects.toMatchObject({
      response: { code: 'PARTNER_PHONE_NOT_VERIFIED' },
    });
  });

  it('falls back to the legal/brand name only for legacy rows that have no contact_person on file', async () => {
    pg.query.mockResolvedValueOnce([
      {
        id: 'org-legacy',
        type: 'hotel',
        legal_name: 'Legacy Hotel LLC',
        brand_name: 'Legacy Hotel',
        contact_person: null,
        tax_id: '987654321',
        phone: '+998901112233',
        email: 'legacy@example.com',
        city_id: 'city-1',
        address: 'Old address',
        status: 'submitted',
        rejection_reason: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const result = await service.publicPartnerRequestStatus(
      '+998901112233',
      undefined,
    );

    expect(result.request?.contactPerson).toBe('Legacy Hotel LLC');
  });
});

describe('PartnersService.listPromotions (regression: "SAFAAR — COMPLETE PARTNER PROMOTIONS RELOAD PERSISTENCE" — no GET /partners/promotions existed at all, so a page reload could never restore a partner\'s own promotion list)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('returns only the authenticated partner organization\'s promotions, newest first', async () => {
    pg.query.mockResolvedValueOnce([
      {
        id: 'promo-2',
        partner_organization_id: 'org-1',
        entity_type: 'vehicle',
        entity_id: 'vehicle-1',
        entity_name: '01A999TT',
        old_price_sum: 400000,
        new_price_sum: 300000,
        discount_percent: 25,
        start_date: '2026-11-01',
        end_date: '2026-11-11',
        status: 'published',
        reviewed_at: '2026-09-24T00:00:00Z',
        reviewed_by: 'admin-1',
        created_at: '2026-09-24T10:00:00Z',
        updated_at: '2026-09-24T10:00:00Z',
      },
      {
        id: 'promo-1',
        partner_organization_id: 'org-1',
        entity_type: 'room',
        entity_id: 'room-1',
        entity_name: 'Xona: 101',
        old_price_sum: 1500000,
        new_price_sum: 1200000,
        discount_percent: 20,
        start_date: '2026-10-01',
        end_date: '2026-10-10',
        status: 'pending_review',
        reviewed_at: null,
        reviewed_by: null,
        created_at: '2026-09-24T09:00:00Z',
        updated_at: '2026-09-24T09:00:00Z',
      },
    ]);

    const result = await service.listPromotions(actor);

    expect(result).toEqual([
      {
        id: 'promo-2',
        entityId: 'vehicle-1',
        entityType: 'vehicle',
        entityName: '01A999TT',
        oldPriceSum: 400000,
        newPriceSum: 300000,
        discountPercent: 25,
        startDate: '2026-11-01',
        endDate: '2026-11-11',
        status: 'published',
        createdAt: '2026-09-24T10:00:00Z',
      },
      {
        id: 'promo-1',
        entityId: 'room-1',
        entityType: 'room',
        entityName: 'Xona: 101',
        oldPriceSum: 1500000,
        newPriceSum: 1200000,
        discountPercent: 20,
        startDate: '2026-10-01',
        endDate: '2026-10-10',
        status: 'pending_review',
        createdAt: '2026-09-24T09:00:00Z',
      },
    ]);

    const [sql, params] = pg.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('WHERE partner_organization_id = $1');
    expect(sql).toContain('ORDER BY created_at DESC');
    // Never filters by anything the caller controls other than their own
    // JWT-derived organizationId — no partner-supplied org id is honored.
    expect(params).toEqual(['org-1']);
  });

  it('rejects when there is no authenticated partner organization', async () => {
    await expect(service.listPromotions(undefined)).rejects.toMatchObject({
      status: 401,
    });
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('a different partner organization only ever queries with its own id (cross-tenant isolation by construction)', async () => {
    pg.query.mockResolvedValueOnce([]);
    const otherActor: RequestActor = { ...actor, organizationId: 'org-2' };

    await service.listPromotions(otherActor);

    const [, params] = pg.query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(['org-2']);
  });

  it('returns an empty array (not null/undefined) when the partner has no promotions', async () => {
    pg.query.mockResolvedValueOnce([]);

    const result = await service.listPromotions(actor);

    expect(result).toEqual([]);
  });

  it('preserves all three status values verbatim', async () => {
    pg.query.mockResolvedValueOnce(
      ['pending_review', 'published', 'rejected'].map((status, i) => ({
        id: `promo-${i}`,
        partner_organization_id: 'org-1',
        entity_type: 'room',
        entity_id: `room-${i}`,
        entity_name: `Xona: ${i}`,
        old_price_sum: 100000,
        new_price_sum: 90000,
        discount_percent: 10,
        start_date: '2026-10-01',
        end_date: '2026-10-10',
        status,
        reviewed_at: null,
        reviewed_by: null,
        created_at: '2026-09-24T00:00:00Z',
        updated_at: '2026-09-24T00:00:00Z',
      })),
    );

    const result = await service.listPromotions(actor);

    expect(result.map((p) => p.status)).toEqual([
      'pending_review',
      'published',
      'rejected',
    ]);
  });
});

describe('PartnersService.createPromotion (regression: "SAFAAR — IMPLEMENT THE TWO CONFIRMED BACKEND GAPS" — web-partner/promotions.ts previously kept `let mockPromotions = []` in browser memory only, no backend at all)', () => {
  let service: PartnersService;
  let pg: { query: jest.Mock };
  const actor: RequestActor = {
    id: 'partner-user-1',
    actorType: 'partner',
    role: Role.PARTNER,
    roles: [Role.PARTNER],
    organizationId: 'org-1',
    sessionId: 'session-1',
  };

  const validRoomInput = {
    entityType: 'room',
    entityId: 'room-1',
    entityName: 'Xona: 101',
    oldPriceSum: 1500000,
    newPriceSum: 1200000,
    discountPercent: 20,
    startDate: '2026-10-01',
    endDate: '2026-10-10',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PartnersService(
      pg as unknown as PostgresService,
      { add: jest.fn() } as unknown as JobQueueService,
    );
  });

  it('creates a promotion for a room owned by the authenticated partner organization', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'room-1' }]) // ownership check (hotel_rooms -> hotels)
      .mockResolvedValueOnce([
        {
          id: 'promo-1',
          partner_organization_id: 'org-1',
          entity_type: 'room',
          entity_id: 'room-1',
          entity_name: 'Xona: 101',
          old_price_sum: 1500000,
          new_price_sum: 1200000,
          discount_percent: 20,
          start_date: '2026-10-01',
          end_date: '2026-10-10',
          status: 'pending_review',
          reviewed_at: null,
          reviewed_by: null,
          created_at: '2026-09-24T00:00:00Z',
          updated_at: '2026-09-24T00:00:00Z',
        },
      ]); // INSERT ... RETURNING

    const result = await service.createPromotion(actor, validRoomInput);

    expect(result).toEqual({
      id: 'promo-1',
      entityId: 'room-1',
      entityType: 'room',
      entityName: 'Xona: 101',
      oldPriceSum: 1500000,
      newPriceSum: 1200000,
      discountPercent: 20,
      startDate: '2026-10-01',
      endDate: '2026-10-10',
      status: 'pending_review',
      createdAt: '2026-09-24T00:00:00Z',
    });

    const insertCall = pg.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO promotions'),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1]).toEqual([
      expect.any(String),
      'org-1',
      'room',
      'room-1',
      'Xona: 101',
      1500000,
      1200000,
      20,
      '2026-10-01',
      '2026-10-10',
      expect.any(String),
    ]);
  });

  it('rejects when no authenticated partner organization is present', async () => {
    await expect(
      service.createPromotion(undefined, validRoomInput),
    ).rejects.toMatchObject({ status: 401 });
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('rejects creating a promotion for a room that belongs to a different partner organization', async () => {
    pg.query.mockResolvedValueOnce([]); // ownership check finds nothing for org-1

    await expect(
      service.createPromotion(actor, validRoomInput),
    ).rejects.toMatchObject({ status: 404 });

    const insertCall = pg.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO promotions'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('rejects when newPriceSum is not lower than oldPriceSum', async () => {
    await expect(
      service.createPromotion(actor, { ...validRoomInput, newPriceSum: 1500000 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(pg.query).not.toHaveBeenCalled();
  });

  it("rejects an entityType other than 'room'/'vehicle'", async () => {
    await expect(
      service.createPromotion(actor, { ...validRoomInput, entityType: 'hotel' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects discountPercent above 99', async () => {
    await expect(
      service.createPromotion(actor, { ...validRoomInput, discountPercent: 100 }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an invalid date range (endDate <= startDate)', async () => {
    await expect(
      service.createPromotion(actor, {
        ...validRoomInput,
        startDate: '2026-10-10',
        endDate: '2026-10-01',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('creates a promotion for a vehicle owned by the authenticated partner organization (bus/rent_car)', async () => {
    pg.query
      .mockResolvedValueOnce([{ id: 'vehicle-1' }]) // ownership check (vehicles -> bus_companies)
      .mockResolvedValueOnce([
        {
          id: 'promo-2',
          partner_organization_id: 'org-1',
          entity_type: 'vehicle',
          entity_id: 'vehicle-1',
          entity_name: '01A123AA (Cobalt)',
          old_price_sum: 400000,
          new_price_sum: 300000,
          discount_percent: 25,
          start_date: '2026-10-01',
          end_date: '2026-10-11',
          status: 'pending_review',
          reviewed_at: null,
          reviewed_by: null,
          created_at: '2026-09-24T00:00:00Z',
          updated_at: '2026-09-24T00:00:00Z',
        },
      ]);

    const result = await service.createPromotion(actor, {
      entityType: 'vehicle',
      entityId: 'vehicle-1',
      entityName: '01A123AA (Cobalt)',
      oldPriceSum: 400000,
      newPriceSum: 300000,
      discountPercent: 25,
      startDate: '2026-10-01',
      endDate: '2026-10-11',
    });

    expect(result.entityType).toBe('vehicle');
    const ownershipCall = pg.query.mock.calls[0];
    expect(String(ownershipCall[0])).toContain('vehicles');
    expect(String(ownershipCall[0])).toContain('bus_companies');
  });

  it('rejects creating a promotion for a vehicle that belongs to a different partner organization', async () => {
    pg.query.mockResolvedValueOnce([]); // ownership check finds nothing for org-1

    await expect(
      service.createPromotion(actor, {
        entityType: 'vehicle',
        entityId: 'vehicle-99',
        entityName: 'Unknown',
        oldPriceSum: 400000,
        newPriceSum: 300000,
        discountPercent: 25,
        startDate: '2026-10-01',
        endDate: '2026-10-11',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
