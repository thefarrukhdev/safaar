import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PerformanceInterceptor } from './common/performance.interceptor';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HotelsModule } from './hotels/hotels.module';
import { BookingsModule } from './bookings/bookings.module';
import { PartnersModule } from './partners/partners.module';
import { AdminModule } from './admin/admin.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { CatalogModule } from './catalog/catalog.module';
import { BusesModule } from './buses/buses.module';
import { PaymentsModule } from './payments/payments.module';
import { RefundsModule } from './refunds/refunds.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SupportModule } from './support/support.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ExportsModule } from './exports/exports.module';
import { UploadsModule } from './uploads/uploads.module';
import { CmsModule } from './cms/cms.module';
import { PromosModule } from './promos/promos.module';
import { PartnerApiModule } from './partner-api/partner-api.module';
import { StatsModule } from './stats/stats.module';
import { RealtimeModule } from './realtime/realtime.module';
import { CurrencyModule } from './currency/currency.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ChatModule } from './chat/chat.module';
import { JobsModule } from './jobs/jobs.module';
import { AiTranslateModule } from './ai-translate/ai-translate.module';
import { validateEnv } from './config/env.validation';
import { MaintenanceGuard } from './common/maintenance.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        'apps/backend/.env.local',
        'apps/backend/.env',
        '.env.local',
        '.env',
      ],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    ScheduleModule.forRoot(),
    InfrastructureModule,
    JobsModule,
    AuthModule,
    CatalogModule,
    UsersModule,
    PartnersModule,
    HotelsModule,
    BusesModule,
    BookingsModule,
    PaymentsModule,
    RefundsModule,
    ReviewsModule,
    SupportModule,
    NotificationsModule,
    ExportsModule,
    UploadsModule,
    CmsModule,
    PromosModule,
    PartnerApiModule,
    StatsModule,
    CurrencyModule,
    AnalyticsModule,
    AdminModule,
    RealtimeModule,
    ChatModule,
    AiTranslateModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
  ],
})
export class AppModule {}
