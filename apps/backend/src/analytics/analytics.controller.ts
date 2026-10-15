import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@safaar/types';
import { buildActorFromHeaders } from '../common/actor';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AnalyticsService } from './analytics.service';

interface AnalyticsRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @ApiOperation({ summary: 'Mijoz analitika voqeasini qabul qilish' })
  event(
    @Req() request: AnalyticsRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = buildActorFromHeaders(request.headers);
    return this.analyticsService.ingest(actor, body, {
      userAgent: firstHeader(request.headers['user-agent']),
      ip:
        firstHeader(request.headers['x-forwarded-for']) ??
        request.ip ??
        request.socket?.remoteAddress,
      sessionId: firstHeader(request.headers['x-session-id']),
    });
  }
}

@ApiTags('Admin Analytics')
@Controller('admin/analytics')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AnalyticsAdminController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Umumiy tahlil: faol foydalanuvchilar, bugungi bronlar va tushum (Gross Revenue, komissiya)',
  })
  overview(@Query() query: Record<string, string | undefined>) {
    return this.analyticsService.overview(query);
  }

  @Get('funnel')
  @ApiOperation({
    summary:
      'Konversiya voronkasi: Qidiruv -> Ko‘rish -> Bron boshlash -> To‘lov muvaffaqiyati',
  })
  funnel(@Query() query: Record<string, string | undefined>) {
    return this.analyticsService.funnelReport(query);
  }

  @Get('top-destinations')
  @ApiOperation({
    summary:
      'Eng ko‘p qidirilgan va eng ko‘p bron qilingan TOP-10 shaharlar hamda mehmonxonalar',
  })
  topDestinations(@Query() query: Record<string, string | undefined>) {
    return this.analyticsService.topDestinations(query);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Birlashtirilgan umumiy dashboard tahlili (Legacy)',
  })
  dashboard(@Query() query: Record<string, string | undefined>) {
    return this.analyticsService.dashboard(query);
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
