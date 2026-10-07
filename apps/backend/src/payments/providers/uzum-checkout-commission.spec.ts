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

describe('calculateUzumCheckoutCommission — vazifada berilgan aniq misol (1000 so‘m)', () => {
  it('1000 so‘m, 1.5% komissiya: total=1015.23, commission=15.23, net=1000', () => {
    const r = calculateUzumCheckoutCommission(1000);
    expect(r.grossAmountSom).toBe(1000);
    expect(r.commissionRate).toBe(0.015);
    expect(r.commissionAmountSom).toBe(15.23);
    expect(r.customerTotalAmountSom).toBe(1015.23);
    expect(r.netSettlementAmountSom).toBe(1000);

    // 1.5% ushlanganda aynan 1000 so'm tushishi shart:
    const providerFeeTiyin = Math.round(r.customerTotalAmountSom * 100 * 0.015);
    const netTiyin =
      Math.round(r.customerTotalAmountSom * 100) - providerFeeTiyin;
    expect(netTiyin).toBe(100_000);
  });
});

describe('calculateUzumCheckoutCommission — boshqa misollar (gross / (1 - rate))', () => {
  it.each([
    [100_000, 1_522.84, 100_000, 101_522.84],
    [400_000, 6_091.37, 400_000, 406_091.37],
    [500_000, 7_614.21, 500_000, 507_614.21],
    [1_000_000, 15_228.43, 1_000_000, 1_015_228.43],
    [10_000_000, 152_284.26, 10_000_000, 10_152_284.26],
  ])(
    'gross=%d -> commission=%d, net=%d, customerTotal=%d',
    (gross, expectedCommission, expectedNet, expectedCustomerTotal) => {
      const r = calculateUzumCheckoutCommission(gross);
      expect(r.grossAmountSom).toBe(gross);
      expect(r.commissionRate).toBe(0.015);
      expect(r.commissionAmountSom).toBe(expectedCommission);
      expect(r.netSettlementAmountSom).toBe(expectedNet);
      expect(r.customerTotalAmountSom).toBe(expectedCustomerTotal);
      // customerTotal = gross + commission (USER_PAYS: mijoz jami shuncha to'laydi)
      expect(Math.round((r.grossAmountSom + r.commissionAmountSom) * 100)).toBe(
        Math.round(r.customerTotalAmountSom * 100),
      );
    },
  );
});

describe('calculateUzumCheckoutCommission — yaxlitlash (tiyin darajasida, suzuvchi nuqtasiz)', () => {
  it('komissiya butun tiyinga tushmasa -> yaxlitlanadi, gross=customerTotal-commission saqlanadi', () => {
    // 33 333.33 so'm -> tiyin=3 333 333; total=round(3 333 333 / 0.985) = 3 384 094 tiyin = 33 840.94 so'm
    // commission = 3 384 094 - 3 333 333 = 50 761 tiyin = 507.61 so'm
    const r = calculateUzumCheckoutCommission(33_333.33);
    expect(r.commissionAmountSom).toBe(507.61);
    expect(r.netSettlementAmountSom).toBe(33_333.33);
    expect(r.customerTotalAmountSom).toBe(33_840.94);
    expect(
      Math.round((r.customerTotalAmountSom - r.commissionAmountSom) * 100),
    ).toBe(Math.round(r.grossAmountSom * 100));
  });

  it("kichik summa (1 so'm) uchun ham komissiya tiyin darajasida hisoblanadi", () => {
    // 1 so'm -> 100 tiyin; 100 / 0.985 = 101.52... -> round -> 102 tiyin = 1.02 so'm
    const r = calculateUzumCheckoutCommission(1);
    expect(r.commissionAmountSom).toBe(0.02);
    expect(r.netSettlementAmountSom).toBe(1);
    expect(r.customerTotalAmountSom).toBe(1.02);
  });

  it('string kirish ("150000") ham qo\'llab-quvvatlanadi', () => {
    const r = calculateUzumCheckoutCommission('150000');
    expect(r.commissionAmountSom).toBe(2_284.26);
    expect(r.netSettlementAmountSom).toBe(150_000);
    expect(r.customerTotalAmountSom).toBe(152_284.26);
  });

  it("suzuvchi nuqta xatosiga misol bo'lishi mumkin bo'lgan qiymat (0.1+0.2 klassi) to'g'ri ishlaydi", () => {
    const r = calculateUzumCheckoutCommission(999_999.99);
    // tiyin=99999999; total=round(99999999 / 0.985) = 101522842 -> 1015228.42
    expect(r.commissionAmountSom).toBe(15_228.43);
    expect(r.netSettlementAmountSom).toBe(999_999.99);
    expect(r.customerTotalAmountSom).toBe(1_015_228.42);
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
      expect(r.commissionAmountSom).toBe(15_228.43);
      // Modul hech qanday joyda "bu Uzum qaytaradi/ushlab qoladi" deb da'vo qilmaydi —
      // faqat REQUIRES_UZUM_CONFIRMATION konstantasi orqali eslatadi.
      expect(UZUM_CHECKOUT_SETTLEMENT_MODEL).toBe('REQUIRES_UZUM_CONFIRMATION');
    },
  );
});
