import type { AuthTokens, VerifyOtpDto } from '@safaar/types';
import { request } from '../client';

export interface OtpRequestResponse {
  sent: boolean;
  challenge_id: string;
  expires_in_seconds: number;
  resend_after_seconds: number;
  dev_code?: string;
}

export interface PartnerEmailOtpRequestResponse {
  sent: boolean;
  challenge_id?: string;
  expires_in_seconds?: number;
  resend_after_seconds?: number;
  dev_code?: string;
}

export interface PartnerEmailOtpVerifyDto {
  email: string;
  code: string;
  challenge_id: string;
}

/** SMS OTP yuborish so'rovi. */
export function requestOtp(phone: string): Promise<OtpRequestResponse> {
  return request<OtpRequestResponse>('/auth/otp/request', {
    method: 'POST',
    body: { phone },
  });
}

export interface PartnerLoginResponse extends AuthTokens {
  organization_id: string;
  organizationId?: string;
  partner_role: string;
}

/** OTP'ni tekshirib, JWT tokenlarini olish. Backend: `POST /auth/otp/verify`
 * -> `AuthService.verifyPartnerOtp` -> `issuePartnerTokensByPhone` (partner
 * kontekstida chaqiriladi, shuning uchun oddiy `AuthTokens` emas —
 * organization_id/partner_role bilan). */
export function verifyOtp(dto: VerifyOtpDto): Promise<PartnerLoginResponse> {
  return request<PartnerLoginResponse>('/auth/otp/verify', {
    method: 'POST',
    body: dto,
  });
}

export type PartnerPhoneLoginResponse = PartnerLoginResponse;
export type PartnerEmailLoginResponse = PartnerLoginResponse;

export function partnerPhoneLogin(
  phone: string,
): Promise<PartnerPhoneLoginResponse> {
  return request<PartnerPhoneLoginResponse>('/auth/partner/phone-login', {
    method: 'POST',
    body: { phone },
  });
}

export function requestPartnerEmailOtp(
  email: string,
): Promise<PartnerEmailOtpRequestResponse> {
  return request<PartnerEmailOtpRequestResponse>(
    '/auth/partner/email-otp/request',
    {
      method: 'POST',
      body: { email },
    },
  );
}

export function verifyPartnerEmailOtp(
  dto: PartnerEmailOtpVerifyDto,
): Promise<PartnerEmailLoginResponse> {
  return request<PartnerEmailLoginResponse>('/auth/partner/email-otp/verify', {
    method: 'POST',
    body: dto,
  });
}

export function partnerPasswordLogin(
  phone: string,
  password?: string,
): Promise<PartnerPhoneLoginResponse> {
  return request<PartnerPhoneLoginResponse>('/auth/partner/password-login', {
    method: 'POST',
    body: { phone, password },
  });
}

export interface PartnerSetPasswordDto {
  phone: string;
  code: string;
  challenge_id: string;
  password?: string;
}

export function partnerSetPassword(
  dto: PartnerSetPasswordDto,
): Promise<PartnerPhoneLoginResponse> {
  return request<PartnerPhoneLoginResponse>('/auth/partner/set-password', {
    method: 'POST',
    body: dto,
  });
}

export interface PartnerForgotPasswordResponse {
  actor_type: string;
  sent: boolean;
  challenge_id?: string;
  expires_in_seconds?: number;
  resend_after_seconds?: number;
  dev_code?: string;
}

/** Backend: `POST /auth/partner/forgot-password` (phone OTP orqali parolni
 * tiklash so'rovi — `partner/set-password`dan farqli, ALOHIDA 'password_reset'
 * OTP purpose ishlatadi). Hozircha hech qaysi ekran chaqirmaydi — mavjud
 * "Parolni unutdingizmi..." havolasi o'rniga set-password oqimini
 * ishlatadi (login-form.tsx). Kelajakda kerak bo'lsa shu wrapper tayyor. */
export function partnerForgotPassword(
  phone: string,
): Promise<PartnerForgotPasswordResponse> {
  return request<PartnerForgotPasswordResponse>(
    '/auth/partner/forgot-password',
    { method: 'POST', body: { phone } },
  );
}

export interface PartnerResetPasswordDto {
  phone: string;
  code: string;
  challenge_id?: string;
  password: string;
}

export interface PartnerResetPasswordResponse {
  actor_type: string;
  reset: boolean;
}

/** Backend: `POST /auth/partner/reset-password` — `partnerForgotPassword`ga
 * hamkasb, hozircha chaqiruvchisi yo'q (izohga qarang). */
export function partnerResetPassword(
  dto: PartnerResetPasswordDto,
): Promise<PartnerResetPasswordResponse> {
  return request<PartnerResetPasswordResponse>(
    '/auth/partner/reset-password',
    { method: 'POST', body: dto },
  );
}

/** Backend: `POST /auth/partner/logout` — joriy sessiyani (RolesGuard orqali
 * aniqlangan) serverda bekor qiladi. Token yo'q/eskirgan bo'lsa ham
 * mahalliy tozalash (`clearSession`) davom etishi kerak — shuning uchun
 * `useLogout` bu chaqiruvni har doim `catch` bilan o'raydi. */
export function partnerLogout(
  token: string | null,
): Promise<{ actor_id: string; logged_out: boolean }> {
  return request('/auth/partner/logout', { method: 'POST', token });
}
