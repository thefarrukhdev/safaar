import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class HeroBackgroundQueryDto {
  @ApiPropertyOptional({
    description:
      "Sahifa kodi bo'yicha filtrlash (masalan: home, hotels, restaurants, transport)",
  })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({
    description: "Faollik holati bo'yicha filtrlash (camelCase)",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Faollik holati bo'yicha filtrlash (snake_case)",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return undefined;
  })
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: "Qidiruv so'rovi (sahifa kodi yoki sarlavha bo'yicha)",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Natijalar soni limiti',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sahifalash uchun offset',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
