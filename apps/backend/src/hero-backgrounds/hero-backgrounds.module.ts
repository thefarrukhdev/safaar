import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { HeroBackgroundsAdminController } from './hero-backgrounds-admin.controller';
import { HeroBackgroundsController } from './hero-backgrounds.controller';
import { HeroBackgroundsService } from './hero-backgrounds.service';

@Module({
  imports: [InfrastructureModule],
  controllers: [HeroBackgroundsController, HeroBackgroundsAdminController],
  providers: [HeroBackgroundsService],
  exports: [HeroBackgroundsService],
})
export class HeroBackgroundsModule {}
