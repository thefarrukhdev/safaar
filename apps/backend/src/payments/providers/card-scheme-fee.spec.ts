import {
  CARD_SCHEME_FEE_BEARER,
  CARD_SCHEME_FEE_RATES,
  calculateCardSchemeFee,
  isCardScheme,
} from './card-scheme-fee';

describe('CARD_SCHEME_FEE_RATES / CARD_SCHEME_FEE_BEARER (mahsulot talabi, 2026-09-16)', () => {
  it('Humo/Uzcard = 1.5%, Visa/Mastercard = 3.5%', () => {
    expect(CARD_SCHEME_FEE_RATES.humo).toBe(0.015);
    expect(CARD_SCHEME_FEE_RATES.uzcard).toBe(0.015);
    expect(CARD_SCHEME_FEE_RATES.visa).toBe(0.035);
    expect(CARD_SCHEME_FEE_RATES.mastercard).toBe(0.035);
  });

  it("fee'ni foydalanuvchi to'laydi", () => {
    expect(CARD_SCHEME_FEE_BEARER).toBe('USER');
  });
});

describe('isCardScheme', () => {
  it('to‘rttala haqiqiy sxemani tan oladi', () => {
    expect(isCardScheme('humo')).toBe(true);
    expect(isCardScheme('uzcard')).toBe(true);
    expect(isCardScheme('visa')).toBe(true);
    expect(isCardScheme('mastercard')).toBe(true);
  });

  it('boshqa provayder qiymatlarini (click/payme/cash/uzum/uzum_checkout) rad etadi', () => {
    expect(isCardScheme('click')).toBe(false);
    expect(isCardScheme('payme')).toBe(false);
    expect(isCardScheme('cash')).toBe(false);
    expect(isCardScheme('uzum')).toBe(false);
    expect(isCardScheme('uzum_checkout')).toBe(false);
    expect(isCardScheme(undefined)).toBe(false);
    expect(isCardScheme(123)).toBe(false);
  });
});

describe('calculateCardSchemeFee — vazifada berilgan aniq misol (1000 so‘m)', () => {
  it('1000 so‘m, 1.5% komissiya (Humo): total=1015.23, fee=15.23, net=1000', () => {
    const r = calculateCardSchemeFee(1000, 'humo');
    expect(r).toMatchObject({
      scheme: 'humo',
      baseAmountSom: 1000,
      feeRate: 0.015,
      feeAmountSom: 15.23,
      totalPayableAmountSom: 1015.23,
    });
    // Provayder 1.5% ushlaganda (15.23 so'm) aynan 1000 so'm qolishi shart
    const providerFeeTiyin = Math.round(r.totalPayableAmountSom * 100 * 0.015);
    const netTiyin =
      Math.round(r.totalPayableAmountSom * 100) - providerFeeTiyin;
    expect(netTiyin).toBe(100_000);
  });

  it('1000 so‘m, 1.5% komissiya (Uzcard): total=1015.23, fee=15.23, net=1000', () => {
    const r = calculateCardSchemeFee(1000, 'uzcard');
    expect(r).toMatchObject({
      scheme: 'uzcard',
      baseAmountSom: 1000,
      feeRate: 0.015,
      feeAmountSom: 15.23,
      totalPayableAmountSom: 1015.23,
    });
    const providerFeeTiyin = Math.round(r.totalPayableAmountSom * 100 * 0.015);
    const netTiyin =
      Math.round(r.totalPayableAmountSom * 100) - providerFeeTiyin;
    expect(netTiyin).toBe(100_000);
  });

  it('1000 so‘m, 3.5% komissiya (Visa): total=1036.27, fee=36.27, net=1000', () => {
    const r = calculateCardSchemeFee(1000, 'visa');
    expect(r).toMatchObject({
      scheme: 'visa',
      baseAmountSom: 1000,
      feeRate: 0.035,
      feeAmountSom: 36.27,
      totalPayableAmountSom: 1036.27,
    });
    const providerFeeTiyin = Math.round(r.totalPayableAmountSom * 100 * 0.035);
    const netTiyin =
      Math.round(r.totalPayableAmountSom * 100) - providerFeeTiyin;
    expect(netTiyin).toBe(100_000);
  });

  it('1000 so‘m, 3.5% komissiya (Mastercard): total=1036.27, fee=36.27, net=1000', () => {
    const r = calculateCardSchemeFee(1000, 'mastercard');
    expect(r).toMatchObject({
      scheme: 'mastercard',
      baseAmountSom: 1000,
      feeRate: 0.035,
      feeAmountSom: 36.27,
      totalPayableAmountSom: 1036.27,
    });
    const providerFeeTiyin = Math.round(r.totalPayableAmountSom * 100 * 0.035);
    const netTiyin =
      Math.round(r.totalPayableAmountSom * 100) - providerFeeTiyin;
    expect(netTiyin).toBe(100_000);
  });
});

describe('calculateCardSchemeFee — misol (500 000 so‘m)', () => {
  it('Humo: fee=7 614.21, total=507 614.21', () => {
    const r = calculateCardSchemeFee(500_000, 'humo');
    expect(r).toMatchObject({
      scheme: 'humo',
      baseAmountSom: 500_000,
      feeRate: 0.015,
      feeAmountSom: 7_614.21,
      totalPayableAmountSom: 507_614.21,
    });
  });

  it('Uzcard: fee=7 614.21, total=507 614.21', () => {
    const r = calculateCardSchemeFee(500_000, 'uzcard');
    expect(r.feeAmountSom).toBe(7_614.21);
    expect(r.totalPayableAmountSom).toBe(507_614.21);
  });

  it('Visa: fee=18 134.72, total=518 134.72', () => {
    const r = calculateCardSchemeFee(500_000, 'visa');
    expect(r).toMatchObject({
      scheme: 'visa',
      baseAmountSom: 500_000,
      feeRate: 0.035,
      feeAmountSom: 18_134.72,
      totalPayableAmountSom: 518_134.72,
    });
  });

  it('Mastercard: fee=18 134.72, total=518 134.72', () => {
    const r = calculateCardSchemeFee(500_000, 'mastercard');
    expect(r.feeAmountSom).toBe(18_134.72);
    expect(r.totalPayableAmountSom).toBe(518_134.72);
  });

  it('base + fee = total har doim aniq saqlanadi', () => {
    for (const scheme of ['humo', 'uzcard', 'visa', 'mastercard'] as const) {
      const r = calculateCardSchemeFee(500_000, scheme);
      expect(Math.round((r.baseAmountSom + r.feeAmountSom) * 100)).toBe(
        Math.round(r.totalPayableAmountSom * 100),
      );
    }
  });
});

describe('calculateCardSchemeFee — yaxlitlash (tiyin darajasida, suzuvchi nuqtasiz)', () => {
  it('kichik summa (1 so‘m, Visa) — tiyin darajasida hisoblanadi', () => {
    // 1 so'm -> 100 tiyin; 100 / (1 - 0.035) = 103.6269... -> round -> 104 tiyin = 1.04 so'm
    const r = calculateCardSchemeFee(1, 'visa');
    expect(r.feeAmountSom).toBe(0.04);
    expect(r.totalPayableAmountSom).toBe(1.04);
  });

  it('suzuvchi nuqta xatosiga misol bo‘lishi mumkin bo‘lgan qiymat (Humo)', () => {
    const r = calculateCardSchemeFee(999_999.99, 'humo');
    // tiyin=99999999; total=round(99999999 / 0.985) = 101522842 -> 1015228.42
    // fee = 1015228.42 - 999999.99 = 15228.43
    expect(r.feeAmountSom).toBe(15_228.43);
    expect(r.totalPayableAmountSom).toBe(1_015_228.42);
  });

  it('string kirish ("150000") ham qo‘llab-quvvatlanadi', () => {
    const r = calculateCardSchemeFee('150000', 'mastercard');
    // tiyin=15000000; total=round(15000000 / 0.965) = 15544041 -> 155440.41
    expect(r.feeAmountSom).toBe(5_440.41);
    expect(r.totalPayableAmountSom).toBe(155_440.41);
  });
});

describe('calculateCardSchemeFee — edge cases / rad etish', () => {
  it('nol summa -> RangeError', () => {
    expect(() => calculateCardSchemeFee(0, 'humo')).toThrow(RangeError);
  });

  it('manfiy summa -> RangeError', () => {
    expect(() => calculateCardSchemeFee(-1, 'visa')).toThrow(RangeError);
  });

  it('NaN -> RangeError', () => {
    expect(() => calculateCardSchemeFee(NaN, 'uzcard')).toThrow(RangeError);
  });

  it('Infinity -> RangeError', () => {
    expect(() => calculateCardSchemeFee(Infinity, 'mastercard')).toThrow(
      RangeError,
    );
  });

  it("noma'lum karta turi -> TypeError", () => {
    expect(() => calculateCardSchemeFee(1000, 'paypal' as any)).toThrow(
      TypeError,
    );
  });
});
