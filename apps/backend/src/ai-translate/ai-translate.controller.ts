import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@safaar/types';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AiTranslateService } from './ai-translate.service';
import { TranslateTextDto } from './dto/ai-translate.dto';

@Controller('ai')
@UseGuards(RolesGuard)
export class AiTranslateController {
  constructor(private readonly aiTranslateService: AiTranslateService) {}

  // Faqat PARTNER/ADMIN — ochiq qoldirilsa har kim tashqi API kvotasini
  // (pullik) tugatib qo'yishi mumkin.
  @Post('translate')
  @Roles(Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  translate(@Body() body: TranslateTextDto) {
    return this.aiTranslateService.translate(body);
  }
}
