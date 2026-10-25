import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { MetricsController } from './metrics.controller';
import type { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let mockMetricsService: Partial<MetricsService>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockMetricsService = {
      getMetrics: jest
        .fn()
        .mockResolvedValue('# HELP safaar_http_requests_total\n'),
      contentType: 'text/plain; version=0.0.4; charset=utf-8',
    };

    mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
  });

  it('returns metrics when enabled and no token is required', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'METRICS_ENABLED') return 'true';
        if (key === 'METRICS_TOKEN') return undefined;
        return undefined;
      }),
    } as unknown as ConfigService;

    const controller = new MetricsController(
      mockMetricsService as MetricsService,
      config,
    );

    const req = { headers: {} } as unknown as Request;
    await controller.getMetrics(req, mockRes as Response);

    expect(mockMetricsService.getMetrics).toHaveBeenCalled();
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, max-age=0',
    );
    expect(mockRes.send).toHaveBeenCalledWith(
      '# HELP safaar_http_requests_total\n',
    );
  });

  it('throws NotFoundException when METRICS_ENABLED is false', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'METRICS_ENABLED') return 'false';
        return undefined;
      }),
    } as unknown as ConfigService;

    const controller = new MetricsController(
      mockMetricsService as MetricsService,
      config,
    );

    const req = { headers: {} } as unknown as Request;
    await expect(
      controller.getMetrics(req, mockRes as Response),
    ).rejects.toThrow(NotFoundException);
  });

  describe('when METRICS_TOKEN is configured', () => {
    let controller: MetricsController;

    beforeEach(() => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'METRICS_ENABLED') return 'true';
          if (key === 'METRICS_TOKEN') return 'secret-telemetry-token';
          return undefined;
        }),
      } as unknown as ConfigService;

      controller = new MetricsController(
        mockMetricsService as MetricsService,
        config,
      );
    });

    it('rejects if no token is provided', async () => {
      const req = { headers: {} } as unknown as Request;
      await expect(
        controller.getMetrics(req, mockRes as Response),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects if an invalid token is provided', async () => {
      const req = {
        headers: { authorization: 'Bearer wrong-token' },
      } as unknown as Request;
      await expect(
        controller.getMetrics(req, mockRes as Response),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('succeeds with valid Bearer token', async () => {
      const req = {
        headers: { authorization: 'Bearer secret-telemetry-token' },
      } as unknown as Request;
      await controller.getMetrics(req, mockRes as Response);

      expect(mockRes.send).toHaveBeenCalledWith(
        '# HELP safaar_http_requests_total\n',
      );
    });

    it('succeeds with valid x-metrics-token header', async () => {
      const req = {
        headers: { 'x-metrics-token': 'secret-telemetry-token' },
      } as unknown as Request;
      await controller.getMetrics(req, mockRes as Response);

      expect(mockRes.send).toHaveBeenCalledWith(
        '# HELP safaar_http_requests_total\n',
      );
    });
  });
});
