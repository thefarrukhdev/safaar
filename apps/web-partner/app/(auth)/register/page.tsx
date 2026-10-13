'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
  Terminal,
  Copy,
  Check,
  RotateCw,
} from 'lucide-react';
import { Button } from '../../_components/ui/button';
import { Input } from '../../_components/ui/input';
import { Select } from '../../_components/ui/select';
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

const UZBEKISTAN_CITIES = [
  'Toshkent',
  'Samarqand',
  'Buxoro',
  'Xiva',
  'Farg\'ona',
  'Namangan',
  'Andijon',
  'Nukus',
  'Qarshi',
  'Termiz',
  'Jizzax',
  'Urganch',
  'Navoiy',
  'Guliston',
  'Zomin',
  'Chorvoq',
  'Chimyon',
  'Qo\'qon',
  'Marg\'ilon',
  'Shahrisabz',
] as const;

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
  companyName: z.string().min(2, 'Obyekt yoki kompaniya nomini kiriting'),
  city: z.string().min(2, 'Shaharni kiriting'),
  phone: z
    .string()
    .min(1, 'Telefon raqamni kiriting')
    .refine(isValidPhone, "Telefon noto'g'ri formatda"),
  password: z.string().min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak"),
});

type FormValues = z.infer<typeof schema>;

// Reusable styling for consistent input appearance across light mode
const inputBaseClasses =
  'w-full py-2.5 px-3.5 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-600 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20 aria-[invalid=true]:focus:border-red-600 aria-[invalid=true]:focus:ring-red-500/25 aria-invalid:border-red-500 aria-invalid:ring-red-500/20 aria-invalid:focus:border-red-600 aria-invalid:focus:ring-red-500/25 transition-all shadow-2xs';

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
  const [citySelection, setCitySelection] = useState<string>('Toshkent');
  const [customCity, setCustomCity] = useState<string>('');

  const otpRequest = usePartnerRegistrationOtpRequest();
  const otpVerify = usePartnerRegistrationOtpVerify();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'hotel',
      companyName: '',
      city: 'Toshkent',
      phone: '+998 ',
      password: '',
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
    const cleanCode = codeValue.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      setError("Tasdiqlash kodi 6 ta raqamdan iborat bo'lishi kerak");
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

      const digits = normalizePhone(pendingValues.phone);
      const formattedPhone = digits.startsWith('998') ? `+${digits}` : `+998${digits}`;

      const result = await access.submitPartnerApplication({
        type: pendingValues.type,
        companyName: pendingValues.companyName.trim(),
        city: pendingValues.city.trim(),
        phone: formattedPhone,
        password: pendingValues.password,
        phoneVerificationToken: verified.verificationToken,
      });
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 border border-emerald-200/80 shadow-sm">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Ariza qabul qilindi
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Arizangiz muvaffaqiyatli qabul qilindi va ko&apos;rib chiqish uchun yuborildi. Adminlar tasdiqlagandan so&apos;ng kiritgan parolingiz bilan tizimga to&apos;liq kira olasiz.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link href="/login" className="flex-1 inline-block">
            <Button
              className="w-full text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/25 active:scale-[0.99] transition-all cursor-pointer"
              size="lg"
            >
              Login sahifasiga o&apos;tish
            </Button>
          </Link>
          <Link href="/status" className="flex-1 inline-block">
            <Button
              variant="outline"
              className="w-full text-sm font-semibold rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              size="lg"
            >
              Ariza holatini tekshirish
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors w-fit mb-0.5 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Login sahifasiga qaytish
        </Link>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100/80">
            <Building2 className="h-4 w-4" aria-hidden />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Hamkorlik arizasi
          </h2>
        </div>
        <p className="text-sm text-slate-500 leading-normal">
          {step === 'form' &&
            "Ma'lumotlarni to'ldiring. Tasdiqlash uchun telefon raqamingizga SMS kod yuboriladi."}
          {step === 'code' &&
            "Arizani tasdiqlash uchun telefoningizga yuborilgan tasdiqlash kodini kiriting."}
        </p>
      </div>

      {/* Error alert banner */}
      {error && (
        <div
          id="reg-error"
          role="alert"
          className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-xs text-rose-800 animate-in fade-in-50 duration-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
          <div className="flex-1 font-medium leading-relaxed">{error}</div>
        </div>
      )}

      {/* Step 2: SMS OTP Verification */}
      {step === 'code' && (
        <div className="flex flex-col gap-4.5 animate-in fade-in-50 duration-200 mt-1 bg-slate-50/80 border border-slate-200/80 p-5 rounded-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Kodni tasdiqlash</h3>
              <p className="text-xs text-slate-500">
                SMS orqali kelgan tasdiqlash kodi
              </p>
            </div>
            {challenge?.phone && (
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                {maskPhone(challenge.phone)}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="reg-code" className="text-xs font-bold text-slate-700">
                SMS Tasdiqlash kodi
              </Label>
              {countdown > 0 ? (
                <span className="text-[11px] font-mono text-slate-500">
                  Qayta yuborish: {String(Math.floor(countdown / 60)).padStart(2, '0')}:
                  {String(countdown % 60).padStart(2, '0')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpRequest.isPending}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RotateCw className={`h-3 w-3 ${otpRequest.isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
                  Kodni qayta yuborish
                </button>
              )}
            </div>

            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" aria-hidden="true" />
              <input
                id="reg-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                spellCheck={false}
                placeholder="000000"
                aria-invalid={!!error}
                aria-describedby={error ? "reg-error" : undefined}
                value={codeValue}
                onChange={(e) => {
                  setCodeValue(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (error) setError('');
                }}
                className="w-full pl-10 pr-4 py-2.5 text-base text-center tracking-[0.3em] font-mono font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-600 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20 aria-[invalid=true]:focus:border-red-600 aria-[invalid=true]:focus:ring-red-500/25 aria-invalid:border-red-500 aria-invalid:ring-red-500/20 aria-invalid:focus:border-red-600 aria-invalid:focus:ring-red-500/25 transition-all shadow-2xs"
              />
            </div>

            {/* Dev Mode Banner with one-click fill */}
            {challenge?.devCode && (
              <div className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 p-2.5 border border-emerald-200/80 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-emerald-800">
                      Dasturlash rejimi kodi:
                    </p>
                    <p className="font-mono text-xs font-bold text-emerald-950 tracking-wider">
                      {challenge.devCode}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyDevCode(challenge.devCode!)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-white hover:bg-emerald-100/80 border border-emerald-300 rounded-lg shadow-2xs transition-all cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                      Kiritildi
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 text-emerald-700" aria-hidden="true" />
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
              className="w-1/3 text-xs font-semibold rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer"
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
          <Field id="phone" label="Telefon raqamingiz" error={form.formState.errors.phone?.message}>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" aria-hidden="true" />
              <Controller
                name="phone"
                control={form.control}
                render={({ field }) => (
                  <PhoneInput
                    id="phone"
                    placeholder="+998 90 123 45 67"
                    autoComplete="tel"
                    inputMode="tel"
                    aria-invalid={!!form.formState.errors.phone}
                    aria-describedby={form.formState.errors.phone ? 'phone-error' : undefined}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-600 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20 aria-[invalid=true]:focus:border-red-600 aria-[invalid=true]:focus:ring-red-500/25 aria-invalid:border-red-500 aria-invalid:ring-red-500/20 aria-invalid:focus:border-red-600 aria-invalid:focus:ring-red-500/25 transition-all shadow-2xs"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                )}
              />
            </div>
          </Field>

          {/* Password Field */}
          <Field
            id="password"
            label="Tizimga kirish uchun parol"
            error={form.formState.errors.password?.message}
            hint={
              <p id="password-hint" className="text-[11px] text-slate-500">
                Kamida 8 ta belgi, mustahkam parol
              </p>
            }
          >
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" aria-hidden="true" />
              <PasswordInput
                id="password"
                placeholder="Kamida 8 ta belgi"
                autoComplete="new-password"
                aria-invalid={!!form.formState.errors.password}
                aria-describedby={
                  form.formState.errors.password
                    ? 'password-error password-hint'
                    : 'password-hint'
                }
                className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-600 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20 aria-[invalid=true]:focus:border-red-600 aria-[invalid=true]:focus:ring-red-500/25 aria-invalid:border-red-500 aria-invalid:ring-red-500/20 aria-invalid:focus:border-red-600 aria-invalid:focus:ring-red-500/25 transition-all shadow-2xs"
                {...form.register('password')}
              />
            </div>
          </Field>

          {/* Business Type Select */}
          <Field id="type" label="Obyekt turi" error={form.formState.errors.type?.message}>
            <Select
              id="type"
              aria-invalid={!!form.formState.errors.type}
              aria-describedby={form.formState.errors.type ? 'type-error' : undefined}
              {...form.register('type')}
            >
              <option value="hotel" className="bg-white text-slate-900">
                Mehmonxona
              </option>
              <option value="hostel" className="bg-white text-slate-900">
                Yotoqxona (Hostel)
              </option>
              <option value="guesthouse" className="bg-white text-slate-900">
                Mehmon uyi
              </option>
              <option value="motel" className="bg-white text-slate-900">
                Motel
              </option>
              <option value="dacha" className="bg-white text-slate-900">
                Dacha
              </option>
              <option value="restaurant" className="bg-white text-slate-900">
                Restoran
              </option>
              <option value="bus" className="bg-white text-slate-900">
                Transport (Mashina Ijarasi)
              </option>
            </Select>
          </Field>

          {/* Company Name */}
          <Field
            id="companyName"
            label="Obyekt yoki Kompaniya nomi"
            error={form.formState.errors.companyName?.message}
          >
            <Input
              id="companyName"
              autoComplete="organization"
              aria-invalid={!!form.formState.errors.companyName}
              aria-describedby={form.formState.errors.companyName ? 'companyName-error' : undefined}
              {...form.register('companyName')}
              placeholder="Kompaniya yoki brend nomi (masalan: Grand Hotel)"
              className={inputBaseClasses}
            />
          </Field>

          {/* City Dropdown */}
          <Field id="city" label="Shahar yoki hudud" error={form.formState.errors.city?.message}>
            <Select
              id="city-select"
              aria-invalid={!!form.formState.errors.city}
              aria-describedby={form.formState.errors.city ? 'city-error' : undefined}
              value={citySelection}
              onChange={(e) => {
                const val = e.target.value;
                setCitySelection(val);
                if (val !== 'custom') {
                  form.setValue('city', val, { shouldValidate: true });
                } else {
                  form.setValue('city', customCity, { shouldValidate: true });
                }
              }}
            >
              <optgroup label="O'zbekiston shaharlari va dam olish hududlari">
                {UZBEKISTAN_CITIES.map((c) => (
                  <option key={c} value={c} className="bg-white text-slate-900">
                    {c}
                  </option>
                ))}
              </optgroup>
              <option value="custom" className="bg-white text-slate-900 font-semibold text-blue-600">
                + Boshqa hudud (qo'lda kiritish)...
              </option>
            </Select>

            {citySelection === 'custom' && (
              <div className="mt-2 animate-in fade-in-50 duration-150">
                <Input
                  id="city"
                  autoFocus
                  placeholder="Shahar yoki tuman nomini kiriting (masalan: Qo'qon)"
                  className={inputBaseClasses}
                  value={customCity}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomCity(val);
                    form.setValue('city', val, { shouldValidate: true });
                  }}
                  aria-invalid={!!form.formState.errors.city}
                  aria-describedby={form.formState.errors.city ? 'city-error' : undefined}
                />
              </div>
            )}
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
  id,
  label,
  error,
  children,
  hint,
}: {
  id?: string;
  label: string;
  error?: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-bold text-slate-700">
        {label}
      </Label>
      {children}
      {hint}
      {error ? (
        <p
          id={id ? `${id}-error` : undefined}
          role="alert"
          className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-0.5 animate-in fade-in-50"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
