import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import type { GuestBookingAccessService } from '../common/guest-booking-access.service';
import {
  PostgresService,
  type PostgresTransaction,
} from '../infrastructure/postgres.service';
import { PaymentsService } from './payments.service';

/**
 * Mahsulot talabi (2026-09-16): guest (login qilmagan) booking uchun
 * xavfsiz, booking-specific (unguessable, expiring) token bilan to'lov
 * yaratish/holatini tekshirish. Token mexanizmi allaqachon mavjud
 * (`common/guest-booking-access.service.ts`, `bookings.service.ts`dagi
 * bilan BIR XIL) — bu yerda faqat `PaymentsService`ning uni to'g'ri
 * ishlatishi tekshiriladi.
 */

const guestBooking = {
  id: 'booking-guest-1',
  booking_number: 'UZB-GUEST01',
  user_id: null,
  partner_organization_id: 'partner-1',
  total_amount: 500_000,
  currency: 'UZS',
};

const ownedBooking = {
  id: 'booking-owned-1',
  booking_number: 'UZB-OWNED01',
  user_id: 'user-owner',
  partner_organization_id: 'partner-1',
  total_amount: 500_000,
  currency: 'UZS',
};

function makeService() {
  const pg = { query: jest.fn(), transaction: jest.fn() };
  const guestAccess = { issue: jest.fn(), resolve: jest.fn() };
  const service = new PaymentsService(
    pg as unknown as PostgresService,
    { get: jest.fn() } as never,
    { isConfigured: () => false } as never,
    { isConfigured: () => false } as never,
    { isConfigured: () => false } as never,
    { isConfigured: () => false } as never,
    guestAccess as unknown as GuestBookingAccessService,
  );
  return { pg, guestAccess, service };
}

describe('PaymentsService — guest to‘lov (bookingga bog‘langan, unguessable, expiring token)', () => {
  it('to‘g‘ri guest token + o‘ziga tegishli (user_id=NULL) bron -> GET /payments ruxsat beriladi', async () => {
    const { pg, guestAccess, service } = makeService();
    guestAccess.resolve.mockResolvedValue('booking-guest-1');
    pg.query
      .mockResolvedValueOnce([guestBooking])
      .mockResolvedValueOnce([{ id: 'payment-1', booking_id: 'booking-guest-1', provider: 'humo' }]);

    const result = await service.payment(
      undefined,
      'booking-guest-1',
      'real-guest-token',
    );

    expect(guestAccess.resolve).toHaveBeenCalledWith('real-guest-token');
    expect(result.id).toBe('payment-1');
  });

  it('to‘g‘ri guest token bilan to‘lov YARATISH ham ishlaydi (fee-siz provider, masalan cash)', async () => {
    const { pg, guestAccess, service } = makeService();
    guestAccess.resolve.mockResolvedValue('booking-guest-1');
    pg.query
      .mockResolvedValueOnce([guestBooking]) // assertBookingVisible
      .mockResolvedValueOnce([]) // no existing open payment
      .mockResolvedValueOnce([]); // INSERT payments

    const result = await service.createPayment(
      undefined,
      'booking-guest-1',
      { provider: 'cash' },
      'real-guest-token',
    );

    expect(result).toMatchObject({ provider: 'cash', status: 'awaiting_cash' });
  });

  it('token BOSHQA bookingga tegishli bo‘lsa (wrong booking) -> 401, ruxsat berilmaydi', async () => {
    const { pg, guestAccess, service } = makeService();
    // Token haqiqiy/mavjud, lekin BOSHQA bron uchun berilgan.
    guestAccess.resolve.mockResolvedValue('some-other-booking-id');
    pg.query.mockResolvedValueOnce([guestBooking]);

    await expect(
      service.payment(undefined, 'booking-guest-1', 'token-for-another-booking'),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('noto‘g‘ri/mavjud bo‘lmagan token -> 401', async () => {
    const { pg, guestAccess, service } = makeService();
    guestAccess.resolve.mockResolvedValue(undefined);
    pg.query.mockResolvedValueOnce([guestBooking]);

    await expect(
      service.payment(undefined, 'booking-guest-1', 'wrong-token'),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("muddati tugagan token -> resolve() undefined qaytaradi (cache TTL o'tgan) -> 401", async () => {
    const { pg, guestAccess, service } = makeService();
    guestAccess.resolve.mockResolvedValue(undefined); // TTL o'tgan cache miss
    pg.query.mockResolvedValueOnce([guestBooking]);

    await expect(
      service.payment(undefined, 'booking-guest-1', 'expired-token'),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('token umuman berilmagan (no token) -> 401, guestAccess.resolve() chaqirilmaydi', async () => {
    const { pg, guestAccess, service } = makeService();
    pg.query.mockResolvedValueOnce([guestBooking]);

    await expect(
      service.payment(undefined, 'booking-guest-1'),
    ).rejects.toMatchObject({ status: 401 });
    expect(guestAccess.resolve).not.toHaveBeenCalled();
  });

  it("bron ALLAQACHON haqiqiy foydalanuvchiga tegishli (user_id mavjud) bo'lsa — guest token berilgan bo'lsa ham rad etiladi (guest yo'li faqat user_id=NULL uchun)", async () => {
    const { pg, guestAccess, service } = makeService();
    guestAccess.resolve.mockResolvedValue('booking-owned-1');
    pg.query.mockResolvedValueOnce([ownedBooking]);

    await expect(
      service.payment(undefined, 'booking-owned-1', 'some-token'),
    ).rejects.toMatchObject({ status: 401 });
    // `booking.user_id` mavjud bo'lgani uchun `guestAccess.resolve()`
    // umuman chaqirilmasligi kerak (qisqa tutashuv — user_id NULL emas).
    expect(guestAccess.resolve).not.toHaveBeenCalled();
  });

  it("guestAccess servis DI orqali berilmagan (masalan eski test) bo'lsa — guest yo'li shunchaki hech qachon mos kelmaydi, avvalgi (auth majburiy) xatti-harakat saqlanadi", async () => {
    const pg = { query: jest.fn(), transaction: jest.fn() };
    const service = new PaymentsService(
      pg as unknown as PostgresService,
      { get: jest.fn() } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      // guestAccess OMITTED — optional 7th param
    );
    pg.query.mockResolvedValueOnce([guestBooking]);

    await expect(
      service.payment(undefined, 'booking-guest-1', 'any-token'),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('login qilgan foydalanuvchi (actor mavjud) — guest token yo‘lidan MUSTAQIL, avvalgidek ishlaydi (izolyatsiya)', async () => {
    const { pg, guestAccess, service } = makeService();
    const owner: RequestActor = {
      id: 'user-owner',
      actorType: 'user',
      role: Role.USER,
      roles: [Role.USER],
    };
    pg.query
      .mockResolvedValueOnce([ownedBooking])
      .mockResolvedValueOnce([{ id: 'payment-owned', booking_id: 'booking-owned-1' }]);

    const result = await service.payment(owner, 'booking-owned-1');

    expect(result.id).toBe('payment-owned');
    // Actor mavjud bo'lgani uchun guest-token yo'li umuman ko'rib
    // chiqilmaydi.
    expect(guestAccess.resolve).not.toHaveBeenCalled();
  });

  it('boshqa foydalanuvchining broni uchun guest token berilsa ham (booking user_id!=null) — 401ga qaytadi, boshqa user/session ma’lumotiga access berilmaydi', async () => {
    const { pg, guestAccess, service } = makeService();
    pg.query.mockResolvedValueOnce([ownedBooking]);

    await expect(
      service.createPayment(
        undefined,
        'booking-owned-1',
        { provider: 'humo' },
        'some-guest-token',
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(guestAccess.resolve).not.toHaveBeenCalled();
  });
});
