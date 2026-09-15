import { ExecutionContext, HttpException } from '@nestjs/common';
import { PhoneOtpThrottleGuard } from './phone-throttle.guard';

/**
 * PHASE 14I — CRITICAL FIX regression testlari.
 *
 * 14H auditda CONFIRMED bypass: eski `normalizePhone()` faqat `.trim()`
 * qilardi, shuning uchun BIR XIL raqamning turli formatlari (bo'shliq,
 * chiziqcha, `+998` prefiksi bor/yo'q) Map'da ALOHIDA kalit hisoblanib,
 * per-phone limitni cheksiz chetlab o'tish imkonini berardi. Bu fayl
 * aynan shu bypass endi yopilganini isbotlaydi.
 */
function contextWithPhone(phone: unknown): ExecutionContext {
  const request = { body: { phone } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PhoneOtpThrottleGuard', () => {
  let guard: PhoneOtpThrottleGuard;

  beforeEach(() => {
    guard = new PhoneOtpThrottleGuard();
  });

  it("BEFORE-fix bypass endi yopiq: bir xil raqamning 4 xil formati BITTA limitni bo'lishadi — 5 tadan keyin boshqa formatdagi SO'ROV HAM 429 oladi", () => {
    const sameNumberDifferentFormats = [
      '+998901234567',
      '998901234567',
      '+998 90 123 45 67',
      '+998-90-123-45-67',
      '+998901234567', // 5-chi — limitga yetadi (limit=5)
    ];

    for (const phone of sameNumberDifferentFormats) {
      expect(guard.canActivate(contextWithPhone(phone))).toBe(true);
    }

    // 6-chi so'rov — YANA BOSHQA formatda, lekin AYNAN O'SHA raqam —
    // endi 429 bilan rad etilishi SHART (bypass yopilgan bo'lsa).
    expect(() =>
      guard.canActivate(contextWithPhone('998 90 123 45 67')),
    ).toThrow(HttpException);

    try {
      guard.canActivate(contextWithPhone('998-90-123-45-67'));
      fail('429 kutilgan edi');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      // 2026-09-15: tekis {code, message} shakl (HttpErrorFilter'ning o'zi
      // {success,error:{...}} qatlamini keyinroq qo'shadi — bu yerda ham
      // shunday qilish "Http Exception" degan ma'nosiz xabarga olib
      // kelayotgan real xato edi, web-partner E2E orqali topildi).
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'PHONE_RATE_LIMIT_EXCEEDED',
      });
    }
  });

  it("boshqa telefon raqami — mustaqil, o'z limitiga ega (birinchisining limiti unga ta'sir qilmaydi)", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(guard.canActivate(contextWithPhone('+998901234567'))).toBe(true);
    }
    // birinchi raqam endi limitga yetdi
    expect(() => guard.canActivate(contextWithPhone('+998901234567'))).toThrow(
      HttpException,
    );

    // BUTUNLAY BOSHQA raqam — hali ham ochiq
    expect(guard.canActivate(contextWithPhone('+998907654321'))).toBe(true);
  });

  it('whitespace-only farq (bosh/oxiridagi probel, ichki probel) — bitta kalit sifatida hisoblanadi (5-chidan keyin 6-chi ham 429 oladi)', () => {
    const whitespaceVariants = [
      '  +998901234567  ',
      '+998 90 123 45 67',
      '+998901234567',
      ' 998901234567 ',
      '+998   901234567',
    ];
    for (const phone of whitespaceVariants) {
      expect(guard.canActivate(contextWithPhone(phone))).toBe(true);
    }
    expect(() =>
      guard.canActivate(contextWithPhone('+998 901 234 567')),
    ).toThrow(HttpException);
  });

  it("malformed/bo'sh qiymat — guard indamaydi (DTO validatsiyasiga qoldiriladi), xato tashlamaydi", () => {
    expect(guard.canActivate(contextWithPhone(undefined))).toBe(true);
    expect(guard.canActivate(contextWithPhone(''))).toBe(true);
    expect(guard.canActivate(contextWithPhone('   '))).toBe(true);
    expect(guard.canActivate(contextWithPhone('abc'))).toBe(true);
    expect(guard.canActivate(contextWithPhone(12345))).toBe(true); // string emas
    expect(guard.canActivate(contextWithPhone(null))).toBe(true);
    expect(guard.canActivate(contextWithPhone({}))).toBe(true);
  });

  it("juda qisqa raqam-ko'rinishidagi qiymatlar (9 xonadan kam) normalizatsiya qilinmaydi — turli xil noto'g'ri qiymatlar bir-birining limitini yemaydi", () => {
    for (let i = 0; i < 10; i += 1) {
      // Har biri < 9 raqam — hech biri normalizatsiya qilinmasligi, demak
      // guard hech qachon 429 qaytarmasligi kerak, nechta chaqirilishidan
      // qat'iy nazar.
      expect(guard.canActivate(contextWithPhone('123'))).toBe(true);
    }
  });

  it("limit oynasi (10 daqiqa) o'tgach — qayta ruxsat beriladi", () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let currentTime = 1_000_000;
    nowSpy.mockImplementation(() => currentTime);

    for (let i = 0; i < 5; i += 1) {
      expect(guard.canActivate(contextWithPhone('+998901234567'))).toBe(true);
    }
    expect(() => guard.canActivate(contextWithPhone('+998901234567'))).toThrow(
      HttpException,
    );

    // 10 daqiqa + 1ms o'tdi
    currentTime += 10 * 60_000 + 1;
    expect(guard.canActivate(contextWithPhone('+998901234567'))).toBe(true);

    nowSpy.mockRestore();
  });
});
