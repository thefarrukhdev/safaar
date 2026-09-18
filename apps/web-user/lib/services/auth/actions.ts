"use server";

import { redirect } from "next/navigation";
import { Role } from "@safaar/types";
import { api, ApiRequestError } from "@/lib/api";
import { clearSession, getSession, setSession } from "@/lib/auth/session";
import { defaultLocale, isLocale } from "@/i18n/config";

/** OTP yuborish natijasi (LoginForm `useActionState`da ishlatadi). */
export interface OtpState {
  ok: boolean;
  devCode?: string;
  error?: string;
}

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rawLocale = String(formData.get("locale") ?? defaultLocale);
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const next = String(formData.get("next") ?? "");

  if (!email) return { error: "EMAIL_REQUIRED" };
  if (!password) return { error: "PASSWORD_REQUIRED" };

  try {
    const result = await api.auth.login(email, password);
    await setSession({
      userId: result.user.id,
      role: Role.USER,
      email: result.user.email ?? undefined,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    return {
      error:
        error instanceof ApiRequestError
          ? error.code || error.message
          : "ERROR",
    };
  }

  const target = next.startsWith("/") ? next : `/${locale}`;
  redirect(target);
}

export async function requestOtpAction(
  _prev: OtpState,
  formData: FormData,
): Promise<OtpState> {
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { ok: false, error: "PHONE_REQUIRED" };

  try {
    const result = await api.auth.sendPhoneOtp(phone);
    return { ok: true, devCode: result.devCode };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "ERROR",
    };
  }
}

export interface VerifyState {
  error?: string;
  needsProfile?: boolean;
  locale?: string;
}

export async function verifyOtpAction(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const rawLocale = String(formData.get("locale") ?? defaultLocale);
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const next = String(formData.get("next") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // HTML checkboxlar FAQAT belgilangan holatda FormData'ga tushadi
  // (belgilanmagan bo'lsa umuman yo'q, "false" emas) — shuning uchun
  // mavjudligi checked holatini bildiradi.
  const agreeTerms = formData.get("agreeTerms") != null;

  if (!phone) return { error: "PHONE_REQUIRED" };

  try {
    const result = await api.auth.verifyPhoneOtp(phone, code);
    await setSession({
      userId: result.user.id,
      role: Role.USER,
      email: result.user.email ?? undefined,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    if (!result.user.firstName) {
      if (firstName) {
        const session = await getSession();
        if (!session) return { error: "SESSION_EXPIRED" };

        if (!password) return { error: "PASSWORD_REQUIRED" };
        const passwordError = validatePassword(password);
        if (passwordError) return { error: passwordError };
        // Client checkboxning o'zi source of truth emas — backend
        // `agree_terms`ni qat'iy qayta tekshiradi (`TERMS_NOT_ACCEPTED`
        // bilan rad etadi). Bu yerdagi tekshiruv faqat tezroq, aniqroq
        // xabar berish uchun (masalan JS/native validation chetlab
        // o'tilgan holatda ham).
        if (!agreeTerms) return { error: "TERMS_NOT_ACCEPTED" };

        await api.auth.completeProfile(session.accessToken, {
          firstName,
          lastName: lastName || undefined,
          phone: phone || undefined,
          email: email || undefined,
          password: password || undefined,
          agreeTerms,
        });
        await setSession({ ...session });

        const target = next.startsWith("/") ? next : `/${locale}`;
        redirect(target);
      }

      return { needsProfile: true, locale };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "ERROR",
    };
  }

  const target = next.startsWith("/") ? next : `/${locale}`;
  redirect(target);
}

export interface CompleteProfileState {
  error?: string;
  ok?: boolean;
}

export interface PasswordResetRequestState {
  ok: boolean;
  email?: string;
  challengeId?: string;
  error?: string;
}

export async function requestPasswordResetAction(
  _prev: PasswordResetRequestState,
  formData: FormData,
): Promise<PasswordResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, error: "EMAIL_REQUIRED" };

  try {
    const result = await api.auth.forgotPassword(email);
    return {
      ok: true,
      email,
      challengeId: result.challengeId,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ApiRequestError
          ? error.code || error.message
          : "ERROR",
    };
  }
}

export interface PasswordResetCodeState {
  verified: boolean;
  email?: string;
  resetToken?: string;
  error?: string;
}

export async function verifyPasswordResetCodeAction(
  _prev: PasswordResetCodeState,
  formData: FormData,
): Promise<PasswordResetCodeState> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const challengeId = String(formData.get("challengeId") ?? "").trim();

  if (!email) return { verified: false, error: "EMAIL_REQUIRED" };
  if (!code) return { verified: false, error: "CODE_REQUIRED" };

  try {
    const result = await api.auth.verifyResetCode(
      email,
      code,
      challengeId || undefined,
    );
    return {
      verified: result.verified,
      email,
      resetToken: result.resetToken,
    };
  } catch (error) {
    return {
      verified: false,
      error:
        error instanceof ApiRequestError
          ? error.code || error.message
          : "ERROR",
    };
  }
}

export interface PasswordResetState {
  ok: boolean;
  error?: string;
}

export async function resetPasswordAction(
  _prev: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const email = String(formData.get("email") ?? "").trim();
  const resetToken = String(formData.get("resetToken") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email) return { ok: false, error: "EMAIL_REQUIRED" };
  if (!resetToken) return { ok: false, error: "RESET_TOKEN_REQUIRED" };
  if (!password) return { ok: false, error: "PASSWORD_REQUIRED" };
  if (password !== confirmPassword) {
    return { ok: false, error: "PASSWORD_MISMATCH" };
  }

  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };

  try {
    await api.auth.resetPassword(email, password, resetToken);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ApiRequestError
          ? error.code || error.message
          : "ERROR",
    };
  }
}

export async function completeProfileAction(
  _prev: CompleteProfileState,
  formData: FormData,
): Promise<CompleteProfileState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const rawLocale = String(formData.get("locale") ?? defaultLocale);
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const password = String(formData.get("password") ?? "");
  const agreeTerms = formData.get("agreeTerms") != null;

  if (!firstName) {
    return { error: "FIRST_NAME_REQUIRED" };
  }
  if (!email) {
    return { error: "EMAIL_REQUIRED" };
  }
  if (!password) {
    return { error: "PASSWORD_REQUIRED" };
  }
  if (!agreeTerms) {
    return { error: "TERMS_NOT_ACCEPTED" };
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }

  try {
    const session = await getSession();
    if (!session) return { error: "SESSION_EXPIRED" };

    await api.auth.completeProfile(session.accessToken, {
      firstName,
      lastName: lastName || undefined,
      phone: phone || undefined,
      email,
      password: password || undefined,
      agreeTerms,
    });
    await setSession({ ...session });
  } catch (error) {
    return {
      error: error instanceof ApiRequestError ? error.message : "ERROR",
    };
  }

  redirect(`/${locale}`);
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "PASSWORD_TOO_SHORT";
  if (!/[A-Z]/.test(password)) return "PASSWORD_NO_UPPERCASE";
  if (!/[a-z]/.test(password)) return "PASSWORD_NO_LOWERCASE";
  if (!/[0-9]/.test(password)) return "PASSWORD_NO_NUMBER";
  if (!/[^A-Za-z0-9]/.test(password)) return "PASSWORD_NO_SPECIAL";
  return null;
}

export async function logoutAction(rawLocale: string): Promise<void> {
  await clearSession();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  redirect(`/${locale}`);
}

export async function getClientSession() {
  return getSession();
}
