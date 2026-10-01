import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ReorderHeroBackgroundItemDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;
}

export class ReorderHeroBackgroundDto {
  @ApiPropertyOptional({
    description: 'Tartiblangan hero background UUID lar ketma-ketligi',
    example: [
      '00000000-0000-7010-0000-000000000001',
      '00000000-0000-7010-0000-000000000002',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  orderedIds?: string[];

  @ApiPropertyOptional({
    description: 'ID va uning yangi tartib raqami obyektlari',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderHeroBackgroundItemDto)
  items?: ReorderHeroBackgroundItemDto[];
}
