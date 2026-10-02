import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@safaar/types';
import { CurrentActor, type RequestActor } from '../common/actor';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { BookingsService } from './bookings.service';
import {
  CancelBookingDto,
  ConfirmCashOtpDto,
  CreateBusBookingDto,
  CreateHotelBookingDto,
  CreateVehicleRentalDto,
  LookupBookingDto,
  SendBookingMessageDto,
  SendCashOtpDto,
  UnblockBookingPenaltyDto,
} from './dto/booking.dto';

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Guest checkout ataylab login talab qilmaydi (mahsulot qarori), lekin
  // ID/vaqt asosidagi suiiste'mol (masalan, bitta xonani minglab soxta
  // bron bilan "bandlash") oldini olish uchun bu marshrutga qat'iyroq
  // limit qo'yilgan — global 120/min o'rniga 10/min/IP.
  @Post('hotel')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createHotel(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() dto: CreateHotelBookingDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    await this.bookingsService.assertUserNotBlockedFromBooking(
      actor,
      dto.guest_phone ?? dto.guestPhone ?? dto.phone,
      dto.guest_email ?? dto.guestEmail ?? dto.email,
    );
    return this.bookingsService.createHotel(
      actor,
      dto as unknown as Record<string, unknown>,
      idempotencyKey,
    );
  }

  @Post('bus')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createBus(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() dto: CreateBusBookingDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    await this.bookingsService.assertUserNotBlockedFromBooking(
      actor,
      dto.guest_phone ?? dto.guestPhone ?? dto.phone,
      dto.guest_email ?? dto.guestEmail ?? dto.email,
    );
    return this.bookingsService.createBus(
      actor,
      dto as unknown as Record<string, unknown>,
      idempotencyKey,
    );
  }

  // Mashina ijarasi (rent-a-car) — hotel kabi guest checkout ruxsat etiladi,
  // shuning uchun bir xil qat'iy limit qo'yiladi.
  @Post('vehicle')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createVehicleRental(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() dto: CreateVehicleRentalDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    await this.bookingsService.assertUserNotBlockedFromBooking(
      actor,
      dto.guest_phone ?? dto.guestPhone,
      dto.guest_email ?? dto.guestEmail,
    );
    return this.bookingsService.createVehicleRental(
      actor,
      dto as unknown as Record<string, unknown>,
      idempotencyKey,
    );
  }

  // Guest (login qilmagan) mijoz uchun — xom ID emas, bron raqami + email
  // juftligi orqali qidirish. Ikkalasi to'g'ri kelishi shart bo'lgani
  // uchun ID'ni bilishning o'zi yetarli emas (BUG-01 fix'idan keyingi
  // to'g'ri guest-lookup yo'li). Suiiste'mol/enumeration'ga qarshi
  // qat'iy limit.
  @Post('lookup')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  lookupBooking(@Body() dto: LookupBookingDto) {
    return this.bookingsService.lookupBooking(dto.booking_number, dto.email);
  }

  // Naqd to'lov uchun telefon raqamiga OTP SMS yuborish
  @Post('cash/send-otp')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  sendCashOtp(
    @CurrentActor() actor: RequestActor | undefined,
    @Body() dto: SendCashOtpDto,
  ) {
    return this.bookingsService.sendCashBookingOtp(actor, dto.phone);
  }

  // Mavjud bron uchun naqd to'lov SMS OTP kodini yuborish
  @Post(':id/send-cash-otp')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  sendCashOtpForBooking(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Query('guestToken') guestToken?: string,
  ) {
    return this.bookingsService.sendCashOtpForBooking(actor, id, guestToken);
  }

  // Naqd to'lov SMS OTP kodini tasdiqlash va bronni tasdiqlangan qilish
  @Post(':id/confirm-cash')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirmCash(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() dto: ConfirmCashOtpDto,
    @Query('guestToken') guestToken?: string,
  ) {
    return this.bookingsService.confirmCashBooking(actor, id, dto, guestToken);
  }

  // No-show (mijoz kelmadi): bronni bekor qilib 60 kunga bloklash
  @Post(':id/no-show')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PARTNER)
  markNoShow(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.bookingsService.applyNoShowPenalty(id, body?.reason, actor);
  }

  // Admin tomonidan 60 kunlik blokni yechish (telefon yoki userId bo'yicha)
  @Post('penalties/unblock')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  unblockPenalty(@Body() dto: UnblockBookingPenaltyDto) {
    return this.bookingsService.unblockUserBooking(dto.target);
  }

  // Auth ixtiyoriy: login qilingan user/partner/admin RolesGuard'ning
  // "auth ixtiyoriy" tarmog'i orqali baribir to'g'ri tekshiriladi (token
  // bo'lsa — session/blocked holati baribir tasdiqlanadi), shu bilan birga
  // guest (login qilmagan) checkout o'zi yaratgan bronni `guestToken`
  // orqali ko'ra oladi — ruxsat qarori to'liq `BookingsService.assertBooking`
  // ichida (actor YOKI shu bronga bog'langan guest-token) hal qilinadi.
  @Get(':id')
  findOne(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Query('guestToken') guestToken?: string,
  ) {
    return this.bookingsService.findOne(actor, id, guestToken);
  }

  @Post(':id/retry-payment')
  @Roles(Role.USER)
  retryPayment(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.bookingsService.retryPayment(actor, id);
  }

  @Post(':id/cancel-preview')
  cancelPreview(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Query('guestToken') guestToken?: string,
  ) {
    return this.bookingsService.cancelPreview(actor, id, guestToken);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: CancelBookingDto,
    @Query('guestToken') guestToken?: string,
  ) {
    return this.bookingsService.cancel(
      actor,
      id,
      body as unknown as Record<string, unknown>,
      guestToken,
    );
  }

  @Get(':id/voucher')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  voucher(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.bookingsService.voucher(actor, id);
  }

  @Get(':id/status-history')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  statusHistory(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.bookingsService.statusHistory(actor, id);
  }

  @Get(':id/conversation')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  conversation(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.bookingsService.conversation(actor, id);
  }

  @Get(':id/messages')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  messages(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
  ) {
    return this.bookingsService.messages(actor, id);
  }

  @Post(':id/messages')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  sendMessage(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Body() body: SendBookingMessageDto,
  ) {
    return this.bookingsService.sendMessage(
      actor,
      id,
      body as unknown as Record<string, unknown>,
    );
  }

  @Post(':id/messages/:messageId/read')
  @Roles(Role.USER, Role.PARTNER, Role.ADMIN, Role.SUPER_ADMIN)
  readMessage(
    @CurrentActor() actor: RequestActor | undefined,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.bookingsService.readMessage(actor, id, messageId);
  }
}
