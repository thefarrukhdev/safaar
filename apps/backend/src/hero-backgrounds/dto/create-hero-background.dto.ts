import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateHeroBackgroundDto {
  @ApiProperty({
    description:
      "Sahifa yoki bo'lim identifikatori (masalan: home, hotels, restaurants, transport, attractions)",
    example: 'transport',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  page!: string;

  @ApiPropertyOptional({
    description: 'Hero fon rasmi URL manzili (camelCase)',
    example: '/images/heroes/transport_hero.jpg',
  })
  @ValidateIf((o: CreateHeroBackgroundDto) => !o.image_url)
  @IsString()
  @IsNotEmpty({ message: 'imageUrl yoki image_url kiritilishi shart' })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Hero fon rasmi URL manzili (snake_case)',
    example: '/images/heroes/transport_hero.jpg',
  })
  @ValidateIf((o: CreateHeroBackgroundDto) => !o.imageUrl)
  @IsString()
  @IsNotEmpty({ message: 'imageUrl yoki image_url kiritilishi shart' })
  image_url?: string;

  @ApiPropertyOptional({
    description: "Hero sarlavhasi (ko'p tilli obyekt yoki matn)",
    example: { uz: 'Avto Ijarasi', ru: 'Аренда авто', en: 'Car Rental' },
  })
  @IsOptional()
  title?: unknown;

  @ApiPropertyOptional({
    description: "Hero kichik sarlavhasi (ko'p tilli obyekt yoki matn)",
    example: {
      uz: 'Avtomobil ijarasi xizmati',
      ru: 'Сервис аренды авто',
      en: 'Car rental service',
    },
  })
  @IsOptional()
  subtitle?: unknown;

  @ApiPropertyOptional({
    description: 'Faollik holati (camelCase)',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return Boolean(value);
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Faollik holati (snake_case)',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return Boolean(value);
  })
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Tartiblash raqami (camelCase, kichik raqam birinchi chiqadi)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({
    description:
      'Tartiblash raqami (snake_case, kichik raqam birinchi chiqadi)',
    default: 0,
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
