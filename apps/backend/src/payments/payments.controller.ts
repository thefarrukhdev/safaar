import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor, type RequestActor } from '../common/actor';
import { RolesGuard } from '../common/roles.guard';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // `@Roles(...)` ATAYLAB YO'Q (`bookings.controller.ts`dagi guest-checkout
  // marshrutlari bilan BIR XIL naqsh) — auth SHART EMAS, `RolesGuard` shunda
  // ham token bo'lsa (yaroqli/faol bo'lsa) `request.user`ni to'ldiradi, aks
  // holda so'rov anonim (guest) sifatida o'tadi. Haqiqiy ruxsat qarori
  // to'liq `PaymentsService.assertBookingVisible()`da: login qilgan
  // foydalanuvchi/admin/partner — avvalgidek; guest — FAQAT `guestToken`
  // AYNAN shu bookingId'ga bog'langan bo'lsa (mahsulot talabi: guest
  // to'lov, xavfsiz, booking-specific, unguessable, expiring token bilan).
  @Get('payments/:bookingId')
  @UseGuards(RolesGuard)
  payment(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('bookingId') bookingId: string,
    @Query('guestToken') guestToken?: string,
  ) {
    return this.paymentsService.payment(actor, bookingId, guestToken);
  }

  @Post('payments/:bookingId/create')
  @UseGuards(RolesGuard)
  createPayment(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('bookingId') bookingId: string,
    @Body() body: CreatePaymentDto,
    @Query('guestToken') guestToken?: string,
  ) {
    return this.paymentsService.createPayment(
      actor,
      bookingId,
      body as unknown as Record<string, unknown>,
      guestToken,
    );
  }

  // Webhook tanasi ataylab `Record<string, unknown>` — real provayderlar
  // (Click, Payme, Uzcard, Humo) o'zining maxsus maydonlarini yuboradi
  // (masalan Click'ning click_trans_id/sign_string/action kabi), va
  // global ValidationPipe'dagi `forbidNonWhitelisted` qattiq DTO klassi
  // bilan ularni butunlay rad etar edi. `ProviderWebhookDto` hujjatlash
  // (Swagger) uchun saqlanadi, lekin runtime validatsiyasida ishlatilmaydi.
  @Post('webhooks/click/prepare')
  clickPrepare(@Body() body: Record<string, unknown>) {
    return this.paymentsService.clickPrepare(body as never);
  }

  @Post('webhooks/click/complete')
  clickComplete(@Body() body: Record<string, unknown>) {
    return this.paymentsService.clickComplete(body as never);
  }

  @Post('webhooks/payme')
  payme(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.paymentsService.providerWebhook(
      'payme',
      'callback',
      body,
      headers,
    );
  }

  @Post('webhooks/uzcard')
  uzcard(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.paymentsService.providerWebhook(
      'uzcard',
      'callback',
      body,
      headers,
    );
  }

  @Post('webhooks/humo')
  humo(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.paymentsService.providerWebhook(
      'humo',
      'callback',
      body,
      headers,
    );
  }

  @Post('webhooks/payment/:provider')
  paymentProvider(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.paymentsService.providerWebhook(
      provider,
      'callback',
      body,
      headers,
    );
  }
}
