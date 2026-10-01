import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HeroBackgroundsService } from './hero-backgrounds.service';

@ApiTags('Hero Backgrounds')
@Controller('hero-backgrounds')
export class HeroBackgroundsController {
  constructor(private readonly service: HeroBackgroundsService) {}

  @Get()
  @ApiOperation({
    summary: 'Public: Faol hero background rasmlarini olish',
    description:
      "Barcha sahifalar yoki ko'rsatilgan bitta sahifa uchun faol hero fon rasmlari ro'yxatini qaytaradi.",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description:
      'Sahifa kodi (masalan: home, hotels, restaurants, transport, attractions)',
  })
  @ApiResponse({ status: 200, description: "Muvaffaqiyatli ro'yxat" })
  findPublic(@Query('page') page?: string) {
    return this.service.findPublic(page);
  }

  @Get('map')
  @ApiOperation({
    summary:
      "Public: Barcha sahifalar uchun faol hero fon rasmlari lug'atini (map) olish",
    description:
      "Sahifa kodi kalit bo'lgan lug'at obyektini qaytaradi: { [page]: HeroBackgroundItem }",
  })
  @ApiResponse({ status: 200, description: "Muvaffaqiyatli lug'at" })
  findPublicMap() {
    return this.service.findPublicMap();
  }

  @Get(':page')
  @ApiOperation({
    summary: 'Public: Muayyan sahifa uchun faol hero background rasmini olish',
    description:
      'Berilgan sahifa (home, hotels, restaurants, transport) uchun joriy faol hero fon rasmini qaytaradi.',
  })
  @ApiParam({
    name: 'page',
    description: 'Sahifa kodi (masalan: home, hotels, restaurants, transport)',
    example: 'transport',
  })
  @ApiResponse({ status: 200, description: 'Faol hero fon rasmi' })
  @ApiResponse({ status: 404, description: 'Hero fon rasmi topilmadi' })
  findPublicByPage(@Param('page') page: string) {
    return this.service.findPublicByPage(page);
  }
}
