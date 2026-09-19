"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { AuthDict } from "@/i18n/dictionaries";
import {
  loginAction,
  requestPasswordResetAction,
  resetPasswordAction,
  verifyPasswordResetCodeAction,
  type LoginState,
  type PasswordResetCodeState,
  type PasswordResetRequestState,
  type PasswordResetState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthSplitLayout } from "./AuthSplitLayout";
import { config } from "@/lib/config";

const API_URL = config.apiUrl;

type LoginMode = "login" | "forgot-email" | "forgot-code" | "reset-password";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}


export function LoginForm({
  locale,
  next,
  dict,
  socialError,
}: {
  locale: Locale;
  next: string;
  dict: AuthDict;
  socialError?: string;
}) {
  const [mode, setMode] = useState<LoginMode>("login");
  const [email, setEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetChallengeId, setResetChallengeId] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const [loginState, loginFormAction, loggingIn] = useActionState<
    LoginState,
    FormData
  >(loginAction, {});
  const [resetRequestState, requestResetFormAction, requestingReset] =
    useActionState<PasswordResetRequestState, FormData>(
      requestPasswordResetAction,
      { ok: false },
    );
  const [resetCodeState, verifyResetCodeFormAction, verifyingResetCode] =
    useActionState<PasswordResetCodeState, FormData>(
      verifyPasswordResetCodeAction,
      { verified: false },
    );
  const [resetPasswordState, resetPasswordFormAction, resettingPassword] =
    useActionState<PasswordResetState, FormData>(resetPasswordAction, {
      ok: false,
    });

  useEffect(() => {
    if (resetRequestState.ok && resetRequestState.email) {
      queueMicrotask(() => {
        setResetEmail(resetRequestState.email ?? "");
        setResetChallengeId(resetRequestState.challengeId ?? "");
        setMode("forgot-code");
      });
    }
  }, [resetRequestState]);

  useEffect(() => {
    if (resetCodeState.verified && resetCodeState.resetToken) {
      queueMicrotask(() => {
        setResetEmail(resetCodeState.email ?? resetEmail);
        setResetToken(resetCodeState.resetToken ?? "");
        setMode("reset-password");
      });
    }
  }, [resetCodeState, resetEmail]);

  useEffect(() => {
    if (resetPasswordState.ok) {
      queueMicrotask(() => {
        setMode("login");
        setResetDone(true);
      });
    }
  }, [resetPasswordState.ok]);

  const oauthQuery = new URLSearchParams({
    locale,
    ...(next ? { next } : {}),
  }).toString();
  const socialErrorMessage = socialError
    ? socialErrorMessageFor(socialError, dict)
    : "";

  return (
    <AuthSplitLayout locale={locale} dict={dict}>
      {mode === "login" && (
        <form action={loginFormAction} className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{dict.title}</h1>
            <p className="text-sm font-bold text-slate-700">{dict.passwordLoginSubtitle}</p>
          </header>

          {socialErrorMessage && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              {socialErrorMessage}
            </p>
          )}
          {resetDone && (
            <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-700">
              {dict.passwordResetSuccess}
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">{dict.email}</span>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={dict.emailPlaceholder}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">{dict.password}</span>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder={dict.passwordLoginPlaceholder}
            />
          </label>

          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="next" value={next} />

          {loginState.error && (
            <p className="text-sm font-bold text-red-600">
              {authErrorMessageFor(loginState.error, dict)}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="text-sm font-extrabold text-primary-700 hover:text-primary-800"
              onClick={() => {
                setResetDone(false);
                setMode("forgot-email");
              }}
            >
              {dict.forgotPassword}
            </button>
          </div>

          <Button type="submit" size="lg" loading={loggingIn} className="rounded-xl bg-primary-600 font-bold text-white shadow-xs hover:bg-primary-700">
            {dict.login}
          </Button>

          <p className="text-center text-sm font-bold text-slate-700">
            {dict.noAccount}{" "}
            <Link
              href={`/${locale}/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="font-extrabold text-primary-700 hover:text-primary-800"
            >
              {dict.register}
            </Link>
          </p>

          <SocialLoginButtons dict={dict} oauthQuery={oauthQuery} />
        </form>
      )}

      {mode === "forgot-email" && (
        <form action={requestResetFormAction} className="flex flex-col gap-4">
          <AuthHeader
            title={dict.forgotPasswordTitle}
            subtitle={dict.forgotPasswordSubtitle}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">{dict.email}</span>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={email}
              placeholder={dict.emailPlaceholder}
            />
          </label>
          {resetRequestState.error && (
            <p className="text-sm font-bold text-red-600">
              {authErrorMessageFor(resetRequestState.error, dict)}
            </p>
          )}
          <Button type="submit" size="lg" loading={requestingReset} className="rounded-xl bg-primary-600 font-bold text-white shadow-xs hover:bg-primary-700">
            {dict.sendCode}
          </Button>
          <BackToLoginButton dict={dict} onClick={() => setMode("login")} />
        </form>
      )}

      {mode === "forgot-code" && (
        <form action={verifyResetCodeFormAction} className="flex flex-col gap-4">
          <AuthHeader
            title={dict.resetCodeTitle}
            subtitle={dict.resetCodeSubtitle}
          />
          <input type="hidden" name="email" value={resetEmail} />
          <input type="hidden" name="challengeId" value={resetChallengeId} />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">{dict.code}</span>
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              placeholder="••••••"
            />
          </label>
          {resetCodeState.error && (
            <p className="text-sm font-bold text-red-600">
              {authErrorMessageFor(resetCodeState.error, dict)}
            </p>
          )}
          <Button type="submit" size="lg" loading={verifyingResetCode} className="rounded-xl bg-primary-600 font-bold text-white shadow-xs hover:bg-primary-700">
            {dict.verifyCode}
          </Button>
          <BackToLoginButton dict={dict} onClick={() => setMode("login")} />
        </form>
      )}

      {mode === "reset-password" && (
        <form action={resetPasswordFormAction} className="flex flex-col gap-4">
          <AuthHeader
            title={dict.newPasswordTitle}
            subtitle={dict.newPasswordSubtitle}
          />
          <input type="hidden" name="email" value={resetEmail} />
          <input type="hidden" name="resetToken" value={resetToken} />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">{dict.newPassword}</span>
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder={dict.passwordPlaceholder}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">{dict.confirmPassword}</span>
            <Input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              placeholder={dict.confirmPasswordPlaceholder}
            />
          </label>
          {resetPasswordState.error && (
            <p className="text-sm font-bold text-red-600">
              {authErrorMessageFor(resetPasswordState.error, dict)}
            </p>
          )}
          <Button type="submit" size="lg" loading={resettingPassword} className="rounded-xl bg-primary-600 font-bold text-white shadow-xs hover:bg-primary-700">
            {dict.saveNewPassword}
          </Button>
          <BackToLoginButton dict={dict} onClick={() => setMode("login")} />
        </form>
      )}
    </AuthSplitLayout>
  );
}

function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
      <p className="text-sm font-bold text-slate-700">{subtitle}</p>
    </header>
  );
}

function BackToLoginButton({
  dict,
  onClick,
}: {
  dict: AuthDict;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="text-center text-sm font-extrabold text-primary-700 hover:text-primary-800"
      onClick={onClick}
    >
      {dict.backToLogin}
    </button>
  );
}

function SocialLoginButtons({
  dict,
  oauthQuery,
}: {
  dict: AuthDict;
  oauthQuery: string;
}) {
  return (
    <>
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-300" />
        </div>
        <div className="relative flex justify-center text-xs uppercase font-extrabold tracking-wider">
          <span className="bg-slate-50 px-2.5 text-slate-700">{dict.or}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <a
          href={`${API_URL}/auth/google?${oauthQuery}`}
          className="flex items-center justify-center gap-3 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-2xs transition-all hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98]"
        >
          <GoogleIcon />
          {dict.googleLogin}
        </a>
      </div>
    </>
  );
}

function socialErrorMessageFor(error: string, dict: AuthDict): string {
  if (
    error === "OAUTH_ACCOUNT_NOT_REGISTERED" ||
    error === "OAUTH_USER_NOT_REGISTERED"
  ) {
    return dict.socialAccountNotRegistered;
  }
  if (error === "USER_NOT_ACTIVE") {
    return dict.accountNotActive;
  }
  return dict.socialLoginError;
}

function authErrorMessageFor(error: string, dict: AuthDict): string {
  const messages: Record<string, string> = {
    AUTH_INVALID_CREDENTIALS: dict.invalidCredentials,
    USER_NO_PASSWORD: dict.userNoPassword,
    EMAIL_REQUIRED: dict.emailRequired,
    PASSWORD_REQUIRED: dict.passwordRequired,
    CODE_REQUIRED: dict.codeRequired,
    OTP_INVALID: dict.codeInvalid,
    OTP_EXPIRED: dict.codeExpired,
    PASSWORD_MISMATCH: dict.passwordMismatch,
    PASSWORD_TOO_SHORT: dict.passwordTooShort,
    PASSWORD_NO_UPPERCASE: dict.passwordNoUppercase,
    PASSWORD_NO_LOWERCASE: dict.passwordNoLowercase,
    PASSWORD_NO_NUMBER: dict.passwordNoNumber,
    PASSWORD_NO_SPECIAL: dict.passwordNoSpecial,
    PASSWORD_RESET_TOKEN_INVALID: dict.passwordResetTokenInvalid,
  };

  return messages[error] ?? dict.error;
}
