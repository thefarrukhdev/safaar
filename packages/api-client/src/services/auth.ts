import { rawApi } from "../client";
import { camelizeKeys } from "../case";

export interface SendOtpResult {
  sent: boolean;
  challengeId?: string;
  expiresInSeconds: number;
  resendAfterSeconds?: number;
  devCode?: string;
}

export interface VerifyOtpResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
}

export interface OAuthRegistrationRequiredResult {
  requiresRegistration: true;
  registrationToken: string;
  provider: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export type OAuthExchangeResult = VerifyOtpResult | OAuthRegistrationRequiredResult;

export interface PasswordResetCodeResult {
  sent: boolean;
  challengeId?: string;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
}

export interface VerifyResetCodeResult {
  verified: boolean;
  resetToken: string;
  expiresInSeconds: number;
}

export interface CompleteProfileResult {
  id: string;
  phone?: string | null;
  email: string;
  firstName: string;
  lastName: string;
}

export const authService = {
  /** `POST /auth/user/login` — email va parol orqali kirish. */
  async login(email: string, password: string): Promise<VerifyOtpResult> {
    const raw = await rawApi.post<unknown>("/auth/user/login", {
      email,
      password,
    });
    return camelizeKeys<VerifyOtpResult>(raw);
  },

  /** `POST /auth/user/send-otp` — telefon raqamiga SMS orqali OTP yuborish. */
  async sendPhoneOtp(phone: string): Promise<SendOtpResult> {
    const raw = await rawApi.post<unknown>("/auth/user/send-otp", { phone });
    return camelizeKeys<SendOtpResult>(raw);
  },

  /** `POST /auth/user/verify-otp` — SMS kodini tekshirish, token + user qaytaradi. */
  async verifyPhoneOtp(
    phone: string,
    code: string,
    challengeId?: string,
  ): Promise<VerifyOtpResult> {
    const raw = await rawApi.post<unknown>("/auth/user/verify-otp", {
      phone,
      code,
      challenge_id: challengeId,
    });
    return camelizeKeys<VerifyOtpResult>(raw);
  },

  /** `POST /auth/oauth/exchange` — OAuth callbackdagi bir martalik kodni sessiya tokenlariga (yoki ro'yxatdan o'tish talab qilinsa, registration token'ga) almashtiradi. */
  async exchangeOAuthCode(code: string): Promise<OAuthExchangeResult> {
    const raw = await rawApi.post<unknown>("/auth/oauth/exchange", { code });
    return camelizeKeys<OAuthExchangeResult>(raw);
  },

  /** `POST /auth/oauth/register` — Google/Facebook orqali yangi foydalanuvchini telefon+OTP bilan ro'yxatdan o'tkazadi (parolsiz). */
  async completeOAuthRegistration(data: {
    provider: string;
    registrationToken: string;
    phone: string;
    code: string;
    challengeId?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<VerifyOtpResult> {
    const raw = await rawApi.post<unknown>("/auth/oauth/register", {
      provider: data.provider,
      registration_token: data.registrationToken,
      phone: data.phone,
      code: data.code,
      challenge_id: data.challengeId,
      first_name: data.firstName,
      last_name: data.lastName,
    });
    return camelizeKeys<VerifyOtpResult>(raw);
  },

  /** `POST /auth/user/forgot-password` — telefon raqamiga SMS orqali parol tiklash kodi yuborish. */
  async forgotPassword(phone: string): Promise<PasswordResetCodeResult> {
    const raw = await rawApi.post<unknown>("/auth/user/forgot-password", {
      phone,
    });
    return camelizeKeys<PasswordResetCodeResult>(raw);
  },

  /** `POST /auth/user/verify-reset-code` — parol tiklash kodini tekshirish. */
  async verifyResetCode(
    phone: string,
    code: string,
    challengeId?: string,
  ): Promise<VerifyResetCodeResult> {
    const raw = await rawApi.post<unknown>("/auth/user/verify-reset-code", {
      phone,
      code,
      challenge_id: challengeId,
    });
    return camelizeKeys<VerifyResetCodeResult>(raw);
  },

  /** `POST /auth/user/reset-password` — yangi parolni saqlash. */
  async resetPassword(
    phone: string,
    password: string,
    resetToken: string,
  ): Promise<{ reset: boolean }> {
    const raw = await rawApi.post<unknown>("/auth/user/reset-password", {
      phone,
      password,
      reset_token: resetToken,
    });
    return camelizeKeys<{ reset: boolean }>(raw);
  },

  /** `POST /auth/user/complete-profile` — birinchi marta kirgan foydalanuvchi profilini to'ldiradi.
   * `agreeTerms` backend tomonidan MAJBURIY tekshiriladi (`true` bo'lmasa
   * `TERMS_NOT_ACCEPTED` bilan rad etiladi) — bu yerda faqat uzatiladi,
   * client'ning o'zi hech narsani "tasdiqlagan" deb hisoblamaydi. */
  async completeProfile(
    token: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      password?: string;
      agreeTerms: boolean;
    },
  ): Promise<CompleteProfileResult> {
    const body: Record<string, unknown> = {
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      email: data.email,
      agree_terms: data.agreeTerms,
    };
    if (data.password) {
      body.password = data.password;
    }
    const raw = await rawApi.post<unknown>(
      "/auth/user/complete-profile",
      body,
      { token },
    );
    return camelizeKeys<CompleteProfileResult>(raw);
  },
};
