import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import {
  PostgresService,
  type PostgresTransaction,
} from '../infrastructure/postgres.service';
import { PaymentsService } from './payments.service';

/**
 * Mahsulot talabi (2026-09-16): HUMO/UZCARD (1.5%) va VISA/MASTERCARD
 * (3.5%) — barchasi Uzum Checkout orqali, fee backend tomonidan
 * hisoblanadi va Uzum `/payment/register`ga yuboriladigan summaning
 * O'ZIGA qo'shiladi (frontend mustaqil hisoblamaydi, backend yagona
 * haqiqat manbai). Qarang `providers/card-scheme-fee.ts`.
 */

type QueryCall = [sql: string, params?: readonly unknown[]];
const queryCallsOf = (m: jest.Mock): QueryCall[] => m.mock.calls as QueryCall[];
const findCall = (m: jest.Mock, needle: string): QueryCall | undefined =>
  queryCallsOf(m).find(([sql]) => String(sql).includes(needle));

const owner: RequestActor = {
  id: 'user-owner',
  actorType: 'user',
  role: Role.USER,
  roles: [Role.USER],
};

const bookingRow = {
  id: 'booking-1',
  booking_number: 'UZB-CARDTEST01',
  user_id: 'user-owner',
  partner_organization_id: 'partner-1',
  total_amount: 500_000,
  currency: 'UZS',
};

function makeService() {
  const pg = { query: jest.fn(), transaction: jest.fn() };
  const checkout = {
    register: jest.fn(),
  };
  const service = new PaymentsService(
    pg as unknown as PostgresService,
    { get: jest.fn() } as never,
    { isConfigured: () => false } as never,
    { isConfigured: () => false } as never,
    { isConfigured: () => false } as never,
    checkout as never,
  );
  return { pg, checkout, service };
}

describe.each([
  ['humo', 0.015, 7_500, 507_500],
  ['uzcard', 0.015, 7_500, 507_500],
  ['visa', 0.035, 17_500, 517_500],
  ['mastercard', 0.035, 17_500, 517_500],
] as const)(
  'PaymentsService.createPayment — karta turi %s (mahsulot misoli: 500 000 so‘m)',
  (scheme, expectedRate, expectedFee, expectedTotal) => {
    it(`Uzum register()ga fee-inclusive summa (${expectedTotal}) yuboriladi, payments qatori base/fee/scheme bilan yoziladi`, async () => {
      const { pg, checkout, service } = makeService();
      checkout.register.mockResolvedValue({
        orderId: `order-${scheme}`,
        paymentUrl: `https://checkout.uzum.uz/pay/order-${scheme}`,
        raw: {},
      });
      pg.query
        .mockResolvedValueOnce([bookingRow]) // assertBookingVisible
        .mockResolvedValueOnce([]) // createPayment: no existing open payment
        .mockResolvedValueOnce([]); // INSERT payments

      const result = await service.createPayment(owner, 'booking-1', {
        provider: scheme,
      });

      // 1) Uzum'ga YUBORILADIGAN summa — fee allaqachon qo'shilgan (backend
      //    yagona haqiqat manbai, frontend buni hisoblamaydi).
      expect(checkout.register).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'booking-1',
          amountSom: expectedTotal,
        }),
      );

      // 2) Frontendga qaytariladigan javob — foydalanuvchi so'ragan
      //    karta turining O'ZI `provider` maydonida (ichki transport
      //    'uzum_checkout' YASHIRILGAN), va to'liq fee taqsimoti bilan.
      expect(result).toMatchObject({
        provider: scheme,
        status: 'processing',
        payment_url: `https://checkout.uzum.uz/pay/order-${scheme}`,
        amount: expectedTotal,
        base_amount: 500_000,
        fee_rate: expectedRate,
        fee_amount: expectedFee,
        currency: 'UZS',
      });
      expect(Number(result.base_amount) + Number(result.fee_amount)).toBe(
        Number(result.amount),
      );

      // 3) DB'ga yoziladigan qator — `provider='uzum_checkout'` (transport,
      //    mavjud reconciliation/callback SQL'lari o'zgarmasdan ishlashi
      //    uchun), `card_scheme` esa aynan tanlangan usul.
      const insertCall = findCall(pg.query, 'INSERT INTO payments');
      expect(insertCall).toBeDefined();
      expect(insertCall?.[0]).toContain('uzum_checkout');
      expect(insertCall?.[1]).toContain(scheme);
      expect(insertCall?.[1]).toContain(expectedTotal);
      expect(insertCall?.[1]).toContain(500_000);
      expect(insertCall?.[1]).toContain(expectedFee);
    });
  },
);

describe('PaymentsService.createPayment — provider almashtirish (regression: eski provider so‘rovni jim e’tiborsiz qoldirardi)', () => {
  it('booking yaratilishida ICHKI yaratilgan, hali tashqi provayderga tegmagan (pending, provider_reference yo‘q) qator bo‘lsa — yangi so‘ralgan usul (humo) bilan XAVFSIZ ALMASHTIRILADI', async () => {
    const { pg, checkout, service } = makeService();
    checkout.register.mockResolvedValue({
      orderId: 'order-humo-1',
      paymentUrl: 'https://checkout.uzum.uz/pay/order-humo-1',
      raw: {},
    });
    const staleClickRow = {
      id: 'payment-stale',
      booking_id: 'booking-1',
      provider: 'click',
      status: 'pending',
      provider_reference: null,
      amount: 500_000,
      currency: 'UZS',
    };
    pg.query
      .mockResolvedValueOnce([bookingRow]) // assertBookingVisible
      .mockResolvedValueOnce([staleClickRow]) // existing: stale click draft
      .mockResolvedValueOnce([]) // DELETE FROM payments
      .mockResolvedValueOnce([]); // INSERT payments (humo)

    const result = await service.createPayment(owner, 'booking-1', {
      provider: 'humo',
    });

    const deleteCall = findCall(pg.query, 'DELETE FROM payments');
    expect(deleteCall).toBeDefined();
    expect(deleteCall?.[1]).toEqual(['payment-stale']);
    expect(checkout.register).toHaveBeenCalledWith(
      expect.objectContaining({ amountSom: 507_500 }),
    );
    expect(result).toMatchObject({ provider: 'humo', amount: 507_500 });
  });

  it('bir xil usul qayta so‘ralsa (idempotentlik) — mavjud qator o‘zgarishsiz qaytariladi, register QAYTA chaqirilmaydi', async () => {
    const { pg, checkout, service } = makeService();
    const existingHumoRow = {
      id: 'payment-humo-1',
      booking_id: 'booking-1',
      provider: 'uzum_checkout',
      card_scheme: 'humo',
      status: 'processing',
      provider_reference: 'order-humo-1',
      amount: 507_500,
      base_amount: 500_000,
      fee_rate: 0.015,
      fee_amount: 7_500,
      currency: 'UZS',
    };
    pg.query
      .mockResolvedValueOnce([bookingRow])
      .mockResolvedValueOnce([existingHumoRow]);

    const result = await service.createPayment(owner, 'booking-1', {
      provider: 'humo',
    });

    expect(checkout.register).not.toHaveBeenCalled();
    expect(result).toMatchObject({ provider: 'humo', amount: 507_500 });
    expect(findCall(pg.query, 'DELETE FROM payments')).toBeUndefined();
    expect(findCall(pg.query, 'INSERT INTO payments')).toBeUndefined();
  });

  it('mavjud qator HAQIQIY tashqi sessiyaga ega (processing/provider_reference bor) — boshqa usul so‘ralsa ham ALMASHTIRILMAYDI, eskisi qaytariladi', async () => {
    const { pg, checkout, service } = makeService();
    const liveVisaRow = {
      id: 'payment-visa-1',
      booking_id: 'booking-1',
      provider: 'uzum_checkout',
      card_scheme: 'visa',
      status: 'processing',
      provider_reference: 'order-visa-1',
      amount: 517_500,
      base_amount: 500_000,
      fee_rate: 0.035,
      fee_amount: 17_500,
      currency: 'UZS',
    };
    pg.query.mockResolvedValueOnce([bookingRow]).mockResolvedValueOnce([liveVisaRow]);

    const result = await service.createPayment(owner, 'booking-1', {
      provider: 'mastercard',
    });

    expect(checkout.register).not.toHaveBeenCalled();
    expect(findCall(pg.query, 'DELETE FROM payments')).toBeUndefined();
    // Eski (visa) qator o'zgarishsiz qaytadi — yangi so'ralgan (mastercard)
    // EMAS. Frontend eskisi failed/expired bo'lgunicha kutishi kerak.
    expect(result).toMatchObject({ provider: 'visa', amount: 517_500 });
  });
});

describe('PaymentsService.createPayment — amount/fee tampering himoyasi', () => {
  it('so‘rov tanasidagi begona maydonlar (amount/fee/total) HECH QANDAY ta’sir qilmaydi — faqat `provider` o‘qiladi', async () => {
    const { pg, checkout, service } = makeService();
    checkout.register.mockResolvedValue({
      orderId: 'order-humo-2',
      paymentUrl: 'https://checkout.uzum.uz/pay/order-humo-2',
      raw: {},
    });
    pg.query
      .mockResolvedValueOnce([bookingRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.createPayment(owner, 'booking-1', {
      provider: 'humo',
      // Frontend/attacker beradigan bo'lsa ham — DTO'da bunday maydon
      // yo'q, servis ularni o'qimaydi. Backend booking.total_amount'dan
      // (server-side, DB'dan) hisoblaydi.
      amount: 1,
      fee: 0,
      total: 1,
      fee_rate: 0,
    } as Record<string, unknown>);

    expect(checkout.register).toHaveBeenCalledWith(
      expect.objectContaining({ amountSom: 507_500 }),
    );
    expect(result.amount).toBe(507_500);
  });

  it("noto'g'ri/qonuniy bo'lmagan `provider` qiymati 'click'ga xavfsiz tushadi (DTO validatsiyasi bilan bir qatorda, ikkinchi himoya qatlami)", async () => {
    const { pg, service } = makeService();
    pg.query.mockResolvedValueOnce([bookingRow]).mockResolvedValueOnce([]);

    await expect(
      service.createPayment(owner, 'booking-1', {
        provider: 'bitcoin',
      }),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' },
    });
  });
});
