import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@safaar/types';
import { CurrentActor, type RequestActor } from '../common/actor';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { SupportService } from './support.service';
import {
  CreateGuestSupportTicketDto,
  CreateSupportMessageDto,
  CreateSupportTicketDto,
} from './dto/support.dto';

@Controller('support/tickets')
@UseGuards(RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @Roles(Role.USER, Role.PARTNER)
  create(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: CreateSupportTicketDto,
  ) {
    return this.supportService.create(actor, body);
  }

  // Ataylab `@Roles()` yo'q — `POST /bookings/hotel` bilan bir xil naqsh:
  // `RolesGuard` bunday marshrutni auth-ixtiyoriy (guest) deb hisoblaydi.
  @Post('guest')
  createGuest(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() body: CreateGuestSupportTicketDto,
  ) {
    return this.supportService.createGuest(actor, body);
  }

  @Get()
  @Roles(Role.USER, Role.PARTNER)
  list(@CurrentActor() actor: RequestActor | undefined) {
    return this.supportService.list(actor);
  }

  @Get(':id')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  findOne(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.supportService.findOne(actor, id);
  }

  @Post(':id/messages')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  message(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: CreateSupportMessageDto,
  ) {
    return this.supportService.message(actor, id, body);
  }

  @Post(':id/close')
  @Roles(Role.USER, Role.PARTNER)
  close(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.supportService.status(actor, id, 'closed');
  }

  @Post(':id/reopen')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  reopen(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.supportService.status(actor, id, 'open');
  }
}
