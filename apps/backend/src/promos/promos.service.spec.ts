import { PostgresService } from '../infrastructure/postgres.service';
import { calculatePromoDiscount, PromosService } from './promos.service';

type QueryCall = [sql: string, params?: readonly unknown[]];
const queryCallsOf = (obj: { query: unknown }): QueryCall[] =>
  (obj.query as jest.Mock).mock.calls as QueryCall[];

describe('PromosService.redeem (regression: H-2 usage_limit was decorative)', () => {
  let pg: { query: jest.Mock };
  let service: PromosService;

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PromosService(pg as unknown as PostgresService);
  });

  it('increments used_count atomically when still under the limit', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'promo-1' }]);

    const result = await service.redeem('ONE_USE');

    expect(result).toBe(true);
    const [sql, params] = queryCallsOf(pg)[0];
    expect(String(sql)).toContain('jsonb_set');
    expect(String(sql)).toContain('usedCount');
    expect(params).toEqual(['one_use']);
  });

  it('returns false (does not redeem) once the usage limit is reached', async () => {
    pg.query.mockResolvedValueOnce([]); // WHERE bound check excluded the row

    const result = await service.redeem('ONE_USE');

    expect(result).toBe(false);
  });

  it('returns false for an empty code without querying the database', async () => {
    const result = await service.redeem('   ');

    expect(result).toBe(false);
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('the same UPDATE statement enforces the cap in its own WHERE clause (no separate check-then-write)', async () => {
    pg.query.mockResolvedValueOnce([{ id: 'promo-1' }]);

    await service.redeem('ONE_USE');

    const [sql] = queryCallsOf(pg)[0];
    expect(String(sql)).toContain('usageLimit');
    expect(String(sql).toLowerCase()).toContain('update cms_entries');
  });
});

describe('PromosService.validate', () => {
  let pg: { query: jest.Mock };
  let service: PromosService;

  beforeEach(() => {
    pg = { query: jest.fn() };
    service = new PromosService(pg as unknown as PostgresService);
  });

  it('does not increment used_count merely by validating (read-only check)', async () => {
    pg.query.mockResolvedValueOnce([
      {
        id: 'promo-1',
        code: 'ONE_USE',
        discount_type: 'percentage',
        discount_value: 10,
        usage_limit: 1,
        used_count: 0,
        valid_until: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ]);

    const result = await service.validate({ code: 'ONE_USE' });

    expect(result.valid).toBe(true);
    const [sql] = queryCallsOf(pg)[0];
    expect(String(sql).toLowerCase()).toContain('select');
    expect(String(sql).toLowerCase()).not.toContain('update');
  });

  it('reports invalid once used_count has reached usage_limit', async () => {
    pg.query.mockResolvedValueOnce([
      {
        id: 'promo-1',
        code: 'ONE_USE',
        discount_type: 'percentage',
        discount_value: 10,
        usage_limit: 1,
        used_count: 1,
        valid_until: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ]);

    const result = await service.validate({ code: 'ONE_USE' });

    expect(result.valid).toBe(false);
  });

  it('rejects promo code for room with an active promotion (anti-stacking rule for any promo code)', async () => {
    // 1. Promo lookup succeeds
    pg.query.mockResolvedValueOnce([
      {
        id: 'promo-1',
        code: 'PROMO2025',
        discount_type: 'percentage',
        discount_value: 15,
        usage_limit: 100,
        used_count: 0,
        valid_until: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ]);
    // 2. Active room promotion found
    pg.query.mockResolvedValueOnce([
      {
        id: 'promo-active-1',
        entity_id: '4823084c-8c33-4cc9-828d-7d20e4d9df8f',
        old_price_sum: 400000,
        new_price_sum: 200000,
        discount_percent: 50,
        end_date: '2026-10-08',
      },
    ]);

    const result = await service.validate({
      code: 'PROMO2025',
      roomId: '4823084c-8c33-4cc9-828d-7d20e4d9df8f',
    });

    expect(result.valid).toBe(false);
    expect(result.discount_value).toBe(0);
    expect(result.reason).toBe('PROMO_STACKING_NOT_ALLOWED');
  });

  it('accepts promo code for room without an active promotion', async () => {
    // 1. Promo lookup succeeds
    pg.query.mockResolvedValueOnce([
      {
        id: 'promo-1',
        code: 'PROMO2025',
        discount_type: 'percentage',
        discount_value: 15,
        usage_limit: 100,
        used_count: 0,
        valid_until: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ]);
    // 2. No active room promotion found
    pg.query.mockResolvedValueOnce([]);

    const result = await service.validate({
      code: 'PROMO2025',
      roomId: 'aae5566b-1a81-454a-9697-3a67deda247e',
    });

    expect(result.valid).toBe(true);
    expect(result.discount_value).toBe(15);
    expect(result.discount_type).toBe('percentage');
  });

  it('rejects promo code for vehicle with an active promotion', async () => {
    // 1. Promo lookup succeeds
    pg.query.mockResolvedValueOnce([
      {
        id: 'promo-1',
        code: 'AUTO10',
        discount_type: 'percentage',
        discount_value: 10,
        usage_limit: 50,
        used_count: 0,
        valid_until: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ]);
    // 2. Active vehicle promotion found
    pg.query.mockResolvedValueOnce([
      {
        id: 'vpromo-1',
        entity_id: 'vehicle-1',
        old_price_sum: 500000,
        new_price_sum: 350000,
        discount_percent: 30,
        end_date: '2026-10-10',
      },
    ]);

    const result = await service.validate({
      code: 'AUTO10',
      vehicleId: 'vehicle-1',
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('PROMO_STACKING_NOT_ALLOWED');
  });
});

describe('calculatePromoDiscount (regression: percent discountType)', () => {
  it('computes percentage discount when discountType is "percentage"', () => {
    expect(calculatePromoDiscount(200_000, 'percentage', 10)).toBe(20_000);
  });

  it('computes percentage discount when discountType is "percent" (seed/admin alias)', () => {
    expect(calculatePromoDiscount(200_000, 'percent', 20)).toBe(40_000);
  });

  it('computes fixed amount discount when discountType is "fixed"', () => {
    expect(calculatePromoDiscount(200_000, 'fixed', 50_000)).toBe(50_000);
  });

  it('caps discount at subtotal so total does not become negative', () => {
    expect(calculatePromoDiscount(30_000, 'fixed', 50_000)).toBe(30_000);
    expect(calculatePromoDiscount(100_000, 'percent', 150)).toBe(100_000);
  });

  it('returns 0 for invalid or non-positive discount values', () => {
    expect(calculatePromoDiscount(100_000, 'percent', 0)).toBe(0);
    expect(calculatePromoDiscount(100_000, 'percent', -10)).toBe(0);
    expect(calculatePromoDiscount(100_000, 'percent', NaN)).toBe(0);
    expect(calculatePromoDiscount(100_000, null, 10)).toBe(0);
  });
});
