import {
  UZUM_CHECKOUT_COMMISSION_RATE,
  UZUM_CHECKOUT_FEE_BEARER,
  UZUM_CHECKOUT_SETTLEMENT_MODEL,
  calculateUzumCheckoutCommission,
} from './uzum-checkout-commission';

/**
 * Bu testlar FAQAT SAFAAR ICHKI hisob-kitobini (1.5% biznes kelishuvi
 * bo'yicha) tekshiradi — Uzum'ning haqiqiy settlement/bank ko'chirmasi
 * kontrakti EMAS (u hali tasdiqlanmagan, qarang modul faylidagi izoh).
 */

describe('UZUM_CHECKOUT_COMMISSION_RATE / UZUM_CHECKOUT_FEE_BEARER / UZUM_CHECKOUT_SETTLEMENT_MODEL', () => {
  it('stavka 1.5% (biznes kelishuv)', () => {
    expect(UZUM_CHECKOUT_COMMISSION_RATE).toBe(0.015);
  });

  it("USER_PAYS: 1.5%ni MIJOZ/USER to'laydi (2026-09-13 biznes tomonidan TASDIQLANGAN — na hamkor, na SAFAAR)", () => {
    expect(UZUM_CHECKOUT_FEE_BEARER).toBe('USER');
  });

  it("kim to'laydi (USER_PAYS, tasdiqlangan) va Uzum-SAFAAR bank settlement mexanizmi (hali tasdiqlanmagan) — IKKI MUSTAQIL savol: biri tasdiqlangani ikkinchisini hal qilmaydi", () => {
    expect(UZUM_CHECKOUT_FEE_BEARER).toBe('USER');
    expect(UZUM_CHECKOUT_SETTLEMENT_MODEL).toBe('REQUIRES_UZUM_CONFIRMATION');
  });

  it('settlement mexanizmi TASDIQLANMAGAN deb ATAYLAB belgilangan', () => {
    expect(UZUM_CHECKOUT_SETTLEMENT_MODEL).toBe('REQUIRES_UZUM_CONFIRMATION');
  });
});

describe('calculateUzumCheckoutCommission — vazifada berilgan aniq misollar', () => {
  it.each([
    [100_000, 1_500, 98_500],
    [500_000, 7_500, 492_500],
    [1_000_000, 15_000, 985_000],
    [10_000_000, 150_000, 9_850_000],
  ])(
    'gross=%d -> commission=%d, net=%d',
    (gross, expectedCommission, expectedNet) => {
      const r = calculateUzumCheckoutCommission(gross);
      expect(r.grossAmountSom).toBe(gross);
      expect(r.commissionRate).toBe(0.015);
      expect(r.commissionAmountSom).toBe(expectedCommission);
      expect(r.netSettlementAmountSom).toBe(expectedNet);
      // gross = commission + net har doim aniq saqlanishi kerak (tiyin darajasida)
      expect(r.commissionAmountSom + r.netSettlementAmountSom).toBe(gross);
    },
  );
});

describe('calculateUzumCheckoutCommission — yaxlitlash (tiyin darajasida, suzuvchi nuqtasiz)', () => {
  it('komissiya butun tiyinga tushmasa -> yaxlitlanadi, gross=commission+net saqlanadi', () => {
    // 33 333.33 so'm -> tiyin=3 333 333; 3 333 333 * 150 / 10 000 = 49 999.995
    // -> round -> 50 000 tiyin = 500.00 so'm
    const r = calculateUzumCheckoutCommission(33_333.33);
    expect(r.commissionAmountSom).toBe(500);
    expect(r.netSettlementAmountSom).toBe(32_833.33);
    expect(
      Math.round((r.commissionAmountSom + r.netSettlementAmountSom) * 100),
    ).toBe(Math.round(r.grossAmountSom * 100));
  });

  it("kichik summa (1 so'm) uchun ham komissiya tiyin darajasida hisoblanadi", () => {
    // 1 so'm -> 100 tiyin; 100*150/10000 = 1.5 -> round -> 2 tiyin = 0.02 so'm
    const r = calculateUzumCheckoutCommission(1);
    expect(r.commissionAmountSom).toBe(0.02);
    expect(r.netSettlementAmountSom).toBe(0.98);
  });

  it('string kirish ("150000") ham qo\'llab-quvvatlanadi', () => {
    const r = calculateUzumCheckoutCommission('150000');
    expect(r.commissionAmountSom).toBe(2_250);
    expect(r.netSettlementAmountSom).toBe(147_750);
  });

  it("suzuvchi nuqta xatosiga misol bo'lishi mumkin bo'lgan qiymat (0.1+0.2 klassi) to'g'ri ishlaydi", () => {
    const r = calculateUzumCheckoutCommission(999_999.99);
    // tiyin=99999999; commission=round(99999999*150/10000)=round(1499999.985)=1500000 -> 15000.00
    expect(r.commissionAmountSom).toBe(15_000);
    expect(r.netSettlementAmountSom).toBe(984_999.99);
  });
});

describe('calculateUzumCheckoutCommission — edge cases / rad etish', () => {
  it("nol summa -> RangeError (komissiyasiz to'lov ma'nosiz)", () => {
    expect(() => calculateUzumCheckoutCommission(0)).toThrow(RangeError);
  });

  it('manfiy summa -> RangeError', () => {
    expect(() => calculateUzumCheckoutCommission(-100_000)).toThrow(RangeError);
  });

  it('NaN -> RangeError', () => {
    expect(() => calculateUzumCheckoutCommission(NaN)).toThrow(RangeError);
  });

  it('Infinity -> RangeError', () => {
    expect(() => calculateUzumCheckoutCommission(Infinity)).toThrow(RangeError);
  });

  it("bo'sh/raqam bo'lmagan string -> RangeError", () => {
    expect(() => calculateUzumCheckoutCommission('')).toThrow(RangeError);
    expect(() => calculateUzumCheckoutCommission('abc')).toThrow(RangeError);
  });

  it("juda kichik musbat summa (0.01 so'm) -> hali ham hisoblanadi, throw qilmaydi", () => {
    expect(() => calculateUzumCheckoutCommission(0.01)).not.toThrow();
  });
});

describe('calculateUzumCheckoutCommission — refund summasiga nisbatan (SAFAAR ICHKI, simmetrik taxmin)', () => {
  it(
    "refund summasi ham xuddi shu formula bilan hisoblanishi mumkin — lekin bu Uzum'ning " +
      'haqiqiy refund-komissiya siyosati EMAS (REQUIRES_UZUM_CONFIRMATION)',
    () => {
      const refundAmount = 1_000_000;
      const r = calculateUzumCheckoutCommission(refundAmount);
      expect(r.commissionAmountSom).toBe(15_000);
      // Modul hech qanday joyda "bu Uzum qaytaradi/ushlab qoladi" deb da'vo qilmaydi —
      // faqat REQUIRES_UZUM_CONFIRMATION konstantasi orqali eslatadi.
      expect(UZUM_CHECKOUT_SETTLEMENT_MODEL).toBe('REQUIRES_UZUM_CONFIRMATION');
    },
  );
});
