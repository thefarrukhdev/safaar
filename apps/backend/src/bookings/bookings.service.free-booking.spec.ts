import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import type { AppCacheService } from '../infrastructure/cache.service';
import { EmailService } from '../infrastructure/email.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { PromosService } from '../promos/promos.service';
import { EventsService } from '../realtime/events.service';
import { PaymentsService } from '../payments/payments.service';
import { BookingsService } from './bookings.service';

/**
 * D1 REGRESSION — 0 UZS (BEPUL) bron jim `expired` bo'lib ketardi.
 *
 * Mahsulot qarori (2026-09-20, tasdiqlangan):
 *   - PD-1: restoran rezervatsiyasi BEPUL — bu ataylab, xato emas;
 *   - PD-2: 0 UZS bron uchun `payments` qatori UMUMAN yaratilmaydi;
 *   - PD-3: `partner_ledger_entries` yozuvi ham YARATILMAYDI.
 *
 * Fixdan OLDINGI xatti-harakat: 0 so'mlik bron `pending` + `expires_at =
 * now + 15 daq` bilan yaratilar, 0 so'mlik "pending" to'lov qoralamasi
 * hech qachon `paid` bo'lmasdi, va `expireStaleBookings()` croni bronni
 * `expired` qilib qo'yardi — mijoz ham, hamkor ham ko'rgan rezervatsiya
 * 15 daqiqadan keyin YO'QOLARDI.
 */

type QueryCall = [sql: string, params?: readonly unknown[]];
const queryCallsOf = (m: jest.Mock): QueryCall[] => m.mock.calls as QueryCall[];
const findCall = (m: jest.Mock, needle: string): QueryCall | undefined =>
  queryCallsOf(m).find(([sql]) => String(sql).includes(needle));
const findCalls = (m: jest.Mock, needle: string): QueryCall[] =>
  queryCallsOf(m).filter(([sql]) => String(sql).includes(needle));

const owner: RequestActor = {
  id: 'user-owner',
  actorType: 'user',
  role: Role.USER,
  roles: [Role.USER],
};

const restaurantRow = {
  id: 'hotel-1',
  partner_organization_id: 'partner-1',
  partner_type: 'restaurant',
  commission_rate: 10,
  check_in_time: null,
  check_out_time: null,
  // Restoran ish vaqti — slot tekshiruvi uchun.
  opening_time: '09:00',
  closing_time: '23:00',
};

/** BEPUL restoran stoli — `base_price = 0` (partner API `requiredNonNegativeNumber`, 0 RUXSAT etilgan). */
const freeTableRow = {
  id: 'room-1',
  hotel_id: 'hotel-1',
  base_price: '0',
  total_inventory: 10,
};

interface PgMock {
  query: jest.Mock;
  transaction: jest.Mock;
}

function makeService(roomRow: Record<string, unknown> = freeTableRow) {
  const pg: PgMock = {
    query: jest.fn().mockResolvedValue([]),
    transaction: jest.fn(),
  };
  pg.transaction.mockImplementation((operation: (tx: unknown) => unknown) =>
    Promise.resolve(operation({ query: pg.query })),
  );
  const buildCheckoutUrl = jest.fn().mockReturnValue(null);
  const service = new BookingsService(
    pg as unknown as PostgresService,
    {
      bookingStatusChanged: jest.fn(),
      partnerDashboardUpdated: jest.fn(),
      adminDashboardUpdated: jest.fn(),
    } as unknown as EventsService,
    {
      send: jest
        .fn()
        .mockResolvedValue({ providerMessageId: '', accepted: true }),
    } as unknown as EmailService,
    {
      validate: jest.fn().mockResolvedValue({
        code: '',
        valid: false,
        discount_type: null,
        discount_value: 0,
      }),
      redeem: jest.fn().mockResolvedValue(true),
    } as unknown as PromosService,
    { buildCheckoutUrl } as unknown as PaymentsService,
    {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      getOrSet: jest.fn((_k: string, _t: number, producer: () => unknown) =>
        Promise.resolve(producer()),
      ),
    } as unknown as AppCacheService,
  );

  pg.query
    .mockResolvedValueOnce([restaurantRow]) // SELECT hotel/restaurant
    .mockResolvedValueOnce([roomRow]) // SELECT room/table
    .mockResolvedValueOnce([{ booked_count: 0 }]) // slot ziddiyati yo'q
    .mockResolvedValueOnce([{ blocked_count: 0 }]); // bloklanmagan

  return { pg, service, buildCheckoutUrl };
}

const freeReservationDto = {
  hotel_id: 'hotel-1',
  room_id: 'room-1',
  agree_terms: true,
  check_in: '2026-10-10',
  check_out: '2026-10-10',
  slot_time: '19:00',
  booking_type: 'restaurant',
  guests: 2,
};

describe('D1 — 0 UZS (bepul) restoran rezervatsiyasi', () => {
  it('R1/R2/R3: bron DARHOL `confirmed`, `confirmed_at` to‘ldirilgan, `expires_at = NULL`', async () => {
    const { pg, service } = makeService();

    const result = (await service.createHotel(owner, freeReservationDto)) as {
      booking: Record<string, unknown>;
      payment: unknown;
    };

    expect(result.booking.total_amount).toBe(0);
    expect(result.booking.status).toBe('confirmed');
    expect(result.booking.confirmed_at).not.toBeNull();

    const confirmUpdate = findCall(pg.query, 'UPDATE bookings SET status');
    expect(confirmUpdate?.[0]).toContain('expires_at = NULL');
    expect(confirmUpdate?.[1]?.[0]).toBe('confirmed');
    expect(confirmUpdate?.[1]?.[2]).toBe(result.booking.id);
  });

  it("R4: `booking_status_history` — ALOHIDA action ('free_booking_confirmed'), 'cash_booking_confirmed' EMAS", async () => {
    const { pg, service } = makeService();

    await service.createHotel(owner, freeReservationDto);

    const historyCalls = findCalls(pg.query, 'booking_status_history');
    const actions = historyCalls.map((call) => call[1]?.[3]);
    expect(actions).toContain('created');
    expect(actions).toContain('free_booking_confirmed');
    // Bu naqd pul broni EMAS — tarixga shunday yozish yolg'on bo'lardi.
    expect(actions).not.toContain('cash_booking_confirmed');
    // Aynan BITTA tasdiqlash yozuvi.
    expect(actions.filter((a) => a === 'free_booking_confirmed')).toHaveLength(
      1,
    );
  });

  it('R5 (PD-2): `payments` qatori UMUMAN yaratilmaydi, javobda `payment: null`', async () => {
    const { pg, service } = makeService();

    const result = (await service.createHotel(owner, freeReservationDto)) as {
      payment: unknown;
    };

    expect(result.payment).toBeNull();
    expect(findCall(pg.query, 'INSERT INTO payments')).toBeUndefined();
    // Mavjud to'lovni qidirish ham kerak emas — umuman to'lov yo'q.
    expect(findCall(pg.query, 'FROM payments')).toBeUndefined();
  });

  it('PD-3: `partner_ledger_entries` yozuvi YARATILMAYDI', async () => {
    const { pg, service } = makeService();

    await service.createHotel(owner, freeReservationDto);

    expect(findCall(pg.query, 'partner_ledger_entries')).toBeUndefined();
  });

  it('R9: komissiya/`partner_payable` hisobi TEGILMAGAN (0 summada ikkalasi ham 0)', async () => {
    const { service } = makeService();

    const result = (await service.createHotel(owner, freeReservationDto)) as {
      booking: Record<string, unknown>;
    };

    expect(result.booking.subtotal).toBe(0);
    expect(result.booking.commission_amount).toBe(0);
    expect(result.booking.partner_payable).toBe(0);
  });

  it('`request_confirmation` rejimida — `awaiting_partner_confirmation` (`confirmed` EMAS)', async () => {
    const { pg, service } = makeService();

    const result = (await service.createHotel(owner, {
      ...freeReservationDto,
      confirmation_mode: 'request_confirmation',
    })) as { booking: Record<string, unknown> };

    expect(result.booking.status).toBe('awaiting_partner_confirmation');
    const confirmUpdate = findCall(pg.query, 'UPDATE bookings SET status');
    expect(confirmUpdate?.[1]?.[0]).toBe('awaiting_partner_confirmation');
    expect(confirmUpdate?.[0]).toContain('expires_at = NULL');
  });

  it("R6: o'lik `awaiting_payment` holati ISHLATILMAYDI", async () => {
    const { pg, service } = makeService();

    await service.createHotel(owner, freeReservationDto);

    const statuses = queryCallsOf(pg.query).flatMap(
      ([, params]) => (params ?? []) as unknown[],
    );
    expect(statuses).not.toContain('awaiting_payment');
  });
});

describe('D1 — pullik bron semantikasi O‘ZGARMAYDI (regressiyaga qarshi)', () => {
  const paidTableRow = { ...freeTableRow, base_price: '150000' };

  it("pullik restoran broni — avvalgidek `pending` + to'lov qatori bilan", async () => {
    const { pg, service } = makeService(paidTableRow);

    const result = (await service.createHotel(owner, freeReservationDto)) as {
      booking: Record<string, unknown>;
      payment: Record<string, unknown> | null;
    };

    expect(result.booking.total_amount).toBe(150_000);
    expect(result.booking.status).toBe('pending');
    expect(result.payment).not.toBeNull();
    expect(findCall(pg.query, 'INSERT INTO payments')).toBeDefined();
    // Bepul bron yo'li ISHLAMAYDI.
    const historyActions = findCalls(pg.query, 'booking_status_history').map(
      (call) => call[1]?.[3],
    );
    expect(historyActions).not.toContain('free_booking_confirmed');
  });

  it('pullik + `cash` — avvalgidek `cash_booking_confirmed` (naqd presedenti buzilmagan)', async () => {
    const { pg, service } = makeService(paidTableRow);

    const result = (await service.createHotel(owner, {
      ...freeReservationDto,
      payment_method: 'cash',
    })) as {
      booking: Record<string, unknown>;
      payment: Record<string, unknown> | null;
    };

    expect(result.booking.status).toBe('confirmed');
    expect(result.payment?.status).toBe('awaiting_cash');
    const historyActions = findCalls(pg.query, 'booking_status_history').map(
      (call) => call[1]?.[3],
    );
    expect(historyActions).toContain('cash_booking_confirmed');
    expect(historyActions).not.toContain('free_booking_confirmed');
  });
});
