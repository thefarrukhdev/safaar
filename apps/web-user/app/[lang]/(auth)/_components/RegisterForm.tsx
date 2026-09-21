"use client";

import { useActionState, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { AuthDict } from "@/i18n/dictionaries";
import {
  requestOtpAction,
  verifyOtpAction,
  completeProfileAction,
  type OtpState,
  type VerifyState,
  type CompleteProfileState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthSplitLayout } from "./AuthSplitLayout";

function passwordStrength(pw: string): { label: string; level: number; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { label: "", level: 0, color: "bg-red-500" };
  if (score <= 3) return { label: "Zaif", level: 1, color: "bg-red-500" };
  if (score <= 4) return { label: "O'rtacha", level: 2, color: "bg-yellow-500" };
  return { label: "Kuchli", level: 3, color: "bg-green-500" };
}

export function RegisterForm({
  locale,
  next,
  dict,
}: {
  locale: Locale;
  next: string;
  dict: AuthDict;
}) {
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") || "";
  const phoneFromQuery = searchParams.get("phone") || "";
  const [email, setEmail] = useState(emailFromQuery);
  const [phone, setPhone] = useState(phoneFromQuery);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const strength = useMemo(() => passwordStrength(password), [password]);

  const [otpState, requestAction, sending] = useActionState<OtpState, FormData>(
    requestOtpAction,
    { ok: false },
  );
  const [verifyState, verifyAction, verifying] = useActionState<
    VerifyState,
    FormData
  >(verifyOtpAction, {});
  const [profileState, profileAction, saving] = useActionState<
    CompleteProfileState,
    FormData
  >(completeProfileAction, {});

  const isStep2 = verifyState.needsProfile;
  const action = isStep2 ? profileAction : verifyAction;
  const loading = sending || verifying || saving;

  const errorMsg = otpState.error || verifyState.error || profileState.error;

  const passwordErrorMap: Record<string, string> = {
    PASSWORD_REQUIRED: dict.passwordRequired,
    PASSWORD_TOO_SHORT: dict.passwordTooShort,
    PASSWORD_NO_UPPERCASE: dict.passwordNoUppercase,
    PASSWORD_NO_LOWERCASE: dict.passwordNoLowercase,
    PASSWORD_NO_NUMBER: dict.passwordNoNumber,
    PASSWORD_NO_SPECIAL: dict.passwordNoSpecial,
  };
  const formErrorMap: Record<string, string> = {
    FIRST_NAME_REQUIRED: dict.firstNameRequired,
    EMAIL_REQUIRED: dict.emailRequired,
    OTP_INVALID: dict.codeInvalid,
    OTP_EXPIRED: dict.codeExpired,
    TERMS_NOT_ACCEPTED: dict.termsNotAccepted,
  };

  return (
    <AuthSplitLayout locale={locale} dict={dict}>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          {isStep2 ? dict.completeProfileTitle : dict.registerTitle}
        </h1>
        <p className="text-sm font-bold text-slate-700">
          {isStep2 ? dict.completeProfileSubtitle : dict.registerSubtitle}
        </p>
      </header>

      <form action={action} className="flex flex-col gap-4">
        {/* Phone + Send code */}
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">{dict.phone}</span>
            <Input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={dict.phonePlaceholder || "+998901234567"}
            />
          </label>
          <Button
            type="submit"
            variant="secondary"
            size="md"
            loading={sending}
            disabled={otpState.ok && !otpState.error}
            formAction={requestAction}
            formNoValidate
            className="rounded-full bg-slate-900/[0.05] text-slate-900 hover:bg-slate-900/[0.08] active:scale-[0.97]"
          >
            {otpState.ok ? dict.codeSent : dict.sendCode}
          </Button>
        </div>

        {otpState.error && (
          <p className="-mt-2 text-sm font-bold text-red-600">{otpState.error === "PHONE_REQUIRED" ? (dict.phoneRequired) : dict.error}</p>
        )}

        {otpState.devCode && (
          <p className="rounded-xl border border-primary-300 bg-primary-50 px-3 py-2 text-sm font-bold text-primary-900">
            {dict.devCode}: <strong>{otpState.devCode}</strong>
          </p>
        )}

        {/* OTP input */}
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

        <hr className="border-slate-300" />

        {/* Profile fields */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            {dict.firstName} <span className="text-red-500">*</span>
          </span>
          <Input
            name="firstName"
            required
            placeholder={dict.firstNamePlaceholder}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">{dict.lastName}</span>
          <Input
            name="lastName"
            placeholder={dict.lastNamePlaceholder}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            {dict.email} <span className="text-red-500">*</span>
          </span>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={dict.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {/* Password */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">{dict.password}</span>
          <div className="relative">
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder={dict.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 hover:text-slate-700 font-bold"
              aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
        </label>

        {password && (
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= strength.level ? strength.color : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs font-bold text-slate-700">{strength.label}</p>
          </div>
        )}

        {/* Password requirements checklist */}
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-3.5 text-xs text-slate-700">
          <p className="mb-1 font-extrabold uppercase tracking-wider text-slate-800">{dict.passwordRequirements}</p>
          <ul className="list-inside list-disc space-y-0.5 font-bold">
            <li className={password.length >= 8 ? "text-green-700 font-extrabold" : ""}>{dict.passwordMinChars}</li>
            <li className={/[A-Z]/.test(password) ? "text-green-700 font-extrabold" : ""}>{dict.passwordUppercase}</li>
            <li className={/[a-z]/.test(password) ? "text-green-700 font-extrabold" : ""}>{dict.passwordLowercase}</li>
            <li className={/[0-9]/.test(password) ? "text-green-700 font-extrabold" : ""}>{dict.passwordNumber}</li>
            <li className={/[^A-Za-z0-9]/.test(password) ? "text-green-700 font-extrabold" : ""}>{dict.passwordSpecial}</li>
          </ul>
        </div>

        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="phone" value={phone} />

        {errorMsg && (
          <p className="text-sm font-bold text-red-600">
            {passwordErrorMap[errorMsg] || formErrorMap[errorMsg] || dict.error}
          </p>
        )}

        {/* Oferta Checkbox */}
        <label className="flex items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="agreeTerms"
            required
            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-slate-700">
            Men <Link href={`/${locale}/terms`} target="_blank" className="font-bold text-primary-600 hover:underline">Ommaviy Oferta (Foydalanish shartlari)</Link> bilan tanishib chiqdim va ularga roziman.
          </span>
        </label>

        <Button type="submit" size="lg" loading={loading} className="rounded-full bg-primary-600 font-bold text-white hover:bg-primary-700 active:scale-[0.97]">
          {dict.verifyAndRegister}
        </Button>

        <p className="text-center text-sm font-bold text-slate-700">
          {dict.hasAccount}{" "}
          <Link
            href={`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-extrabold text-primary-700 hover:text-primary-800"
          >
            {dict.login}
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}
