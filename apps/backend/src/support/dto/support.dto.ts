import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSupportTicketDto {
  @ApiProperty({ example: 'Bron uchun to‘lov o‘tmadi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'urgent'] })
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export class CreateSupportMessageDto {
  @ApiProperty({ example: 'Xabar matni' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body!: string;
}

export class CreateGuestSupportTicketDto {
  @ApiProperty({ example: 'Bron uchun to‘lov o‘tmadi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;

  @ApiProperty({ example: 'Aziza Karimova' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  guestName!: string;

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  guestPhone!: string;

  @ApiPropertyOptional({ example: 'Bron savoli' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;
}
