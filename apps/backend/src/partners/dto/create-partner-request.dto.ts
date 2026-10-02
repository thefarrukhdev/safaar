import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreatePartnerRequestDto {
  @ApiProperty({ example: 'hotel' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional({ example: 'Grand Samarkand' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'Grand Samarkand' })
  @IsOptional()
  @IsString()
  brandName?: string;

  @ApiPropertyOptional({ example: 'Grand Samarkand' })
  @IsOptional()
  @IsString()
  company_name?: string;

  @ApiPropertyOptional({ example: 'Grand Samarkand LLC' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ example: 'Grand Samarkand LLC' })
  @IsOptional()
  @IsString()
  legal_name?: string;

  @ApiPropertyOptional({ example: 'Alisher Navoiy' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ example: 'Alisher Navoiy' })
  @IsOptional()
  @IsString()
  contact_person?: string;

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: 'partner@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  tax_id?: string;

  @ApiPropertyOptional({ example: 'Samarqand' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'city-uuid' })
  @IsOptional()
  @IsString()
  city_id?: string;

  @ApiPropertyOptional({ example: 'Registon ko`chasi 1' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: 'Secret123!',
    description: 'Hamkor kirishi uchun parol (kamida 8 ta belgi)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak",
  })
  password?: string;

  @ApiPropertyOptional({ example: 'reg-proof-token' })
  @IsOptional()
  @IsString()
  phoneVerificationToken?: string;

  @ApiPropertyOptional({ example: 'reg-proof-token' })
  @IsOptional()
  @IsString()
  phone_verification_token?: string;

  @ApiPropertyOptional({ example: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string;
}
