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
  challenge_id: string;
  expires_in_seconds: number;
  resend_after_seconds: number;
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

/** OTP'ni tekshirib, JWT tokenlarini olish. */
export function verifyOtp(dto: VerifyOtpDto): Promise<AuthTokens> {
  return request<AuthTokens>('/auth/otp/verify', {
    method: 'POST',
    body: dto,
  });
}

export interface PartnerLoginResponse extends AuthTokens {
  organization_id: string;
  organizationId?: string;
  /** `partner_organizations.type` — authoritative source for partner-type
   * UI branching (room/bed/table/vehicle management etc). Backend:
   * `issuePartnerTokensByPhone` (auth.service.ts), same helper behind
   * every partner login path (OTP verify, phone-login, password-login,
   * set-password), so this is populated consistently regardless of which
   * one was used. */
  organization_type?: string;
  organizationType?: string;
  partner_role: string;
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

export function partnerLogin(
  email: string,
  password?: string,
): Promise<PartnerLoginResponse> {
  return request<PartnerLoginResponse>('/auth/partner/login', {
    method: 'POST',
    body: { email, password },
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
