import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '@safaar/types';
import { hashSecret } from '../auth/security';
import { otpStore } from '../auth/otp-store';
import type { RequestActor } from '../common/actor';
import type { AppCacheService } from '../infrastructure/cache.service';
import { EmailService } from '../infrastructure/email.service';
import { JobQueueService } from '../infrastructure/job-queue.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { SmsService } from '../infrastructure/sms.service';
import { PaymentsService } from '../payments/payments.service';
import { PromosService } from '../promos/promos.service';
import { EventsService } from '../realtime/events.service';
import { BookingsService } from './bookings.service';
import { PartnersService } from '../partners/partners.service';

const testActor: RequestActor = {
  id: 'a0000000-0000-0000-0000-000000000001',
  actorType: 'user',
  role: Role.USER,
  roles: [Role.USER],
};

const partnerActor: RequestActor = {
  id: 'partner-user-1',
  actorType: 'partner',
  role: Role.PARTNER,
  roles: [Role.PARTNER],
  organizationId: 'partner-org-1',
  sessionId: 'session-1',
};

function makeBookingsService(opts?: { smsService?: SmsService }) {
  const pg = {
    query: jest.fn().mockResolvedValue([]),
    transaction: jest.fn((op: (tx: { query: jest.Mock }) => unknown) =>
      op({ query: pg.query }),
    ),
  };

  const events = {
    bookingStatusChanged: jest.fn(),
    partnerDashboardUpdated: jest.fn(),
    adminDashboardUpdated: jest.fn(),
  };

  const emailService = {
    send: jest.fn().mockResolvedValue({ accepted: true }),
  };

  const promosService = {
    validate: jest.fn().mockResolvedValue({ valid: false }),
    redeem: jest.fn().mockResolvedValue(true),
  };

  const paymentsService = {
    buildCheckoutUrl: jest.fn().mockReturnValue(null),
  };

  const cache = {
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    getOrSet: jest.fn((_k: string, _ttl: number, producer: () => unknown) =>
      producer(),
    ),
  };

  const service = new BookingsService(
    pg,
    events as unknown as EventsService,
    emailService as unknown as EmailService,
    promosService as unknown as PromosService,
    paymentsService as unknown as PaymentsService,
    cache as unknown as AppCacheService,
    opts?.smsService,
  );

  return { service, pg, events, emailService, cache };
}

describe('Naqd to‘lov (Cash payment) va No-Show 60 kunlik jarima tizimi', () => {
  beforeEach(() => {
    otpStore.resetForTests();
    delete process.env.ENABLE_DEMO_AUTH;
    delete process.env.DEMO_AUTH_ALLOWED_PHONES;
    delete process.env.ENFORCE_CASH_OTP;
  });

  describe('1. assertUserNotBlockedFromBooking', () => {
    it('bloklanmagan foydalanuvchi tekshiruvdan muvaffaqiyatli o‘tadi', async () => {
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValueOnce([]); // users tekshiruvi: bo'sh
      pg.query.mockResolvedValueOnce([]); // booking_penalties tekshiruvi: bo'sh

      await expect(
        service.assertUserNotBlockedFromBooking(testActor, '+998901234567'),
      ).resolves.toBeUndefined();
    });

    it('users jadvalida kelgusi booking_blocked_until bo‘lsa, 403 USER_BOOKING_BLOCKED tashlaydi', async () => {
      const { service, pg } = makeBookingsService();
      const blockedUntil = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      pg.query.mockResolvedValueOnce([
        {
          id: testActor.id,
          booking_blocked_until: blockedUntil,
          booking_blocked_reason: 'no_show',
        },
      ]);

      await expect(
        service.assertUserNotBlockedFromBooking(testActor, '+998901234567'),
      ).rejects.toThrow(ForbiddenException);

      try {
        pg.query.mockResolvedValueOnce([
          {
            id: testActor.id,
            booking_blocked_until: blockedUntil,
            booking_blocked_reason: 'no_show',
          },
        ]);
        await service.assertUserNotBlockedFromBooking(
          testActor,
          '+998901234567',
        );
      } catch (err: unknown) {
        const error = err as ForbiddenException;
        const res = error.getResponse() as Record<string, unknown>;
        expect(res.code).toBe('USER_BOOKING_BLOCKED');
        expect(res.blocked_until).toBe(blockedUntil);
        expect(res.reason).toBe('no_show');
      }
    });

    it('booking_penalties jadvalida faol jarima bo‘lsa, 403 USER_BOOKING_BLOCKED tashlaydi', async () => {
      const { service, pg } = makeBookingsService();
      const blockedUntil = new Date(
        Date.now() + 45 * 24 * 60 * 60 * 1000,
      ).toISOString();
      pg.query
        .mockResolvedValueOnce([]) // users jadvalida yo'q
        .mockResolvedValueOnce([
          {
            blocked_until: blockedUntil,
            reason: 'no_show',
          },
        ]); // penalties da bor

      await expect(
        service.assertUserNotBlockedFromBooking(undefined, '+998901234567'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('booking_penalties so‘rovi xatoga uchrasa (masalan jadval hali yo‘q bo‘lsa), xavfsiz davom etadi', async () => {
      const { service, pg } = makeBookingsService();
      pg.query
        .mockResolvedValueOnce([]) // users jadvalida blok yo'q
        .mockRejectedValueOnce(
          new Error('relation "booking_penalties" does not exist'),
        );

      await expect(
        service.assertUserNotBlockedFromBooking(testActor, '+998901234567'),
      ).resolves.toBeUndefined();
    });
  });

  describe('2. sendCashBookingOtp', () => {
    it('noto‘g‘ri telefon raqami formatida 400 INVALID_PHONE beradi', async () => {
      const { service } = makeBookingsService();

      await expect(
        service.sendCashBookingOtp(testActor, '12345'),
      ).rejects.toThrow(BadRequestException);
    });

    it('bloklangan foydalanuvchiga SMS jo‘natilmaydi (USER_BOOKING_BLOCKED)', async () => {
      const { service, pg } = makeBookingsService();
      const blockedUntil = new Date(
        Date.now() + 10 * 24 * 60 * 60 * 1000,
      ).toISOString();
      pg.query.mockResolvedValueOnce([
        {
          id: testActor.id,
          booking_blocked_until: blockedUntil,
          booking_blocked_reason: 'no_show',
        },
      ]);

      await expect(
        service.sendCashBookingOtp(testActor, '+998901234567'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('demo rejimda yoki demo telefonda dev_code bilan qaytadi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValueOnce([]); // users
      pg.query.mockResolvedValueOnce([]); // penalties

      const res = await service.sendCashBookingOtp(testActor, '+998901234567');
      expect(res.challenge_id).toBeDefined();
      expect(res.phone).toBe('+998901234567');
      expect(res.dev_code).toMatch(/^\d{6}$/);
    });

    it('smsService mavjud bo‘lganda SMS yuboradi', async () => {
      const smsSendMock = jest
        .fn()
        .mockResolvedValue({ accepted: true, providerMessageId: 'sms-1' });
      const mockSmsService = { send: smsSendMock } as unknown as SmsService;

      const { service, pg } = makeBookingsService({
        smsService: mockSmsService,
      });
      pg.query.mockResolvedValueOnce([]); // users
      pg.query.mockResolvedValueOnce([]); // penalties

      const res = await service.sendCashBookingOtp(testActor, '+998901234567');
      expect(res.challenge_id).toBeDefined();
      expect(res.dev_code).toBeUndefined(); // production/real rejimda dev_code qaytmaydi
      expect(smsSendMock).toHaveBeenCalledTimes(1);
      expect(smsSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+998901234567',
          text: expect.stringContaining(
            "Safaar: Naqd to'lovli bronni tasdiqlash kodi:",
          ),
        }),
      );
    });

    it('SMS provayder xatoga uchrasa yoki accepted: false bo‘lsa, 503 SMS_DELIVERY_FAILED beradi', async () => {
      const smsSendMock = jest.fn().mockResolvedValue({ accepted: false });
      const mockSmsService = { send: smsSendMock } as unknown as SmsService;

      const { service, pg } = makeBookingsService({
        smsService: mockSmsService,
      });
      pg.query.mockResolvedValueOnce([]);
      pg.query.mockResolvedValueOnce([]);

      await expect(
        service.sendCashBookingOtp(testActor, '+998901234567'),
      ).rejects.toThrow();
    });

    it('ketma-ket tez yuborilganda cooldown (OTP_RESEND_TOO_SOON) xatosi beradi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValue([]);

      await service.sendCashBookingOtp(testActor, '+998901234567');

      await expect(
        service.sendCashBookingOtp(testActor, '+998901234567'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. verifyCashBookingOtp', () => {
    it('to‘g‘ri kod bilan muvaffaqiyatli tasdiqlanadi va kod sarflanadi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValue([]);

      const sent = await service.sendCashBookingOtp(testActor, '+998901234567');
      const code = sent.dev_code!;

      expect(() =>
        service.verifyCashBookingOtp('+998901234567', code, sent.challenge_id),
      ).not.toThrow();

      // Bir marta sarflangandan so'ng ikkinchi marta ishlatib bo'lmaydi
      expect(() =>
        service.verifyCashBookingOtp('+998901234567', code, sent.challenge_id),
      ).toThrow(BadRequestException);
    });

    it('noto‘g‘ri kod berilganda OTP_INVALID beradi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValue([]);

      const sent = await service.sendCashBookingOtp(testActor, '+998901234567');

      expect(() =>
        service.verifyCashBookingOtp(
          '+998901234567',
          '000000',
          sent.challenge_id,
        ),
      ).toThrow(BadRequestException);
    });

    it('bo‘sh kod berilganda OTP_REQUIRED beradi', () => {
      const { service } = makeBookingsService();
      expect(() => service.verifyCashBookingOtp('+998901234567', '')).toThrow(
        BadRequestException,
      );
    });

    it('noto‘g‘ri telefon berilganda INVALID_PHONE beradi', () => {
      const { service } = makeBookingsService();
      expect(() => service.verifyCashBookingOtp('123', '123456')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('4. sendCashOtpForBooking & confirmCashBooking', () => {
    const bookingRow = {
      id: 'b0000000-0000-0000-0000-000000000001',
      user_id: testActor.id,
      guest_phone: '+998901234567',
      status: 'pending',
      partner_organization_id: 'partner-org-1',
      total_amount: 500000,
      currency: 'UZS',
      payment_method: 'cash',
      confirmation_mode: 'instant',
    };

    it('sendCashOtpForBooking: tasdiqlangan bron uchun qayta OTP yuborishni rad etadi (422)', async () => {
      const { service, pg } = makeBookingsService();
      // assertBooking query
      pg.query.mockResolvedValueOnce([{ ...bookingRow, status: 'confirmed' }]);

      await expect(
        service.sendCashOtpForBooking(testActor, bookingRow.id),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('sendCashOtpForBooking: pending bron uchun OTP yuboradi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      // 1. assertBooking
      pg.query.mockResolvedValueOnce([bookingRow]);
      // 2. assertUserNotBlockedFromBooking (users)
      pg.query.mockResolvedValueOnce([]);
      // 3. assertUserNotBlockedFromBooking (penalties)
      pg.query.mockResolvedValueOnce([]);

      const res = await service.sendCashOtpForBooking(testActor, bookingRow.id);
      expect(res.challenge_id).toBeDefined();
      expect(res.phone).toBe('+998901234567');
      expect(res.dev_code).toBeDefined();
    });

    it('confirmCashBooking: to‘g‘ri OTP kodi bilan bronni confirmed va to‘lovni awaiting_cash qiladi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      // 1. OTP yaratamiz
      pg.query.mockResolvedValueOnce([]); // users
      pg.query.mockResolvedValueOnce([]); // penalties
      const sent = await service.sendCashBookingOtp(testActor, '+998901234567');

      // 2. confirmCashBooking
      // assertBooking
      pg.query.mockResolvedValueOnce([bookingRow]);
      // assertUserNotBlockedFromBooking: users tekshiruvi
      pg.query.mockResolvedValueOnce([]);
      // assertUserNotBlockedFromBooking: penalties tekshiruvi
      pg.query.mockResolvedValueOnce([]);
      // tx queries:
      // UPDATE bookings ... RETURNING *
      const confirmedBooking = {
        ...bookingRow,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      };
      pg.query.mockResolvedValueOnce([confirmedBooking]);
      // SELECT id FROM payments WHERE booking_id = ...
      pg.query.mockResolvedValueOnce([{ id: 'payment-1' }]);
      // UPDATE payments SET provider = 'cash', status = 'awaiting_cash' ... RETURNING *
      const updatedPayment = {
        id: 'payment-1',
        provider: 'cash',
        status: 'awaiting_cash',
      };
      pg.query.mockResolvedValueOnce([updatedPayment]);
      // addStatusHistory INSERT
      pg.query.mockResolvedValueOnce([]);

      const result = await service.confirmCashBooking(
        testActor,
        bookingRow.id,
        {
          otp_code: sent.dev_code!,
          challenge_id: sent.challenge_id,
        },
      );

      expect(result.booking.status).toBe('confirmed');
      expect(result.payment?.status).toBe('awaiting_cash');
    });

    it('confirmCashBooking: bloklangan foydalanuvchi tasdiqlamoqchi bo‘lsa 403 beradi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      // assertBooking
      pg.query.mockResolvedValueOnce([bookingRow]);
      // assertUserNotBlockedFromBooking: users tekshiruvida bloklangan qator chiqadi
      pg.query.mockResolvedValueOnce([
        {
          id: testActor.id,
          booking_blocked_until: new Date(
            Date.now() + 60 * 24 * 3600 * 1000,
          ).toISOString(),
          booking_blocked_reason: 'no_show',
        },
      ]);

      await expect(
        service.confirmCashBooking(testActor, bookingRow.id, {
          otp_code: '123456',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('confirmCashBooking: request_confirmation bo‘lsa awaiting_partner_confirmation statusiga o‘tkazadi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValueOnce([]); // users
      pg.query.mockResolvedValueOnce([]); // penalties
      const sent = await service.sendCashBookingOtp(testActor, '+998901234567');

      // assertBooking with request_confirmation
      pg.query.mockResolvedValueOnce([
        { ...bookingRow, confirmation_mode: 'request_confirmation' },
      ]);
      // assertUserNotBlockedFromBooking: users tekshiruvi
      pg.query.mockResolvedValueOnce([]);
      // assertUserNotBlockedFromBooking: penalties tekshiruvi
      pg.query.mockResolvedValueOnce([]);
      // UPDATE bookings
      const awaitingBooking = {
        ...bookingRow,
        status: 'awaiting_partner_confirmation',
      };
      pg.query.mockResolvedValueOnce([awaitingBooking]);
      // payments query
      pg.query.mockResolvedValueOnce([]); // no existing payment
      // INSERT into payments
      pg.query.mockResolvedValueOnce([
        { id: 'payment-new', status: 'awaiting_cash' },
      ]);
      // addStatusHistory
      pg.query.mockResolvedValueOnce([]);

      const result = await service.confirmCashBooking(
        testActor,
        bookingRow.id,
        {
          otp_code: sent.dev_code!,
          challenge_id: sent.challenge_id,
        },
      );

      expect(result.booking.status).toBe('awaiting_partner_confirmation');
      expect(result.payment?.status).toBe('awaiting_cash');
    });

    it('sendCashBookingOtp: OTP ma‘lumotlarini 180 soniyalik (3 daqiqa) TTL bilan keshga saqlaydi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg, cache } = makeBookingsService();
      pg.query.mockResolvedValue([]);

      const sent = await service.sendCashBookingOtp(testActor, '+998901234567');
      expect(sent.challenge_id).toBeDefined();

      expect(cache.set).toHaveBeenCalledWith(
        'booking:cash-otp:phone:+998901234567',
        expect.objectContaining({
          phone: '+998901234567',
          challengeId: sent.challenge_id,
        }),
        180,
      );
      expect(cache.set).toHaveBeenCalledWith(
        `booking:cash-otp:challenge:${sent.challenge_id}`,
        expect.objectContaining({
          phone: '+998901234567',
          challengeId: sent.challenge_id,
        }),
        180,
      );
    });

    it('verifyAndConsumeCashBookingOtp: otpStore bo‘sh bo‘lsa (boshqa worker/process), Redis/keshdan tekshiradi va o‘chiradi', async () => {
      const { service, cache } = makeBookingsService();
      // otpStore'da challenge yo'q (boshqa process)
      const testPhone = '+998901234567';
      const testCode = '654321';
      // Pepper va xeshni hisoblaymiz
      const pepper = `${process.env.OTP_PEPPER ?? 'safaar-dev-otp-pepper'}:booking_cash_confirm:${testPhone}`;
      const codeHash = hashSecret(testCode, pepper);

      cache.get.mockResolvedValueOnce({
        challengeId: 'challenge-redis-1',
        phone: testPhone,
        codeHash,
        attempts: 0,
        expiresAt: Date.now() + 120_000,
      });

      await expect(
        service.verifyAndConsumeCashBookingOtp(
          testPhone,
          testCode,
          'challenge-redis-1',
        ),
      ).resolves.toBeUndefined();

      expect(cache.del).toHaveBeenCalledWith(
        'booking:cash-otp:phone:+998901234567',
      );
      expect(cache.del).toHaveBeenCalledWith(
        'booking:cash-otp:challenge:challenge-redis-1',
      );
    });

    it('verifyAndConsumeCashBookingOtp: keshdagi kod eskirgan bo‘lsa OTP_EXPIRED beradi', async () => {
      const { service, cache } = makeBookingsService();
      const testPhone = '+998901234567';

      cache.get.mockResolvedValueOnce({
        challengeId: 'challenge-expired',
        phone: testPhone,
        codeHash: 'hash',
        attempts: 0,
        expiresAt: Date.now() - 1000, // muddati o'tgan
      });

      await expect(
        service.verifyAndConsumeCashBookingOtp(
          testPhone,
          '111111',
          'challenge-expired',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4b. verifyCashOtp endpointi', () => {
    const guestBookingRow = {
      id: 'b0000000-0000-0000-0000-000000000099',
      user_id: null,
      guest_phone: '+998901234567',
      status: 'pending',
      partner_organization_id: 'partner-org-1',
      total_amount: 300000,
      currency: 'UZS',
      payment_method: 'cash',
      confirmation_mode: 'instant',
    };

    it('booking_id ko‘rsatilmaganda: telefonni tasdiqlab verification_token qaytaradi (10 daqiqalik TTL)', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg, cache } = makeBookingsService();
      pg.query.mockResolvedValue([]);

      const sent = await service.sendCashBookingOtp(undefined, '+998901234567');

      const result = await service.verifyCashOtp(undefined, {
        phone: '+998901234567',
        otp_code: sent.dev_code!,
        challenge_id: sent.challenge_id,
      });

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.verification_token).toBeDefined();
      expect(cache.set).toHaveBeenCalledWith(
        `booking:cash-verified:${result.verification_token}`,
        expect.objectContaining({ phone: '+998901234567' }),
        600,
      );
    });

    it('booking_id ko‘rsatilganda: bronni tasdiqlaydi, paymentni awaiting_cash qiladi va guestAccessToken qaytaradi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg, events } = makeBookingsService();

      // 1. Send OTP
      pg.query.mockResolvedValueOnce([]); // users
      pg.query.mockResolvedValueOnce([]); // penalties
      const sent = await service.sendCashBookingOtp(undefined, '+998901234567');

      // 2. verifyCashOtp with booking_id
      // assertUserNotBlockedFromBooking:
      pg.query.mockResolvedValueOnce([]); // users
      pg.query.mockResolvedValueOnce([]); // penalties
      // SELECT * FROM bookings WHERE id = ...
      pg.query.mockResolvedValueOnce([guestBookingRow]);
      // UPDATE bookings ... RETURNING *
      const confirmedBooking = {
        ...guestBookingRow,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      };
      pg.query.mockResolvedValueOnce([confirmedBooking]);
      // SELECT id FROM payments ...
      pg.query.mockResolvedValueOnce([]); // no existing payment
      // INSERT INTO payments ... RETURNING *
      pg.query.mockResolvedValueOnce([
        { id: 'p-new', status: 'awaiting_cash' },
      ]);
      // addStatusHistory
      pg.query.mockResolvedValueOnce([]);

      const result = await service.verifyCashOtp(undefined, {
        phone: '+998901234567',
        otp_code: sent.dev_code!,
        challenge_id: sent.challenge_id,
        booking_id: guestBookingRow.id,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('confirmed');
      expect(result.booking.status).toBe('confirmed');
      expect(result.guestAccessToken).toBeDefined();
      expect(events.bookingStatusChanged).toHaveBeenCalled();
    });

    it('booking_id bilan tasdiqlashda telefon raqami mos kelmasa 403 PHONE_MISMATCH beradi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValue([]);

      const sent = await service.sendCashBookingOtp(undefined, '+998901111111');

      // assertUserNotBlockedFromBooking:
      pg.query.mockResolvedValueOnce([]); // users
      pg.query.mockResolvedValueOnce([]); // penalties
      // SELECT booking returns booking with a DIFFERENT phone
      pg.query.mockResolvedValueOnce([
        {
          ...guestBookingRow,
          guest_phone: '+998909999999', // boshqa telefon
        },
      ]);

      await expect(
        service.verifyCashOtp(undefined, {
          phone: '+998901111111',
          otp_code: sent.dev_code!,
          challenge_id: sent.challenge_id,
          booking_id: guestBookingRow.id,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4c. Guest checkout va Naqd to‘lov OTP majburiyligi (createHotel)', () => {
    const hotelRow = {
      id: 'hotel-1',
      partner_organization_id: 'partner-org-1',
      commission_rate: 15,
      check_in_time: '14:00',
      check_out_time: '12:00',
      stars: 4,
      city_slug: 'samarkand',
      partner_type: 'hotel',
    };

    const roomRow = {
      id: 'room-1',
      hotel_id: 'hotel-1',
      base_price: 200000,
      total_inventory: 5,
      promotion_id: null,
      promotion_old_price: null,
      promotion_new_price: null,
      promotion_discount_percent: null,
      promotion_start_date: null,
      promotion_end_date: null,
    };

    it('login qilmagan mehmon telefon raqami bilan naqd to‘lovni tanlaganda OTP kiritilmasa 400 OTP_REQUIRED tashlaydi', async () => {
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValueOnce([hotelRow]);
      pg.query.mockResolvedValueOnce([roomRow]);

      await expect(
        service.createHotel(undefined, {
          hotel_id: 'hotel-1',
          room_id: 'room-1',
          check_in: '2026-10-10',
          check_out: '2026-10-12',
          payment_method: 'cash',
          phone: '+998907435006',
          guest_name: 'Laziz Shakarov',
          agree_terms: true,
        }),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.createHotel(undefined, {
          hotel_id: 'hotel-1',
          room_id: 'room-1',
          check_in: '2026-10-10',
          check_out: '2026-10-12',
          payment_method: 'cash',
          phone: '+998907435006',
          guest_name: 'Laziz Shakarov',
          agree_terms: true,
        });
      } catch (err) {
        const error = err as BadRequestException;
        const res = error.getResponse() as Record<string, unknown>;
        expect(res.code).toBe('OTP_REQUIRED');
      }
    });

    it('login qilmagan mehmon to‘g‘ri otp_code yuborganda bron yaratiladi va darhol confirmed bo‘ladi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      // 1. Send OTP
      pg.query.mockResolvedValueOnce([]); // users
      pg.query.mockResolvedValueOnce([]); // penalties
      const sent = await service.sendCashBookingOtp(undefined, '+998907435006');

      // 2. createHotel
      // SELECT hotels
      pg.query.mockResolvedValueOnce([hotelRow]);
      // tx:
      // SELECT rooms FOR UPDATE
      pg.query.mockResolvedValueOnce([roomRow]);
      // SELECT booked_count
      pg.query.mockResolvedValueOnce([{ booked_count: 0 }]);
      // SELECT closed dates
      pg.query.mockResolvedValueOnce([{ blocked_count: 0 }]);
      // INSERT bookings RETURNING *
      const createdBooking = {
        id: 'booking-cash-1',
        user_id: null,
        status: 'pending',
        partner_organization_id: 'partner-org-1',
        total_amount: 400000,
        currency: 'UZS',
        payment_method: 'cash',
        confirmation_mode: 'instant',
      };
      pg.query.mockResolvedValueOnce([createdBooking]);
      // addStatusHistory (created)
      pg.query.mockResolvedValueOnce([]);
      // createPayment: SELECT existing payment (none)
      pg.query.mockResolvedValueOnce([]);
      // createPayment: INSERT payments
      pg.query.mockResolvedValueOnce([
        { id: 'pay-1', status: 'awaiting_cash' },
      ]);
      // confirmCashBookingIfNeeded: UPDATE bookings
      pg.query.mockResolvedValueOnce([
        { ...createdBooking, status: 'confirmed' },
      ]);
      // confirmCashBookingIfNeeded: addStatusHistory (cash_booking_confirmed)
      pg.query.mockResolvedValueOnce([]);

      const result = await service.createHotel(undefined, {
        hotel_id: 'hotel-1',
        room_id: 'room-1',
        check_in: '2026-10-10',
        check_out: '2026-10-12',
        payment_method: 'cash',
        phone: '+998907435006',
        guest_name: 'Laziz Shakarov',
        agree_terms: true,
        otp_code: sent.dev_code!,
        challenge_id: sent.challenge_id,
      });

      expect(result.booking.status).toBe('confirmed');
      expect(result.payment?.status).toBe('awaiting_cash');
      expect(result.guestAccessToken).toBeDefined();
    });

    it('login qilmagan mehmon avval verify-otp orqali olgan verification_token bilan muvaffaqiyatli bron qiladi', async () => {
      const { service, pg, cache } = makeBookingsService();

      cache.get.mockImplementation((key: string) => {
        if (key === 'booking:cash-verified:valid-token-123') {
          return Promise.resolve({
            phone: '+998907435006',
            verified_at: new Date().toISOString(),
          });
        }
        return Promise.resolve(undefined);
      });

      pg.query.mockResolvedValueOnce([hotelRow]);
      pg.query.mockResolvedValueOnce([roomRow]);
      pg.query.mockResolvedValueOnce([{ booked_count: 0 }]);
      pg.query.mockResolvedValueOnce([{ blocked_count: 0 }]);
      const createdBooking = {
        id: 'booking-cash-2',
        user_id: null,
        status: 'pending',
        partner_organization_id: 'partner-org-1',
        total_amount: 400000,
        currency: 'UZS',
        payment_method: 'cash',
        confirmation_mode: 'instant',
      };
      pg.query.mockResolvedValueOnce([createdBooking]);
      pg.query.mockResolvedValueOnce([]);
      pg.query.mockResolvedValueOnce([]);
      pg.query.mockResolvedValueOnce([
        { id: 'pay-2', status: 'awaiting_cash' },
      ]);
      pg.query.mockResolvedValueOnce([
        { ...createdBooking, status: 'confirmed' },
      ]);
      pg.query.mockResolvedValueOnce([]);

      const result = await service.createHotel(undefined, {
        hotel_id: 'hotel-1',
        room_id: 'room-1',
        check_in: '2026-10-10',
        check_out: '2026-10-12',
        payment_method: 'cash',
        phone: '+998907435006',
        guest_name: 'Laziz Shakarov',
        agree_terms: true,
        verification_token: 'valid-token-123',
      });

      expect(result.booking.status).toBe('confirmed');
      expect(cache.del).toHaveBeenCalledWith(
        'booking:cash-verified:valid-token-123',
      );
    });

    it('yaroqsiz verification_token berilganda 400 OTP_TOKEN_INVALID tashlaydi', async () => {
      const { service, pg, cache } = makeBookingsService();
      cache.get.mockResolvedValue(undefined); // token topilmadi

      pg.query.mockResolvedValueOnce([hotelRow]);
      pg.query.mockResolvedValueOnce([roomRow]);

      await expect(
        service.createHotel(undefined, {
          hotel_id: 'hotel-1',
          room_id: 'room-1',
          check_in: '2026-10-10',
          check_out: '2026-10-12',
          payment_method: 'cash',
          phone: '+998907435006',
          guest_name: 'Laziz Shakarov',
          agree_terms: true,
          verification_token: 'invalid-or-expired-token',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. applyNoShowPenalty', () => {
    const bookingRow = {
      id: 'b0000000-0000-0000-0000-000000000001',
      user_id: testActor.id,
      guest_phone: '+998901234567',
      status: 'confirmed',
      partner_organization_id: 'partner-org-1',
      payment_method: 'cash',
    };

    it('mavjud bo‘lmagan bron uchun 404 BOOKING_NOT_FOUND beradi', async () => {
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValueOnce([]); // SELECT bookings WHERE id = ...

      await expect(
        service.applyNoShowPenalty('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('60 kunlik muddat hisoblaydi, bronni bekor qiladi va foydalanuvchini bloklaydi', async () => {
      const { service, pg } = makeBookingsService();
      // 1. SELECT bookings
      pg.query.mockResolvedValueOnce([bookingRow]);
      // tx queries:
      // 2. UPDATE bookings SET status = 'cancelled' ... RETURNING *
      pg.query.mockResolvedValueOnce([{ ...bookingRow, status: 'cancelled' }]);
      // 3. UPDATE trip_seats
      pg.query.mockResolvedValueOnce([]);
      // 4. UPDATE payments SET status = 'failed'
      pg.query.mockResolvedValueOnce([]);
      // 5. INSERT INTO booking_penalties
      pg.query.mockResolvedValueOnce([]);
      // 6. UPDATE users (user_id bo'yicha)
      pg.query.mockResolvedValueOnce([]);
      // 7. UPDATE users (phone bo'yicha)
      pg.query.mockResolvedValueOnce([]);
      // 8. INSERT INTO booking_status_history
      pg.query.mockResolvedValueOnce([]);

      const result = await service.applyNoShowPenalty(
        bookingRow.id,
        'Mijoz kelmadi',
        partnerActor,
      );

      expect(result.penalty_days).toBe(60);
      expect(result.reason).toBe('Mijoz kelmadi');
      expect(result.booking.status).toBe('cancelled');

      // blocked_until taxminan hozirdan 60 kun keyin bo'lishi kerak
      const blockedDate = new Date(result.blocked_until);
      const diffDays = Math.round(
        (blockedDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(60);

      // Status history tekshiruvi
      const statusHistoryCall = pg.query.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO booking_status_history'),
      );
      expect(statusHistoryCall).toBeDefined();
      expect(statusHistoryCall?.[1]?.[3]).toBe('no_show_penalty_applied');
    });

    it('boshqa hamkorning broniga no-show qo‘llashga uringanda 403 BOOKING_FORBIDDEN beradi', async () => {
      const { service, pg } = makeBookingsService();
      // booking partner_organization_id = 'partner-org-1'
      pg.query.mockResolvedValueOnce([bookingRow]);

      const otherPartnerActor: RequestActor = {
        id: 'partner-other',
        actorType: 'partner',
        role: Role.PARTNER,
        roles: [Role.PARTNER],
        organizationId: 'other-org-99',
      };

      await expect(
        service.applyNoShowPenalty(
          bookingRow.id,
          'Mijoz kelmadi',
          otherPartnerActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('oddiy foydalanuvchi no-show qo‘llashga uringanda 403 BOOKING_FORBIDDEN beradi', async () => {
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValueOnce([bookingRow]);

      await expect(
        service.applyNoShowPenalty(bookingRow.id, 'Mijoz kelmadi', testActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allaqachon bekor qilingan bronga no-show qo‘llashda 409 beradi', async () => {
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValueOnce([{ ...bookingRow, status: 'cancelled' }]);

      await expect(
        service.applyNoShowPenalty(
          bookingRow.id,
          'Mijoz kelmadi',
          partnerActor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('allaqachon yakunlangan (completed) bronga no-show qo‘llashda 409 beradi', async () => {
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValueOnce([{ ...bookingRow, status: 'completed' }]);

      await expect(
        service.applyNoShowPenalty(
          bookingRow.id,
          'Mijoz kelmadi',
          partnerActor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('6. processNoShowCashBookings (Cron)', () => {
    it('muddati o‘tgan naqd bronlarni topadi va har biriga applyNoShowPenalty qo‘llaydi', async () => {
      const { service, pg } = makeBookingsService();
      const staleBooking = {
        id: 'b0000000-0000-0000-0000-000000000001',
        user_id: testActor.id,
        guest_phone: '+998901234567',
        check_in: '2026-09-01',
        check_out: '2026-09-05',
        partner_organization_id: 'partner-org-1',
        status: 'confirmed',
        payment_method: 'cash',
      };

      // 1. Cron SELECT
      pg.query.mockResolvedValueOnce([staleBooking]);
      // applyNoShowPenalty:
      // 2. SELECT bookings
      pg.query.mockResolvedValueOnce([staleBooking]);
      // tx:
      // 3. UPDATE bookings
      pg.query.mockResolvedValueOnce([
        { ...staleBooking, status: 'cancelled' },
      ]);
      // 4. UPDATE trip_seats
      pg.query.mockResolvedValueOnce([]);
      // 5. INSERT INTO booking_penalties
      pg.query.mockResolvedValueOnce([]);
      // 6. UPDATE users by id
      pg.query.mockResolvedValueOnce([]);
      // 7. UPDATE users by phone
      pg.query.mockResolvedValueOnce([]);
      // 8. INSERT INTO booking_status_history
      pg.query.mockResolvedValueOnce([]);

      await service.processNoShowCashBookings();

      const cronQuery = pg.query.mock.calls[0][0];
      expect(cronQuery).toContain("b.payment_method = 'cash'");
      expect(cronQuery).toContain("p.status = 'awaiting_cash'");
    });
  });

  describe('7. unblockUserBooking (Admin)', () => {
    it('telefon bo‘yicha blokni yechadi', async () => {
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValue([]);

      const success = await service.unblockUserBooking('+998901234567');
      expect(success).toBe(true);

      const updateUsers = pg.query.mock.calls.find((call) =>
        String(call[0]).includes(
          'UPDATE users SET booking_blocked_until = NULL',
        ),
      );
      expect(updateUsers).toBeDefined();
      expect(updateUsers?.[1]?.[1]).toBe('+998901234567');
    });

    it('userId bo‘yicha blokni yechadi', async () => {
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValue([]);

      const success = await service.unblockUserBooking(testActor.id);
      expect(success).toBe(true);

      const updateUsers = pg.query.mock.calls.find((call) =>
        String(call[0]).includes('WHERE id = $2::uuid'),
      );
      expect(updateUsers).toBeDefined();
      expect(updateUsers?.[1]?.[1]).toBe(testActor.id);
    });

    it('bo‘sh yoki noto‘g‘ri target kiritilganda BadRequestException tashlaydi', async () => {
      const { service } = makeBookingsService();
      await expect(service.unblockUserBooking('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.unblockUserBooking('not-a-phone-or-uuid'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('8. PartnersService.markNoShow', () => {
    it('hamkor tomonidan no-show qayd etilganda 60 kunlik blok va bron bekor qilinadi', async () => {
      const pg = {
        query: jest.fn().mockResolvedValue([]),
        transaction: jest.fn((op: (tx: { query: jest.Mock }) => unknown) =>
          op({ query: pg.query }),
        ),
      };
      const jobQueue = { add: jest.fn() };
      const partnersService = new PartnersService(
        pg,
        jobQueue as unknown as JobQueueService,
      );

      const bookingRow = {
        id: 'b0000000-0000-0000-0000-000000000001',
        partner_organization_id: 'partner-org-1',
        user_id: testActor.id,
        guest_phone: '+998 (90) 123-45-67',
        status: 'confirmed',
      };

      // this.booking(actor, id) returns booking:
      pg.query.mockResolvedValueOnce([bookingRow]);
      // tx inside markNoShow:
      // UPDATE bookings
      pg.query.mockResolvedValueOnce([{ ...bookingRow, status: 'cancelled' }]);
      // UPDATE trip_seats
      pg.query.mockResolvedValueOnce([]);
      // UPDATE payments
      pg.query.mockResolvedValueOnce([]);
      // INSERT INTO booking_penalties
      pg.query.mockResolvedValueOnce([]);
      // UPDATE users by id
      pg.query.mockResolvedValueOnce([]);
      // UPDATE users by phone
      pg.query.mockResolvedValueOnce([]);
      // INSERT INTO booking_status_history
      pg.query.mockResolvedValueOnce([]);

      const result = await partnersService.markNoShow(
        partnerActor,
        bookingRow.id,
        { reason: 'Mijoz kelmadi' },
      );

      expect(result.booking.status).toBe('cancelled');
      expect(result.penalty_days).toBe(60);
      expect(result.reason).toBe('Mijoz kelmadi');
      const diffDays = Math.round(
        (new Date(result.blocked_until).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(60);

      // Telefon tozalangan bo'lishi kerak (+998901234567)
      const penaltyCall = pg.query.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO booking_penalties'),
      );
      expect(penaltyCall).toBeDefined();
      expect(penaltyCall?.[1]?.[2]).toBe('+998901234567');
    });

    it('allaqachon bekor qilingan yoki yakunlangan bronga no-show berilganda 409 tashlaydi', async () => {
      const pg = {
        query: jest.fn().mockResolvedValue([]),
        transaction: jest.fn(),
      };
      const partnersService = new PartnersService(
        pg as unknown as PostgresService,
        { add: jest.fn() } as unknown as JobQueueService,
      );

      pg.query.mockResolvedValueOnce([
        {
          id: 'b-1',
          status: 'cancelled',
          partner_organization_id: partnerActor.organizationId,
        },
      ]);
      await expect(
        partnersService.markNoShow(partnerActor, 'b-1'),
      ).rejects.toThrow(ConflictException);

      pg.query.mockResolvedValueOnce([
        {
          id: 'b-2',
          status: 'completed',
          partner_organization_id: partnerActor.organizationId,
        },
      ]);
      await expect(
        partnersService.markNoShow(partnerActor, 'b-2'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('7. Kengaytirilgan xavfsizlik va chekka holatlar (Reviewer regressions & edge cases)', () => {
    const hotelRow = {
      id: 'hotel-1',
      partner_organization_id: 'partner-1',
      partner_type: 'hotel',
      commission_rate: 12,
      check_in_time: null,
      check_out_time: null,
      city_slug: 'tashkent',
      stars: 4,
    };

    it('mehmon login qilmagan holda telefon raqamisiz (faqat email bilan) naqd to‘lov qilsa PHONE_REQUIRED xatosi qaytaradi', async () => {
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValueOnce([hotelRow]); // hotel

      await expect(
        service.createHotel(undefined, {
          hotel_id: 'hotel-1',
          agree_terms: true,
          guest_name: 'Test Guest',
          guest_email: 'guest@example.com',
          // telefon kiritilmagan
          room_id: 'room-1',
          check_in: '2026-08-10',
          check_out: '2026-08-12',
          payment_method: 'cash',
        }),
      ).rejects.toMatchObject({
        response: { code: 'PHONE_REQUIRED' },
      });
    });

    it('camelCase paymentMethod = cash yuborilganda ham OTP talab qilinadi', async () => {
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValueOnce([hotelRow]); // hotel

      await expect(
        service.createHotel(undefined, {
          hotel_id: 'hotel-1',
          agree_terms: true,
          guest_name: 'Test Guest',
          guest_phone: '+998901234567',
          guest_email: 'guest@example.com',
          room_id: 'room-1',
          check_in: '2026-08-10',
          check_out: '2026-08-12',
          paymentMethod: 'cash', // camelCase
        }),
      ).rejects.toMatchObject({
        response: { code: 'OTP_REQUIRED' },
      });
    });

    it('verifyCashOtp: booking_id topilmasa OTP kodi bekorga sarflanmaydi va to‘g‘ri booking_id bilan keyin ishlatiladi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValue([]);

      const sent = await service.sendCashBookingOtp(undefined, '+998901234567');

      // 1. Noto'g'ri booking_id berilganda
      pg.query.mockResolvedValueOnce([]); // users
      pg.query.mockResolvedValueOnce([]); // penalties
      pg.query.mockResolvedValueOnce([]); // bookings query returns empty

      await expect(
        service.verifyCashOtp(undefined, {
          phone: '+998901234567',
          otp_code: sent.dev_code!,
          challenge_id: sent.challenge_id,
          booking_id: 'b0000000-0000-0000-0000-000000000404',
        }),
      ).rejects.toMatchObject({
        response: { code: 'BOOKING_NOT_FOUND' },
      });

      // 2. To'g'ri booking_id bilan chaqirilganda OTP hali ham yaroqli bo'lishi kerak
      const validBooking = {
        id: 'b0000000-0000-0000-0000-000000000200',
        user_id: null,
        guest_phone: '+998901234567',
        status: 'pending',
        partner_organization_id: 'partner-org-1',
        total_amount: 500000,
        currency: 'UZS',
        payment_method: 'cash',
        confirmation_mode: 'instant',
      };
      pg.query.mockResolvedValueOnce([]); // users
      pg.query.mockResolvedValueOnce([]); // penalties
      pg.query.mockResolvedValueOnce([validBooking]); // SELECT bookings
      pg.query.mockResolvedValueOnce([
        { ...validBooking, status: 'confirmed' },
      ]); // UPDATE
      pg.query.mockResolvedValueOnce([]); // SELECT payments
      pg.query.mockResolvedValueOnce([
        { id: 'p-new', status: 'awaiting_cash' },
      ]); // INSERT payments
      pg.query.mockResolvedValueOnce([]); // addStatusHistory

      const retryResult = await service.verifyCashOtp(undefined, {
        phone: '+998901234567',
        otp_code: sent.dev_code!,
        challenge_id: sent.challenge_id,
        booking_id: validBooking.id,
      });

      expect(retryResult.success).toBe(true);
      expect(retryResult.status).toBe('confirmed');
    });

    it('verifyCashOtp: bekor qilingan yoki muddati o‘tgan bronni tasdiqlab bo‘lmaydi', async () => {
      process.env.ENABLE_DEMO_AUTH = 'true';
      const { service, pg } = makeBookingsService();
      pg.query.mockResolvedValue([]);

      const sent = await service.sendCashBookingOtp(undefined, '+998901234567');

      // Cancelled booking
      pg.query.mockResolvedValueOnce([]);
      pg.query.mockResolvedValueOnce([]);
      pg.query.mockResolvedValueOnce([
        {
          id: 'b-cancelled',
          user_id: null,
          guest_phone: '+998901234567',
          status: 'cancelled',
        },
      ]);

      await expect(
        service.verifyCashOtp(undefined, {
          phone: '+998901234567',
          otp_code: sent.dev_code!,
          challenge_id: sent.challenge_id,
          booking_id: 'b-cancelled',
        }),
      ).rejects.toMatchObject({
        response: { code: 'BOOKING_CANCELLED' },
      });

      // Expired booking
      pg.query.mockResolvedValueOnce([]);
      pg.query.mockResolvedValueOnce([]);
      pg.query.mockResolvedValueOnce([
        {
          id: 'b-expired',
          user_id: null,
          guest_phone: '+998901234567',
          status: 'expired',
        },
      ]);

      await expect(
        service.verifyCashOtp(undefined, {
          phone: '+998901234567',
          otp_code: sent.dev_code!,
          challenge_id: sent.challenge_id,
          booking_id: 'b-expired',
        }),
      ).rejects.toMatchObject({
        response: { code: 'BOOKING_EXPIRED' },
      });
    });

    it('confirmCashBooking: bekor qilingan yoki muddati o‘tgan bronni tasdiqlashda rad etadi', async () => {
      const { service, pg } = makeBookingsService();

      pg.query.mockResolvedValueOnce([
        {
          id: 'b-cancelled',
          user_id: testActor.id,
          status: 'cancelled',
        },
      ]);

      await expect(
        service.confirmCashBooking(testActor, 'b-cancelled', {
          otp_code: '123456',
        }),
      ).rejects.toMatchObject({
        response: { code: 'BOOKING_CANCELLED' },
      });
    });

    it('sendCashOtpForBooking: bekor qilingan yoki muddati o‘tgan bron uchun OTP yuborishni rad etadi', async () => {
      const { service, pg } = makeBookingsService();

      pg.query.mockResolvedValueOnce([
        {
          id: 'b-expired',
          user_id: testActor.id,
          status: 'expired',
        },
      ]);

      await expect(
        service.sendCashOtpForBooking(testActor, 'b-expired'),
      ).rejects.toMatchObject({
        response: { code: 'BOOKING_EXPIRED' },
      });
    });

    it('clearCashOtpFromCache: faqat telefon orqali tasdiqlanganda ham bog‘liq challengeId keshdan o‘chiriladi', async () => {
      const { service, cache } = makeBookingsService();
      const phone = '+998901234567';
      const challengeId = 'c-123';
      const code = '654321';
      const pepper = `${process.env.OTP_PEPPER ?? 'safaar-dev-otp-pepper'}:booking_cash_confirm:${phone}`;
      const codeHash = hashSecret(code, pepper);

      cache.get.mockImplementation((key: string) => {
        if (key === `booking:cash-otp:phone:${phone}`) {
          return Promise.resolve({
            challengeId,
            phone,
            codeHash,
            attempts: 0,
            expiresAt: Date.now() + 100000,
          });
        }
        return Promise.resolve(undefined);
      });

      await service.verifyAndConsumeCashBookingOtp(phone, code);

      expect(cache.del).toHaveBeenCalledWith(`booking:cash-otp:phone:${phone}`);
      expect(cache.del).toHaveBeenCalledWith(
        `booking:cash-otp:challenge:${challengeId}`,
      );
    });

    it('sendCashBookingOtp: SMS provayder rad etsa (accepted=false), OTP challenge va kesh tozalanadi', async () => {
      const failingSmsService = {
        send: jest.fn().mockResolvedValue({ accepted: false }),
      } as unknown as SmsService;

      const { service, pg, cache } = makeBookingsService({
        smsService: failingSmsService,
      });
      pg.query.mockResolvedValue([]);

      await expect(
        service.sendCashBookingOtp(undefined, '+998901234567'),
      ).rejects.toMatchObject({
        response: { code: 'SMS_DELIVERY_FAILED' },
      });

      expect(cache.del).toHaveBeenCalledWith(
        'booking:cash-otp:phone:+998901234567',
      );
      // resendGuard tozalanganini tekshirish uchun qayta so'rov OTP_RESEND_TOO_SOON tashlamasligi kerak
      await expect(
        service.sendCashBookingOtp(undefined, '+998901234567'),
      ).rejects.toMatchObject({
        response: { code: 'SMS_DELIVERY_FAILED' },
      });
    });

    it('verification_token bilan bron qilishda inventar xatosi yuz bersa, token o‘chirilmaydi va qayta ishlatiladi', async () => {
      const { service, pg, cache } = makeBookingsService();
      const phone = '+998901234567';
      const token = 'v-token-xyz';

      cache.get.mockResolvedValue({
        phone,
        verified_at: new Date().toISOString(),
      });

      // 1-urinish: room topilmadi (ROOM_NOT_AVAILABLE)
      pg.query.mockResolvedValueOnce([hotelRow]); // hotel
      pg.query.mockResolvedValueOnce([]); // no room

      await expect(
        service.createHotel(undefined, {
          hotel_id: 'hotel-1',
          agree_terms: true,
          guest_name: 'Test Guest',
          guest_phone: phone,
          verification_token: token,
          room_id: 'room-missing',
          check_in: '2026-08-10',
          check_out: '2026-08-12',
          payment_method: 'cash',
        }),
      ).rejects.toMatchObject({
        response: { code: 'ROOM_NOT_AVAILABLE' },
      });

      // Token hali del qilinmagan bo'lishi kerak!
      expect(cache.del).not.toHaveBeenCalledWith(
        `booking:cash-verified:${token}`,
      );
    });
  });
});
