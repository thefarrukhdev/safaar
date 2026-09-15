import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

/**
 * `PhoneOtpThrottleGuard`ning email-OTP so'rovlari uchun hamkasbi —
 * bir xil sabab: `@Throttle` (IP bo'yicha) yolg'iz o'zi bitta email
 * manziliga ko'p IP'dan (proksi/botnet) bombardimon qilishning oldini
 * ololmaydi. Alohida sinf sifatida saqlandi (mavjud `PhoneOtpThrottleGuard`
 * ni umumlashtirish o'rniga) — u allaqachon bir nechta telefon-OTP
 * yo'nalishida ishlatiladi, uni o'zgartirish regressiya xavfini oshiradi.
 */
@Injectable()
export class EmailOtpThrottleGuard implements CanActivate {
  // <normalized email> -> so'rov vaqtlari (ms, epoch)
  private readonly attempts = new Map<string, number[]>();

  private readonly limit = 5;
  private readonly windowMs = 10 * 60_000; // 10 daqiqa

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ body?: Record<string, unknown> }>();
    const email = normalizeEmail(request.body?.email);

    // Email yo'q/noto'g'ri formatda bo'lsa — bu guard indamaydi, DTO
    // validatsiyasi (class-validator) buni allaqachon rad etadi.
    if (!email) return true;

    const now = Date.now();
    const windowStart = now - this.windowMs;
    const existing = (this.attempts.get(email) ?? []).filter(
      (ts) => ts > windowStart,
    );

    if (existing.length >= this.limit) {
      // Tekis {code, message} shakl — HttpErrorFilter O'ZI
      // {success,error:{...}} qatlamini qo'shadi; bu yerda qo'shimcha
      // ichki qatlam qo'yish PhoneOtpThrottleGuard'da topilgan xatoni
      // takrorlagan bo'lardi (generic "Http Exception" xabari — o'sha
      // fayldagi izohga qarang).
      throw new HttpException(
        {
          code: 'EMAIL_RATE_LIMIT_EXCEEDED',
          message:
            "Bu email manzili uchun so'rovlar soni chegaradan oshdi. Birozdan so'ng qayta urinib ko'ring.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.push(now);
    this.attempts.set(email, existing);

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

function normalizeEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const email = value.trim().toLowerCase();
  return email.includes('@') ? email : undefined;
}
