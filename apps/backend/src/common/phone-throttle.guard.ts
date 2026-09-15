import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

/**
 * OTP/parol-tiklash so'rovlari uchun TELEFON RAQAMI bo'yicha qo'shimcha
 * cheklov — mavjud `@Throttle` (IP bo'yicha) bilan BIRGA ishlaydi, uni
 * almashtirmaydi. Maqsad: agar hujumchi ko'p IP (proksi/botnet) orqali
 * bitta qurbonning telefon raqamiga son-sanoqsiz SMS yuborsa (SMS-bombing),
 * IP-asosli limit buni ushlab qololmaydi — bu guard aynan shu bo'shliqni
 * yopadi.
 *
 * Xotira-ichi (in-memory), production hozircha BITTA backend instance
 * bo'lgani uchun bu yetarli (Phase 14B/14D'da tasdiqlangan topologiya).
 * Agar kelajakda gorizontal masshtablansa — Redis-backed storage'ga
 * o'tish kerak bo'ladi (bu yerda ataylab qilinmagan, minimal fix doirasi).
 */
@Injectable()
export class PhoneOtpThrottleGuard implements CanActivate {
  // <normalized phone> -> so'rov vaqtlari (ms, epoch)
  private readonly attempts = new Map<string, number[]>();

  private readonly limit = 5;
  private readonly windowMs = 10 * 60_000; // 10 daqiqa

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ body?: Record<string, unknown> }>();
    const phone = normalizePhone(request.body?.phone);

    // Telefon raqami yo'q/noto'g'ri formatda bo'lsa — bu guard indamaydi,
    // DTO validatsiyasi (class-validator) buni allaqachon rad etadi.
    if (!phone) return true;

    const now = Date.now();
    const windowStart = now - this.windowMs;
    const existing = (this.attempts.get(phone) ?? []).filter(
      (ts) => ts > windowStart,
    );

    if (existing.length >= this.limit) {
      // 2026-09-15 topilgan real xato (web-partner E2E orqali): bu yerda
      // avval {success:false, error:{code,message}} bilan tashlangan —
      // ya'ni HttpErrorFilter (common/http-error.filter.ts) KUTGANIDAN BIR
      // QAVAT CHUQURROQ shakl. Filter tepadagi `success`/`error` ochilib
      // ketgan holatga mo'ljallanmagan (u o'zi shu qatlamni qo'shadi),
      // shuning uchun butun ichki obyekt "code" maydoniga tushib, tashqi
      // `message` esa umuman aniqlanmay generic "Http Exception"ga aylanib
      // ketardi — foydalanuvchi lokalizatsiya qilingan xabar o'rniga shu
      // ma'nosiz matnni ko'rardi. To'g'ri, tekis shakl — xuddi
      // auth.service.ts'dagi barcha `UnauthorizedException({code, message})`
      // chaqiruvlari kabi.
      throw new HttpException(
        {
          code: 'PHONE_RATE_LIMIT_EXCEEDED',
          message:
            "Bu telefon raqami uchun so'rovlar soni chegaradan oshdi. Birozdan so'ng qayta urinib ko'ring.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.push(now);
    this.attempts.set(phone, existing);

    // Xotira sizib chiqishining oldini olish uchun — vaqti-vaqti bilan
    // butunlay bo'sh (oynadan tashqari) yozuvlarni tozalaymiz.
    if (this.attempts.size > 5000) {
      for (const [key, timestamps] of this.attempts) {
        if (timestamps.every((ts) => ts <= windowStart)) {
          this.attempts.delete(key);
        }
      }
    }

    return true;
  }
}

/**
 * PHASE 14I — CRITICAL FIX: avvalgi versiya faqat `.trim()` qilardi, ya'ni
 * "+998901234567", "998901234567", "+998 90 123 45 67" va
 * "+998-90-123-45-67" — hammasi bitta HAQIQIY raqam bo'lsa-da, Map'da
 * TO'RTTA ALOHIDA kalit sifatida ko'rinardi — bu per-phone limitni
 * format almashtirish orqali cheksiz chetlab o'tish imkonini berardi
 * (14H auditda CONFIRMED bypass sifatida topilgan).
 *
 * Endi `AuthService.normalizePhone()`dagi (allaqachon production'da
 * ishlatilayotgan, to'g'ri) mantiq bilan bir xil: faqat raqamlar
 * qoldiriladi, `998` bilan boshlanmasa old qo'shiladi. Ikkalasi ham
 * BIR XIL kanonik shaklga ("+998901234567") tushadi — endi Map'da
 * BITTA kalit.
 */
function normalizePhone(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const digits = value.replace(/\D/g, '');
  // Juda qisqa/bo'sh raqamlar (masalan butunlay noto'g'ri/bo'sh input)
  // uchun normalizatsiya qilmaymiz — aks holda turli xil noto'g'ri
  // qiymatlar barchasi bitta umumiy "+998" kalitiga tushib, bir-biriga
  // aloqasi bo'lmagan so'rovlar bir xil limitni bo'lishib olishi mumkin
  // edi. Haqiqiy O'zbekiston raqami har doim kamida 9 ta raqamdan
  // iborat (kod bo'lmasa) — bundan qisqasi amalda yaroqsiz.
  if (digits.length < 9) return undefined;
  return digits.startsWith('998') ? `+${digits}` : `+998${digits}`;
}
