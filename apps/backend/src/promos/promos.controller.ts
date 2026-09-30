import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard';
import { PromosService } from './promos.service';
import { ValidatePromoDto } from './dto/promo.dto';

@Controller('promos')
export class PromosController {
  constructor(private readonly promosService: PromosService) {}

  /** Hozir amal qiladigan promo-kodlar — ochiq, avtorizatsiyasiz. */
  @Get()
  active() {
    return this.promosService.active();
  }

  @Post('validate')
  @UseGuards(RolesGuard)
  validate(@Body() body: ValidatePromoDto) {
    return this.promosService.validate(body);
  }
}
