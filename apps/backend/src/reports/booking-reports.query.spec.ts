import {
  computeBookingReport,
  computeBookingReportByPartner,
} from './booking-reports.query';

type QueryCall = [sql: string, params?: readonly unknown[]];
const queryCallsOf = (fn: jest.Mock): QueryCall[] =>
  fn.mock.calls as QueryCall[];

function domainRow(overrides: Record<string, unknown> = {}) {
  return {
    domain: 'hotel',
    total_bookings: '0',
    online_count: '0',
    onsite_count: '0',
    cancelled_count: '0',
    refunded_count: '0',
    gross_amount: '0',
    paid_amount: '0',
    refunded_amount: '0',
    ...overrides,
  };
}

describe('computeBookingReport (PARTNERS-REPORTS: shared aggregation used by both GET /partners/reports and GET /admin/partner-reports)', () => {
  let pg: { query: jest.Mock };

  beforeEach(() => {
    pg = { query: jest.fn() };
  });

  it('scopes the query to organizationId when provided (partner-side call)', async () => {
    pg.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await computeBookingReport(pg, { organizationId: 'org-1' });

    const [sql, params] = queryCallsOf(pg.query)[0];
    expect(sql).toContain('b.partner_organization_id = $1::uuid');
    expect(params).toEqual(['org-1']);
  });

  it('omits the organization filter entirely when organizationId is not provided (admin "all partners" call)', async () => {
    pg.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await computeBookingReport(pg, {});

    const [sql, params] = queryCallsOf(pg.query)[0];
    expect(sql).not.toContain('partner_organization_id');
    expect(params).toEqual([]);
  });

  it('rejects an invalid `from` date without hitting the database', async () => {
    await expect(
      computeBookingReport(pg, { from: 'not-a-date' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'REPORT_FROM_INVALID' },
    });
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('rejects an invalid `domain` value without hitting the database', async () => {
    await expect(
      computeBookingReport(pg, { domain: 'spaceship' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'REPORT_DOMAIN_INVALID' },
    });
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('always returns all 4 known domains, even when the database has rows for only some of them (zero-filled, not omitted)', async () => {
    pg.query
      .mockResolvedValueOnce([
        domainRow({
          domain: 'hotel',
          total_bookings: '3',
          gross_amount: '900000',
        }),
      ])
      .mockResolvedValueOnce([]);

    const result = await computeBookingReport(pg, {});

    expect(result.domains.map((d) => d.domain)).toEqual([
      'hotel',
      'restaurant',
      'bus',
      'vehicle',
    ]);
    expect(result.domains.find((d) => d.domain === 'hotel')).toMatchObject({
      totalBookings: 3,
      grossAmount: 900000,
    });
    expect(result.domains.find((d) => d.domain === 'restaurant')).toMatchObject(
      {
        totalBookings: 0,
        grossAmount: 0,
      },
    );
  });

  it('sums the domain rows into a correct overall summary (money totals included)', async () => {
    pg.query
      .mockResolvedValueOnce([
        domainRow({
          domain: 'hotel',
          total_bookings: '2',
          online_count: '1',
          onsite_count: '1',
          gross_amount: '800000',
          paid_amount: '500000',
        }),
        domainRow({
          domain: 'restaurant',
          total_bookings: '1',
          cancelled_count: '1',
          refunded_count: '1',
          gross_amount: '100000',
          refunded_amount: '100000',
        }),
      ])
      .mockResolvedValueOnce([]);

    const result = await computeBookingReport(pg, {});

    expect(result.summary).toEqual({
      totalBookings: 3,
      onlineCount: 1,
      onsiteCount: 1,
      cancelledCount: 1,
      refundedCount: 1,
      grossAmount: 900000,
      paidAmount: 500000,
      refundedAmount: 100000,
    });
    expect(result.currency).toBe('UZS');
  });

  it('returns an all-zero summary and daily=[] for a partner with no bookings at all (empty result)', async () => {
    pg.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await computeBookingReport(pg, {
      organizationId: 'org-empty',
    });

    expect(result.summary.totalBookings).toBe(0);
    expect(result.summary.grossAmount).toBe(0);
    expect(result.domains.every((d) => d.totalBookings === 0)).toBe(true);
    expect(result.daily).toEqual([]);
  });

  it('maps the daily breakdown rows correctly', async () => {
    pg.query.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        date: '2026-09-20',
        total_bookings: '2',
        gross_amount: '400000',
        paid_amount: '400000',
      },
      {
        date: '2026-09-21',
        total_bookings: '1',
        gross_amount: '100000',
        paid_amount: '0',
      },
    ]);

    const result = await computeBookingReport(pg, {});

    expect(result.daily).toEqual([
      {
        date: '2026-09-20',
        totalBookings: 2,
        grossAmount: 400000,
        paidAmount: 400000,
      },
      {
        date: '2026-09-21',
        totalBookings: 1,
        grossAmount: 100000,
        paidAmount: 0,
      },
    ]);
  });

  it('applies the domain filter as a CASE-expression equality check, not a raw column filter (since bookings.type alone cannot distinguish bus from vehicle)', async () => {
    pg.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await computeBookingReport(pg, { domain: 'vehicle' });

    const [sql, params] = queryCallsOf(pg.query)[0];
    expect(sql).toContain(
      "WHEN b.type = 'bus' AND b.vehicle_id IS NOT NULL THEN 'vehicle'",
    );
    expect(params).toContain('vehicle');
  });

  it('passes payment method and status filters through as parameterized equality checks', async () => {
    pg.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await computeBookingReport(pg, {
      paymentMethod: 'cash',
      status: 'completed',
    });

    const [sql, params] = queryCallsOf(pg.query)[0];
    expect(sql).toContain('b.payment_method::text = $1');
    expect(sql).toContain('b.status::text = $2');
    expect(params).toEqual(['cash', 'completed']);
  });
});

describe('computeBookingReportByPartner (admin "all partners" breakdown)', () => {
  let pg: { query: jest.Mock };

  beforeEach(() => {
    pg = { query: jest.fn() };
  });

  it('joins partner_organizations for a human-readable name and groups by (partner, domain)', async () => {
    pg.query.mockResolvedValueOnce([
      {
        organization_id: 'org-1',
        partner_name: 'Hyatt Regency Tashkent',
        domain: 'hotel',
        total_bookings: '5',
        online_count: '4',
        onsite_count: '1',
        cancelled_count: '0',
        refunded_count: '0',
        gross_amount: '2500000',
        paid_amount: '2500000',
        refunded_amount: '0',
      },
    ]);

    const result = await computeBookingReportByPartner(pg, {});

    expect(result).toEqual([
      {
        organizationId: 'org-1',
        partnerName: 'Hyatt Regency Tashkent',
        domain: 'hotel',
        totalBookings: 5,
        onlineCount: 4,
        onsiteCount: 1,
        cancelledCount: 0,
        refundedCount: 0,
        grossAmount: 2500000,
        paidAmount: 2500000,
        refundedAmount: 0,
      },
    ]);
    const [sql] = queryCallsOf(pg.query)[0];
    expect(sql).toContain('LEFT JOIN partner_organizations po');
    expect(sql).toContain('GROUP BY bd.partner_organization_id');
  });

  it('returns an empty array when no bookings match (e.g. a brand-new partner)', async () => {
    pg.query.mockResolvedValueOnce([]);

    const result = await computeBookingReportByPartner(pg, {
      organizationId: 'org-new',
    });

    expect(result).toEqual([]);
  });
});
