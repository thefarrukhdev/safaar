import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import { CURRENT_TERMS_VERSION } from '../common/legal';
import type { AppCacheService } from '../infrastructure/cache.service';
import { EmailService } from '../infrastructure/email.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { PromosService } from '../promos/promos.service';
import { EventsService } from '../realtime/events.service';
import type { PaymentsService } from '../payments/payments.service';
import { BookingsService } from './bookings.service';

function noopPromosService(): jest.Mocked<
  Pick<PromosService, 'validate' | 'redeem'>
> {
  return {
    validate: jest.fn().mockResolvedValue({
      code: '',
      valid: false,
      discount_type: null,
      discount_value: 0,
    }),
    redeem: jest.fn().mockResolvedValue(true),
  };
}

// PHASE 14G: `Idempotency-Key` fixi `AppCacheService`ni talab qiladi.
// Mavjud testlarning hech biri bu header'ni yubormaydi (eski xatti-harakat
// — `withIdempotency()` shunday holatda `cache`ga umuman tegmasdan
// to'g'ridan-to'g'ri asl yaratish funksiyasini chaqiradi), shuning uchun
// bu yerda faqat konstruktor signaturasini qondirish uchun minimal stub
// yetarli — metodlarning hech biri haqiqatan chaqirilmaydi.
function noopCacheService(): Record<string, jest.Mock> {
  return {
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    getOrSet: jest.fn((_key: string, _ttl: number, producer: () => unknown) =>
      Promise.resolve(producer()),
    ),
  };
}

describe('BookingsService.createHotel guest checkout', () => {
  let service: BookingsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>> & {
    transaction: jest.Mock;
  };
  let events: {
    bookingStatusChanged: jest.Mock;
    partnerDashboardUpdated: jest.Mock;
    adminDashboardUpdated: jest.Mock;
  };
  let email: { send: jest.Mock };
  let promos: jest.Mocked<Pick<PromosService, 'validate' | 'redeem'>>;

  const hotelRow = {
    id: 'hotel-1',
    partner_organization_id: 'partner-1',
    partner_type: 'hotel',
    commission_rate: 12,
    check_in_time: null,
    check_out_time: null,
  };

  beforeEach(() => {
    pg = {
      query: jest.fn(),
      transaction: jest.fn((operation: (tx: unknown) => unknown) =>
        Promise.resolve(operation({ query: pg.query })),
      ),
    };
    events = {
      bookingStatusChanged: jest.fn(),
      partnerDashboardUpdated: jest.fn(),
      adminDashboardUpdated: jest.fn(),
    };
    email = {
      send: jest
        .fn()
        .mockResolvedValue({ providerMessageId: '', accepted: true }),
    };
    promos = noopPromosService();
    service = new BookingsService(
      pg as unknown as PostgresService,
      events as unknown as EventsService,
      email as unknown as EmailService,
      promos as unknown as PromosService,
      {
        buildCheckoutUrl: jest.fn().mockReturnValue(null),
      } as unknown as PaymentsService,
      noopCacheService() as unknown as AppCacheService,
    );
  });

  it('stores guest contact fields for unauthenticated hotel bookings', async () => {
    pg.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 1,
        },
      ])
      // sana-ziddiyat tekshiruvi (bo'sh = ziddiyat yo'q)
      .mockResolvedValueOnce([{ booked_count: 0 }])
      .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
      .mockResolvedValueOnce([]) // INSERT bookings
      .mockResolvedValueOnce([]) // INSERT booking_status_history
      .mockResolvedValueOnce([]) // SELECT existing pending payment (none)
      .mockResolvedValueOnce([]); // INSERT payments

    const result = await service.createHotel(undefined, {
      hotel_id: 'hotel-1',
      agree_terms: true,
      room_id: 'room-1',
      check_in: '2026-08-10',
      check_out: '2026-08-12',
      rooms: 1,
      guests: 2,
      firstName: ' Laziz ',
      lastName: ' Shakarov ',
      email: 'LAZIZ@EXAMPLE.COM ',
      phone: ' +998901234567 ',
    });

    expect(result.booking.user_id).toBeNull();
    expect(result.booking.guest_name).toBe('Laziz Shakarov');
    expect(result.booking.guest_email).toBe('laziz@example.com');
    expect(result.booking.guest_phone).toBe('+998901234567');
    expect(result.booking.price_snapshot).toMatchObject({
      guest: {
        first_name: 'Laziz',
        last_name: 'Shakarov',
        name: 'Laziz Shakarov',
        email: 'laziz@example.com',
        phone: '+998901234567',
      },
    });
    expect(events.bookingStatusChanged).toHaveBeenCalledWith(result.booking);
    expect(events.partnerDashboardUpdated).toHaveBeenCalledWith('partner-1');
    expect(events.adminDashboardUpdated).toHaveBeenCalled();
    // BUG-01 fix: guest (egasiz) bron uchun tasdiqlash sahifasi keyinroq
    // ishlatadigan opaque guest-access token qaytarilishi SHART — aks holda
    // `GET /bookings/:id` guest uchun doim 401 bilan rad etaveradi.
    expect(result.guestAccessToken).toEqual(expect.any(String));
    expect(result.guestAccessToken!.length).toBeGreaterThan(20);
  });

  it('populates booking.user_id when an authenticated customer books (regression: guest-checkout guard was stripping the actor for everyone)', async () => {
    pg.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 1,
        },
      ])
      .mockResolvedValueOnce([{ booked_count: 0 }])
      .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const authedActor: RequestActor = {
      id: 'user-42',
      actorType: 'user',
      role: Role.USER,
      roles: [Role.USER],
    };

    const result = await service.createHotel(authedActor, {
      hotel_id: 'hotel-1',
      agree_terms: true,
      room_id: 'room-1',
      check_in: '2026-08-10',
      check_out: '2026-08-12',
    });

    expect(result.booking.user_id).toBe('user-42');
    // Authenticated booking — JWT o'zi yetarli, guest-access token KERAK
    // EMAS (ishlab chiqarilmasligi ham kerak, keraksiz cache yozuvi
    // qoldirmaslik uchun).
    expect(result.guestAccessToken).toBeUndefined();
  });

  it('confirms a cash-payment booking immediately instead of leaving it pending forever (regression: cash bookings had no path to confirmed and would auto-expire)', async () => {
    pg.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 1,
        },
      ])
      .mockResolvedValueOnce([{ booked_count: 0 }]) // conflict check
      .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
      .mockResolvedValueOnce([]) // INSERT bookings
      .mockResolvedValueOnce([]) // INSERT booking_status_history (created)
      .mockResolvedValueOnce([]) // existing pending payment check
      .mockResolvedValueOnce([]) // INSERT payments
      .mockResolvedValueOnce([]) // UPDATE bookings SET status = confirmed (cash)
      .mockResolvedValueOnce([]); // INSERT booking_status_history (cash_booking_confirmed)

    const result = await service.createHotel(undefined, {
      hotel_id: 'hotel-1',
      agree_terms: true,
      room_id: 'room-1',
      check_in: '2026-08-10',
      check_out: '2026-08-12',
      payment_method: 'cash',
    });

    expect(result.booking.status).toBe('confirmed');
    expect(result.booking.confirmed_at).not.toBeNull();
    expect(result.payment.status).toBe('awaiting_cash');
  });

  it("SAFAAR Excel komissiya jadvali (hudud+tur+yulduz) partner_organizations.default_commission_rate'dan USTUN — 2026-09-13 biznes tomonidan tasdiqlangan qaror (regression: bu hotel/hostel/guesthouse turlari uchun org'ning qo'lda sozlangan stavkasini e'tiborsiz qoldirishi SHART)", async () => {
    pg.query
      .mockResolvedValueOnce([
        {
          ...hotelRow,
          commission_rate: 20, // org'da qo'lda sozlangan — Excel bo'lgani uchun E'TIBORGA OLINMASLIGI kerak
          stars: 5,
          city_slug: 'tashkent',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 1,
        },
      ])
      .mockResolvedValueOnce([{ booked_count: 0 }])
      .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.createHotel(undefined, {
      hotel_id: 'hotel-1',
      agree_terms: true,
      room_id: 'room-1',
      check_in: '2026-08-10',
      check_out: '2026-08-12',
      rooms: 1,
    });

    // subtotal = 100000 * 2 nights * 1 room = 200000; Toshkent + 5 yulduz
    // (hotel + stars>=4) = 14% Excel bo'yicha (org'ning 20%i EMAS) = 28000
    expect(result.booking.commission_amount).toBe(28000);
    expect(result.booking.partner_payable).toBe(172000);
  });

  it("Excel jadvali qamrab OLMAYDIGAN turlar (masalan `dacha`) uchun default_commission_rate hamon ishlatiladi (fallback o'zgarishsiz qoladi)", async () => {
    pg.query
      .mockResolvedValueOnce([
        {
          ...hotelRow,
          partner_type: 'dacha',
          commission_rate: 20,
          stars: null,
          city_slug: 'tashkent',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 1,
        },
      ])
      .mockResolvedValueOnce([{ booked_count: 0 }])
      .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.createHotel(undefined, {
      hotel_id: 'hotel-1',
      agree_terms: true,
      room_id: 'room-1',
      check_in: '2026-08-10',
      check_out: '2026-08-12',
      rooms: 1,
    });

    // subtotal = 200000; `dacha` Excel'da yo'q -> org'ning 20% stavkasi = 40000
    expect(result.booking.commission_amount).toBe(40000);
    expect(result.booking.partner_payable).toBe(160000);
  });

  it('applies a valid promo discount and reduces total_amount/partner_payable accordingly', async () => {
    promos.validate.mockResolvedValueOnce({
      code: 'SUMMER10',
      valid: true,
      discount_type: 'percentage',
      discount_value: 10,
    });
    pg.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 1,
        },
      ])
      .mockResolvedValueOnce([{ booked_count: 0 }])
      .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
      .mockResolvedValueOnce([]) // INSERT bookings
      .mockResolvedValueOnce([]) // INSERT booking_status_history
      .mockResolvedValueOnce([]) // SELECT existing pending payment
      .mockResolvedValueOnce([]); // INSERT payments

    const result = await service.createHotel(undefined, {
      hotel_id: 'hotel-1',
      agree_terms: true,
      room_id: 'room-1',
      check_in: '2026-08-10',
      check_out: '2026-08-12',
      rooms: 1,
      promo_code: 'SUMMER10',
    });

    expect(promos.redeem).toHaveBeenCalledWith('SUMMER10', expect.anything());
    // subtotal 200000, 10% chegirma = 20000 -> total 180000.
    // hotelRow: partner_type='hotel', city_slug/stars yo'q -> "Boshqa"
    // hudud + oddiy "hotel" qatori (Excel) = 10% komissiya = 18000.
    expect(result.booking.discount_amount).toBe(20000);
    expect(result.booking.total_amount).toBe(180000);
    expect(result.booking.commission_amount).toBe(18000);
  });

  it('rejects an invalid/expired promo code with 400 before touching inventory', async () => {
    promos.validate.mockResolvedValueOnce({
      code: 'EXPIRED',
      valid: false,
      discount_type: null,
      discount_value: 0,
    });
    pg.query.mockResolvedValueOnce([hotelRow]);

    await expect(
      service.createHotel(undefined, {
        hotel_id: 'hotel-1',
        agree_terms: true,
        room_id: 'room-1',
        check_in: '2026-08-10',
        check_out: '2026-08-12',
        promo_code: 'EXPIRED',
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(pg.transaction).not.toHaveBeenCalled();
  });

  it('sanalar band bo‘lsa 409 ROOM_ALREADY_BOOKED qaytaradi va bron yaratmaydi (regression: BUG-03 overselling)', async () => {
    pg.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 1,
        },
      ])
      // sana-ziddiyat tekshiruvi — mavjud bron topildi
      .mockResolvedValueOnce([{ booked_count: 1 }]);

    await expect(
      service.createHotel(undefined, {
        hotel_id: 'hotel-1',
        agree_terms: true,
        room_id: 'room-1',
        check_in: '2026-08-10',
        check_out: '2026-08-12',
        rooms: 1,
        guest_email: 'guest@example.com',
      }),
    ).rejects.toMatchObject({ status: 409 });

    // Ziddiyat topilgach INSERT chaqirilmasligi kerak (faqat 3 ta so'rov:
    // hotel, room-lock, conflict-check).
    expect(pg.query).toHaveBeenCalledTimes(3);
  });

  it("admin/hamkor 'room_inventory.closed=true' bilan bloklagan sanaga YANGI bron yaratib bo'lmaydi (2026-09-14 SAFAAR ADMIN Part 2 — booking engine real blockni hisobga olishi shart, avval bu tekshiruv UMUMAN yo'q edi)", async () => {
    pg.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 10,
        },
      ])
      // haqiqiy bron ziddiyati yo'q...
      .mockResolvedValueOnce([{ booked_count: 0 }])
      // ...lekin shu oraliqdagi bitta sana admin/hamkor tomonidan bloklangan
      .mockResolvedValueOnce([{ blocked_count: 1 }]);

    await expect(
      service.createHotel(undefined, {
        hotel_id: 'hotel-1',
        agree_terms: true,
        room_id: 'room-1',
        check_in: '2026-08-10',
        check_out: '2026-08-12',
        rooms: 1,
        guest_email: 'guest@example.com',
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'ROOM_DATES_BLOCKED' },
    });

    // Bloklangan sana topilgach INSERT chaqirilmasligi kerak (faqat 4 ta
    // so'rov: hotel, room-lock, conflict-check, block-check).
    expect(pg.query).toHaveBeenCalledTimes(4);
  });

  it("bloklanmagan (yopiq bo'lmagan) sanalar hamon oddiy tarzda bron qilinaveradi (regression guard — block-check false-positive bermasligi kerak)", async () => {
    pg.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 10,
        },
      ])
      .mockResolvedValueOnce([{ booked_count: 0 }])
      .mockResolvedValueOnce([{ blocked_count: 0 }]) // hech qanday sana bloklanmagan
      .mockResolvedValueOnce([]) // INSERT bookings
      .mockResolvedValueOnce([]) // INSERT booking_status_history
      .mockResolvedValueOnce([]) // SELECT existing pending payment
      .mockResolvedValueOnce([]); // INSERT payments

    const result = await service.createHotel(undefined, {
      hotel_id: 'hotel-1',
      agree_terms: true,
      room_id: 'room-1',
      check_in: '2026-08-10',
      check_out: '2026-08-12',
      rooms: 1,
      guest_email: 'guest@example.com',
    });

    expect(result.booking.room_id).toBe('room-1');
  });

  it('total_inventory=10 bo\'lgan xona turida 1 ta bron qilingandan keyin ham qolgan 9 tasini sotib bo\'ladi (regression: "soxta sold-out" — ilgari LIMIT 1 tufayli BITTA bron ham qolgan barcha inventarni "band" qilib qo\'yardi)', async () => {
    pg.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 10,
        },
      ])
      // Shu sanalarga allaqachon 1 ta xona band qilingan (10 tadan) — bu
      // ENDI ziddiyat HISOBLANMASLIGI kerak, chunki 1 + 1 <= 10.
      .mockResolvedValueOnce([{ booked_count: 1 }])
      .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
      .mockResolvedValueOnce([]) // INSERT bookings
      .mockResolvedValueOnce([]) // INSERT booking_status_history
      .mockResolvedValueOnce([]) // SELECT existing pending payment
      .mockResolvedValueOnce([]); // INSERT payments

    const result = await service.createHotel(undefined, {
      hotel_id: 'hotel-1',
      agree_terms: true,
      room_id: 'room-1',
      check_in: '2026-08-10',
      check_out: '2026-08-12',
      rooms: 1,
      guest_email: 'guest@example.com',
    });

    expect(result.booking.room_id).toBe('room-1');
  });

  it("total_inventory=10 bo'lgan xona turida 10 tasi allaqachon band bo'lsa, 11-chi so'rov 409 bilan rad etiladi", async () => {
    pg.query
      .mockResolvedValueOnce([hotelRow])
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 10,
        },
      ])
      .mockResolvedValueOnce([{ booked_count: 10 }]);

    await expect(
      service.createHotel(undefined, {
        hotel_id: 'hotel-1',
        agree_terms: true,
        room_id: 'room-1',
        check_in: '2026-08-10',
        check_out: '2026-08-12',
        rooms: 1,
        guest_email: 'guest@example.com',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('noto‘g‘ri check_in/check_out uchun 400 qaytaradi (500 emas)', async () => {
    pg.query.mockResolvedValueOnce([hotelRow]);

    await expect(
      service.createHotel(undefined, {
        hotel_id: 'hotel-1',
        agree_terms: true,
        room_id: 'room-1',
        check_in: 'not-a-date',
        check_out: '2026-08-12',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('a not-approved organization is invisible to booking creation, same as it already is to browsing (regression: rejected/suspended partner could still receive paid bookings)', async () => {
    // `po.status = 'approved'` endi so'rov ichida filtrlanadi — organization
    // approved bo'lmasa hech qanday qator qaytmaydi (xuddi mavjud bo'lmagan
    // hotel kabi).
    pg.query.mockResolvedValueOnce([]);

    await expect(
      service.createHotel(undefined, {
        hotel_id: 'hotel-1',
        agree_terms: true,
        room_id: 'room-1',
        check_in: '2026-08-10',
        check_out: '2026-08-12',
      }),
    ).rejects.toMatchObject({ status: 404 });

    const [sql] = pg.query.mock.calls[0];
    expect(String(sql)).toContain("po.status = 'approved'");
  });

  describe('Terms of Service acceptance (2026-09-15, server-side enforced checkout)', () => {
    it('rejects when agree_terms is missing entirely, before touching the DB at all', async () => {
      await expect(
        service.createHotel(undefined, {
          hotel_id: 'hotel-1',
          room_id: 'room-1',
          check_in: '2026-08-10',
          check_out: '2026-08-12',
        }),
      ).rejects.toMatchObject({ response: { code: 'TERMS_NOT_ACCEPTED' } });
      expect(pg.query).not.toHaveBeenCalled();
      expect(pg.transaction).not.toHaveBeenCalled();
    });

    it('rejects when agree_terms is explicitly false', async () => {
      await expect(
        service.createHotel(undefined, {
          hotel_id: 'hotel-1',
          agree_terms: false,
          room_id: 'room-1',
          check_in: '2026-08-10',
          check_out: '2026-08-12',
        }),
      ).rejects.toMatchObject({ response: { code: 'TERMS_NOT_ACCEPTED' } });
      expect(pg.query).not.toHaveBeenCalled();
    });

    it('rejects a malformed (non-boolean) value the same as missing', async () => {
      await expect(
        service.createHotel(undefined, {
          hotel_id: 'hotel-1',
          agree_terms: 'true',
          room_id: 'room-1',
          check_in: '2026-08-10',
          check_out: '2026-08-12',
        }),
      ).rejects.toMatchObject({ response: { code: 'TERMS_NOT_ACCEPTED' } });
    });

    it('applies equally to guest checkout (no actor) — a guest booking still requires acceptance', async () => {
      await expect(
        service.createHotel(undefined, {
          hotel_id: 'hotel-1',
          room_id: 'room-1',
          check_in: '2026-08-10',
          check_out: '2026-08-12',
        }),
      ).rejects.toMatchObject({ response: { code: 'TERMS_NOT_ACCEPTED' } });
    });

    it('persists terms_accepted_at + terms_version on the booking row itself (same INSERT, atomic with booking creation) and writes an audit_logs entry', async () => {
      pg.query
        .mockResolvedValueOnce([hotelRow])
        .mockResolvedValueOnce([
          {
            id: 'room-1',
            hotel_id: 'hotel-1',
            base_price: '100000',
            total_inventory: 1,
          },
        ])
        .mockResolvedValueOnce([{ booked_count: 0 }])
        .mockResolvedValueOnce([{ blocked_count: 0 }])
        .mockResolvedValueOnce([]) // INSERT bookings
        .mockResolvedValueOnce([]) // INSERT audit_logs (terms_accepted)
        .mockResolvedValueOnce([]) // INSERT booking_status_history
        .mockResolvedValueOnce([]) // SELECT existing pending payment
        .mockResolvedValueOnce([]); // INSERT payments

      await service.createHotel(undefined, {
        hotel_id: 'hotel-1',
        agree_terms: true,
        room_id: 'room-1',
        check_in: '2026-08-10',
        check_out: '2026-08-12',
      });

      const insertBookingCall = pg.query.mock.calls[4];
      expect(String(insertBookingCall[0])).toMatch(/terms_accepted_at/);
      expect(String(insertBookingCall[0])).toMatch(/terms_version/);
      // Params order: ... guest_name, guest_email, guest_phone, terms_accepted_at, terms_version, created_at, updated_at
      const params = insertBookingCall[1] as unknown[];
      expect(params[params.length - 4]).toEqual(expect.any(String)); // terms_accepted_at
      expect(params[params.length - 3]).toBe(CURRENT_TERMS_VERSION); // terms_version

      const auditCall = pg.query.mock.calls[5];
      expect(String(auditCall[0])).toMatch(/audit_logs/);
      expect(auditCall[1]).toEqual(
        expect.arrayContaining(['booking.terms_accepted']),
      );
    });
  });
});

describe('BookingsService.createHotel restaurant (time-slot) reservations', () => {
  let service: BookingsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>> & {
    transaction: jest.Mock;
  };
  let events: {
    bookingStatusChanged: jest.Mock;
    partnerDashboardUpdated: jest.Mock;
    adminDashboardUpdated: jest.Mock;
  };
  let promos: jest.Mocked<Pick<PromosService, 'validate' | 'redeem'>>;

  const restaurantHotelRow = {
    id: 'hotel-r1',
    partner_organization_id: 'partner-r1',
    partner_type: 'restaurant',
    commission_rate: 12,
    check_in_time: '09:00',
    check_out_time: '23:00',
  };

  beforeEach(() => {
    pg = {
      query: jest.fn(),
      transaction: jest.fn((operation: (tx: unknown) => unknown) =>
        Promise.resolve(operation({ query: pg.query })),
      ),
    };
    events = {
      bookingStatusChanged: jest.fn(),
      partnerDashboardUpdated: jest.fn(),
      adminDashboardUpdated: jest.fn(),
    };
    promos = noopPromosService();
    service = new BookingsService(
      pg as unknown as PostgresService,
      events as unknown as EventsService,
      { send: jest.fn() } as unknown as EmailService,
      promos as unknown as PromosService,
      {
        buildCheckoutUrl: jest.fn().mockReturnValue(null),
      } as unknown as PaymentsService,
      noopCacheService() as unknown as AppCacheService,
    );
  });

  it('persists slot_time and uses a slot-overlap conflict check (regression: public restaurant bookings never carried the time slot)', async () => {
    pg.query
      .mockResolvedValueOnce([restaurantHotelRow])
      .mockResolvedValueOnce([
        {
          id: 'table-1',
          hotel_id: 'hotel-r1',
          base_price: '150000',
          total_inventory: 1,
        },
      ])
      .mockResolvedValueOnce([{ booked_count: 0 }]) // slot conflict check — bo'sh
      .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
      .mockResolvedValueOnce([]) // INSERT bookings
      .mockResolvedValueOnce([]) // INSERT booking_status_history
      .mockResolvedValueOnce([]) // existing pending payment check
      .mockResolvedValueOnce([]); // INSERT payments

    const result = await service.createHotel(undefined, {
      hotel_id: 'hotel-r1',
      agree_terms: true,
      room_id: 'table-1',
      check_in: '2026-08-10',
      slot_time: '19:00',
      guest_name: 'Laziz',
    });

    expect(result.booking.type).toBe('restaurant');
    expect(result.booking.check_out).toBe('2026-08-10');
    expect(result.booking.slot_time).toBe('19:00');

    const conflictCall = pg.query.mock.calls[2];
    expect(String(conflictCall[0])).toContain('90 minutes');
    expect(conflictCall[1]).toEqual([
      'table-1',
      'cancelled',
      'expired',
      'completed',
      '2026-08-10',
      '19:00',
    ]);
  });

  it('rejects a restaurant reservation with no slot_time (400, not a silent same-day hotel booking)', async () => {
    pg.query.mockResolvedValueOnce([restaurantHotelRow]);

    await expect(
      service.createHotel(undefined, {
        hotel_id: 'hotel-r1',
        agree_terms: true,
        room_id: 'table-1',
        check_in: '2026-08-10',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a slot outside operating hours', async () => {
    pg.query.mockResolvedValueOnce([restaurantHotelRow]);

    await expect(
      service.createHotel(undefined, {
        hotel_id: 'hotel-r1',
        agree_terms: true,
        room_id: 'table-1',
        check_in: '2026-08-10',
        slot_time: '06:00',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a double-booked table+slot with 409 TABLE_ALREADY_BOOKED', async () => {
    pg.query
      .mockResolvedValueOnce([restaurantHotelRow])
      .mockResolvedValueOnce([
        {
          id: 'table-1',
          hotel_id: 'hotel-r1',
          base_price: '150000',
          total_inventory: 1,
        },
      ])
      .mockResolvedValueOnce([{ booked_count: 1 }]);

    await expect(
      service.createHotel(undefined, {
        hotel_id: 'hotel-r1',
        agree_terms: true,
        room_id: 'table-1',
        check_in: '2026-08-10',
        slot_time: '19:00',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('BookingsService.createBus (regression: BUG-04 seat double-selling)', () => {
  let service: BookingsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>> & {
    transaction: jest.Mock;
  };
  let events: {
    bookingStatusChanged: jest.Mock;
    partnerDashboardUpdated: jest.Mock;
    adminDashboardUpdated: jest.Mock;
  };
  let promos: jest.Mocked<Pick<PromosService, 'validate' | 'redeem'>>;
  const actor: RequestActor = {
    id: 'user-1',
    actorType: 'user',
    role: Role.USER,
    roles: [Role.USER],
  };

  beforeEach(() => {
    pg = {
      query: jest.fn(),
      transaction: jest.fn((operation: (tx: unknown) => unknown) =>
        Promise.resolve(operation({ query: pg.query })),
      ),
    };
    events = {
      bookingStatusChanged: jest.fn(),
      partnerDashboardUpdated: jest.fn(),
      adminDashboardUpdated: jest.fn(),
    };
    promos = noopPromosService();
    service = new BookingsService(
      pg as unknown as PostgresService,
      events as unknown as EventsService,
      { send: jest.fn() } as unknown as EmailService,
      promos as unknown as PromosService,
      {
        buildCheckoutUrl: jest.fn().mockReturnValue(null),
      } as unknown as PaymentsService,
      noopCacheService() as unknown as AppCacheService,
    );
  });

  it("bo'sh o'rindiq uchun muvaffaqiyatli bron yaratadi", async () => {
    pg.query
      .mockResolvedValueOnce([
        { id: 'trip-1', company_id: 'company-1', base_price: '50000' },
      ])
      .mockResolvedValueOnce([
        { partner_organization_id: 'partner-1', commission_rate: 12 },
      ])
      .mockResolvedValueOnce([
        { id: 'seat-1', seat_code: '12A', status: 'available', price: '50000' },
      ])
      .mockResolvedValueOnce([]) // INSERT bookings
      .mockResolvedValueOnce([]) // INSERT booking_status_history
      .mockResolvedValueOnce([]) // UPDATE trip_seats (mark held)
      .mockResolvedValueOnce([]) // existing pending payment check
      .mockResolvedValueOnce([]); // INSERT payments

    const result = await service.createBus(actor, {
      trip_id: 'trip-1',
      seats: ['12A'],
    });

    expect(result.booking.trip_id).toBe('trip-1');
    expect(result.booking.user_id).toBe('user-1');
    expect(pg.transaction).toHaveBeenCalledTimes(1);
  });

  it("o'rindiq allaqachon band bo'lsa SEAT_NOT_AVAILABLE bilan rad etadi va bron yaratmaydi (tranzaksiya ichida qulflangan holatni ko'radi)", async () => {
    pg.query
      .mockResolvedValueOnce([
        { id: 'trip-1', company_id: 'company-1', base_price: '50000' },
      ])
      .mockResolvedValueOnce([
        { partner_organization_id: 'partner-1', commission_rate: 12 },
      ])
      // FOR UPDATE qulfdan keyin — o'rindiq boshqa tranzaksiya tomonidan
      // allaqachon 'held' qilib qo'yilgan holatni simulyatsiya qiladi.
      .mockResolvedValueOnce([
        { id: 'seat-1', seat_code: '12A', status: 'held', price: '50000' },
      ]);

    await expect(
      service.createBus(actor, { trip_id: 'trip-1', seats: ['12A'] }),
    ).rejects.toMatchObject({ status: 422 });

    // Ziddiyat aniqlangach INSERT chaqirilmasligi kerak (faqat 3 ta so'rov:
    // trip, company, seat-lock).
    expect(pg.query).toHaveBeenCalledTimes(3);
  });

  it('a not-approved bus company is invisible to booking creation (regression: rejected/suspended partner could still sell seats)', async () => {
    pg.query
      .mockResolvedValueOnce([
        { id: 'trip-1', company_id: 'company-1', base_price: '50000' },
      ])
      .mockResolvedValueOnce([]); // JOIN ... WHERE po.status = 'approved' — no match

    await expect(
      service.createBus(actor, { trip_id: 'trip-1', seats: ['12A'] }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('BookingsService.createVehicleRental (rent-a-car: date-range booking against a single vehicle, mirrors createHotel)', () => {
  let service: BookingsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>> & {
    transaction: jest.Mock;
  };
  let events: {
    bookingStatusChanged: jest.Mock;
    partnerDashboardUpdated: jest.Mock;
    adminDashboardUpdated: jest.Mock;
  };
  let promos: jest.Mocked<Pick<PromosService, 'validate' | 'redeem'>>;

  const vehicleLookupRow = {
    id: 'vehicle-1',
    price_per_day: '150000',
    partner_organization_id: 'partner-1',
    commission_rate: 12,
  };

  beforeEach(() => {
    pg = {
      query: jest.fn(),
      transaction: jest.fn((operation: (tx: unknown) => unknown) =>
        Promise.resolve(operation({ query: pg.query })),
      ),
    };
    events = {
      bookingStatusChanged: jest.fn(),
      partnerDashboardUpdated: jest.fn(),
      adminDashboardUpdated: jest.fn(),
    };
    promos = noopPromosService();
    service = new BookingsService(
      pg as unknown as PostgresService,
      events as unknown as EventsService,
      { send: jest.fn() } as unknown as EmailService,
      promos as unknown as PromosService,
      {
        buildCheckoutUrl: jest.fn().mockReturnValue(null),
      } as unknown as PaymentsService,
      noopCacheService() as unknown as AppCacheService,
    );
  });

  it('allows guest (unauthenticated) checkout and computes subtotal from price_per_day * days', async () => {
    pg.query
      .mockResolvedValueOnce([vehicleLookupRow]) // vehicle lookup
      .mockResolvedValueOnce([{ id: 'vehicle-1', price_per_day: '150000' }]) // FOR UPDATE lock
      .mockResolvedValueOnce([]) // conflict check (none)
      .mockResolvedValueOnce([]) // INSERT bookings
      .mockResolvedValueOnce([]) // INSERT booking_status_history
      .mockResolvedValueOnce([]) // existing pending payment check
      .mockResolvedValueOnce([]); // INSERT payments

    const result = await service.createVehicleRental(undefined, {
      vehicle_id: 'vehicle-1',
      check_in: '2027-08-20',
      check_out: '2027-08-23',
      firstName: 'Laziz',
      lastName: 'Shakarov',
      email: 'laziz@example.com',
      phone: '+998901234567',
    });

    expect(result.booking.vehicle_id).toBe('vehicle-1');
    expect(result.booking.user_id).toBeNull();
    expect(result.booking.subtotal).toBe(450000); // 150000 * 3 kun
    expect(result.booking.guest_name).toBe('Laziz Shakarov');
    expect(pg.transaction).toHaveBeenCalledTimes(1);
    // BUG-01 fix — hotel bilan bir xil: guest (egasiz) bron uchun
    // tasdiqlash sahifasi ishlatadigan guest-access token qaytariladi.
    expect(result.guestAccessToken).toEqual(expect.any(String));
  });

  it('rejects overlapping dates for the same vehicle with VEHICLE_ALREADY_BOOKED (409)', async () => {
    pg.query
      .mockResolvedValueOnce([vehicleLookupRow])
      .mockResolvedValueOnce([{ id: 'vehicle-1', price_per_day: '150000' }])
      .mockResolvedValueOnce([{ id: 'existing-booking-1' }]); // conflict found

    await expect(
      service.createVehicleRental(undefined, {
        vehicle_id: 'vehicle-1',
        check_in: '2027-08-20',
        check_out: '2027-08-23',
        guest_name: 'Test',
        guest_email: 'test@example.com',
        guest_phone: '+998901234567',
      }),
    ).rejects.toMatchObject({ status: 409 });

    // Ziddiyat aniqlangach INSERT chaqirilmasligi kerak.
    expect(pg.query).toHaveBeenCalledTimes(3);
  });

  it('a not-approved / suspended rent-a-car company is invisible to booking creation', async () => {
    pg.query.mockResolvedValueOnce([]); // JOIN ... WHERE po.status = 'approved' — no match

    await expect(
      service.createVehicleRental(undefined, {
        vehicle_id: 'vehicle-1',
        check_in: '2026-08-20',
        check_out: '2026-08-23',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects invalid date ranges before touching the transaction', async () => {
    pg.query.mockResolvedValueOnce([vehicleLookupRow]);

    await expect(
      service.createVehicleRental(undefined, {
        vehicle_id: 'vehicle-1',
        check_in: '2026-08-23',
        check_out: '2026-08-20', // check_out before check_in
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(pg.transaction).not.toHaveBeenCalled();
  });

  it('rejects a pickup date in the past (regression: audit found a 2020-01-01 booking succeeded live on production)', async () => {
    pg.query.mockResolvedValueOnce([vehicleLookupRow]);

    await expect(
      service.createVehicleRental(undefined, {
        vehicle_id: 'vehicle-1',
        check_in: '2020-01-01',
        check_out: '2020-01-03',
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(pg.transaction).not.toHaveBeenCalled();
  });
});

describe('BookingsService.cancel (regression: explicit cancellation never released bus seats)', () => {
  let service: BookingsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>> & {
    transaction: jest.Mock;
  };
  let events: { bookingStatusChanged: jest.Mock };

  const bookingRow = {
    id: 'booking-1',
    status: 'confirmed',
    user_id: 'user-1',
    partner_organization_id: 'partner-1',
    total_amount: 100000,
    currency: 'UZS',
    payment_method: 'click',
  };

  beforeEach(() => {
    pg = {
      query: jest.fn(),
      transaction: jest.fn((operation: (tx: unknown) => unknown) =>
        Promise.resolve(operation({ query: pg.query })),
      ),
    };
    events = { bookingStatusChanged: jest.fn() };
    service = new BookingsService(
      pg as unknown as PostgresService,
      events as unknown as EventsService,
      { send: jest.fn() } as unknown as EmailService,
      noopPromosService() as unknown as PromosService,
      {
        buildCheckoutUrl: jest.fn().mockReturnValue(null),
      } as unknown as PaymentsService,
      noopCacheService() as unknown as AppCacheService,
    );
  });

  const actor: RequestActor = {
    id: 'user-1',
    actorType: 'user',
    role: Role.USER,
    roles: [Role.USER],
  };

  it('releases any held trip_seats tied to this booking when explicitly cancelled', async () => {
    pg.query
      .mockResolvedValueOnce([bookingRow]) // assertBooking
      .mockResolvedValueOnce([{ ...bookingRow, status: 'cancelled' }]) // UPDATE bookings RETURNING *
      .mockResolvedValueOnce([]) // UPDATE trip_seats
      .mockResolvedValueOnce([]) // SELECT paid payment (none)
      .mockResolvedValueOnce([]); // addStatusHistory INSERT

    const result = await service.cancel(actor, 'booking-1', {});

    expect(result.status).toBe('cancelled');
    const seatRelease = pg.query.mock.calls.find(([sql]) =>
      String(sql).includes('trip_seats'),
    );
    expect(seatRelease).toBeDefined();
    expect(seatRelease?.[1]).toEqual(['booking-1']);
  });

  it('rejects cancelling an already-cancelled booking', async () => {
    pg.query.mockResolvedValueOnce([{ ...bookingRow, status: 'cancelled' }]);

    await expect(service.cancel(actor, 'booking-1', {})).rejects.toMatchObject({
      status: 422,
    });
  });

  it('auto-creates an 80%-policy refund request when cancelling a PAID booking (regression: audit found self-service cancel never triggered any refund — money vanished with no record)', async () => {
    pg.query
      .mockResolvedValueOnce([bookingRow]) // assertBooking
      .mockResolvedValueOnce([{ ...bookingRow, status: 'cancelled' }]) // UPDATE bookings RETURNING *
      .mockResolvedValueOnce([]) // UPDATE trip_seats
      .mockResolvedValueOnce([{ amount: '100000', currency: 'UZS' }]) // SELECT paid payment (found)
      .mockResolvedValueOnce([]) // SELECT existing refund (none)
      .mockResolvedValueOnce([]) // INSERT INTO refunds
      .mockResolvedValueOnce([]); // addStatusHistory INSERT

    await service.cancel(actor, 'booking-1', {});

    const refundInsert = pg.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO refunds'),
    );
    expect(refundInsert).toBeDefined();
    expect(refundInsert?.[1]).toEqual([
      expect.any(String),
      'booking-1',
      'user-1',
      'UZS',
      80000, // 100000 * 0.8, matching cancelPreview()'s displayed policy
      expect.any(String),
      expect.any(String),
    ]);
  });

  it('does not create a duplicate refund request if one is already pending', async () => {
    pg.query
      .mockResolvedValueOnce([bookingRow]) // assertBooking
      .mockResolvedValueOnce([{ ...bookingRow, status: 'cancelled' }]) // UPDATE bookings RETURNING *
      .mockResolvedValueOnce([]) // UPDATE trip_seats
      .mockResolvedValueOnce([{ amount: '100000', currency: 'UZS' }]) // SELECT paid payment (found)
      .mockResolvedValueOnce([{ id: 'refund-existing' }]) // SELECT existing refund (found)
      .mockResolvedValueOnce([]); // addStatusHistory INSERT

    await service.cancel(actor, 'booking-1', {});

    const refundInsert = pg.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO refunds'),
    );
    expect(refundInsert).toBeUndefined();
  });
});

describe('BookingsService.findOne — authorization (regression: unauthenticated IDOR)', () => {
  let service: BookingsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>>;

  const bookingRow = {
    id: 'booking-1',
    user_id: 'user-owner',
    partner_organization_id: 'partner-1',
    total_amount: 100000,
    currency: 'UZS',
    payment_method: 'cash',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new BookingsService(
      pg as unknown as PostgresService,
      {
        bookingStatusChanged: jest.fn(),
        partnerDashboardUpdated: jest.fn(),
        adminDashboardUpdated: jest.fn(),
      } as unknown as EventsService,
      { send: jest.fn() } as unknown as EmailService,
      noopPromosService() as unknown as PromosService,
      {
        buildCheckoutUrl: jest.fn().mockReturnValue(null),
      } as unknown as PaymentsService,
      noopCacheService() as unknown as AppCacheService,
    );
  });

  it('anonim (actor yo‘q) chaqiruv 401 bilan rad etiladi', async () => {
    pg.query.mockResolvedValueOnce([bookingRow]);

    await expect(service.findOne(undefined, 'booking-1')).rejects.toMatchObject(
      { status: 401 },
    );
  });

  it('boshqa foydalanuvchi bronini ko‘ra olmaydi (403)', async () => {
    pg.query.mockResolvedValueOnce([bookingRow]);
    const otherUser: RequestActor = {
      id: 'user-other',
      actorType: 'user',
      role: Role.USER,
      roles: [Role.USER],
    };

    await expect(service.findOne(otherUser, 'booking-1')).rejects.toMatchObject(
      { status: 403 },
    );
  });

  it('bron egasi o‘z bronini ko‘ra oladi', async () => {
    pg.query.mockResolvedValueOnce([bookingRow]).mockResolvedValueOnce([]);
    const owner: RequestActor = {
      id: 'user-owner',
      actorType: 'user',
      role: Role.USER,
      roles: [Role.USER],
    };

    const result = await service.findOne(owner, 'booking-1');
    expect(result.id).toBe('booking-1');
  });
});

describe('BookingsService.findOne — guest booking access token (BUG-01 confirmation fix)', () => {
  let service: BookingsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>>;
  let cache: Record<string, jest.Mock>;

  // Egasiz (user_id = null) — guest checkout orqali yaratilgan bron.
  const guestBookingRow = {
    id: 'booking-guest-1',
    user_id: null,
    partner_organization_id: 'partner-1',
    total_amount: 100000,
    currency: 'UZS',
    payment_method: 'cash',
  };

  // Egali — login qilingan foydalanuvchi bronini, guest-token bilan
  // "taxmin qilib" ochish mumkin emasligini isbotlash uchun.
  const ownedBookingRow = {
    id: 'booking-owned-1',
    user_id: 'user-owner',
    partner_organization_id: 'partner-1',
    total_amount: 100000,
    currency: 'UZS',
    payment_method: 'cash',
  };

  beforeEach(() => {
    pg = { query: jest.fn() };
    cache = noopCacheService();
    service = new BookingsService(
      pg as unknown as PostgresService,
      {
        bookingStatusChanged: jest.fn(),
        partnerDashboardUpdated: jest.fn(),
        adminDashboardUpdated: jest.fn(),
      } as unknown as EventsService,
      { send: jest.fn() } as unknown as EmailService,
      noopPromosService() as unknown as PromosService,
      {
        buildCheckoutUrl: jest.fn().mockReturnValue(null),
      } as unknown as PaymentsService,
      cache as unknown as AppCacheService,
    );
  });

  it('valid guest token for the CORRECT booking grants access (no actor)', async () => {
    pg.query.mockResolvedValueOnce([guestBookingRow]).mockResolvedValueOnce([]);
    cache.get.mockResolvedValueOnce({ bookingId: 'booking-guest-1' });

    const result = await service.findOne(
      undefined,
      'booking-guest-1',
      'real-guest-token',
    );
    expect(result.id).toBe('booking-guest-1');
  });

  it('a guest token issued for a DIFFERENT booking is denied (no cross-booking access / IDOR)', async () => {
    pg.query.mockResolvedValueOnce([guestBookingRow]);
    // Token cache'da bor, lekin BOSHQA bron ID'siga bog'langan.
    cache.get.mockResolvedValueOnce({ bookingId: 'booking-OTHER' });

    await expect(
      service.findOne(undefined, 'booking-guest-1', 'token-for-other-booking'),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('no token at all is denied (anonymous, no guest token)', async () => {
    pg.query.mockResolvedValueOnce([guestBookingRow]);

    await expect(
      service.findOne(undefined, 'booking-guest-1', undefined),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('an expired/never-issued guest token is denied — cache miss (get returns undefined)', async () => {
    pg.query.mockResolvedValueOnce([guestBookingRow]);
    cache.get.mockResolvedValueOnce(undefined);

    await expect(
      service.findOne(undefined, 'booking-guest-1', 'expired-or-bogus-token'),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('a malformed/garbage guest token string is denied the same way (no special-casing, no crash)', async () => {
    pg.query.mockResolvedValueOnce([guestBookingRow]);
    cache.get.mockResolvedValueOnce(undefined);

    await expect(
      service.findOne(undefined, 'booking-guest-1', 'not-even-base64url!!!'),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('a guest token cannot be used against an OWNED booking, even with a matching cache entry (defense in depth)', async () => {
    pg.query.mockResolvedValueOnce([ownedBookingRow]);
    // Faraz qilaylik kimdir/nimadir shu bron ID'siga mos token yaratib
    // qo'ygan — lekin bron endi egasiz emas, shuning uchun baribir rad
    // etilishi kerak (guest-token yo'li faqat user_id=NULL uchun ishlaydi).
    cache.get.mockResolvedValueOnce({ bookingId: 'booking-owned-1' });

    await expect(
      service.findOne(undefined, 'booking-owned-1', 'suspicious-token'),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('authenticated actor regression: owner access still works even when a (irrelevant) guestToken is also present', async () => {
    pg.query.mockResolvedValueOnce([ownedBookingRow]).mockResolvedValueOnce([]);
    const owner: RequestActor = {
      id: 'user-owner',
      actorType: 'user',
      role: Role.USER,
      roles: [Role.USER],
    };

    const result = await service.findOne(
      owner,
      'booking-owned-1',
      'some-guest-token-that-should-be-ignored',
    );
    expect(result.id).toBe('booking-owned-1');
    // Actor mavjud bo'lganda guest-token yo'liga umuman kirilmaydi.
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('authenticated actor regression: a different user is still forbidden (403), guest-token branch never consulted', async () => {
    pg.query.mockResolvedValueOnce([ownedBookingRow]);
    const otherUser: RequestActor = {
      id: 'user-other',
      actorType: 'user',
      role: Role.USER,
      roles: [Role.USER],
    };

    await expect(
      service.findOne(otherUser, 'booking-owned-1', 'irrelevant-token'),
    ).rejects.toMatchObject({ status: 403 });
    expect(cache.get).not.toHaveBeenCalled();
  });
});

describe('BookingsService.lookupBooking (guest — booking_number + email)', () => {
  let service: BookingsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>>;

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new BookingsService(
      pg as unknown as PostgresService,
      {
        bookingStatusChanged: jest.fn(),
        partnerDashboardUpdated: jest.fn(),
        adminDashboardUpdated: jest.fn(),
      } as unknown as EventsService,
      { send: jest.fn() } as unknown as EmailService,
      noopPromosService() as unknown as PromosService,
      {
        buildCheckoutUrl: jest.fn().mockReturnValue(null),
      } as unknown as PaymentsService,
      noopCacheService() as unknown as AppCacheService,
    );
  });

  it('booking_number + email mos kelsa cheklangan maydonlarni qaytaradi', async () => {
    pg.query
      .mockResolvedValueOnce([
        {
          id: 'booking-1',
          booking_number: 'UZB-ABC123',
          type: 'hotel',
          status: 'pending',
          currency: 'UZS',
          total_amount: 100000,
          hotel_id: 'hotel-1',
          trip_id: null,
          check_in: '2026-09-01',
          check_out: '2026-09-03',
          slot_time: null,
          guest_name: 'Laziz',
          guest_email: 'guest@example.com',
          created_at: '2026-08-01T00:00:00.000Z',
          commission_amount: 12000,
          partner_payable: 88000,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.lookupBooking(
      'UZB-ABC123',
      'GUEST@EXAMPLE.COM',
    );

    expect(result.booking_number).toBe('UZB-ABC123');
    expect(result).not.toHaveProperty('commission_amount');
    expect(result).not.toHaveProperty('partner_payable');
    expect(result).not.toHaveProperty('guest_email');
  });

  it('email mos kelmasa umumiy 404 qaytaradi (enumeration himoyasi)', async () => {
    pg.query.mockResolvedValueOnce([]);

    await expect(
      service.lookupBooking('UZB-ABC123', 'wrong@example.com'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("bo'sh bron raqami yoki email uchun 400 qaytaradi", async () => {
    await expect(
      service.lookupBooking('', 'guest@example.com'),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('BookingsService.expireStaleBookings (regression: BUG-09 hold expiry, and paid-but-unconfirmed timeout)', () => {
  let service: BookingsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>> & {
    transaction: jest.Mock;
  };
  let events: {
    bookingStatusChanged: jest.Mock;
    partnerDashboardUpdated: jest.Mock;
    adminDashboardUpdated: jest.Mock;
  };

  beforeEach(() => {
    pg = {
      query: jest.fn(),
      transaction: jest.fn((operation: (tx: unknown) => unknown) =>
        Promise.resolve(operation({ query: pg.query })),
      ),
    };
    events = {
      bookingStatusChanged: jest.fn(),
      partnerDashboardUpdated: jest.fn(),
      adminDashboardUpdated: jest.fn(),
    };
    service = new BookingsService(
      pg as unknown as PostgresService,
      events as unknown as EventsService,
      { send: jest.fn() } as unknown as EmailService,
      noopPromosService() as unknown as PromosService,
      {
        buildCheckoutUrl: jest.fn().mockReturnValue(null),
      } as unknown as PaymentsService,
      noopCacheService() as unknown as AppCacheService,
    );
  });

  it("muddati o'tgan bronlarni 'expired'ga o'tkazadi, o'rindiqlarni bo'shatadi va hodisalarni yuboradi", async () => {
    const expiredBooking = {
      id: 'booking-1',
      status: 'expired',
      user_id: 'user-1',
      partner_organization_id: 'partner-1',
      total_amount: 50000,
      currency: 'UZS',
      payment_method: 'cash',
    };
    pg.query
      // UPDATE bookings ... RETURNING * (expired)
      .mockResolvedValueOnce([expiredBooking])
      // UPDATE trip_seats ...
      .mockResolvedValueOnce([])
      // addStatusHistory INSERT
      .mockResolvedValueOnce([])
      // UPDATE bookings ... awaiting_partner_confirmation timeout -> none
      .mockResolvedValueOnce([]);

    await service.expireStaleBookings();

    expect(pg.transaction).toHaveBeenCalledTimes(1);
    expect(events.bookingStatusChanged).toHaveBeenCalledWith(expiredBooking);
    expect(events.partnerDashboardUpdated).toHaveBeenCalledWith('partner-1');
    expect(events.adminDashboardUpdated).toHaveBeenCalled();

    // O'rindiq bo'shatish so'rovi to'g'ri booking id bilan chaqirilganini
    // tekshiramiz.
    const seatReleaseCall = pg.query.mock.calls[1];
    expect(seatReleaseCall[0]).toContain('trip_seats');
    expect(seatReleaseCall[1]).toEqual([['booking-1']]);
  });

  it("hech qanday bron muddati o'tmagan bo'lsa hech narsa qilmaydi", async () => {
    pg.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.expireStaleBookings();

    expect(pg.query).toHaveBeenCalledTimes(2);
    expect(events.bookingStatusChanged).not.toHaveBeenCalled();
    expect(events.adminDashboardUpdated).not.toHaveBeenCalled();
  });

  it('auto-cancels a booking stuck in awaiting_partner_confirmation past its deadline and files an auto-refund (regression: this state never expired before)', async () => {
    const cancelledBooking = {
      id: 'booking-2',
      status: 'cancelled',
      user_id: 'user-2',
      partner_organization_id: 'partner-2',
      total_amount: 70000,
      currency: 'UZS',
      payment_method: 'click',
    };
    pg.query
      .mockResolvedValueOnce([]) // no plain expired bookings
      .mockResolvedValueOnce([cancelledBooking]) // awaiting_partner_confirmation timeout -> cancelled
      .mockResolvedValueOnce([]) // addStatusHistory for the auto-cancel
      .mockResolvedValueOnce([
        { id: 'payment-1', amount: 70000, currency: 'UZS' },
      ]) // SELECT paid payment for this booking
      .mockResolvedValueOnce([]); // INSERT refunds

    await service.expireStaleBookings();

    expect(events.bookingStatusChanged).toHaveBeenCalledWith(cancelledBooking);
    expect(events.adminDashboardUpdated).toHaveBeenCalled();

    const refundCall = pg.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO refunds'),
    );
    expect(refundCall).toBeDefined();
    expect(refundCall?.[1]).toEqual([
      expect.any(String),
      'booking-2',
      'user-2',
      'UZS',
      70000,
      expect.any(String),
      expect.any(String),
    ]);
  });

  it('xatolik yuz bersa jim qoladi (cron keyingi daqiqada qayta urinadi, ilova qulamaydi)', async () => {
    pg.transaction.mockRejectedValueOnce(new Error('DB down'));

    await expect(service.expireStaleBookings()).resolves.toBeUndefined();
  });
});

describe('BookingsService — Idempotency-Key (PHASE 14G security fix)', () => {
  let service: BookingsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>> & {
    transaction: jest.Mock;
  };
  let events: {
    bookingStatusChanged: jest.Mock;
    partnerDashboardUpdated: jest.Mock;
    adminDashboardUpdated: jest.Mock;
  };
  let promos: jest.Mocked<Pick<PromosService, 'validate' | 'redeem'>>;

  const hotelRow = {
    id: 'hotel-1',
    partner_organization_id: 'partner-1',
    partner_type: 'hotel',
    commission_rate: 12,
    check_in_time: null,
    check_out_time: null,
  };

  const actor = {
    id: 'user-1',
    actorType: 'user' as const,
    role: Role.USER,
    roles: [Role.USER],
  };

  const dto = {
    hotel_id: 'hotel-1',
    room_id: 'room-1',
    check_in: '2026-08-10',
    check_out: '2026-08-12',
    rooms: 1,
    guests: 2,
    agree_terms: true,
  };

  /**
   * `AppCacheService`ning HAQIQIY Map-asoslangan minigan versiyasi — 8 ta
   * boshqa describe blokidagi `noopCacheService()`dan farqli o'laroq, bu
   * yerda `getOrSet` chindan MEMOIZATSIYA qiladi (birinchi chaqiruv
   * natijasini saqlaydi, ikkinchisida qayta hisoblamaydi) — aynan
   * production'dagi `AppCacheService.getOrSet()` bilan bir xil shartnoma.
   */
  function fakeCacheService(): Record<string, jest.Mock> {
    const store = new Map<string, unknown>();
    return {
      get: jest.fn((key: string) => Promise.resolve(store.get(key))),
      set: jest.fn((key: string, value: unknown) => {
        store.set(key, value);
        return Promise.resolve(true);
      }),
      getOrSet: jest.fn(
        async (key: string, _ttl: number, producer: () => unknown) => {
          if (store.has(key)) return store.get(key);
          const value = await producer();
          store.set(key, value);
          return value;
        },
      ),
    };
  }

  function queueSuccessfulHotelBookingResponses() {
    pg.query
      .mockResolvedValueOnce([hotelRow]) // hotel lookup
      .mockResolvedValueOnce([
        {
          id: 'room-1',
          hotel_id: 'hotel-1',
          base_price: '100000',
          total_inventory: 5,
        },
      ]) // room lookup (FOR UPDATE)
      .mockResolvedValueOnce([{ booked_count: 0 }]) // sana-ziddiyat tekshiruvi
      .mockResolvedValueOnce([{ blocked_count: 0 }]) // room_inventory bloklanmagan
      .mockResolvedValueOnce([]) // INSERT bookings
      .mockResolvedValueOnce([]) // INSERT audit_logs (terms_accepted)
      .mockResolvedValueOnce([]) // INSERT booking_status_history
      .mockResolvedValueOnce([]) // SELECT existing pending payment
      .mockResolvedValueOnce([]); // INSERT payments
  }

  beforeEach(() => {
    pg = {
      query: jest.fn(),
      transaction: jest.fn((operation: (tx: unknown) => unknown) =>
        Promise.resolve(operation({ query: pg.query })),
      ),
    };
    events = {
      bookingStatusChanged: jest.fn(),
      partnerDashboardUpdated: jest.fn(),
      adminDashboardUpdated: jest.fn(),
    };
    promos = noopPromosService();
    service = new BookingsService(
      pg as unknown as PostgresService,
      events as unknown as EventsService,
      { send: jest.fn() } as unknown as EmailService,
      promos as unknown as PromosService,
      {
        buildCheckoutUrl: jest.fn().mockReturnValue(null),
      } as unknown as PaymentsService,
      fakeCacheService() as unknown as AppCacheService,
    );
  });

  it('SAME key + SAME request body → duplicate booking yaratilmaydi (bitta transaction, ikkinchi chaqiruv keshdan qaytadi)', async () => {
    queueSuccessfulHotelBookingResponses();

    const first = await service.createHotel(actor, dto, 'idem-key-1');
    const second = await service.createHotel(actor, dto, 'idem-key-1');

    expect(second).toBe(first); // aynan bir xil (keshlangan) natija obyekti
    expect(pg.transaction).toHaveBeenCalledTimes(1); // faqat BITTA marta haqiqiy yaratish
  });

  it('SAME key + BOSHQA request body → 409 CONFLICT (rad etiladi, yaratilmaydi)', async () => {
    queueSuccessfulHotelBookingResponses();

    await service.createHotel(actor, dto, 'idem-key-2');

    await expect(
      service.createHotel(
        actor,
        { ...dto, rooms: 2 }, // boshqa so'rov tanasi
        'idem-key-2',
      ),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
    expect(pg.transaction).toHaveBeenCalledTimes(1); // ikkinchi urinish yaratishga yetib bormadi
  });

  it("BOSHQA user'ning bir xil kaliti to'qnashmaydi (alohida scope)", async () => {
    queueSuccessfulHotelBookingResponses();
    queueSuccessfulHotelBookingResponses();

    await service.createHotel(actor, dto, 'shared-key');
    await service.createHotel({ ...actor, id: 'user-2' }, dto, 'shared-key');

    expect(pg.transaction).toHaveBeenCalledTimes(2); // ikkalasi ham HAQIQIY yaratildi
  });

  it("Idempotency-Key header YO'Q bo'lsa — eskicha ishlaydi (orqaga qarab moslashuvchan)", async () => {
    queueSuccessfulHotelBookingResponses();
    queueSuccessfulHotelBookingResponses();

    await service.createHotel(actor, dto, undefined);
    await service.createHotel(actor, dto, undefined);

    expect(pg.transaction).toHaveBeenCalledTimes(2); // key yo'q — har doim yangi yaratiladi
  });
});

describe('BookingsService — booking confirmation email uses an active CMS template when one exists (audit: template edits never reached real sends)', () => {
  let service: BookingsService;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>> & {
    transaction: jest.Mock;
  };
  let email: jest.Mocked<Pick<EmailService, 'send'>>;

  beforeEach(() => {
    pg = {
      query: jest.fn(),
      transaction: jest.fn(),
    };
    email = {
      send: jest
        .fn()
        .mockResolvedValue({ providerMessageId: '', accepted: true }),
    };
    service = new BookingsService(
      pg as unknown as PostgresService,
      {
        bookingStatusChanged: jest.fn(),
        partnerDashboardUpdated: jest.fn(),
        adminDashboardUpdated: jest.fn(),
      } as unknown as EventsService,
      email as unknown as EmailService,
      noopPromosService() as unknown as PromosService,
      {
        buildCheckoutUrl: jest.fn().mockReturnValue(null),
      } as unknown as PaymentsService,
      noopCacheService() as unknown as AppCacheService,
    );
  });

  const booking = {
    id: 'booking-1',
    booking_number: 'SAF-1001',
    guest_name: 'Laziz',
    guest_email: 'laziz@example.com',
    total_amount: 500000,
    currency: 'UZS',
  };

  it('uses the CMS template body/subject with {variables} substituted when an active booking_confirmation_email template exists', async () => {
    pg.query.mockResolvedValueOnce([
      {
        body: {
          uz: "Salom {guestName}, bron {bookingNumber} uchun {totalAmount} {currency} to'landi.",
        },
        metadata: {
          code: 'booking_confirmation_email',
          subject: 'Bron #{bookingNumber} tasdiqlandi',
        },
      },
    ]);

    await (
      service as unknown as {
        sendBookingConfirmationEmail: (b: typeof booking) => Promise<void>;
      }
    ).sendBookingConfirmationEmail(booking);

    expect(pg.query.mock.calls[0]?.[0]).toContain("type = 'template'");
    expect(pg.query.mock.calls[0]?.[1]).toEqual(['booking_confirmation_email']);
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'laziz@example.com',
        subject: 'Bron #SAF-1001 tasdiqlandi',
        text: "Salom Laziz, bron SAF-1001 uchun 500000 UZS to'landi.",
      }),
    );
  });

  it("falls back to the hardcoded message when no active template exists (xulq-atvor o'zgarmaydi)", async () => {
    pg.query.mockResolvedValueOnce([]);

    await (
      service as unknown as {
        sendBookingConfirmationEmail: (b: typeof booking) => Promise<void>;
      }
    ).sendBookingConfirmationEmail(booking);

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'laziz@example.com',
        subject: 'Safaar — bron tasdiqlandi (SAF-1001)',
      }),
    );
    const sentText = (email.send.mock.calls[0]?.[0] as { text: string }).text;
    expect(sentText).toContain('Broningiz qabul qilindi');
  });

  it('falls back safely if the template lookup query itself throws', async () => {
    pg.query.mockRejectedValueOnce(new Error('db down'));

    await (
      service as unknown as {
        sendBookingConfirmationEmail: (b: typeof booking) => Promise<void>;
      }
    ).sendBookingConfirmationEmail(booking);

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Safaar — bron tasdiqlandi (SAF-1001)',
      }),
    );
  });
});
