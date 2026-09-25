import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@safaar/types';
import { CurrentActor, type RequestActor } from '../common/actor';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import type { UploadedFile as UploadedFilePayload } from '../uploads/uploads.service';
import { CreateReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller('reviews')
@UseGuards(RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // `/reviews/summary` PARAMETRLI marshrutlardan OLDIN e'lon qilinadi,
  // aks holda kelajakda qo'shiladigan `@Get(':id')` uni "soyalab"
  // qo'yishi mumkin.
  @Get('summary')
  summary(@Query() query: Record<string, string | undefined>) {
    return this.reviewsService.summary(query);
  }

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    return this.reviewsService.list(query);
  }

  // Sharh qoldirish LOGIN talab qiladi (mahsulot qarori o'zgardi —
  // guest sharh yozolmaydi; "BACKEND — REVIEW CREATION AUTH REQUIRED"
  // topshirig'i). `@Roles(Role.USER)` bo'lmasa RolesGuard token yo'q/
  // yaroqsiz bo'lganda standart 401 AUTH_TOKEN_INVALID qaytaradi —
  // request reviewsService.create()ga yetib bormaydi, DB'ga yozilmaydi.
  @Post()
  @Roles(Role.USER)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(actor, dto);
  }

  // Rasm yuklash LOGIN TALAB QILADI: `media_files.owner_id` UUID NOT NULL
  // va `uploads.createForOwner` real actor id talab qiladi. Soxta
  // "guest" UUID yaratilmaydi — mehmon sharhida photos doim [].
  @Post('photos')
  @UseInterceptors(
    FilesInterceptor('photos', 5, { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @Roles(Role.USER)
  photos(
    @CurrentActor() actor: RequestActor | undefined,
    @UploadedFiles() files?: UploadedFilePayload[],
  ) {
    return this.reviewsService.photos(actor, files ?? []);
  }

  @Patch(':id')
  @Roles(Role.USER)
  update(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.reviewsService.update(actor, id, body);
  }

  @Delete(':id')
  @Roles(Role.USER, Role.ADMIN, Role.SUPER_ADMIN)
  delete(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.reviewsService.delete(actor, id);
  }

  @Post(':id/reply')
  @Roles(Role.PARTNER)
  reply(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.reviewsService.reply(actor, id, body);
  }
}
