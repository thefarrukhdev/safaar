import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { CreatePartnerRequestDto } from './dto/create-partner-request.dto';

@Controller('partners/requests')
export class PartnerRequestsController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post()
  submit(@Body() body: CreatePartnerRequestDto) {
    return this.partnersService.submitPublicPartnerRequest(
      body as unknown as Record<string, unknown>,
    );
  }

  @Get()
  status(@Query('phone') phone?: string, @Query('email') email?: string) {
    return this.partnersService.publicPartnerRequestStatus(phone, email);
  }
}
