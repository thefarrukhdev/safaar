import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@safaar/types';
import { Permission } from '../common/permissions';
import { Permissions } from '../common/permissions.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateHeroBackgroundDto } from './dto/create-hero-background.dto';
import { HeroBackgroundQueryDto } from './dto/hero-background-query.dto';
import { ReorderHeroBackgroundDto } from './dto/reorder-hero-background.dto';
import { ToggleHeroBackgroundDto } from './dto/toggle-hero-background.dto';
import { UpdateHeroBackgroundDto } from './dto/update-hero-background.dto';
import { HeroBackgroundsService } from './hero-backgrounds.service';

@ApiTags('Admin Hero Backgrounds')
@ApiBearerAuth()
@Controller('admin/hero-backgrounds')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.CONTENT_ADMIN)
export class HeroBackgroundsAdminController {
  constructor(private readonly service: HeroBackgroundsService) {}

  @Get()
  @Permissions(Permission.CmsRead)
  @ApiOperation({
    summary: "Admin: Hero background rasmlari ro'yxati",
    description:
      "Barcha sahifalar uchun hero fon rasmlari ro'yxati (filtrlar, sahifalash bilan).",
  })
  @ApiResponse({ status: 200, description: "Muvaffaqiyatli ro'yxat" })
  findAll(@Query() query: HeroBackgroundQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions(Permission.CmsRead)
  @ApiOperation({
    summary: 'Admin: Bitta hero background rasmini olish',
  })
  @ApiParam({ name: 'id', description: 'Hero background UUID' })
  @ApiResponse({ status: 200, description: 'Hero fon rasmi topildi' })
  @ApiResponse({ status: 404, description: 'Hero fon rasmi topilmadi' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permissions(Permission.CmsWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Admin: Yangi hero background rasmini yaratish',
  })
  @ApiResponse({
    status: 201,
    description: 'Hero fon rasmi muvaffaqiyatli yaratildi',
  })
  create(@Body() dto: CreateHeroBackgroundDto) {
    return this.service.create(dto);
  }

  @Post('reorder')
  @Permissions(Permission.CmsWrite)
  @ApiOperation({
    summary: "Admin: Hero background rasmlari tartibini ommaviy o'zgartirish",
    description:
      "orderedIds yoki items massivini qabul qilib, barcha ko'rsatilgan elementlarning sort_order qiymatini yangilaydi.",
  })
  @ApiResponse({ status: 200, description: 'Tartib muvaffaqiyatli yangilandi' })
  reorder(@Body() dto: ReorderHeroBackgroundDto) {
    return this.service.reorder(dto);
  }

  @Patch(':id')
  @Permissions(Permission.CmsWrite)
  @ApiOperation({
    summary: 'Admin: Hero background rasmini qisman yangilash',
  })
  @ApiParam({ name: 'id', description: 'Hero background UUID' })
  @ApiResponse({
    status: 200,
    description: 'Hero fon rasmi muvaffaqiyatli yangilandi',
  })
  @ApiResponse({ status: 404, description: 'Hero fon rasmi topilmadi' })
  update(@Param('id') id: string, @Body() dto: UpdateHeroBackgroundDto) {
    return this.service.update(id, dto);
  }

  @Put(':id')
  @Permissions(Permission.CmsWrite)
  @ApiOperation({
    summary: "Admin: Hero background rasmini to'liq yangilash",
  })
  @ApiParam({ name: 'id', description: 'Hero background UUID' })
  @ApiResponse({
    status: 200,
    description: 'Hero fon rasmi muvaffaqiyatli yangilandi',
  })
  @ApiResponse({ status: 404, description: 'Hero fon rasmi topilmadi' })
  replace(@Param('id') id: string, @Body() dto: UpdateHeroBackgroundDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.CmsWrite)
  @ApiOperation({
    summary: "Admin: Hero background rasmini o'chirish",
  })
  @ApiParam({ name: 'id', description: 'Hero background UUID' })
  @ApiResponse({ status: 200, description: "Hero fon rasmi o'chirildi" })
  @ApiResponse({ status: 404, description: 'Hero fon rasmi topilmadi' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/toggle-active')
  @Permissions(Permission.CmsWrite)
  @ApiOperation({
    summary: 'Admin: Hero background faollik holatini almashtirish',
  })
  @ApiParam({ name: 'id', description: 'Hero background UUID' })
  @ApiResponse({ status: 200, description: "Faollik holati o'zgartirildi" })
  toggleActive(@Param('id') id: string, @Body() dto?: ToggleHeroBackgroundDto) {
    const active = dto?.isActive ?? dto?.is_active;
    return this.service.toggleActive(id, active);
  }

  @Post(':id/publish')
  @Permissions(Permission.CmsWrite)
  @ApiOperation({
    summary: "Admin: Hero background rasmini faollashtirish (e'lon qilish)",
  })
  @ApiParam({ name: 'id', description: 'Hero background UUID' })
  publish(@Param('id') id: string) {
    return this.service.toggleActive(id, true);
  }

  @Post(':id/unpublish')
  @Permissions(Permission.CmsWrite)
  @ApiOperation({
    summary: 'Admin: Hero background rasmini nofaol qilish (yashirish)',
  })
  @ApiParam({ name: 'id', description: 'Hero background UUID' })
  unpublish(@Param('id') id: string) {
    return this.service.toggleActive(id, false);
  }
}
