import { Module } from '@nestjs/common';
import { UzumCheckoutProvider } from '../payments/providers/uzum-checkout.provider';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  // `UzumCheckoutProvider` — o'z ALOHIDA nusxasi (faqat `ConfigService`ga
  // bog'liq, hech qanday umumiy holat/DB ulanishi saqlamaydi — `PaymentsModule`
  // ichidagi nusxa bilan bir xil, mustaqil ravishda ishlaydi). Refund
  // tasdiqlashda (`refundApprove()`) haqiqiy Uzum Checkout `/acquiring/refund`
  // so'rovi yuborish uchun.
  providers: [AdminService, UzumCheckoutProvider],
  exports: [AdminService],
})
export class AdminModule {}
