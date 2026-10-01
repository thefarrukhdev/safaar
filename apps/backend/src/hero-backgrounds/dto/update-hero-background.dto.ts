import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateHeroBackgroundDto {
  @ApiPropertyOptional({
    description: "Sahifa yoki bo'lim identifikatori",
    example: 'hotels',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  page?: string;

  @ApiPropertyOptional({
    description: 'Hero fon rasmi URL manzili (camelCase)',
    example: '/images/heroes/hotels_hero.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Hero fon rasmi URL manzili (snake_case)',
    example: '/images/heroes/hotels_hero.jpg',
  })
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiPropertyOptional({
    description: "Hero sarlavhasi (ko'p tilli obyekt yoki matn)",
  })
  @IsOptional()
  title?: unknown;

  @ApiPropertyOptional({
    description: "Hero kichik sarlavhasi (ko'p tilli obyekt yoki matn)",
  })
  @IsOptional()
  subtitle?: unknown;

  @ApiPropertyOptional({
    description: 'Faollik holati (camelCase)',
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
    description: 'Faollik holati (snake_case)',
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
    description: 'Tartiblash raqami (camelCase)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Tartiblash raqami (snake_case)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @ApiPropertyOptional({
    description: "Qo'shimcha parametrlar va metadata",
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
