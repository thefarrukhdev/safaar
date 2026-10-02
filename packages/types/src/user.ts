import type { Role } from './auth';

export type UserStatus = 'unverified' | 'active' | 'blocked' | 'deleted';
export type Language = 'uz' | 'ru' | 'en';

export interface User {
  id: string;
  phone: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  fullName?: string;
  status?: UserStatus;
  preferred_language?: Language;
  role?: Role;
  isBlocked?: boolean;
  blocked_reason?: string | null;
  booking_blocked_until?: string | null;
  booking_blocked_reason?: string | null;
  phone_verified_at?: string | null;
  email_verified_at?: string | null;
  last_login_at?: string | null;
  bonus_balance?: number;
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

/** Ro'yxatdan o'tish so'rovi (telefon + SMS OTP). */
export interface RegisterUserDto {
  phone: string;
  fullName: string;
  email?: string;
}

export interface VerifyOtpDto {
  phone: string;
  code: string;
  challenge_id?: string;
}

export interface UserProfile extends User {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: UserStatus;
  preferred_language: Language;
  blocked_reason: string | null;
  booking_blocked_until: string | null;
  booking_blocked_reason: string | null;
  phone_verified_at: string | null;
  email_verified_at: string | null;
  last_login_at: string | null;
  bonus_balance: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UpdateUserProfileDto {
  first_name?: string;
  last_name?: string;
  email?: string;
}
