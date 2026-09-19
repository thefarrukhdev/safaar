'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Phone, FlaskConical } from 'lucide-react';
import {
  usePartnerPhoneOtpRequest,
  usePartnerPhoneOtpVerify,
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
});

type LoginValues = z.infer<typeof loginSchema>;

interface PhoneChallenge {
  phone: string;
  challengeId: string;
  devCode?: string;
}

export function LoginForm() {
  const [challenge, setChallenge] = useState<PhoneChallenge | null>(null);

  const [watchedPhone, setWatchedPhone] = useState('');
  const otpRequest = usePartnerPhoneOtpRequest();
  const otpVerify = usePartnerPhoneOtpVerify();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '+998', code: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!challenge) {
      try {
        const result = await otpRequest.mutateAsync(values.phone);
        setChallenge({
          phone: result.phone,
          challengeId: result.challengeId,
          devCode: result.devCode,
        });
        form.setValue('phone', result.phone);
      } catch (error) {
        form.setError('phone', {
          message:
            error instanceof Error
              ? error.message
              : 'Kod yuborishda xatolik yuz berdi',
        });
      }
      return;
    }

    const code = String(values.code ?? '').trim();
    if (code.length < 4) {
      form.setError('code', {
        message: 'Telefon raqamga yuborilgan kodni kiriting',
      });
      return;
    }

    try {
      await otpVerify.mutateAsync({
        phone: challenge.phone,
        code,
        challengeId: challenge.challengeId,
      });
    } catch (error) {
      form.setError('code', {
        message:
          error instanceof Error
            ? error.message
            : "Kod noto'g'ri yoki muddati tugagan",
      });
    }
  });

  const resetChallenge = () => {
    setChallenge(null);
    form.setValue('code', '');
    form.setFocus('phone');
  };

  const loading = otpRequest.isPending || otpVerify.isPending;

  return (
    <form
      className="flex flex-col gap-4 fade-in"
      onSubmit={onSubmit}
      aria-label="Telefon raqam bilan kirish"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-xs font-bold text-slate-700">
          Telefon raqam
        </label>
        <div className="relative">
          <Phone
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+998 90 123 45 67"
            className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-50"
            disabled={Boolean(challenge)}
            aria-invalid={Boolean(form.formState.errors.phone)}
            aria-describedby="phone-help phone-error"
            {...form.register('phone', {
              onChange: (e) => setWatchedPhone(e.target.value),
            })}
          />
        </div>
        <p id="phone-help" className="text-[11px] text-slate-500 font-medium">
          Admin tasdiqlagan telefon raqam bilan kabinetga kirasiz.
        </p>
        {form.formState.errors.phone && (
          <p id="phone-error" role="alert" className="text-xs text-rose-600 font-semibold">
            {form.formState.errors.phone.message}
          </p>
        )}
      </div>

      {challenge ? (
        <div className="flex flex-col gap-1.5 animate-fade-in">
          <label htmlFor="code" className="text-xs font-bold text-slate-700">
            Tasdiqlash kodi
          </label>
          <div className="relative">
            <KeyRound
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              id="code"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              placeholder="6 xonali kod"
              className="w-full pl-10 pr-4 py-3 tracking-[0.3em] font-mono text-center text-lg rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-white transition-all"
              aria-invalid={Boolean(form.formState.errors.code)}
              aria-describedby="code-help code-error"
              {...form.register('code', {
                onChange: (event) => {
                  event.target.value = event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 6);
                },
              })}
            />
          </div>
          <p id="code-help" className="text-[11px] text-slate-500 font-medium">
            {`Kod ${challenge.phone} raqamiga yuborildi.`}
          </p>
          
          {challenge.devCode && (
            <div className="mt-1 rounded-xl bg-emerald-50 p-2.5 border border-emerald-200">
              <p className="text-xs font-medium text-emerald-800 flex items-center justify-between">
                <span>🛠️ Dasturlash rejimi kodi:</span>
                <strong className="text-sm tracking-widest bg-emerald-600 text-white px-2 py-0.5 rounded-lg shadow-sm">{challenge.devCode}</strong>
              </p>
            </div>
          )}

          {form.formState.errors.code && (
            <p id="code-error" role="alert" className="text-xs text-rose-600 font-semibold">
              {form.formState.errors.code.message}
            </p>
          )}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 active:bg-blue-800 transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          challenge ? 'Kabinetga kirish' : 'SMS Kodini yuborish'
        )}
      </button>

      {challenge ? (
        <button
          type="button"
          disabled={loading}
          onClick={resetChallenge}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
        >
          Telefon raqamini o'zgartirish
        </button>
      ) : null}
    </form>
  );
}
