import {
  calculateCommission,
  calculatePaymentBreakdown,
  DEFAULT_COMMISSION_RATE_PERCENT,
  normalizeCommissionRate,
  resolveAccommodationCommissionRate,
} from './finance';
import {
  UZUM_CHECKOUT_COMMISSION_RATE,
  UZUM_CHECKOUT_FEE_BEARER,
} from '../payments/providers/uzum-checkout-commission';

describe('normalizeCommissionRate / calculateCommission (mavjud, o‘zgarishsiz)', () => {
  it('yaroqsiz (NaN/manfiy) qiymatlar uchun standart 12%ga tushadi', () => {
    // MUHIM: `Number(null) === 0` — bu haqiqiy, moliyaviy ma'noda (0%
    // komissiya) yaroqli qiymat, shuning uchun mavjud funksiya buni
    // standartga ALMASHTIRMAYDI (o'zgarishsiz, mavjud xulq).
    expect(normalizeCommissionRate(null)).toBe(0);
    expect(normalizeCommissionRate(undefined)).toBe(
      DEFAULT_COMMISSION_RATE_PERCENT,
    );
    expect(normalizeCommissionRate('abc')).toBe(
      DEFAULT_COMMISSION_RATE_PERCENT,
    );
    expect(normalizeCommissionRate(-5)).toBe(DEFAULT_COMMISSION_RATE_PERCENT);
  });

  it('haqiqiy stavkani to‘g‘ri qo‘llaydi', () => {
    expect(calculateCommission(200_000, 10)).toBe(20_000);
  });
});

describe('resolveAccommodationCommissionRate — SAFAAR Excel komissiya jadvali (2026-09-13 business source of truth)', () => {
  // ============ SAMARQAND ============
  it('Samarqand + hotel + 4 yulduz => 12% (4-5 yulduz qatori)', () => {
    const r = resolveAccommodationCommissionRate({
      citySlug: 'samarqand',
      partnerOrganizationType: 'hotel',
      stars: 4,
    });
    expect(r).toMatchObject({
      matched: true,
      ratePercent: 12,
      regionTier: 'samarqand',
      propertyTier: 'star_4_5',
    });
  });

  it('Samarqand + hotel + 5 yulduz => 12%', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'samarqand',
        partnerOrganizationType: 'hotel',
        stars: 5,
      }).ratePercent,
    ).toBe(12);
  });

  it('Samarqand + hotel + 3 yulduz (4dan kam) => oddiy "mehmonxona" qatori 10%', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'samarqand',
        partnerOrganizationType: 'hotel',
        stars: 3,
      }).ratePercent,
    ).toBe(10);
  });

  it('Samarqand + guesthouse => 8%', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'samarqand',
        partnerOrganizationType: 'guesthouse',
        stars: null,
      }).ratePercent,
    ).toBe(8);
  });

  it('Samarqand + hostel => 7%', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'samarqand',
        partnerOrganizationType: 'hostel',
        stars: null,
      }).ratePercent,
    ).toBe(7);
  });

  // ============ TOSHKENT ============
  it('Toshkent + hotel + 5 yulduz => 14%', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'tashkent',
        partnerOrganizationType: 'hotel',
        stars: 5,
      }).ratePercent,
    ).toBe(14);
  });

  it('Toshkent + hotel + 2 yulduz => 12% (oddiy mehmonxona)', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'tashkent',
        partnerOrganizationType: 'hotel',
        stars: 2,
      }).ratePercent,
    ).toBe(12);
  });

  it('Toshkent + guesthouse => 8%', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'tashkent',
        partnerOrganizationType: 'guesthouse',
        stars: null,
      }).ratePercent,
    ).toBe(8);
  });

  it('Toshkent + hostel => 8%', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'tashkent',
        partnerOrganizationType: 'hostel',
        stars: null,
      }).ratePercent,
    ).toBe(8);
  });

  // ============ BOSHQA BARCHA VILOYAT VA SHAHARLAR ============
  it('Buxoro (na Toshkent, na Samarqand) + hotel + 5 yulduz => "Boshqa" qatori 10%', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'buxoro',
        partnerOrganizationType: 'hotel',
        stars: 5,
      }).ratePercent,
    ).toBe(10);
  });

  it('"Boshqa" + hotel (4dan kam yulduz) => 10%', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'buxoro',
        partnerOrganizationType: 'hotel',
        stars: 3,
      }).ratePercent,
    ).toBe(10);
  });

  it('"Boshqa" + guesthouse => 8%', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'buxoro',
        partnerOrganizationType: 'guesthouse',
        stars: null,
      }).ratePercent,
    ).toBe(8);
  });

  it('"Boshqa" + hostel => 7%', () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: 'buxoro',
        partnerOrganizationType: 'hostel',
        stars: null,
      }).ratePercent,
    ).toBe(7);
  });

  // ============ NOMA'LUM HUDUD / TUR (unknown region / property type) ============
  it("noma'lum/bo'sh city_slug ATAYLAB xavfsiz \"Boshqa\" qatoriga tushadi (taxmin qilinmaydi, Excel'ning o'z fallback qoidasi)", () => {
    expect(
      resolveAccommodationCommissionRate({
        citySlug: null,
        partnerOrganizationType: 'hostel',
        stars: null,
      }),
    ).toMatchObject({ matched: true, ratePercent: 7, regionTier: 'other' });
    expect(
      resolveAccommodationCommissionRate({
        citySlug: undefined,
        partnerOrganizationType: 'hostel',
        stars: null,
      }).regionTier,
    ).toBe('other');
  });

  it("Excel'da UMUMAN yo'q propertyType (motel/dacha/sanatorium/resort/restaurant/mixed/bus) => matched:false, HECH QANDAY stavka taxmin qilinmaydi", () => {
    for (const type of [
      'motel',
      'dacha',
      'sanatorium',
      'resort',
      'restaurant',
      'mixed',
      'bus',
      'totally-unknown-type',
      null,
      undefined,
    ]) {
      const r = resolveAccommodationCommissionRate({
        citySlug: 'tashkent',
        partnerOrganizationType: type,
        stars: 5,
      });
      expect(r.matched).toBe(false);
      expect(r.ratePercent).toBeNull();
      expect(r.propertyTier).toBeNull();
    }
  });

  it('yaroqsiz stars qiymatlari (NaN/manfiy/matn) xavfsiz "4dan kam" deb hisoblanadi, yiqilib tushmaydi', () => {
    for (const stars of [
      NaN,
      -1,
      'abc' as unknown as number,
      null,
      undefined,
    ]) {
      const r = resolveAccommodationCommissionRate({
        citySlug: 'tashkent',
        partnerOrganizationType: 'hotel',
        stars,
      });
      expect(r.ratePercent).toBe(12); // Toshkent oddiy "mehmonxona" qatori
    }
  });
});

describe('UZUM_CHECKOUT_FEE_BEARER — USER_PAYS biznes qoidasi (2026-09-13 tasdiqlangan)', () => {
  it("kim to'laydi konstantasi 'USER' (na PARTNER, na SAFAAR)", () => {
    expect(UZUM_CHECKOUT_FEE_BEARER).toBe('USER');
  });
});

describe('calculatePaymentBreakdown — gross → SAFAAR komissiya → hamkor net (USER_PAYS, 2026-09-13 biznes tomonidan tasdiqlangan)', () => {
  it('1,000,000 so‘m, Samarqand 4-5 yulduz (12%) — vazifada berilgan aniq misol: SAFAAR=120000, hamkor=880000, Uzum fee (mijoz to‘laydi, alohida)=15000', () => {
    const rate = resolveAccommodationCommissionRate({
      citySlug: 'samarqand',
      partnerOrganizationType: 'hotel',
      stars: 5,
    });
    expect(rate.ratePercent).toBe(12);

    const breakdown = calculatePaymentBreakdown({
      grossAmountSom: 1_000_000,
      safaarCommissionRatePercent: rate.ratePercent as number,
    });

    expect(breakdown.safaarCommissionAmountSom).toBe(120_000);
    // USER_PAYS: Uzum fee hamkor/SAFAAR bo'linishiga TA'SIR QILMAYDI —
    // partnerNet = gross - SAFAAR komissiya, Uzum fee AYIRILMAYDI.
    expect(breakdown.partnerNetAmountSom).toBe(880_000);
    expect(
      breakdown.safaarCommissionAmountSom + breakdown.partnerNetAmountSom,
    ).toBe(1_000_000);
    // Uzum fee — FAQAT informativ (mijoz Uzum checkout'da alohida to'laydi).
    expect(breakdown.uzumUserFeeAmountSom).toBe(15_000);
    // customerTotal = gross + Uzum fee — mijoz KONSEPTUAL jami shuncha to'laydi.
    expect(breakdown.customerTotalAmountSom).toBe(1_015_000);
  });

  it('400,000 so‘m, SAFAAR 10% — vazifada berilgan ikkinchi aniq misol: SAFAAR=40000, hamkor=360000, Uzum fee=6000, customerTotal=406000', () => {
    const breakdown = calculatePaymentBreakdown({
      grossAmountSom: 400_000,
      safaarCommissionRatePercent: 10,
    });

    expect(breakdown.grossAmountSom).toBe(400_000);
    expect(breakdown.safaarCommissionAmountSom).toBe(40_000);
    expect(breakdown.partnerNetAmountSom).toBe(360_000);
    expect(breakdown.uzumUserFeeAmountSom).toBe(6_000);
    expect(breakdown.customerTotalAmountSom).toBe(406_000);
    // Booking/payment gross'ning o'zi customerTotal bilan ARALASHTIRILMAYDI.
    expect(breakdown.grossAmountSom).not.toBe(breakdown.customerTotalAmountSom);
  });

  it('Uzum fee: 1,000,000 → 15,000 (vazifada berilgan aniq test-case, informativ maydon)', () => {
    expect(
      calculatePaymentBreakdown({
        grossAmountSom: 1_000_000,
        safaarCommissionRatePercent: 0,
      }).uzumUserFeeAmountSom,
    ).toBe(15_000);
  });

  it('Uzum fee: 500,000 → 7,500 (vazifada berilgan aniq test-case, informativ maydon)', () => {
    expect(
      calculatePaymentBreakdown({
        grossAmountSom: 500_000,
        safaarCommissionRatePercent: 0,
      }).uzumUserFeeAmountSom,
    ).toBe(7_500);
  });

  it('uzumUserFeeRatePercent doim 1.5 (UZUM_CHECKOUT_COMMISSION_RATE bilan izchil)', () => {
    expect(
      calculatePaymentBreakdown({
        grossAmountSom: 100_000,
        safaarCommissionRatePercent: 10,
      }).uzumUserFeeRatePercent,
    ).toBe(UZUM_CHECKOUT_COMMISSION_RATE * 100);
  });

  it("hamkor to'lovi (partnerNetAmountSom) Uzum fee STAVKASI/SUMMASIGA BOG'LIQ EMAS — faqat gross va SAFAAR komissiyasidan hisoblanadi (USER_PAYS regression guard)", () => {
    // Uzum fee turlicha bo'lsa ham (turli gross summalar orqali turlicha
    // uzumUserFeeAmountSom chiqadi), partnerNet FAQAT gross-safaarCommission
    // formulasiga rioya qilishi kerak — Uzum raqami bilan HECH QANDAY
    // arifmetik bog'liqlik bo'lmasligi kerak.
    for (const gross of [10_000, 250_000, 1_000_000, 7_777_777]) {
      const breakdown = calculatePaymentBreakdown({
        grossAmountSom: gross,
        safaarCommissionRatePercent: 12,
      });
      expect(breakdown.partnerNetAmountSom).toBe(
        gross - breakdown.safaarCommissionAmountSom,
      );
    }
  });

  it("SAFAAR komissiyasi (safaarCommissionAmountSom) Uzum fee'dan MUSTAQIL — faqat gross va stavkaga bog'liq", () => {
    expect(
      calculatePaymentBreakdown({
        grossAmountSom: 1_000_000,
        safaarCommissionRatePercent: 12,
      }).safaarCommissionAmountSom,
    ).toBe(calculateCommission(1_000_000, 12));
  });

  it('partnerNetAmountSom HECH QACHON manfiy bo‘lmasligi kerak (yuqori komissiyada ham) — sog‘lik tekshiruvi', () => {
    const breakdown = calculatePaymentBreakdown({
      grossAmountSom: 100_000,
      safaarCommissionRatePercent: 14,
    });
    expect(breakdown.partnerNetAmountSom).toBeGreaterThan(0);
    // MUHIM: Uzum fee bu invariantda ISHTIROK ETMAYDI (USER_PAYS) —
    // gross = SAFAAR komissiya + hamkor net, boshqa hech narsa emas.
    expect(
      breakdown.safaarCommissionAmountSom + breakdown.partnerNetAmountSom,
    ).toBe(breakdown.grossAmountSom);
  });

  it('boundary/rounding: g‘alati (tiyin darajasida yaxlitlanishi kerak bo‘lgan) summalarda ham gross = commission + partner net (1 so‘mlik ham yo‘qolib ketmaydi)', () => {
    for (const gross of [1, 3, 7, 99, 1001, 33_333, 999_999]) {
      const breakdown = calculatePaymentBreakdown({
        grossAmountSom: gross,
        safaarCommissionRatePercent: 8,
      });
      expect(
        breakdown.safaarCommissionAmountSom + breakdown.partnerNetAmountSom,
      ).toBe(gross);
      // customerTotal = gross + Uzum fee, tiyin darajasida ANIQ (suzuvchi
      // nuqta xatosisiz) — hamkor/SAFAAR bo'linishiga TA'SIR qilmaydi.
      expect(breakdown.customerTotalAmountSom).toBe(
        Math.round((gross + breakdown.uzumUserFeeAmountSom) * 100) / 100,
      );
    }
  });

  it('nol/manfiy gross summasi rad etiladi (Uzum komissiya modulidagi mavjud himoya orqali)', () => {
    expect(() =>
      calculatePaymentBreakdown({
        grossAmountSom: 0,
        safaarCommissionRatePercent: 10,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculatePaymentBreakdown({
        grossAmountSom: -400_000,
        safaarCommissionRatePercent: 10,
      }),
    ).toThrow(RangeError);
  });
});
