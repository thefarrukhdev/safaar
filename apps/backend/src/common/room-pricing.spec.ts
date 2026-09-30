import {
  activeRoomPromotionPredicate,
  calculateRoomPrice,
  isSchool21Code,
  type ActiveRoomPromotion,
} from './room-pricing';

/**
 * "SAFAAR — PROMOTIONS BACKEND LOGIC AUDIT" regressiyasi.
 *
 * Hamkor promotion'i ANIQ yangi narx (`new_price_sum`) modeliga ega: hamkor
 * "Yangi narx (UZS / chegirmali)" maydoniga aniq summa kiritadi, admin AYNAN
 * shu summani tasdiqlaydi. `discount_percent` — frontend `Math.round`i bilan
 * ikkita narxdan HOSIL QILINGAN, DB'da INTEGER ustun, ya'ni ko'p holatda
 * hamkor niyatini ifodalay olmaydi.
 *
 * Ilgari `calculateRoomPrice()` narxni `base_price - discount_percent%`
 * formulasi bilan hisoblardi — natijada 150 000 -> 140 000 (7%) uchun mijoz
 * 139 500 to'lardi, 150 000 -> 145 000 (3%) uchun esa tasdiqlangan narxdan
 * QIMMAT — 145 500. Shu bloklardagi raqamlar haqiqiy QA/lokal runtime
 * kuzatuvlaridan olingan.
 */
const promo = (
  oldPriceSum: number,
  newPriceSum: number,
  discountPercent: number,
): ActiveRoomPromotion => ({
  id: 'promotion-1',
  entity_id: 'room-1',
  old_price_sum: oldPriceSum,
  new_price_sum: newPriceSum,
  discount_percent: discountPercent,
  start_date: '2026-09-01',
  end_date: '2026-12-31',
});

describe('calculateRoomPrice — tasdiqlangan ANIQ narx (new_price_sum) hokim', () => {
  it('no promotion — base price is charged unchanged', () => {
    expect(calculateRoomPrice(150000, null)).toEqual({
      basePrice: 150000,
      effectivePrice: 150000,
      discountAmount: 0,
    });
    expect(calculateRoomPrice(150000)).toEqual({
      basePrice: 150000,
      effectivePrice: 150000,
      discountAmount: 0,
    });
  });

  /**
   * Yaxlitlash matritsasi — hamkor UI'si `discountPercent`ni
   * `Math.round((old - new) / old * 100)` bilan hisoblaydi, ya'ni quyidagi
   * foizlar AYNAN shu juftliklar uchun frontend yuboradigan qiymatlar.
   * Har bir holatda mijozga hamkor kiritgan/admin tasdiqlagan ANIQ summa
   * qo'yilishi kerak — foizdan qayta hisoblangan summa EMAS.
   */
  it.each([
    // base, newPriceSum, percent(frontend), expected effective price
    [150000, 140000, 7, 140000], // foizdan: 139 500 (mijoz uchun -500)
    [150000, 145000, 3, 145000], // foizdan: 145 500 (mijozga +500 QIMMAT)
    [100000, 90000, 10, 90000], // aniq mos keladigan holat
    [401000, 200000, 50, 200000], // foizdan: 200 500 (mijozga +500 QIMMAT)
    [99999, 90000, 10, 90000], // foizdan: 89 999
  ])(
    'base %i with approved new price %i (percent %i) is charged exactly %i',
    (basePrice, newPriceSum, percent, expected) => {
      const result = calculateRoomPrice(
        basePrice,
        promo(basePrice, newPriceSum, percent),
      );
      expect(result.effectivePrice).toBe(expected);
      expect(result.basePrice).toBe(basePrice);
      expect(result.discountAmount).toBe(basePrice - expected);
    },
  );

  /**
   * Base-price o'zgarishi. Promotion 150 000 -> 140 000 sifatida
   * tasdiqlangan; keyin hamkor xona narxini 200 000 ga oshirdi. Tasdiqlangan
   * artefakt — 140 000, shuning uchun mijozdan baribir 140 000 olinadi
   * (ilgari foizli model 200 000 - 7% = 186 000 qo'yardi, ya'ni HECH KIM
   * tasdiqlamagan narx).
   */
  it('stays pinned to the approved price when base_price later increases', () => {
    const active = promo(150000, 140000, 7);
    expect(calculateRoomPrice(150000, active).effectivePrice).toBe(140000);
    expect(calculateRoomPrice(200000, active)).toEqual({
      basePrice: 200000,
      effectivePrice: 140000,
      discountAmount: 60000,
    });
  });

  /**
   * Teskari yo'nalish — base_price tasdiqlangan yangi narxdan PASTGA tushsa,
   * mijozdan base_price'dan ko'p pul olinmaydi va chegirma manfiy bo'lmaydi.
   */
  it('never charges above base_price when base_price drops below the approved price', () => {
    expect(calculateRoomPrice(100000, promo(150000, 140000, 7))).toEqual({
      basePrice: 100000,
      effectivePrice: 100000,
      discountAmount: 0,
    });
  });

  it('falls back to the stored percent only when new_price_sum is unusable', () => {
    const broken: ActiveRoomPromotion = {
      ...promo(150000, 140000, 20),
      new_price_sum: Number.NaN,
    };
    expect(calculateRoomPrice(150000, broken)).toEqual({
      basePrice: 150000,
      effectivePrice: 120000,
      discountAmount: 30000,
    });
  });

  it('a zero/negative base price never produces a negative charge', () => {
    expect(calculateRoomPrice(0, promo(150000, 140000, 7))).toEqual({
      basePrice: 0,
      effectivePrice: 0,
      discountAmount: 0,
    });
    expect(calculateRoomPrice(-1, promo(150000, 140000, 7))).toEqual({
      basePrice: 0,
      effectivePrice: 0,
      discountAmount: 0,
    });
    expect(
      calculateRoomPrice('not-a-number', promo(150000, 140000, 7)),
    ).toEqual({
      basePrice: 0,
      effectivePrice: 0,
      discountAmount: 0,
    });
  });

  it('a free (0 so‘m) approved price is honoured as a full discount', () => {
    expect(calculateRoomPrice(150000, promo(150000, 0, 99))).toEqual({
      basePrice: 150000,
      effectivePrice: 0,
      discountAmount: 150000,
    });
  });
});

describe('activeRoomPromotionPredicate — status/sana darvozasi o‘zgarmadi', () => {
  it('only published promotions inside the current date window are eligible', () => {
    const sql = activeRoomPromotionPredicate('p');
    expect(sql).toContain("p.entity_type = 'room'");
    expect(sql).toContain('p.status = \'published\'::"PromotionStatus"');
    expect(sql).toContain('p.start_date <= CURRENT_DATE');
    expect(sql).toContain('p.end_date >= CURRENT_DATE');
    expect(sql).not.toContain('pending_review');
    expect(sql).not.toContain('rejected');
    expect(sql).not.toContain('approved');
  });

  it('scopes to a single room when a room-id expression is supplied', () => {
    expect(activeRoomPromotionPredicate('p', 'hr.id')).toContain(
      'p.entity_id = hr.id',
    );
  });
});

describe('isSchool21Code', () => {
  it('matches the SCHOOL21 code case- and whitespace-insensitively', () => {
    expect(isSchool21Code('SCHOOL21')).toBe(true);
    expect(isSchool21Code(' school21 ')).toBe(true);
    expect(isSchool21Code('SUMMER10')).toBe(false);
    expect(isSchool21Code(null)).toBe(false);
    expect(isSchool21Code(undefined)).toBe(false);
  });
});
