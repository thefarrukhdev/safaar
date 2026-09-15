import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateHotelBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotel_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  room_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsString()
  check_in?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsString()
  checkIn?: string;

  @ApiPropertyOptional({ example: '2026-07-03' })
  @IsOptional()
  @IsString()
  check_out?: string;

  @ApiPropertyOptional({ example: '2026-07-03' })
  @IsOptional()
  @IsString()
  checkOut?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  slot_time?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  slotTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  totalPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  total_price?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rooms?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  guests?: number;

  @ApiPropertyOptional({
    default: 'click',
    enum: ['click', 'payme', 'uzcard', 'humo', 'cash'],
  })
  @IsOptional()
  @IsIn(['click', 'payme', 'uzcard', 'humo', 'cash'])
  payment_method?: string;

  @ApiPropertyOptional({
    default: 'instant_confirmation',
    enum: ['instant_confirmation', 'request_confirmation'],
  })
  @IsOptional()
  @IsIn(['instant_confirmation', 'request_confirmation'])
  confirmation_mode?: string;

  @ApiPropertyOptional({ example: 'Laziz' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Shakarov' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'Laziz Shakarov' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'laziz@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Laziz Shakarov' })
  @IsOptional()
  @IsString()
  guest_name?: string;

  @ApiPropertyOptional({ example: 'Laziz Shakarov' })
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiPropertyOptional({ example: 'laziz@example.com' })
  @IsOptional()
  @IsString()
  guest_email?: string;

  @ApiPropertyOptional({ example: 'laziz@example.com' })
  @IsOptional()
  @IsString()
  guestEmail?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  guest_phone?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  guestPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'SUMMER10' })
  @IsOptional()
  @IsString()
  promo_code?: string;

  @ApiPropertyOptional({ example: 'SUMMER10' })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Ommaviy Oferta (Terms of Service)ga rozilik — checkout uchun ' +
      'majburiy `true` bo‘lishi kerak.',
  })
  @IsOptional()
  @IsBoolean()
  agree_terms?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  agreeTerms?: boolean;
}

export class CreateBusBookingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  trip_id!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  seats!: string[];

  @ApiPropertyOptional({
    default: 'click',
    enum: ['click', 'payme', 'uzcard', 'humo', 'cash'],
  })
  @IsOptional()
  @IsIn(['click', 'payme', 'uzcard', 'humo', 'cash'])
  payment_method?: string;

  @ApiPropertyOptional({ example: 'SUMMER10' })
  @IsOptional()
  @IsString()
  promo_code?: string;

  @ApiPropertyOptional({ example: 'SUMMER10' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}

export class CreateVehicleRentalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicle_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsString()
  check_in?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsString()
  checkIn?: string;

  @ApiPropertyOptional({ example: '2026-07-03' })
  @IsOptional()
  @IsString()
  check_out?: string;

  @ApiPropertyOptional({ example: '2026-07-03' })
  @IsOptional()
  @IsString()
  checkOut?: string;

  @ApiPropertyOptional({
    default: 'click',
    enum: ['click', 'payme', 'uzcard', 'humo', 'cash'],
  })
  @IsOptional()
  @IsIn(['click', 'payme', 'uzcard', 'humo', 'cash'])
  payment_method?: string;

  @ApiPropertyOptional({
    default: 'instant_confirmation',
    enum: ['instant_confirmation', 'request_confirmation'],
  })
  @IsOptional()
  @IsIn(['instant_confirmation', 'request_confirmation'])
  confirmation_mode?: string;

  @ApiPropertyOptional({ example: 'Laziz' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Shakarov' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'Laziz Shakarov' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'laziz@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Laziz Shakarov' })
  @IsOptional()
  @IsString()
  guest_name?: string;

  @ApiPropertyOptional({ example: 'Laziz Shakarov' })
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiPropertyOptional({ example: 'laziz@example.com' })
  @IsOptional()
  @IsString()
  guest_email?: string;

  @ApiPropertyOptional({ example: 'laziz@example.com' })
  @IsOptional()
  @IsString()
  guestEmail?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  guest_phone?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  guestPhone?: string;

  @ApiPropertyOptional({ example: 'SUMMER10' })
  @IsOptional()
  @IsString()
  promo_code?: string;

  @ApiPropertyOptional({ example: 'SUMMER10' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SendBookingMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;
}

export class LookupBookingDto {
  @ApiProperty({ example: 'SF-20260901-1234' })
  @IsString()
  @IsNotEmpty()
  booking_number!: string;

  @ApiProperty({ example: 'guest@example.com' })
  @IsEmail()
  email!: string;
}
