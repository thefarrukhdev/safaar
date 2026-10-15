import { BadRequestException } from '@nestjs/common';
import { Role } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import { PostgresService } from '../infrastructure/postgres.service';
import {
  AnalyticsAdminController,
  AnalyticsController,
} from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService and Controllers', () => {
  let service: AnalyticsService;
  let adminController: AnalyticsAdminController;
  let controller: AnalyticsController;
  let pg: { query: jest.Mock };

  beforeEach(() => {
    pg = {
      query: jest.fn(),
    };
    service = new AnalyticsService(pg as unknown as PostgresService);
    adminController = new AnalyticsAdminController(service);
    controller = new AnalyticsController(service);
  });

  describe('ingest (Public / Client Event Logging)', () => {
    it('accepts and persists a valid analytics event', async () => {
      pg.query.mockResolvedValueOnce([]);

      const actor: RequestActor = {
        id: '11111111-1111-1111-1111-111111111111',
        actorType: 'user',
        role: Role.USER,
        roles: [Role.USER],
      };

      const result = await service.ingest(
        actor,
        {
          eventName: 'search.performed',
          params: { city: 'Samarqand', guests: 2 },
          timestamp: '2026-10-15T10:00:00.000Z',
        },
        {
          ip: '127.0.0.1, 192.168.1.1',
          userAgent: 'Mozilla/5.0',
          sessionId: 'sess-123',
        },
      );

      expect(result.accepted).toBe(true);
      expect(result.eventName).toBe('search.performed');
      expect(result.userId).toBe('11111111-1111-1111-1111-111111111111');
      expect(result.sessionId).toBe('sess-123');
      expect(result.timestamp).toBe('2026-10-15T10:00:00.000Z');

      expect(pg.query).toHaveBeenCalledTimes(1);
      const call = pg.query.mock.calls[0];
      expect(call[0]).toContain('INSERT INTO analytics_events');
      expect(call[1][3]).toBe('search.performed');
      expect(call[1][8]).toBe('127.0.0.1');
    });

    it('rejects event with empty eventName', async () => {
      await expect(
        service.ingest(undefined, { eventName: '   ' }, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects event with eventName longer than 120 characters', async () => {
      const longName = 'a'.repeat(121);
      await expect(
        service.ingest(undefined, { eventName: longName }, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordEvent (Server-side Event Logger)', () => {
    it('persists server-side event without throwing', async () => {
      pg.query.mockResolvedValueOnce([]);

      await service.recordEvent({
        eventName: 'booking.created',
        userId: '22222222-2222-2222-2222-222222222222',
        params: { bookingNumber: 'BK-100', amount: 500000 },
        ip: '10.0.0.1',
      });

      expect(pg.query).toHaveBeenCalledTimes(1);
      const call = pg.query.mock.calls[0];
      expect(call[0]).toContain('INSERT INTO analytics_events');
      expect(call[1][3]).toBe('booking.created');
      expect(call[1][1]).toBe('22222222-2222-2222-2222-222222222222');
    });

    it('gracefully catches error if database query fails and does not throw', async () => {
      pg.query.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(
        service.recordEvent({
          eventName: 'payment.success',
          params: { transactionId: 'tx-999' },
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('overview (Admin Overview API)', () => {
    it('returns calculated DAU, WAU, bookings stats and revenue', async () => {
      pg.query
        .mockResolvedValueOnce([{ active_today: 15, active_week: 80 }])
        .mockResolvedValueOnce([
          {
            today_total: 10,
            today_paid: 8,
            today_gross: 2400000,
            today_net_commission: 288000,
          },
        ]);

      const result = await service.overview({});

      expect(result.activeUsers.today).toBe(15);
      expect(result.activeUsers.thisWeek).toBe(80);
      expect(result.bookings.todayTotal).toBe(10);
      expect(result.bookings.todayPaid).toBe(8);
      expect(result.revenue.todayGross).toBe(2400000);
      expect(result.revenue.todayNetCommission).toBe(288000);
      expect(result.revenue.currency).toBe('UZS');
    });

    it('handles query failures gracefully by falling back to zero counts', async () => {
      pg.query
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'));

      const result = await service.overview({});

      expect(result.activeUsers.today).toBe(0);
      expect(result.activeUsers.thisWeek).toBe(0);
      expect(result.bookings.todayTotal).toBe(0);
      expect(result.bookings.todayPaid).toBe(0);
      expect(result.revenue.todayGross).toBe(0);
      expect(result.revenue.todayNetCommission).toBe(0);
    });
  });

  describe('funnelReport (Admin Funnel API)', () => {
    it('calculates conversion percentages between funnel stages', async () => {
      pg.query.mockResolvedValueOnce([
        {
          event_name: 'search_performed',
          events_count: 100,
          sessions_count: 80,
        },
        { event_name: 'hotel_viewed', events_count: 50, sessions_count: 40 },
        { event_name: 'booking_started', events_count: 20, sessions_count: 16 },
        {
          event_name: 'booking_completed',
          events_count: 10,
          sessions_count: 8,
        },
      ]);

      const result = await service.funnelReport({ days: '14' });

      expect(result.window.days).toBe(14);
      expect(result.steps).toHaveLength(4);

      // search_performed has no previous step
      expect(result.steps[0].conversionFromPrevious).toBeNull();
      // hotel_viewed: 40 / 80 = 0.5
      expect(result.steps[1].conversionFromPrevious).toBe(0.5);
      // booking_started: 16 / 40 = 0.4
      expect(result.steps[2].conversionFromPrevious).toBe(0.4);
      // booking_completed: 8 / 16 = 0.5
      expect(result.steps[3].conversionFromPrevious).toBe(0.5);
    });
  });

  describe('topDestinations (Admin Top Destinations API)', () => {
    it('returns top searched locations, top booked hotels, and top booked cities', async () => {
      pg.query
        .mockResolvedValueOnce([
          { destination: 'Samarqand', searches: 120 },
          { destination: 'Buxoro', searches: 90 },
        ])
        .mockResolvedValueOnce([
          {
            hotel_id: 'hotel-1',
            name: 'Grand Samarkand',
            slug: 'grand-samarkand',
            address: 'Amir Temur 10',
            bookings_count: 45,
            total_revenue: 12500000,
          },
        ])
        .mockResolvedValueOnce([
          {
            city_id: 'city-1',
            name: 'Samarqand',
            slug: 'samarkand',
            bookings_count: 60,
            total_revenue: 18000000,
          },
        ]);

      const result = await service.topDestinations({ days: '30' });

      expect(result.topSearches).toHaveLength(2);
      expect(result.topHotels).toHaveLength(1);
      expect(result.topCities).toHaveLength(1);
      expect(result.topHotels[0].name).toBe('Grand Samarkand');
      expect(result.topCities[0].name).toBe('Samarqand');
    });
  });

  describe('AnalyticsControllers routing', () => {
    it('AnalyticsAdminController delegates calls to service methods', async () => {
      const overviewSpy = jest
        .spyOn(service, 'overview')
        .mockResolvedValueOnce({
          window: { todayStart: '', weekStart: '', now: '' },
          activeUsers: { today: 1, thisWeek: 2 },
          bookings: { todayTotal: 3, todayPaid: 2 },
          revenue: { todayGross: 100, todayNetCommission: 10, currency: 'UZS' },
        });
      const funnelSpy = jest
        .spyOn(service, 'funnelReport')
        .mockResolvedValueOnce({
          window: { days: 30, since: '', until: '' },
          steps: [],
        });
      const topDestSpy = jest
        .spyOn(service, 'topDestinations')
        .mockResolvedValueOnce({
          window: { days: 30, since: '', until: '' },
          topSearches: [],
          topHotels: [],
          topCities: [],
        });
      const dashboardSpy = jest
        .spyOn(service, 'dashboard')
        .mockResolvedValueOnce({
          window: { days: 30, since: '', until: '' },
          conversionFunnel: [],
          popularDestinations: [],
          paymentMethodShares: [],
        });

      await adminController.overview({});
      expect(overviewSpy).toHaveBeenCalled();

      await adminController.funnel({});
      expect(funnelSpy).toHaveBeenCalled();

      await adminController.topDestinations({});
      expect(topDestSpy).toHaveBeenCalled();

      await adminController.dashboard({});
      expect(dashboardSpy).toHaveBeenCalled();
    });

    it('AnalyticsController delegates events to ingest', async () => {
      const ingestSpy = jest.spyOn(service, 'ingest').mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000000001',
        accepted: true,
        eventName: 'test',
        userId: null,
        sessionId: null,
        timestamp: '',
      });

      const req = {
        headers: { 'user-agent': 'Chrome', 'x-forwarded-for': '1.1.1.1' },
      };
      await controller.event(req, { eventName: 'test' });
      expect(ingestSpy).toHaveBeenCalled();
    });
  });
});
