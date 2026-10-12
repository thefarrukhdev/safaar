'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  KeyRound,
  Phone,
  Lock,
  RotateCw,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
} from 'lucide-react';
import {
  usePartnerPhoneOtpRequest,
  usePartnerPasswordLogin,
  usePartnerSetPassword,
} from '../../_hooks/use-auth';
import { PhoneInput } from '../../_components/ui/phone-input';
import { PasswordInput } from '../../_components/ui/password-input';
import { Button } from '../../_components/ui/button';
import { Label } from '../../_components/ui/label';
import { isValidPhone, normalizePhone, maskPhone } from '../../_lib/utils/phone';
import { toast } from 'sonner';

const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, 'Telefon raqamini kiriting')
    .refine((val) => {
      const digits = normalizePhone(val);
      const full = digits.startsWith('998') ? digits : `998${digits}`;
      return isValidPhone(full);
    }, "To'liq telefon raqamini kiriting (masalan: +998 90 123 45 67)"),
  code: z.string().optional(),
  password: z.string().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

interface PhoneChallenge {
  phone: string;
  challengeId: string;
  partnerType?: string;
  devCode?: string;
  resendAfterSeconds?: number;
}

export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'reset_request' | 'reset_verify'>('login');
  const [challenge, setChallenge] = useState<PhoneChallenge | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const otpRequest = usePartnerPhoneOtpRequest();
  const passwordLogin = usePartnerPasswordLogin();
  const setPassword = usePartnerSetPassword();

  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: '',
      code: '',
      password: '',
    },
    mode: 'onTouched',
  });

  // Countdown timer for SMS resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Focus code input when entering reset_verify mode
  useEffect(() => {
    if (mode === 'reset_verify') {
      setTimeout(() => {
        codeInputRef.current?.focus();
      }, 100);
    }
  }, [mode]);

  const handleCopyDevCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      form.setValue('code', code, { shouldValidate: true });
      toast.success('Kod nusxalandi va kiritildi');
      setTimeout(() => setCopiedCode(false), 2000);
    }).catch(() => {
      form.setValue('code', code, { shouldValidate: true });
    });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    const digits = normalizePhone(values.phone);
    const cleanPhone = digits.startsWith('998') ? `+${digits}` : `+998${digits}`;

    if (mode === 'login') {
      const pwd = String(values.password ?? '').trim();
      if (!pwd) {
        form.setError('password', { message: 'Parolni kiriting' });
        return;
      }
      try {
        await passwordLogin.mutateAsync({
          phone: cleanPhone,
          password: pwd,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Kirishda xatolik yuz berdi';
        setServerError(msg);
      }
      return;
    }

    if (mode === 'reset_request') {
      try {
        const result = await otpRequest.mutateAsync(cleanPhone);
        setChallenge({
          phone: result.phone,
          challengeId: result.challengeId,
          devCode: result.devCode,
          resendAfterSeconds: result.resendAfterSeconds,
        });
        setCountdown(result.resendAfterSeconds || 60);
        setMode('reset_verify');
        form.setValue('code', '');
        form.setValue('password', '');
        form.clearErrors();
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'Kod yuborishda xatolik yuz berdi';
        setServerError(msg);
        form.setError('phone', { message: msg });
      }
      return;
    }

    if (mode === 'reset_verify' && challenge) {
      const code = String(values.code ?? '').replace(/\D/g, '').trim();
      const pwd = String(values.password ?? '').trim();

      if (code.length < 4) {
        form.setError('code', { message: "Tasdiqlash kodini to'liq kiriting" });
        return;
      }
      if (pwd.length < 6) {
        form.setError('password', {
          message: "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak",
        });
        return;
      }

      try {
        await setPassword.mutateAsync({
          phone: challenge.phone,
          code,
          challengeId: challenge.challengeId,
          password: pwd,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Xatolik yuz berdi";
        setServerError(msg);
        form.setError('code', { message: msg });
      }
    }
  });

  const handleResendOtp = async () => {
    if (!challenge?.phone || countdown > 0 || otpRequest.isPending) return;
    setServerError(null);
    try {
      const result = await otpRequest.mutateAsync(challenge.phone);
      setChallenge((prev) =>
        prev
          ? {
              ...prev,
              challengeId: result.challengeId,
              devCode: result.devCode,
              resendAfterSeconds: result.resendAfterSeconds,
            }
          : null
      );
      setCountdown(result.resendAfterSeconds || 60);
      toast.success('Yangi tasdiqlash kodi yuborildi');
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Kodni qayta yuborishda xatolik yuz berdi';
      setServerError(msg);
      toast.error(msg);
    }
  };

  const resetToLogin = () => {
    setMode('login');
    setChallenge(null);
    setServerError(null);
    form.setValue('code', '');
    form.setValue('password', '');
    form.clearErrors();
  };

  const backToResetRequest = () => {
    setMode('reset_request');
    setServerError(null);
    form.setValue('code', '');
    form.clearErrors();
  };

  const loading =
    otpRequest.isPending || passwordLogin.isPending || setPassword.isPending;

  return (
    <form className="flex flex-col gap-4.5 fade-in" onSubmit={onSubmit} noValidate>
      {/* Server error alert banner */}
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 p-3 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in-50 duration-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">{serverError}</div>
        </div>
      )}

      {/* Mode Navigation Header for Reset flows */}
      {mode === 'reset_request' && (
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Parolni tiklash</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              SMS orqali yangi parol o'rnatish
            </p>
          </div>
          <button
            type="button"
            onClick={resetToLogin}
            className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kirish
          </button>
        </div>
      )}

      {mode === 'reset_verify' && (
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Kodni tasdiqlash</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              SMS kod va yangi parol
            </p>
          </div>
          <button
            type="button"
            onClick={backToResetRequest}
            className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            O'zgartirish
          </button>
        </div>
      )}

      {/* Phone Number Field */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="phone" className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Telefon raqam
          </Label>
          {mode === 'reset_verify' && challenge?.phone && (
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              {maskPhone(challenge.phone)}
            </span>
          )}
        </div>

        <div className="relative">
          <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 z-10" />
          <Controller
            name="phone"
            control={form.control}
            render={({ field }) => (
              <PhoneInput
                id="phone"
                disabled={mode === 'reset_verify'}
                placeholder="+998 90 123 45 67"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-800/40"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
              />
            )}
          />
        </div>
        {form.formState.errors.phone && (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 mt-0.5 animate-in fade-in-50">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {form.formState.errors.phone.message}
          </p>
        )}
      </div>

      {/* Login Mode: Password field */}
      {mode === 'login' && (
        <div className="flex flex-col gap-1.5 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Parol
            </Label>
            <button
              type="button"
              onClick={() => {
                setMode('reset_request');
                setServerError(null);
                form.clearErrors();
              }}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors cursor-pointer"
            >
              Parolni unutdingizmi?
            </button>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 z-10" />
            <PasswordInput
              id="password"
              placeholder="Parolingizni kiriting"
              autoComplete="current-password"
              className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
              {...form.register('password')}
            />
          </div>
          {form.formState.errors.password && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 mt-0.5 animate-in fade-in-50">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {form.formState.errors.password.message}
            </p>
          )}
        </div>
      )}

      {/* Reset Verify Mode: Code + New Password */}
      {mode === 'reset_verify' && (
        <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
          {/* SMS Code Field */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="code" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                SMS Tasdiqlash kodi
              </Label>
              {countdown > 0 ? (
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  Qayta yuborish: {String(Math.floor(countdown / 60)).padStart(2, '0')}:
                  {String(countdown % 60).padStart(2, '0')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpRequest.isPending}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RotateCw className={`h-3 w-3 ${otpRequest.isPending ? 'animate-spin' : ''}`} />
                  Kodni qayta yuborish
                </button>
              )}
            </div>

            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 z-10" />
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className="w-full pl-10 pr-4 py-2.5 text-base text-center tracking-[0.3em] font-mono font-semibold rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
                {...form.register('code', {
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  },
                })}
              />
            </div>

            {form.formState.errors.code && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 mt-0.5 animate-in fade-in-50">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {form.formState.errors.code.message}
              </p>
            )}

            {/* Dev Mode Banner with one-click fill */}
            {challenge?.devCode && (
              <div className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 p-2.5 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                      Dasturlash rejimi kodi:
                    </p>
                    <p className="font-mono text-xs font-bold text-emerald-950 dark:text-emerald-200 tracking-wider">
                      {challenge.devCode}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyDevCode(challenge.devCode!)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-800 hover:bg-emerald-100/80 dark:hover:bg-slate-700 border border-emerald-300 dark:border-emerald-700 rounded-lg shadow-2xs transition-all cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      Kiritildi
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
                      To'ldirish
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* New Password Field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new_password" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Yangi parol
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 z-10" />
              <PasswordInput
                id="new_password"
                placeholder="Kamida 6 ta belgi"
                autoComplete="new-password"
                className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
                {...form.register('password')}
              />
            </div>
            {form.formState.errors.password && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 mt-0.5 animate-in fade-in-50">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {form.formState.errors.password.message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Submit Button & Actions */}
      <div className="flex flex-col gap-3 mt-1">
        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="w-full text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/25 active:scale-[0.99] transition-all cursor-pointer"
        >
          {mode === 'login' ? (
            'Tizimga kirish'
          ) : mode === 'reset_request' ? (
            'Tasdiqlash kodini yuborish'
          ) : (
            'Parolni saqlash va kirish'
          )}
        </Button>

        {mode === 'login' && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setMode('reset_request');
                setServerError(null);
                form.clearErrors();
              }}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-1 cursor-pointer"
            >
              Parolni unutdingizmi yoki endi o'rnatmoqchimisiz?
            </button>
          </div>
        )}

        {mode === 'reset_request' && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={resetToLogin}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors py-1 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kirish oynasiga qaytish
            </button>
          </div>
        )}

        {mode === 'reset_verify' && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={resetToLogin}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors py-1 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Bekor qilish va kirishga qaytish
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

