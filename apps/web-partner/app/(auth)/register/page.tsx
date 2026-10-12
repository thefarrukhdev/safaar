'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Phone,
  KeyRound,
  Lock,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
  RotateCw,
} from 'lucide-react';
import { Button } from '../../_components/ui/button';
import { Input } from '../../_components/ui/input';
import { PhoneInput } from '../../_components/ui/phone-input';
import { PasswordInput } from '../../_components/ui/password-input';
import { Label } from '../../_components/ui/label';
import { access } from '../../_lib/api';
import {
  usePartnerRegistrationOtpRequest,
  usePartnerRegistrationOtpVerify,
} from '../../_hooks/use-auth';
import {
  isValidPhone,
  normalizePhone,
  maskPhone,
} from '../../_lib/utils/phone';
import { toast } from 'sonner';

const schema = z.object({
  type: z.enum([
    'hotel',
    'bus',
    'hostel',
    'guesthouse',
    'motel',
    'dacha',
    'restaurant',
  ]),
  companyName: z.string().min(2, 'Obyekt/Kompaniya nomini kiriting'),
  contactPerson: z.string().min(2, "Mas'ul shaxsni kiriting"),
  phone: z
    .string()
    .min(1, 'Telefon raqamni kiriting')
    .refine(isValidPhone, "Telefon noto'g'ri formatda"),
  password: z.string().min(6, "Parol kamida 6ta belgi bo'lishi kerak"),
  email: z.string().email("Email noto'g'ri"),
  city: z.string().min(2, 'Shaharni kiriting'),
  address: z.string().min(5, 'Manzilni kiriting'),
  taxId: z
    .string()
    .min(9, "STIR 9 ta raqamdan iborat bo'lishi kerak")
    .max(9, "STIR 9 ta raqamdan iborat bo'lishi kerak")
    .regex(/^\d{9}$/, 'Faqat raqamlar kiriting'),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// Reusable styling for consistent input appearance across light and dark modes
const inputBaseClasses =
  'w-full py-2.5 px-3.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-2xs';

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState<{ id: string } | null>(null);
  const [error, setError] = useState('');

  // Registration flow: fill the whole form -> request real SMS OTP for the
  // entered phone -> verify it against the real backend -> submit the
  // pending form values together with the one-time server-side proof that
  // verify returns.
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [challenge, setChallenge] = useState<{
    phone: string;
    challengeId: string;
    devCode?: string;
  } | null>(null);
  const [codeValue, setCodeValue] = useState('');
  const [countdown, setCountdown] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const otpRequest = usePartnerRegistrationOtpRequest();
  const otpVerify = usePartnerRegistrationOtpVerify();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'hotel',
      companyName: '',
      contactPerson: '',
      phone: '+998 ',
      password: '',
      email: '',
      city: '',
      address: '',
      taxId: '',
      note: '',
    },
  });

  // Countdown timer for SMS resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleCopyDevCode = (code: string) => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopiedCode(true);
        setCodeValue(code);
        toast.success('Kod nusxalandi va kiritildi');
        setTimeout(() => setCopiedCode(false), 2000);
      })
      .catch(() => {
        setCodeValue(code);
      });
  };

  const handleResendOtp = async () => {
    if (!challenge?.phone || countdown > 0 || otpRequest.isPending) return;
    setError('');
    try {
      const result = await otpRequest.mutateAsync(challenge.phone);
      setChallenge((prev) =>
        prev
          ? {
              ...prev,
              challengeId: result.challengeId,
              devCode: result.devCode,
            }
          : null
      );
      setCountdown(result.resendAfterSeconds || 60);
      toast.success('Yangi tasdiqlash kodi yuborildi');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kodni qayta yuborishda xatolik yuz berdi';
      setError(msg);
      toast.error(msg);
    }
  };

  const onSubmitForm = form.handleSubmit(async (values) => {
    setError('');
    try {
      const result = await otpRequest.mutateAsync(values.phone);
      setChallenge({
        phone: result.phone,
        challengeId: result.challengeId,
        devCode: result.devCode,
      });
      setCountdown(result.resendAfterSeconds || 60);
      setCodeValue('');
      setPendingValues(values);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod yuborishda xatolik');
    }
  });

  const handleVerifyCodeAndSubmit = async () => {
    setError('');
    if (codeValue.length < 4) {
      setError("Kodni to'g'ri kiriting");
      return;
    }
    if (!challenge || !pendingValues) {
      setError("Avval formani to'ldiring");
      setStep('form');
      return;
    }

    setIsSubmittingForm(true);
    try {
      const verified = await otpVerify.mutateAsync({
        phone: challenge.phone,
        code: codeValue,
        challengeId: challenge.challengeId,
      });

      const result = await access.submitPartnerApplication({
        ...pendingValues,
        phone: normalizePhone(pendingValues.phone),
        phoneVerificationToken: verified.verificationToken,
      } as any);
      setSubmitted({ id: result?.item?.id || 'demo-id' });
    } catch (cause: any) {
      if (cause?.payload?.fields) {
        for (const [field, message] of Object.entries(cause.payload.fields)) {
          form.setError(field as any, {
            type: 'server',
            message: message as string,
          });
        }
        setError(
          cause.payload.message || "Iltimos formadagi xatoliklarni to'g'irlang",
        );
        setStep('form');
      } else {
        setError(
          cause instanceof Error ? cause.message : "Kod noto'g'ri yoki ariza yuborishda xatolik",
        );
      }
    } finally {
      setIsSubmittingForm(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col gap-6 text-center animate-in fade-in-50 duration-200 py-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 shadow-sm">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Ariza yuborildi
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Arizangiz muvaffaqiyatli qabul qilindi va web-admin paneliga yo'naltirildi. Admin tasdiqlagandan so'ng kiritgan parolingiz bilan tizimga to'liq kira olasiz.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/login" className="w-full inline-block">
            <Button
              className="w-full text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/25 active:scale-[0.99] transition-all cursor-pointer"
              size="lg"
            >
              Login sahifasiga o'tish
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-in fade-in-50 duration-200">
      {/* Header & Back Navigation */}
      <div className="flex flex-col gap-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors w-fit mb-0.5 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Login sahifasiga qaytish
        </Link>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100/80 dark:border-blue-900/60">
            <Building2 className="h-4 w-4" aria-hidden />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Hamkorlik arizasi
          </h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-normal">
          {step === 'form' &&
            "Ma'lumotlarni to'ldiring. Tasdiqlash uchun telefon raqamingizga SMS kod yuboriladi."}
          {step === 'code' &&
            "Arizani tasdiqlash uchun telefoningizga yuborilgan tasdiqlash kodini kiriting."}
        </p>
      </div>

      {/* Error alert banner */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 p-3 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in-50 duration-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">{error}</div>
        </div>
      )}

      {/* Step 2: SMS OTP Verification */}
      {step === 'code' && (
        <div className="flex flex-col gap-4.5 animate-in fade-in-50 duration-200 mt-1 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 p-5 rounded-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-700/80">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Kodni tasdiqlash</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                SMS orqali kelgan tasdiqlash kodi
              </p>
            </div>
            {challenge?.phone && (
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                {maskPhone(challenge.phone)}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="reg-code" className="text-xs font-bold text-slate-700 dark:text-slate-300">
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
                id="reg-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full pl-10 pr-4 py-2.5 text-base text-center tracking-[0.3em] font-mono font-semibold rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-2xs"
              />
            </div>

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

          <div className="flex gap-3 mt-1">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setStep('form')}
              className="w-1/3 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-all cursor-pointer"
            >
              Orqaga
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handleVerifyCodeAndSubmit}
              loading={isSubmittingForm}
              className="w-2/3 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/25 active:scale-[0.99] transition-all cursor-pointer"
            >
              Tasdiqlash va Yuborish
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Main Application Form */}
      <div className={step === 'code' ? 'hidden' : 'block'}>
        <form
          className="flex flex-col gap-4 animate-in fade-in-50 duration-200 mt-1"
          onSubmit={onSubmitForm}
          noValidate
        >
          {/* Phone Field */}
          <Field label="Telefon raqamingiz" error={form.formState.errors.phone?.message}>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 z-10" />
              <PhoneInput
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-2xs"
                {...form.register('phone')}
              />
            </div>
          </Field>

          {/* Password Field */}
          <Field
            label="Tizimga kirish uchun parol"
            error={form.formState.errors.password?.message}
          >
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 z-10" />
              <PasswordInput
                placeholder="Kamida 6 ta belgi"
                className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-2xs"
                {...form.register('password')}
              />
            </div>
          </Field>

          {/* Business Type Select */}
          <Field label="Obyekt turi" error={form.formState.errors.type?.message}>
            <select
              {...form.register('type')}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-900 dark:text-slate-100 shadow-2xs transition-all focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-800 cursor-pointer"
            >
              <option value="hotel" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                Mehmonxona
              </option>
              <option value="hostel" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                Yotoqxona (Hostel)
              </option>
              <option value="guesthouse" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                Mehmon uyi
              </option>
              <option value="motel" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                Motel
              </option>
              <option value="dacha" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                Dacha
              </option>
              <option value="restaurant" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                Restoran
              </option>
              <option value="bus" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                Transport (Mashina Ijarasi)
              </option>
            </select>
          </Field>

          {/* Company Name */}
          <Field
            label="Obyekt yoki Kompaniya nomi"
            error={form.formState.errors.companyName?.message}
          >
            <Input
              {...form.register('companyName')}
              placeholder="Grand Samarkand Hotel"
              className={inputBaseClasses}
            />
          </Field>

          {/* Contact Person */}
          <Field
            label="Mas'ul shaxs"
            error={form.formState.errors.contactPerson?.message}
          >
            <Input
              {...form.register('contactPerson')}
              placeholder="Ali Valiyev"
              className={inputBaseClasses}
            />
          </Field>

          {/* Email */}
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input
              type="email"
              {...form.register('email')}
              placeholder="hotel@example.com"
              className={inputBaseClasses}
            />
          </Field>

          {/* City & STIR */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shahar" error={form.formState.errors.city?.message}>
              <Input
                {...form.register('city')}
                placeholder="Samarqand"
                className={inputBaseClasses}
              />
            </Field>
            <Field label="STIR (9 ta raqam)" error={form.formState.errors.taxId?.message}>
              <Input
                inputMode="numeric"
                maxLength={9}
                {...form.register('taxId', {
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9);
                  },
                })}
                placeholder="123456789"
                className={inputBaseClasses}
              />
            </Field>
          </div>

          {/* Address */}
          <Field label="Manzil" error={form.formState.errors.address?.message}>
            <Input
              {...form.register('address')}
              placeholder="Registon ko'chasi 10"
              className={inputBaseClasses}
            />
          </Field>

          {/* Note */}
          <Field label="Izoh (Ixtiyoriy)" error={form.formState.errors.note?.message}>
            <Input
              {...form.register('note')}
              placeholder="Qo'shimcha ma'lumot yoki talablar"
              className={inputBaseClasses}
            />
          </Field>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            loading={otpRequest.isPending}
            className="mt-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/25 active:scale-[0.99] transition-all cursor-pointer"
          >
            Arizani yuborish
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 mt-0.5 animate-in fade-in-50">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
