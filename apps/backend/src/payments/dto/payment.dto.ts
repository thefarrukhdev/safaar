import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

// `humo`/`uzcard`/`visa`/`mastercard` — barchasi Uzum Checkout orqali
// ishlaydigan karta turlari (fee stavkasi karta turiga qarab farqlanadi,
// qarang `providers/card-scheme-fee.ts`); alohida provayder EMAS.
export class CreatePaymentDto {
  @ApiProperty({
    enum: [
      'click',
      'payme',
      'uzcard',
      'humo',
      'visa',
      'mastercard',
      'cash',
      'uzum',
      'uzum_checkout',
    ],
  })
  @IsIn([
    'click',
    'payme',
    'uzcard',
    'humo',
    'visa',
    'mastercard',
    'cash',
    'uzum',
    'uzum_checkout',
  ])
  provider!: string;
}

// Webhook tanasi uchun qat'iy DTO ATAYLAB yo'q — real to'lov provayderlari
// (Click/Payme/Uzcard/Humo) o'zlarining maxsus maydonlarini yuboradi, va
// global ValidationPipe'dagi `forbidNonWhitelisted` bunday DTO orqali
// ularni butunlay rad etar edi. Safaar o'zi tan oladigan maydonlar
// (`payments.controller.ts`dagi marshrutlar `Record<string, unknown>`
// qabul qiladi): booking_id/bookingId/account, transaction_id, event_id,
// amount, currency — bular `PaymentsService.providerWebhook()` ichida
// qo'lda o'qib olinadi.
