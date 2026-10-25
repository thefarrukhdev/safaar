import {
  Controller,
  Get,
  NotFoundException,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
@Controller(['metrics', 'v1/metrics'])
export class MetricsController {
  private readonly metricsToken?: string;
  private readonly enabled: boolean;

  constructor(
    private readonly metricsService: MetricsService,
    config: ConfigService,
  ) {
    this.metricsToken = config.get<string>('METRICS_TOKEN');
    this.enabled = config.get<string>('METRICS_ENABLED', 'true') !== 'false';
  }

  @Get()
  @SkipThrottle()
  async getMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.enabled) {
      throw new NotFoundException({
        code: 'METRICS_DISABLED',
        message: 'Prometheus metrics endpoint is disabled',
      });
    }

    if (this.metricsToken) {
      const authHeader = getHeaderString(req.headers['authorization']);
      const customToken = getHeaderString(req.headers['x-metrics-token']);
      const bearerToken =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : undefined;
      const headerToken = customToken ? customToken.trim() : undefined;

      const receivedToken = bearerToken || headerToken;
      if (!receivedToken || receivedToken !== this.metricsToken) {
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED_METRICS',
          message: 'Invalid or missing metrics authentication token',
        });
      }
    }

    const output = await this.metricsService.getMetrics();
    res.setHeader('Content-Type', this.metricsService.contentType);
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, max-age=0',
    );
    res.send(output);
  }
}

function getHeaderString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}
