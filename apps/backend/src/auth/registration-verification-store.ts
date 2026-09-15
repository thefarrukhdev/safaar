import { hashSecret, randomToken } from './security';

/**
 * Partner registration'da telefon egaligini isbotlash uchun: OTP
 * tasdiqlangandan keyin bir martalik, muddati cheklangan "proof" chiqariladi
 * — `PartnersService.submitPublicPartnerRequest` shu proof'ni talab qiladi,
 * chunki hali `partner_organizations` yozuvi yo'q paytda oddiy `otp/verify`
 * (bu `issuePartnerTokensByPhone` orqali MAVJUD tashkilotni talab qiladi)
 * ishlatib bo'lmaydi.
 *
 * `otpStore`ning o'zi kabi: xotira-ichi (in-memory), production hozircha
 * bitta backend instance (mavjud topologiya) — Redis kerak emas. Xom token
 * emas, uning HASH'i saqlanadi (`otpStore`ning `codeHash`siga bir xil
 * sabab bilan bir xil naqsh).
 */

const ttlMs = 10 * 60_000; // OTP muddati (5 daqiqa)dan keyin formani to'ldirishga yetadigan qo'shimcha vaqt

interface VerificationRecord {
  phone: string;
  expiresAt: number;
}

class RegistrationVerificationStore {
  private readonly records = new Map<string, VerificationRecord>();

  issue(phone: string): { token: string; expiresAt: number } {
    const token = randomToken(32);
    const expiresAt = Date.now() + ttlMs;
    this.records.set(this.hashToken(token), { phone, expiresAt });
    return { token, expiresAt };
  }

  /**
   * Bir martalik: birinchi `redeem()` chaqiruvida (natijasidan qat'iy nazar)
   * yozuv butunlay o'chiriladi — xuddi `otpStore.consume()` OTP challenge'ni
   * keyingi qadam (masalan `partnerSetPassword`dagi DB insert) muvaffaqiyatsiz
   * bo'lsa ham allaqachon "yeb qo'ygani" kabi (14-bo'lim: replay har doim
   * FAIL bo'lishi kerak, "ikkinchi urinish" muvaffaqiyatli bo'ladimi yoki
   * yo'qmi, farqi yo'q).
   */
  redeem(token: string, phone: string): void {
    const key = this.hashToken(token);
    const record = this.records.get(key);
    if (record) this.records.delete(key);

    if (!record) {
      throw new Error('PHONE_VERIFICATION_INVALID');
    }
    if (record.expiresAt <= Date.now()) {
      throw new Error('PHONE_VERIFICATION_EXPIRED');
    }
    if (record.phone !== phone) {
      // Boshqa telefon uchun chiqarilgan proof — hech qachon mos kelmasin.
      throw new Error('PHONE_VERIFICATION_INVALID');
    }
  }

  /** Faqat testlar uchun — modul darajasidagi singleton holatini tozalaydi. */
  resetForTests(): void {
    this.records.clear();
  }

  private hashToken(token: string): string {
    return hashSecret(token, registrationProofPepper());
  }
}

function registrationProofPepper(): string {
  return `${process.env.OTP_PEPPER ?? 'safaar-dev-otp-pepper'}:partner-registration-proof`;
}

export const registrationVerificationStore =
  new RegistrationVerificationStore();
