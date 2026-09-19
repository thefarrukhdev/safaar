'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Phone, Lock } from 'lucide-react';
import {
  usePartnerPhoneOtpRequest,
  usePartnerPasswordLogin,
  usePartnerSetPassword,
} from '../../_hooks/use-auth';

const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, 'Telefon raqam kiriting')
    .refine((val) => {
      const digits = val.replace(/\D/g, '');
      return digits.length === 9 || (digits.startsWith('998') && digits.length === 12);
    }, "Noto'g'ri telefon raqami formati. Masalan: +998901234567"),
  code: z.string().optional(),
  password: z.string().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

interface PhoneChallenge {
  phone: string;
  challengeId: string;
  partnerType?: string;
  devCode?: string;
}

export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'reset_request' | 'reset_verify'>('login');
  const [challenge, setChallenge] = useState<PhoneChallenge | null>(null);

  const otpRequest = usePartnerPhoneOtpRequest();
  const passwordLogin = usePartnerPasswordLogin();
  const setPassword = usePartnerSetPassword();
  
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '+998', code: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (mode === 'login') {
      if (!values.password || values.password.length < 1) {
        form.setError('password', { message: 'Parolni kiriting' });
        return;
      }
      await passwordLogin.mutateAsync({
        phone: values.phone,
        password: values.password,
      });
      return;
    }

    if (mode === 'reset_request') {
      try {
        const result = await otpRequest.mutateAsync(values.phone);
        setChallenge({
          phone: result.phone,
          challengeId: result.challengeId,
          devCode: result.devCode,
        });
        setMode('reset_verify');
      } catch (error) {
        form.setError('phone', {
          message: error instanceof Error ? error.message : 'Kod yuborishda xatolik yuz berdi',
        });
      }
      return;
    }

    if (mode === 'reset_verify' && challenge) {
      const code = String(values.code ?? '').trim();
      const pwd = String(values.password ?? '').trim();
      if (code.length < 4) {
        form.setError('code', { message: 'Kodni to\'g\'ri kiriting' });
        return;
      }
      if (pwd.length < 6) {
        form.setError('password', { message: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak' });
        return;
      }

      await setPassword.mutateAsync({
        phone: challenge.phone,
        code,
        challengeId: challenge.challengeId,
        password: pwd,
      }).catch((err) => {
        form.setError('code', {
          message: err instanceof Error ? err.message : "Xatolik yuz berdi",
        });
      });
    }
  });

  const resetToLogin = () => {
    setMode('login');
    setChallenge(null);
    form.setValue('code', '');
    form.setValue('password', '');
  };

  const loading = otpRequest.isPending || passwordLogin.isPending || setPassword.isPending;

  return (
    <form
      className="flex flex-col gap-4 fade-in"
      onSubmit={onSubmit}
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-xs font-bold text-slate-700">
          Telefon raqam
        </label>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="phone"
            type="tel"
            placeholder="+998 90 123 45 67"
            className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-50"
            disabled={mode === 'reset_verify'}
            {...form.register('phone')}
          />
        </div>
        {form.formState.errors.phone && (
          <p className="text-xs text-rose-600 font-semibold">{form.formState.errors.phone.message}</p>
        )}
      </div>

      {mode === 'login' && (
        <div className="flex flex-col gap-1.5 animate-fade-in">
          <label htmlFor="password" className="text-xs font-bold text-slate-700">
            Parol
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-3 text-sm tracking-widest rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-white transition-all"
              {...form.register('password')}
            />
          </div>
          {form.formState.errors.password && (
            <p className="text-xs text-rose-600 font-semibold">{form.formState.errors.password.message}</p>
          )}
        </div>
      )}

      {mode === 'reset_verify' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="text-xs font-bold text-slate-700">
              SMS Tasdiqlash kodi
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="code"
                type="text"
                placeholder="000000"
                className="w-full pl-10 pr-4 py-3 text-sm tracking-widest font-mono rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-white transition-all"
                {...form.register('code')}
              />
            </div>
            {form.formState.errors.code && (
              <p className="text-xs text-rose-600 font-semibold">{form.formState.errors.code.message}</p>
            )}
            {challenge?.devCode && (
              <div className="mt-1 rounded-xl bg-emerald-50 p-2.5 border border-emerald-200">
                <p className="text-xs font-medium text-emerald-800 flex items-center justify-between">
                  <span>🛠️ Dasturlash rejimi kodi:</span>
                  <strong className="text-sm tracking-widest bg-emerald-600 text-white px-2 py-0.5 rounded-lg shadow-sm">{challenge.devCode}</strong>
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new_password" className="text-xs font-bold text-slate-700">
              Yangi parol
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="new_password"
                type="password"
                placeholder="Yangi parolni kiriting"
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-white transition-all"
                {...form.register('password')}
              />
            </div>
            {form.formState.errors.password && (
              <p className="text-xs text-rose-600 font-semibold">{form.formState.errors.password.message}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-2">
        <button
          type="submit"
          disabled={loading}
          className="relative w-full rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Biroz kuting...
            </span>
          ) : mode === 'login' ? (
            "Tizimga kirish"
          ) : mode === 'reset_request' ? (
            "Kodni yuborish"
          ) : (
            "Parolni saqlash va kirish"
          )}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            onClick={() => {
              setMode('reset_request');
              form.clearErrors();
            }}
            className="text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors py-2"
          >
            Parolni unutdingizmi yoki endi o'rnatmoqchimisiz?
          </button>
        )}
        {(mode === 'reset_request' || mode === 'reset_verify') && (
          <button
            type="button"
            onClick={resetToLogin}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-2"
          >
            Orqaga (Kirish oynasi)
          </button>
        )}
      </div>
    </form>
  );
}
