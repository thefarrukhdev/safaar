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

  it("boshqa provayder qiymatlarini (click/payme/cash/uzum/uzum_checkout) rad etadi", () => {
    expect(isCardScheme('click')).toBe(false);
    expect(isCardScheme('payme')).toBe(false);
    expect(isCardScheme('cash')).toBe(false);
    expect(isCardScheme('uzum')).toBe(false);
    expect(isCardScheme('uzum_checkout')).toBe(false);
    expect(isCardScheme(undefined)).toBe(false);
    expect(isCardScheme(123)).toBe(false);
  });
});

describe('calculateCardSchemeFee — vazifada berilgan misol (500 000 so‘m)', () => {
  it('Humo: fee=7 500, total=507 500', () => {
    const r = calculateCardSchemeFee(500_000, 'humo');
    expect(r).toMatchObject({
      scheme: 'humo',
      baseAmountSom: 500_000,
      feeRate: 0.015,
      feeAmountSom: 7_500,
      totalPayableAmountSom: 507_500,
    });
  });

  it('Uzcard: fee=7 500, total=507 500', () => {
    const r = calculateCardSchemeFee(500_000, 'uzcard');
    expect(r.feeAmountSom).toBe(7_500);
    expect(r.totalPayableAmountSom).toBe(507_500);
  });

  it('Visa: fee=17 500, total=517 500', () => {
    const r = calculateCardSchemeFee(500_000, 'visa');
    expect(r).toMatchObject({
      scheme: 'visa',
      baseAmountSom: 500_000,
      feeRate: 0.035,
      feeAmountSom: 17_500,
      totalPayableAmountSom: 517_500,
    });
  });

  it('Mastercard: fee=17 500, total=517 500', () => {
    const r = calculateCardSchemeFee(500_000, 'mastercard');
    expect(r.feeAmountSom).toBe(17_500);
    expect(r.totalPayableAmountSom).toBe(517_500);
  });

  it('base + fee = total har doim aniq saqlanadi', () => {
    for (const scheme of ['humo', 'uzcard', 'visa', 'mastercard'] as const) {
      const r = calculateCardSchemeFee(500_000, scheme);
      expect(r.baseAmountSom + r.feeAmountSom).toBe(r.totalPayableAmountSom);
    }
  });
});

describe('calculateCardSchemeFee — yaxlitlash (tiyin darajasida, suzuvchi nuqtasiz)', () => {
  it('kichik summa (1 so‘m, Visa) — tiyin darajasida hisoblanadi', () => {
    // 1 so'm -> 100 tiyin; 100*350/10000 = 3.5 -> round -> 4 tiyin = 0.04 so'm
    const r = calculateCardSchemeFee(1, 'visa');
    expect(r.feeAmountSom).toBe(0.04);
    expect(r.totalPayableAmountSom).toBe(1.04);
  });

  it('suzuvchi nuqta xatosiga misol bo‘lishi mumkin bo‘lgan qiymat (Humo)', () => {
    const r = calculateCardSchemeFee(999_999.99, 'humo');
    // tiyin=99999999; fee=round(99999999*150/10000)=round(1499999.985)=1500000 -> 15000.00
    expect(r.feeAmountSom).toBe(15_000);
    expect(r.totalPayableAmountSom).toBe(1_014_999.99);
  });

  it('string kirish ("150000") ham qo‘llab-quvvatlanadi', () => {
    const r = calculateCardSchemeFee('150000', 'mastercard');
    expect(r.feeAmountSom).toBe(5_250);
    expect(r.totalPayableAmountSom).toBe(155_250);
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
});
