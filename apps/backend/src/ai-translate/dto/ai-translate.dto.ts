import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export class TranslateTextDto {
  @ApiProperty({ example: 'QA/testing uchun maxsus test yotoqxona.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text!: string;

  @ApiProperty({ enum: SUPPORTED_LANGUAGES, example: 'uz' })
  @IsIn(SUPPORTED_LANGUAGES)
  source!: SupportedLanguage;

  @ApiProperty({
    enum: SUPPORTED_LANGUAGES,
    isArray: true,
    example: ['ru', 'en'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(SUPPORTED_LANGUAGES, { each: true })
  targets!: SupportedLanguage[];
}
