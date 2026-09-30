import { livePromotionPredicate } from './promotion';
import {
  activeVehiclePromotionPredicate,
  calculateVehiclePrice,
  type ActiveVehiclePromotion,
} from './vehicle-pricing';

/**
 * "SAFAAR VEHICLE PROMOTION PRICING AUDIT" regressiyasi.
 *
 * `createVehicleRentalInternal()` ilgari `price_per_day * days`ni hech qanday
 * promotion'ni hisobga olmasdan hisoblardi — hamkor mashinasi ommaviy
 * chegirmali narxda e'lon qilingan bo'lsa ham (`/cms/offers`), haqiqiy
 * bron/to'lov TO'LIQ (chegirmasiz) narxni undirardi.
 *
 * Model: `vehicles.price_per_day` bilan bir xil — promotion `new_price_sum`i
 * KUNLIK stavka, "jami ijara summasi" emas (dalil: `promotions` jadvalida
 * muddat/kun ustuni yo'q; hamkor UI formasi `oldPriceSum`ni
 * `vehicle.pricePerDay`dan to'ldiradi, davomiylik maydoni umuman yo'q).
 * Shuning uchun formula xona (`calculateRoomPrice`) bilan AYNAN bir shaklda:
 * `effective_per_day = min(price_per_day, round(new_price_sum))`, keyin
 * chaqiruvchi (`bookings.service.ts`) buni `days`ga ko'paytiradi.
 */
const vehiclePromo = (
  oldPriceSum: number,
  newPriceSum: number,
  discountPercent: number,
): ActiveVehiclePromotion => ({
  id: 'vehicle-promotion-1',
  entity_id: 'vehicle-1',
  old_price_sum: oldPriceSum,
  new_price_sum: newPriceSum,
  discount_percent: discountPercent,
  start_date: '2026-09-01',
  end_date: '2026-12-31',
});

describe('calculateVehiclePrice — kunlik (per-day) narx, tasdiqlangan ANIQ new_price_sum hokim', () => {
  it('no promotion — price_per_day is charged unchanged', () => {
    expect(calculateVehiclePrice(150000, null)).toEqual({
      basePricePerDay: 150000,
      effectivePricePerDay: 150000,
      discountAmountPerDay: 0,
    });
    expect(calculateVehiclePrice(150000)).toEqual({
      basePricePerDay: 150000,
      effectivePricePerDay: 150000,
      discountAmountPerDay: 0,
    });
  });

  it.each([
    // pricePerDay, newPriceSum, percent(frontend), expected effective per-day
    [500000, 400000, 20, 400000], // vazifada berilgan realistik misol
    [150000, 140000, 7, 140000], // xona bilan bir xil yaxlitlash holati
  ])(
    'price_per_day %i with approved new price %i (percent %i) is charged exactly %i per day',
    (pricePerDay, newPriceSum, percent, expected) => {
      const result = calculateVehiclePrice(
        pricePerDay,
        vehiclePromo(pricePerDay, newPriceSum, percent),
      );
      expect(result.effectivePricePerDay).toBe(expected);
      expect(result.basePricePerDay).toBe(pricePerDay);
      expect(result.discountAmountPerDay).toBe(pricePerDay - expected);
    },
  );

  it('a 3-day rental multiplies the discounted per-day rate, not the base rate (duration model proof)', () => {
    const result = calculateVehiclePrice(
      500000,
      vehiclePromo(500000, 400000, 20),
    );
    const days = 3;
    expect(result.effectivePricePerDay * days).toBe(1200000);
    expect(result.basePricePerDay * days).toBe(1500000);
    // Boshqa davomiylik (masalan 1 kun) bir xil promotion qatoridan bir xil
    // kunlik stavka bilan qayta foydalanadi — "jami ijara summasi" modeli
    // bunga imkon bermaydi, chunki promotion'da davomiylik tushunchasi yo'q.
    expect(result.effectivePricePerDay * 1).toBe(400000);
  });

  it('stays pinned to the approved per-day price when price_per_day later increases (floats with current price, never repriced at approval)', () => {
    const active = vehiclePromo(150000, 140000, 7);
    expect(calculateVehiclePrice(150000, active).effectivePricePerDay).toBe(
      140000,
    );
    expect(calculateVehiclePrice(200000, active)).toEqual({
      basePricePerDay: 200000,
      effectivePricePerDay: 140000,
      discountAmountPerDay: 60000,
    });
  });

  it('never charges above the CURRENT price_per_day when it drops below the approved promotion price', () => {
    expect(
      calculateVehiclePrice(100000, vehiclePromo(150000, 140000, 7)),
    ).toEqual({
      basePricePerDay: 100000,
      effectivePricePerDay: 100000,
      discountAmountPerDay: 0,
    });
  });

  it('falls back to the stored percent only when new_price_sum is unusable', () => {
    const broken: ActiveVehiclePromotion = {
      ...vehiclePromo(150000, 140000, 20),
      new_price_sum: Number.NaN,
    };
    expect(calculateVehiclePrice(150000, broken)).toEqual({
      basePricePerDay: 150000,
      effectivePricePerDay: 120000,
      discountAmountPerDay: 30000,
    });
  });

  it('a zero/negative price_per_day never produces a negative charge', () => {
    expect(calculateVehiclePrice(0, vehiclePromo(150000, 140000, 7))).toEqual({
      basePricePerDay: 0,
      effectivePricePerDay: 0,
      discountAmountPerDay: 0,
    });
    expect(calculateVehiclePrice(-1, vehiclePromo(150000, 140000, 7))).toEqual({
      basePricePerDay: 0,
      effectivePricePerDay: 0,
      discountAmountPerDay: 0,
    });
    expect(
      calculateVehiclePrice('not-a-number', vehiclePromo(150000, 140000, 7)),
    ).toEqual({
      basePricePerDay: 0,
      effectivePricePerDay: 0,
      discountAmountPerDay: 0,
    });
  });
});

describe('activeVehiclePromotionPredicate — status/sana darvozasi xona bilan bir xil', () => {
  it('only published promotions inside the current date window are eligible', () => {
    const sql = activeVehiclePromotionPredicate('p');
    expect(sql).toContain("p.entity_type = 'vehicle'");
    expect(sql).toContain('p.status = \'published\'::"PromotionStatus"');
    expect(sql).toContain('p.start_date <= CURRENT_DATE');
    expect(sql).toContain('p.end_date >= CURRENT_DATE');
    expect(sql).not.toContain('pending_review');
    expect(sql).not.toContain('rejected');
    expect(sql).not.toContain('approved');
  });

  it('scopes to a single vehicle when a vehicle-id expression is supplied', () => {
    expect(activeVehiclePromotionPredicate('p', 'v.id')).toContain(
      'p.entity_id = v.id',
    );
  });

  it('is composed from the shared livePromotionPredicate(), so the vehicle pricing gate and the admin delete gate cannot drift apart', () => {
    expect(activeVehiclePromotionPredicate('p')).toContain(
      livePromotionPredicate('p'),
    );
  });
});
