import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { hashSecret } from './security';

export type OtpPurpose =
  | 'user_login'
  | 'partner_login'
  | 'password_reset'
  | 'partner_email_verify'
  | 'partner_registration';

export interface OtpChallenge {
  id: string;
  /** Despite the name, this is any opaque delivery-channel identifier the
   * caller passes in — a phone number for every purpose except
   * 'partner_email_verify', where it's an email address. Nothing in this
   * store validates format; that happens at the DTO layer. */
  phone: string;
  purpose: OtpPurpose;
  codeHash: string;
  attempts: number;
  expiresAt: number;
  resendAfter: number;
  createdAt: string;
}

const otpTtlMs = toPositiveInt(process.env.OTP_TTL_SECONDS, 300) * 1000;
const resendMs = 60_000;
const maxAttempts = 5;
const maxPerHour = 8;

class OtpStore {
  private readonly challenges = new Map<string, OtpChallenge>();
  private readonly phoneRate = new Map<string, number[]>();
  private readonly resendGuard = new Map<string, number>();
  private readonly deliveryCodes = new Map<string, string>();

  create(phone: string, purpose: OtpPurpose): OtpChallenge {
    this.assertRateLimit(phone);
    this.assertResendCooldown(phone, purpose);

    const code = randomInt(100_000, 1_000_000).toString();
    const now = Date.now();
    const challenge: OtpChallenge = {
      id: randomUUID(),
      phone,
      purpose,
      codeHash: hashSecret(code, this.otpPepper(phone, purpose)),
      attempts: 0,
      expiresAt: now + otpTtlMs,
      resendAfter: now + resendMs,
      createdAt: new Date(now).toISOString(),
    };

    this.challenges.set(challenge.id, challenge);
    this.deliveryCodes.set(challenge.id, code);
    this.resendGuard.set(this.resendKey(phone, purpose), now);
    return challenge;
  }

  consume(input: {
    challengeId?: string;
    phone: string;
    purpose: OtpPurpose;
    code: string;
  }): void {
    const challenge = this.findChallenge(input);
    if (!challenge || challenge.expiresAt <= Date.now()) {
      throw new Error('OTP_EXPIRED');
    }

    challenge.attempts += 1;
    const expectedHash = hashSecret(
      input.code,
      this.otpPepper(input.phone, input.purpose),
    );

    if (
      challenge.attempts > maxAttempts ||
      !constantTimeEqual(challenge.codeHash, expectedHash)
    ) {
      throw new Error('OTP_INVALID');
    }

    this.challenges.delete(challenge.id);
    this.deliveryCodes.delete(challenge.id);
  }

  getDeliveryCode(challengeId: string): string | undefined {
    return this.deliveryCodes.get(challengeId);
  }

  /** Faqat testlar uchun — modul darajasidagi singleton holatini tozalaydi. */
  resetForTests(): void {
    this.challenges.clear();
    this.phoneRate.clear();
    this.resendGuard.clear();
    this.deliveryCodes.clear();
  }

  private findChallenge(input: {
    challengeId?: string;
    phone: string;
    purpose: OtpPurpose;
  }): OtpChallenge | undefined {
    if (input.challengeId) {
      const challenge = this.challenges.get(input.challengeId);
      if (
        challenge?.phone === input.phone &&
        challenge.purpose === input.purpose
      ) {
        return challenge;
      }
      return undefined;
    }

    return [...this.challenges.values()]
      .filter(
        (challenge) =>
          challenge.phone === input.phone &&
          challenge.purpose === input.purpose,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }

  private assertRateLimit(phone: string) {
    const now = Date.now();
    const windowStart = now - 60 * 60_000;
    const hits = (this.phoneRate.get(phone) ?? []).filter(
      (value) => value > windowStart,
    );

    if (hits.length >= maxPerHour) {
      throw new Error('OTP_RATE_LIMITED');
    }

    hits.push(now);
    this.phoneRate.set(phone, hits);
  }

  /**
   * `resendAfter` challenge maydonida hisoblanardi, lekin hech qayerda
   * majburlanmasdi — client uni e'tiborsiz qoldirib, kod so'rovini
   * darhol qayta yuborishi mumkin edi (SMS bombing/cost-abuse vektori).
   */
  private assertResendCooldown(phone: string, purpose: OtpPurpose) {
    const lastSentAt = this.resendGuard.get(this.resendKey(phone, purpose));
    if (lastSentAt !== undefined && lastSentAt + resendMs > Date.now()) {
      throw new Error('OTP_RESEND_TOO_SOON');
    }
  }

  private resendKey(phone: string, purpose: OtpPurpose): string {
    return `${purpose}:${phone}`;
  }

  private otpPepper(phone: string, purpose: OtpPurpose): string {
    return `${process.env.OTP_PEPPER ?? 'safaar-dev-otp-pepper'}:${purpose}:${phone}`;
  }
}

/**
 * Oddiy `!==` string solishtirish hash uzunligi/prefiks mos kelishiga
 * qarab bir necha nanosekund farqli vaqt sarflaydi — nazariy jihatdan
 * timing-attack orqali hash'ni bo'lak-bo'lak tiklashga imkon beradi.
 * `timingSafeEqual` buferlar uzunligi teng bo'lishini talab qiladi,
 * shu sabab uzunlik farqini alohida tekshiramiz.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const otpStore = new OtpStore();
