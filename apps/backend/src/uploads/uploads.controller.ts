import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Role } from '@safaar/types';
import { CurrentActor, type RequestActor } from '../common/actor';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import {
  UploadsService,
  type UploadedFile as UploadedFilePayload,
} from './uploads.service';
import { CreateMediaDto, PresignUploadDto } from './dto/upload.dto';

@Controller('uploads')
@UseGuards(RolesGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('images')
  @UseInterceptors(
    AnyFilesInterceptor({ limits: { fileSize: 5 * 1024 * 1024, files: 10 } }),
  )
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  async image(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: CreateMediaDto,
    @UploadedFiles() files?: UploadedFilePayload[],
  ) {
    if (files && files.length > 1) {
      const items = await this.uploadsService.createMany(
        actor,
        'image',
        files,
        body,
      );
      return {
        items,
        count: items.length,
        id: items[0]?.id,
        url: items[0]?.url,
        mime_type: items[0]?.mime_type,
        size: items[0]?.size,
        visibility: items[0]?.visibility,
        caption: items[0]?.caption,
      };
    }
    const singleFile = files?.[0];
    const created = await this.uploadsService.create(
      actor,
      'image',
      body,
      singleFile,
    );
    return {
      ...created,
      items: [created],
      count: 1,
    };
  }

  @Post('images/batch')
  @UseInterceptors(
    AnyFilesInterceptor({ limits: { fileSize: 5 * 1024 * 1024, files: 10 } }),
  )
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  async batchImages(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: CreateMediaDto,
    @UploadedFiles() files?: UploadedFilePayload[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException({
        code: 'IMAGE_UPLOAD_REQUIRED',
        message: 'Kamida bitta rasm yuklanishi kerak',
      });
    }
    const items = await this.uploadsService.createMany(
      actor,
      'image',
      files,
      body,
    );
    return { items, count: items.length };
  }

  @Post('documents')
  @Roles(Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  document(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: CreateMediaDto,
  ) {
    return this.uploadsService.create(actor, 'document', body);
  }

  @Post('presign')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  presign(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: PresignUploadDto,
  ) {
    return this.uploadsService.presign(actor, body);
  }

  @Delete(':id')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  delete(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.uploadsService.delete(actor, id);
  }

  @Get(':id/download')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  download(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.uploadsService.download(actor, id);
  }
}
