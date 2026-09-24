import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import { authSessionStore } from '../auth/session-store';
import { AppCacheService } from '../infrastructure/cache.service';
import { JobQueueService } from '../infrastructure/job-queue.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { EventsService } from '../realtime/events.service';
import type { SmsService } from '../infrastructure/sms.service';
import type { UzumCheckoutProvider } from '../payments/providers/uzum-checkout.provider';
import { AdminService } from './admin.service';

describe('AdminService frontend action endpoints', () => {
  let service: AdminService;
  let pgMock: jest.Mocked<Pick<PostgresService, 'query' | 'transaction'>>;
  let eventsMock: {
    notificationCreated: jest.Mock;
    hotelListingChanged: jest.Mock;
    partnerDashboardUpdated: jest.Mock;
  };
  let smsMock: { send: jest.Mock };
  let cacheMock: {
    getOrSet: jest.Mock;
    delByPattern: jest.Mock;
    del: jest.Mock;
  };
  const actor: RequestActor = {
    id: '00000000-0000-0000-0000-000000000001',
    actorType: 'admin',
    role: Role.SUPER_ADMIN,
    roles: [Role.SUPER_ADMIN],
    sessionId: 'test-session-id',
  };

  beforeEach(() => {
    pgMock = {
      query: jest.fn(),
      transaction: jest.fn(),
    };
    pgMock.transaction.mockImplementation((operation) =>
      operation({ query: pgMock.query }),
    );
    eventsMock = {
      notificationCreated: jest.fn(),
      hotelListingChanged: jest.fn(),
      partnerDashboardUpdated: jest.fn(),
    };
    smsMock = {
      send: jest
        .fn()
        .mockResolvedValue({ accepted: true, providerMessageId: '' }),
    };
    cacheMock = {
      getOrSet: jest.fn(
        async <T>(
          _key: string,
          _ttl: number,
          factory: () => Promise<T> | T,
        ): Promise<T> => Promise.resolve(factory()),
      ),
      delByPattern: jest.fn(),
      del: jest.fn(),
    };
    service = new AdminService(
      cacheMock as unknown as AppCacheService,
      { add: jest.fn() } as unknown as JobQueueService,
      pgMock as unknown as PostgresService,
      {
        partnerRequestCreated: jest.fn(),
        partnerRequestDecided: jest.fn(),
        partnerDashboardUpdated: eventsMock.partnerDashboardUpdated,
        bookingStatusChanged: jest.fn(),
        adminDashboardUpdated: jest.fn(),
        notificationCreated: eventsMock.notificationCreated,
        supportTicketUpdated: jest.fn(),
        supportMessageCreated: jest.fn(),
        hotelListingChanged: eventsMock.hotelListingChanged,
      } as unknown as EventsService,
      smsMock as unknown as SmsService,
      { refund: jest.fn() } as unknown as UzumCheckoutProvider,
    );
  });

  it('soft deletes users for the admin delete button', async () => {
    pgMock.query.mockResolvedValue([{ status: 'deleted' }]);
    const result = await service.userDelete(
      actor,
      '00000000-0000-0000-0000-000000000001',
    );
    expect(result.status).toBe('deleted');
  });

  describe('userMessage / usersMessage (regression: "Send SMS" button never sent a real SMS)', () => {
    const userId = '00000000-0000-0000-0000-0000000000aa';
    const notificationRow = {
      id: 'notif-1',
      user_id: userId,
      owner_type: 'user',
      owner_id: userId,
      title: 'Admin xabari',
      body: 'Salom!',
      read_at: null,
      created_at: '2026-08-21T00:00:00.000Z',
    };

    it('sends a real SMS to the user phone, not just an in-app notification', async () => {
      pgMock.query
        .mockResolvedValueOnce([notificationRow]) // INSERT notifications
        .mockResolvedValueOnce([{ phone: '+998901234567' }]); // SELECT phone

      const result = await service.userMessage(actor, userId, {
        message: 'Salom!',
      });

      expect(smsMock.send).toHaveBeenCalledWith({
        phone: '+998901234567',
        text: 'Salom!',
      });
      expect(result).toMatchObject({ sms_sent: true });
    });

    it('reports sms_sent:false (not a fake success) when the user has no phone on file', async () => {
      pgMock.query
        .mockResolvedValueOnce([notificationRow])
        .mockResolvedValueOnce([{ phone: null }]);

      const result = await service.userMessage(actor, userId, {
        message: 'Salom!',
      });

      expect(smsMock.send).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        sms_sent: false,
        sms_error: 'USER_HAS_NO_PHONE',
      });
    });

    it('reports the real SMS provider failure instead of pretending it worked', async () => {
      pgMock.query
        .mockResolvedValueOnce([notificationRow])
        .mockResolvedValueOnce([{ phone: '+998901234567' }]);
      smsMock.send.mockRejectedValueOnce(
        new Error('SMS_PROVIDER_NOT_CONFIGURED'),
      );

      const result = await service.userMessage(actor, userId, {
        message: 'Salom!',
      });

      expect(result).toMatchObject({
        sms_sent: false,
        sms_error: 'SMS_PROVIDER_NOT_CONFIGURED',
      });
    });
  });

  it('lists only onboarding partner applications in requests', async () => {
    pgMock.query.mockResolvedValue([]);

    await service.partnerRequests();

    const sql = String(pgMock.query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain("'submitted'");
    expect(sql).toContain("'under_review'");
    expect(sql).toContain("'more_information_required'");
    expect(sql).not.toContain("po.status <> 'approved'");
  });

  it('updates support status and appends an admin support message', async () => {
    pgMock.query.mockResolvedValue([{ status: 'closed' }]);
    const closed = await service.supportStatus(
      '00000000-0000-0000-0000-000000000002',
      {
        status: 'closed',
      },
    );
    expect(closed['status']).toBe('closed');
  });

  it('normalizes withdrawal actions used by admin finance buttons', async () => {
    pgMock.query.mockResolvedValue([{ status: 'approved' }]);
    await expect(
      service.withdrawalStatus(
        '00000000-0000-0000-0000-000000000003',
        'approved',
      ),
    ).resolves.toMatchObject({
      status: 'approved',
    });
  });

  it('publishes a hotel and prepares its successor draft once', async () => {
    const hotelId = '00000000-0000-0000-0000-000000000004';
    const partnerId = '00000000-0000-0000-0000-000000000005';
    const cityId = '00000000-0000-0000-0000-000000000006';
    const submitterId = '00000000-0000-0000-0000-000000000008';
    const notificationId = '00000000-0000-0000-0000-000000000009';
    jest
      .spyOn(service, 'hotel')
      .mockResolvedValueOnce({
        completeness: { is_publishable: true, missing_fields: [] },
        name: { uz: 'Test hotel' },
        slug: 'test-hotel',
      } as never)
      .mockResolvedValueOnce({ id: hotelId, status: 'published' } as never);
    pgMock.query
      .mockResolvedValueOnce([
        {
          id: hotelId,
          partner_organization_id: partnerId,
          city_id: cityId,
          status: 'pending_review',
          submitted_by: submitterId,
          next_draft_prepared_at: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: hotelId,
          partner_organization_id: partnerId,
          status: 'published',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: notificationId,
          owner_type: 'partner',
          owner_id: submitterId,
          title: "E'loningiz muvaffaqiyatli tasdiqlandi",
        },
      ]);

    await expect(
      service.hotelStatus(actor, hotelId, 'published'),
    ).resolves.toMatchObject({ status: 'published' });

    expect(pgMock.query).toHaveBeenCalledWith(
      expect.stringContaining('status = $2::"HotelStatus"'),
      [hotelId, 'published', '', actor.id, expect.any(String)],
    );
    const moderationCall = pgMock.query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('set status = $2'),
    );
    expect(moderationCall?.[0]).toContain(
      `$2::"HotelStatus" = 'rejected'::"HotelStatus"`,
    );
    expect(pgMock.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into hotels'),
      expect.arrayContaining([
        expect.any(String),
        partnerId,
        expect.any(String),
        cityId,
      ]),
    );
    expect(pgMock.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into notifications'),
      expect.arrayContaining([
        expect.any(String),
        submitterId,
        "E'loningiz muvaffaqiyatli tasdiqlandi",
      ]),
    );
    expect(eventsMock.notificationCreated).toHaveBeenCalledWith(
      submitterId,
      expect.objectContaining({ id: notificationId }),
    );
    expect(eventsMock.hotelListingChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelId,
        partnerId,
        status: 'published',
        previousStatus: 'pending_review',
        notificationId,
      }),
    );
    expect(pgMock.transaction).toHaveBeenCalledTimes(1);
  });

  it('does not prepare another draft after the approval marker is set', async () => {
    const hotelId = '00000000-0000-0000-0000-000000000004';
    jest
      .spyOn(service, 'hotel')
      .mockResolvedValueOnce({
        completeness: { is_publishable: true, missing_fields: [] },
        name: { uz: 'Test hotel' },
      } as never)
      .mockResolvedValueOnce({ id: hotelId, status: 'published' } as never);
    pgMock.query
      .mockResolvedValueOnce([
        {
          id: hotelId,
          partner_organization_id: '00000000-0000-0000-0000-000000000005',
          city_id: '00000000-0000-0000-0000-000000000006',
          status: 'published',
          submitted_by: '00000000-0000-0000-0000-000000000008',
          next_draft_prepared_at: new Date().toISOString(),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: hotelId,
          partner_organization_id: '00000000-0000-0000-0000-000000000005',
          status: 'published',
        },
      ])
      .mockResolvedValueOnce([{ id: '00000000-0000-0000-0000-000000000007' }]);

    await service.hotelStatus(actor, hotelId, 'published');

    expect(
      pgMock.query.mock.calls.some(
        ([sql]) =>
          typeof sql === 'string' && sql.includes('insert into hotels'),
      ),
    ).toBe(false);
    expect(
      pgMock.query.mock.calls.some(
        ([sql]) =>
          typeof sql === 'string' && sql.includes('insert into notifications'),
      ),
    ).toBe(false);
    expect(eventsMock.notificationCreated).not.toHaveBeenCalled();
  });

  it('clears an existing safe draft after the first approval', async () => {
    const hotelId = '00000000-0000-0000-0000-000000000004';
    const draftId = '00000000-0000-0000-0000-000000000007';
    const partnerId = '00000000-0000-0000-0000-000000000005';
    const cityId = '00000000-0000-0000-0000-000000000006';
    const submitterId = '00000000-0000-0000-0000-000000000008';
    jest
      .spyOn(service, 'hotel')
      .mockResolvedValueOnce({
        completeness: { is_publishable: true, missing_fields: [] },
        name: { uz: 'Test hotel' },
      } as never)
      .mockResolvedValueOnce({ id: hotelId, status: 'published' } as never);
    pgMock.query
      .mockResolvedValueOnce([
        {
          id: hotelId,
          partner_organization_id: partnerId,
          city_id: cityId,
          status: 'pending_review',
          submitted_by: submitterId,
          next_draft_prepared_at: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: hotelId,
          partner_organization_id: partnerId,
          status: 'published',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: draftId, has_bookings: false }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.hotelStatus(actor, hotelId, 'published');

    expect(pgMock.query).toHaveBeenCalledWith(
      expect.stringContaining("address = '', latitude = null"),
      [draftId, cityId, expect.any(String)],
    );
    expect(pgMock.query).toHaveBeenCalledWith(
      expect.stringContaining('delete from hotel_rooms'),
      [draftId],
    );
    expect(pgMock.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into hotel_translations'),
      [draftId, expect.any(String)],
    );
  });

  it('rejects a hotel with its reason, notification, and blank draft', async () => {
    const hotelId = '00000000-0000-0000-0000-000000000004';
    const partnerId = '00000000-0000-0000-0000-000000000005';
    const cityId = '00000000-0000-0000-0000-000000000006';
    const submitterId = '00000000-0000-0000-0000-000000000008';
    const notificationId = '00000000-0000-0000-0000-000000000009';
    const reason = 'Rasmlar sifati talabga javob bermaydi';
    jest
      .spyOn(service, 'hotel')
      .mockResolvedValueOnce({ name: { uz: 'Test hotel' } } as never)
      .mockResolvedValueOnce({ id: hotelId, status: 'rejected' } as never);
    pgMock.query
      .mockResolvedValueOnce([
        {
          id: hotelId,
          partner_organization_id: partnerId,
          city_id: cityId,
          status: 'pending_review',
          submitted_by: submitterId,
          next_draft_prepared_at: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: hotelId,
          partner_organization_id: partnerId,
          status: 'rejected',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: notificationId,
          owner_type: 'partner',
          owner_id: submitterId,
          title: "E'loningiz rad etildi",
          body: `"Test hotel" e'loni rad etildi. Sabab: ${reason}`,
        },
      ]);

    await expect(
      service.hotelStatus(actor, hotelId, 'rejected', reason),
    ).resolves.toMatchObject({ status: 'rejected' });

    expect(eventsMock.notificationCreated).toHaveBeenCalledWith(
      submitterId,
      expect.objectContaining({
        title: "E'loningiz rad etildi",
        body: `"Test hotel" e'loni rad etildi. Sabab: ${reason}`,
      }),
    );
    expect(eventsMock.hotelListingChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        rejectionReason: reason,
        notificationId,
      }),
    );
  });

  it('loads admin settings from persistent storage with defaults', async () => {
    pgMock.query.mockResolvedValue([
      {
        group_key: 'general',
        value: {
          support_email: 'help@safaar.uz',
          maintenance_mode: true,
        },
      },
      {
        group_key: 'finance',
        value: {
          hotel_commission_rate: 17,
        },
      },
    ]);

    await expect(service.settings()).resolves.toMatchObject({
      general: {
        app_name: 'safaar',
        support_email: 'help@safaar.uz',
        maintenance_mode: true,
      },
      finance: {
        hotel_commission_rate: 17,
        bus_commission_rate: 10,
      },
    });
  });

  it('persists admin settings groups and audits the change', async () => {
    pgMock.query
      .mockResolvedValueOnce([
        {
          group_key: 'finance',
          value: {
            hotel_commission_rate: 18,
            bus_commission_rate: 11,
          },
          updated_at: '2026-07-14T12:30:00.000Z',
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(
      service.settingsGroup(actor, 'finance', {
        hotel_commission_rate: 18,
        bus_commission_rate: 11,
      }),
    ).resolves.toMatchObject({
      group: 'finance',
      hotel_commission_rate: 18,
      bus_commission_rate: 11,
    });
    expect(pgMock.query).toHaveBeenCalledTimes(2);
  });

  it('creates CMS pages from admin payloads for the public user panel', async () => {
    pgMock.query.mockResolvedValueOnce([
      {
        id: '00000000-0000-7005-0000-000000000004',
        type: 'page',
        slug: 'about',
        title_i18n: { uz: 'Biz haqimizda', ru: null, en: null },
        body_i18n: { uz: 'Safaar haqida matn', ru: null, en: null },
        status: 'published',
        metadata: { menu: 'footer', seoTitle: 'Biz haqimizda' },
        published_at: '2026-08-05T07:00:00.000Z',
        created_at: '2026-08-05T07:00:00.000Z',
        updated_at: '2026-08-05T07:00:00.000Z',
      },
    ]);

    await expect(
      service.cmsCreate('pages', {
        slug: '/about',
        title: 'Biz haqimizda',
        body: 'Safaar haqida matn',
        menu: 'footer',
        seoTitle: 'Biz haqimizda',
      }),
    ).resolves.toMatchObject({
      slug: 'about',
      url: '/about',
      title: 'Biz haqimizda',
      body: 'Safaar haqida matn',
      status: 'published',
    });

    expect(pgMock.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into cms_entries'),
      [
        'page',
        'about',
        JSON.stringify({ uz: 'Biz haqimizda', ru: null, en: null }),
        JSON.stringify({ uz: 'Safaar haqida matn', ru: null, en: null }),
        'published',
        JSON.stringify({ menu: 'footer', seoTitle: 'Biz haqimizda' }),
        null,
      ],
    );
  });

  it('archives CMS pages through the admin delete endpoint', async () => {
    const pageId = '00000000-0000-7005-0000-000000000004';
    pgMock.query.mockResolvedValueOnce([
      {
        id: pageId,
        type: 'page',
        slug: 'about',
        title_i18n: { uz: 'Biz haqimizda' },
        body_i18n: { uz: 'Safaar haqida matn' },
        status: 'archived',
        metadata: {},
        published_at: '2026-08-05T07:00:00.000Z',
        created_at: '2026-08-05T07:00:00.000Z',
        updated_at: '2026-08-05T07:30:00.000Z',
      },
    ]);

    await expect(service.cmsDelete('pages', pageId)).resolves.toMatchObject({
      id: pageId,
      status: 'archived',
    });

    expect(pgMock.query).toHaveBeenCalledWith(
      expect.stringContaining('type = any($3::text[])'),
      [pageId, 'archived', ['page']],
    );
  });

  describe('reorderFeaturedHotels (cms/featured-hotels reorder — was a frontend-only mock, no persistence)', () => {
    const idA = '00000000-0000-9300-0000-000000000001';
    const idB = '00000000-0000-9300-0000-000000000002';
    const idC = '00000000-0000-9300-0000-000000000003';

    it('persists server-derived order (array index), not any client-supplied number', async () => {
      pgMock.query.mockResolvedValueOnce([{ id: idA }, { id: idB }]); // locked featured rows
      pgMock.query.mockResolvedValueOnce([]); // update idB -> 0
      pgMock.query.mockResolvedValueOnce([]); // update idA -> 1

      const result = await service.reorderFeaturedHotels([idB, idA]);

      expect(result).toEqual({ updated: 2 });
      expect(pgMock.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('set featured_order = $2'),
        [idB, 0],
      );
      expect(pgMock.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('set featured_order = $2'),
        [idA, 1],
      );
      expect(cacheMock.delByPattern).toHaveBeenCalledWith('hotels:list:*');
    });

    it('rejects the whole request if any ID is not an existing, featured hotel (no arbitrary-hotel-ID writes)', async () => {
      pgMock.query.mockResolvedValueOnce([{ id: idA }]); // only idA is actually featured

      await expect(
        service.reorderFeaturedHotels([idA, idB]),
      ).rejects.toMatchObject({
        response: { code: 'HOTEL_NOT_FEATURED', invalidIds: [idB] },
      });

      // Nothing beyond the initial lookup was ever written.
      expect(pgMock.query).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate IDs in the request (never silently collapses them into one order slot)', async () => {
      await expect(
        service.reorderFeaturedHotels([idA, idA]),
      ).rejects.toMatchObject({ response: { code: 'DUPLICATE_HOTEL_ID' } });
      expect(pgMock.query).not.toHaveBeenCalled();
    });

    it('rejects non-UUID entries instead of passing them through to SQL', async () => {
      await expect(
        service.reorderFeaturedHotels(['not-a-uuid']),
      ).rejects.toMatchObject({ response: { code: 'INVALID_ORDER' } });
      expect(pgMock.query).not.toHaveBeenCalled();
    });

    it('is a no-op for an empty list (does not touch the database)', async () => {
      await expect(service.reorderFeaturedHotels([])).resolves.toEqual({
        updated: 0,
      });
      expect(pgMock.query).not.toHaveBeenCalled();
    });

    it('is idempotent under a concurrent reorder — the second call fully overwrites the first (last write wins, no partial interleave)', async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: idA },
        { id: idB },
        { id: idC },
      ]);
      pgMock.query.mockResolvedValueOnce([]);
      pgMock.query.mockResolvedValueOnce([]);
      pgMock.query.mockResolvedValueOnce([]);
      await service.reorderFeaturedHotels([idC, idB, idA]);

      pgMock.query.mockResolvedValueOnce([
        { id: idA },
        { id: idB },
        { id: idC },
      ]);
      pgMock.query.mockResolvedValueOnce([]);
      pgMock.query.mockResolvedValueOnce([]);
      pgMock.query.mockResolvedValueOnce([]);
      await service.reorderFeaturedHotels([idA, idB, idC]);

      expect(pgMock.query).toHaveBeenNthCalledWith(
        6,
        expect.stringContaining('set featured_order = $2'),
        [idA, 0],
      );
      expect(pgMock.query).toHaveBeenNthCalledWith(
        7,
        expect.stringContaining('set featured_order = $2'),
        [idB, 1],
      );
      expect(pgMock.query).toHaveBeenNthCalledWith(
        8,
        expect.stringContaining('set featured_order = $2'),
        [idC, 2],
      );
    });
  });

  describe('setHotelFeatured (admin "Mashhur qilish/chiqarish" toggle — was a frontend-only mock with no backend route)', () => {
    const hotelId = '00000000-0000-9203-0000-000000000009';

    it('ON: appends the hotel to the end of the existing order (MAX+1), never disturbing other hotels', async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: hotelId, featured: false, featured_order: null },
      ]); // locked current row
      pgMock.query.mockResolvedValueOnce([]); // pg_advisory_xact_lock
      pgMock.query.mockResolvedValueOnce([{ next_order: 3 }]); // MAX(featured_order)+1
      pgMock.query.mockResolvedValueOnce([
        { id: hotelId, featured: true, featured_order: 3 },
      ]); // update ... returning

      const result = await service.setHotelFeatured(hotelId, true);

      expect(result).toEqual({
        id: hotelId,
        featured: true,
        featured_order: 3,
      });
      expect(pgMock.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_xact_lock'),
      );
      expect(pgMock.query).toHaveBeenLastCalledWith(
        expect.stringContaining('set featured = $2, featured_order = $3'),
        [hotelId, true, 3],
      );
      expect(cacheMock.delByPattern).toHaveBeenCalledWith('hotels:list:*');
    });

    it('ON, no other featured hotels yet: starts at 0', async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: hotelId, featured: false, featured_order: null },
      ]);
      pgMock.query.mockResolvedValueOnce([]);
      pgMock.query.mockResolvedValueOnce([{ next_order: 0 }]); // coalesce(max(...), -1) + 1 with no rows
      pgMock.query.mockResolvedValueOnce([
        { id: hotelId, featured: true, featured_order: 0 },
      ]);

      const result = await service.setHotelFeatured(hotelId, true);

      expect(result.featured_order).toBe(0);
    });

    it('OFF: clears featured_order to NULL and does not touch any other hotel row', async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: hotelId, featured: true, featured_order: 2 },
      ]); // locked current row
      pgMock.query.mockResolvedValueOnce([
        { id: hotelId, featured: false, featured_order: null },
      ]); // update ... returning

      const result = await service.setHotelFeatured(hotelId, false);

      expect(result).toEqual({
        id: hotelId,
        featured: false,
        featured_order: null,
      });
      // No advisory lock / MAX query on the OFF path — only 2 queries total.
      expect(pgMock.query).toHaveBeenCalledTimes(2);
      expect(pgMock.query).toHaveBeenLastCalledWith(
        expect.stringContaining('set featured = $2, featured_order = $3'),
        [hotelId, false, null],
      );
      expect(cacheMock.delByPattern).toHaveBeenCalledWith('hotels:list:*');
    });

    it('already featured + ON again: idempotent no-op, no write query issued', async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: hotelId, featured: true, featured_order: 1 },
      ]);

      const result = await service.setHotelFeatured(hotelId, true);

      expect(result).toEqual({
        id: hotelId,
        featured: true,
        featured_order: 1,
      });
      expect(pgMock.query).toHaveBeenCalledTimes(1); // only the lookup, no update
    });

    it('already non-featured + OFF again: idempotent no-op, no write query issued', async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: hotelId, featured: false, featured_order: null },
      ]);

      const result = await service.setHotelFeatured(hotelId, false);

      expect(result).toEqual({
        id: hotelId,
        featured: false,
        featured_order: null,
      });
      expect(pgMock.query).toHaveBeenCalledTimes(1);
    });

    it('non-existent hotel: 404, never falls through to a write', async () => {
      pgMock.query.mockResolvedValueOnce([]); // no row locked

      await expect(
        service.setHotelFeatured(hotelId, true),
      ).rejects.toMatchObject({
        response: { code: 'HOTEL_NOT_FOUND' },
      });
      expect(pgMock.query).toHaveBeenCalledTimes(1);
    });

    it('rejects a non-UUID id before touching the database', async () => {
      await expect(
        service.setHotelFeatured('not-a-uuid', true),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_HOTEL_ID' },
      });
      expect(pgMock.query).not.toHaveBeenCalled();
      expect(pgMock.transaction).not.toHaveBeenCalled();
    });

    it('locks the target row (FOR UPDATE) inside a transaction — concurrent toggles on the same hotel serialize instead of racing', async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: hotelId, featured: false, featured_order: null },
      ]);
      pgMock.query.mockResolvedValueOnce([]);
      pgMock.query.mockResolvedValueOnce([{ next_order: 0 }]);
      pgMock.query.mockResolvedValueOnce([
        { id: hotelId, featured: true, featured_order: 0 },
      ]);

      await service.setHotelFeatured(hotelId, true);

      expect(pgMock.transaction).toHaveBeenCalledTimes(1);
      expect(pgMock.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('for update'),
        [hotelId],
      );
    });
  });

  describe('financeOverview (regression: totalCommission was mismapped to paid_amount — total collected payments, not SAFAAR commission; pending/paid withdrawals and total_refunds were never computed at all)', () => {
    it('returns real commission (bookings.commission_amount), not paid_amount, plus withdrawal and refund totals', async () => {
      pgMock.query.mockResolvedValueOnce([
        {
          gross_amount: 1850000,
          paid_amount: 400000,
          total_commission: 198000,
          pending_withdrawals: 50000,
          paid_withdrawals: 120000,
          total_refunds: 30000,
        },
      ]);

      const result = await service.financeOverview();

      expect(result).toEqual({
        gross_amount: 1850000,
        paid_amount: 400000,
        total_commission: 198000,
        pending_withdrawals: 50000,
        paid_withdrawals: 120000,
        total_refunds: 30000,
        currency: 'UZS',
      });
      // The query must source commission from bookings.commission_amount,
      // never from payments.amount (that's paid_amount, a different
      // concept entirely — collected money, not SAFAAR's cut).
      const [sql] = pgMock.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('sum(commission_amount) from bookings');
      expect(sql).toContain(
        "sum(amount) from withdrawal_requests where status in ('requested', 'approved')",
      );
      expect(sql).toContain(
        "sum(amount) from withdrawal_requests where status = 'paid'",
      );
      expect(sql).toContain(
        "sum(approved_amount) from refunds where status = 'approved'",
      );
    });

    it('defaults every field to 0 when there is no data yet (empty tables)', async () => {
      pgMock.query.mockResolvedValueOnce([
        {
          gross_amount: 0,
          paid_amount: 0,
          total_commission: 0,
          pending_withdrawals: 0,
          paid_withdrawals: 0,
          total_refunds: 0,
        },
      ]);

      const result = await service.financeOverview();

      expect(result).toEqual({
        gross_amount: 0,
        paid_amount: 0,
        total_commission: 0,
        pending_withdrawals: 0,
        paid_withdrawals: 0,
        total_refunds: 0,
        currency: 'UZS',
      });
    });
  });

  describe('invalidateCmsCache (regression: destinations admin write left the public /catalog/destinations cache stale for up to 5 minutes)', () => {
    const destinationRow = {
      id: '00000000-0000-7006-0000-000000000001',
      type: 'destination',
      slug: 'toshkent',
      title_i18n: { uz: 'Toshkent', ru: null, en: null },
      body_i18n: { uz: null, ru: null, en: null },
      status: 'published',
      metadata: {
        imageUrl: 'https://example.com/t.jpg',
        link: '/uz/hotels',
        order: 1,
      },
      published_at: '2026-09-17T00:00:00.000Z',
      created_at: '2026-09-17T00:00:00.000Z',
      updated_at: '2026-09-17T00:00:00.000Z',
    };

    it('cmsCreate: destinations resource busts catalog:destinations, other resources do not', async () => {
      pgMock.query.mockResolvedValueOnce([destinationRow]);
      await service.cmsCreate('destinations', { title: 'Toshkent' });
      expect(cacheMock.del).toHaveBeenCalledWith('catalog:destinations');

      cacheMock.del.mockClear();
      pgMock.query.mockResolvedValueOnce([
        { ...destinationRow, type: 'page', slug: 'about' },
      ]);
      await service.cmsCreate('pages', { title: 'About' });
      expect(cacheMock.del).not.toHaveBeenCalled();
    });

    it('cmsUpdate (edit): destinations resource busts catalog:destinations', async () => {
      pgMock.query.mockResolvedValueOnce([destinationRow]);
      await service.cmsUpdate('destinations', destinationRow.id, {
        title: 'Toshkent 2',
      });
      expect(cacheMock.del).toHaveBeenCalledWith('catalog:destinations');
    });

    it('cmsAction (publish/unpublish — active/inactive toggle) busts catalog:destinations', async () => {
      pgMock.query.mockResolvedValueOnce([
        { ...destinationRow, status: 'draft' },
      ]);
      await service.cmsAction('destinations', destinationRow.id, 'unpublish');
      expect(cacheMock.del).toHaveBeenCalledWith('catalog:destinations');

      cacheMock.del.mockClear();
      pgMock.query.mockResolvedValueOnce([destinationRow]);
      await service.cmsAction('destinations', destinationRow.id, 'publish');
      expect(cacheMock.del).toHaveBeenCalledWith('catalog:destinations');
    });

    it('cmsAction (reorder via cmsUpdate metadata.order) busts catalog:destinations', async () => {
      // Reorder ishlaydi cmsUpdate orqali ({metadata:{order:n}} PATCH) —
      // cms-destination-manager.tsx'dagi move() shu yo'lni ishlatadi,
      // chunki cmsAction'ning o'z 'reorder' action'i statusMap'da yo'q.
      pgMock.query.mockResolvedValueOnce([
        {
          ...destinationRow,
          metadata: { ...destinationRow.metadata, order: 5 },
        },
      ]);
      await service.cmsUpdate('destinations', destinationRow.id, {
        metadata: { order: 5 },
      });
      expect(cacheMock.del).toHaveBeenCalledWith('catalog:destinations');
    });

    it('cmsTranslation: destinations resource busts catalog:destinations', async () => {
      pgMock.query.mockResolvedValueOnce([destinationRow]);
      await service.cmsTranslation('destinations', destinationRow.id, {
        link: '/uz/hotels?city_id=toshkent',
      });
      expect(cacheMock.del).toHaveBeenCalledWith('catalog:destinations');
    });

    it('other CMS resources (banners) never call cache.del — existing behavior unchanged', async () => {
      pgMock.query.mockResolvedValueOnce([
        { ...destinationRow, type: 'banner', slug: 'summer-sale' },
      ]);
      await service.cmsUpdate('banners', destinationRow.id, {
        title: 'Summer',
      });
      expect(cacheMock.del).not.toHaveBeenCalled();
      expect(cacheMock.delByPattern).toHaveBeenCalledWith('cms:*');
      expect(cacheMock.delByPattern).not.toHaveBeenCalledWith(
        'catalog:attractions:*',
      );
      expect(cacheMock.delByPattern).not.toHaveBeenCalledWith(
        'catalog:restaurants:*',
      );
    });

    it('attractions mutation (regression: "BACKEND BUG AUDIT" — catalog:attractions:* is a separate cache-key prefix from cms:*, so admin edits never invalidated the public attractions cache) busts both cms:* and catalog:attractions:*', async () => {
      const attractionRow = {
        ...destinationRow,
        type: 'attraction',
        slug: 'chorsu-bazaar',
      };

      pgMock.query.mockResolvedValueOnce([attractionRow]);
      await service.cmsCreate('attractions', { title: 'Chorsu bozori' });
      expect(cacheMock.delByPattern).toHaveBeenCalledWith('cms:*');
      expect(cacheMock.delByPattern).toHaveBeenCalledWith(
        'catalog:attractions:*',
      );
      expect(cacheMock.del).not.toHaveBeenCalledWith('catalog:destinations');

      cacheMock.delByPattern.mockClear();
      pgMock.query.mockResolvedValueOnce([attractionRow]);
      await service.cmsUpdate('attractions', attractionRow.id, {
        title: 'Chorsu',
      });
      expect(cacheMock.delByPattern).toHaveBeenCalledWith('cms:*');
      expect(cacheMock.delByPattern).toHaveBeenCalledWith(
        'catalog:attractions:*',
      );

      cacheMock.delByPattern.mockClear();
      pgMock.query.mockResolvedValueOnce([attractionRow]);
      await service.cmsAction('attractions', attractionRow.id, 'publish');
      expect(cacheMock.delByPattern).toHaveBeenCalledWith(
        'catalog:attractions:*',
      );

      cacheMock.delByPattern.mockClear();
      pgMock.query.mockResolvedValueOnce([attractionRow]);
      await service.cmsTranslation('attractions', attractionRow.id, {
        title: 'Chorsu',
      });
      expect(cacheMock.delByPattern).toHaveBeenCalledWith(
        'catalog:attractions:*',
      );
    });

    it('restaurants mutation busts both cms:* and catalog:restaurants:* (same cache-key architecture/defect as attractions)', async () => {
      const restaurantRow = {
        ...destinationRow,
        type: 'restaurant',
        slug: 'plov-center',
      };

      pgMock.query.mockResolvedValueOnce([restaurantRow]);
      await service.cmsCreate('restaurants', { title: 'Plov Center' });
      expect(cacheMock.delByPattern).toHaveBeenCalledWith('cms:*');
      expect(cacheMock.delByPattern).toHaveBeenCalledWith(
        'catalog:restaurants:*',
      );
      expect(cacheMock.delByPattern).not.toHaveBeenCalledWith(
        'catalog:attractions:*',
      );
    });
  });

  it('creates an admin user without a DB NOT NULL violation (regression: H-1)', async () => {
    pgMock.query
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-0000-0000-0000000000aa',
          email: 'new-admin@safaar.uz',
          full_name: 'New Admin',
          role: 'moderator',
          status: 'active',
          created_at: '2026-08-10T00:00:00.000Z',
          updated_at: '2026-08-10T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([]); // audit_logs insert

    const result = await service.adminUserCreate(actor, {
      email: 'new-admin@safaar.uz',
      full_name: 'New Admin',
      role: 'moderator',
    });

    const [sql, params] = pgMock.query.mock.calls[0];
    expect(String(sql)).toContain('gen_random_uuid()');
    expect(String(sql)).toContain('password_hash');
    const [email, passwordHash, fullName, role, updatedAt] = params as string[];
    expect(email).toBe('new-admin@safaar.uz');
    expect(passwordHash).toMatch(/^\$argon2/);
    expect(fullName).toBe('New Admin');
    expect(role).toBe('moderator');
    expect(updatedAt).toEqual(expect.any(String));

    // Vaqtinchalik parol faqat shu javobda bir marta qaytariladi va
    // haqiqatan argon2-hash qilingan qiymatga mos kelishi kerak.
    expect(result.temporary_password).toEqual(expect.any(String));
    expect(result.temporary_password.length).toBeGreaterThan(8);
  });

  it('rejects admin user creation without an email', async () => {
    await expect(
      service.adminUserCreate(actor, { full_name: 'No Email' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(pgMock.query).not.toHaveBeenCalled();
  });

  describe('admin role assignment — privilege-escalation guards (2026-09-14 SAFAAR ADMIN audit)', () => {
    const financeAdmin: RequestActor = {
      id: '00000000-0000-0000-0000-0000000000f1',
      actorType: 'admin',
      role: Role.FINANCE_ADMIN,
      roles: [Role.FINANCE_ADMIN],
    };

    it("noto'g'ri/noma'lum rol qiymati (yaratishda) aniq rad etiladi, DB'ga hech narsa yozilmaydi", async () => {
      await expect(
        service.adminUserCreate(actor, {
          email: 'x@safaar.uz',
          role: 'totally-not-a-role',
        }),
      ).rejects.toMatchObject({ status: 400 });
      expect(pgMock.query).not.toHaveBeenCalled();
    });

    it('SUPER_ADMIN bo‘lmagan actor yangi foydalanuvchiga SUPER_ADMIN bera olmaydi (privilege escalation → 403)', async () => {
      await expect(
        service.adminUserCreate(financeAdmin, {
          email: 'wannabe-super@safaar.uz',
          role: 'super_admin',
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(pgMock.query).not.toHaveBeenCalled();
    });

    it('SUPER_ADMIN yangi foydalanuvchiga SUPER_ADMIN bera oladi (ruxsat etilgan yo‘l)', async () => {
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: '00000000-0000-0000-0000-0000000000bb',
            email: 'new-super@safaar.uz',
            full_name: 'New Super',
            role: 'super_admin',
            status: 'active',
            created_at: '2026-09-14T00:00:00.000Z',
            updated_at: '2026-09-14T00:00:00.000Z',
          },
        ])
        .mockResolvedValueOnce([]); // audit_logs insert

      const result = await service.adminUserCreate(actor, {
        email: 'new-super@safaar.uz',
        role: 'super_admin',
      });
      expect(result).toMatchObject({ role: 'super_admin' });
    });

    it("admin o'zining O'Z rolini o'zgartira olmaydi — self-escalation VA tasodifiy self-demotion ikkalasi ham bloklanadi (403)", async () => {
      pgMock.query.mockResolvedValueOnce([
        {
          id: actor.id,
          email: 'self@safaar.uz',
          full_name: 'Self',
          role: 'super_admin',
          status: 'active',
          created_at: '2026-09-14T00:00:00.000Z',
          updated_at: '2026-09-14T00:00:00.000Z',
        },
      ]); // SELECT existing

      await expect(
        service.adminUserUpdate(actor, actor.id, { role: 'admin' }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('oddiy admin boshqa foydalanuvchini SUPER_ADMIN qilib qo‘ya olmaydi (privilege escalation → 403)', async () => {
      pgMock.query.mockResolvedValueOnce([
        {
          id: '00000000-0000-0000-0000-0000000000f2',
          email: 'target@safaar.uz',
          full_name: 'Target',
          role: 'moderator',
          status: 'active',
          created_at: '2026-09-14T00:00:00.000Z',
          updated_at: '2026-09-14T00:00:00.000Z',
        },
      ]); // SELECT existing

      await expect(
        service.adminUserUpdate(
          financeAdmin,
          '00000000-0000-0000-0000-0000000000f2',
          {
            role: 'super_admin',
          },
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("noto'g'ri rol qiymati (yangilashda) rad etiladi", async () => {
      pgMock.query.mockResolvedValueOnce([
        {
          id: '00000000-0000-0000-0000-0000000000f3',
          email: 'target2@safaar.uz',
          full_name: 'Target2',
          role: 'moderator',
          status: 'active',
          created_at: '2026-09-14T00:00:00.000Z',
          updated_at: '2026-09-14T00:00:00.000Z',
        },
      ]);

      await expect(
        service.adminUserUpdate(actor, '00000000-0000-0000-0000-0000000000f3', {
          role: 'not-a-real-role',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rol muvaffaqiyatli o‘zgartirilganda audit_logs eski VA yangi qiymat bilan yoziladi (old_value/new_value)', async () => {
      const targetId = '00000000-0000-0000-0000-0000000000f4';
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: targetId,
            email: 'target3@safaar.uz',
            full_name: 'Target3',
            role: 'moderator',
            status: 'active',
            created_at: '2026-09-14T00:00:00.000Z',
            updated_at: '2026-09-14T00:00:00.000Z',
          },
        ]) // SELECT existing
        .mockResolvedValueOnce([
          {
            id: targetId,
            email: 'target3@safaar.uz',
            full_name: 'Target3',
            role: 'support_admin',
            status: 'active',
            created_at: '2026-09-14T00:00:00.000Z',
            updated_at: '2026-09-14T00:01:00.000Z',
          },
        ]) // UPDATE
        .mockResolvedValueOnce([]); // audit_logs insert

      await service.adminUserUpdate(actor, targetId, { role: 'support_admin' });

      const auditCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('insert into audit_logs'),
      );
      expect(auditCall).toBeDefined();
      const [, params] = auditCall!;
      const paramsArr = params as unknown[];
      expect(paramsArr[3]).toBe('admin_user.update'); // action
      expect(paramsArr[4]).toBe('admin_user'); // entity_type
      expect(
        (JSON.parse(paramsArr[6] as string) as { role: string }).role,
      ).toBe('moderator'); // old_value
      expect(
        (JSON.parse(paramsArr[7] as string) as { role: string }).role,
      ).toBe('support_admin'); // new_value
    });
  });

  describe('partnerCommission — validation + old/new audit (2026-09-14 SAFAAR ADMIN Part 1)', () => {
    const partnerId = '00000000-0000-0000-0000-0000000000c1';

    it('rate kiritilmasa 400 (COMMISSION_RATE_REQUIRED)', async () => {
      await expect(
        service.partnerCommission(actor, partnerId, {}),
      ).rejects.toMatchObject({ status: 400 });
      expect(pgMock.query).not.toHaveBeenCalled();
    });

    it('manfiy foiz rad etiladi (400 COMMISSION_RATE_NEGATIVE)', async () => {
      await expect(
        service.partnerCommission(actor, partnerId, { rate: -5 }),
      ).rejects.toMatchObject({ status: 400 });
      expect(pgMock.query).not.toHaveBeenCalled();
    });

    it('100% dan katta foiz rad etiladi (400 COMMISSION_RATE_TOO_HIGH)', async () => {
      await expect(
        service.partnerCommission(actor, partnerId, { rate: 150 }),
      ).rejects.toMatchObject({ status: 400 });
      expect(pgMock.query).not.toHaveBeenCalled();
    });

    it('NaN/raqam bo‘lmagan qiymat rad etiladi (400 COMMISSION_RATE_INVALID)', async () => {
      await expect(
        service.partnerCommission(actor, partnerId, { rate: 'abc' }),
      ).rejects.toMatchObject({ status: 400 });
      expect(pgMock.query).not.toHaveBeenCalled();
    });

    it("yaroqli 0-100 oralig'idagi qiymat qabul qilinadi va audit_logs OLD+NEW qiymat bilan yoziladi", async () => {
      pgMock.query
        .mockResolvedValueOnce([{ id: partnerId, default_commission_rate: 12 }]) // SELECT existing
        .mockResolvedValueOnce([
          {
            id: partnerId,
            type: 'hotel',
            legal_name: 'LLC Test',
            brand_name: 'Test Hotel',
            default_commission_rate: 18.5,
            updated_at: '2026-09-14T00:00:00.000Z',
          },
        ]) // UPDATE
        .mockResolvedValueOnce([]); // audit_logs insert

      const result = await service.partnerCommission(actor, partnerId, {
        rate: 18.5,
      });
      expect(result).toMatchObject({ default_commission_rate: 18.5 });

      const auditCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('insert into audit_logs'),
      );
      expect(auditCall).toBeDefined();
      const [, params] = auditCall!;
      const paramsArr = params as unknown[];
      expect(paramsArr[3]).toBe('partner.commission');
      expect(
        (
          JSON.parse(paramsArr[6] as string) as {
            default_commission_rate: number;
          }
        ).default_commission_rate,
      ).toBe(12);
      expect(
        (
          JSON.parse(paramsArr[7] as string) as {
            default_commission_rate: number;
          }
        ).default_commission_rate,
      ).toBe(18.5);
    });

    it('0% (fully-discounted/no-commission partner) yaroqli qiymat sifatida qabul qilinadi', async () => {
      pgMock.query
        .mockResolvedValueOnce([{ id: partnerId, default_commission_rate: 12 }])
        .mockResolvedValueOnce([
          {
            id: partnerId,
            type: 'hotel',
            default_commission_rate: 0,
            updated_at: '2026-09-14T00:00:00.000Z',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.partnerCommission(actor, partnerId, {
        rate: 0,
      });
      expect(result).toMatchObject({ default_commission_rate: 0 });
    });

    it('mavjud bo‘lmagan partner uchun 404', async () => {
      pgMock.query.mockResolvedValueOnce([]); // SELECT existing — bo'sh

      await expect(
        service.partnerCommission(actor, partnerId, { rate: 10 }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('partnerCommissionDetail — Excel vs partner_default manba (2026-09-14 SAFAAR ADMIN Part 1)', () => {
    it("hotel/hostel/guesthouse turidagi mehmonxonalar UCHUN Excel manba ko'rsatiladi, boshqa turlar uchun partner_default", async () => {
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: 'partner-1',
            type: 'hotel',
            default_commission_rate: 20,
          },
        ]) // partner
        .mockResolvedValueOnce([
          {
            id: 'hotel-1',
            name: 'Samarqand Hotel',
            stars: 5,
            city_slug: 'samarqand',
            partner_type: 'hotel',
          },
          {
            id: 'hotel-2',
            name: 'Restoran X',
            stars: null,
            city_slug: 'samarqand',
            partner_type: 'restaurant',
          },
        ]); // hotels

      const result = await service.partnerCommissionDetail('partner-1');
      expect(result.hotels).toEqual([
        expect.objectContaining({
          hotel_id: 'hotel-1',
          effective_rate_percent: 12, // Samarqand 4-5 yulduz Excel
          source: 'excel',
        }),
        expect.objectContaining({
          hotel_id: 'hotel-2',
          effective_rate_percent: 20, // restaurant — Excel qamrab olmaydi, partner default
          source: 'partner_default',
        }),
      ]);
    });
  });

  describe('roomAvailabilityBlock / Unblock / Calendar (2026-09-14 SAFAAR ADMIN Part 2)', () => {
    const roomId = '00000000-0000-0000-0000-0000000000d1';

    it("start_date >= end_date bo'lsa rad etiladi", async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: roomId, hotel_id: 'hotel-1', total_inventory: 5 },
      ]); // assertRoomExists

      await expect(
        service.roomAvailabilityBlock(actor, roomId, {
          start_date: '2026-12-05',
          end_date: '2026-12-01',
          reason: 'Overbooking tuzatish',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('sabab (reason) kiritilmasa rad etiladi', async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: roomId, hotel_id: 'hotel-1', total_inventory: 5 },
      ]);

      await expect(
        service.roomAvailabilityBlock(actor, roomId, {
          start_date: '2026-12-01',
          end_date: '2026-12-05',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("o'tgan sanani bloklab bo'lmaydi", async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: roomId, hotel_id: 'hotel-1', total_inventory: 5 },
      ]);

      await expect(
        service.roomAvailabilityBlock(actor, roomId, {
          start_date: '2020-01-01',
          end_date: '2020-01-05',
          reason: 'test',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("mavjud bo'lmagan xona uchun 404", async () => {
      pgMock.query.mockResolvedValueOnce([]); // assertRoomExists — topilmadi

      await expect(
        service.roomAvailabilityBlock(actor, roomId, {
          start_date: '2026-12-01',
          end_date: '2026-12-03',
          reason: 'test',
        }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("yaroqli so'rov room_inventory'ga closed=true yozadi va audit_logs'da reason saqlanadi (unauthorized emas — asosiy muvaffaqiyatli yo'l)", async () => {
      pgMock.query
        .mockResolvedValueOnce([
          { id: roomId, hotel_id: 'hotel-1', total_inventory: 5 },
        ]) // assertRoomExists
        .mockResolvedValueOnce([{ date: '2026-12-01' }, { date: '2026-12-02' }]) // INSERT ... ON CONFLICT ... RETURNING
        .mockResolvedValueOnce([]); // audit_logs insert

      const result = await service.roomAvailabilityBlock(actor, roomId, {
        start_date: '2026-12-01',
        end_date: '2026-12-03',
        reason: 'Overbooking tuzatish',
      });

      expect(result.dates_blocked).toEqual(['2026-12-01', '2026-12-02']);

      const auditCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('insert into audit_logs'),
      );
      expect(auditCall).toBeDefined();
      const [, params] = auditCall!;
      const paramsArr = params as unknown[];
      expect(paramsArr[3]).toBe('availability.block');
      expect(paramsArr[4]).toBe('room_inventory');
      expect(
        (JSON.parse(paramsArr[8] as string) as { reason: string }).reason,
      ).toBe('Overbooking tuzatish');
    });

    it('unblock — allaqachon ochiq sanalarga tegmaydi, faqat closed=true bo‘lganlarni ochadi (idempotent, xato bermaydi)', async () => {
      pgMock.query
        .mockResolvedValueOnce([
          { id: roomId, hotel_id: 'hotel-1', total_inventory: 5 },
        ]) // assertRoomExists
        .mockResolvedValueOnce([]) // UPDATE ... RETURNING — hech narsa yopiq emas edi
        .mockResolvedValueOnce([]); // audit_logs insert

      const result = await service.roomAvailabilityUnblock(actor, roomId, {
        start_date: '2026-12-01',
        end_date: '2026-12-03',
      });
      expect(result.dates_unblocked).toEqual([]);
    });

    it("calendar — bloklangan kun 'blocked' holatida va sellable_count=0 qaytaradi", async () => {
      pgMock.query
        .mockResolvedValueOnce([
          { id: roomId, hotel_id: 'hotel-1', total_inventory: 5 },
        ]) // assertRoomExists
        .mockResolvedValueOnce([
          {
            date: '2026-12-01',
            total_count: 5,
            blocked: true,
            booked_count: 0,
          },
          {
            date: '2026-12-02',
            total_count: 5,
            blocked: false,
            booked_count: 2,
          },
        ]);

      const result = await service.roomAvailabilityCalendar(roomId, {
        from: '2026-12-01',
        to: '2026-12-03',
      });

      expect(result.days).toEqual([
        expect.objectContaining({
          date: '2026-12-01',
          blocked: true,
          status: 'blocked',
          sellable_count: 0,
        }),
        expect.objectContaining({
          date: '2026-12-02',
          blocked: false,
          status: 'partially_occupied',
          sellable_count: 3,
        }),
      ]);
    });
  });

  describe('reviewsList / reviewModerate (2026-09-14 SAFAAR ADMIN Part 6 — admin review moderation)', () => {
    const reviewId = '00000000-0000-0000-0000-0000000000e1';

    it('reviewsList applies status/target_type/min_rating filters to the SQL', async () => {
      pgMock.query.mockResolvedValueOnce([]);
      await service.reviewsList({
        status: 'pending_review',
        target_type: 'hotel',
        min_rating: '4',
      });
      const [sql, params] = pgMock.query.mock.calls[0];
      expect(String(sql)).toContain('r.status::text = $1');
      expect(String(sql)).toContain('r.target_type = $2');
      expect(String(sql)).toContain('r.rating >= $3');
      expect(params).toEqual(['pending_review', 'hotel', 4]);
    });

    it('reviewsList with no filters queries all reviews (no WHERE clause)', async () => {
      pgMock.query.mockResolvedValueOnce([]);
      await service.reviewsList({});
      const [sql, params] = pgMock.query.mock.calls[0];
      expect(String(sql)).not.toContain('where');
      expect(params).toEqual([]);
    });

    // Talab #20 (reviews E2E QA topshirig'i) — yuqoridagi ikkita test
    // faqat status/target_type/min_rating filtrlarini tekshiradi, LIMIT/
    // OFFSET emissiyasi ilgari tasdiqlanmagan edi. Bu yerga QO'SHILDI
    // (mavjud filtr testlari TAKRORLANMAYDI).
    it('reviewsList sukut bo`yicha LIMIT/OFFSET qo`shadi (admin pagination, defaultLimit=50)', async () => {
      pgMock.query.mockResolvedValueOnce([]);
      await service.reviewsList({});
      const [sql] = pgMock.query.mock.calls[0];
      expect(String(sql)).toContain('limit 50 offset 0');
    });

    it('reviewsList so`ralgan page/limit qiymatlariga mos LIMIT/OFFSET chiqaradi', async () => {
      pgMock.query.mockResolvedValueOnce([]);
      await service.reviewsList({ page: '2', limit: '10' });
      const [sql] = pgMock.query.mock.calls[0];
      expect(String(sql)).toContain('limit 10 offset 10');
    });

    it("reviewModerate('publish') sets status=published and writes old/new audit", async () => {
      pgMock.query
        .mockResolvedValueOnce([{ id: reviewId, status: 'pending_review' }]) // SELECT existing
        .mockResolvedValueOnce([
          {
            id: reviewId,
            status: 'published',
            updated_at: '2026-09-14T00:00:00.000Z',
          },
        ]) // UPDATE
        .mockResolvedValueOnce([]); // audit_logs insert

      const result = await service.reviewModerate(actor, reviewId, 'publish');
      expect(result).toMatchObject({ status: 'published' });

      const auditCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('insert into audit_logs'),
      );
      const [, params] = auditCall!;
      const paramsArr = params as unknown[];
      expect(paramsArr[3]).toBe('review.publish');
      expect(paramsArr[4]).toBe('review');
      expect(
        (JSON.parse(paramsArr[6] as string) as { status: string }).status,
      ).toBe('pending_review');
      expect(
        (JSON.parse(paramsArr[7] as string) as { status: string }).status,
      ).toBe('published');
    });

    it("reviewModerate('hide') sets status=hidden", async () => {
      pgMock.query
        .mockResolvedValueOnce([{ id: reviewId, status: 'published' }])
        .mockResolvedValueOnce([
          {
            id: reviewId,
            status: 'hidden',
            updated_at: '2026-09-14T00:00:00.000Z',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.reviewModerate(actor, reviewId, 'hide');
      expect(result).toMatchObject({ status: 'hidden' });
    });

    it('reviewModerate on a non-existent review throws 404', async () => {
      pgMock.query.mockResolvedValueOnce([]); // SELECT existing — bo'sh

      await expect(
        service.reviewModerate(actor, reviewId, 'publish'),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  it('creates an admin export job without a DB NOT NULL violation (regression: H-1)', async () => {
    pgMock.query.mockResolvedValueOnce([
      {
        id: 'export-1',
        owner_type: 'admin',
        owner_id: actor.id,
        type: 'admin-users',
        format: 'xlsx',
        status: 'queued',
        created_at: '2026-08-10T00:00:00.000Z',
        updated_at: '2026-08-10T00:00:00.000Z',
      },
    ]);

    const job = await service.exportJob(actor, 'admin-users', 'xlsx');

    const [sql, params] = pgMock.query.mock.calls[0];
    expect(String(sql)).toContain('gen_random_uuid()');
    expect(String(sql)).toContain('created_at');
    expect(params).toEqual([
      actor.id,
      'admin-users',
      'xlsx',
      expect.any(String),
    ]);
    expect(job.id).toBe('export-1');
  });

  it('adminUserReset2fa actually clears totp_secret and recovery codes (regression: M-1 fake stub)', async () => {
    const revokeSpy = jest
      .spyOn(authSessionStore, 'revokeActor')
      .mockResolvedValue(1);
    pgMock.query
      .mockResolvedValueOnce([{ id: 'target-admin-1' }]) // UPDATE ... RETURNING id
      .mockResolvedValueOnce([]); // DELETE FROM admin_recovery_codes

    const result = await service.adminUserReset2fa('target-admin-1');

    expect(result).toEqual({
      id: 'target-admin-1',
      two_factor_reset: true,
      sessions_revoked: true,
    });
    const [updateSql] = pgMock.query.mock.calls[0];
    expect(String(updateSql)).toContain('totp_secret = null');
    const [deleteSql] = pgMock.query.mock.calls[1];
    expect(String(deleteSql)).toContain('delete from admin_recovery_codes');
    expect(revokeSpy).toHaveBeenCalledWith('target-admin-1');

    revokeSpy.mockRestore();
  });

  it('adminUserReset2fa 404s for a nonexistent admin instead of reporting fake success', async () => {
    pgMock.query.mockResolvedValueOnce([]); // no row matched

    await expect(
      service.adminUserReset2fa('does-not-exist'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('bookings() returns the standard paginated envelope, not a bare array (regression: M-4)', async () => {
    pgMock.query.mockResolvedValueOnce([
      { id: 'booking-1', status: 'confirmed', total_count: 3 },
      { id: 'booking-2', status: 'pending', total_count: 3 },
    ]);

    const result = await service.bookings({ limit: '2', page: '1' });

    expect(result).toMatchObject({
      total: 3,
      page: 1,
      limit: 2,
      total_pages: 2,
    });
    expect(result.items).toHaveLength(2);
    // total_count — ichki paginatsiya ustuni — javobga chiqib ketmasligi kerak.
    expect(result.items[0]).not.toHaveProperty('total_count');
    expect(result.items[0]).toMatchObject({ id: 'booking-1' });
  });

  it('bookings() returns an empty envelope (not an error) when there are no rows', async () => {
    pgMock.query.mockResolvedValueOnce([]);

    const result = await service.bookings({});

    expect(result).toMatchObject({ items: [], total: 0, total_pages: 1 });
  });

  describe('refundApprove (regression: refund approval used to be cosmetic — status flip only)', () => {
    const refundId = '00000000-0000-0000-0000-000000000010';
    const bookingId = '00000000-0000-0000-0000-000000000011';
    const partnerId = '00000000-0000-0000-0000-000000000012';

    it('marks the payment refunded, cancels the booking and reverses the partner ledger', async () => {
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: refundId,
            booking_id: bookingId,
            status: 'requested',
            requested_amount: '80000',
            currency: 'UZS',
          },
        ]) // SELECT refund FOR UPDATE
        .mockResolvedValueOnce([
          { id: refundId, status: 'approved', approved_amount: 80000 },
        ]) // UPDATE refunds
        .mockResolvedValueOnce([
          {
            id: bookingId,
            status: 'confirmed',
            partner_organization_id: partnerId,
            partner_payable: 70400,
            currency: 'UZS',
          },
        ]) // SELECT booking FOR UPDATE
        .mockResolvedValueOnce([
          { id: 'payment-1', provider: 'click', provider_reference: null },
        ]) // SELECT payment FOR UPDATE (click — real provider refund YO'Q)
        .mockResolvedValueOnce([{ id: 'payment-1' }]) // UPDATE payments -> refunded (RETURNING id, 1 qator)
        .mockResolvedValueOnce([]) // UPDATE bookings -> cancelled
        .mockResolvedValueOnce([]); // INSERT partner_ledger_entries (negative)

      const result = await service.refundApprove(actor, refundId, {});

      expect(result).toMatchObject({ status: 'approved' });

      const paymentUpdate = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes("UPDATE payments SET status = 'refunded'"),
      );
      expect(paymentUpdate).toBeDefined();

      const bookingUpdate = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes("UPDATE bookings SET status = 'cancelled'"),
      );
      expect(bookingUpdate).toBeDefined();

      const ledgerInsert = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('INSERT INTO partner_ledger_entries'),
      );
      expect(ledgerInsert).toBeDefined();
      expect(ledgerInsert?.[1]).toEqual([
        expect.any(String),
        partnerId,
        bookingId,
        -70400,
        'UZS',
        expect.any(String),
      ]);
    });

    it('rejects approving a refund that is already approved/rejected/paid (state-machine guard)', async () => {
      pgMock.query.mockResolvedValueOnce([
        {
          id: refundId,
          booking_id: bookingId,
          status: 'approved',
          requested_amount: '80000',
          currency: 'UZS',
        },
      ]);

      await expect(
        service.refundApprove(actor, refundId, {}),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('does not touch a booking that is already completed (service was delivered, not cancellable)', async () => {
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: refundId,
            booking_id: bookingId,
            status: 'requested',
            requested_amount: '80000',
            currency: 'UZS',
          },
        ])
        .mockResolvedValueOnce([
          { id: refundId, status: 'approved', approved_amount: 80000 },
        ])
        .mockResolvedValueOnce([
          {
            id: bookingId,
            status: 'completed',
            partner_organization_id: partnerId,
            partner_payable: 70400,
            currency: 'UZS',
          },
        ])
        .mockResolvedValueOnce([
          { id: 'payment-1', provider: 'click', provider_reference: null },
        ]) // SELECT payment FOR UPDATE
        .mockResolvedValueOnce([{ id: 'payment-1' }]) // UPDATE payments -> refunded (RETURNING id, 1 qator)
        .mockResolvedValueOnce([]); // INSERT partner_ledger_entries (still reversed)

      await service.refundApprove(actor, refundId, {});

      const bookingUpdate = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('UPDATE bookings SET status'),
      );
      expect(bookingUpdate).toBeUndefined();
    });

    it("IKKINCHI (mustaqil) refund qatori — to'lov ALLAQACHON boshqa qator orqali 'refunded' bo'lgan (payment.status endi 'paid' emas) — refund 'approved' deb belgilanadi, LEKIN booking bekor qilinmaydi va ledgerga IKKINCHI marta yozilmaydi (double-debit regression)", async () => {
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: refundId,
            booking_id: bookingId,
            status: 'requested',
            requested_amount: '80000',
            currency: 'UZS',
          },
        ]) // SELECT refund FOR UPDATE
        .mockResolvedValueOnce([
          { id: refundId, status: 'approved', approved_amount: 80000 },
        ]) // UPDATE refunds
        .mockResolvedValueOnce([
          {
            id: bookingId,
            status: 'cancelled', // boshqa refund qatori orqali ALLAQACHON bekor qilingan
            partner_organization_id: partnerId,
            partner_payable: 70400,
            currency: 'UZS',
          },
        ]) // SELECT booking FOR UPDATE
        // SELECT payment FOR UPDATE — 0 qator (allaqachon 'paid' emas, boshqa
        // qator orqali refund qilingan) => provider-refund chaqirilmaydi.
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // UPDATE payments -> refunded: 0 QATOR (allaqachon 'paid' emas)

      const result = await service.refundApprove(actor, refundId, {});

      expect(result).toMatchObject({ status: 'approved' });

      const bookingUpdate = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('UPDATE bookings SET status'),
      );
      expect(bookingUpdate).toBeUndefined();

      const ledgerInsert = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('INSERT INTO partner_ledger_entries'),
      );
      expect(ledgerInsert).toBeUndefined();
    });
  });

  describe('refundApprove — qisman refund proporsional ledger reversi (SAFAAR komissiya + Uzum fee auditi, item 8)', () => {
    const refundId = '00000000-0000-0000-0000-000000000020';
    const bookingId = '00000000-0000-0000-0000-000000000021';
    const partnerId = '00000000-0000-0000-0000-000000000022';

    it("QISMAN refund (approved_amount < total_amount) — partner ledger FAQAT proporsional ulush bo'yicha revers qilinadi, butun partner_payable emas", async () => {
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: refundId,
            booking_id: bookingId,
            status: 'requested',
            requested_amount: '50000',
            currency: 'UZS',
          },
        ]) // SELECT refund FOR UPDATE
        .mockResolvedValueOnce([
          { id: refundId, status: 'approved', approved_amount: 50000 },
        ]) // UPDATE refunds
        .mockResolvedValueOnce([
          {
            id: bookingId,
            status: 'confirmed',
            partner_organization_id: partnerId,
            partner_payable: 88000, // 100000 - 12% komissiya
            total_amount: 100000,
            currency: 'UZS',
          },
        ]) // SELECT booking FOR UPDATE
        .mockResolvedValueOnce([
          { id: 'payment-1', provider: 'click', provider_reference: null },
        ]) // SELECT payment FOR UPDATE
        .mockResolvedValueOnce([{ id: 'payment-1' }]) // UPDATE payments -> refunded
        .mockResolvedValueOnce([]) // UPDATE bookings -> cancelled
        .mockResolvedValueOnce([]); // INSERT partner_ledger_entries (proportional)

      const result = await service.refundApprove(actor, refundId, {
        approved_amount: 50000,
      });

      expect(result).toMatchObject({ status: 'approved' });

      const ledgerInsert = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('INSERT INTO partner_ledger_entries'),
      );
      expect(ledgerInsert).toBeDefined();
      // 50000/100000 = 0.5 ulush => 88000 * 0.5 = 44000 (butun 88000 EMAS)
      expect(ledgerInsert?.[1]).toEqual([
        expect.any(String),
        partnerId,
        bookingId,
        -44000,
        'UZS',
        expect.any(String),
      ]);
    });

    it("TO'LIQ refund (approved_amount === total_amount) — butun partner_payable revers qilinadi (regression saqlanadi)", async () => {
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: refundId,
            booking_id: bookingId,
            status: 'requested',
            requested_amount: '100000',
            currency: 'UZS',
          },
        ])
        .mockResolvedValueOnce([
          { id: refundId, status: 'approved', approved_amount: 100000 },
        ])
        .mockResolvedValueOnce([
          {
            id: bookingId,
            status: 'confirmed',
            partner_organization_id: partnerId,
            partner_payable: 88000,
            total_amount: 100000,
            currency: 'UZS',
          },
        ])
        .mockResolvedValueOnce([
          { id: 'payment-1', provider: 'click', provider_reference: null },
        ]) // SELECT payment FOR UPDATE
        .mockResolvedValueOnce([{ id: 'payment-1' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.refundApprove(actor, refundId, {});

      const ledgerInsert = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('INSERT INTO partner_ledger_entries'),
      );
      expect(ledgerInsert?.[1]).toEqual([
        expect.any(String),
        partnerId,
        bookingId,
        -88000,
        'UZS',
        expect.any(String),
      ]);
    });

    it("approved_amount booking.total_amount'dan OSHSA rad etiladi (pul xavfsizligi — ilgari yuqori chegara tekshiruvi yo'q edi)", async () => {
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: refundId,
            booking_id: bookingId,
            status: 'requested',
            requested_amount: '50000',
            currency: 'UZS',
          },
        ]) // SELECT refund FOR UPDATE
        .mockResolvedValueOnce([
          { id: refundId, status: 'approved', approved_amount: 999999 },
        ]) // UPDATE refunds
        .mockResolvedValueOnce([
          {
            id: bookingId,
            status: 'confirmed',
            partner_organization_id: partnerId,
            partner_payable: 88000,
            total_amount: 100000,
            currency: 'UZS',
          },
        ]); // SELECT booking FOR UPDATE

      await expect(
        service.refundApprove(actor, refundId, { approved_amount: 999999 }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('refundApprove — Uzum Checkout haqiqiy provider refund integratsiyasi (item 7)', () => {
    const refundId = '00000000-0000-0000-0000-000000000030';
    const bookingId = '00000000-0000-0000-0000-000000000031';
    const partnerId = '00000000-0000-0000-0000-000000000032';
    let checkoutMock: { refund: jest.Mock };

    beforeEach(() => {
      checkoutMock = (service as unknown as { checkout: { refund: jest.Mock } })
        .checkout;
    });

    it("provider='uzum_checkout' VA provider_reference mavjud bo'lsa — HAQIQIY /acquiring/refund so'rovi yuboriladi, natija refunds.provider_refund_reference'ga yoziladi", async () => {
      checkoutMock.refund.mockResolvedValue({
        orderId: 'uzc-order-1',
        refundId: 'uzum-operation-1',
        rawStatus: 'REQUESTED',
        raw: {},
      });
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: refundId,
            booking_id: bookingId,
            status: 'requested',
            requested_amount: '100000',
            currency: 'UZS',
            reason: 'Mijoz iltimosi',
          },
        ]) // SELECT refund FOR UPDATE
        .mockResolvedValueOnce([
          { id: refundId, status: 'approved', approved_amount: 100000 },
        ]) // UPDATE refunds
        .mockResolvedValueOnce([
          {
            id: bookingId,
            status: 'confirmed',
            partner_organization_id: partnerId,
            partner_payable: 88000,
            total_amount: 100000,
            currency: 'UZS',
          },
        ]) // SELECT booking FOR UPDATE
        .mockResolvedValueOnce([
          {
            id: 'payment-uzc-1',
            provider: 'uzum_checkout',
            provider_reference: 'uzc-order-1',
          },
        ]) // SELECT payment FOR UPDATE
        .mockResolvedValueOnce([{ id: 'payment-uzc-1' }]) // UPDATE payments -> refunded
        .mockResolvedValueOnce([]) // UPDATE refunds SET provider_refund_reference
        .mockResolvedValueOnce([]) // UPDATE bookings -> cancelled
        .mockResolvedValueOnce([]); // INSERT partner_ledger_entries

      const result = await service.refundApprove(actor, refundId, {});

      expect(result).toMatchObject({ status: 'approved' });
      expect(checkoutMock.refund).toHaveBeenCalledWith({
        orderId: 'uzc-order-1',
        amountSom: 100000,
        reason: 'Mijoz iltimosi',
        operationId: refundId,
      });
      const providerRefCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('provider_refund_reference'),
      );
      expect(providerRefCall).toBeDefined();
      expect(providerRefCall?.[1]).toEqual([refundId, 'uzum-operation-1']);
    });

    it("provider so'rovi MUVAFFAQIYATSIZ bo'lsa (Uzum xato/tarmoq) — HECH QANDAY ichki holat o'zgarmaydi (refund/payments/booking/ledger), aniq 503 xato qaytadi", async () => {
      checkoutMock.refund.mockRejectedValue(new Error('ECONNRESET'));
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: refundId,
            booking_id: bookingId,
            status: 'requested',
            requested_amount: '100000',
            currency: 'UZS',
            reason: null,
          },
        ])
        .mockResolvedValueOnce([
          { id: refundId, status: 'approved', approved_amount: 100000 },
        ])
        .mockResolvedValueOnce([
          {
            id: bookingId,
            status: 'confirmed',
            partner_organization_id: partnerId,
            partner_payable: 88000,
            total_amount: 100000,
            currency: 'UZS',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'payment-uzc-1',
            provider: 'uzum_checkout',
            provider_reference: 'uzc-order-1',
          },
        ]); // SELECT payment FOR UPDATE

      await expect(
        service.refundApprove(actor, refundId, {}),
      ).rejects.toMatchObject({
        status: 503,
        response: { code: 'REFUND_PROVIDER_ERROR' },
      });

      // Provider chaqiruvidan KEYIN hech qanday yozuv (UPDATE/INSERT)
      // bo'lmasligi kerak — tranzaksiya throw bilan ROLLBACK bo'ladi.
      const paymentUpdate = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes("UPDATE payments SET status = 'refunded'"),
      );
      expect(paymentUpdate).toBeUndefined();
    });

    it("provider='click' (real refund API yo'q) bo'lsa — checkout.refund() UMUMAN chaqirilmaydi, avvalgi (faqat ICHKI holat) xatti-harakat saqlanadi", async () => {
      pgMock.query
        .mockResolvedValueOnce([
          {
            id: refundId,
            booking_id: bookingId,
            status: 'requested',
            requested_amount: '100000',
            currency: 'UZS',
            reason: null,
          },
        ])
        .mockResolvedValueOnce([
          { id: refundId, status: 'approved', approved_amount: 100000 },
        ])
        .mockResolvedValueOnce([
          {
            id: bookingId,
            status: 'confirmed',
            partner_organization_id: partnerId,
            partner_payable: 88000,
            total_amount: 100000,
            currency: 'UZS',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'payment-click-1',
            provider: 'click',
            provider_reference: null,
          },
        ])
        .mockResolvedValueOnce([{ id: 'payment-click-1' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.refundApprove(actor, refundId, {});

      expect(result).toMatchObject({ status: 'approved' });
      expect(checkoutMock.refund).not.toHaveBeenCalled();
    });
  });

  describe('refundReject / refundRetry (regression: retry wrote a non-existent enum value and crashed every time)', () => {
    const refundId = '00000000-0000-0000-0000-000000000013';

    it('rejects a requested refund', async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: refundId, status: 'rejected' },
      ]);

      const result = await service.refundReject(actor, refundId);
      expect(result).toMatchObject({ status: 'rejected' });
    });

    it('retry moves a rejected refund back to requested (regression: used to write invalid enum "retrying")', async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: refundId, status: 'requested' },
      ]);

      const result = await service.refundRetry(actor, refundId);

      expect(result).toMatchObject({ status: 'requested' });
      const [sql] = pgMock.query.mock.calls[0];
      expect(String(sql)).not.toContain('retrying');
    });

    it('retry fails with a clear error on a refund that was never rejected', async () => {
      pgMock.query
        .mockResolvedValueOnce([]) // UPDATE ... WHERE status = 'rejected' -> no match
        .mockResolvedValueOnce([{ status: 'approved' }]); // existing-status lookup

      await expect(service.refundRetry(actor, refundId)).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe('withdrawalStatus state machine (regression: a paid withdrawal could be flipped to rejected, enabling double payout)', () => {
    const withdrawalId = '00000000-0000-0000-0000-000000000014';

    it('allows requested -> approved', async () => {
      pgMock.query.mockResolvedValueOnce([{ status: 'approved' }]);
      const result = await service.withdrawalStatus(withdrawalId, 'approved');
      expect(result).toMatchObject({ status: 'approved' });

      const [, params] = pgMock.query.mock.calls[0];
      expect(params).toEqual([withdrawalId, 'approved', ['requested']]);
    });

    it('allows approved -> paid', async () => {
      pgMock.query.mockResolvedValueOnce([{ status: 'paid' }]);
      const result = await service.withdrawalStatus(withdrawalId, 'paid');
      expect(result).toMatchObject({ status: 'paid' });

      const [, params] = pgMock.query.mock.calls[0];
      expect(params).toEqual([withdrawalId, 'paid', ['approved']]);
    });

    it('rejects paid -> rejected (the double-payout exploit) with a clear conflict error', async () => {
      pgMock.query
        .mockResolvedValueOnce([]) // UPDATE ... WHERE status = ANY(['requested','approved']) -> no match, already paid
        .mockResolvedValueOnce([{ status: 'paid' }]); // existing-status lookup

      await expect(
        service.withdrawalStatus(withdrawalId, 'rejected'),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('rejects requested -> paid (cannot skip the approval step)', async () => {
      pgMock.query
        .mockResolvedValueOnce([]) // UPDATE ... WHERE status = ANY(['approved']) -> no match
        .mockResolvedValueOnce([{ status: 'requested' }]);

      await expect(
        service.withdrawalStatus(withdrawalId, 'paid'),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('reports a clear 404 for a withdrawal id that does not exist at all', async () => {
      pgMock.query
        .mockResolvedValueOnce([]) // UPDATE -> no match
        .mockResolvedValueOnce([]); // existing-status lookup -> not found either

      await expect(
        service.withdrawalStatus(withdrawalId, 'approved'),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("notificationBroadcastAction (regression: 'send'/'cancel' wrote the literal string 'send' as status, matching neither the UI's nor the CMS's status vocabulary)", () => {
    it("maps action='send' to status='sending' (matches broadcasts/page.tsx STATUS_LABELS)", async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: 'b-1', status: 'sending', updated_at: '2026-09-18T00:00:00Z' },
      ]);

      const result = await service.notificationBroadcastAction('b-1', 'send');

      expect(pgMock.query.mock.calls[0]?.[1]).toEqual(['b-1', 'sending']);
      expect(result.status).toBe('sending');
    });

    it("maps action='cancel' back to status='draft'", async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: 'b-1', status: 'draft', updated_at: '2026-09-18T00:00:00Z' },
      ]);

      const result = await service.notificationBroadcastAction('b-1', 'cancel');

      expect(pgMock.query.mock.calls[0]?.[1]).toEqual(['b-1', 'draft']);
      expect(result.status).toBe('draft');
    });

    it('still maps the generic CMS actions (publish/unpublish/archive) unchanged', async () => {
      pgMock.query.mockResolvedValueOnce([
        { id: 'b-1', status: 'published', updated_at: '2026-09-18T00:00:00Z' },
      ]);

      await service.notificationBroadcastAction('b-1', 'publish');

      expect(pgMock.query.mock.calls[0]?.[1]).toEqual(['b-1', 'published']);
    });
  });

  describe('listPromotions / approvePromotion / rejectPromotion (regression: "SAFAAR — IMPLEMENT THE TWO CONFIRMED BACKEND GAPS" — web-admin/admin-api.ts previously returned 2 hardcoded fake promotion records, unconnected to anything a partner actually submitted)', () => {
    const promotionId = '00000000-0000-0000-0000-0000000000f1';
    const persistedRow = {
      id: promotionId,
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
    };

    it('listPromotions returns real persisted records, joined with partnerId/partnerName, matching the existing PartnerPromotion[] contract', async () => {
      pgMock.query.mockResolvedValueOnce([
        {
          ...persistedRow,
          partner_id: 'org-1',
          partner_name: 'Hilton Tashkent',
        },
      ]);

      const result = await service.listPromotions();

      expect(result).toEqual([
        {
          id: promotionId,
          partnerId: 'org-1',
          partnerName: 'Hilton Tashkent',
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
        },
      ]);
    });

    it('approvePromotion transitions pending_review -> published, records the reviewing admin, and audit-logs the decision', async () => {
      pgMock.query
        .mockResolvedValueOnce([{ ...persistedRow, status: 'published' }]) // UPDATE ... RETURNING
        .mockResolvedValueOnce([]); // audit_logs insert

      const result = await service.approvePromotion(actor, promotionId);

      expect(result.status).toBe('published');
      const updateCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('UPDATE promotions'),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![1]).toEqual([
        promotionId,
        'published',
        expect.any(String),
        actor.id,
      ]);

      const auditCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('insert into audit_logs'),
      );
      expect(auditCall).toBeDefined();
      expect(auditCall![1]?.[3]).toBe('promotion.approve');
    });

    it('rejectPromotion transitions pending_review -> rejected', async () => {
      pgMock.query
        .mockResolvedValueOnce([{ ...persistedRow, status: 'rejected' }])
        .mockResolvedValueOnce([]);

      const result = await service.rejectPromotion(actor, promotionId);

      expect(result.status).toBe('rejected');
      const updateCall = pgMock.query.mock.calls.find(([sql]) =>
        String(sql).includes('UPDATE promotions'),
      );
      expect(updateCall![1]).toEqual([
        promotionId,
        'rejected',
        expect.any(String),
        actor.id,
      ]);
    });

    it('approving an already-decided promotion is rejected, not silently re-applied (repeated-call safety)', async () => {
      pgMock.query
        .mockResolvedValueOnce([]) // UPDATE ... WHERE status = 'pending_review' -> 0 rows
        .mockResolvedValueOnce([{ status: 'published' }]); // fallback lookup

      await expect(
        service.approvePromotion(actor, promotionId),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('rejecting an already-rejected promotion is rejected the same way (idempotent-safe)', async () => {
      pgMock.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ status: 'rejected' }]);

      await expect(
        service.rejectPromotion(actor, promotionId),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('approving a non-existent promotion returns 404, not 409', async () => {
      pgMock.query
        .mockResolvedValueOnce([]) // UPDATE -> 0 rows
        .mockResolvedValueOnce([]); // fallback lookup -> not found

      await expect(
        service.approvePromotion(actor, promotionId),
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
