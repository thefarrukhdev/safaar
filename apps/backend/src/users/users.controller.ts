import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@safaar/types';
import { CurrentActor, type RequestActor } from '../common/actor';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import type { UploadedFile as UploadedFilePayload } from '../uploads/uploads.service';
import { UsersService } from './users.service';
import { SetAvatarDto, UpdateProfileDto } from './dto/user.dto';

@Controller('me')
@UseGuards(RolesGuard)
@Roles(Role.USER)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  profile(@CurrentActor() actor: RequestActor | undefined) {
    return this.usersService.profile(actor);
  }

  @Patch()
  updateProfile(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(actor, body);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadAvatar(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: SetAvatarDto,
    @UploadedFile() file?: UploadedFilePayload,
  ) {
    return this.usersService.setAvatar(actor, body, file);
  }

  @Delete('avatar')
  deleteAvatar(@CurrentActor() actor: RequestActor | undefined) {
    return this.usersService.deleteAvatar(actor);
  }

  @Get('bookings')
  bookings(
    @CurrentActor() actor: RequestActor | undefined,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.usersService.bookings(actor, query);
  }

  @Get('bookings/:id')
  booking(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.usersService.booking(actor, id);
  }

  @Get('bonuses')
  bonuses(@CurrentActor() actor: RequestActor | undefined) {
    return this.usersService.bonuses(actor);
  }

  @Get('favorites')
  favorites(
    @CurrentActor() actor: RequestActor | undefined,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.usersService.favorites(actor, query);
  }

  @Post('favorites')
  addFavorite(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.usersService.addFavorite(actor, body);
  }

  @Delete('favorites/:id')
  deleteFavorite(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.usersService.deleteFavorite(actor, id);
  }

  @Get('notifications/preferences')
  notificationPreferences(@CurrentActor() actor: RequestActor | undefined) {
    return this.usersService.notificationPreferences(actor);
  }

  @Patch('notifications/preferences')
  updateNotificationPreferences(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.usersService.updateNotificationPreferences(actor, body);
  }

  @Post('data-export')
  dataExport(@CurrentActor() actor: RequestActor | undefined) {
    return this.usersService.dataExport(actor);
  }

  @Post('delete-request')
  deleteRequest(@CurrentActor() actor: RequestActor | undefined) {
    return this.usersService.deleteRequest(actor);
  }
}
