'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  KeyRound,
  Phone,
  Lock,
  RotateCw,
  AlertCircle,
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

const INPUT_CLASS =
  'h-11 w-full pl-10 pr-3.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500/15 aria-invalid:border-rose-500 aria-invalid:ring-rose-500/15 transition-all disabled:opacity-60 disabled:bg-slate-50';

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

function FormAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200/80 p-3 text-xs text-rose-800 animate-in fade-in-50"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
      <span className="font-medium leading-relaxed">{message}</span>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1 animate-in fade-in-50"
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

function DevCodeBanner({
  code,
  onCopy,
  copied,
}: {
  code: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <div>
          <span className="text-[11px] text-slate-500 font-normal">Test kodi: </span>
          <span className="font-mono tabular-nums font-bold text-slate-900 tracking-wider">
            {code}
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCopy}
        className="h-6 px-2 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-emerald-600 mr-1" aria-hidden="true" />
            Nusxalandi
          </>
        ) : (
          <>
            <Copy className="h-3 w-3 text-slate-500 mr-1" aria-hidden="true" />
            To&apos;ldirish
          </>
        )}
      </Button>
    </div>
  );
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

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: '',
      code: '',
      password: '',
    },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (mode === 'reset_verify') {
      const timer = setTimeout(() => {
        form.setFocus('code');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mode, form]);

  const handleCopyDevCode = (code: string) => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopiedCode(true);
        form.setValue('code', code, { shouldValidate: true });
        toast.success('Kod nusxalandi va kiritildi');
        setTimeout(() => setCopiedCode(false), 2000);
      })
      .catch(() => {
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

      if (code.length !== 6) {
        form.setError('code', {
          message: "Tasdiqlash kodi 6 ta raqamdan iborat bo'lishi kerak",
        });
        return;
      }
      if (pwd.length < 8) {
        form.setError('password', {
          message: "Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak",
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
        const msg = err instanceof Error ? err.message : 'Xatolik yuz berdi';
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

  const loading =
    otpRequest.isPending || passwordLogin.isPending || setPassword.isPending;

  return (
    <form className="flex flex-col gap-4.5" onSubmit={onSubmit} noValidate>
      {/* Server error alert banner */}
      {serverError && <FormAlert message={serverError} />}

      {/* Mode Back Header for Password Reset */}
      {mode !== 'login' && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900">
              {mode === 'reset_request' ? 'Parolni tiklash' : 'Kodni tasdiqlash'}
            </span>
            <span className="text-xs text-slate-500">
              {mode === 'reset_request'
                ? 'SMS orqali yangi parol o‘rnatish'
                : 'Yangi parol kiriting'}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetToLogin}
            className="h-7 px-2 text-xs font-medium text-slate-500 hover:text-slate-900 gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Kirishga qaytish
          </Button>
        </div>
      )}

      {/* Phone Field */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="phone" className="text-xs font-medium text-slate-700">
            Telefon raqam
          </Label>
          {mode === 'reset_verify' && challenge?.phone && (
            <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {maskPhone(challenge.phone)}
            </span>
          )}
        </div>

        <div className="relative">
          <Phone
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10"
            aria-hidden="true"
          />
          <Controller
            name="phone"
            control={form.control}
            render={({ field }) => (
              <PhoneInput
                id="phone"
                disabled={mode === 'reset_verify'}
                placeholder="+998 90 123 45 67"
                autoComplete="tel"
                inputMode="tel"
                aria-invalid={!!form.formState.errors.phone}
                aria-describedby={form.formState.errors.phone ? 'phone-error' : undefined}
                className={INPUT_CLASS}
                value={field.value}
                onChange={(e) => {
                  field.onChange(e);
                  if (form.formState.errors.phone) form.clearErrors('phone');
                  if (serverError) setServerError(null);
                }}
                onBlur={field.onBlur}
                name={field.name}
              />
            )}
          />
        </div>
        <FieldError id="phone-error" message={form.formState.errors.phone?.message} />
      </div>

      {/* Login Mode: Password field */}
      {mode === 'login' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-medium text-slate-700">
              Parol
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMode('reset_request');
                setServerError(null);
                form.clearErrors();
              }}
              className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 hover:underline hover:bg-transparent font-normal"
            >
              Parolni unutdingizmi?
            </Button>
          </div>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10"
              aria-hidden="true"
            />
            <PasswordInput
              id="password"
              placeholder="Parolingizni kiriting"
              autoComplete="current-password"
              aria-invalid={!!form.formState.errors.password}
              aria-describedby={
                form.formState.errors.password ? 'password-error' : undefined
              }
              className={INPUT_CLASS}
              {...form.register('password', {
                onChange: () => {
                  if (form.formState.errors.password) form.clearErrors('password');
                  if (serverError) setServerError(null);
                },
              })}
            />
          </div>
          <FieldError
            id="password-error"
            message={form.formState.errors.password?.message}
          />
        </div>
      )}

      {/* Reset Verify Mode: Code + New Password */}
      {mode === 'reset_verify' && (
        <div className="flex flex-col gap-3.5">
          {/* SMS Code Field */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="code" className="text-xs font-medium text-slate-700">
                Tasdiqlash kodi
              </Label>
              {countdown > 0 ? (
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {String(Math.floor(countdown / 60)).padStart(2, '0')}:
                  {String(countdown % 60).padStart(2, '0')}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResendOtp}
                  loading={otpRequest.isPending}
                  className="h-6 px-1.5 text-xs text-blue-600 hover:text-blue-700"
                >
                  <RotateCw className="h-3 w-3 mr-1" aria-hidden="true" />
                  Qayta yuborish
                </Button>
              )}
            </div>

            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10"
                aria-hidden="true"
              />
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                spellCheck={false}
                placeholder="000000"
                aria-invalid={!!form.formState.errors.code}
                aria-describedby={form.formState.errors.code ? 'code-error' : undefined}
                className="h-11 w-full pl-10 pr-3.5 text-base text-center tracking-[0.25em] font-mono tabular-nums font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 transition-all"
                {...form.register('code', {
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    if (form.formState.errors.code) form.clearErrors('code');
                    if (serverError) setServerError(null);
                  },
                })}
              />
            </div>

            <FieldError id="code-error" message={form.formState.errors.code?.message} />

            {challenge?.devCode && (
              <DevCodeBanner
                code={challenge.devCode}
                onCopy={() => handleCopyDevCode(challenge.devCode!)}
                copied={copiedCode}
              />
            )}
          </div>

          {/* New Password Field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password" className="text-xs font-medium text-slate-700">
              Yangi parol
            </Label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10"
                aria-hidden="true"
              />
              <PasswordInput
                id="new-password"
                placeholder="Kamida 8 ta belgi"
                autoComplete="new-password"
                aria-invalid={!!form.formState.errors.password}
                aria-describedby={
                  form.formState.errors.password ? 'new-password-error' : undefined
                }
                className={INPUT_CLASS}
                {...form.register('password', {
                  onChange: () => {
                    if (form.formState.errors.password) form.clearErrors('password');
                    if (serverError) setServerError(null);
                  },
                })}
              />
            </div>
            <FieldError
              id="new-password-error"
              message={form.formState.errors.password?.message}
            />
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-1.5">
        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="h-11 w-full text-sm font-semibold rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-sm shadow-blue-500/25 active:scale-[0.99] transition-all cursor-pointer"
        >
          {mode === 'login'
            ? 'Kirish'
            : mode === 'reset_request'
            ? 'Tasdiqlash kodini yuborish'
            : 'Parolni yangilash va kirish'}
        </Button>
      </div>
    </form>
  );
}
