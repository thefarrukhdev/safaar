import {
  Body,
  Controller,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import {
  UZUM_CHECKOUT_ERROR,
  UzumCheckoutError,
  UzumCheckoutProvider,
  normalizeCheckoutCallback,
  pickDebugHeaders,
  type NormalizedCheckoutCallback,
} from './providers/uzum-checkout.provider';

/**
 * Uzum **Checkout** to'lov notification / callback qabul qiluvchi.
 *
 * Route (global prefiks `v1` bilan):
 *   POST /v1/uzum/checkout/callback
 *
 * Merchant API'dan (`/v1/uzum/webhook/{check,create,confirm,reverse,status}`)
 * MUTLAQO ALOHIDA — ular hech qanday tarzda aralashmaydi.
 *
 * `@Res()` (passthrough EMAS): global `ApiResponseInterceptor` envelope va
 * `HttpErrorFilter` chetlab o'tiladi — javobni to'liq shu yerda boshqaramiz
 * (Uzum retry mantig'i uchun status kodlar aniq bo'lishi kerak). Uzum'ning
 * kutgan aniq javob shakli hali bizga noma'lum — hozircha `{ status: "OK" }`
 * (200) / `{ status: "FAILED", code }` (4xx). Spec kelganda moslashtiriladi.
 *
 * Xavfsizlik: imzo `UzumCheckoutProvider.verifyCallback` orqali FAIL-CLOSED
 * tekshiriladi (sxema sozlanmaguncha har qanday callback rad etiladi).
 * Secret / imzo / Authorization LOG QILINMAYDI.
 *
 * "Callback qabul qilindi" bilan "to'lov tasdiqlandi" ANIQ ajratilgan:
 *   - imzo tasdiqlanmagan callback — HECH QANDAY DB yozuvi yo'q, faqat
 *     xavfsiz (tipizatsiya qilingan, xom EMAS) preview logga yoziladi;
 *   - imzo tasdiqlangan (haqiqiy sxema ORQALI YOKI `UZUM_CHECKOUT_TEST_MODE`
 *     orqali — faqat QA, production'da bu yo'l HECH QACHON), lekin order
 *     topilmasa — `payment_events`ga audit sifatida yoziladi (payment/
 *     booking holati O'ZGARMAYDI);
 *   - faqat ichki `state === 'PAID'` (`STATE_MAP`dagi AUTHORIZE:SUCCESS /
 *     COMPLETE:SUCCESS orqali) mavjud ishonchli pipeline orqali holatni
 *     o'zgartiradi — amount/currency/idempotency/terminal-holat
 *     tekshiruvlari test mode YOKI production'dan qat'i nazar BIR XIL
 *     ishlaydi (test mode FAQAT signature bosqichiga ta'sir qiladi).
 */
@ApiTags('payments')
@Controller()
export class UzumCheckoutController {
  private readonly logger = new Logger(UzumCheckoutController.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly checkout: UzumCheckoutProvider,
  ) {}

  @Post('uzum/checkout/callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Body() raw: unknown,
  ): Promise<void> {
    // Faqat catch blokidagi XAVFSIZ (tipizatsiya qilingan, xom EMAS) preview
    // log uchun — hech qanday sir/imzo/authorization saqlamaydi.
    let normalized: NormalizedCheckoutCallback | undefined;
    try {
      // G) noto'g'ri/bo'sh payload -> rad etamiz, hech narsani PAID qilmaymiz.
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        this.reject(
          res,
          HttpStatus.BAD_REQUEST,
          UZUM_CHECKOUT_ERROR.MALFORMED_BODY,
        );
        return;
      }
      const body = raw as Record<string, unknown>;

      // Normalizatsiya — TOZA funksiya (DB'ga yozmaydi, holat o'zgartirmaydi),
      // shuning uchun imzo tekshiruvidan OLDIN xavfsiz chaqirish mumkin. Bu
      // imzo rad etilganda ham QA/tekshiruv uchun xavfsiz (faqat TIPIZATSIYA
      // QILINGAN maydonlar — xom, tasdiqlanmagan payload EMAS) preview
      // logga yozishga imkon beradi — "callback qabul qilindi" bilan
      // "to'lov tasdiqlandi"ni aniq ajratib turadi.
      normalized = normalizeCheckoutCallback(body);

      // F) imzo tekshiruvi — FAIL-CLOSED (throw qiladi, agar sxema
      //    sozlanmagan bo'lsa yoki imzo mos kelmasa). MUHIM: imzo hali
      //    tasdiqlanmagani uchun bu yerdan keyin HECH QANDAY DB yozuvi
      //    yoki holat o'zgarishi bo'lmaydi — faqat quyidagi catch blokida
      //    xavfsiz (tipizatsiya qilingan, xom EMAS) preview log qilinadi.
      //    QA-only: `UZUM_CHECKOUT_TEST_MODE=true` bo'lsa (production'da
      //    HECH QACHON), sxema sozlanmagan holatda ham throw qilmaydi —
      //    shu holatni QA log'larda aniq ko'rinishi uchun alohida qayd
      //    etamiz (o'zgartirmasdan davom etadi, faqat log uchun).
      const wasTestModeBypass =
        !this.checkout.isCallbackVerificationConfigured() &&
        this.checkout.isTestModeEnabled();
      this.checkout.verifyCallback(body, req.headers);
      if (wasTestModeBypass) {
        this.logger.log(
          `uzum-checkout callback: TEST MODE orqali imzo tekshiruvi ` +
            `o'tkazib yuborildi (order=${normalized.orderId || '?'}) — ` +
            `boshqa barcha tekshiruvlar (order/amount/currency/idempotency) ` +
            `hamon amal qiladi`,
        );
      }

      // Debug/audit uchun — imzo sarlavhasi (va authorization/cookie) hech
      // qachon shu ro'yxatga kirmaydi, faqat kichik "xavfsiz" allowlist.
      const debugHeaders = pickDebugHeaders(req.headers, [
        this.checkout.signatureHeaderName(),
      ]);
      const result = await this.payments.uzumCheckoutCallback(
        normalized,
        debugHeaders,
      );

      // C/D/E) mapping/amount/currency muammosi -> reject, PAID qilinmaydi.
      if (result.code) {
        const status =
          result.code === 'unknown_order'
            ? HttpStatus.NOT_FOUND
            : HttpStatus.UNPROCESSABLE_ENTITY;
        this.logger.warn(
          `uzum-checkout callback rejected code=${result.code} ` +
            `order=${normalized.orderId || '?'} state=${normalized.state}`,
        );
        this.reject(res, status, result.code);
        return;
      }

      // A/B) valid yoki duplicate -> HTTP 200.
      res.status(HttpStatus.OK).json({
        status: 'OK',
        duplicate: result.duplicate,
        applied: result.applied,
      });
    } catch (err) {
      if (err instanceof UzumCheckoutError) {
        // "callback qabul qilindi" bilan "to'lov tasdiqlandi"ni aniq
        // ajratish: imzo tasdiqlanmagani uchun HECH QANDAY DB yozuvi
        // qilinmaydi (xavfsizlik — tasdiqlanmagan yozuvchi bizning
        // bazamizga cheksiz yozib tashlay olmasligi kerak), lekin QA/
        // tekshiruv uchun XAVFSIZ (faqat tipizatsiya qilingan maydonlar —
        // xom payload/sarlavhalar EMAS) preview logga yoziladi.
        const preview = normalized
          ? ` preview[orderId=${normalized.orderId || '?'} ` +
            `orderNumber=${normalized.orderNumber || '?'} ` +
            `state=${normalized.state} ` +
            `operationType=${normalized.operationType ?? '?'}]`
          : '';
        this.logger.warn(
          `uzum-checkout callback rejected: ${err.code}${preview}`,
        );
        this.reject(res, HttpStatus.UNAUTHORIZED, err.code);
        return;
      }
      // Kutilmagan ichki xato — sensitive ma'lumot LOG QILINMAYDI.
      this.logger.error(
        `uzum-checkout callback kutilmagan xato: ${
          err instanceof Error ? err.message : 'nomaʼlum'
        }`,
      );
      this.reject(res, HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error');
    }
  }

  private reject(res: Response, status: number, code: string): void {
    res.status(status).json({ status: 'FAILED', code });
  }
}
